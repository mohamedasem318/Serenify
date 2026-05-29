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
 * Calm-voice copy (Principle V). Explanation/failure strings locked with Mohamed
 * 2026-05-27; success heading/body locked 2026-05-28. Identical for onboarding +
 * calibrate. A transport failure after the /healthz pre-check (upload-failed)
 * reuses `unavailable`: the service became unreachable mid-upload, which reads to
 * the user as the same "temporarily unavailable" condition.
 */
const COPY = {
  explanation:
    "To detect stress accurately for you, we need to learn what your relaxed state looks like. We'll record about a minute of you looking at the camera. The video itself is never stored — only a small set of measurements derived from it.",
  permissionDenied:
    "Camera access wasn't granted. You can update your browser permissions and try again, or skip for now and come back from your dashboard later.",
  permissionBlocked:
    "Camera access is blocked in your browser. Enable it for this site in your settings, then try again.",
  extractionFailed:
    "We couldn't see your face clearly in that recording. Better lighting and facing the camera directly usually helps. Want to try again?",
  unavailable:
    "Calibration is temporarily unavailable. We'll have it back shortly — please try again in a few minutes.",
  successHeading: "You're all set",
  successBody:
    "Your calm baseline is saved and stress detection is active. The recording wasn't kept — only the measurements derived from it.",
} as const;

/**
 * Best-effort permission probe (📌 ST-02 retry-flash fix). Chrome/Edge/Firefox
 * and Safari 16+ return one of {granted, prompt, denied}; older Safari/WebKit
 * either lacks the API or throws on the "camera" name. The probe is wrapped so
 * a missing/throwing implementation collapses to "unsupported" — callers must
 * treat that as "don't know; behave like prompt".
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
  // IntersectionObserver delivers an initial entry synchronously after observe()
  // with the element's current visibility. The sentinel sits right below a short
  // paragraph, so on any normal viewport it is in view on mount — without the
  // first-callback guard the initial entry would fire isIntersecting:true and
  // reveal Skip before the user had done anything (📌 ST-10). Discard that
  // first entry and react only to genuine transitions afterwards.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let isInitial = true;
    const observer = new IntersectionObserver((entries) => {
      if (isInitial) {
        isInitial = false;
        return;
      }
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
  // Detach the recorder handlers BEFORE stopping the tracks: stopping a live
  // stream makes MediaRecorder fire a final `stop`, which would run submitClip and
  // write an anchor for an ABANDONED recording (e.g. the user hits Back to abort
  // mid-capture). An anchor must only be written on an intentional, completed
  // recording — never as a side effect of navigating away.
  useEffect(() => () => {
    clearTimer();
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
    }
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
      // Fires on success regardless of when THIS tab dismisses the success view.
      broadcastAnchorCaptured();
      // No auto-redirect — the success view is user-dismissible (Mohamed 2026-05-28);
      // its "Continue to dashboard" button calls onComplete().
    },
    [dispatch],
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
  // ST-02 anti-flash: on retry from permission-denied, the optimistic
  // permission-requesting dispatch would briefly replace the denial notice with
  // the start-recording form (idle/permission-requesting share that render
  // branch). A hard-blocked camera makes getUserMedia reject synchronously, so
  // the user sees a one-frame flicker before snapping back to denied. Avoid it
  // by (1) probing permissions.query first and short-circuiting on "denied",
  // and (2) when we DO call getUserMedia from the denied state, skipping the
  // optimistic dispatch so the denial notice stays put until the stream
  // actually resolves. The anti-flash holds even if the probe is unsupported.
  const startCapture = useCallback(async () => {
    // ST-18 / FR-048: the recording-state transition MUST be downstream of an
    // awaited 200 from /healthz — never optimistic. Re-check on every Start and
    // retry so a backend that died after the mount-time probe (or was still
    // being probed when the user clicked) surfaces the unavailable gate instead
    // of flashing the preview + countdown. Setting "checking" also disables the
    // action button for the duration, so the Start click can't slip a capture
    // through before we know the backend is reachable.
    setHealth("checking");
    if (!(await checkHealth())) {
      setHealth("down");
      return;
    }
    setHealth("up");

    const isRetryFromDenied = state.status === "permission-denied";
    if (isRetryFromDenied) {
      const probed = await probeCameraPermission();
      if (probed === "denied") {
        dispatch({ type: "PERMISSION_DENIED", blocked: true });
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceIdRef.current ? { deviceId: { exact: deviceIdRef.current } } : true,
          audio: false,
        });
        streamRef.current = stream;
        dispatch({ type: "PERMISSION_GRANTED" });
        beginRecording(stream);
      } catch {
        // Re-probe so a hard block surfaces the blocked-state copy on the
        // next render (some browsers downgrade prompt → denied on the user's
        // explicit "Block" click, which only the post-call probe reflects).
        const after = await probeCameraPermission();
        dispatch({ type: "PERMISSION_DENIED", blocked: after === "denied" });
      }
      return;
    }

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
      const after = await probeCameraPermission();
      dispatch({ type: "PERMISSION_DENIED", blocked: after === "denied" });
    }
  }, [dispatch, beginRecording, state.status]);

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

  // --- Success is sticky + user-dismissible (no auto-redirect): one confirmation,
  // one action. The anchor is already written + broadcast by now, so leaving by
  // any means keeps it; the button is the explicit path to /app (Mohamed 2026-05-28).
  if (state.status === "success") {
    return (
      <section className="space-y-6">
        <div className="space-y-2">
          <p className="text-lg font-medium text-ink">
            <span aria-hidden="true" className="text-meadow">✓</span> {COPY.successHeading}
          </p>
          <p className="text-sm leading-relaxed text-muted">{COPY.successBody}</p>
        </div>
        <Button className="h-12 w-full" onClick={onComplete}>
          Continue to dashboard
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {(state.status === "idle" || state.status === "permission-requesting") && (
        <>
          <p className="text-sm leading-relaxed text-muted">{COPY.explanation}</p>
          <div ref={sentinelRef} aria-hidden="true" />
        </>
      )}

      {state.status === "permission-denied" && (
        <Notice>{state.permissionBlocked ? COPY.permissionBlocked : COPY.permissionDenied}</Notice>
      )}
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

      {/* Primary action. Disabled until the readiness probe confirms the backend
          is reachable, so the recording-state transition only ever runs after an
          awaited 200 (ST-18) — no flash of preview + countdown into a dead backend. */}
      {(state.status === "idle" || state.status === "permission-requesting") && (
        <Button className="h-12 w-full" onClick={startCapture} disabled={isBusy || health === "checking"}>
          {state.status === "permission-requesting"
            ? "Requesting camera…"
            : health === "checking"
              ? "Checking availability…"
              : "Start recording"}
        </Button>
      )}

      {(state.status === "extract-failed" || state.status === "upload-failed") && (
        <Button
          className="h-12 w-full"
          variant="secondary"
          onClick={startCapture}
          disabled={health === "checking"}
        >
          Try again
        </Button>
      )}

      {state.status === "permission-denied" && (
        <Button
          className="h-12 w-full"
          variant="secondary"
          onClick={startCapture}
          disabled={health === "checking"}
        >
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
