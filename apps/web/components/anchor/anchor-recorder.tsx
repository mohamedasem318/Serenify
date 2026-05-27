"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { checkHealth, postAnchor } from "@/lib/api/anchor-client";
import { broadcastAnchorCaptured } from "@/lib/auth-broadcast";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

import { Countdown } from "./countdown";
import { DevicePicker } from "./device-picker";
import { useAnchorRecorder } from "./use-anchor-recorder";

const RECORDING_SECONDS = 60;

/**
 * Calm-voice copy (Principle V, locked with Mohamed 2026-05-27). Identical for
 * onboarding + calibrate. `uploadInterrupted` is intentionally the same message
 * as `unavailable`: a transport failure after the /healthz pre-check means the
 * service became unreachable mid-upload, which reads to the user as the same
 * "temporarily unavailable" condition.
 */
const COPY = {
  explanation:
    "To detect stress accurately for you, we need to learn what your relaxed state looks like. We'll record about a minute of you looking at the camera. The video itself is never stored — only a small set of measurements derived from it.",
  permissionDenied:
    "Camera access wasn't granted. You can update your browser permissions and try again, or skip for now and come back from your dashboard later.",
  extractionFailed:
    "We couldn't see your face clearly in that recording. Better lighting and facing the camera directly usually helps. Want to try again?",
  unavailable:
    "Calibration is temporarily unavailable. We'll have it back shortly — please try again in a few minutes.",
} as const;

/** Codec probe order (📌 DECISION-13 / T038); the backend accepts mp4 + webm (FR-047). */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const type of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/mp4"]) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return undefined; // let the browser choose its default container
}

function base64ToHex(b64: string): string {
  const bin = atob(b64);
  let hex = "";
  for (let i = 0; i < bin.length; i += 1) {
    hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return hex;
}

/** Amber notice (never red) matching the onboarding-form alert idiom (Principle V). */
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-control border border-amber/50 bg-amber/10 px-3 py-2 text-sm leading-relaxed text-ink"
    >
      {children}
    </p>
  );
}

