# Implementation Plan: Calibration Capture Flow

**Branch**: `005-calibration-capture-flow` | **Date**: 2026-05-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-calibration-capture-flow/spec.md`

## Summary

005 is a **UX redesign on top of feature 004's substrate** — it does not
greenfield the recorder. Every employee's "calm baseline" is the per-user
reference the stress model reads future check-ins against as deltas (Constitution
Principle II); a baseline captured while the person is tense or uncertain skews
every later reading, so the capture experience is load-bearing for accuracy, not
cosmetic. The spec settles every experiential and visual decision (the flow, the
copy, the states, the colour discipline, brackets-as-fixed-target,
breathing-guide-is-not-progress, recalibrate-overwrites-on-success). This plan
adds only the **technical realization** and resolves the engineering decisions
the spec deferred.

The work falls in six streams:

1. **Client-side face detection (the one genuinely new piece)** — a self-hosted,
   in-browser face *detector* (bounding box + presence) plus a canvas luma read,
   driving the green-room framing guide, the soft quality gate, and the
   in-recording drift feedback **entirely on the device**. No video frame leaves
   the device for framing (Principle I); the only path video leaves the device
   remains the existing 004 server-side extraction. Lives in
   `apps/web/lib/face-detect/`. 📌 DECISION-19.
2. **CSP & browser policy for the detector** — the WASM detector needs a scoped
   `script-src 'wasm-unsafe-eval'` (and, if the runtime spins a blob worker,
   `worker-src 'self' blob:`) added to `proxy.ts::buildCsp`, **scoped to the
   capture routes only** and landed **before the detector's first call**, using
   the repo's report-only→enforce CSP method. Detector assets are self-hosted
   (same-origin, covered by `connect-src 'self'`). COEP stays unset. 📌 DECISION-20.
3. **Recorder state-machine extension** — extend `use-anchor-recorder.ts`
   (not rebuild): add `intro`, `green-room`, `get-ready` (3→2→1), and
   `stop-confirming` states; split the single `permission-denied` into three
   calm camera-access states (`camera-blocked` / `camera-busy` / `camera-no-device`)
   mapped from `getUserMedia` error names; add a `mode: "first-time" | "recalibrate"`
   context that drives copy and exit destinations. 📌 DECISION-21.
4. **The redesigned capture surfaces** — the intro, the green room (fixed corner
   brackets + dimmed spotlight + soft gate + three guide states + device picker),
   the 3→2→1 get-ready countdown with the blur-to-softened transition, the
   recording stage (breathing guide focal over a softened preview, 60s timer as
   the sole progress indicator, persistent ambient brackets + drift feedback,
   "we've got you", stop control), the honest stop confirmation, the success
   moment (drawn check + bloom), the foggy post-recording failure (adaptive cause
   chip + escape), and the three camera-access states. Built under
   `components/anchor/`, M&M tokens only, every animated element with a true
   motion-free equivalent gated on the shared `useMediaQuery` hook. 📌 DECISION-27.
5. **Recalibrate entry + banner refresh** — the account-page "Your calm baseline"
   section (whether-set via `has_anchor`, "Set a new baseline" → replace heads-up
   → hard-nav to `/app/calibrate?mode=recalibrate`); the calibrate route honours
   `mode=recalibrate` (suppress the `has_anchor`→`/app` redirect, copy set→update,
   exits to `/app/account`); and the home banner restyled amber→foggy with a
   meadow "Set baseline" button, preserving appear/disappear/persist + cross-tab.
   📌 DECISION-22, 📌 DECISION-23.
6. **Honest tests + smoke** — tests that exercise the *real* behaviour (the gate,
   the three guide states, the stop→green-room return, the three camera-access
   states, the cause chip + escape, recalibrate overwrite-on-success, the banner
   lifecycle + cross-tab) by injecting inputs at the boundary (camera frames,
   `getUserMedia` errors, backend responses, the detector) and never mocking the
   unit's own logic; plus `smoke-tests.md` for what genuinely cannot run in CI.
   📌 DECISION-24, 📌 DECISION-25, 📌 DECISION-26.

**No backend changes. No database migration.** The FastAPI `/anchor` + `/healthz`
services are reused unchanged (raw bytes still deleted in a `finally`, JWKS/ES256
auth retained, no DB credentials). The anchor columns, the DECISION-12 SELECT
column-privacy, the `has_anchor()` SECURITY DEFINER boolean, and the UPDATE
whitelist already support everything 005 needs: banner/account state from the
whether-set signal, the existing write path for capture, and an in-place
overwrite for recalibration. 005 deliberately surfaces only *whether* a baseline
is set, not its date (📌 DECISION-23).

The permanent architectural choices below (📌 DECISION-19 … 📌 DECISION-28) are
enumerated for one-shot review and become `docs/DECISIONS.md` entries 19–28
during `/speckit-implement`.

## Technical Context

**Language/Version**: TypeScript 5.x strict, React 19.2.4, Next.js 16.2.6 — all
already installed (`apps/web/AGENTS.md` rule stands: consult
`node_modules/next/dist/docs/` before applying training-data Next knowledge).
**No backend/Python work in 005** — `apps/api/` and `packages/ml-video/` are
unchanged.

**Primary Dependencies**:

- **One new web runtime dependency: a self-hosted in-browser face detector.**
  The plan selects **MediaPipe Tasks Vision `FaceDetector`** (BlazeFace
  short-range), self-hosted (the `.wasm` runtime + the `.tflite`/`.task` model
  served from the app origin under `apps/web/public/face-detect/`), loaded
  on-demand only on the capture routes (📌 DECISION-19, alternatives in
  research.md). A *detector* (bounding box) suffices — no landmark mesh — and
  brightness is read independently from a downscaled canvas (no model needed).
- Everything else already installed: `@supabase/ssr`, shadcn primitives
  (button, card, dialog, dropdown-menu, separator, sheet), `lucide-react`,
  Tailwind v4, Framer Motion. The `useMediaQuery` hook
  (`apps/web/hooks/use-media-query.ts`) and the typed `anchor-client.ts`
  (`postAnchor`, `checkHealth`) are reused. No new backend SDK; `getUserMedia` /
  `MediaRecorder` / `enumerateDevices` remain browser APIs.

**Storage**: **No schema change.** Reuses 004's `public.profiles` anchor columns
(`anchor_vector`, `anchor_captured_at`, `anchor_model_version`), the DECISION-12
SELECT column-privacy, the UPDATE whitelist, and `has_anchor(auth.uid())`.
Recalibration overwrites the single `anchor_vector` row in place via the existing
owner UPDATE path, **on success only**; no baseline history table (📌 DECISION-22).

**Testing**: Vitest + RTL for the extended reducer, the pure framing/threshold
logic (fake-clock grace window), the device-memory fix, the banner lifecycle, and
the cause-chip mapping; Playwright for the employee happy path, the recalibrate
path, the three camera-access states, and the banner appear/disappear/persist +
cross-tab — all with **boundary injection** (detector, `getUserMedia`,
`MediaRecorder`, `postAnchor`, the session Supabase client are seams; the real
orchestration/logic runs). `smoke-tests.md` carries everything CI cannot honestly
run (📌 DECISION-26).

**Target Platform**: Web on Vercel (Next 16). Mobile-first; the **recording
screen is a first-class 360px layout, not a shrunk desktop one**; ≥44×44px
targets; light + dark in tandem at WCAG AA (Principle VI). The backend remains the
locally-runnable FastAPI service from 004 (`http://127.0.0.1:8000`).

