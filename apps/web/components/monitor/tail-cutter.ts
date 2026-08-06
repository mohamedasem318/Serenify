/**
 * Bounded tail-window source for the continuous monitoring recorder (2026-08-06).
 *
 * The recorder used to upload the **whole accumulated recording** every ~10 s stride, so
 * per-stride cost grew linearly with session time and the upload cycle eventually outran
 * the stride. This module turns the chunk stream into **header + a bounded contiguous
 * tail**: per-stride payload is flat with respect to elapsed session time, and old bytes
 * are dropped from memory (the client no longer retains the whole recording).
 *
 * Why this is safe (2026-08-06 spike, verdict GO): both capture containers stamp every
 * media chunk with its **absolute original-timeline position** (webm cluster `Timestamp`,
 * fMP4 fragment `tfdt`), so a file built from header + a contiguous tail stays on the
 * original clock and the server's file-global 2.5 fps sampling grid reproduces exactly
 * (bit-identical features — `packages/ml-video/tests/test_trimmed_tail_upload.py`).
 *
 * Cut points are STRUCTURAL container boundaries, never recorder-chunk boundaries
 * (`dataavailable` boundaries do not land on them):
 *
 *  - **webm**: cluster starts. Clusters are unknown-size in a streaming MediaRecorder
 *    webm, so they are found by scanning for the 4-byte cluster ID — and because a bare
 *    ID scan can hit payload bytes, a candidate is only accepted when the full structure
 *    parses: `ID + size-vint + Timestamp element (0xE7) + non-decreasing timestamp`. A
 *    wrong webm cut is SILENT downstream (the demuxer resyncs, dropping up to ~3.4 s of
 *    head), so the cut must be verified here, at cut time; the server's 10 ms grid-match
 *    is the final backstop (a cut the margin cannot absorb skips loudly, never mis-scores).
 *  - **fMP4**: `moof` starts, via the explicit box-length walk (sizes are declared, so
 *    the walk is exact); timestamps from `tfdt` scaled by the `moov`→`mdhd` timescale.
 *    A wrong fMP4 cut is LOUD (zero packets demux).
 *
 * Anything this module cannot parse confidently (unknown container, an unparseable box,
 * a non-monotonic timestamp stream) falls back to **full mode**: upload the whole
 * accumulated recording exactly as before — always correct, just unbounded (memory
 * included). The fallback is logged; on the supported recorders it should never happen.
 */

export type UploadKind = "tail" | "full";

export interface TailBuild {
  blob: Blob;
  kind: UploadKind;
}

export interface TailSource {
  /** Append the next recorder chunk's bytes, in arrival order. */
  append(bytes: ArrayBuffer): void;
  /** True once any media bytes have arrived. */
  hasBytes(): boolean;
  /** Build this stride's upload: header+tail once a safe cut exists, full until then. */
  build(mimeType: string): TailBuild;
  /** Diagnostics only: bytes currently retained in memory (header + window). */
  retainedBytes(): number;
}

/**
 * Media seconds the tail keeps behind the newest known boundary: the 60 s scored window
 * + cluster granularity (~3.4 s) + the server's decode margin, rounded up. The server
 * needs decoded coverage of `[duration − 60 s, duration]`; a cut at `≤ latest − 66 s`
 * leaves ≥ 6 s of slack — enough that even a silent one-cluster head resync on webm
 * still covers the window.
 */
const TAIL_KEEP_MS = 66_000;

type Mode = "detecting" | "webm" | "mp4" | "full";

interface Boundary {
  /** Absolute byte offset of the boundary in the accumulated stream. */
  offset: number;
  /** The boundary's media timestamp (ms, original recording clock). */
  tsMs: number;
}

function readU32(buf: Uint8Array, i: number): number {
  return buf[i]! * 0x1000000 + (buf[i + 1]! << 16) + (buf[i + 2]! << 8) + buf[i + 3]!;
}

function boxType(buf: Uint8Array, i: number): string {
  return String.fromCharCode(buf[i]!, buf[i + 1]!, buf[i + 2]!, buf[i + 3]!);
}

