"use client";

import { useEffect, useRef, useState } from "react";

import {
  createFaceDetector as defaultCreateDetector,
  type CreateDetectorOptions,
  type DetectorHandle,
} from "./detector";
import {
  evaluateDrift,
  evaluateGate,
  initialDriftDebounce,
  initialGateDebounce,
  toFramingSignal,
  type DriftState,
  type FramingSignal,
  type GateVerdict,
} from "./framing";

/**
 * Live framing guide (feature 005, 📌 DECISION-19). Ties a `<video>` element to the
 * on-device detector via a THROTTLED loop, runs each frame through the pure framing
 * logic, and exposes the three guide states + the gate/drift outputs.
 *
 * - `loading` → `active` (detector ready) or `unavailable` (cannot run → gate
 *   bypassed, "I'm ready" available; the user is never locked out — FR-011).
 * - cadence: ~7 fps in the green room, ~3.5 fps during recording, so detection
 *   does not compete with MediaRecorder encoding (FR-015, Risk R-3).
 * - `createDetector` is INJECTABLE so tests drive a fake detector through the REAL
 *   gate/drift logic (📌 DECISION-26). Nothing here transmits a frame (Principle I).
 */

export type GuideState = "loading" | "active" | "unavailable";

const CADENCE_MS: Record<"green-room" | "recording", number> = {
  "green-room": 140,
  recording: 285,
};
const LUMA_SAMPLE = 64;

type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number) => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

/** Mean luma (0..255) of the centred portrait-target region; resilient to no-canvas. */
function readLuma(video: HTMLVideoElement, canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !video.videoWidth) return 255; // can't sample → never claim "too dark"
  try {
    ctx.drawImage(video, 0, 0, LUMA_SAMPLE, LUMA_SAMPLE);
    const q = LUMA_SAMPLE / 4;
    const { data } = ctx.getImageData(q, q, LUMA_SAMPLE / 2, LUMA_SAMPLE / 2);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0);
    }
    const pixels = data.length / 4;
    return pixels > 0 ? sum / pixels : 255;
  } catch {
    return 255;
  }
}

export interface UseFramingGuideArgs {
  video: HTMLVideoElement | null;
  phase: "green-room" | "recording";
  /** Injectable seam for honest tests (📌 DECISION-26). Defaults to the real loader. */
  createDetector?: (opts?: CreateDetectorOptions) => Promise<DetectorHandle | null>;
  onSignal?: (signal: FramingSignal) => void;
}

export interface FramingGuide {
  guide: GuideState;
  gate: GateVerdict;
  ready: boolean;
  drift: DriftState;
}

export function useFramingGuide({
  video,
  phase,
  createDetector,
  onSignal,
}: UseFramingGuideArgs): FramingGuide {
  const [guide, setGuide] = useState<GuideState>("loading");
  const [gate, setGate] = useState<GateVerdict>("no-face");
  const [ready, setReady] = useState(false);
  const [drift, setDrift] = useState<DriftState>("centred");

  // Keep callback + phase in refs so the loop effect does not restart each render;
  // the throttled loop reads them asynchronously, so syncing after commit is enough.
  const onSignalRef = useRef(onSignal);
  const phaseRef = useRef(phase);
  useEffect(() => {
    onSignalRef.current = onSignal;
    phaseRef.current = phase;
  });

  useEffect(() => {
    if (!video) return;
    const make = createDetector ?? defaultCreateDetector;
    const controller = new AbortController();
    const canvas = document.createElement("canvas");
    canvas.width = LUMA_SAMPLE;
    canvas.height = LUMA_SAMPLE;
    const rvfcVideo = video as VideoWithRvfc;

    let handle: DetectorHandle | null = null;
    let cancelled = false;
    let raf = 0;
    let rvfcId = 0;
    let usingRvfc = false;
    let lastRun = 0;
    let gateDeb = initialGateDebounce;
    let driftDeb = initialDriftDebounce;

    // Deliberate reset to `loading` whenever the source <video> or detector
    // changes, until the (re)initialised detector resolves — runs once per effect
    // setup, not in a render loop.
    /* eslint-disable react-hooks/set-state-in-effect */
    setGuide("loading");
    setReady(false);
    /* eslint-enable react-hooks/set-state-in-effect */

    function schedule() {
      if (cancelled) return;
      if (usingRvfc && rvfcVideo.requestVideoFrameCallback) {
        rvfcId = rvfcVideo.requestVideoFrameCallback((now) => processFrame(now));
      } else {
        raf = requestAnimationFrame((now) => processFrame(now));
      }
    }

    function processFrame(now: number) {
      if (cancelled || !handle || !video) return;
      if (now - lastRun >= CADENCE_MS[phaseRef.current]) {
        lastRun = now;
        const box = handle.detect(video, now);
        const signal = toFramingSignal(box, readLuma(video, canvas), now);
        onSignalRef.current?.(signal);
        if (phaseRef.current === "green-room") {
          const result = evaluateGate(signal, gateDeb);
          gateDeb = result.next;
          setGate(result.verdict);
          setReady(result.ready);
        } else {
          const result = evaluateDrift(signal, driftDeb);
          driftDeb = result.next;
          setDrift(result.drift);
        }
      }
      schedule();
    }

    void make({ signal: controller.signal }).then((resolved) => {
      if (cancelled) {
        resolved?.close();
        return;
      }
      if (!resolved) {
        // Detector cannot run at all → calm fallback, gate bypassed (FR-011).
        setGuide("unavailable");
        setGate("ready");
        setReady(true);
        setDrift("centred");
        return;
      }
      handle = resolved;
      usingRvfc = typeof rvfcVideo.requestVideoFrameCallback === "function";
      setGuide("active");
      schedule();
    });

    return () => {
      cancelled = true;
      controller.abort();
      if (raf) cancelAnimationFrame(raf);
      if (rvfcId && rvfcVideo.cancelVideoFrameCallback) rvfcVideo.cancelVideoFrameCallback(rvfcId);
      handle?.close();
    };
    // phase + onSignal are intentionally excluded — they are read through refs
    // (synced in a separate effect) so the loop does not tear down when the
    // recorder moves green-room → recording.
  }, [video, createDetector]);

  return { guide, gate, ready, drift };
}