**Project Type**: Web (frontend-only feature). `apps/web/` extends its own anchor
feature; `apps/api/` + `packages/ml-video/` are untouched.

**Performance Goals / Constraints**:

- **Detector budget**: run inference on a downscaled frame (≈192–256px) at a
  throttled cadence — ~6–8 fps in the green room, **~3–4 fps during recording** so
  it does not compete with `MediaRecorder` encoding (📌 DECISION-19). Target
  per-frame inference < ~40 ms on a mid laptop; an init that fails or exceeds a
  hard timeout (~4–5 s), or first-frames that exceed the budget, deterministically
  degrade to the **"no live guide — you can still record"** fallback (gate
  bypassed) rather than hanging in `loading` (Risk R-1).
- **60-second baseline is fixed** by the model contract (Principle II) — unchanged.
- **Drift grace window**: a tunable threshold on the order of ~2 s (a momentary
  wobble never trips the nudge), implemented as a pure timestamped debounce
  (📌 DECISION-19, FR-018).

**Scale/Scope**: ~1 new web lib (`lib/face-detect/`, 3 modules), ~10 new/expanded
`components/anchor/` surfaces, the reducer extension, the calibrate route + account
section edits, the banner restyle, the proxy CSP delta, the self-hosted detector
assets, and the test tiers. **Zero** backend, package, migration, or seed changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature engages Principles **I, II, III, V, VI, VII, VIII, IX, X**.
Principle IV (LLM) is not engaged. The load-bearing item is the **Principle I /
Architecture-Constraints boundary interaction** of doing face detection in
`apps/web` — addressed explicitly below.

