/**
 * Bitrate-ladder rules — the decision logic behind the `/capture-probe` ladder run,
 * kept out of the component so it can be tested without a camera or a browser.
 *
 * The question the ladder answers: does this engine honor `MediaRecorder`'s
 * `videoBitsPerSecond`, and how low can the target go before the video stops being
 * usable for face landmark extraction? iOS Safari records H.264 at ~5.4 Mbit/s where
 * desktop Chrome VP9 sits at ~0.75, and at that weight an iOS monitoring session lands
 * under the 60 s scoring gate and produces zero scored windows.
 *
 * Nothing here runs in the production capture path. See `capture-probe.tsx`.
 */

/** The ladder is a DIFFERENT report shape from the capability run, so it carries its
 *  own wire version — a reader must never have to guess which run produced a paste. */
export const LADDER_VERSION = "capture-probe-ladder/1";

/** Per ladder step. Long enough for 2+ timeslice flushes at the production 10 s stride,
 *  short enough that seven steps plus setup stay near a five-minute session. */
export const LADDER_RECORD_MS = 25_000;

/** The bitrate ladder, descending. `null` = no `videoBitsPerSecond` at all (the encoder
 *  default — the ~5.4 Mbit/s iOS baseline this whole question is about). 0.75 Mbit/s is
 *  desktop Chrome VP9 wire parity; 0.5 is an expected-failure anchor, included so the
 *  ladder brackets the usable floor from BELOW as well as above. */
export const LADDER_TARGETS_BPS = [
  null,
  3_000_000,
  2_000_000,
  1_500_000,
  1_000_000,
  750_000,
  500_000,
] as const;

/** Which steps are kept as files for offline FaceMesh assessment: the unset baseline,
 *  the safe candidate, and Chrome wire parity. Fixed rather than "whichever came out
 *  lowest" so the retained pair brackets the floor from both sides. */
export const RETAINED_TARGETS_BPS: readonly (number | null)[] = [null, 1_500_000, 750_000];

/** The production operating point's short side. Every device in the 2026-08-05 probe
 *  that granted a 720-class mode under `ideal` 1280x720 reported one of 1280x720
 *  (laptops, Galaxys) or 720x1280 (iPhone, portrait) — so the short side, not the
 *  width, is the invariant to check. */
export const PRODUCTION_SHORT_SIDE = 720;

/** One timeslice chunk: ms since recorder start, and its size. */
export interface ChunkLog {
  t: number;
  bytes: number;
}

/** The subset of `MediaTrackSettings` the probe records. */
export interface TrackSettingsSummary {
  width: number | null;
  height: number | null;
  frameRate: number | null;
  facingMode: string | null;
  aspectRatio: number | null;
}

/** One rung of the bitrate ladder, as it lands in the report. */
export interface LadderStep {
  target: string;
  targetBps: number | null;
  /** What `MediaRecorder.videoBitsPerSecond` reflected back. Recorded SEPARATELY from
   *  the outcome on purpose: reflection is self-report, and this engine's self-report is
   *  exactly what `isTypeSupported` already got wrong once — it claims WebM support on
   *  iOS and then produces undecodable output. Never read this as "honored";
   *  `effectiveMbps`, derived from bytes over media seconds, is the answer. */
  reflectedVideoBitsPerSecond: number | null;
  grantedBefore: TrackSettingsSummary | null;
  grantedAfter: TrackSettingsSummary | null;
  requestedMime?: string | null;
  reportedMime?: string;
  chunkCount?: number;
  chunks?: ChunkLog[];
  maxChunkGapMs?: number | null;
  totalBytes?: number;
  wallSeconds?: number;
  mediaSeconds?: number | null;
  mediaToWallRatio?: number | null;
  effectiveMbps?: number | null;
  recorderError?: string | null;
  durationError?: string;
  error?: string;
  /** True when this step did NOT hold the production operating point (or could not be
   *  measured). Its numbers stay in the report but must not be read as a result. */
  void: boolean;
  voidReason?: string;
}

/** A recording kept in memory so the tester can send it off the phone. */
export interface RetainedClip {
  label: string;
  fileName: string;
  file: File;
  /** Set when the intended step was void and its nearest valid neighbour stood in. */
  substitutedFor?: string;
}

