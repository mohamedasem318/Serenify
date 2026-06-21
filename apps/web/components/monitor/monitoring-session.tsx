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
  endSession as defaultEndSession,
  patchStatus as defaultPatchStatus,
  submitWindow as defaultSubmitWindow,
  type CreateSessionResult,
  type EndReason,
  type SessionStatus,
  type SubmitWindowResult,
} from "@/lib/api/monitoring-client";
import { getSessionTrend, type SessionTrendPoint } from "@/lib/api/monitoring-reads";
import { createClient } from "@/lib/supabase/client";

import { CameraPill, type CameraPillStatus } from "./camera-pill";
import { OpSurfaces } from "./op-surfaces";
import {
  createPresenceMonitor as defaultCreatePresenceMonitor,
  type PresenceCallbacks,
  type PresenceMonitorHandle,
} from "./presence-monitor";
import { SessionTrend } from "./session-trend";
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
 * US2 (T038): the full presence + lifecycle — out-of-frame auto-pause (90 s no-face,
 * self-view kept on, auto-resume on return), manual Pause (camera released) / Resume
 * (camera re-acquired), auto-end (5 min absence) and manual End → dashboard. The two
 * absence timers live in the injectable `presence-monitor` controller, fed by the SAME
 * feature-005 framing signal that gates uploads (FR-003) — no second detector.
 *
 * Privacy + camera lifecycle (acquire-late / release-always, unchanged from US1): the
 * camera opens only after a confirmed session; it is released on manual Pause, on End/
 * auto-end, and on unmount. Out-of-frame is the deliberate exception — the camera STAYS on
 * (self-view + return detection) so the session can auto-resume (the mock's self-view-
 * during-pause). The client receives only the band — no number, no raw video persisted.
 */

export interface MonitoringSession {
  accessToken: string;
}

