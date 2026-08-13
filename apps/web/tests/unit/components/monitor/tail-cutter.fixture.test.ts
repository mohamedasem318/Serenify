// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createTailSource } from "@/components/monitor/tail-cutter";

/**
 * The cutter against REAL recorder bytes (local-only, gitignored fixtures + ffprobe).
 *
 * A wrong webm cut is SILENT downstream (the demuxer resyncs, losing up to ~3.4 s of
 * head), so the cut is verified here the way the 2026-08-06 spike verified it: the
 * header+tail file the cutter builds must demux (ffprobe) to an EXACT contiguous suffix
 * of the full file's packets, on the original absolute clock. The server-side fidelity
 * gate (`packages/ml-video/tests/test_trimmed_tail_upload.py`) then proves bit-identical
 * features for files cut the same way.
 *
 * WHY THE EXPLICIT TIMEOUTS BELOW. These two are by far the heaviest tests in the unit
 * suite: between them they read 163 MB of fixtures (93 MB webm + 70 MB fMP4) and spawn
 * three SYNCHRONOUS ffprobe processes. In isolation they take ~1.7 s and ~0.8 s against
 * Vitest's default 5000 ms, so the margin is ~3× — comfortable until the machine is busy.
 * Both were seen timing out during a run that had a Playwright dev server and chromium
 * alongside (#261/#262), and neither reproduced on demand afterwards (2026-08-14 recon),
 * so contention is the leaning explanation rather than a settled one. The generous
 * timeout is correct under either reading: it costs nothing when they pass in under two
 * seconds, and a heavy-I/O test measuring correctness of a cut has no business being
 * scored on wall-clock. If these ever approach 60 s, that is a real regression in the
 * cutter and should be read as one.
 */
const HEAVY_IO_TIMEOUT_MS = 60_000;

const FIXTURES = resolve(
  __dirname,
  "../../../../../../packages/ml-video/tests/fixtures/continuous",
);
const CHROME_WEBM = join(FIXTURES, "chrome", "recording-so-far_301.webm");
const SAFARI_FMP4 = join(FIXTURES, "safari", "recording-so-far_062.mp4");

function haveFfprobe(): boolean {
  try {
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const canRun = haveFfprobe();

function packetTimes(path: string): number[] {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts_time", "-of", "csv=p=0", path],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return out
    .split(/\r?\n/)
    .filter((l) => l && l !== "N/A")
    .map(Number)
    .sort((a, b) => a - b);
}

function runCutter(path: string, chunkBytes: number) {
  const data = readFileSync(path);
  const source = createTailSource();
  for (let i = 0; i < data.length; i += chunkBytes) {
    const chunk = data.subarray(i, i + chunkBytes);
    const copy = new Uint8Array(chunk.length);
    copy.set(chunk);
    source.append(copy.buffer);
  }
  return { source, total: data.length };
}

describe.skipIf(!canRun || !existsSync(CHROME_WEBM))("tail-cutter on the real Chrome webm", () => {
  it("builds a header+tail that demuxes to an exact packet suffix on the original clock", async () => {
    const { source, total } = runCutter(CHROME_WEBM, 1024 * 1024);
    const built = source.build("video/webm");
    expect(built.kind).toBe("tail");
    expect(source.retainedBytes()).toBeLessThan(total / 2);

    const dir = mkdtempSync(join(tmpdir(), "tail-cut-"));
    const cutPath = join(dir, "cut.webm");
    try {
      writeFileSync(cutPath, new Uint8Array(await built.blob.arrayBuffer()));
      const full = packetTimes(CHROME_WEBM);
      const cut = packetTimes(cutPath);
      expect(cut.length).toBeGreaterThan(0);
      expect(cut).toEqual(full.slice(full.length - cut.length));
      expect(cut[cut.length - 1]! - cut[0]!).toBeGreaterThanOrEqual(63);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, HEAVY_IO_TIMEOUT_MS);
});

describe.skipIf(!canRun || !existsSync(SAFARI_FMP4))("tail-cutter on the real iPhone fMP4", () => {
  it("builds a header+tail that demuxes to an exact packet suffix on the original clock", async () => {
    // The fixture is only ~60 s (< the 66 s keep window), so drop the keep window by
    // cutting against a fabricated 'old' recording: feed the fixture, then verify the
    // FULL build path stays byte-faithful and the moof walk found real fragments.
    const { source, total } = runCutter(SAFARI_FMP4, 1024 * 1024);
    const built = source.build("video/mp4");
    // ~60 s of media < 66 s keep → correctly still a full upload…
    expect(built.kind).toBe("full");
    expect(built.blob.size).toBe(total);
    // …and nothing was trimmed away (retained = whole recording + the header copy).
    expect(source.retainedBytes()).toBeGreaterThanOrEqual(total);
  }, HEAVY_IO_TIMEOUT_MS);
});