/** Bits per second → the label used in both the report and the on-screen clip list. */
export function bitrateLabel(bps: number | null): string {
  return bps == null ? "unset (encoder default)" : `${(bps / 1_000_000).toFixed(2)} Mbit/s`;
}

/** File extension for a recorded blob, from the container the recorder actually used. */
export function extensionFor(blobType: string): string {
  if (blobType.includes("mp4")) return "mp4";
  if (blobType.includes("webm")) return "webm";
  return "bin";
}

/**
 * Did this step hold the production operating point for the whole recording?
 *
 * Two distinct hazards, both real. The probe itself can move the operating point — a
 * past run recorded 480x640 because of an `applyConstraints({})` reset, and produced a
 * wire-weight figure that had to be withdrawn. And the camera can downshift *during* a
 * recording, which only a before/after comparison catches. A step failing either check
 * keeps its numbers but is marked void, and void numbers are never averaged in.
 *
 * Returns the reason, or `null` when the step held.
 */
export function voidReasonFor(
  before: TrackSettingsSummary | null,
  after: TrackSettingsSummary | null,
): string | null {
  if (!before || !after) return "camera settings unreadable";
  const shortSide = (s: TrackSettingsSummary) =>
    s.width != null && s.height != null ? Math.min(s.width, s.height) : null;
  const [sb, sa] = [shortSide(before), shortSide(after)];
  if (sb == null || sa == null) return "camera reported no resolution";
  if (sb !== sa || before.frameRate !== after.frameRate) {
    return `settings drifted mid-recording: ${before.width}x${before.height}@${before.frameRate} → ${after.width}x${after.height}@${after.frameRate}`;
  }
  if (sb !== PRODUCTION_SHORT_SIDE) {
    return `recorded at ${before.width}x${before.height}, not the ${PRODUCTION_SHORT_SIDE}-class production operating point`;
  }
  return null;
}

/** Largest gap between consecutive timeslice flushes, measuring the first gap from
 *  recorder start. A bitrate target that "works" by stalling the encoder shows up
 *  here, not in the byte totals. */
export function maxChunkGap(chunks: ChunkLog[]): number | null {
  if (chunks.length < 2) return null;
  let previous = 0;
  let max = 0;
  for (const chunk of chunks) {
    max = Math.max(max, chunk.t - previous);
    previous = chunk.t;
  }
  return max;
}

/** One human-readable line per step, so the report is skimmable in a chat message
 *  without parsing the JSON underneath it. */
export function summarizeStep(step: LadderStep): string {
  if (step.error) return `${step.target} → FAILED: ${step.error}`;
  const g = step.grantedBefore;
  const shot = g ? `${g.width}x${g.height}@${g.frameRate}` : "settings unknown";
  const eff =
    step.effectiveMbps != null
      ? `${step.effectiveMbps.toFixed(2)} Mbit/s effective`
      : "effective bitrate unmeasurable";
  const media =
    step.mediaSeconds != null
      ? `${step.mediaSeconds}s media / ${step.wallSeconds}s wall`
      : "media duration unreadable";
  const head = step.void ? `VOID (${step.voidReason}) ` : "";
  return `${head}${step.target} → ${eff} · ${shot} · ${media} · ${step.chunkCount} chunks`;
}

/**
 * Wrap a retained recording as a named file. `intendedLabel` is the ladder rung the clip
 * was kept FOR, which differs from `source.target` only when the intended step was void
 * and its nearest valid neighbour stood in — recorded so a substitution can never be
 * mistaken for the rung that was asked for.
 */
export function makeClip(source: LadderStep, blob: Blob, intendedLabel: string): RetainedClip {
  const slug =
    source.targetBps == null ? "baseline" : `${Math.round(source.targetBps / 1000)}kbps`;
  const fileName = `serenify-probe-${slug}.${extensionFor(blob.type ?? "")}`;
  return {
    label: source.target,
    fileName,
    file: new File([blob], fileName, { type: blob.type || "application/octet-stream" }),
    ...(source.target === intendedLabel ? {} : { substitutedFor: intendedLabel }),
  };
}
