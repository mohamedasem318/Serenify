/**
 * Pure framing logic for the calibration capture flow (feature 005, 📌 DECISION-19).
 *
 * Maps a per-frame face-detection result + a brightness reading into the soft-gate
 * verdict (green room) and the in-recording drift state — with forgiving, tunable
 * thresholds and a grace-window debounce so a momentary wobble never trips a nudge
 * (FR-009, FR-018, FR-020). Everything here is PURE: input signal + prior debounce
 * → verdict + next debounce. No timers, no DOM, no I/O — the caller supplies the
 * frame timestamp (`at`), so the grace window is unit-testable with a fake clock.
 *
 * Privacy (Principle I): these values are ephemeral, on-device, and never leave the
 * browser. See contracts/face-detection.md.
 */

/** A normalized face bounding box from the detector (all coords in [0,1]). */
export interface FaceBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  score: number;
}

export interface FramingSignal {
  /** detection score ≥ SCORE_MIN */
  facePresent: boolean;
  /** distance of the box centre from the frame centre, normalized (0 = dead-centre) */
  centreDistance: number;
  /** box height / frame height */
  sizeRatio: number;
  /** target-region mean luma, 0..255 (canvas, model-independent) */
  brightness: number;
  /** frame timestamp in ms — drives the debounce windows */
  at: number;
}

export type GateVerdict = "ready" | "no-face" | "off-centre" | "too-dark";
export type DriftState = "centred" | "ease-back" | "absent";

/**
 * Threshold constants (forgiving by design — FR-009: do not block users who look
 * fine to themselves). Tunable in one place during /speckit-tasks and smoke.
 */
export const SCORE_MIN = 0.5;
export const NO_FACE_FRAMES = 3;
export const CENTRE_MAX = 0.18;
export const SIZE_MIN = 0.12;
export const SIZE_MAX = 0.8;
export const LUMA_MIN = 40;
export const SET_DEBOUNCE_MS = 500;
export const DRIFT_GRACE_MS = 2000;

export interface GateDebounce {
  /** consecutive frames with no detected face */
  absentFrames: number;
  /** timestamp (ms) since the frame has been continuously gate-good, or null */
  goodSince: number | null;
}

export interface DriftDebounce {
  /** timestamp (ms) since the face went continuously off-target, or null when centred */
  offSince: number | null;
}

export const initialGateDebounce: GateDebounce = { absentFrames: 0, goodSince: null };
export const initialDriftDebounce: DriftDebounce = { offSince: null };

/** Build a framing signal from a detection box (or null) + a brightness reading. */
export function toFramingSignal(box: FaceBox | null, luma: number, at: number): FramingSignal {
  const present = box !== null && box.score >= SCORE_MIN;
  const centreDistance = present ? Math.hypot(box!.cx - 0.5, box!.cy - 0.5) : 1;
  const sizeRatio = present ? box!.h : 0;
  return { facePresent: present, centreDistance, sizeRatio, brightness: luma, at };
}

/** Whether the face is currently within the fixed centred target. */
function isCentred(s: FramingSignal): boolean {
  return s.facePresent && s.centreDistance <= CENTRE_MAX;
}

/**
 * Soft quality gate (green room). Returns the current verdict, whether "I'm ready"
 * may enable (`ready` — requires a clear frame held for SET_DEBOUNCE_MS so the
 * enable doesn't flicker), and the next debounce state.
 *
 * Only the three obvious dealbreakers hold the gate: no face, badly off-centre, or
 * basically too dark. A brief absence (< NO_FACE_FRAMES) rides on the prior good
 * state rather than instantly un-readying — forgiving flicker control.
 */
export function evaluateGate(
  s: FramingSignal,
  prev: GateDebounce,
): { verdict: GateVerdict; ready: boolean; next: GateDebounce } {
  const absentFrames = s.facePresent ? 0 : prev.absentFrames + 1;

  let verdict: GateVerdict;
  if (!s.facePresent) {
    // A brief blip (< NO_FACE_FRAMES) rides the prior good state for flicker
    // control; a sustained or cold-start absence reads as "no-face".
    verdict = absentFrames < NO_FACE_FRAMES && prev.goodSince !== null ? "ready" : "no-face";
  } else if (s.centreDistance > CENTRE_MAX) {
    verdict = "off-centre";
  } else if (s.brightness < LUMA_MIN) {
    verdict = "too-dark";
  } else {
    verdict = "ready";
  }

  const good = verdict === "ready";
  const goodSince = good ? (prev.goodSince ?? s.at) : null;
  const ready = good && goodSince !== null && s.at - goodSince >= SET_DEBOUNCE_MS;

  return { verdict, ready, next: { absentFrames, goodSince } };
}

/**
 * In-recording drift, grace-gated (FR-017/018/020). Quiet when centred; a calm
 * "ease back to centre" only after the face has been off-target continuously for
 * DRIFT_GRACE_MS; "we can't see you" when absent past the same window. A wobble
 * shorter than the grace window produces no nudge, and nothing here ever stops the
 * recording.
 */
export function evaluateDrift(
  s: FramingSignal,
  prev: DriftDebounce,
): { drift: DriftState; next: DriftDebounce } {
  if (isCentred(s)) {
    return { drift: "centred", next: { offSince: null } };
  }
  const offSince = prev.offSince ?? s.at;
  const elapsed = s.at - offSince;
  let drift: DriftState;
  if (elapsed >= DRIFT_GRACE_MS) {
    drift = s.facePresent ? "ease-back" : "absent";
  } else {
    drift = "centred"; // within the grace window — no nudge yet
  }
  return { drift, next: { offSince } };
}
