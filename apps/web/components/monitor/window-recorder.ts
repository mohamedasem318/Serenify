/**
 * Continuous window recorder (feature 008, US1 — T026; research R-5 / windowing D-2).
 *
 * ONE `MediaRecorder` runs in timeslice mode for the whole session — **no stop/restart**.
 * Each stride it hands the orchestrator the **contiguous recording-so-far**: the init
 * segment + every chunk in order, which is always decodable (the server tail-extracts the
 * last 60 s). Upload is **fire-and-forget / non-blocking** (FR-016) — the recorder keeps
 * capturing on its own timer regardless of how long a window takes to score, so a slow
 * window never stalls the next capture.
 *
 * Container: **feature-detect, webm-preferred with an fMP4 fallback** (the device-gate
 * finding — both decode server-side; iOS WebM-capture support is uneven). We never
 * hard-code one container (see docs/BACKLOG.md 008 T026 note).
 */

/** ~10 s stride (contracts/inference-api.md: "called ~every 10 s"). */
export const DEFAULT_STRIDE_MS = 10_000;

/** Codec probe order: webm first (vp9 → vp8 → generic), then fragmented MP4 (Safari/iOS). */
const MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
] as const;

/** Pick a supported recorder MIME type — webm-preferred, fMP4 fallback. `undefined` lets
 *  the browser choose its default (still always one decodable continuous file). */
export function pickWindowMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const type of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return undefined;
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
  /** Invoked each stride with the contiguous recording-so-far. Fire-and-forget. */
  onWindow: (clip: Blob) => void;
  strideMs?: number;
  /** Test seam: build the recorder. Production uses a real `MediaRecorder`. */
  createRecorder?: (stream: MediaStream) => MinimalWindowRecorder;
}

export interface WindowRecorderHandle {
  start(): void;
  stop(): void;
}

function defaultCreateRecorder(stream: MediaStream): MinimalWindowRecorder {
  const mimeType = pickWindowMimeType();
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
  return recorder as unknown as MinimalWindowRecorder;
}

/**
 * Build a continuous recorder. `start()` opens one timeslice recording and, on every
 * `ondataavailable`, appends the chunk and hands `onWindow` the contiguous-so-far blob.
 * `stop()` ends the single recording (no restart) and detaches handlers.
 */
export function createWindowRecorder({
  stream,
  onWindow,
  strideMs = DEFAULT_STRIDE_MS,
  createRecorder = defaultCreateRecorder,
}: WindowRecorderOptions): WindowRecorderHandle {
  let recorder: MinimalWindowRecorder | null = null;
  const chunks: Blob[] = [];

  return {
    start() {
      if (recorder && recorder.state !== "inactive") return; // guard double-start
      recorder = createRecorder(stream);
      chunks.length = 0;
      const rec = recorder;
      rec.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
        if (chunks.length === 0) return;
        // The contiguous recording-so-far: init + all chunks in order → always decodable.
        const type = rec.mimeType || "video/webm";
        // Fire-and-forget: hand it off and return immediately (FR-016, non-blocking).
        onWindow(new Blob(chunks, { type }));
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
