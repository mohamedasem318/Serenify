import { describe, expect, it } from "vitest";

import { createTailSource } from "@/components/monitor/tail-cutter";

/**
 * The bounded tail-window source (2026-08-06): structural cut points, verified — never
 * recorder-chunk boundaries. Synthetic containers built byte-by-byte so the tests can
 * plant decoy cluster IDs in payload bytes (the webm false-positive risk a bare ID scan
 * would fall for) and split appends mid-structure (recorder chunks land anywhere).
 */

// ── synthetic webm ─────────────────────────────────────────────────────────────────────

const WEBM_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];
const CLUSTER_ID = [0x1f, 0x43, 0xb6, 0x75];
const UNKNOWN_SIZE = [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];

/** A decoy: the cluster ID inside payload, followed by bytes that fail validation. */
const DECOY = [...CLUSTER_ID, 0x00, 0x99, 0x99];
/** A subtler decoy: valid size vint but the next element is not a Timestamp (0xE7). */
const DECOY2 = [...CLUSTER_ID, 0x81, 0x55];

function cluster(tsMs: number, payloadLen: number): number[] {
  const ts = [(tsMs >>> 24) & 0xff, (tsMs >>> 16) & 0xff, (tsMs >>> 8) & 0xff, tsMs & 0xff];
  const payload = Array.from({ length: payloadLen }, (_, i) => (i * 37 + tsMs) % 251);
  return [...CLUSTER_ID, ...UNKNOWN_SIZE, 0xe7, 0x84, ...ts, ...DECOY, ...payload, ...DECOY2];
}

function webmStream(clusterTs: number[]): { bytes: Uint8Array; offsets: number[] } {
  const header = [...WEBM_MAGIC, 0x9f, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const out: number[] = [...header];
  const offsets: number[] = [];
  for (const ts of clusterTs) {
    offsets.push(out.length);
    out.push(...cluster(ts, 40));
  }
  return { bytes: new Uint8Array(out), offsets };
}

// ── synthetic fMP4 ─────────────────────────────────────────────────────────────────────

function box(type: string, payload: number[]): number[] {
  const size = 8 + payload.length;
  return [
    (size >>> 24) & 0xff, (size >>> 16) & 0xff, (size >>> 8) & 0xff, size & 0xff,
    type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3),
    ...payload,
  ];
}

const TIMESCALE = 600;

function fmp4Stream(fragTs: number[]): { bytes: Uint8Array; offsets: number[] } {
  const u32 = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
  const mdhd = box("mdhd", [0, 0, 0, 0, ...u32(0), ...u32(0), ...u32(TIMESCALE), ...u32(0)]);
  const moov = box("moov", box("trak", box("mdia", mdhd)));
  const out: number[] = [...box("ftyp", [105, 115, 111, 109]), ...moov];
  const offsets: number[] = [];
  for (const ts of fragTs) {
    const ticks = Math.round((ts * TIMESCALE) / 1000);
    const tfdt = box("tfdt", [0, 0, 0, 0, ...u32(ticks)]); // version 0
    offsets.push(out.length);
    out.push(...box("moof", box("traf", tfdt)));
    out.push(...box("mdat", Array.from({ length: 60 }, (_, i) => (i * 13 + ts) % 250)));
  }
  return { bytes: new Uint8Array(out), offsets };
}

// ── helpers ────────────────────────────────────────────────────────────────────────────