export function AnchorRecorder({
  onComplete,
  onSkip,
}: {
  onComplete: () => void;
  onSkip: () => void;
  /** Copy/telemetry only; behavior is identical for both hosts (contract). */
  context?: "onboarding" | "calibrate";
}) {
  const { state, dispatch, skipVisible, escapeVisible } = useAnchorRecorder();
  const [health, setHealth] = useState<"checking" | "up" | "down">("checking");
  const [remaining, setRemaining] = useState(RECORDING_SECONDS);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef(RECORDING_SECONDS);
  const deviceIdRef = useRef<string | undefined>(undefined);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // --- Readiness pre-check (FR-048): never let the user record into a dead backend.
  useEffect(() => {
    let active = true;
    void checkHealth().then((ok) => {
      if (active) setHealth(ok ? "up" : "down");
    });
    return () => {
      active = false;
    };
  }, []);

  // --- Reveal "Skip for now" once the explanation is scrolled past (FR-004).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        dispatch({ type: "SCROLLED_PAST_EXPLANATION" });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [dispatch]);

  // Attaching the stream has to wait for the <video> to actually mount. The
  // element is only rendered once status reaches permission-granted/recording —
  // a render that happens AFTER getUserMedia resolves — so assigning srcObject
  // inside startCapture hits a still-null ref and the preview stays black. A
  // callback ref sets srcObject the moment React attaches the node (and again on
  // retry, when the node re-mounts).
  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) node.srcObject = streamRef.current;
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // --- Release camera + timer on unmount (privacy + no leaked intervals).
  useEffect(() => () => {
    clearTimer();
    stopStream();
  }, [clearTimer, stopStream]);

  const submitClip = useCallback(
    async (blob: Blob) => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        dispatch({ type: "UPLOAD_FAILED" });
        return;
      }

      const result = await postAnchor(blob, session.access_token);
      if (!result.ok) {
        if (result.kind === "extraction_failed") {
          dispatch({ type: "EXTRACT_FAILED", reason: result.reason });
        } else {
          dispatch({ type: "UPLOAD_FAILED" });
        }
        return;
      }

      // The web app writes the derived vector with the user's own session client;
      // the backend holds no DB creds (DECISION-9). bytea is sent as a \x-hex
      // string (resolved decision 2). RLS update-self + the column grant allow it.
      const { error } = await supabase
        .from("profiles")
        .update({
          anchor_vector: `\\x${base64ToHex(result.vectorB64)}`,
          anchor_captured_at: new Date().toISOString(),
          anchor_model_version: result.modelVersion,
        })
        .eq("id", session.user.id);

      if (error) {
        dispatch({ type: "UPLOAD_FAILED" });
        return;
      }

      dispatch({ type: "UPLOAD_SUCCESS" });
      // US7: refresh sibling tabs on the onboarding step / /app/calibrate (FR-034).
      broadcastAnchorCaptured();
      onComplete();
    },
    [dispatch, onComplete],
  );

  const stopRecording = useCallback(() => {
    clearTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, [clearTimer]);

  const beginRecording = useCallback(
    (stream: MediaStream) => {
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "video/webm";
        stopStream(); // we have the clip — release the camera immediately
        dispatch({ type: "RECORDING_COMPLETE" });
        void submitClip(new Blob(chunksRef.current, { type }));
      };

      recorder.start();
      dispatch({ type: "START_RECORDING" });

      remainingRef.current = RECORDING_SECONDS;
      setRemaining(RECORDING_SECONDS);
      timerRef.current = setInterval(() => {
        remainingRef.current -= 1;
        setRemaining(remainingRef.current);
        if (remainingRef.current <= 0) stopRecording();
      }, 1000);
    },
    [dispatch, stopStream, stopRecording, submitClip],
  );

  // --- Start (or retry): request the camera, then record immediately (ST-01).
  const startCapture = useCallback(async () => {
    dispatch({ type: "REQUEST_PERMISSION" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceIdRef.current ? { deviceId: { exact: deviceIdRef.current } } : true,
        audio: false, // mic stays off — audio is feature 013
      });
      streamRef.current = stream;
      dispatch({ type: "PERMISSION_GRANTED" }); // mounts <video>; attachVideo wires srcObject
      beginRecording(stream);
    } catch {
      dispatch({ type: "PERMISSION_DENIED" });
    }
  }, [dispatch, beginRecording]);

  // Stable identity so DevicePicker's enumerate effect doesn't re-run each render.
  const handleDeviceChange = useCallback((id: string | undefined) => {
    deviceIdRef.current = id;
  }, []);

  const isRecording = state.status === "recording" || state.status === "permission-granted";
  const isBusy = state.status === "permission-requesting" || state.status === "uploading";

  // --- Health gates the whole flow ----------------------------------------
  if (health === "down") {
    return (
      <section className="space-y-6">
        <Notice>{COPY.unavailable}</Notice>
        <Button className="h-12 w-full" variant="ghost" onClick={onSkip}>
          Skip for now
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {!isRecording && state.status !== "uploading" && (
        <>
          <p className="text-sm leading-relaxed text-muted">{COPY.explanation}</p>
          <div ref={sentinelRef} aria-hidden="true" />
        </>
      )}

      {state.status === "permission-denied" && <Notice>{COPY.permissionDenied}</Notice>}
      {state.status === "extract-failed" && <Notice>{COPY.extractionFailed}</Notice>}
      {state.status === "upload-failed" && <Notice>{COPY.unavailable}</Notice>}

      {/* Live preview + countdown while recording. */}
      {isRecording && (
        <div className="space-y-4">
          <video
            ref={attachVideo}
            autoPlay
            muted
            playsInline
            className="aspect-video w-full rounded-control border border-border bg-ink/5 object-cover"
          />
          <div className="flex justify-center">
            <Countdown remaining={remaining} total={RECORDING_SECONDS} />
          </div>
        </div>
      )}

      {state.status === "uploading" && (
        <p className="text-center text-sm text-muted" aria-live="polite">
          One moment…
        </p>
      )}

      {/* Device picker only before recording starts. */}
      {(state.status === "idle" || state.status === "permission-requesting") && (
        <DevicePicker
          permissionGranted={false}
          onChange={handleDeviceChange}
          disabled={isBusy}
        />
      )}

      {/* Primary action. */}
      {(state.status === "idle" || state.status === "permission-requesting") && (
        <Button className="h-12 w-full" onClick={startCapture} disabled={isBusy}>
          {state.status === "permission-requesting" ? "Requesting camera…" : "Start recording"}
        </Button>
      )}

      {(state.status === "extract-failed" || state.status === "upload-failed") && (
        <Button className="h-12 w-full" variant="secondary" onClick={startCapture}>
          Record again
        </Button>
      )}

      {state.status === "permission-denied" && (
        <Button className="h-12 w-full" variant="secondary" onClick={startCapture}>
          Try again
        </Button>
      )}

      {/* Skip-for-now — revealed by scroll / first failure, always in denied (FR-004/007). */}
      {skipVisible && state.status !== "recording" && state.status !== "uploading" && (
        <Button className="h-12 w-full" variant="ghost" onClick={onSkip}>
          Skip for now
        </Button>
      )}

      {/* Three-failure escape (FR-027/028). */}
      {escapeVisible && (
        <Button className="h-12 w-full" variant="ghost" onClick={onSkip}>
          Skip and continue without calibration
        </Button>
      )}
    </section>
  );
}
