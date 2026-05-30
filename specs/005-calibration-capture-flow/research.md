# Phase 0 Research: Calibration Capture Flow

This resolves the engineering unknowns the spec deferred to planning: the
**client-side face detector** (choice, hosting, performance, fallback, output
mapping), the **browser-policy work** (CSP/permissions), the **recalibrate data
semantics**, the **account capture-date question**, and the **honest-test**
approach. Everything experiential/visual is already settled in `spec.md` and is
not re-litigated here.

Format per decision: **Decision → Rationale → Alternatives considered**.

---

## R-1. Client-side face detector: choice & hosting (📌 DECISION-19)

**Decision.** Use **MediaPipe Tasks Vision `FaceDetector`** (the BlazeFace
short-range model), **self-hosted**: the WASM runtime (`vision_wasm_internal.*`)
and the model file (`blaze_face_short_range.tflite`) are committed under
`apps/web/public/face-detect/` and served same-origin. Load it **lazily and only
on the capture routes**. Use a *detector* (bounding box + score), not a landmark
mesh. Compute **brightness independently** from a downscaled `<canvas>` luma read,
not from the model.

**Rationale.**
- The spec only needs **face presence + bounding-box position/size** (for
  centredness and "no face") and **rough brightness** (for "too dark"). A
  bounding-box detector is the lightest artifact that supplies the first; luma
  from a canvas supplies the second without any model and keeps working even when
  the detector is `unavailable`.
- **Self-hosting** satisfies the brief's hard constraint that runtime assets load
  from a CSP-allowed origin: same-origin assets are covered by the existing
  `connect-src 'self'`, so **no new `connect-src` host** is required and no
  third-party CDN is trusted. It also removes a remote single-point-of-failure on
  a flow that must degrade gracefully.
- BlazeFace short-range is small and fast (designed for selfie-distance faces on
  the web), a good fit for a centred portrait at ~arm's length on a laptop/phone.
- MediaPipe Tasks Vision is the maintained successor to the legacy
  `@mediapipe/face_detection` solution and exposes a clean
  `FaceDetector.detectForVideo(video, timestamp)` API suited to a throttled loop.

**Alternatives considered.**
- **Native `FaceDetector` (Shape Detection API)** — zero WASM, zero CSP delta,
  but **not cross-browser** (absent/unshipped in Firefox and Safari, historically
  flag-gated in Chromium). Cannot be the primary; not worth a second code path in
  005. Could be a future progressive-enhancement fast path.
- **TF.js BlazeFace / `@tensorflow-models/face-detection`** — heavier runtime
  (TF.js core + WebGL/WASM backend), larger bundle, more moving parts; no benefit
  over MediaPipe Tasks for a single bounding box.
- **MediaPipe `FaceLandmarker` (468 mesh)** — far more compute than needed; we do
  not need landmarks for centredness/presence. Rejected on the performance budget.
- **Third-party CDN hosting of the model/wasm** — would add a cross-origin
  `connect-src`/`script-src` entry and a remote dependency on a flow that must
  fail soft. Rejected; self-host.

---

## R-2. Performance budget & throttling (📌 DECISION-19)

**Decision.** Run inference on a **downscaled frame (~192–256 px on the long
edge)** at a **throttled cadence** — ~6–8 fps in the green room, **~3–4 fps during
the recording** — driven by `requestVideoFrameCallback` where available, else a
throttled `requestAnimationFrame`. Keep a per-frame budget of < ~40 ms on a mid
laptop. Provide an **OffscreenCanvas + Web Worker** path as a hedge if main-thread
jank is observed on weak devices (this is the case that may add `worker-src
blob:`; see R-4).

**Rationale.**
- The 60-second recording is the accuracy-critical window; the detector is an
  *ambient* aid there, so a low cadence (~3–4 fps) is plenty to drive a calm,
  grace-gated drift nudge while leaving CPU/GPU headroom for `MediaRecorder`
  encoding (Risk R-3). The green room can afford a higher cadence for a responsive
  "you're set".
