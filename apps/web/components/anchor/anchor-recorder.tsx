"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { checkHealth as defaultCheckHealth, postAnchor as defaultPostAnchor, type AnchorResult } from "@/lib/api/anchor-client";
import { broadcastAnchorCaptured as defaultBroadcast } from "@/lib/auth-broadcast";
import {
  accumulate,
  dominantCause,
  emptyTelemetry,
  type CauseTelemetry,
} from "@/lib/face-detect/cause-telemetry";
import type { CreateDetectorOptions, DetectorHandle } from "@/lib/face-detect/detector";
import type { FramingSignal } from "@/lib/face-detect/framing";
import { useFramingGuide } from "@/lib/face-detect/use-framing-guide";
import { createClient } from "@/lib/supabase/client";

import { BackendDownModal } from "./backend-down-modal";
import { BreathingOrb } from "./breathing-guide";
import { CameraAccessState, type CameraAccessKind } from "./camera-access-state";
import { DevicePicker } from "./device-picker";
import { FailureState, type FailureCause } from "./failure-state";
import { FramingOverlay } from "./framing-overlay";
import { GetReadyCountdown } from "./get-ready-countdown";
import { GreenRoom } from "./green-room";
import { Intro } from "./intro";
import { RecordingStage } from "./recording-stage";
import { StopConfirm } from "./stop-confirm";
import { SuccessState } from "./success-state";
import {
  cameraErrorKind,
  useAnchorRecorder,
  type CameraErrorStatus,
  type RecorderMode,
} from "./use-anchor-recorder";

const RECORDING_SECONDS = 60;

/**
 * Calm-voice copy (Principle V) for the two orchestrator-owned, between-surface
 * beats: the "setting your baseline" wait and the FR-056 health gate. FOGGY, never
 * amber/crimson (this is a 005 surface). The capture surfaces own their own copy.
 */
const COPY = {
  uploading: "Setting your baseline — one calm moment…",
  unavailableHeading: "Calibration’s having a quiet moment",
  unavailableBody:
    "We can’t set your baseline just now. Give it a moment and try again — nothing’s lost.",
} as const;

/** Codec probe order (📌 DECISION-13); the backend accepts mp4 + webm. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const type of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/mp4"]) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return undefined;
}

function base64ToHex(b64: string): string {
  const bin = atob(b64);
  let hex = "";
  for (let i = 0; i < bin.length; i += 1) {
    hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Best-effort permission probe (📌 ST-02 anti-flash). A hard block makes
 * getUserMedia reject synchronously; probing first lets us route straight to
 * `camera-blocked` without a re-call. Missing/throwing implementations collapse to
 * "unsupported" → behave like "prompt".
 */
async function probeCameraPermission(): Promise<"granted" | "denied" | "prompt" | "unsupported"> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unsupported";
  try {
    const status = await navigator.permissions.query({ name: "camera" as PermissionName });
    if (status && (status.state === "granted" || status.state === "denied" || status.state === "prompt")) {
      return status.state;
    }
    return "unsupported";
  } catch {
    return "unsupported";
  }
}

/**
 * The minimal MediaRecorder surface the orchestrator drives. Injectable (📌
 * DECISION-26) so honest tests run the REAL orchestration against a fake recorder —
 * jsdom/happy-dom ships no MediaRecorder. `pause`/`resume` are optional (used only
 * for the stop-confirm freeze; absent in tests).
 */
export interface MinimalRecorder {
  start(): void;
  stop(): void;
  pause?(): void;
  resume?(): void;
  state: string;
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
}

/** The single anchor write the client performs with the user's own session (DECISION-9). */
export interface AnchorSession {
  accessToken: string;
  userId: string;
}

/**
 * The unavoidable I/O boundary, injectable for honest tests (📌 DECISION-26 §4).
 * `postAnchor` (the FastAPI extraction) and `writeAnchor` (the Supabase row write)
 * are SEPARATE seams so a test can assert the write fires ONLY on success
 * (overwrite-on-success-only — FR-053 / DECISION-22). Production uses the real
 * implementations via `defaultDeps()`.
 */
export interface RecorderDeps {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createRecorder: (stream: MediaStream) => MinimalRecorder;
  postAnchor: (clip: Blob, accessToken: string) => Promise<AnchorResult>;
  checkHealth: () => Promise<boolean>;
  createDetector?: (opts?: CreateDetectorOptions) => Promise<DetectorHandle | null>;
  getSession: () => Promise<AnchorSession | null>;
  writeAnchor: (input: { userId: string; vectorB64: string; modelVersion: string }) => Promise<{ ok: boolean }>;
  broadcastAnchorCaptured: () => void;
  probeCameraPermission: () => Promise<"granted" | "denied" | "prompt" | "unsupported">;
}

