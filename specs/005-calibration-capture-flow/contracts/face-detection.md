# Contract: Client-Side Face Detection (`apps/web/lib/face-detect/`)

The on-device framing pipeline. **Privacy invariant (Principle I): nothing here
transmits, persists, or surfaces any frame or derived signal. All values are
ephemeral, in-memory, on the user's own device.** The detector is a UI utility,
not a stress-inference modality (the stress model stays server-side in
`packages/ml-video/`).

## 1. Detector loader — `detector.ts`

```ts
export type DetectorHandle = {
  detect(video: HTMLVideoElement, timestampMs: number): FaceBox | null;
  close(): void;
};

export type FaceBox = {
  // normalized [0,1] relative to the video frame
  cx: number; cy: number; w: number; h: number;
  score: number;
};

// Resolves to a handle, or null when the detector cannot run at all.
// MUST resolve within INIT_TIMEOUT_MS (never hang).
export async function createFaceDetector(opts?: {
  initTimeoutMs?: number; // default ~4500
  signal?: AbortSignal;
}): Promise<DetectorHandle | null>;
```

- Loads the **self-hosted** WASM runtime + BlazeFace short-range model from
  `/face-detect/*` (same-origin; `connect-src 'self'`).
- Capability probe (WebAssembly present) → init race against `initTimeoutMs` →
  on failure/timeout returns **`null`** (→ guide `unavailable`).
- `detect()` runs on a **downscaled** frame; returns the highest-scoring box or
  `null`.

## 2. Pure framing logic — `framing.ts`

```ts
export type FramingSignal = {
  facePresent: boolean;
  centreDistance: number; // 0 = dead-centre on the fixed target
  sizeRatio: number;      // box height / frame height
  brightness: number;     // 0..255, target-region mean luma (canvas, model-free)
  at: number;             // ms
};

export type GateVerdict = "ready" | "no-face" | "off-centre" | "too-dark";
export type DriftState  = "centred" | "ease-back" | "absent";

export function toFramingSignal(box: FaceBox | null, luma: number, at: number): FramingSignal;

// Soft gate (green room). Pure. Forgiving.
export function evaluateGate(s: FramingSignal, prev: GateDebounce): {
  verdict: GateVerdict; ready: boolean; next: GateDebounce;
};

// In-recording drift, grace-gated. Pure (fake-clock testable).
export function evaluateDrift(s: FramingSignal, prev: DriftDebounce): {
  drift: DriftState; next: DriftDebounce;
};
```

### Threshold table (named constants; forgiving; tunable in `/speckit-tasks`/smoke)

| Constant | Default | Meaning |
|---|---|---|
| `SCORE_MIN` | 0.5 | detection score to count a face present |
| `NO_FACE_FRAMES` | 3 | consecutive absent frames → "no face" |
| `CENTRE_MAX` | 0.18 | max normalized centre-distance to count as "centred" |
| `SIZE_MIN` / `SIZE_MAX` | 0.12 / 0.8 | box-height sanity band (advisory, not a hard block) |
| `LUMA_MIN` | 40 | target-region mean luma floor → "too dark" below |
| `SET_DEBOUNCE_MS` | ~500 | present+centred+lit must hold this long → enable "I'm ready" |
| `DRIFT_GRACE_MS` | ~2000 | off-target must persist this long → "ease back" / "we can't see you" |

- **Gate is forgiving**: only `no-face`, `off-centre` (beyond `CENTRE_MAX`), or
  `too-dark` (below `LUMA_MIN`) hold it; a user who looks fine clears it (FR-009).
- **Drift never trips on a wobble**: `DRIFT_GRACE_MS` is a continuous-off-target
  requirement; a brief stray resets the debounce (FR-018). The recording is
  **never** auto-stopped on drift/absence (FR-020).

## 3. Live loop hook — `use-framing-guide.ts`

```ts
export type GuideState = "loading" | "active" | "unavailable";

export function useFramingGuide(args: {
  video: HTMLVideoElement | null;
  phase: "green-room" | "recording";        // sets cadence (~6–8 vs ~3–4 fps)
  createDetector?: typeof createFaceDetector; // INJECTABLE SEAM for honest tests
  onSignal?: (s: FramingSignal) => void;      // telemetry sink (cause chip)
}): {
  guide: GuideState;
  gate: GateVerdict; ready: boolean;          // green-room
  drift: DriftState;                          // recording
};
```

- Drives `requestVideoFrameCallback` (fallback throttled `rAF`) at the phase
  cadence on a downscaled frame; computes luma from a small canvas.
- Lifecycle: `loading` → `active` (detector ready, first signal) or `unavailable`
  (R-3 determination). In `unavailable`, the green room bypasses the gate
  (`ready = true`) and shows "no live guide — you can still record" (FR-011).
- `createDetector` is **injectable** so tests feed synthetic boxes/signals into the
  real gate/drift logic without WASM (📌 DECISION-26).

## 4. CSP deltas required (📌 DECISION-20)

Added in `proxy.ts::buildCsp(nonce, pathname)`, **capture routes only**
(`/onboarding`, `/app/calibrate`):

- `script-src`: append `'wasm-unsafe-eval'` (composes with `'strict-dynamic'`).
- `worker-src`: add `'self' blob:` **iff** the runtime spins a blob worker (verify
  empirically; omit otherwise).
- `connect-src`: **no change** — assets are same-origin (`'self'`).
- COEP: **unset** (single-threaded WASM).

Rollout: report-only → Playwright `securitypolicyviolation` sweep → narrow →
enforce, **before** the detector's first call.