| Principle | Status | How this plan honours it |
|-----------|--------|--------------------------|
| I. Privacy by Architecture (NON-NEG) | ✅ | The client-side detector reads the user's **own** camera stream **on their own device** and emits only ephemeral, in-memory framing signals (a bounding box, a centredness/size ratio, a brightness number) used solely to drive on-device UI. **No video frame, and no derived framing signal, is transmitted, persisted, or surfaced to any manager-facing layer.** The only path any recording leaves the device remains the existing 004 server-side `/anchor` extraction, whose raw bytes are still deleted in a `finally` (unchanged). Banner/account state still derives only from the scope-guarded `has_anchor(auth.uid())` boolean (DECISION-12); 005 does **not** expose the capture date (📌 DECISION-23) and exposes nothing about another user. |
| II. Subject-Disjoint ML Evaluation (NON-NEG) | ✅ | The 60-second baseline duration and the server-side extraction pipeline are unchanged. Recalibration overwrites the single per-user baseline in place (still a per-user calibration reference, Principle II); the client detector is **not** a stress model and computes **no** metric. |
| III. Modality Isolation **+ Architecture-Constraints boundary rule** | ✅ (reviewed) | The boundary rule keeps **raw signals from reaching the manager-facing layer / leaving the inference boundary toward managers**; its NON-NEGOTIABLE expression is Principle I. The client detector is a **UI-guidance utility, not a stress-inference modality** — the stress modality stays server-side in `packages/ml-video/`, untouched. Like 004's already-accepted browser `<video>` self-preview and `MediaRecorder` (both in `apps/web`, both touching the user's own local stream), the detector handles frames that are *already* in the browser, produces only on-device hints, and transmits nothing. This is a deliberate, reviewed interpretation, not a silent waiver — see **Privacy Review** below and 📌 DECISION-19. No raw signal is added to any new transport. |
| V. Calm-First Design Language | ✅ | Spec-settled and enforced: amber is reserved for stress/affective signals only and crimson for destructive surfaces only (Principle V); **no 005 calibration or error surface uses amber or crimson** — they use `foggy`/`meadow`/neutral, affirmative confirmation uses `meadow` (📌 DECISION-27). The 004 banner is corrected amber→foggy (FR-043). All copy uses the calm, non-alarmist voice ("noticed" not "detected", no exclamation marks, suggest-not-prescribe, first-person-plural). M&M tokens only; no new palette token; never remap M&M tokens inside `@theme inline`. |
| VI. Responsive & Accessible by Default | ✅ | Mobile-first; the recording screen is a deliberate 360px layout. Every animated element (breathing guide, 3→2→1 countdown, success bloom, bracket-drift nudge, blur transition) ships a **true zero-motion equivalent** gated on the shared `useMediaQuery("(prefers-reduced-motion: reduce)")` hook — **not** framer-motion's snapshot-at-mount `useReducedMotion` (📌 DECISION-27). ≥44×44px targets; light+dark in tandem at WCAG AA. |
| VII. Mandatory Testing Per PR | ✅ | **Honest tests** (FR-051/052, 📌 DECISION-26): boundary-injected Vitest+RTL + Playwright exercising the real gate, guide states, stop→green-room, three camera-access states, cause chip + escape, recalibrate overwrite-on-success, and banner lifecycle + cross-tab; a device-memory test that fails pre-fix; `smoke-tests.md` for the cross-browser webcam matrix, the three real camera-access conditions, the detector-unavailable fallback on a weak device, 360px, reduced-motion, and light/dark — explicitly enumerated rather than mocked green. |
| VIII. Spec-Driven Workflow | ✅ | This is the plan artifact; spec → plan → tasks → implement order. Decisions logged in `docs/DECISIONS.md` (19–28), progress in `docs/PROGRESS.md`, any spec/contract delta in `docs/CHANGELOG.md`. |
| IX. Secrets Discipline (NON-NEG) | ✅ | **No new secret.** The detector assets are public static files; `NEXT_PUBLIC_API_URL` already exists. No `.env*` added; no key in any committed file. |
| X. Dataset Stewardship (NON-NEG) | ✅ | The detector runs on the **live user's own webcam** — no StressID media, no consent-withheld subject frames, anywhere. The detector model is a generic face-bounding-box artifact (Apache-2.0 / public), unrelated to StressID. |

**Privacy Review (Quality Gate 6).** This feature touches signal capture, so an
explicit Principle-I note is required. The on-device face detector is privacy-
preserving by construction: (a) it consumes only the user's own `MediaStream`,
already present in the browser for the 004 self-preview and recorder; (b) it
outputs only ephemeral framing signals held in component state for the duration
of the session and never serialized; (c) **nothing** — no frame, no bounding box,
no brightness reading — is sent to the backend, written to storage, or rendered on
any manager surface; (d) the server-side extraction path and its raw-byte deletion
are unchanged. The Architecture-Constraints boundary rule is satisfied in intent
(no raw signal reaches the manager layer or a new transport) and the interpretation
is logged as 📌 DECISION-19. **Gate result: PASS.**

**Gate result**: PASS. One reviewed boundary interpretation (Principle III /
client detection), no waiver required — see Complexity Tracking.

## Plan-Level Decisions (resolved here, not deferred)

Long-form treatment of each is in [research.md](./research.md); the contracts are
in [contracts/face-detection.md](./contracts/face-detection.md) and
[contracts/components.md](./contracts/components.md).

### 📌 DECISION-19 — Client-side face detection: self-hosted MediaPipe FaceDetector + canvas luma

The live framing guide, the soft gate, and the in-recording drift feedback are
driven by an **in-browser, on-device** pipeline:

- **Detector**: MediaPipe Tasks Vision `FaceDetector` (BlazeFace short-range),
  **self-hosted** — the `.wasm` runtime and the model file are committed under
  `apps/web/public/face-detect/` and served same-origin (no third-party CDN, so
  `connect-src 'self'` covers asset fetch; this is the CSP-allowed-origin
  constraint the brief sets). A bounding box (presence + position + size) is all
  005 needs; **no landmark mesh**. Loaded **lazily, only on the capture routes**.
- **Brightness** is computed independently from a downscaled `<canvas>` luma
  average over the target region — no model needed, robust even when the detector
  is unavailable.
- **Output → framing signal → states** (the full threshold table is in
  `contracts/face-detection.md`, all forgiving and tunable in one module):
  - *Soft gate dealbreakers*: **no face** (no detection for K consecutive
    frames), **badly off-centre** (box centre outside ~0.18 of the normalized
    frame centre), **too dark** (region luma below a low floor). Anything else
    clears the gate.
  - *"You're set"*: face present + roughly centred + adequately lit, held for a
    short debounce (~400–600 ms) so the enable doesn't flicker.
  - *In-recording drift*: **centred** (brackets quiet/receding) → **"ease back to
    centre"** only after the face is off-target continuously past the **grace
    window (~2 s, tunable)** → **"we can't see you"** when absent past the same
    window. A momentary wobble never trips it (FR-018, FR-020); the recording is
    never auto-stopped.