- Downscaling before inference is the single biggest perf lever and is lossless
  for a coarse bounding box.
- `requestVideoFrameCallback` aligns work to actual decoded frames and avoids
  spinning when the tab is backgrounded.

**Alternatives considered.** Full-frame inference every animation frame (rejected:
needless heat/jank, competes with recording). A fixed `setInterval` decoupled from
frame production (acceptable fallback, but rVFC is cleaner where supported).

---

## R-3. Determining "the detector cannot run at all" (📌 DECISION-19, FR-011)

**Decision.** Resolve the guide to one of `loading | active | unavailable`
**deterministically**:
1. **Capability probe** at mount — `typeof WebAssembly !== "undefined"` and the
   Tasks resolver/`createFromOptions` is reachable.
2. **Hard init timeout** — race detector initialization against a ~4–5 s timeout;
   on timeout → `unavailable`.
3. **First-frames latency check** — measure the first few inferences; if the
   median exceeds the budget (e.g., > ~60 ms) → degrade to `unavailable` (or drop
   to the lowest cadence, then `unavailable` if still too slow).
Any of these → the green-room **fallback**: "no live guide — you can still record",
the soft gate **bypassed**, "I'm ready" available. The detector **never** leaves
the user stranded in `loading`.

**Rationale.** The spec's "never lock the user out" guarantee (FR-010c/FR-011) is
load-bearing; a feature that *might not load* must fail to a usable state on a
bounded clock, not hang. A timeout + latency check makes the fallback engage
deterministically rather than depending on a model that quietly never resolves.

**Alternatives considered.** Waiting indefinitely for init (rejected: hangs weak
devices). Feature-detecting only WASM presence without a latency check (rejected:
WASM can be present but pathologically slow on a weak device — the latency check
catches that).

---

## R-4. Browser policy: CSP & permissions (📌 DECISION-20)

**Decision.** Extend `proxy.ts::buildCsp` to `buildCsp(nonce, pathname)` and add,
**only on the capture routes** (`/onboarding`, `/app/calibrate`):
- `script-src … 'wasm-unsafe-eval'` (MediaPipe compiles the WASM module; the
  keyword composes with the existing `'strict-dynamic'` and `'nonce-…'`), and
- `worker-src 'self' blob:` **iff** the runtime creates a blob-URL worker
  (verify empirically; omit otherwise).

Self-hosted assets are same-origin (`connect-src 'self'` already present — no new
host). **COEP stays unset.** Roll out with the repo's established method: ship the
delta **report-only**, drive the capture routes under Playwright capturing
`securitypolicyviolation`, narrow to the minimal allowance, then **enforce** — and
land it **before** the detector's first call (Risk R-2). The per-route camera
`Permissions-Policy` (`camera=(self)` on `/onboarding` + `/app/calibrate`) in
`next.config.ts` is **already correct** and unchanged; `/app/account` correctly
stays `camera=()` because recalibration enters the camera only after a full
navigation to `/app/calibrate`.

**Rationale.**
- WASM instantiation/compilation is blocked by a strict `script-src` without
  `'wasm-unsafe-eval'`; this is the known, minimal keyword for MediaPipe.
