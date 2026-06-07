/**
 * Cause telemetry for the post-recording failure chip (feature 005, 📌 DECISION-24).
 *
 * Accumulated from the on-device framing signals DURING recording, then collapsed
 * to a single dominant cause. Pure (no DOM, no I/O) so the mapping is unit-tested
 * directly. The guiding principle: we never assert a user-side cause we did not
 * measure — when the detector was unavailable or nothing adverse dominates, the
 * chip is "our-side" (which carries no "do better" instruction).
 */

import { CENTRE_MAX, LUMA_MIN, type FramingSignal } from "./framing";

export type DominantCause = "low-light" | "out-of-frame" | "our-side";

export interface CauseTelemetry {
  /** frames below the brightness floor */
  darkFrames: number;
  /** frames with no face, or a face well off the centred target */
  offTargetFrames: number;
  totalFrames: number;
  /** true once any signal arrives — signals only fire while the detector runs */
  detectorAvailable: boolean;
}

/** A cause must dominate at least this share of measured frames to be claimed. */
export const CAUSE_MIN_RATIO = 0.35;

export function emptyTelemetry(): CauseTelemetry {
  return { darkFrames: 0, offTargetFrames: 0, totalFrames: 0, detectorAvailable: false };
}

/** Fold one framing signal into the telemetry (mutates in place + returns it). */
export function accumulate(t: CauseTelemetry, signal: FramingSignal): CauseTelemetry {
  t.detectorAvailable = true; // a signal only arrives when the detector is running
  t.totalFrames += 1;
  if (signal.brightness < LUMA_MIN) t.darkFrames += 1;
  if (!signal.facePresent || signal.centreDistance > CENTRE_MAX) t.offTargetFrames += 1;
  return t;
}

/**
 * The dominant adverse cause. Defaults to "our-side" when the detector was
 * unavailable (no frames) or no client signal crosses CAUSE_MIN_RATIO; otherwise
 * the larger of the dark / off-target ratios wins.
 */
export function dominantCause(t: CauseTelemetry): DominantCause {
  if (!t.detectorAvailable || t.totalFrames === 0) return "our-side";
  const darkRatio = t.darkFrames / t.totalFrames;
  const offRatio = t.offTargetFrames / t.totalFrames;
  if (darkRatio < CAUSE_MIN_RATIO && offRatio < CAUSE_MIN_RATIO) return "our-side";
  return darkRatio >= offRatio ? "low-light" : "out-of-frame";
}