- **Throttling**: ~6–8 fps green room, ~3–4 fps during recording, via
  `requestVideoFrameCallback` where available else a throttled `rAF`, on a
  downscaled frame.
- **Deterministic fallback**: a capability probe at mount (WASM support) plus a
  hard init timeout (~4–5 s) and a first-frames latency check; on failure/timeout/
  too-slow the hook resolves to **`unavailable`** → the green-room fallback
  ("no live guide — you can still record", soft gate bypassed, "I'm ready"
  available). The detector **never** hangs the user in `loading`.
- **Boundary**: pure on-device; transmits nothing (see Privacy Review).

### 📌 DECISION-20 — CSP delta for the WASM detector (scoped, report-only→enforce, land first)

`proxy.ts::buildCsp` becomes `buildCsp(nonce, pathname)` and adds, **only for the
capture routes** (`/onboarding`, `/app/calibrate`):

- `script-src … 'wasm-unsafe-eval'` (MediaPipe compiles the WASM module; this
  keyword composes with the existing `'strict-dynamic'`), and
- `worker-src 'self' blob:` **iff** the chosen runtime spins a blob-URL worker
  (verified empirically; otherwise omitted).

All other routes keep today's stricter policy unchanged. Self-hosted assets are
same-origin (`connect-src 'self'` already present). **COEP stays unset** — the
detector runs single-threaded WASM; if SIMD/threads are ever needed (cross-origin
isolation) that is a separate, later decision. **Rollout order is load-bearing**
(Risk R-2, mirrors 004 DECISION-16/R-5): the CSP delta lands and is verified
**before** the detector's first call, using the repo's established method —
ship report-only, drive the capture routes under Playwright capturing
`securitypolicyviolation`, narrow to the minimal allowance, then enforce.

### 📌 DECISION-21 — Extend the recorder state machine (don't rebuild); split camera-access states

Extend `use-anchor-recorder.ts` (a pure reducer, already unit-testable):

- **New states**: `intro` (pre-camera), `green-room` (replaces the bare
  `permission-granted` preview; carries the framing-gate readiness + the three
  guide sub-states), `get-ready` (the 3→2→1 countdown), `stop-confirming`. The
  60-second `recording` and the `uploading`/`success` terminals stay (`uploading`
  covers both the POST and server-side extraction, per 004's convention).
- **Split `permission-denied`** into **`camera-blocked`** (`NotAllowedError` /
  hard-blocked via the existing `navigator.permissions.query` probe),
  **`camera-busy`** (`NotReadableError` / `TrackStartError` / `AbortError`), and
  **`camera-no-device`** (`NotFoundError` / `OverconstrainedError`), mapped from
  the `getUserMedia` rejection's `error.name` (mapping table in
  `contracts/components.md`). Each is a distinct foggy state with "Try again" /
  "Not now".
- **`mode: "first-time" | "recalibrate"`** context drives copy (set→update) and
  the exit destination split (FR-053): first-time exits defer to `/app` with the
  banner; recalibrate exits keep the existing baseline and return to `/app/account`.
- **Stop** (`stop-confirming` → confirm) returns to **`green-room`** to re-situate
  (FR-023), never to a fresh `get-ready`; nothing is persisted. The existing
  `failureCount`/escape logic is retained; transport failures and permission
  denials still never count as strikes.

### 📌 DECISION-22 — Recalibrate via `?mode=recalibrate`; overwrite-on-success-only; no DB change

- The account "Set new baseline" action is a **full-document navigation**
  (`<a href="/app/calibrate?mode=recalibrate">`, per DECISION-16) so the per-route
  `camera=(self)` Permissions-Policy applies.
- `calibrate/page.tsx` reads `searchParams.mode`. In `recalibrate` mode it
  **suppresses the `has_anchor`→`/app` redirect** (ST-17) — a recalibrating user
  has an anchor and intends to replace it — while still role-gating to employees.
- The recorder runs in `recalibrate` mode: success copy reads **"Your baseline is
  updated"**, and `onComplete`/`onSkip` hard-navigate to **`/app/account`**
  (`window.location.replace`) so the relaxed camera policy does not linger on a
  non-capture document.
