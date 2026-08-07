"use client";

/* Hallmark · component: diagnostic page · genre: editorial (inherited) · theme: project (Mist & Meadow)
 * states: idle · camera · constraints · recording · measuring · mp4-check · done · error
 * contrast: project tokens only (Button variants pre-audited)
 */

/**
 * Mobile capture probe (flag-gated, ephemeral — see docs/triage/mobile-capture-diagnosis.md).
 *
 * Answers, on the tester's real device, the client-side halves of the iOS capture
 * question (#89): which recorder container the PRODUCTION negotiation picks here
 * (`pickWindowMimeType` — imported, not re-implemented), what the camera grants by
 * default and under `ideal` constraints, whether timeslice chunks actually flow (webm
 * AND forced-mp4 — the fMP4 fix candidate needs periodic chunks, which Safari's mp4
 * recorder historically only emitted on stop), whether the recorded media clock runs
 * sub-realtime (the `probe_s = 39 @ ~75 s wall` signature from smoke Run 4), and
 * whether the stream mutes/suspends mid-capture.
 *
 * Privacy posture (binding): everything runs on-device. No fetch, no Supabase, no
 * storage — recorded bytes live in memory and are discarded when the tab closes.
 * The only output is a text report the tester copies and sends back themselves.
 * The payload is device/API capability only: no frames, no audio, no identifiers.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { pickWindowMimeType, DEFAULT_STRIDE_MS } from "@/components/monitor/window-recorder";

/** Wire-format version so a later probe revision can't be confused with this one. */
const PROBE_VERSION = "capture-probe/1";

/** Main recording length: crosses the ~40 s mark where #89's server probe died AND
 *  the 60 s scoring gate, at the production 10 s timeslice. */
const MAIN_RECORD_MS = 75_000;

/** Forced-mp4 check: long enough for 2 timeslice flushes — enough to prove whether
 *  Safari's mp4 recorder emits periodic chunks at all (0 chunks until stop = the
 *  restructure-the-fix case). */
const MP4_RECORD_MS = 25_000;

/** Everything we ask isTypeSupported about. Superset of the production candidates
 *  (window-recorder.ts) plus the explicit fMP4/H.264/HEVC variants a Phase-2 fix
 *  could negotiate. */
const MIME_MATRIX = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/webm;codecs=h264",
  "video/mp4",
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1.640028',
  'video/mp4;codecs=hvc1.1.6.L93.B0',
] as const;

type Phase =
  | "idle"
  | "camera"
  | "constraints"
  | "recording"
  | "measuring"
  | "mp4-check"
  | "done";

interface ChunkLog {
  /** ms since recorder start */
  t: number;
  bytes: number;
}

/** One track/document event with a wall-clock offset (ms since probe start). */
interface EventLog {
  t: number;
  event: string;
}

/** The report is a plain mutable bag accumulated across phases; every step that can
 *  fail writes its error in place so a partial run still yields a usable report. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Report = Record<string, any>;

function summarizeSettings(s: MediaTrackSettings | undefined) {
  if (!s) return null;
  return {
    width: s.width ?? null,
    height: s.height ?? null,
    frameRate: s.frameRate ?? null,
    facingMode: s.facingMode ?? null,
    aspectRatio: s.aspectRatio ?? null,
  };
}

/** Blob → media duration in seconds, via a detached <video>. Un-finalized/duration-less
 *  webm reports Infinity; the standard workaround (seek far past the end, wait for
 *  durationchange) recovers the real value — and whether the workaround was NEEDED is
 *  itself recorded (it is the "container carries no duration" signature). */
function measureBlobDuration(
  blob: Blob,
): Promise<{ seconds: number | null; neededInfinityWorkaround: boolean; error?: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    let neededWorkaround = false;
    const finish = (seconds: number | null, error?: string) => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve({ seconds, neededInfinityWorkaround: neededWorkaround, error });
    };
    const timer = setTimeout(() => finish(null, "metadata decode timed out (15s)"), 15_000);
    video.onerror = () => {
      clearTimeout(timer);
      finish(null, `video element error: ${video.error?.code ?? "unknown"}`);
    };
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration)) {
        clearTimeout(timer);
        finish(video.duration);
        return;
      }
      // Infinity duration: seek absurdly far; the durationchange that follows
      // carries the real duration.
      neededWorkaround = true;
      video.ondurationchange = () => {
        if (Number.isFinite(video.duration)) {
          clearTimeout(timer);
          finish(video.duration);
        }
      };
      video.currentTime = Number.MAX_SAFE_INTEGER;
    };
    video.src = url;
  });
}

/** Record from `stream` for `durationMs` with the given mime (undefined = browser
 *  default), logging every timeslice chunk. Resolves with the chunk log + final blob. */
