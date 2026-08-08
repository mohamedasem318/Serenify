/**
 * Continuous window recorder (feature 008, US1 — T026; research R-5 / windowing D-2).
 *
 * ONE `MediaRecorder` runs in timeslice mode for the whole session — **no stop/restart**.
 * Each stride it hands the orchestrator an upload for the trailing window: **header + a
 * bounded contiguous tail** cut at a verified container boundary once the recording is
 * old enough (2026-08-06 bounded-upload fix — per-stride payload flat w.r.t. session
 * length; see `tail-cutter.ts`), and the contiguous recording-so-far before that (or
 * whenever no safe cut exists — always-correct fallback). Upload is **fire-and-forget /
 * non-blocking** (FR-016) — the recorder keeps capturing on its own timer regardless of
 * how long a window takes to score, so a slow window never stalls the next capture.
 *
 * Container: **feature-detect via the shared engine-aware negotiation** (lib/capture/
 * constraints.ts): webm-preferred on non-Apple engines, fMP4-ONLY on Apple WebKit —
 * Safari's webm *claim* routed iOS into the #89 un-finalized-webm decode death, while
 * its fMP4 chunks on schedule (2026-08-05 probes). We still never hard-code one
 * container (docs/BACKLOG.md 008 T026 note); the preference order is what changed.
 */

import {
  captureRecorderOptions,
  pickCaptureMimeType,
  type CaptureMimeChoice,
} from "@/lib/capture/constraints";

import { createTailSource, type UploadKind } from "./tail-cutter";

export type { UploadKind } from "./tail-cutter";

/** ~10 s stride (contracts/inference-api.md: "called ~every 10 s"). */
export const DEFAULT_STRIDE_MS = 10_000;

/** Pick the recorder MIME type. Delegates to the SHARED capture negotiation (lib/capture/
 *  constraints.ts) — webm-preferred on non-Apple engines, fMP4-only on Apple WebKit
 *  (whose webm claim routes into the #89 decode death). Calibration uses the same picker;
 *  the two recorders must never diverge on container — scoring is `window − anchor`. */
export function pickWindowMimeType(): CaptureMimeChoice {
  return pickCaptureMimeType();
}

/** Webcam capture requires a secure context (HTTPS or localhost). */
export function isSecureContextOk(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext === true;
}

/**
 * The minimal recorder surface the controller drives — injectable so tests run the REAL
 * stride/accumulation logic against a fake (happy-dom ships no MediaRecorder), mirroring
 * the calibration recorder's DECISION-26 seam.
 */
export interface MinimalWindowRecorder {
  start(timesliceMs: number): void;
  stop(): void;
  state: string;
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
}

export interface WindowRecorderOptions {
  stream: MediaStream;
  /** Invoked each stride with this stride's upload: a bounded header+tail (`"tail"`) once
   *  a safe cut exists, the contiguous recording-so-far (`"full"`) before/without one.
   *  Fire-and-forget. */
  onWindow: (clip: Blob, kind: UploadKind) => void;
  strideMs?: number;
  /** Test seam: build the recorder. Production uses a real `MediaRecorder`. */
  createRecorder?: (stream: MediaStream) => MinimalWindowRecorder;
}

export interface WindowRecorderHandle {
  start(): void;
  stop(): void;
}

function defaultCreateRecorder(stream: MediaStream): MinimalWindowRecorder {
  const choice = pickWindowMimeType();
  // Belt-and-braces: the session gates on this BEFORE opening the camera, so reaching
  // here with an unusable engine means the guard was bypassed. Throw rather than record
  // a container we know produces nothing (Apple WebKit + no MP4 — see constraints.ts).
  if (!choice.ok) throw new Error("No supported recording container on this browser");
  // Container AND bitrate target both come from the shared picker — calibration uses the
  // same one, and neither may diverge (scoring is `window − anchor`).
  const options = captureRecorderOptions(choice.mimeType);
  const recorder = options
    ? new MediaRecorder(stream, options)
    : new MediaRecorder(stream);
  return recorder as unknown as MinimalWindowRecorder;
}

/**
 * Build a continuous recorder. `start()` opens one timeslice recording and, on every
 * `ondataavailable`, appends the chunk to the tail source and hands `onWindow` this
 * stride's upload (header+tail once a safe cut exists — bounded payload AND bounded
 * client memory; the whole recording is no longer retained). `stop()` ends the single
 * recording (no restart) and detaches handlers.
 *
 * Chunk bytes are read asynchronously (`Blob.arrayBuffer()`), so appends+builds are
 * serialized on one promise chain — byte order is the recorder's emit order, and a slow
 * stride can never interleave with the next. Still fire-and-forget toward the uploader.
 */
export function createWindowRecorder({
  stream,
  onWindow,
  strideMs = DEFAULT_STRIDE_MS,
  createRecorder = defaultCreateRecorder,
}: WindowRecorderOptions): WindowRecorderHandle {
  let recorder: MinimalWindowRecorder | null = null;

  return {
    start() {
      if (recorder && recorder.state !== "inactive") return; // guard double-start
      recorder = createRecorder(stream);
      const source = createTailSource();
      let chain: Promise<void> = Promise.resolve();
      const rec = recorder;
      rec.ondataavailable = (event) => {
        const data = event.data && event.data.size > 0 ? event.data : null;
        chain = chain
          .then(async () => {
            if (rec.ondataavailable === null) return; // stopped while queued
            if (data) source.append(await data.arrayBuffer());
            if (!source.hasBytes()) return;
            const { blob, kind } = source.build(rec.mimeType || "video/webm");
            // Fire-and-forget: hand it off and return immediately (FR-016, non-blocking).
            onWindow(blob, kind);
          })
          .catch(() => {
            // A failed chunk read skips this stride's upload; capture itself continues
            // and the next stride retries with the next chunk. Never break the chain.
          });
      };
      // One continuous recording; a chunk flushes every stride (no stop/restart).
      rec.start(strideMs);
    },
    stop() {
      const rec = recorder;
      recorder = null;
      if (!rec) return;
      rec.ondataavailable = null;
      rec.onstop = null;
      if (rec.state !== "inactive") rec.stop();
    },
  };
}
