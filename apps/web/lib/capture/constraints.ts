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

/**
 * Encoder bitrate target for the Apple WebKit path — **Apple only, deliberately.**
 *
 * WebKit *does* honor `videoBitsPerSecond` (measured 2026-08-07, iPhone / iOS 18.7 /
 * Safari 26.5.2, 1280×720@15, fMP4): effective rate tracks the target monotonically and
 * lands 79–92% of it, consistently under and never over. Left unset, the same device
 * measures **6.72 Mbit/s effective** — the default is a ceiling, not a rate, and the
 * encoder's own 10 Mbit/s self-report is not the delivered figure. (Nor is the reflected
 * property: it echoed the target exactly at all seven rungs while the real number was
 * 79–92%. Same class of self-report as the `isTypeSupported` WebM claim above.)
 *
 * 750 kbps is the lowest rate proven **natively on-device**, not via transcode. It yields
 * ~0.64 Mbit/s effective — ~0.80 MB per 10 s stride under the bounded upload, down from
 * ~8.4 MB, i.e. about a quarter of a 2–3 Mbit/s uplink instead of 2–3× over it — and it is
 * wire parity with the Chrome VP9 path, so iOS stops being the outlier. Quality is not the
 * binding constraint anywhere near here: re-encoding one clip down a ladder to 150 kbps
 * held 62/62 face detections, passed the coverage gate at every rung, and stayed at cosine
 * ≥ 0.997 against the original — compression effect 12–25× smaller than take-to-take
 * variation. Both natively-captured low-bitrate clips ran clean through the real
 * `packages/ml-video` pipeline (100% detection, gate PASS, finite (2958,) features).
 *
 * **Never set this globally.** It is a *target*, not a cap, and the Chrome VP9 path already
 * sits near 0.75 Mbit/s naturally — applying it everywhere risks raising that path's rate.
 *
 * No recalibration is forced. Existing anchors were captured at ~6.7 Mbit/s and new windows
 * arrive at ~0.64, but that delta measures at cosine 0.999 on identical content, far below
 * the take-to-take noise the model already absorbs.
 *
 * Caveat on record: **n=1** — one device, one person, one session.
 */
export const APPLE_VIDEO_BITS_PER_SECOND = 750_000;

/**
 * The `MediaRecorder` options for THIS engine — the single place the bitrate target is
 * applied, so calibration and monitoring cannot diverge on it any more than they can on
 * container (scoring is `window − anchor`).
 *
 * Returns `undefined` when there is nothing to set, so the caller can construct the
 * recorder with no options dictionary exactly as before — the non-Apple browser-default
 * path is unchanged.
 */
export function captureRecorderOptions(
  mimeType: string | undefined,
): MediaRecorderOptions | undefined {
  const options: MediaRecorderOptions = {};
  if (mimeType) options.mimeType = mimeType;
  if (isAppleWebKit()) options.videoBitsPerSecond = APPLE_VIDEO_BITS_PER_SECOND;
  return Object.keys(options).length > 0 ? options : undefined;
}