export function createTailSource(): TailSource {
  let mode: Mode = "detecting";
  /** Retained bytes; `bufStart` is the absolute offset of `buf[0]`. Annotated with the
   *  concrete ArrayBuffer backing so the views stay valid `BlobPart`s under TS 5.9. */
  let buf: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  let bufStart = 0;
  let total = 0;
  let header: Uint8Array<ArrayBuffer> | null = null;
  let boundaries: Boundary[] = [];
  /** webm: absolute resume position of the cluster-ID scan. */
  let scanPos = 0;
  /** mp4: absolute resume position of the box walk (may sit past the received bytes). */
  let walkPos = 0;
  /** mp4: mdhd timescale (ticks/second), parsed from moov. */
  let timescale = 0;

  function fullFallback(reason: string): void {
    mode = "full";
    boundaries = [];
    header = null;
    // Diagnostics only (2026-08-06); no UI surface.
    console.debug(`[monitor] tail-cutter: falling back to full uploads — ${reason}`);
  }

  function detect(): void {
    if (buf.length < 12) return;
    if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
      mode = "webm";
    } else if (boxType(buf, 4) === "ftyp") {
      mode = "mp4";
    } else {
      fullFallback("unrecognised container magic");
    }
  }

  // ── webm: validated cluster-ID scan ────────────────────────────────────────────────

  /** EBML vint at `i` → `[value | null-if-unknown-size, byteLength]`, or "incomplete"
   *  when the buffer ends mid-vint, or null when malformed. */
  function readVint(i: number): [number | null, number] | "incomplete" | null {
    if (i >= buf.length) return "incomplete";
    const first = buf[i]!;
    if (first === 0) return null; // >8-byte vint — not something MediaRecorder emits
    const length = 9 - (32 - Math.clz32(first));
    if (i + length > buf.length) return "incomplete";
    let value = first & (0xff >> length);
    let allOnes = value === 0xff >> length;
    for (let k = 1; k < length; k += 1) {
      value = value * 256 + buf[i + k]!;
      allOnes = allOnes && buf[i + k] === 0xff;
    }
    return [allOnes ? null : value, length];
  }

  /** Validate a cluster-ID candidate at relative offset `i`; returns its timestamp (ms),
   *  null (false positive), or "incomplete" (need more bytes to decide). */
  function clusterTs(i: number): number | null | "incomplete" {
    const sizeVint = readVint(i + 4);
    if (sizeVint === "incomplete") return "incomplete";
    if (sizeVint === null) return null;
    let pos = i + 4 + sizeVint[1];
    if (pos >= buf.length) return "incomplete";
    if (buf[pos] !== 0xe7) return null; // first child of a cluster is its Timestamp
    const tsVint = readVint(pos + 1);
    if (tsVint === "incomplete") return "incomplete";
    if (tsVint === null || tsVint[0] === null || tsVint[0] < 1 || tsVint[0] > 8) return null;
    pos += 1 + tsVint[1];
    if (pos + tsVint[0] > buf.length) return "incomplete";
    let ts = 0;
    for (let k = 0; k < tsVint[0]; k += 1) ts = ts * 256 + buf[pos + k]!;
    // Matroska default TimestampScale (1 ms ticks — what MediaRecorder writes). A false
    // positive would carry garbage: require the stream clock to never run backwards.
    const prev = boundaries.length ? boundaries[boundaries.length - 1]!.tsMs : -1;
    if (ts < prev) return null;
    return ts;
  }

  function scanWebm(): void {
    let i = Math.max(scanPos - bufStart, 0);
    while (i + 4 <= buf.length) {
      if (buf[i] === 0x1f && buf[i + 1] === 0x43 && buf[i + 2] === 0xb6 && buf[i + 3] === 0x75) {
        const ts = clusterTs(i);
        if (ts === "incomplete") break; // resume at this candidate on the next append
        if (ts !== null) {
          if (header === null) header = buf.slice(0, i); // bufStart is 0 pre-first-boundary
          boundaries.push({ offset: bufStart + i, tsMs: ts });
        }
      }
      i += 1;
    }
    scanPos = bufStart + i;
  }

  // ── fMP4: exact box walk ───────────────────────────────────────────────────────────

  /** Walk child boxes of [from, to) for `path`, returning the payload offset of the
   *  final box (after its version/flags are NOT skipped — caller reads them). */
  function findBox(from: number, to: number, path: string[]): number | null {
    const [name, ...rest] = path;
    let pos = from;
    while (pos + 8 <= to) {
      const size = readU32(buf, pos);
      if (size < 8 || pos + size > to) return null;
      if (boxType(buf, pos + 4) === name) {
        return rest.length ? findBox(pos + 8, pos + size, rest) : pos + 8;
      }
      pos += size;
    }
    return null;
  }

  function parseTimescale(moovRel: number, moovSize: number): number {
    const mdhd = findBox(moovRel + 8, moovRel + moovSize, ["trak", "mdia", "mdhd"]);
    if (mdhd === null) return 0;
    const version = buf[mdhd]!;
    const at = mdhd + 4 + (version === 1 ? 16 : 8);
    return readU32(buf, at);
  }

  function parseTfdtMs(moofRel: number, moofSize: number): number | null {
    const tfdt = findBox(moofRel + 8, moofRel + moofSize, ["traf", "tfdt"]);
    if (tfdt === null || timescale === 0) return null;
    const version = buf[tfdt]!;
    const ticks =
      version === 1
        ? readU32(buf, tfdt + 4) * 0x100000000 + readU32(buf, tfdt + 8)
        : readU32(buf, tfdt + 4);
    return (ticks * 1000) / timescale;
  }

  function walkMp4(): void {
    for (;;) {
      const rel = walkPos - bufStart;
      if (rel + 8 > buf.length) return; // box header not yet received
      let size = readU32(buf, rel);
      const type = boxType(buf, rel + 4);
      if (size === 1) {
        if (rel + 16 > buf.length) return;
        size = readU32(buf, rel + 8) * 0x100000000 + readU32(buf, rel + 12);
      } else if (size === 0 || size < 8) {
        fullFallback(`unwalkable ${type} box (size=${size})`);
        return;
      }
      if (type === "moof") {
        if (rel + size > buf.length) return; // need the whole moof for tfdt
        const ts = parseTfdtMs(rel, size);
        if (ts === null) {
          fullFallback("moof without a readable tfdt/timescale");
          return;
        }
        if (header === null) header = buf.slice(0, rel); // bufStart is 0 pre-first-moof
        boundaries.push({ offset: walkPos, tsMs: ts });
      } else if (type === "mdat") {
        // Media payload: skip by declared size — its bytes need not have arrived yet.
      } else {
        if (rel + size > buf.length) return; // header-era box (ftyp/moov/…): wait for it
        if (type === "moov") {
          timescale = parseTimescale(rel, size);
          if (timescale === 0) {
            fullFallback("moov without an mdhd timescale");
            return;
          }
        }
      }
      walkPos += size;
    }
  }

  // ── retention: drop bytes the next builds can no longer need ───────────────────────

  /** Index of the boundary a build would cut at right now (latest ts ≤ latest − keep). */
  function cutIndex(): number {
    if (boundaries.length === 0) return -1;
    const target = boundaries[boundaries.length - 1]!.tsMs - TAIL_KEEP_MS;
    let idx = -1;
    for (let k = 0; k < boundaries.length && boundaries[k]!.tsMs <= target; k += 1) idx = k;
    return idx;
  }

  function trim(): void {
    if ((mode !== "webm" && mode !== "mp4") || header === null) return;
    const idx = cutIndex();
    if (idx <= 0) return; // keep one boundary of slack behind the current cut
    const floor = boundaries[idx - 1]!.offset;
    if (floor <= bufStart) return;
    buf = buf.slice(floor - bufStart);
    bufStart = floor;
    boundaries = boundaries.filter((b) => b.offset >= floor);
  }

  return {
    append(bytes: ArrayBuffer): void {
      const chunk = new Uint8Array(bytes);
      const next = new Uint8Array(buf.length + chunk.length);
      next.set(buf);
      next.set(chunk, buf.length);
      buf = next;
      total += chunk.length;
      if (mode === "detecting") detect();
      if (mode === "webm") scanWebm();
      else if (mode === "mp4") walkMp4();
      trim();
    },

    hasBytes(): boolean {
      return total > 0;
    },

    build(mimeType: string): TailBuild {
      const type = { type: mimeType };
      const idx = cutIndex();
      if (header === null || idx < 0) {
        // No safe cut yet: young recording (< keep window), still detecting, or full-mode
        // fallback. `bufStart` is 0 in all of these (trim needs a cut), so `buf` IS the
        // whole accumulated recording — exactly the pre-fix upload shape.
        return { blob: new Blob([buf], type), kind: "full" };
      }
      const cut = boundaries[idx]!;
      return {
        blob: new Blob([header, buf.subarray(cut.offset - bufStart)], type),
        kind: "tail",
      };
    },

    retainedBytes(): number {
      return (header?.length ?? 0) + buf.length;
    },
  };
}
