"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";

import type { FailureCause } from "@/components/anchor/cause-chip";
import { cameraErrorKind } from "@/components/anchor/use-anchor-recorder";
import {
  accumulate,
  dominantCause,
  emptyTelemetry,
  type CauseTelemetry,
} from "@/lib/face-detect/cause-telemetry";
import type { CreateDetectorOptions, DetectorHandle } from "@/lib/face-detect/detector";
import type { FramingSignal } from "@/lib/face-detect/framing";
import { useFramingGuide } from "@/lib/face-detect/use-framing-guide";
import {
  createSession as defaultCreateSession,
  submitWindow as defaultSubmitWindow,
  type CreateSessionResult,
  type SubmitWindowResult,
} from "@/lib/api/monitoring-client";
import { createClient } from "@/lib/supabase/client";

import { CameraPill } from "./camera-pill";
import { OpSurfaces } from "./op-surfaces";
import { type CameraErrorKind, useMonitoringSession } from "./use-monitoring-session";
import { Viewfinder } from "./viewfinder";
import {
  createWindowRecorder,
  DEFAULT_STRIDE_MS,
  isSecureContextOk,
  type MinimalWindowRecorder,
  type WindowRecorderHandle,
} from "./window-recorder";

/**
 * Monitoring session orchestrator (feature 008, US1 — T032). Owns the side effects and
 * wires the parts: the continuous recorder (T026), the feature-005 face-detector gate
 * (no face → no upload, FR-003), the state machine (T027), the op-surfaces (T030), the
 * bloom (T028, inside op-surfaces), and the camera pill + viewfinder (T031). Mirrors the
 * calibration recorder's injectable I/O seam (DECISION-26) so honest tests run the REAL
 * orchestration against fakes (happy-dom ships no camera / MediaRecorder).
 *
 * Privacy: the camera is released on unmount; the client receives only the band — no
 * number, no raw video persisted client-side. US1 has no Pause/End controls (US2/T036);
 * the exit is the back-to-dashboard link.
 */

export interface MonitoringSession {
  accessToken: string;
}

export interface MonitoringDeps {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  getSession: () => Promise<MonitoringSession | null>;
  createSession: (token: string) => Promise<CreateSessionResult>;
  submitWindow: (sessionId: string, clip: Blob, token: string) => Promise<SubmitWindowResult>;
  createRecorder?: (stream: MediaStream) => MinimalWindowRecorder;
  createDetector?: (opts?: CreateDetectorOptions) => Promise<DetectorHandle | null>;
  isSecureContext: () => boolean;
  strideMs: number;
}

function defaultDeps(): MonitoringDeps {
  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    getSession: async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.access_token ? { accessToken: session.access_token } : null;
    },
    createSession: defaultCreateSession,
    submitWindow: defaultSubmitWindow,
    // createRecorder + createDetector omitted → the real MediaRecorder / self-hosted loader.
    isSecureContext: isSecureContextOk,
    strideMs: DEFAULT_STRIDE_MS,
  };
}