export interface MonitoringDeps {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  getSession: () => Promise<MonitoringSession | null>;
  createSession: (token: string) => Promise<CreateSessionResult>;
  submitWindow: (sessionId: string, clip: Blob, token: string) => Promise<SubmitWindowResult>;
  endSession: (sessionId: string, reason: EndReason, token: string) => Promise<{ ok: boolean }>;
  patchStatus: (sessionId: string, status: SessionStatus, token: string) => Promise<{ ok: boolean }>;
  createRecorder?: (stream: MediaStream) => MinimalWindowRecorder;
  createDetector?: (opts?: CreateDetectorOptions) => Promise<DetectorHandle | null>;
  /** Injectable so US2 tests drive the REAL out-of-frame wiring against a fake monitor. */
  createPresenceMonitor: (cb: PresenceCallbacks) => PresenceMonitorHandle;
  /** Leave the monitor (End / auto-end) → dashboard. Full nav by default (fresh recap). */
  navigate: (path: string) => void;
  isSecureContext: () => boolean;
  strideMs: number;
  /** US4 (T047) injectable loader for the this-session trend; undefined → the real RLS reader. */
  sessionTrendLoad?: (sessionId: string) => Promise<SessionTrendPoint[]>;
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
    endSession: defaultEndSession,
    patchStatus: defaultPatchStatus,
    createPresenceMonitor: defaultCreatePresenceMonitor,
    // A full document navigation back to the dashboard so the just-ended session's recap
    // is fetched fresh (mock-gap #6: End returns to the dashboard, no standalone screen).
    navigate: (path) => {
      if (typeof window !== "undefined") window.location.assign(path);
    },
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
  // US4 (T047): the live session id surfaced as STATE (alongside sessionIdRef) so the
  // monitor-page this-session trend re-renders once a session exists. Additive only —
  // the ref stays the source of truth for the side-effect paths.
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);

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
  // US2 presence + lifecycle: the absence-timer controller, the current op (read by the
  // monitor callbacks without re-creating them), the single-end guard (collapses the
  // auto-end / manual-End race), and a stable session-start for the elapsed clock.
  const presenceRef = useRef<PresenceMonitorHandle | null>(null);
  const opRef = useRef(op);
  const endingRef = useRef(false);
  const sessionStartRef = useRef<number | null>(null);
  useEffect(() => {
    opRef.current = op;
  }, [op]);

  // Track the latest framing signal: gate uploads on face presence (only when the
  // detector is actually running), accumulate telemetry to refine a skip cause, AND feed
  // the presence monitor so a continuous 90 s absence auto-pauses and a return auto-resumes
  // (US2). The SAME signal does all three — no second detection mechanism (FR-003/FR-007).
  const handleSignal = useCallback((signal: FramingSignal) => {
    facePresentRef.current = signal.facePresent;
    accumulate(telemetryRef.current, signal);
    const monitor = presenceRef.current;
    if (!monitor) return;
    if (signal.facePresent) monitor.faceSeen();
    else monitor.faceLost();
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
          if (!res.ok) {
            // Defensive mid-session no_anchor (US3 / T042): the user's anchor vanished after
            // the create-time guard. Route to the SAME calibrate-first surface the create
            // path uses (reuse NO_ANCHOR) — the standing release effect then stops the
            // recorder + releases the camera (op leaves the live set). Guard on a live op so
            // a late in-flight 409 can't reopen calibrate-first over a paused/ended session
            // (FR-016, mirrors the WINDOW_OUTCOME late-window discipline). Other error kinds
            // are dropped silently, exactly as before.
            if (
              res.kind === "no_anchor" &&
              (opRef.current === "warming-up" || opRef.current === "active")
            ) {
              dispatch({ type: "NO_ANCHOR" });
            }
            return;
          }
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

  // End the session (manual End or the 5-min auto-end) and leave to the dashboard. The
  // auto-end / manual-End RACE is resolved two ways: (1) `endingRef` so only the FIRST
  // caller runs the teardown + navigation, and (2) the client maps the backend's 409
  // "already ended" to ok — so even if both POSTs go out, the loser's 409 is treated as
  // success and never surfaces an error (the task's explicit re-end requirement).
  const endAndLeave = useCallback(
    async (reason: EndReason) => {
      if (endingRef.current) return;
      endingRef.current = true;
      // Release every external resource immediately (privacy + stop the absence clocks)
      // BEFORE the network round-trip — the camera light goes off at once. End releases
      // the camera (unlike out-of-frame, which keeps it on for the self-view).
      presenceRef.current?.stop();
      presenceRef.current = null;
      recorderRef.current?.stop();
      recorderRef.current = null;
      stopStream();
      setStreaming(false);
      dispatch({ type: "END" });

      const sessionId = sessionIdRef.current;
      const token = tokenRef.current;
      if (sessionId && token) {
        await deps.endSession(sessionId, reason, token); // 409 → ok (re-end race resolved silently)
      }
      deps.navigate("/app");
    },
    [deps, dispatch, stopStream],
  );

  // Open the camera, start the continuous recorder, and (re)arm the presence monitor.
  // Shared by first-grant and Resume; the CALLER dispatches the right state action
  // (CAMERA_GRANTED vs RESUME). Returns false on a getUserMedia rejection (already routed
  // to blocked). Does NOT create a session — that is the caller's responsibility.
  const openCameraAndRecord = useCallback(async (): Promise<boolean> => {
    // A getUserMedia rejection maps by err.name to honest copy (NotReadableError → busy,
    // NotFound/Overconstrained → no-device, NotAllowed/Security/else → blocked).
    let stream: MediaStream;
    try {
      stream = await deps.getUserMedia({ video: true, audio: false }); // mic off (audio is feature 013)
    } catch (err) {
      const kind = cameraErrorKind(err).replace("camera-", "") as CameraErrorKind;
      dispatch({ type: "CAMERA_ERROR", kind });
      return false;
    }

    streamRef.current = stream;
    setStream(stream); // drive the reactive bind-and-play effect
    telemetryRef.current = emptyTelemetry();
    facePresentRef.current = false;
    setStreaming(true); // mounts the <video> + detector; bind-and-play wires srcObject + play()
    setPinned(true); // show the self-view at once — the user sees themselves as capture starts

    const recorder = createWindowRecorder({
      stream,
      strideMs: deps.strideMs,
      onWindow: handleWindow,
      createRecorder: deps.createRecorder,
    });
    recorderRef.current = recorder;
    recorder.start();

    // (Re)arm the absence timers; handleSignal feeds faceSeen() / faceLost(). The callbacks
    // read opRef so they only act from the right state (auto-pause only from a live op,
    // auto-resume only from out-of-frame) and PATCH the lifecycle to match.
    presenceRef.current?.stop();
    presenceRef.current = deps.createPresenceMonitor({
      onOutOfFrame: () => {
        if (opRef.current !== "active" && opRef.current !== "warming-up") return;
        dispatch({ type: "GO_OUT_OF_FRAME" });
        const sid = sessionIdRef.current;
        const tok = tokenRef.current;
        if (sid && tok) void deps.patchStatus(sid, "out_of_frame", tok);
      },
      onReturn: () => {
        if (opRef.current !== "out-of-frame") return;
        dispatch({ type: "RETURN_TO_FRAME" });
        const sid = sessionIdRef.current;
        const tok = tokenRef.current;
        if (sid && tok) void deps.patchStatus(sid, "active", tok);
      },
      onAutoEnd: () => {
        void endAndLeave("auto_absence");
      },
    });
    return true;
  }, [deps, dispatch, endAndLeave, handleWindow]);

  const handleAllow = useCallback(async () => {
    // "Try again" / fresh start: fully release any prior recorder + stream + monitor BEFORE
    // re-requesting, so a lingering track can't make the next getUserMedia fail "busy"
    // (the stuck-blocked symptom). Mirrors the calibration recorder's acquire/release
    // discipline (anchor-recorder.tsx).
    presenceRef.current?.stop();
    presenceRef.current = null;
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
        setLiveSessionId(created.sessionId);
        sessionId = created.sessionId;
      } finally {
        // Cleared on every exit (success OR an error return) so a later retry can create
        // again; the in-flight window is only the span of the awaits above.
        creatingRef.current = false;
      }
    }

    // Only NOW open the camera — after a confirmed 201.
    const opened = await openCameraAndRecord();
    if (opened) dispatch({ type: "CAMERA_GRANTED" }); // → warming-up
  }, [deps, dispatch, openCameraAndRecord, stopStream]);

  const handleRetryBlocked = useCallback(() => {
    // Fully release, then re-request: handleAllow stops any prior tracks at its top and
    // re-acquires getUserMedia (reusing the already-created session).
    void handleAllow();
  }, [handleAllow]);

  // Manual Pause (FR-006): stop scoring + RELEASE the camera, then PATCH paused. Resume
  // re-acquires. The standing release effect also fires on op→paused; releasing here too
  // turns the camera light off immediately (no wait for the commit).
  const handlePause = useCallback(() => {
    presenceRef.current?.stop();
    presenceRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;
    stopStream();
    setStreaming(false);
    dispatch({ type: "PAUSE" });
    const sessionId = sessionIdRef.current;
    const token = tokenRef.current;
    if (sessionId && token) void deps.patchStatus(sessionId, "paused", token);
  }, [deps, dispatch, stopStream]);

  // Manual Resume: re-acquire the camera (re-entering the blocked surface if access was
  // revoked or the context is no longer secure), reusing the existing session → PATCH
  // active. A fresh recording warms up again (T036: no server-side buffer to restore).
  const handleResume = useCallback(async () => {
    if (!deps.isSecureContext()) {
      dispatch({ type: "CAMERA_BLOCKED" });
      return;
    }
    const sessionId = sessionIdRef.current;
    const token = tokenRef.current;
    if (!sessionId || !token) {
      dispatch({ type: "CAMERA_BLOCKED" });
      return;
    }
    const opened = await openCameraAndRecord();
    if (!opened) return; // getUserMedia rejection already routed to blocked
    dispatch({ type: "RESUME" }); // → warming-up
    void deps.patchStatus(sessionId, "active", token);
  }, [deps, dispatch, openCameraAndRecord]);

  const handleEnd = useCallback(() => {
    void endAndLeave("user");
  }, [endAndLeave]);

  // US4 (T047): a STABLE loader for the this-session trend. Reads the (stable) injected dep
  // at call time, so the render never touches the deps ref; defaults to the real RLS reader.
  const loadSessionTrend = useCallback(
    (id: string) => (depsRef.current.sessionTrendLoad ?? getSessionTrend)(id),
    [],
  );

  // Session elapsed clock. Starts once capture first begins and keeps a STABLE origin
  // across op changes (warming-up → active → out-of-frame → paused), so the timer never
  // resets mid-session. It stops only once the session is no longer live (ended / blocked).
  const sessionLive =
    op === "warming-up" || op === "active" || op === "out-of-frame" || op === "paused";
  useEffect(() => {
    if (!sessionLive) return;
    if (sessionStartRef.current === null) sessionStartRef.current = performance.now();
    const start = sessionStartRef.current;
    const id = setInterval(() => setElapsed(Math.floor((performance.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [sessionLive]);

  // Release the camera + recorder + monitor whenever we leave a capturing state. NOTE:
  // out-of-frame KEEPS the camera on (self-view + return detection for auto-resume), so it
  // is NOT released here — only paused / ended / blocked / calibrate-first / permission do.
  // Under acquire-late the camera only opens once live, so this is the standing guarantee
  // that a non-capturing op never holds the camera (releases external resources only).
  useEffect(() => {
    if (op === "warming-up" || op === "active" || op === "out-of-frame") return;
    presenceRef.current?.stop();
    presenceRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;
    stopStream();
  }, [op, stopStream]);

  // Release the camera + recorder + monitor on unmount / route navigation (privacy).
  useEffect(
    () => () => {
      presenceRef.current?.stop();
      recorderRef.current?.stop();
      stopStream();
    },
    [stopStream],
  );

  const recording = streaming && (op === "warming-up" || op === "active");
  const pillStatus: CameraPillStatus =
    op === "out-of-frame" ? "out-of-frame" : op === "paused" ? "paused" : recording ? "recording" : "off";
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="sr-only">Live stress check-in</h1>
      <div className="mb-3 flex items-center gap-3 px-1">
        <Link
          href="/app"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span aria-hidden>←</span> Dashboard
        </Link>
        {sessionLive && (
          <span className="ml-auto text-sm tabular-nums text-muted">
            Session · <b className="font-semibold text-ink">{mm}:{ss}</b>
          </span>
        )}
      </div>

      <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-soft sm:min-h-[480px] sm:p-10">
        <div className="group absolute right-4 top-4 z-10">
          <CameraPill status={pillStatus} pinned={pinned} onTogglePin={() => setPinned((p) => !p)} />
          {streaming && (
            <Viewfinder pinned={pinned} outOfFrame={op === "out-of-frame"}>
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

        <OpSurfaces
          state={state}
          onAllow={handleAllow}
          onRetryBlocked={handleRetryBlocked}
          onPause={handlePause}
          onResume={handleResume}
          onEnd={handleEnd}
        />
      </div>

      {/* US4 (T047): the this-session live trend below the stage. Shown once a session
          exists and is live; polls only while actively capturing (warming-up / active).
          Reads the SAME persisted rows the dashboard today trend does, so they agree. */}
      {liveSessionId && sessionLive && (
        <SessionTrend
          sessionId={liveSessionId}
          active={op === "warming-up" || op === "active"}
          load={loadSessionTrend}
        />
      )}
    </div>
  );
}
