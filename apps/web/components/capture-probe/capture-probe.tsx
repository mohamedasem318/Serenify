"use client";

/* Hallmark · component: diagnostic page · genre: editorial (inherited) · theme: project (Mist & Meadow)
 * states: idle · camera · constraints · recording · measuring · mp4-check · ladder · done · error
 * contrast: project tokens only (Button variants pre-audited)
 * pre-emit critique: P5 H4 E5 S5 R4 V4
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
 * Second, independent run — the **bitrate ladder** (`runLadder`, 2026-08-07): does this
 * engine honor `MediaRecorder`'s `videoBitsPerSecond`, and how low can the target go
 * before the video stops being usable for face landmark extraction? Seven steps at the
 * production container and operating point. It shares the camera/recorder helpers with
 * the capability run and nothing else; running one never changes the other.
 *
 * Privacy posture (binding): everything runs on-device. No fetch, no Supabase, no
 * storage — recorded bytes live in memory and are discarded when the tab closes.
 * The only outputs are a text report the tester copies and sends back themselves, and —
 * on the ladder run only — three short clips the tester hands to their own OS share
 * sheet. Nothing is transmitted by this page; the tester chooses what to send and to
 * whom. The text payload is device/API capability only: no identifiers. The clips do
 * contain the tester's face, which is why they are share-on-tap and never automatic.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { pickWindowMimeType, DEFAULT_STRIDE_MS } from "@/components/monitor/window-recorder";
import { CAPTURE_VIDEO_CONSTRAINTS, captureVideoConstraints } from "@/lib/capture/constraints";

import {
  bitrateLabel,
  makeClip,
  maxChunkGap,
  summarizeStep,
  voidReasonFor,
  LADDER_RECORD_MS,
  LADDER_TARGETS_BPS,
  LADDER_VERSION,
  RETAINED_TARGETS_BPS,
  type ChunkLog,
  type LadderStep,
  type RetainedClip,
  type TrackSettingsSummary,
} from "./ladder";

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
  | "ladder"
  | "done";

/** One track/document event with a wall-clock offset (ms since probe start). */
interface EventLog {
  t: number;
  event: string;
}

/** The report is a plain mutable bag accumulated across phases; every step that can
 *  fail writes its error in place so a partial run still yields a usable report. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Report = Record<string, any>;

function summarizeSettings(s: MediaTrackSettings | undefined): TrackSettingsSummary | null {
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
 *  default) and, optionally, an explicit `videoBitsPerSecond` target (undefined = the
 *  encoder's own default), logging every timeslice chunk. Resolves with the chunk log,
 *  the final blob, and the bitrate the recorder REFLECTS back — which is self-report,
 *  not evidence of honoring. */