export function MonitoringSession({ deps: depsOverride }: { deps?: Partial<MonitoringDeps> }) {
  const depsRef = useRef<MonitoringDeps>({ ...defaultDeps(), ...depsOverride });
  const deps = depsRef.current;

  const { state, dispatch } = useMonitoringSession();
  const { op } = state;

  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  // The live stream is surfaced as STATE (not only the ref) so the srcObject binding is
  // reactive — it re-binds whenever the element or the stream changes, instead of only at
  // mount-time via the callback ref (the "pill stuck until alt-tab" bug). The ref is kept
  // for synchronous reads (stop/recorder), the state drives the bind-and-play effect.
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<WindowRecorderHandle | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  // Synchronous in-flight guard for session-create: set BEFORE the first await so two
  // concurrent acquire attempts (double-click / a re-trigger) can't each pass the
  // sessionIdRef reuse check and spawn a second session (the "two POST /sessions" bug).
  const creatingRef = useRef(false);
  const facePresentRef = useRef(false);
  const guideRef = useRef<"loading" | "active" | "unavailable">("loading");
  const telemetryRef = useRef<CauseTelemetry>(emptyTelemetry());

  // Track the latest framing signal: gate uploads on face presence (only when the
  // detector is actually running) and accumulate telemetry to refine a skip cause.
  const handleSignal = useCallback((signal: FramingSignal) => {
    facePresentRef.current = signal.facePresent;
    accumulate(telemetryRef.current, signal);
  }, []);

  const { guide } = useFramingGuide({
    video: streaming ? videoEl : null,
    phase: "recording",
    createDetector: depsOverride?.createDetector,
    onSignal: handleSignal,
  });
  useEffect(() => {
    guideRef.current = guide;
  }, [guide]);

  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoElRef.current = node;
    // Surface the element as state so the bind-and-play effect below re-runs on mount; the
    // effect (not this callback) owns srcObject so a stream that arrives AFTER the element
    // is also bound (the alt-tab/focus dependency is removed).
    setVideoEl(node);
  }, []);

  // Bind srcObject + start playback REACTIVELY: keyed on both the element and the stream,
  // so the self-view lights up the instant the stream is ready — no focus/visibility event
  // needed — and re-binds if either changes. autoPlay alone proved unreliable when
  // srcObject is assigned during the same commit, so play() is called explicitly.
  useEffect(() => {
    if (!videoEl || !stream) return;
    if (videoEl.srcObject !== stream) videoEl.srcObject = stream;
    const played = videoEl.play?.();
    if (played && typeof played.catch === "function") played.catch(() => {});
  }, [videoEl, stream]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  // One reading out per (gated) stride. Fire-and-forget: never block the recorder; a
  // transient transport error just skips this reading and the loop continues (FR-016).
  const handleWindow = useCallback(
    (clip: Blob) => {
      // FR-003: a no-face window is never uploaded — but only gate when the detector is
      // actually running (unavailable/loading → let the server's coverage gate decide).
      if (guideRef.current === "active" && !facePresentRef.current) return;
      const token = tokenRef.current;
      const sessionId = sessionIdRef.current;
      if (!token || !sessionId) return;
      void deps
        .submitWindow(sessionId, clip, token)
        .then((res) => {
          if (!res.ok) return;
          const outcome = res.outcome;
          if (outcome.outcome === "skipped") {
            // The client refines the coarse server cause from on-device telemetry, exactly
            // as calibration does (low-light vs out-of-frame); "our-side" owns our failures.
            const cause: FailureCause =
              outcome.cause === "insufficient-face"
                ? dominantCause(telemetryRef.current)
                : "our-side";
            dispatch({ type: "WINDOW_SKIPPED", cause });
          } else {
            dispatch({ type: "WINDOW_OUTCOME", outcome });
          }
        })
        .catch(() => {});
    },
    [deps, dispatch],
  );

  const handleAllow = useCallback(async () => {
    // "Try again" / fresh start: fully release any prior recorder + stream BEFORE
    // re-requesting, so a lingering track can't make the next getUserMedia fail "busy"
    // (the stuck-blocked symptom). Mirrors the calibration recorder's acquire/release
    // discipline (anchor-recorder.tsx).
    recorderRef.current?.stop();
    recorderRef.current = null;
    stopStream();

    if (!deps.isSecureContext()) {
      dispatch({ type: "CAMERA_BLOCKED" }); // webcam needs HTTPS / localhost
      return;
    }

    // Confirm a SESSION before opening the camera (acquire-late): the calibrate-first
    // guard runs UP FRONT, so an uncalibrated employee (409 no_anchor) is routed out
    // WITHOUT ever triggering a camera prompt — never a fabricated/global anchor (SC-004).
    // Reuse an already-created session on retry so a blocked-camera retry doesn't spawn
    // orphan sessions.
    let sessionId = sessionIdRef.current;
    if (!sessionId) {
      // Single-create guard: a create is already in flight (a near-simultaneous second
      // acquire) → bail without starting a second session or opening a second camera. The
      // first call owns this entry; exactly one session is created per monitoring entry.
      if (creatingRef.current) return;
      creatingRef.current = true;
      try {
        const session = await deps.getSession();
        if (!session) {
          dispatch({ type: "CAMERA_BLOCKED" });
          return;
        }
        tokenRef.current = session.accessToken;
        const created = await deps.createSession(session.accessToken);
        if (!created.ok) {
          dispatch(created.kind === "no_anchor" ? { type: "NO_ANCHOR" } : { type: "CAMERA_BLOCKED" });
          return;
        }
        sessionIdRef.current = created.sessionId;
        sessionId = created.sessionId;
      } finally {
        // Cleared on every exit (success OR an error return) so a later retry can create
        // again; the in-flight window is only the span of the awaits above.
        creatingRef.current = false;
      }
    }

    // Only NOW open the camera — after a confirmed 201. A getUserMedia rejection maps by
    // err.name to honest copy (NotReadableError → busy, NotFound/Overconstrained →
    // no-device, NotAllowed/Security/else → blocked) — no generic catch-all.
    let stream: MediaStream;
    try {
      stream = await deps.getUserMedia({ video: true, audio: false }); // mic off (audio is feature 013)
    } catch (err) {
      const kind = cameraErrorKind(err).replace("camera-", "") as CameraErrorKind;
      dispatch({ type: "CAMERA_ERROR", kind });
      return;
    }

    streamRef.current = stream;
    setStream(stream); // drive the reactive bind-and-play effect
    telemetryRef.current = emptyTelemetry();
    setStreaming(true); // mounts the <video>; the bind-and-play effect wires srcObject + play()
    setPinned(true); // show the self-view at once — the user sees themselves as capture starts
    dispatch({ type: "CAMERA_GRANTED" }); // → warming-up

    const recorder = createWindowRecorder({
      stream,
      strideMs: deps.strideMs,
      onWindow: handleWindow,
      createRecorder: deps.createRecorder,
    });
    recorderRef.current = recorder;
    recorder.start();
  }, [deps, dispatch, handleWindow, stopStream]);

  const handleRetryBlocked = useCallback(() => {
    // Fully release, then re-request: handleAllow stops any prior tracks at its top and
    // re-acquires getUserMedia (reusing the already-created session).
    void handleAllow();
  }, [handleAllow]);

  // Session timer (chrome) — ticks once recording begins.
  useEffect(() => {
    if (op !== "warming-up" && op !== "active") return;
    const startedAt = performance.now();
    const id = setInterval(() => setElapsed(Math.floor((performance.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [op]);

  // Release the camera + recorder whenever we leave a live capture state (→ blocked /
  // calibrate-first / permission): stop every track and null the stream ref, so no camera
  // light is left on after a calibrate round-trip. (Under acquire-late the camera only
  // ever opens once op is live, so this is the standing guarantee that a non-live op never
  // holds the camera — it does not setState, only releases external resources.)
  useEffect(() => {
    if (op === "warming-up" || op === "active") return;
    recorderRef.current?.stop();
    recorderRef.current = null;
    stopStream();
  }, [op, stopStream]);

  // Release the camera + recorder on unmount / route navigation (privacy; no leaked stream).
  useEffect(
    () => () => {
      recorderRef.current?.stop();
      stopStream();
    },
    [stopStream],
  );

  const recording = streaming && (op === "warming-up" || op === "active");
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="sr-only">Live stress check-in</h1>
      <div className="mb-3 flex items-center gap-3 px-1">
        <Link
          href="/app"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          <span aria-hidden>←</span> Dashboard
        </Link>
        {recording && (
          <span className="ml-auto text-sm tabular-nums text-muted">
            Session · <b className="font-semibold text-ink">{mm}:{ss}</b>
          </span>
        )}
      </div>

      <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-soft sm:min-h-[480px] sm:p-10">
        <div className="group absolute right-4 top-4 z-10">
          <CameraPill recording={recording} pinned={pinned} onTogglePin={() => setPinned((p) => !p)} />
          {streaming && (
            <Viewfinder pinned={pinned}>
              <video
                ref={attachVideo}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
            </Viewfinder>
          )}
        </div>

        <OpSurfaces state={state} onAllow={handleAllow} onRetryBlocked={handleRetryBlocked} />
      </div>
    </div>
  );
}
