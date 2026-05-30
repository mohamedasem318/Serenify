"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { checkHealth as defaultCheckHealth, postAnchor as defaultPostAnchor, type AnchorResult } from "@/lib/api/anchor-client";
import { broadcastAnchorCaptured as defaultBroadcast } from "@/lib/auth-broadcast";
import { Button } from "@/components/ui/button";
import type { CreateDetectorOptions, DetectorHandle } from "@/lib/face-detect/detector";
import { useFramingGuide } from "@/lib/face-detect/use-framing-guide";
import { createClient } from "@/lib/supabase/client";

import { CameraAccessState, type CameraAccessKind } from "./camera-access-state";
import { DevicePicker } from "./device-picker";
import { FailureState } from "./failure-state";
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

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MinimalRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef(RECORDING_SECONDS);
  const deviceIdRef = useRef<string | undefined>(undefined);
  const gatingRef = useRef(false);

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
        dispatch({ type: "UPLOAD_FAILED" });
        return;
      }
      const result = await deps.postAnchor(blob, session.accessToken);
      if (!result.ok) {
        if (result.kind === "extraction_failed") {
          dispatch({ type: "EXTRACT_FAILED", reason: result.reason });
        } else {
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
  // and only a healthy one advances to the countdown. A down backend shows the calm
  // gate copy and blocks — never a full minute recorded into a dead backend.
  const handleReady = useCallback(async () => {
    if (gatingRef.current) return;
    gatingRef.current = true;
    setHealthGate("checking");
    try {
      const ok = await deps.checkHealth();
      if (!ok) {
        setHealthGate("down");
        return;
      }
      setHealthGate("ok");
      dispatch({ type: "READY" }); // → get-ready (3·2·1)
    } finally {
      gatingRef.current = false;
    }
  }, [deps, dispatch]);

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
        <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-card bg-ink/5">
          <video
            ref={attachVideo}
            autoPlay
            muted
            playsInline
            className={`absolute inset-0 h-full w-full object-cover transition-[filter] duration-700 motion-reduce:transition-none ${
              softened ? "blur-[6px]" : "blur-0"
            }`}
          />

          {status === "green-room" && (
            <GreenRoom
              guide={guide}
              gate={gate}
              ready={ready && healthGate !== "checking"}
              devicePicker={<DevicePicker permissionGranted onChange={handleDeviceChange} />}
              onReady={handleReady}
              onNotNow={onSkip}
            />
          )}

          {status === "get-ready" && (
            <div className="absolute inset-0 grid place-items-center bg-ink/10 p-4">
              <GetReadyCountdown onComplete={beginRecording} onCancel={handleCancelGetReady} />
            </div>
          )}

          {(status === "recording" || status === "stop-confirming") && (
            <RecordingStage remaining={remaining} drift={drift} onStop={handleRequestStop} />
          )}

          {/* FR-056 health gate — calm, foggy, blocks the countdown, keeps the preview. */}
          {status === "green-room" && healthGate === "down" && (
            <div className="absolute inset-0 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm">
              <div className="w-full max-w-xs space-y-4 rounded-card border border-foggy/40 bg-surface p-5 text-center">
                <div className="space-y-1.5">
                  <h2 className="font-display text-xl text-ink">{COPY.unavailableHeading}</h2>
                  <p className="text-sm leading-relaxed text-muted">{COPY.unavailableBody}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={handleReady} className="h-11 w-full">
                    Try again
                  </Button>
                  <Button variant="ghost" onClick={onSkip} className="h-11 w-full text-muted">
                    Not now
                  </Button>
                </div>
              </div>
            </div>
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
        // The adaptive cause chip (low-light / out-of-frame) needs the recording
        // cause-telemetry from T021/DECISION-24; until that lands we show the
        // conservative our-side chip — we assert no user-side cause we haven't
        // measured. "Try again" re-enters via the green room (FR-029).
        <FailureState
          cause="our-side"
          escapeVisible={escapeVisible}
          onRetry={startCapture}
          onNotNow={onSkip}
          onPause={onSkip}
        />
      )}
    </section>
  );
}