- **Overwrite-on-success-only**: the existing client write path (decode
  `vector_b64` → `bytea` → UPDATE the owner's row) already writes only after a
  successful extraction, so stop/fail/defer **naturally** leave the prior baseline
  untouched. **No baseline history**, no new table, **no migration** (the
  DECISION-12 UPDATE whitelist already permits the owner to overwrite their anchor
  columns).

### 📌 DECISION-23 — Account section is whether-set-only; capture date NOT surfaced in 005

The "Your calm baseline" section shows only **whether** a baseline is set
(`has_anchor(auth.uid())`) plus the "Set a new baseline" action. 005 does **not**
surface the capture date. Rationale: the date column was deliberately hidden from
everyone (including the owner's direct read) in DECISION-12 to deny managers a
calibration-timing pressure signal; surfacing even the owner's own date needs a
new self-scoped SECURITY DEFINER read — a DB surface this redesign does not
require. The spec defaults to whether-set-only (FR-041); a self-scoped date read
is a clean future addition when feature 006's inference read path lands. Never
expose another user's state/date.

### 📌 DECISION-24 — Adaptive cause chip is client-telemetry-first; we own "our side"

The post-recording failure cause chip (FR-028) is driven primarily by **client
detector telemetry** captured during the 60-second recording — the dominant
adverse signal:

- mostly-dark frames → **low light** ("facing a little more light usually helps"),
- mostly off-centre/absent frames → **out of frame** ("staying roughly centred and
  still helps"),
- **no clear signal, detector unavailable, or `bad_vector`** → **our side**
  ("this one was on our side — give it a moment and try again").

We never claim a lighting/framing cause we did not actually measure; when the
detector was unavailable the chip defaults to **our side**. The 004 backend 422
`reason` (`no_face`/`roi_empty`/`bad_vector`) is retained as a secondary signal
only; the backend is **unchanged**.

### 📌 DECISION-25 — Device-memory fix (FR-045): persist the resolved default on a cleared store

`device-picker.tsx` already persists an **explicit** selection. The gap: the
mount-effect's **auto-resolved default** (when the stored value is absent/cleared)
is never written, so a cleared preference silently never re-persists for the
session. Fix: when the store is empty/cleared **and** a real default camera is
resolved, write it to `localStorage` (the preference is always (re-)written) —
**without** clobbering a stored-but-temporarily-absent device (that memory is kept
so it returns when the device reconnects, preserving FR-005). Covered by a Vitest
test that **fails against the pre-fix behaviour** (FR-052).

### 📌 DECISION-26 — Honest-test seams: inject at the boundary, never mock the unit

Tests substitute only the unavoidable I/O and exercise the real logic:

- The detector is consumed through an injectable interface, so tests drive
  **synthetic framing signals** (present/centred/dark/absent over time) into the
  *real* gate and the *real* grace-window/drift reducer (fake clock).
- `getUserMedia` is driven to reject with each real `error.name` to assert the
  *real* mapping to the three camera-access states.
- The reducer (stop→green-room, mode exits, failure/escape) is pure and tested
  directly.
- The orchestrator takes injectable deps (`getUserMedia`, `MediaRecorder`,
  `postAnchor`, the session Supabase client) so the recalibrate
  **overwrite-on-success-only** is asserted by checking `update()` is called only
  on success and never on stop/fail/defer.
- The banner lifecycle (appear/dismiss-this-session/reappear-next-session/
  disappear-on-calibrate) and cross-tab mirror run the real `sessionStorage` +
  storage-event logic.
- Whatever genuinely cannot run honestly in CI (a real permission prompt, real
  WASM on a real weak device, real cross-browser `MediaRecorder`) is listed in
  `smoke-tests.md` **and called out as deferred**, not mocked green.

### 📌 DECISION-27 — Reduced-motion = zero motion via the shared hook; every animation has a still equivalent

All 005 animated elements gate on the shared
`useMediaQuery("(prefers-reduced-motion: reduce)")`
(`apps/web/hooks/use-media-query.ts`), **not** framer-motion's snapshot-at-mount
`useReducedMotion`, and **not** only the global CSS duration clamp in
`globals.css` (that backstop stays, but JS-driven motion must branch). Each ships a
true motion-free equivalent that conveys the same thing: the breathing guide → a
static "breathe in / hold / out" cue ladder; the 3→2→1 → a plain numeric tick; the
success bloom → a static drawn check; the bracket-drift nudge → an instant
state/colour change with text; the countdown blur → an immediate
softened-not-sharp state with no transition. The duplicated inline
`usePrefersReducedMotion` in `countdown.tsx` is refactored onto the shared hook.
The existing 60→0 ring becomes the **60-second recording timer (the sole progress
indicator)**; the **3→2→1 get-ready countdown is a separate, numbers-only**
component with no draining ring; the **breathing guide is never a progress
indicator**.

### 📌 DECISION-28 — Component layout under the existing feature folder (three-tier convention)

New surfaces extend `components/anchor/` (the 004 feature folder), composing
shadcn primitives from `components/ui/` (DECISION-4 three-tier convention); the
detector lib is `apps/web/lib/face-detect/`. No new top-level structure. The
`/app/calibrate` route and the account section host these client components from
Server Components, keeping the camera APIs client-only (the 004 boundary).

## Project Structure

### Documentation (this feature)

```text
specs/005-calibration-capture-flow/
├── plan.md                 # this file
├── spec.md                 # committed
├── research.md             # Phase 0 — detector evaluation, CSP/policy work, threshold tuning, long-form 📌 DECISION-19…28
├── data-model.md           # Phase 1 — NO schema change; client state shapes (RecorderState ext, FramingSignal, thresholds), reused 004 DB surface
├── contracts/
│   ├── face-detection.md   # detector interface, framing-signal → gate/drift mapping, threshold table, fallback determination, CSP deltas
│   ├── components.md        # component contracts, the extended state machine, getUserMedia→state mapping, recalibrate mode, cause-chip mapping
│   └── backend-unchanged.md # explicit note: /anchor + /healthz + the migration are unchanged in 005 (no api/migration contract delta)
├── quickstart.md            # run web+api locally; exercise every state incl. forcing the detector-unavailable fallback
├── checklists/requirements.md  # from /speckit-specify (all pass)
├── tasks.md                 # /speckit-tasks (NOT yet)
└── smoke-tests.md           # /speckit-tasks (NOT yet)
```

### Source Code (repository — additions and modifications)

```text
apps/web/
├── public/face-detect/                         # NEW — self-hosted detector assets (.wasm runtime + model file) (📌 DECISION-19/20)
├── lib/face-detect/                             # NEW — the on-device detector lib (📌 DECISION-19)
│   ├── detector.ts                             #   capability probe + lazy loader + hard init timeout → FaceDetector | null
│   ├── framing.ts                              #   PURE: detection+luma → FramingSignal → gate verdict + drift state + grace-window debounce (testable, fake-clock)
│   └── use-framing-guide.ts                    #   throttled rVFC/rAF loop tying <video> → framing signal; loading/active/unavailable lifecycle; injectable seam
├── components/anchor/
│   ├── use-anchor-recorder.ts                  # MODIFIED — new states + mode + 3-way camera-access mapping + framing readiness (📌 DECISION-21)
│   ├── anchor-recorder.tsx                     # MODIFIED — orchestrate the redesigned surfaces, drive the framing hook, stop→green-room, recalibrate copy/exits, cause-chip telemetry
│   ├── device-picker.tsx                       # MODIFIED — persist resolved default on cleared store (📌 DECISION-25, FR-045)
│   ├── calibration-banner.tsx                  # MODIFIED — amber→foggy + meadow "Set baseline"; preserve lifecycle + cross-tab (FR-043)
│   ├── intro.tsx                               # NEW — pre-camera intro (heading, 3 what-to-expect lines, privacy, "Turn on camera")
│   ├── green-room.tsx                          # NEW — preview + framing overlay + device picker + soft-gate "I'm ready" + 3 guide states + "Not now"
│   ├── framing-overlay.tsx                     # NEW — fixed corner brackets + dimmed spotlight + drift nudge (green room AND recording); motion-free variant
│   ├── get-ready-countdown.tsx                 # NEW — 3→2→1 numbers only + blur→softened transition; motion-free variant (📌 DECISION-27)
│   ├── recording-stage.tsx                     # NEW — breathing guide focal over softened preview + 60s timer + brackets/drift + "we've got you" + stop
│   ├── breathing-guide.tsx                     # NEW — 4-in/6-out; motion-free cue ladder under reduced-motion
│   ├── recording-timer.tsx                     # NEW/REFACTOR — the 60s sole-progress timer (the old countdown ring, re-homed; shared reduced-motion hook)
│   ├── stop-confirm.tsx                        # NEW — honest stop dialog (shadcn dialog), non-destructive (no crimson)
│   ├── success-state.tsx                       # NEW — drawn check + bloom; readable copy; "Back to home"/"Back to account"; motion-free variant
│   ├── failure-state.tsx                       # NEW — foggy failure + adaptive cause chip + Try again/Not now + escape (📌 DECISION-24)
│   ├── camera-access-state.tsx                 # NEW — the three foggy states (Blocked/Busy/No camera) + Try again/Not now (📌 DECISION-21)
│   ├── baseline-section.tsx                    # NEW — account "Your calm baseline" + "Set a new baseline" → replace heads-up → hard nav (📌 DECISION-22/23)
│   └── *.test.tsx / *.test.ts                  # Vitest + RTL (honest seams, 📌 DECISION-26)
├── app/(authed)/app/
│   ├── page.tsx                                # (banner mount unchanged; banner restyle is internal to the component)
│   ├── account/page.tsx                        # MODIFIED — render <BaselineSection/> (has_anchor) after Security (📌 DECISION-22/23)
│   └── calibrate/
│       ├── page.tsx                            # MODIFIED — read searchParams.mode; suppress has_anchor→/app in recalibrate mode (📌 DECISION-22)
│       └── calibrate-recorder.tsx              # MODIFIED — accept mode; first-time→/app, recalibrate→/app/account exits (📌 DECISION-22)
├── app/(onboarding)/onboarding/onboarding-form.tsx  # (hosts <AnchorRecorder context="onboarding"/> — redesigned surfaces flow through unchanged host)
├── hooks/use-media-query.ts                    # REUSED — the reduced-motion gate (📌 DECISION-27)
├── lib/auth-broadcast.ts                       # REUSED unchanged — anchor-captured + banner-dismiss helpers
├── components/cross-tab-auth.tsx               # REUSED unchanged — refresh on anchor-captured; mirror dismissal
├── lib/api/anchor-client.ts                    # REUSED unchanged — postAnchor + checkHealth
├── proxy.ts                                    # MODIFIED — buildCsp(nonce, pathname): scoped 'wasm-unsafe-eval' (+ worker-src blob: if needed) on capture routes (📌 DECISION-20)
└── next.config.ts                              # UNCHANGED — camera=(self) already covers /onboarding + /app/calibrate; account needs no camera
docs/
├── DECISIONS.md                                # APPENDED 19–28 during /speckit-implement
├── PROGRESS.md                                 # APPENDED running entry
└── CHANGELOG.md                                # APPENDED on any spec/contract delta
CLAUDE.md                                       # MODIFIED — SPECKIT pointer → 005 plan (this commit)
```

**Structure Decision**: Frontend-only redesign. No file is added under
`apps/api/`, `packages/`, `supabase/migrations/`, or `scripts/`. The raw-signal
boundary holds: the new detector runs in the browser on the user's own stream and
transmits nothing (Privacy Review); `apps/web` still sends only the recorded clip
to the unchanged `/anchor` service, which still deletes raw bytes.

## Branch Commit Ordering

Canonical ordering for `/speckit-tasks` to decompose; each step is a PR-sized unit
landing on `005-calibration-capture-flow`; tests pass before the next starts.
**CSP-before-detector ordering is load-bearing** (Risk R-2).

1. **Reduced-motion + token groundwork** — refactor `countdown.tsx`'s inline hook
   onto the shared `useMediaQuery`; confirm M&M utility classes for the foggy/
   meadow surfaces; no behavioural change. (📌 DECISION-27)
2. **CSP delta (report-only) + self-hosted detector assets** — `buildCsp(nonce,
   pathname)` scoped WASM allowances on capture routes, shipped **report-only**;
   commit `public/face-detect/` assets; Playwright `securitypolicyviolation`
   sweep → narrow → flip to enforce. **Before** any detector call. (📌 DECISION-20)
3. **Detector lib** — `lib/face-detect/` (`detector.ts`, `framing.ts`,
   `use-framing-guide.ts`) with the capability probe, hard timeout/unavailable
   fallback, throttled loop, and the pure threshold/grace-window logic. Vitest on
   `framing.ts` (fake clock). (📌 DECISION-19)
4. **State-machine extension** — `use-anchor-recorder.ts`: new states, `mode`, the
   three camera-access mappings, framing readiness. Vitest on the reducer.
   (📌 DECISION-21)
5. **Green room + framing overlay + intro** — `intro.tsx`, `green-room.tsx`,
   `framing-overlay.tsx`; wire the gate + three guide states + device picker +
   "I'm ready"/"Not now". (📌 DECISION-19/21/28)
6. **Get-ready countdown + recording stage** — `get-ready-countdown.tsx` (blur→
   softened), `recording-stage.tsx`, `breathing-guide.tsx`, `recording-timer.tsx`;
   persistent brackets/drift; stop control. (📌 DECISION-27)
7. **Stop / success / failure** — `stop-confirm.tsx` (→ green room),
   `success-state.tsx` (bloom, readable copy), `failure-state.tsx` (cause chip +
   escape, 📌 DECISION-24). Device-memory fix (📌 DECISION-25) lands here with the
   picker wiring.
8. **Camera-access states** — `camera-access-state.tsx` (Blocked/Busy/No camera),
   wired to the `getUserMedia` error mapping. (📌 DECISION-21)
9. **Orchestrator rewire** — `anchor-recorder.tsx` renders the redesigned surfaces
   by state, drives the framing hook, threads `mode`, cause-chip telemetry, and the
   exit splits.
10. **Recalibrate entry** — `baseline-section.tsx` on the account page; `calibrate/
    page.tsx` `mode` handling; `calibrate-recorder.tsx` exits/copy. (📌 DECISION-22/23)
11. **Banner refresh** — `calibration-banner.tsx` amber→foggy + meadow "Set
    baseline"; verify lifecycle + cross-tab unchanged. (FR-043, FR-054)
12. **Honest tests** — Vitest+RTL + Playwright with boundary seams; the
    overwrite-on-success assertion; the banner+cross-tab specs. (📌 DECISION-26)
13. **`smoke-tests.md`** authored; Mohamed runs after `/speckit-implement`.

## Edits to prior features

- **Feature 004 (this feature's substrate)** — `use-anchor-recorder.ts`,
  `anchor-recorder.tsx`, `device-picker.tsx`, `calibration-banner.tsx`,
  `calibrate/page.tsx`, `calibrate-recorder.tsx` are **extended** (not rebuilt).
  The 004 invariants are explicitly preserved: full-document navigation into
  capture routes (banner CTA + the new account CTA), the `/healthz` pre-check
  gating entry to recording with the calm "temporarily unavailable" copy, and the
  cross-tab anchor-captured/dismissal behaviour. The `/anchor` + `/healthz`
  services, the migration, the grants, `has_anchor`, and the demo seed are
  **untouched**.
- **Account page (feature 003 surface)** — gains the "Your calm baseline" section
  (additive); no change to the other sections.

## Test Strategy

(Full detail in 📌 DECISION-26 and `contracts/components.md`.) Layers: Vitest+RTL
(reducer extension, pure `framing.ts` with a fake clock, device-memory fix, banner
lifecycle, cause-chip mapping, recalibrate overwrite-on-success via an injected
Supabase client), Playwright (employee happy path; recalibrate path; the three
camera-access states; banner appear/disappear/persist + cross-tab) with the
detector / `getUserMedia` / `MediaRecorder` / `postAnchor` as boundary seams so the
real orchestration runs, and `smoke-tests.md` for the cross-browser webcam matrix,
the three real camera-access conditions, the detector-unavailable fallback on a
weak device, 360px, reduced-motion across every animated element, and light/dark
parity. The honest-test principle (📌 DECISION-26): mock inputs at the boundary,
never the unit's own logic; enumerate CI-impossible checks in `smoke-tests.md`
rather than mocking them green.

## DECISIONS.md entries this plan implies

Appended to `docs/DECISIONS.md` during `/speckit-implement` (date `2026-05-30+`,
feature 005), continuing from 004's DECISION-18:

19. **Client-side face detection** — self-hosted MediaPipe FaceDetector + canvas
    luma; bounding-box-only; lazy, capture-routes-only; deterministic
    init-timeout/too-slow → "no live guide" fallback; throttled cadence; output→
    gate/drift threshold mapping; ~2 s drift grace window. Privacy: on-device,
    transmits nothing (Principle I/III interpretation). 📌 DECISION-19.
20. **Scoped CSP delta for the WASM detector** — `'wasm-unsafe-eval'` (+ `worker-src
    'self' blob:` if needed) on capture routes only; self-hosted same-origin
    assets; COEP unset; report-only→enforce; land before first call. 📌 DECISION-20.
21. **Recorder state-machine extension** (intro/green-room/get-ready/
    stop-confirming + three camera-access states + `mode`) over a rebuild;
    `getUserMedia` error.name→state mapping; stop→green-room. 📌 DECISION-21.
22. **Recalibrate via `?mode=recalibrate`** — suppress `has_anchor`→`/app` in that
    mode; overwrite-on-success-only; exits hard-nav to `/app/account`; copy
    set→update; no baseline history; no DB change. 📌 DECISION-22.
23. **Account whether-set-only** — capture date not surfaced in 005; defer a
    self-scoped date read to 006. 📌 DECISION-23.
24. **Adaptive cause chip is client-telemetry-first; we own "our side"**; backend
    422 reason secondary; backend unchanged. 📌 DECISION-24.
25. **Device-memory fix** — persist the resolved default on a cleared store without
    clobbering a temporarily-absent remembered device; test fails pre-fix.
    📌 DECISION-25.
26. **Honest-test seams** — inject at the boundary, never mock the unit; enumerate
    CI-impossible checks in `smoke-tests.md`. 📌 DECISION-26.
27. **Reduced-motion = zero motion via the shared `useMediaQuery` hook**; every
    animated element ships a still equivalent; get-ready countdown vs 60 s timer vs
    breathing-guide roles separated. 📌 DECISION-27.
28. **Component layout** — extend `components/anchor/` + `lib/face-detect/` under
    the three-tier convention. 📌 DECISION-28.

## Complexity Tracking

| Item | Why it is not a violation | Simpler alternative rejected because |
|---|---|---|
| Face detection in `apps/web` vs the Architecture-Constraints boundary rule | The detector is a **UI utility on the user's own on-device stream** that transmits nothing and reaches no manager layer — satisfying Principle I (the rule's NON-NEGOTIABLE intent) and matching 004's already-accepted browser preview/recorder. Logged as 📌 DECISION-19 + Privacy Review. | *Server-side framing guidance* would mean streaming live frames off the device — a direct Principle I violation and far worse privacy. *No live guide at all* would abandon the spec's load-bearing calm/accuracy goal. |
| One new web runtime dependency (the detector) | The spec's framing guide cannot exist without on-device detection; it is the single genuinely-new piece and is self-hosted (no third-party origin, no new secret). | The native `FaceDetector` API is not cross-browser (absent in Firefox/Safari), so it cannot be the primary; a hand-rolled detector is infeasible. |

No waivers required; both items are reviewed and consistent with the principles.

## Risks & Mitigations

| ID | Risk | Mitigation |
|----|------|------------|
| R-1 | **Detector hangs / never loads on a weak device** → user trapped in `loading`. | A capability probe + **hard init timeout** + first-frames latency check deterministically resolve to **`unavailable`** → "no live guide — you can still record", gate bypassed (📌 DECISION-19, FR-011). |
| R-2 | **CSP blocks the detector** — WASM compile / blob worker rejected if `script-src`/`worker-src` lack the allowance. | Land the **scoped** `'wasm-unsafe-eval'` (+ `worker-src blob:` if needed) **before** the first detector call, report-only→enforce with a Playwright violation sweep (📌 DECISION-20, mirrors 004 R-5). |
| R-3 | **Detection competes with recording** → dropped frames / jank during the 60 s. | Throttle to ~3–4 fps during recording on a downscaled frame; `requestVideoFrameCallback`; optional OffscreenCanvas/worker hedge (📌 DECISION-19). |
| R-4 | **Recalibrate redirect regression** — the ST-17 `has_anchor`→`/app` redirect would bounce a recalibrating user out. | `mode=recalibrate` suppresses that redirect in `calibrate/page.tsx`; first-time behaviour is unchanged (📌 DECISION-22, Risk-tested in Playwright). |
| R-5 | **Camera-policy lingers** if exits use soft navigation (account page transiently `camera=(self)`). | All capture-route exits are **hard navigations** (`window.location.replace`), as 004 already does; the new account CTA is a plain `<a href>` (📌 DECISION-22, DECISION-16). |
| R-6 | **Cause chip blames the user** when we don't actually know the cause. | Client-telemetry-first; **our-side default** when no clear signal or the detector was unavailable (📌 DECISION-24, FR-028). |
| R-7 | **Mock-masked tests** repeat 004's green-but-broken e2e. | Honest seams: inject inputs, run real logic; device-memory test fails pre-fix; CI-impossible checks enumerated in `smoke-tests.md`, not mocked (📌 DECISION-26). |
