/**
 * Shared capture settings for BOTH recorders — calibration (`anchor-recorder`) and
 * monitoring (`window-recorder`/`monitoring-session`).
 *
 * Scoring is `window − anchor` (the anchor comes from the user's own calibration
 * clip), so resolution and frame rate MUST stay identical across the two paths — a
 * cap applied to one alone is a silent scoring error, not a bug that surfaces. That
 * is why this module is the single source for both. Full evidence and rationale:
 * docs/triage/mobile-capture-diagnosis.md (Phase 2).
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