function recordFor(
  stream: MediaStream,
  mimeType: string | undefined,
  durationMs: number,
  onProgress: (msLeft: number) => void,
): Promise<{
  requestedMime: string | null;
  reportedMime: string;
  chunks: ChunkLog[];
  blob: Blob | null;
  wallMs: number;
  recorderError: string | null;
}> {
  return new Promise((resolve, reject) => {
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch (err) {
      reject(err);
      return;
    }
    const chunks: ChunkLog[] = [];
    const parts: Blob[] = [];
    let recorderError: string | null = null;
    const t0 = performance.now();
    const tick = setInterval(() => {
      onProgress(Math.max(0, durationMs - (performance.now() - t0)));
    }, 1_000);
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        parts.push(event.data);
        chunks.push({ t: Math.round(performance.now() - t0), bytes: event.data.size });
      }
    };
    recorder.onerror = (event) => {
      const err = (event as unknown as { error?: DOMException }).error;
      recorderError = err ? `${err.name}: ${err.message}` : "unknown recorder error";
    };
    recorder.onstop = () => {
      clearInterval(tick);
      const wallMs = Math.round(performance.now() - t0);
      const type = recorder.mimeType || mimeType || "";
      resolve({
        requestedMime: mimeType ?? null,
        reportedMime: recorder.mimeType || "(empty)",
        chunks,
        blob: parts.length ? new Blob(parts, { type }) : null,
        wallMs,
        recorderError,
      });
    };
    setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, durationMs);
    // Production parity: one continuous timeslice recording (window-recorder.ts).
    recorder.start(DEFAULT_STRIDE_MS);
  });
}

const PHASE_COPY: Record<Phase, { head: string; sub: string }> = {
  idle: { head: "", sub: "" },
  camera: { head: "Turning the camera on", sub: "Allow camera access when your phone asks." },
  constraints: { head: "Checking camera modes", sub: "A few quick settings checks — one moment." },
  recording: {
    head: "Recording test one of two",
    sub: "Keep this page open and your face roughly in view.",
  },
  measuring: { head: "Measuring the recording", sub: "Nothing is uploaded — this happens on your phone." },
  "mp4-check": { head: "Recording test two of two", sub: "Almost there — about half a minute left." },
  done: { head: "All done", sub: "Copy the results below and send them back. Then you can close this page." },
};

