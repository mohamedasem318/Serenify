/**
 * Shared capture settings for BOTH recorders — calibration (`anchor-recorder`) and
 * monitoring (`window-recorder`/`monitoring-session`).
 *
 * Scoring is `window − anchor` (the anchor comes from the user's own calibration
 * clip), so resolution, frame rate, AND container MUST stay identical across the two
 * paths — a cap applied to one alone is a silent scoring error, not a bug that
 * surfaces. That is why this module is the single source for both. Full evidence and
 * rationale: docs/triage/mobile-capture-diagnosis.md (Phase 2).
 *
 * The values target the TRAINING capture conditions, not "small": StressID video was
 * recorded on a Logitech QuickCam Pro 9000 at **1280×720, 15 fps** (the StressID
 * paper; recorded in docs/MODELS.md). The 2026-08-05 five-device probe showed 4 of 5
 * devices defaulting to 480p-class under the previous unconstrained getUserMedia —
 * BELOW training, in the upscaling regime at the 64×64 ROI resize — while under
 * `ideal` 720p every probed device granted 720p-class (laptops + Galaxys literal
 * 1280×720, iPhone portrait 720×1280). 15 fps is training-exact; the server resamples
 * to a fixed 2.5 fps grid regardless, so the frame-rate choice is model-invisible
 * while halving encode/upload/server-decode work vs 30 fps.
 *
 * `ideal` throughout, NEVER `exact` — Safari rejects `exact` capability constraints
 * far more readily than Chrome, and a camera that cannot reach 720p must still open.
 */

/** Requested capture caps. `ideal` only — see module header. */
export const CAPTURE_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 15 },
};

/**
 * The `video` member for a capture getUserMedia call, optionally pinned to a chosen
 * device. `deviceId` keeps `exact` deliberately — it is a device *pick* with an
 * explicit fallback path in the caller (anchor recorder's attempt list), not a
 * capability constraint, and `ideal` deviceId is free to be ignored.
 */
export function captureVideoConstraints(deviceId?: string): MediaTrackConstraints {
  return deviceId
    ? { ...CAPTURE_VIDEO_CONSTRAINTS, deviceId: { exact: deviceId } }
    : { ...CAPTURE_VIDEO_CONSTRAINTS };
}

/**
 * Apple WebKit detection (Safari on macOS + every iOS browser — all WebKit, all the
 * same MediaRecorder). `navigator.vendor` is deprecated-but-frozen: permanently
 * "Apple Computer, Inc." on WebKit, "Google Inc." on Chromium, "" on Firefox — a
 * stable engine signal that survives UA reduction/freezing.
 */
export function isAppleWebKit(): boolean {
  return typeof navigator !== "undefined" && (navigator.vendor ?? "").includes("Apple");
}

/**
 * Container preference, per engine (the 2026-08-05 probe findings):
 *
 * - Non-Apple: webm-first (vp9 → vp8 → generic), the shipped, validated path — both
 *   probed laptops and both Galaxys are healthy on it (media/wall 0.996–0.999). fMP4
 *   is kept as the trailing fallback (the T009/T026 posture: never hard-code one).
 * - Apple WebKit: **fMP4 only, with no WebM fallback at all.**
 *
 * The Apple asymmetry is the whole point, so it is worth stating plainly. Three iPhones
 * were probed (13 / Safari 18.7.5, 15 and 15 Pro Max / Safari 26.5.2). On all three,
 * `isTypeSupported('video/webm;codecs=vp9')` returns **true**, recording then runs the
 * full duration, emits chunks on schedule, raises no error, and produces ~45 MB whose
 * media duration is unreadable (0 s / decode error 2 / metadata timeout — the signature
 * differs per device, the outcome does not). `video/mp4` on the same device in the same
 * session yields clean 1:1 media-to-wall duration and correct timeslice chunks.
 *
 * So on Apple engines `isTypeSupported` is NOT a usable capability gate for WebM: it
 * reports support for a configuration that silently produces undecodable output. WebM is
 * therefore not a fallback here — it is a known-bad path, and falling back to it is
 * strictly worse than not recording, because the session burns the user's time and
 * bandwidth to produce nothing. When no MP4 type is available we fail instead
 * (`{ ok: false }`), and the caller surfaces that rather than starting the session.
 *
 * Note this also rules out `undefined` (browser-default) on Apple: the default container
 * is chosen by the same engine whose self-report we just established we cannot trust.
 *
 * avc1.42E01E (H.264 Constrained Baseline 3.0) is probed before bare "video/mp4" so
 * the codec is explicit where supported; Safari 26 reports true for it.
 */
const WEBM_FIRST = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4",
] as const;

/** Apple WebKit: MP4 only. Deliberately NO webm entries — see the block above. */
const MP4_ONLY = ["video/mp4;codecs=avc1.42E01E", "video/mp4"] as const;

/**
 * The outcome of container negotiation.
 *
 * `ok: true` carries the MIME type to record with; `mimeType: undefined` means "let the
 * browser choose its default", which stays reachable on non-Apple engines only.
 * `ok: false` means no container this engine can record *usably* — the caller MUST NOT
 * start a recording, and MUST tell the user why.
 */
export type CaptureMimeChoice =
  | { readonly ok: true; readonly mimeType: string | undefined }
  | { readonly ok: false; readonly reason: "no-supported-container" };

const UNSUPPORTED: CaptureMimeChoice = { ok: false, reason: "no-supported-container" };

/**
 * Pick the recorder MIME type for THIS engine — the one negotiation both recorders use.
 *
 * Non-Apple keeps its exact prior behavior, including the `undefined` browser-default
 * outcome, so the validated Chrome/Android WebM path does not move. Apple WebKit gets
 * MP4 or nothing.
 */
export function pickCaptureMimeType(): CaptureMimeChoice {
  const apple = isAppleWebKit();
  if (typeof MediaRecorder === "undefined") {
    // No MediaRecorder at all: nothing to negotiate. Non-Apple keeps the historical
    // "browser default" answer (the recorder construction itself will fail loudly);
    // on Apple we cannot claim an MP4 we never confirmed.
    return apple ? UNSUPPORTED : { ok: true, mimeType: undefined };
  }
  for (const type of apple ? MP4_ONLY : WEBM_FIRST) {
    if (MediaRecorder.isTypeSupported?.(type)) return { ok: true, mimeType: type };
  }
  return apple ? UNSUPPORTED : { ok: true, mimeType: undefined };
}
