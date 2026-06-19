"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";

import type { FailureCause } from "@/components/anchor/cause-chip";
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
import { useMonitoringSession } from "./use-monitoring-session";
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
  const [streaming, setStreaming] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<WindowRecorderHandle | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
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
    if (node && streamRef.current) node.srcObject = streamRef.current;
    setVideoEl(node);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
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
    if (!deps.isSecureContext()) {
      dispatch({ type: "CAMERA_BLOCKED" }); // webcam needs HTTPS / localhost
      return;
    }
    let stream: MediaStream;
    try {
      stream = await deps.getUserMedia({ video: true, audio: false }); // mic off (audio is feature 013)
    } catch {
      dispatch({ type: "CAMERA_BLOCKED" });
      return;
    }
    const session = await deps.getSession();
    if (!session) {
      stream.getTracks().forEach((t) => t.stop());
      dispatch({ type: "CAMERA_BLOCKED" });
      return;
    }
    tokenRef.current = session.accessToken;
    // Calibrate-first guard runs UP FRONT (before any window is recorded): a no-anchor
    // caller is routed out, never a fabricated/global anchor (SC-004).
    const created = await deps.createSession(session.accessToken);
    if (!created.ok) {
      stream.getTracks().forEach((t) => t.stop());
      dispatch(created.kind === "no_anchor" ? { type: "NO_ANCHOR" } : { type: "CAMERA_BLOCKED" });
      return;
    }
    sessionIdRef.current = created.sessionId;
    streamRef.current = stream;
    telemetryRef.current = emptyTelemetry();
    setStreaming(true); // mounts the <video>; attachVideo wires srcObject
    dispatch({ type: "CAMERA_GRANTED" }); // → warming-up

    const recorder = createWindowRecorder({
      stream,
      strideMs: deps.strideMs,
      onWindow: handleWindow,
      createRecorder: deps.createRecorder,
    });
    recorderRef.current = recorder;
    recorder.start();
  }, [deps, dispatch, handleWindow]);

  const handleRetryBlocked = useCallback(() => {
    dispatch({ type: "REQUEST_PERMISSION" });
  }, [dispatch]);

  // Session timer (chrome) — ticks once recording begins.
  useEffect(() => {
    if (op !== "warming-up" && op !== "active") return;
    const startedAt = performance.now();
    const id = setInterval(() => setElapsed(Math.floor((performance.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [op]);

  // Release the camera + recorder on unmount (privacy; no leaked stream).
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
