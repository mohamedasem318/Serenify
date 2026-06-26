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

/**
 * Whether a focus event is a KEYBOARD focus (so the self-view peeks for keyboard users) vs a
 * mouse-click focus — which must NOT keep the preview pinned open once the pointer leaves (the
 * old `group-focus-within` did exactly that, so an un-pinned preview wouldn't auto-hide on
 * hover-out). Guarded for non-browser test envs that don't implement `:focus-visible`.
 */
function isKeyboardFocus(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || typeof target.matches !== "function") return false;
  try {
    return target.matches(":focus-visible");
  } catch {
    return false;
  }
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
  // Self-view peek (008-followups): the preview reveals on pointer-hover OR keyboard focus of
  // the pill and AUTO-HIDES when the pointer leaves / focus blurs — so an un-pinned preview
  // no longer sticks open after a mouse click (which leaves the pill focused).
  const [selfViewHover, setSelfViewHover] = useState(false);
  const [selfViewKbFocus, setSelfViewKbFocus] = useState(false);
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
  // Back-pressure for the window upload loop (008 BACKLOG #78 note (b)): never two uploads in
  // flight at once. `uploadInFlightRef` is the synchronous guard; `pendingClipRef` holds the
  // single most-recent window captured WHILE one is in flight (coalesced — older queued
  // windows are overwritten), drained when the in-flight upload completes.
  const uploadInFlightRef = useRef(false);
  const pendingClipRef = useRef<Blob | null>(null);
  const facePresentRef = useRef(false);
  const guideRef = useRef<"loading" | "active" | "unavailable">("loading");
  const telemetryRef = useRef<CauseTelemetry>(emptyTelemetry());
  // US2 presence + lifecycle: the absence-timer controller, the current op (read by the
  // monitor callbacks without re-creating them), the single-end guard (collapses the
  // auto-end / manual-End race), and a stable session-start for the elapsed clock.
  const presenceRef = useRef<PresenceMonitorHandle | null>(null);
  const opRef = useRef(op);
  const endingRef = useRef(false);
  // Elapsed clock accounting: `elapsedAccumRef` banks counted (non-paused) ms across pause
  // breaks; `runStartRef` marks the current counting run's origin (null while not counting).
  const elapsedAccumRef = useRef(0);
  const runStartRef = useRef<number | null>(null);
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
    // eslint-disable-next-line react-hooks/immutability -- a live MediaStream is attached to a <video> by imperatively assigning .srcObject; React has no declarative API for a camera feed, so this is load-bearing for the self-view (guarded by the !== check so it only writes when the stream actually changes).
    if (videoEl.srcObject !== stream) videoEl.srcObject = stream;
    const played = videoEl.play?.();
    if (played && typeof played.catch === "function") played.catch(() => {});
  }, [videoEl, stream]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  // L2 (008-followups): a CURRENT token for a lifecycle call (pause / resume / end), mirroring
  // the per-upload refresh in handleWindow. The cached `tokenRef` is only kept fresh by uploads,
  // so a session paused longer than the token lifetime (~1 h, no uploads → no refresh) would
  // otherwise carry a STALE token on resume/end — patchStatus/endSession swallow the {ok:false}
  // and the status silently fails to persist (the 008 bug class, narrower trigger). The SDK
  // auto-refreshes near expiry, so this returns a valid token; it stays the USER's own token
  // (RLS-as-the-user; no service credential) — just current. Also keeps tokenRef warm.
  const freshToken = useCallback(async (): Promise<string | null> => {
    const session = await deps.getSession();
    const token = session?.accessToken ?? null;
    if (token) tokenRef.current = token;
    return token;
  }, [deps]);

  // Upload ONE window and fold its outcome into the state machine. Reads `sessionIdRef` live
  // (so the drain loop below stays correct across strides). A transient transport error just
  // skips this reading and the loop continues (FR-016); auth loss / a vanished anchor surface
  // honestly.
  const uploadWindow = useCallback(
    async (clip: Blob) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      // Only act on an auth failure while a session is live — mirrors the WINDOW_OUTCOME
      // late-window discipline so a window that lands after pause/end can't reopen a surface
      // over a paused/ended session.
      const liveNow = () => opRef.current === "warming-up" || opRef.current === "active";
      // Approach A — a FRESH token per upload from the Supabase browser client. The SDK
      // auto-refreshes a near/expired token, so every window carries a valid token instead
      // of the once-captured one that went stale after ~1 h (the silent-401 smoke break).
      // Still the USER's own token (RLS-as-the-user; no service credential) — just current.
      const session = await deps.getSession();
      const token = session?.accessToken ?? null;
      if (!token) {
        // The browser session couldn't be refreshed (signed out / refresh failed). Don't
        // upload a stale token and don't skip silently — surface the honest re-auth state.
        if (liveNow()) dispatch({ type: "SESSION_EXPIRED" });
        return;
      }
      tokenRef.current = token; // keep the cached token current for the lifecycle calls too
      const res = await deps.submitWindow(sessionId, clip, token);
      if (!res.ok) {
        // A 401 even with a freshly-minted token is a genuine auth loss — NEVER silent (the
        // frozen-band break): stop on the honest re-auth surface (the standing release
        // effect then frees the camera as the op leaves the live set).
        if (res.kind === "unauthorized") {
          if (liveNow()) dispatch({ type: "SESSION_EXPIRED" });
          return;
        }
        // Defensive mid-session no_anchor (US3 / T042): the user's anchor vanished after the
        // create-time guard → route to the SAME calibrate-first surface the create path uses
        // (reuse NO_ANCHOR). Guarded on a live op (FR-016). Other error kinds drop silently.
        if (res.kind === "no_anchor" && liveNow()) {
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
        // reading / warming_up / superseded — the reducer folds each (superseded is a no-op).
        dispatch({ type: "WINDOW_OUTCOME", outcome });
      }
    },
    [deps, dispatch],
  );

  // Back-pressure drain (008 BACKLOG #78 note (b)): upload the given window, then any window
  // that arrived WHILE it was in flight — coalesced to the LATEST only — one at a time, so
  // there is never more than one upload in flight. Each window is the contiguous
  // recording-so-far (a superset of the previous), so sending only the newest never loses
  // signal — it just stops wasting ~6x the upload bytes re-sending stale, soon-superseded
  // windows (matters on a cloud deploy). This is the bandwidth half; the server scoring
  // gate's drop-stale is the matching backstop for misbehaviour / a second tab.
  const pumpUploads = useCallback(
    async (first: Blob) => {
      uploadInFlightRef.current = true;
      try {
        let clip: Blob | null = first;
        while (clip) {
          pendingClipRef.current = null;
          await uploadWindow(clip);
          // The most-recent window captured during the upload (older queued ones were
          // overwritten by handleWindow). Cleared on teardown so a paused/ended session never
          // drains a stale window.
          clip = pendingClipRef.current;
        }
      } finally {
        uploadInFlightRef.current = false;
      }
    },
    [uploadWindow],
  );

  // One reading out per (gated) stride. Fire-and-forget: never block the recorder. With the
  // back-pressure above, a stride that fires while an upload is still in flight does NOT start
  // a second upload — it replaces the pending window with this newer one (coalesce), so the
  // next drain always sends the freshest, never a stale queued backlog.
  const handleWindow = useCallback(
    (clip: Blob) => {
      // FR-003: a no-face window is never uploaded — but only gate when the detector is
      // actually running (unavailable/loading → let the server's coverage gate decide).
      if (guideRef.current === "active" && !facePresentRef.current) return;
      if (!sessionIdRef.current) return;
      if (uploadInFlightRef.current) {
        pendingClipRef.current = clip; // coalesce: keep only the latest while one is in flight
        return;
      }
      void pumpUploads(clip).catch(() => {});
    },
    [pumpUploads],
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
      if (sessionId) {
        // L2: end with a FRESH token — a long-paused session's cached token may be stale.
        const token = await freshToken();
        // End routes STRAIGHT to the dashboard recap (008-followups): fire the end POST
        // (keepalive in the client, so it still lands as the page unloads) and navigate at
        // once, instead of blocking on the round-trip and leaving an empty "Camera off"
        // stage. The backend's 409-as-ok keeps the re-end race silent.
        if (token) void deps.endSession(sessionId, reason, token);
      }
      deps.navigate("/app");
    },
    [deps, dispatch, stopStream, freshToken],
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
      dispatch({ type: "CAMERA_ERROR", kind: "insecure" }); // webcam needs HTTPS / localhost
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
    if (!sessionId) return;
    // Pause the UI instantly (above); persist the status with a FRESH token (L2) without
    // blocking the surface — the cached token may already be stale at pause time.
    void (async () => {
      const token = await freshToken();
      if (token) await deps.patchStatus(sessionId, "paused", token);
    })();
  }, [deps, dispatch, stopStream, freshToken]);

  // Manual Resume: re-acquire the camera (re-entering the blocked surface if access was
  // revoked or the context is no longer secure), reusing the existing session → PATCH
  // active. A fresh recording warms up again (T036: no server-side buffer to restore).
  const handleResume = useCallback(async () => {
    if (!deps.isSecureContext()) {
      dispatch({ type: "CAMERA_ERROR", kind: "insecure" });
      return;
    }
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      dispatch({ type: "CAMERA_BLOCKED" });
      return;
    }
    // L2: resume with a FRESH token. After a long pause (no uploads) the cached token may be
    // stale; fetch the current one BEFORE re-acquiring the camera. If the browser session is
    // gone (refresh failed), surface the honest signed-out state rather than a misleading
    // camera-blocked — the user can't score as themselves without a valid token.
    const token = await freshToken();
    if (!token) {
      dispatch({ type: "SESSION_EXPIRED" });
      return;
    }
    const opened = await openCameraAndRecord();
    if (!opened) return; // getUserMedia rejection already routed to blocked
    dispatch({ type: "RESUME" }); // → warming-up
    void deps.patchStatus(sessionId, "active", token);
  }, [deps, dispatch, openCameraAndRecord, freshToken]);

  const handleEnd = useCallback(() => {
    void endAndLeave("user");
  }, [endAndLeave]);

  // US4 (T047): a STABLE loader for the this-session trend. Reads the (stable) injected dep
  // at call time, so the render never touches the deps ref; defaults to the real RLS reader.
  const loadSessionTrend = useCallback(
    (id: string) => (depsRef.current.sessionTrendLoad ?? getSessionTrend)(id),
    [],
  );

  // Session elapsed clock. `sessionLive` decides whether the timer is shown at all;
  // `timerRunning` decides whether it COUNTS — a manual Pause excludes its duration from the
  // elapsed time (008-followups): on pause we bank the current run and stop ticking, so the
  // display freezes; Resume continues from the banked total. out-of-frame still counts (the
  // session is monitoring presence, not on a manual break). setElapsed is only called inside
  // the interval (never synchronously in the effect body), so the timer adds no new lint.
  const sessionLive =
    op === "warming-up" || op === "active" || op === "out-of-frame" || op === "paused";
  const timerRunning = op === "warming-up" || op === "active" || op === "out-of-frame";
  useEffect(() => {
    if (!timerRunning) {
      // Paused / not-live: bank the elapsed run so Resume continues from here, then idle.
      if (runStartRef.current !== null) {
        elapsedAccumRef.current += performance.now() - runStartRef.current;
        runStartRef.current = null;
      }
      return;
    }
    if (runStartRef.current === null) runStartRef.current = performance.now();
    const id = setInterval(() => {
      const running = runStartRef.current === null ? 0 : performance.now() - runStartRef.current;
      setElapsed(Math.floor((elapsedAccumRef.current + running) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

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
    // Drop any window coalesced while an upload was in flight: once the op leaves the live set
    // (paused / ended / blocked / signed-out) the drain loop must not send a now-stale window.
    pendingClipRef.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a one-time state reset during camera teardown: when the op leaves a capturing state, stopStream() calls setStream(null) once to release the live stream — not the per-render cascade this rule guards against.
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
            Session ·{" "}
            <b data-testid="session-timer" className="font-semibold text-ink">
              {mm}:{ss}
            </b>
          </span>
        )}
      </div>

      {/* Top padding (pt-16) reserves clearance for the absolute camera pill so the centered
          bloom never rides up under it on a tall live stage at 360 px (008-followups). */}
      <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-border bg-surface px-6 pb-6 pt-16 shadow-soft sm:min-h-[480px] sm:px-10 sm:pb-10">
        <div
          className="absolute right-4 top-4 z-10"
          onPointerEnter={() => setSelfViewHover(true)}
          onPointerLeave={() => setSelfViewHover(false)}
          onFocus={(e) => setSelfViewKbFocus(isKeyboardFocus(e.target))}
          onBlur={() => setSelfViewKbFocus(false)}
        >
          <CameraPill status={pillStatus} pinned={pinned} onTogglePin={() => setPinned((p) => !p)} />
          {streaming && (
            <Viewfinder
              pinned={pinned}
              peek={selfViewHover || selfViewKbFocus}
              outOfFrame={op === "out-of-frame"}
            >
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