export function CaptureProbe() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [reportText, setReportText] = useState<string | null>(null);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const report = useRef<Report>({});
  const events = useRef<EventLog[]>([]);
  const probeT0 = useRef<number>(0);

  const logEvent = useCallback((event: string) => {
    events.current.push({ t: Math.round(performance.now() - probeT0.current), event });
  }, []);

  // The camera must never outlive the probe (same posture as the monitor's release
  // effect): release on unmount and when the run finishes.
  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  useEffect(() => releaseStream, [releaseStream]);

  const run = useCallback(async () => {
    probeT0.current = performance.now();
    const r = report.current;
    r.probe = PROBE_VERSION;
    r.startedAt = new Date().toISOString();

    // ── Step A: environment + static capability (no permission needed) ──────
    r.env = {
      userAgent: navigator.userAgent,
      secureContext: window.isSecureContext === true,
      devicePixelRatio: window.devicePixelRatio,
      screen: { width: screen.width, height: screen.height },
      visibilityState: document.visibilityState,
    };
    r.mediaRecorder = typeof MediaRecorder !== "undefined";
    r.mimeSupport = Object.fromEntries(
      MIME_MATRIX.map((m) => [
        m,
        typeof MediaRecorder !== "undefined" && !!MediaRecorder.isTypeSupported?.(m),
      ]),
    );
    // What PRODUCTION would pick on this device — the real negotiation, imported.
    r.productionPick = pickWindowMimeType() ?? "(browser default)";
    r.supportedConstraints = (() => {
      try {
        const s = navigator.mediaDevices.getSupportedConstraints();
        return {
          width: !!s.width,
          height: !!s.height,
          frameRate: !!s.frameRate,
          facingMode: !!s.facingMode,
          aspectRatio: !!s.aspectRatio,
        };
      } catch {
        return null;
      }
    })();

    // Keep the screen awake for the ~2 min run (iOS auto-lock defaults to 30 s and a
    // locked screen would abort capture). Availability is itself capability data.
    let wakeLock: WakeLockSentinel | null = null;
    try {
      wakeLock = (await navigator.wakeLock?.request("screen")) ?? null;
      r.wakeLock = wakeLock ? "acquired" : "unavailable";
    } catch (err) {
      r.wakeLock = `failed: ${(err as Error).name}`;
    }

    const visHandler = () => logEvent(`visibility:${document.visibilityState}`);
    document.addEventListener("visibilitychange", visHandler);

    try {
      // ── Step B: camera open, EXACTLY like production (no constraints) ─────
      setPhase("camera");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (err) {
        const e = err as DOMException;
        r.getUserMedia = { ok: false, errorName: e.name, errorMessage: e.message };
        throw new Error(`camera open failed (${e.name}) — report still useful, copy it`);
      }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (!track) {
        r.getUserMedia = { ok: false, errorName: "NoVideoTrack" };
        throw new Error("camera stream carried no video track");
      }
      r.getUserMedia = { ok: true };
      r.defaultSettings = summarizeSettings(track.getSettings());
      r.capabilities = (() => {
        try {
          const c = track.getCapabilities?.();
          if (!c) return null;
          return {
            width: c.width ?? null,
            height: c.height ?? null,
            frameRate: c.frameRate ?? null,
            facingMode: c.facingMode ?? null,
          };
        } catch {
          return null;
        }
      })();
      track.addEventListener("mute", () => logEvent("track:mute"));
      track.addEventListener("unmute", () => logEvent("track:unmute"));
      track.addEventListener("ended", () => logEvent("track:ended"));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // ── Step C: `ideal` constraint responses (never `exact`) ──────────────
      setPhase("constraints");
      r.constraintProbes = [];
      for (const probe of [
        { label: "ideal 1280x720@30", c: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } },
        { label: "ideal 640x480@15", c: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } } },
      ]) {
        try {
          await track.applyConstraints(probe.c);
          r.constraintProbes.push({ probe: probe.label, ok: true, granted: summarizeSettings(track.getSettings()) });
        } catch (err) {
          const e = err as DOMException;
          r.constraintProbes.push({ probe: probe.label, ok: false, errorName: e.name });
        }
      }
      // Reset to the unconstrained default before the production-parity recording.
      try {
        await track.applyConstraints({});
        r.settingsAfterReset = summarizeSettings(track.getSettings());
      } catch (err) {
        r.settingsAfterReset = { error: (err as DOMException).name };
      }

      // ── Step D: production-parity recording (pickWindowMimeType, 10 s slices) ──
      setPhase("recording");
      // The probe deliberately records whatever production would have picked — including
      // the browser-default case. An unsupported engine has no production MIME to mirror,
      // so the probe falls through to the browser default and reports what it got.
      const productionChoice = pickWindowMimeType();
      const main = await recordFor(
        stream,
        productionChoice.ok ? productionChoice.mimeType : undefined,
        MAIN_RECORD_MS,
        (msLeft) => setCountdown(Math.ceil(msLeft / 1000)),
      );
      setCountdown(null);
      r.mainRecording = {
        requestedMime: main.requestedMime,
        reportedMime: main.reportedMime,
        chunkCount: main.chunks.length,
        chunks: main.chunks,
        totalBytes: main.chunks.reduce((a, c) => a + c.bytes, 0),
        blobType: main.blob?.type ?? null,
        wallSeconds: +(main.wallMs / 1000).toFixed(1),
        recorderError: main.recorderError,
      };

      // ── Step D2: media-clock vs wall-clock (the sub-realtime signature) ────
      setPhase("measuring");
      if (main.blob) {
        const dur = await measureBlobDuration(main.blob);
        r.mainRecording.mediaSeconds = dur.seconds != null ? +dur.seconds.toFixed(1) : null;
        r.mainRecording.durationNeededInfinityWorkaround = dur.neededInfinityWorkaround;
        if (dur.error) r.mainRecording.durationError = dur.error;
        if (dur.seconds != null && main.wallMs > 0) {
          r.mainRecording.mediaToWallRatio = +(dur.seconds / (main.wallMs / 1000)).toFixed(3);
        }
      }

      // ── Step E: forced-mp4 timeslice check (the fMP4 fix candidate) ───────
      const mp4Candidates = MIME_MATRIX.filter(
        (m) => m.startsWith("video/mp4") && r.mimeSupport[m],
      );
      if (mp4Candidates.length > 0 && !String(r.productionPick).startsWith("video/mp4")) {
        setPhase("mp4-check");
        try {
          const mp4 = await recordFor(stream, mp4Candidates[0], MP4_RECORD_MS, (msLeft) =>
            setCountdown(Math.ceil(msLeft / 1000)),
          );
          setCountdown(null);
          r.mp4Check = {
            requestedMime: mp4.requestedMime,
            reportedMime: mp4.reportedMime,
            chunkCount: mp4.chunks.length,
            chunks: mp4.chunks,
            totalBytes: mp4.chunks.reduce((a, c) => a + c.bytes, 0),
            blobType: mp4.blob?.type ?? null,
            wallSeconds: +(mp4.wallMs / 1000).toFixed(1),
            recorderError: mp4.recorderError,
            // The load-bearing bit: did chunks arrive BEFORE stop? The continuous
            // upload design needs periodic flushes; on-stop-only mp4 means the fix
            // must restructure, not just switch container.
            emitsTimesliceChunks: mp4.chunks.some((c) => c.t < MP4_RECORD_MS - 2_000),
          };
          if (mp4.blob) {
            const dur = await measureBlobDuration(mp4.blob);
            r.mp4Check.mediaSeconds = dur.seconds != null ? +dur.seconds.toFixed(1) : null;
            if (dur.error) r.mp4Check.durationError = dur.error;
          }
        } catch (err) {
          const e = err as Error;
          r.mp4Check = { error: `${e.name}: ${e.message}` };
        }
      } else {
        r.mp4Check =
          mp4Candidates.length === 0
            ? "skipped: no mp4 support reported"
            : "skipped: production pick is already mp4";
      }
    } catch (err) {
      r.fatal = (err as Error).message;
      setFatal((err as Error).message);
    } finally {
      document.removeEventListener("visibilitychange", visHandler);
      try {
        await wakeLock?.release();
      } catch {
        /* released with the page */
      }
      releaseStream();
      r.events = events.current;
      r.finishedAt = new Date().toISOString();
      setReportText(JSON.stringify(report.current, null, 1));
      setPhase("done");
    }
  }, [logEvent, releaseStream]);

  const copyReport = useCallback(async () => {
    if (!reportText) return;
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  }, [reportText]);

  const copy = PHASE_COPY[phase];
  const running = phase !== "idle" && phase !== "done";

  return (
    <main className="min-h-dvh bg-bg p-4 sm:p-8">
      <div className="mx-auto w-full max-w-xl">
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft sm:p-8">
          <h1 className="font-display text-2xl text-ink">Camera check</h1>

          {phase === "idle" && (
            <>
              <p className="mt-3 text-base text-muted">
                This two-minute check helps us understand how this phone&rsquo;s camera and
                recorder behave. Your camera will be on for about two minutes.
              </p>
              <p className="mt-3 text-base text-muted">
                Nothing is uploaded or saved — the test recording stays on your phone and is
                thrown away when you close this page. At the end you&rsquo;ll see a small text
                report to copy and send back.
              </p>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
                <li>Keep this page open the whole time.</li>
                <li>Keep your face roughly in front of the camera.</li>
                <li>When your phone asks, allow camera access.</li>
              </ul>
              <Button variant="meadow" size="lg" className="mt-6 w-full" onClick={run}>
                Start the check
              </Button>
            </>
          )}

          {running && (
            <div aria-live="polite">
              <p className="mt-4 text-base font-medium text-ink">{copy.head}</p>
              <p className="mt-1 text-sm text-muted">{copy.sub}</p>
              {countdown != null && (
                <p className="mt-3 font-display text-4xl text-meadow-text" aria-hidden>
                  {countdown}s
                </p>
              )}
              {/* Self-view so the tester can hold framing. playsInline is load-bearing on
                  iOS (without it Safari fullscreens the element). */}
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                className="mt-4 aspect-video w-full rounded-xl border border-border bg-ink/5 object-cover"
              />
            </div>
          )}

          {phase === "done" && (
            <div aria-live="polite">
              <p className="mt-3 text-base font-medium text-ink">{copy.head}</p>
              <p className="mt-1 text-sm text-muted">{copy.sub}</p>
              {fatal && (
                <p className="mt-3 rounded-lg border border-amber/40 bg-amber/10 p-3 text-sm text-amber-text">
                  The check stopped early ({fatal}). The partial report below is still
                  useful — please copy and send it anyway.
                </p>
              )}
              <Button
                variant="meadow"
                size="lg"
                className="mt-4 w-full"
                onClick={copyReport}
                disabled={!reportText}
              >
                {copied === "ok" ? "Copied — now paste it in a message" : "Copy the results"}
              </Button>
              {copied === "fail" && (
                <p className="mt-2 text-sm text-muted">
                  Copying didn&rsquo;t work — press and hold inside the box below, choose
                  Select All, then Copy.
                </p>
              )}
              <textarea
                readOnly
                value={reportText ?? ""}
                aria-label="Probe results"
                className="mt-4 h-48 w-full rounded-lg border border-control bg-bg p-3 font-mono text-xs text-ink"
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          Diagnostic page — not part of the Serenify product. Nothing leaves this phone.
        </p>
      </div>
    </main>
  );
}