- **Scoping** the allowance to capture routes keeps the rest of the app at today's
  stricter policy (the CSP is already built per-request, so `pathname` scoping is
  natural and mirrors DECISION-16's per-route philosophy).
- **COEP unset**: BlazeFace short-range runs fine single-threaded; enabling
  cross-origin isolation (COOP+COEP) for WASM threads/SIMD would cascade into
  every cross-origin asset and is unjustified here.
- The **report-only→enforce** method is exactly how slice-5 resolved the Zod-JIT
  finding (`proxy.ts` comment) — empirical, low-risk, and already trusted in this
  repo.

**Alternatives considered.** A global (all-routes) `'wasm-unsafe-eval'` (rejected:
needlessly weakens `script-src` everywhere). Enabling COEP for threaded WASM
(rejected: cross-origin-isolation blast radius; not needed). `'unsafe-eval'`
(rejected: broader than `'wasm-unsafe-eval'`).

---

## R-5. Output → framing-signal → states mapping (📌 DECISION-19)

**Decision.** A pure module `lib/face-detect/framing.ts` maps detector output +
luma into a `FramingSignal` and then into gate/drift verdicts, with **forgiving,
tunable** thresholds in one place (see `contracts/face-detection.md` for the
table). Working defaults:

| Signal | Default | Drives |
|---|---|---|
| presence | detection score ≥ ~0.5 | no-face vs present |
| no-face debounce | absent ≥ K≈3 frames | "no face" gate hold / "we can't see you" |
| centredness | box centre within ~0.18 of normalized frame centre | "badly off-centre" gate hold / drift |
| size sanity | box covers ~0.12–0.8 of frame height | sanity only (not a hard block) |
| brightness | target-region mean luma ≥ ~40/255 | "too dark" gate hold |
| "you're set" debounce | present+centred+lit held ~400–600 ms | enables "I'm ready" |
| drift grace window | off-target continuous ≥ ~2 s (tunable) | "ease back to centre" / "we can't see you" |

All thresholds are deliberately forgiving (FR-009: do not block users who look
fine to themselves) and live as named constants for tuning during
`/speckit-tasks`/smoke.

**Rationale.** Centring on a *fixed target* (not a face-hugging box) means the
check is "is the face inside/near the fixed portrait target", a simple
centre-distance + size test. The grace window is the explicit mechanism that makes
"a momentary wobble must never trip it" (FR-018) true; implementing it as a pure
timestamped debounce makes it unit-testable with a fake clock.

**Alternatives considered.** Tight/clinical thresholds (rejected: the spec forbids
blocking fine-looking users). A face-tracking box that hugs the face (rejected:
the spec mandates a fixed target). Per-frame nudging with no grace (rejected:
FR-018).

---

## R-6. Adaptive failure cause chip (📌 DECISION-24)

**Decision.** Drive the post-recording cause chip primarily from **client detector
telemetry** accumulated over the 60-second recording — the dominant adverse
signal: mostly-dark → **low light**; mostly off-centre/absent → **out of frame**;
no clear signal / detector was `unavailable` / backend `bad_vector` → **our side**.
The 004 backend 422 `reason` (`no_face`/`roi_empty`/`bad_vector`) is a **secondary**
input; the backend is unchanged.

**Rationale.** The client detector actually *observed* the recording, so it knows
far more about *why* than the coarse backend reason — and crucially it lets us
**own "our side"** honestly (FR-028): when we have no measured user-side cause we
do not invent one. The chip becomes genuinely adaptive without any backend change.

**Alternatives considered.** Mapping the backend `reason` alone (rejected:
`no_face` is ambiguous between dark and off-frame, and a `bad_vector` is ours, not
the user's). Adding a richer backend diagnostic (rejected: needless backend change;
the client already has the signal).

---

## R-7. Recalibration data semantics (📌 DECISION-22)

**Decision.** Recalibration **overwrites the single stored baseline in place, on
success only**, via the existing owner UPDATE path; stop/fail/defer leave the prior
baseline untouched; **no baseline history**, **no migration**. Entry is
`?mode=recalibrate` on `/app/calibrate`, which suppresses the ST-17
`has_anchor`→`/app` redirect for that mode and routes exits to `/app/account`.

**Rationale.** The client already writes the anchor columns only after a successful
extraction, so "untouched on abort/fail" is the natural consequence — the only new
work is the **mode-conditioned redirect suppression** and the **exit routing/copy**.
No history is wanted (the spec: "the new one replaces the old in place"), so no new
table. The DECISION-12 UPDATE whitelist already permits the owner to overwrite
their anchor columns.

**Alternatives considered.** A baseline-history/audit table (rejected: spec says no
history; adds RLS surface). A separate recalibrate route (rejected: the spec
mandates reusing the same flow; a query-param mode is the smallest seam). Removing
the ST-17 redirect entirely (rejected: it is load-bearing for the first-time
cross-tab/idempotency story; only recalibrate mode may suppress it).

---

## R-8. Account capture-date question (📌 DECISION-23)

**Decision.** **Keep whether-set-only** (the spec default, FR-041). 005 does **not**
surface the capture date and adds **no** self-scoped date read.

**Rationale.** DECISION-12 deliberately hid the date from all reads (including the
owner's direct read) to deny managers a calibration-timing pressure signal;
surfacing even the owner's own date requires a new SECURITY DEFINER function — a DB
surface this UX redesign does not need. The account section communicates state
("set" / "not set yet") and offers "Set a new baseline"; the date adds little and
the recalibrate flow does not consume it. A self-scoped
`get_my_anchor_captured_at()` is a clean future addition when feature 006's
inference read path lands and likely needs a self-scoped read anyway.

**Alternatives considered.** Add a self-scoped SECURITY DEFINER date read now
(rejected: new DB surface for a cosmetic gain; YAGNI until 006). Read the column
directly (rejected: DECISION-12 makes it unreadable by any client role, by design).

---

## R-9. Honest-test strategy (📌 DECISION-26)

**Decision.** Test by **injecting inputs at the boundary** and running the real
logic; never mock the unit under test. Concretely: the detector is an injectable
interface so tests feed synthetic `FramingSignal` streams into the *real* gate +
grace-window reducer (fake clock); `getUserMedia` is driven to reject with each
real `error.name` to assert the *real* three-state mapping; the pure reducer is
tested directly (stop→green-room, mode exits, escape threshold); the orchestrator
takes injectable `getUserMedia`/`MediaRecorder`/`postAnchor`/Supabase-client deps so
the recalibrate **overwrite-on-success-only** is asserted by checking `update()`
fires only on success; the banner lifecycle + cross-tab mirror run the real
`sessionStorage`/storage-event logic. CI-impossible checks (real permission prompt,
real WASM on a real weak device, real cross-browser `MediaRecorder`) are listed in
`smoke-tests.md` and **flagged as deferred**, not mocked green.

**Rationale.** 004's e2e mocked `MediaRecorder` *and* the FastAPI call and let real
defects pass as green; the spec (FR-051) explicitly demands the opposite. The line
that keeps tests honest: mock only the **unavoidable external I/O** (camera, codec,
network), never the **behaviour being verified** (the gate math, the error mapping,
the reducer, the write-gating).

**Alternatives considered.** Recording real video in CI (rejected: slow,
nondeterministic, privacy-fraught). Mocking the gate/reducer outputs (rejected:
that is exactly the mock-masking the spec forbids).

---

## Resolved unknowns summary

| Unknown (from spec/brief) | Resolution |
|---|---|
| Detector choice & hosting | Self-hosted MediaPipe Tasks `FaceDetector` (BlazeFace short-range) + canvas luma (R-1) |
| Performance on weak laptops + throttling | Downscaled frames, ~6–8 fps green room / ~3–4 fps recording, rVFC, worker hedge (R-2) |
| "Detector cannot run at all" determination | Capability probe + hard init timeout + first-frames latency → deterministic `unavailable` (R-3) |
| CSP / permissions deltas | Scoped `'wasm-unsafe-eval'` (+ `worker-src blob:` if needed) on capture routes, report-only→enforce, before first call; COEP unset; camera PP already correct (R-4) |
| Detector output → gate/drift mapping | Pure `framing.ts`, forgiving tunable thresholds, ~2 s grace window (R-5) |
| Cause chip adaptivity | Client-telemetry-first, our-side default (R-6) |
| Recalibrate semantics | Overwrite-on-success-only, `?mode=recalibrate`, no history, no migration (R-7) |
| Account capture date | Whether-set-only; no date read in 005 (R-8) |
| Honest tests | Boundary injection, never mock the unit; enumerate smoke deferrals (R-9) |