function defaultDeps(): RecorderDeps {
  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createRecorder: (stream) => {
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      return recorder as unknown as MinimalRecorder;
    },
    postAnchor: defaultPostAnchor,
    checkHealth: defaultCheckHealth,
    // createDetector omitted → useFramingGuide uses the real self-hosted loader.
    getSession: async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return null;
      return { accessToken: session.access_token, userId: session.user.id };
    },
    writeAnchor: async ({ userId, vectorB64, modelVersion }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          anchor_vector: `\\x${base64ToHex(vectorB64)}`,
          anchor_captured_at: new Date().toISOString(),
          anchor_model_version: modelVersion,
        })
        .eq("id", userId);
      return { ok: !error };
    },
    broadcastAnchorCaptured: defaultBroadcast,
    probeCameraPermission,
  };
}

/**
 * Calibration capture orchestrator (feature 005 — T016/T017). Owns the persistent
 * `<video>` + MediaStream, drives the on-device framing guide, runs MediaRecorder
 * for the 60 s, and renders each reducer state to its built surface. The /healthz
 * gate sits immediately before the get-ready countdown (clarification #2 / FR-056):
 * the user reaches the calm green room freely, but never records a full minute into
 * a dead backend.
 *
 * The anchor is written ONLY on a successful extraction (FR-053): stop / processing
 * failure / "Not now" / "Maybe later" leave any existing baseline untouched. The
 * same flow serves onboarding, `/app/calibrate`, and the account recalibrate entry
 * (DECISION-28) — `mode` only nudges copy and (via the host) the exit destinations.
 */