function recordFor(
  stream: MediaStream,
  mimeType: string | undefined,
  durationMs: number,
  onProgress: (msLeft: number) => void,
  videoBitsPerSecond?: number,
): Promise<{
  requestedMime: string | null;
  reportedMime: string;
  reflectedVideoBitsPerSecond: number | null;
  chunks: ChunkLog[];
  blob: Blob | null;
  wallMs: number;
  recorderError: string | null;
}> {
  return new Promise((resolve, reject) => {
    let recorder: MediaRecorder;
    try {
      const options: MediaRecorderOptions = {};
      if (mimeType) options.mimeType = mimeType;
      if (videoBitsPerSecond != null) options.videoBitsPerSecond = videoBitsPerSecond;
      recorder = new MediaRecorder(stream, options);
    } catch (err) {
      reject(err);
      return;
    }
    // Read once at construction: some engines only populate this after `start()`, so it
    // is re-read on resolve and the non-null reading wins.
    let reflected: number | null =
      typeof recorder.videoBitsPerSecond === "number" ? recorder.videoBitsPerSecond : null;
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
      if (reflected == null && typeof recorder.videoBitsPerSecond === "number") {
        reflected = recorder.videoBitsPerSecond;
      }
      resolve({
        requestedMime: mimeType ?? null,
        reportedMime: recorder.mimeType || "(empty)",
        reflectedVideoBitsPerSecond: reflected,
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
  ladder: {
    head: "Recording",
    sub: "Keep this page open and your face roughly in view.",
  },
  done: { head: "All done", sub: "Copy the results below and send them back. Then you can close this page." },
};

/** Environment + static capability, identical for both runs (no permission needed). */
function collectStaticCapability(r: Report) {
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
  const pick = pickWindowMimeType();
  r.productionPick = pick.ok ? (pick.mimeType ?? "(browser default)") : `unsupported: ${pick.reason}`;
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
}

export function CaptureProbe() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [reportText, setReportText] = useState<string | null>(null);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  /** Overrides the phase heading during the ladder ("Recording 3 of 7"). */
  const [stepHead, setStepHead] = useState<string | null>(null);
  const [clips, setClips] = useState<RetainedClip[]>([]);
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
    collectStaticCapability(r);

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

  /**
   * Bitrate ladder — measurement only, nothing in the production path changes.
   *
   * One question: does this engine honor `MediaRecorder`'s `videoBitsPerSecond`, and if
   * so, how low can the target go before the video stops being usable for face landmark
   * extraction? iOS Safari records H.264 at ~5.4 Mbit/s where desktop Chrome VP9 sits at
   * ~0.75, and at that weight an iOS monitoring session lands under the 60 s scoring gate
   * and produces zero scored windows. `videoBitsPerSecond` has never been set anywhere in
   * this app, so the 5.4 figure is the encoder default and WebKit's response to an
   * explicit target is simply unmeasured.
   *
   * The bytes half is answered here, on-device. The QUALITY half is not — client-side
   * detection is not the server's FaceMesh — so three clips are retained for the real
   * pipeline to judge offline.
   *
   * Deliberately does NOT call `applyConstraints` anywhere: the camera is opened at the
   * production operating point and left alone. The capability run's mid-probe
   * `applyConstraints({})` reset is what silently recorded 480x640 once and produced a
   * wire-weight figure that had to be withdrawn.
   */
  const runLadder = useCallback(async () => {
    probeT0.current = performance.now();
    const r = report.current;
    r.probe = LADDER_VERSION;
    r.startedAt = new Date().toISOString();
    r.howToRead =
      "effectiveMbps (totalBytes*8 / mediaSeconds) is the honoring answer. " +
      "reflectedVideoBitsPerSecond is the recorder's own self-report and proves nothing. " +
      "Steps with void:true did not hold the production operating point — read their " +
      "numbers as absent, not as results.";
    collectStaticCapability(r);

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
      // ── Camera at the PRODUCTION operating point, set once at open ─────────
      setPhase("camera");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: captureVideoConstraints(),
          audio: false,
        });
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
      r.requestedConstraints = CAPTURE_VIDEO_CONSTRAINTS;
      r.grantedAtOpen = summarizeSettings(track.getSettings());
      track.addEventListener("mute", () => logEvent("track:mute"));
      track.addEventListener("unmute", () => logEvent("track:unmute"));
      track.addEventListener("ended", () => logEvent("track:ended"));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // Production's own container negotiation — fMP4 on Apple WebKit, webm elsewhere.
      const choice = pickWindowMimeType();
      if (!choice.ok) {
        throw new Error(`no usable recording container on this browser (${choice.reason})`);
      }

      // ── The ladder ────────────────────────────────────────────────────────
      setPhase("ladder");
      const steps: LadderStep[] = [];
      const retained: RetainedClip[] = [];
      // One-step lookback. The ladder descends, so the previous step is the next-higher
      // bitrate — the nearest stand-in if a retention target comes back void. Held only
      // until the following step resolves, which is what keeps peak memory bounded.
      let previous: { step: LadderStep; blob: Blob } | null = null;

      for (const [index, target] of LADDER_TARGETS_BPS.entries()) {
        setStepHead(`Recording ${index + 1} of ${LADDER_TARGETS_BPS.length}`);
        const label = bitrateLabel(target);
        const grantedBefore = summarizeSettings(track.getSettings());
        let step: LadderStep;
        let blob: Blob | null = null;

        try {
          const rec = await recordFor(
            stream,
            choice.mimeType,
            LADDER_RECORD_MS,
            (msLeft) => setCountdown(Math.ceil(msLeft / 1000)),
            target ?? undefined,
          );
          setCountdown(null);
          // Sampled AFTER the recording, not just before: a camera that downshifts
          // mid-capture is invisible to a single reading.
          const grantedAfter = summarizeSettings(track.getSettings());
          blob = rec.blob;
          const totalBytes = rec.chunks.reduce((a, c) => a + c.bytes, 0);
          const dur = rec.blob ? await measureBlobDuration(rec.blob) : null;
          const mediaSeconds = dur?.seconds != null ? +dur.seconds.toFixed(1) : null;
          const wallSeconds = +(rec.wallMs / 1000).toFixed(1);
          const voidReason =
            voidReasonFor(grantedBefore, grantedAfter) ??
            (rec.recorderError ? `recorder error: ${rec.recorderError}` : null) ??
            (mediaSeconds == null || mediaSeconds <= 0 ? "media duration unreadable" : null);

          step = {
            target: label,
            targetBps: target,
            reflectedVideoBitsPerSecond: rec.reflectedVideoBitsPerSecond,
            grantedBefore,
            grantedAfter,
            requestedMime: rec.requestedMime,
            reportedMime: rec.reportedMime,
            chunkCount: rec.chunks.length,
            chunks: rec.chunks,
            maxChunkGapMs: maxChunkGap(rec.chunks),
            totalBytes,
            wallSeconds,
            mediaSeconds,
            mediaToWallRatio:
              mediaSeconds != null && rec.wallMs > 0
                ? +(mediaSeconds / (rec.wallMs / 1000)).toFixed(3)
                : null,
            effectiveMbps:
              mediaSeconds != null && mediaSeconds > 0
                ? +((totalBytes * 8) / mediaSeconds / 1_000_000).toFixed(3)
                : null,
            recorderError: rec.recorderError,
            ...(dur?.error ? { durationError: dur.error } : {}),
            void: voidReason != null,
            ...(voidReason ? { voidReason } : {}),
          };
        } catch (err) {
          setCountdown(null);
          const e = err as Error;
          step = {
            target: label,
            targetBps: target,
            reflectedVideoBitsPerSecond: null,
            grantedBefore,
            grantedAfter: summarizeSettings(track.getSettings()),
            error: `${e.name}: ${e.message}`,
            void: true,
            voidReason: "recorder could not run this step",
          };
        }
        steps.push(step);

        // Retention, decided as we go so non-retained blobs are released immediately.
        if (RETAINED_TARGETS_BPS.includes(target)) {
          if (!step.void && blob) {
            retained.push(makeClip(step, blob, label));
          } else if (previous && !previous.step.void) {
            retained.push(makeClip(previous.step, previous.blob, label));
          }
        }
        previous = blob ? { step, blob } : null;
      }
      setStepHead(null);

      r.ladder = steps;
      r.ladderSummary = steps.map(summarizeStep);
      r.retentionTargets = RETAINED_TARGETS_BPS.map(bitrateLabel);
      r.retainedClips = retained.map((c) => ({
        label: c.label,
        fileName: c.fileName,
        bytes: c.file.size,
        substitutedFor: c.substitutedFor ?? null,
      }));
      setClips(retained);
    } catch (err) {
      r.fatal = (err as Error).message;
      setFatal((err as Error).message);
    } finally {
      setStepHead(null);
      setCountdown(null);
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

  /**
   * Hand one clip to the OS share sheet — the same posture as the text report: the
   * tester sends it themselves, out of band. No fetch, no API, nothing persisted.
   * Where Web Share can't take files (desktop Chrome, older engines) this falls back to
   * an ordinary download, which lands the file in Downloads under the same name.
   */
  const shareClip = useCallback(async (clip: RetainedClip) => {
    const payload = { files: [clip.file], title: clip.fileName };
    if (navigator.canShare?.(payload)) {
      try {
        await navigator.share(payload);
        return;
      } catch (err) {
        // Tester dismissed the sheet — not a failure, and not worth a fallback.
        if ((err as DOMException).name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(clip.file);
    const a = document.createElement("a");
    a.href = url;
    a.download = clip.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, []);

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

              <div className="mt-8 border-t border-border pt-6">
                <h2 className="font-display text-lg text-ink">Video quality check</h2>
                <p className="mt-2 text-base text-muted">
                  A second, separate check — only run this one if you were asked to. It takes
                  about four minutes and records seven short clips at different quality
                  settings.
                </p>
                <p className="mt-2 text-base text-muted">
                  This one keeps three short clips on your phone at the end, so you can send
                  them back. Nothing is uploaded — you choose what to send, and to whom.
                </p>
                <Button variant="secondary" size="lg" className="mt-4 w-full" onClick={runLadder}>
                  Start the quality check
                </Button>
              </div>
            </>
          )}

          {running && (
            <div aria-live="polite">
              <p className="mt-4 text-base font-medium text-ink">{stepHead ?? copy.head}</p>
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

              {clips.length > 0 && (
                <div className="mt-8 border-t border-border pt-6">
                  <h2 className="font-display text-lg text-ink">Now send the clips</h2>
                  <p className="mt-2 text-base text-muted">
                    There {clips.length === 1 ? "is one short clip" : `are ${clips.length} short clips`} to
                    send as well. Save each one, then send them all in one message.
                  </p>
                  <ol className="mt-4 space-y-4">
                    {clips.map((clip, i) => (
                      <li key={clip.fileName}>
                        <p className="text-sm text-muted">
                          Clip {i + 1} — {clip.label}
                          {clip.substitutedFor ? ` (stood in for ${clip.substitutedFor})` : ""}
                        </p>
                        <Button
                          variant="secondary"
                          size="lg"
                          className="mt-2 w-full"
                          onClick={() => shareClip(clip)}
                        >
                          Save clip {i + 1}
                        </Button>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-5 text-base text-muted">
                    Tap each button above and choose <strong className="text-ink">Save to Files</strong>.
                    Then open WhatsApp, tap the attach button, choose{" "}
                    <strong className="text-ink">Document</strong>, and pick the saved clips.
                  </p>
                  <p className="mt-3 rounded-lg border border-amber/40 bg-amber/10 p-3 text-sm text-amber-text">
                    Please don&rsquo;t send them as videos or photos. WhatsApp shrinks those, and a
                    shrunk clip is useless for this test.
                  </p>
                </div>
              )}
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
