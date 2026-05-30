"use client";

/**
 * On-device face detector loader (feature 005, 📌 DECISION-19). Lazily loads the
 * self-hosted MediaPipe Tasks-Vision FaceDetector (BlazeFace short-range) and
 * exposes a tiny `detect()` that returns a NORMALIZED bounding box. Used only on
 * the capture routes.
 *
 * Privacy (Principle I): runs entirely in the browser on the user's own stream;
 * transmits nothing. The self-hosted wasm + model are same-origin.
 *
 * Resilience (FR-011): a capability probe + a HARD init timeout mean this resolves
 * to `null` (→ "no live guide — you can still record") rather than hanging. The
 * heavy `@mediapipe/tasks-vision` module is dynamically imported so it is
 * code-split and never evaluated on the server or off the capture routes.
 */

import type { FaceBox } from "./framing";

const WASM_PATH = "/face-detect/wasm";
const MODEL_PATH = "/face-detect/blaze_face_short_range.tflite";
const DEFAULT_INIT_TIMEOUT_MS = 4500;

export interface DetectorHandle {
  /** Returns the highest-confidence normalized face box, or null. Never throws. */
  detect(video: HTMLVideoElement, timestampMs: number): FaceBox | null;
  close(): void;
}

export interface CreateDetectorOptions {
  initTimeoutMs?: number;
  signal?: AbortSignal;
}

function rejectAfter(ms: number, signal?: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("detector-init-timeout")), ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("detector-init-aborted"));
      },
      { once: true },
    );
  });
}

// `unknown`-typed handle: the MediaPipe types are only available after the dynamic
// import, and we keep this module type-light so it does not pull the SDK into the
// type graph eagerly. The shape we rely on is `detectForVideo` + `close`.
interface MpDetector {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): {
    detections?: Array<{
      boundingBox?: { originX: number; originY: number; width: number; height: number };
      categories?: Array<{ score: number }>;
    }>;
  };
  close(): void;
}

async function createUnderlying(): Promise<MpDetector> {
  const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  const make = (delegate: "GPU" | "CPU") =>
    FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
    }) as unknown as Promise<MpDetector>;
  try {
    return await make("GPU");
  } catch {
    // GPU delegate can fail on some machines; CPU is the robust fallback before
    // we give up entirely (→ null → "no live guide").
    return await make("CPU");
  }
}

function wrap(detector: MpDetector): DetectorHandle {
  let closed = false;
  return {
    detect(video, timestampMs) {
      if (closed || !video.videoWidth || !video.videoHeight) return null;
      let result;
      try {
        result = detector.detectForVideo(video, timestampMs);
      } catch {
        return null;
      }
      const det = result.detections?.[0];
      const bb = det?.boundingBox;
      if (!bb) return null;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      return {
        cx: (bb.originX + bb.width / 2) / vw,
        cy: (bb.originY + bb.height / 2) / vh,
        w: bb.width / vw,
        h: bb.height / vh,
        score: det?.categories?.[0]?.score ?? 0,
      };
    },
    close() {
      closed = true;
      try {
        detector.close();
      } catch {
        /* already torn down */
      }
    },
  };
}

/**
 * Resolve a detector handle, or `null` when the detector cannot run at all
 * (no WASM, init failure, or the hard timeout fires). MUST resolve — never hangs.
 */
export async function createFaceDetector(
  opts: CreateDetectorOptions = {},
): Promise<DetectorHandle | null> {
  if (typeof window === "undefined" || typeof WebAssembly === "undefined") return null;
  const initTimeoutMs = opts.initTimeoutMs ?? DEFAULT_INIT_TIMEOUT_MS;
  try {
    const detector = await Promise.race([createUnderlying(), rejectAfter(initTimeoutMs, opts.signal)]);
    return wrap(detector);
  } catch {
    return null; // timeout / init failure / unsupported → the calm fallback (FR-011)
  }
}