export function AnchorRecorder({
  onComplete,
  onSkip,
  mode = "first-time",
  deps: depsOverride,
}: {
  onComplete: () => void;
  onSkip: () => void;
  /** Copy/telemetry + exit semantics; behaviour is otherwise identical per host. */
  context?: "onboarding" | "calibrate";
  mode?: RecorderMode;
  /** Honest-test seam: override any subset of the I/O boundary (📌 DECISION-26). */
  deps?: Partial<RecorderDeps>;
}) {
  const depsRef = useRef<RecorderDeps>({ ...defaultDeps(), ...depsOverride });
  const deps = depsRef.current;

  const { state, dispatch, escapeVisible } = useAnchorRecorder(mode);
  const { status } = state;

  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [remaining, setRemaining] = useState(RECORDING_SECONDS);
  const [healthGate, setHealthGate] = useState<"ok" | "checking" | "down">("ok");
  // A re-probe from the blocking modal: keep `healthGate` at "down" (so the modal
  // stays up, not flickering closed) and track the in-flight probe separately.
  const [rechecking, setRechecking] = useState(false);
  const [failureCause, setFailureCause] = useState<FailureCause>("our-side");

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MinimalRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef(RECORDING_SECONDS);
  const deviceIdRef = useRef<string | undefined>(undefined);
  const gatingRef = useRef(false);
  // Client-observed adverse signal during the 60 s, collapsed to the failure chip
  // cause on a processing failure (📌 DECISION-24). Stays empty when the detector
  // is unavailable → dominantCause() returns "our-side".
  const telemetryRef = useRef<CauseTelemetry>(emptyTelemetry());

  // Accumulate framing telemetry ONLY while actually recording (the guide also
  // signals in the green room). Nothing leaves the device — this counts frames.
  const handleSignal = useCallback((signal: FramingSignal) => {
    if (recorderRef.current?.state === "recording") accumulate(telemetryRef.current, signal);
  }, []);

  // The framing guide runs only while a live preview is on screen. The <video> is
  // PERSISTENT across green-room → get-ready → recording → stop-confirming (one
  // element, one tree slot) so the preview never remounts/flickers (FR-013); the
  // guide reads `phase` through a ref and does NOT tear down on a green-room →
  // recording transition.
  const inStage =
    status === "green-room" ||
    status === "get-ready" ||
    status === "recording" ||
    status === "stop-confirming";
  const guidePhase = status === "recording" || status === "stop-confirming" ? "recording" : "green-room";

  const { guide, gate, ready, drift } = useFramingGuide({
    video: inStage ? videoEl : null,
    phase: guidePhase,
    // Read straight from the prop (not the merged-deps ref) so this stays a plain
    // render-time value — undefined in production, where the hook uses the real
    // self-hosted loader; a fake in tests.
    createDetector: depsOverride?.createDetector,
    onSignal: handleSignal,
  });

  // Wire srcObject the moment React attaches the node (and re-wire on any remount),
  // and surface the element as state so the framing-guide effect re-runs when the
  // preview mounts/unmounts.
  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    if (node && streamRef.current) node.srcObject = streamRef.current;
    setVideoEl(node);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Release camera + timer on unmount (privacy + no leaked intervals). Detach the
  // recorder handlers BEFORE stopping tracks: stopping a live stream fires a final
  // `stop`, which would otherwise submit a clip for an abandoned recording.
  useEffect(
    () => () => {
      clearTimer();
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
      }
      stopStream();
    },
    [clearTimer, stopStream],
  );

  const submitClip = useCallback(
    async (blob: Blob) => {
      const session = await deps.getSession();
      if (!session) {
        setFailureCause("our-side");
        dispatch({ type: "UPLOAD_FAILED" });
        return;
      }
      const result = await deps.postAnchor(blob, session.accessToken);
      if (!result.ok) {
        if (result.kind === "extraction_failed") {
          // 422 — the chip reflects what we actually measured this minute
          // (low-light / out-of-frame), or "our-side" when nothing dominated.
          setFailureCause(dominantCause(telemetryRef.current));
          dispatch({ type: "EXTRACT_FAILED", reason: result.reason });
        } else {
          setFailureCause("our-side"); // transport / 401 — our side
          dispatch({ type: "UPLOAD_FAILED" });
        }
        return;
      }
      // The write is the ONLY thing that touches the baseline, and it runs only here
      // — on a successful extraction (FR-053 overwrite-on-success-only).
      const write = await deps.writeAnchor({
        userId: session.userId,
        vectorB64: result.vectorB64,
        modelVersion: result.modelVersion,
      });
      if (!write.ok) {
        setFailureCause("our-side"); // the write is our side
        dispatch({ type: "UPLOAD_FAILED" });
        return;
      }
      dispatch({ type: "UPLOAD_SUCCESS" });
      deps.broadcastAnchorCaptured(); // refresh sibling tabs (FR-054)
    },
    [deps, dispatch],
  );

  const stopRecording = useCallback(() => {
    clearTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop(); // discardRef false → onstop submits
  }, [clearTimer]);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => {
      remainingRef.current -= 1;
      setRemaining(remainingRef.current);
      if (remainingRef.current <= 0) stopRecording();
    }, 1000);
  }, [clearTimer, stopRecording]);

  const beginRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    if (recorderRef.current && recorderRef.current.state === "recording") return; // guard double-begin

    const recorder = deps.createRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];
    discardRef.current = false;
    telemetryRef.current = emptyTelemetry(); // fresh cause telemetry for this minute

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || "video/webm";
      const chunks = chunksRef.current;
      chunksRef.current = [];
      if (discardRef.current) return; // abandoned via stop-confirm — keep the stream, submit nothing
      stopStream(); // we have the clip — release the camera immediately
      dispatch({ type: "RECORDING_COMPLETE" });
      void submitClip(new Blob(chunks, { type }));
    };

    recorder.start();
    dispatch({ type: "START_RECORDING" });
    remainingRef.current = RECORDING_SECONDS;
    setRemaining(RECORDING_SECONDS);
    startTimer();
  }, [deps, dispatch, stopStream, submitClip, startTimer]);

  // --- Turn on camera (and "Try again" everywhere): acquire the stream, settle in
  // the green room. Never auto-records — the user starts the minute from the green
  // room. A camera error routes to one of the three calm states (not a strike).
  const startCapture = useCallback(async () => {
    setHealthGate("ok");
    dispatch({ type: "TURN_ON_CAMERA" });

    if ((await deps.probeCameraPermission()) === "denied") {
      dispatch({ type: "CAMERA_ERROR", kind: "camera-blocked" });
      return;
    }
    try {
      const stream = await deps.getUserMedia({
        video: deviceIdRef.current ? { deviceId: { exact: deviceIdRef.current } } : true,
        audio: false, // mic stays off — audio is feature 013
      });
      streamRef.current = stream;
      dispatch({ type: "PERMISSION_GRANTED" }); // → green-room; attachVideo wires srcObject on mount
    } catch (error) {
      // Re-probe so a hard block (browser downgrades prompt → denied on "Block")
      // surfaces as camera-blocked rather than the raw error name.
      const after = await deps.probeCameraPermission();
      const kind: CameraErrorStatus = after === "denied" ? "camera-blocked" : cameraErrorKind(error);
      dispatch({ type: "CAMERA_ERROR", kind });
    }
  }, [deps, dispatch]);

  // --- The /healthz gate (T016 / FR-056): pressing "I'm ready" checks the backend
  // and only a healthy one advances to the countdown. A down backend raises the
  // blocking modal and never starts the countdown — never a full minute recorded
  // into a dead backend. `fromModal` re-probes without closing the modal.
  const runHealthCheck = useCallback(
    async (fromModal: boolean) => {
      if (gatingRef.current) return;
      gatingRef.current = true;
      if (fromModal) setRechecking(true);
      else setHealthGate("checking");
      try {
        const ok = await deps.checkHealth();
        if (!ok) {
          setHealthGate("down"); // raise / hold the blocking modal
          return;
        }
        setHealthGate("ok");
        dispatch({ type: "READY" }); // → get-ready (3·2·1)
      } finally {
        gatingRef.current = false;
        setRechecking(false);
      }
    },
    [deps, dispatch],
  );

  const handleReady = useCallback(() => {
    void runHealthCheck(false);
  }, [runHealthCheck]);

  const handleModalRetry = useCallback(() => {
    void runHealthCheck(true);
  }, [runHealthCheck]);

  const handleCancelGetReady = useCallback(() => {
    dispatch({ type: "CANCEL_GET_READY" });
  }, [dispatch]);

  const handleRequestStop = useCallback(() => {
    clearTimer(); // freeze the countdown
    recorderRef.current?.pause?.();
    dispatch({ type: "REQUEST_STOP" });
  }, [clearTimer, dispatch]);

  const handleKeepGoing = useCallback(() => {
    recorderRef.current?.resume?.();
    dispatch({ type: "KEEP_GOING" });
    startTimer(); // resume from the frozen `remaining`
  }, [dispatch, startTimer]);

  const handleConfirmStop = useCallback(() => {
    // "Start over": discard the in-flight clip (onstop sees the flag and submits
    // nothing), keep the camera live, and return to the green room for a fresh
    // minute — nothing saved, nothing lost (FR-021–024).
    discardRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorderRef.current = null;
    clearTimer();
    remainingRef.current = RECORDING_SECONDS;
    setRemaining(RECORDING_SECONDS);
    dispatch({ type: "CONFIRM_STOP" });
  }, [clearTimer, dispatch]);

  // Stable identity so DevicePicker's enumerate effect does not re-run each render.
  // (Live camera-swap in the green room + the FR-045 default-persistence fix are
  // T029; here the chosen device applies to the next acquisition.)
  const handleDeviceChange = useCallback((id: string | undefined) => {
    deviceIdRef.current = id;
  }, []);

  // Sharp only in the green room; eases to a deliberate softened (never fully
  // sharp, never fully blurred) for get-ready + recording (FR-013).
  const softened = inStage && status !== "green-room";

  // The green-room affirmative: ONE signal drives both the on-preview halo (meadow
  // brackets + glow + check) and the enabled "I'm ready", so they always coexist
  // (FR-008 — the enabled state can't clobber the halo). It stays off on the
  // detector-unavailable bypass (we don't confirm a frame we can't see) and while
  // the backend is down — both intentional, not a hidden halo.
  const affirmed = guide === "active" && ready && healthGate !== "down";

  return (
    <section className="space-y-6">
      {status === "intro" && <Intro mode={mode} onTurnOnCamera={startCapture} />}

      {(status === "camera-blocked" || status === "camera-busy" || status === "camera-no-device") && (
        <CameraAccessState
          kind={status.replace("camera-", "") as CameraAccessKind}
          onRetry={startCapture}
          onNotNow={onSkip}
        />
      )}

      {inStage && (
        <div className="mx-auto w-full max-w-lg">
          {/* PREVIEW — ONE element, ONE shape (natural 16:9) across green room →
              get-ready → recording (it never changes shape or size between stages).
              The portrait framing is the corner brackets + the dimming OUTSIDE them,
              never a crop or a nested video. GRAPHICS ONLY sit on the video — the
              brackets, the countdown numeral, the breathing orb, the "you're set"
              check/glow; every WORD lives in the card below. Sharp in the green
              room, eased to softened for get-ready + recording (FR-013). */}
          <div className="relative aspect-video w-full overflow-hidden rounded-card bg-ink/5">
            <video
              ref={attachVideo}
              autoPlay
              muted
              playsInline
              className={`absolute inset-0 h-full w-full object-cover transition-[filter] duration-700 motion-reduce:transition-none ${
                // a gentle softening to ease self-consciousness about appearance —
                // NOT contrast work (the orb sits on its own seating now), so kept
                // light: just enough, no more.
                softened ? "blur-[3px]" : "blur-0"
              }`}
            />

            {/* green room — fixed target + spotlight; brackets turn meadow + the
                check/glow appears the moment the gate clears (coexists with the
                enabled "I'm ready" — both driven by `affirmed`). */}
            {status === "green-room" && (
              <FramingOverlay drift="centred" showNudge={false} gateReady={affirmed} />
            )}

            {/* get-ready — the same fixed target + the numbers-only countdown as a
                focal graphic over the blurred preview. No words on the video. */}
            {status === "get-ready" && (
              <>
                <FramingOverlay drift="centred" showNudge={false} />
                <div className="absolute inset-0 grid place-items-center bg-ink/10">
                  <GetReadyCountdown onComplete={beginRecording} />
                </div>
              </>
            )}

            {/* recording — the persistent brackets (with the grace-gated drift
                bracket treatment) + the breathing orb as the focal graphic. The
                words (timer, pacer, nudge text, reassurance, Stop) are in the card
                below, never over the video. */}
            {(status === "recording" || status === "stop-confirming") && (
              <>
                <FramingOverlay drift={drift} />
                <div className="absolute inset-0 grid place-items-center">
                  <BreathingOrb />
                </div>
              </>
            )}
          </div>

          {/* CONTROLS / WORDS — a calm region BELOW the preview for every stage,
              never absolutely positioned over it (so it can't clip the brackets). */}
          <div className="mt-4">
            {status === "green-room" && (
              <GreenRoom
                guide={guide}
                gate={gate}
                // disabled while down (modal blocks) or mid-check; enabled only when
                // the soft gate has cleared AND the backend is reachable.
                ready={healthGate === "down" ? false : ready && healthGate !== "checking"}
                serviceUnavailable={healthGate === "down"}
                devicePicker={<DevicePicker permissionGranted onChange={handleDeviceChange} />}
                onReady={handleReady}
                onNotNow={onSkip}
              />
            )}

            {status === "get-ready" && (
              // the single calm line + the quiet Cancel — below the preview, off the
              // video. Cancel returns to the green room (CANCEL_GET_READY).
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-sm text-muted">Beginning now — settle in.</p>
                <button
                  type="button"
                  onClick={handleCancelGetReady}
                  className="inline-flex min-h-11 items-center rounded-control px-4 text-sm text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow"
                >
                  Cancel
                </button>
              </div>
            )}

            {(status === "recording" || status === "stop-confirming") && (
              <RecordingStage remaining={remaining} drift={drift} onStop={handleRequestStop} />
            )}
          </div>

          {/* FR-056 health gate — a TRUE blocking modal (backdrop, focus-trapped,
              controls beneath inert, no dismiss path) holding the user in the green
              room. "Try again" re-probes; "Not now" exits per mode. */}
          {status === "green-room" && (
            <BackendDownModal
              open={healthGate === "down"}
              heading={COPY.unavailableHeading}
              body={COPY.unavailableBody}
              checking={rechecking}
              onRetry={handleModalRetry}
              onNotNow={onSkip}
            />
          )}
        </div>
      )}

      {status === "stop-confirming" && (
        <StopConfirm onKeepGoing={handleKeepGoing} onConfirmStop={handleConfirmStop} />
      )}

      {status === "uploading" && (
        <p className="py-10 text-center text-base text-muted" aria-live="polite" role="status">
          {COPY.uploading}
        </p>
      )}

      {status === "success" && <SuccessState mode={mode} onDone={onComplete} />}

      {(status === "upload-failed" || status === "extract-failed") && (
        // The adaptive cause chip reflects the recording cause-telemetry
        // (T021/DECISION-24): low-light / out-of-frame when measured, else our-side
        // (incl. transport + detector-unavailable). "Try again" re-enters via the
        // green room (FR-029).
        <FailureState
          cause={failureCause}
          escapeVisible={escapeVisible}
          onRetry={startCapture}
          onNotNow={onSkip}
          onPause={onSkip}
        />
      )}
    </section>
  );
}