function feed(source: ReturnType<typeof createTailSource>, bytes: Uint8Array, chunk: number) {
  for (let i = 0; i < bytes.length; i += chunk) {
    // Copy so each append owns its buffer (as a real Blob.arrayBuffer() result does).
    source.append(bytes.slice(i, i + chunk).buffer as ArrayBuffer);
  }
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function expectedTail(bytes: Uint8Array, headerEnd: number, cutOffset: number): Uint8Array {
  const out = new Uint8Array(headerEnd + (bytes.length - cutOffset));
  out.set(bytes.subarray(0, headerEnd));
  out.set(bytes.subarray(cutOffset), headerEnd);
  return out;
}

// Cluster timestamps ~3.4 s apart, like real Chrome output; last at 80 s so the 66 s keep
// window puts the cut at the latest cluster ≤ 14 s.
const TS = Array.from({ length: 25 }, (_, i) => i * 3_400);

describe("tail-cutter — webm", () => {
  it("uploads the full recording until the keep window is exceeded, then a verified tail", async () => {
    const { bytes, offsets } = webmStream(TS);
    const source = createTailSource();

    // Young recording: only the first few clusters (max ts 10.2 s < 66 s keep).
    const young = bytes.subarray(0, offsets[4]);
    feed(source, young.slice(), 999);
    const first = source.build("video/webm");
    expect(first.kind).toBe("full");
    expect(await blobBytes(first.blob)).toEqual(young);

    // The rest arrives; latest cluster ts 81.6 s → cut at the latest cluster ≤ 15.6 s.
    feed(source, bytes.slice(offsets[4]), 999);
    const built = source.build("video/webm");
    expect(built.kind).toBe("tail");
    const target = TS[TS.length - 1]! - 66_000;
    const cutIdx = TS.filter((t) => t <= target).length - 1;
    expect(await blobBytes(built.blob)).toEqual(
      expectedTail(bytes, offsets[0]!, offsets[cutIdx]!),
    );
  });

  it("finds boundaries across arbitrary chunk splits (mid-ID, mid-vint)", async () => {
    const { bytes, offsets } = webmStream(TS);
    const source = createTailSource();
    feed(source, bytes, 7); // every structure crosses an append boundary somewhere
    const built = source.build("video/webm");
    expect(built.kind).toBe("tail");
    const target = TS[TS.length - 1]! - 66_000;
    const cutIdx = TS.filter((t) => t <= target).length - 1;
    expect(await blobBytes(built.blob)).toEqual(
      expectedTail(bytes, offsets[0]!, offsets[cutIdx]!),
    );
  });

  it("drops old bytes once a cut exists (bounded memory), keeping one boundary of slack", () => {
    const { bytes } = webmStream(TS);
    const source = createTailSource();
    feed(source, bytes, 999);
    expect(source.retainedBytes()).toBeLessThan(bytes.length);
    // Still enough for the tail + one boundary of slack (never trimmed past the cut).
    expect(source.build("video/webm").kind).toBe("tail");
  });
});

describe("tail-cutter — fMP4", () => {
  // Fragment tfdt ~1 s apart, like real Safari output; last at 80 s.
  const FRAG_TS = Array.from({ length: 81 }, (_, i) => i * 1_000);

  it("cuts at a moof start chosen by its tfdt time", async () => {
    const { bytes, offsets } = fmp4Stream(FRAG_TS);
    const source = createTailSource();
    feed(source, bytes, 999);
    const built = source.build("video/mp4");
    expect(built.kind).toBe("tail");
    const target = FRAG_TS[FRAG_TS.length - 1]! - 66_000;
    const cutIdx = FRAG_TS.filter((t) => t <= target).length - 1;
    expect(await blobBytes(built.blob)).toEqual(
      expectedTail(bytes, offsets[0]!, offsets[cutIdx]!),
    );
  });

  it("tolerates a truncated trailing fragment (a recorder chunk mid-mdat)", async () => {
    const { bytes, offsets } = fmp4Stream(FRAG_TS);
    const cutAt = bytes.length - 30; // mid-way through the final mdat
    const source = createTailSource();
    feed(source, bytes.subarray(0, cutAt).slice(), 999);
    const built = source.build("video/mp4");
    expect(built.kind).toBe("tail");
    const target = FRAG_TS[FRAG_TS.length - 1]! - 66_000;
    const cutIdx = FRAG_TS.filter((t) => t <= target).length - 1;
    expect(await blobBytes(built.blob)).toEqual(
      expectedTail(bytes.subarray(0, cutAt), offsets[0]!, offsets[cutIdx]!),
    );
  });

  it("under the keep window it uploads the full recording", async () => {
    const { bytes } = fmp4Stream(FRAG_TS.slice(0, 30)); // max tfdt 29 s < 66 s
    const source = createTailSource();
    feed(source, bytes, 999);
    const built = source.build("video/mp4");
    expect(built.kind).toBe("full");
    expect(await blobBytes(built.blob)).toEqual(bytes);
  });
});

describe("tail-cutter — fallback", () => {
  it("an unrecognised container falls back to full uploads (correct, unbounded)", async () => {
    const junk = new Uint8Array(Array.from({ length: 64 }, (_, i) => (i * 31) % 253));
    const source = createTailSource();
    feed(source, junk, 999);
    const built = source.build("video/webm");
    expect(built.kind).toBe("full");
    expect(await blobBytes(built.blob)).toEqual(junk);
    expect(source.retainedBytes()).toBe(junk.length);
  });
});
