# Implementation Plan: Stress Inference Service

**Branch**: `008-stress-inference-service` | **Date**: 2026-06-19 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from `specs/008-stress-inference-service/spec.md`

**Visual contract**: [`serenify-008-monitoring-mock.html`](../../serenify-008-monitoring-mock.html) (repo root) — reference for *intent*; build against real Graphite tokens (`apps/web/app/globals.css`) and existing `apps/web` components, not the mock's inline hex/CSS.

**Supporting artifacts**: [`research.md`](./research.md) (D-1…D-4 + mock-gap resolutions + window discrepancy + windowing approach), [`data-model.md`](./data-model.md), [`contracts/inference-api.md`](./contracts/inference-api.md), [`contracts/smoothing-and-banding.md`](./contracts/smoothing-and-banding.md), [`quickstart.md`](./quickstart.md).

---

## Summary

Feature 008 is the **wiring** that turns the already-built, already-verified video model into the first real stress reading an employee sees. The trained model, `Predictor.predict_delta`, and the shared 2958-d feature-extraction path exist; this feature connects them to (1) a webcam capture loop that records fixed **60-second windows on a 10-second stride**, (2) an authenticated, **employees-only** backend inference endpoint, (3) per-window persistence, and (4) the monitoring UI surfaces from the approved mock.

The technical shape, after resolving the four deferred decisions:

- **Session-aware inference, server-authoritative, continuous single-stream (revised D-2).** A small set of FastAPI endpoints (`create session` → `submit the contiguous recording-so-far` (×N) → `end session`) group readings cleanly. The client records with **one continuous `MediaRecorder`** (timeslice for incremental capture only — no stop/restart) and uploads the **contiguous recording-so-far** each stride (init + all chunks in order — always decodable); the **server** decodes that one continuous clip and **tail-extracts the last 60 s** (the existing single-clip `compute_anchor` + VFR `POS_MSEC` sampler, bounded to frames with timestamp ≥ duration − 60 s), reads the user's anchor, computes `delta`, calls `predict_delta`, **re-thresholds `proba[1]` at the calibrated operating point 0.53** (ignoring the internal 0.5 label), **smooths and bands server-side**, persists the reading, and returns the band. The client is a thin renderer — eliminating smoothing divergence and guaranteeing the two trend surfaces agree (SC-008). The 60 s window is a real continuous clip — **faithful by construction**, so there is no multi-clip assembly and **no new feature-fidelity gate**; one continuous encoder is the defensible path for fragile **Safari** `MediaRecorder`. (D-2, D-3, R-5; B1 container-reassembly and B2 multi-clip frame-concat both rejected — R-5/R-7.)
- **Self-scoped `SECURITY DEFINER` anchor read — no broad DB credential (revised D-1).** `apps/api` gains **no service-role key**. The anchor is read by `public.get_my_anchor()` (a `SECURITY DEFINER` function filtered on `auth.uid()`, EXECUTE to `authenticated` only), called by the API **as the user** via the forwarded access token + the **publishable anon key** (RLS-respecting, not a secret). Sessions/readings are written under **RLS as the user** (insert-own/select-own). This preserves DECISION-9's "no broad credential" posture (feature 004 named both options for this path; the self-scoped DEFINER is the safer one). The anchor never reaches an authenticated client SELECT. Write-integrity (a user could fabricate **their own** readings) is a **deliberately deferred, low-stakes** item — upgrade path is a dedicated INSERT-only role, not built now.
- **Two new tables, employee-only.** `monitoring_sessions` + `window_readings`, RLS-scoped to the owner (insert-own/select-own/update-own) with **no manager policy at all** (Principle I), and the raw per-window `stress_probability`/`label` columns held server-only via the column-grant whitelist pattern (mirrors `anchor_vector`). The persisted shape is sufficient for feature 009 to detect "sustained tense" without 008 building any trigger (FR-020). (D-4)
- **Reuse, no duplication.** The shared 2958-d extraction path (`ml_video.compute_anchor`, the same function calibration uses — it also runs the feature-006 coverage gate), feature 005's on-device face detector + self-view, and feature 006's usable-face-coverage gate + cause vocabulary are reused as-is. No second copy of extraction (Principle III).

The signature experience stays calm: an ambient breathing **bloom** drifts between **At ease / A little tense / Tense**; the first reading the user sees is already smoothed (warming-up until ~90–105 s); there is deliberately **no number or gauge** anywhere.

---

## Technical Context

**Language/Version**: Python 3.12 (FastAPI backend, `apps/api`); TypeScript strict (Next.js 16 App Router, `apps/web`); SQL (Supabase/Postgres migrations).

**Primary Dependencies**:
- Backend: FastAPI, Pydantic v2 / pydantic-settings, PyJWT (existing `verify_jwt`), `supabase-py` (**new** — a **user-context** client: `create_client(url, anon_key)` + per-request `postgrest.auth(<forwarded JWT>)`; **no service-role**), `ml_video` workspace package (existing: `compute_anchor`, `load_model`, `Predictor.predict_delta`; **+ a thin tail-window option** on `compute_anchor` so the server scores the trailing 60 s of the continuous clip — reuses the existing decode+sampler+features), NumPy.
- Frontend: existing capture stack (**one continuous `MediaRecorder`** — timeslice for incremental capture, no stop/restart; uploads the contiguous recording-so-far each stride; `getUserMedia`), `@mediapipe/tasks-vision` FaceDetector (existing `lib/face-detect/*`), Framer Motion (existing, reduced-motion-gated), the typed Supabase browser client (existing), shadcn/Card/Button primitives (existing).
- DB: Supabase Postgres, RLS + column grants + one `SECURITY DEFINER` function (`get_my_anchor()`).

**Storage**: Supabase Postgres. Two new tables (`monitoring_sessions`, `window_readings`). The anchor is read via `get_my_anchor()` from the existing `profiles.anchor_vector bytea` (server-side, in the caller's RLS context). The uploaded **continuous clip** is held **transiently in server memory**, decoded to its trailing 60 s of frames for extraction, then the clip + any temp file is **deleted in `finally`** (reuse of the `/anchor` Principle-I pattern). **No per-session clip buffer; no raw video is ever persisted.** (The deferred server-side rolling decoded-frame buffer, if ever built, holds only decoded frames in memory for an active session — same transient posture.)

**Testing**: pytest (backend + `ml-video`, incl. the **first-ever `predict_delta` test**); Vitest + React Testing Library (frontend component/state-machine logic); Playwright (one **employee** e2e happy path); ml-video fixture regression (incl. the **scheduled** webm/VFR fidelity hardening check — not a ship blocker); `smoke-tests.md` (human-validated, incl. camera flows that need HTTPS/localhost).

**Target Platform**: Web — Next.js on Vercel (frontend), FastAPI on a DigitalOcean droplet (backend), Supabase (DB/auth). Dev: `localhost` (secure context for webcam). Mobile ≥ 360 px supported (Principle VI).

**Project Type**: Web application (frontend + backend + ML package + DB migrations) — the monorepo's established layout.

**Performance Goals**: First smoothed reading within ~90–105 s; a refreshed reading ~every 10 s thereafter (SC-001). Per-window keep-up has **two** components (research R-5): **(a) the constant per-window extract** (MediaPipe + LBP) ~3–5 s on the dev laptop, comfortably inside the 10 s stride locally — but projected **~10–15 s/window on the DigitalOcean droplet**, which **alone** could exceed the stride (lever there is a slower reading cadence or GPU MediaPipe, **not** the buffer); and **(b) the growing decode-to-tail** under continuous upload — the server re-decodes the growing clip to reach its trailing 60 s, so decode must fit `(10 s − extract)` ≈ **5–7 s** (≈ 43–60× realtime at the 5-min cap), a cost that grows with elapsed session time (bounded by the 5-min cap; negligible on localhost; could exceed the stride late in a 5-min session on the droplet — mitigation = the deferred rolling decoded-frame buffer, which addresses **(b) only**). All droplet figures are **indicative** — the droplet is being phased out (Azure student credits / HuggingFace), so production keep-up must be re-evaluated against the actually-chosen deploy target. A slow window must never stall the next window's capture/upload (FR-016, SC-007).

**Constraints**:
- Window/stride is **locked at 60 s / 10 s** by Constitution Principle II (NON-NEGOTIABLE), the spec (FR-002), and `docs/MODELS.md`. It MUST NOT be shortened. (The stale `window_eval_config: 30s` block in `metadata.json` is **not** the production config — see research R-0.)
- No numeric percentage/score/gauge anywhere (FR-015, SC-002); the model's `predict_proba` is **not** probability-calibrated.
- No global/fallback anchor; a user without an anchor gets the calibrate-first outcome (FR-011, SC-004).
- Webcam capture requires a secure context (HTTPS or `localhost`).
- Inference is **employees-only** (FR-010).
- `apps/api` holds **no broad DB credential** (no service-role key): all DB access is in the caller's RLS context via the forwarded user JWT + the publishable anon key (revised D-1, preserving DECISION-9's posture).

**Scale/Scope**: Graduation-project scale (tens of demo users, one concurrent session per user). One new backend router, one user-context (forwarded-JWT) data layer, two tables + one `SECURITY DEFINER` function, a thin tail-window option on the existing `compute_anchor` (no new extraction path), one new employee route + the check-in card states, reusing the calibration capture/detector stack.

---

## Constitution Check

*GATE: must pass before Phase 0 research; re-checked after Phase 1 design. Constitution v1.4.0.*

### Principle I — Privacy by Architecture (NON-NEGOTIABLE) — **PASS**

- Raw video frames stay within the device and the backend inference layer. The uploaded **continuous clip** is held **transiently in server memory**, decoded to its trailing 60 s of frames for extraction, and the clip + any temp file is **deleted in a `finally` block** (reuse of the proven `/anchor` pattern). No per-session clip buffer; no raw video is persisted or forwarded. (FR-027, SC-009)
- The manager-facing layer receives **nothing** from this feature: `monitoring_sessions` and `window_readings` have **no manager RLS policy** (unlike `profiles`, which grants direct-report SELECT). Managers cannot read sessions or readings at all.
- The raw decision signal (`stress_probability`, `label`) is held **server-only** via the column-grant whitelist (the `anchor_vector` mechanism): the authenticated owner can SELECT only `{captured_at, scored, band, skip_cause}` for the trend — never the probability. This also structurally enforces FR-015 ("no number"), and is the reason the **API** (not the browser) writes the reading row.
- The anchor is read **server-side only** via `get_my_anchor()` (a self-scoped `SECURITY DEFINER` function, in the caller's RLS context); it never enters an authenticated client SELECT. (revised D-1)
- **Write path (revised D-1)**: sessions/readings are written under **RLS as the user** (insert-own/select-own/update-own). The privacy invariant is unchanged — managers read nothing, raw probability stays server-only. The only relaxation vs. a server-only writer is that a user could fabricate **their own** readings; this is a deliberately deferred, low-stakes item (own data only), upgrade path = a dedicated INSERT-only role (not built now).
- Privacy-review note (Quality Gate 6) is recorded in this plan and in `contracts/inference-api.md`.

### Principle II — Subject-Disjoint ML Evaluation / calibration & windows (NON-NEGOTIABLE) — **PASS**

- 60 s window / 10 s stride honored and not shortened (FR-002). The stale 30 s `window_eval_config` is explicitly **not** used (research R-0); the production contract is the 60 s LOSO block (recall 0.83) per `docs/MODELS.md` + constitution.
- Every reading is a **per-user delta** from the stored anchor; **no global/fallback anchor**; a missing anchor fails clearly to the calibrate-first outcome (FR-011). (Principle II red-flag 2 respected.)
- Operating point **0.53** is read from model metadata (`loso_metrics_60s_calibrated.threshold_sweep_recommended.threshold`), exposed as config, never a hard-coded literal (FR-012).
- No model change, no retraining, no new artifact; the committed `serenify-video-lbptop-motion-rf-calibrated@2.0.0` is used as-is (`docs/MODELS.md` entry exists). This feature adds the **first caller and first test** of `predict_delta`.

### Principle III — Modality Isolation — **PASS**

- Inference consumes `packages/ml-video`'s public interface only (`compute_anchor` for the shared 2958-d extraction + coverage gate; `Predictor.predict_delta`). The continuous design adds only a thin **tail-window option** on `compute_anchor` (a trailing-window bound on the existing VFR sampler so the server scores the last 60 s of the continuous clip) — it **reuses** the existing decode + sampler + `lbp_top_features`/`motion_features`, **not a second copy** of extraction. Other new code lives in `apps/api` + `apps/web` + a migration; `ml-video`'s change is this single additive option (+ tests). (The B2 `compute_anchor_multiclip` entry + seam-aware motion are retired — R-5.)

### Principle IV — LLM Provider Abstraction — **N/A**

- No LLM access in this feature.

### Principle V — Calm-First Design Language — **PASS**

- Color roles per the mock and Principle V: **meadow** = At ease + primary/forward actions; **amber** = stress signal only (A little tense + Tense, soft-tint treatment); **foggy** = attention/error (permission, blocked, out-of-frame prompt, the skipped-read note, and the calibrate-first panel). The out-of-frame and skipped-read affordances are **foggy, not amber**. (FR-022)
- The ambient bloom is the signature; **no big number or gauge** (FR-021, FR-015). Built against Graphite tokens, not the mock's hex.
- Copy is calm, non-alarmist, no exclamation marks; state names are exactly **At ease / A little tense / Tense** (FR-026). Warming-up copy is reassuring ("getting a read on things"); the skipped-read note names a likely cause + a gentle fix (reusing the 005/006 cause vocabulary).

### Principle VI — Responsive & Accessible by Default — **PASS**

- The monitoring stage stacks at ≥ 360 px (bloom shrinks, controls go full-width and stack, pill/viewfinder reposition) — resolves mock-gap MG-3.
- `prefers-reduced-motion` suppresses the bloom's breathing while color + trend stay legible (existing `useMediaQuery` pattern; FR-025, edge case). Visible keyboard focus on all controls; touch targets ≥ 44×44 px.

### Principle VII — Mandatory Testing Per PR — **PASS**

- Backend pytest: the first `predict_delta` test; the inference service (extract→anchor→delta→predict→re-threshold→smooth→band); the no-anchor / employees-only guards; RLS/grant assertions; the skipped-window path. Target ≥ 70 % on the new business logic.
- Frontend Vitest + RTL: the session state machine, band→color mapping, warming-up gating, reduced-motion, the check-in card variants + recap empty state.
- Playwright: one **employee** happy-path e2e (start → permission → warming-up → reading → end → dashboard recap).
- ML fixture regression: the webm/VFR **codec** fidelity check (CFR mp4 vs VFR webm) stays **scheduled hardening, not a ship blocker** (Test Plan Notes, R-6). There is **no multi-clip assembly fidelity gate** — the continuous 60 s window is faithful by construction (R-5). A unit test pins the new tail-window option: a deterministic **file-global-grid integer-index suffix invariant** (the *enforced* guard for faithful-by-construction — CI-runnable on synthetic timestamps, no video) **plus** the reduce-to-`compute_anchor` case for a ≤ 60 s clip (tasks T006).
- **Continuous-capture windowing validation (front-loaded, light, R-7)**: on **real Chrome + real Safari/iOS** (not Playwright — it has given false cross-browser confidence), confirm the continuous recording + growing upload + last-60 s tail-extract **works** (the contiguous recording-so-far is decodable; the server returns a 2958-d vector each stride) and **keeps up** (per-stride server time within the 10 s stride across a 5-min session). This **reuses the proven `/anchor` upload+extract path**. It stays the **Safari/iOS pre-production gate** but is **no longer a fidelity gate** — a keep-up breach means the deferred rolling-buffer optimization is needed for production, not that windowing re-opens. (Prior plan: B1 container-reassembly and B2 multi-clip frame-concat, both rejected — R-5/R-7.)
- `smoke-tests.md` lists human checks (camera permission on real browsers; **Safari/iOS** secure-context + capture; HTTPS/localhost; low-light skip; mobile 360 px; reduced-motion).

### Principle IX — Secrets Discipline (NON-NEGOTIABLE) — **PASS (no new secret — stronger than the original plan)**

- The revised D-1 introduces **no new secret**. `apps/api` adds `SUPABASE_ANON_KEY` (the **publishable** anon key — already shipped to browsers as `NEXT_PUBLIC_SUPABASE_ANON_KEY`; it grants nothing beyond RLS) and makes `SUPABASE_URL` required. All DB access is in the caller's RLS context via the **forwarded user JWT**; there is **no service-role key** in `apps/api`. This is strictly stronger than the original service-role design and preserves DECISION-9's "no broad DB credential" posture.
- The anchor read (`get_my_anchor()`) and all session/reading I/O resolve `auth.uid()` from the forwarded JWT — the established working pattern (DECISION-9 note: SECURITY DEFINER RPCs via the caller's token, not service-role). Tested: a caller can never retrieve or write another user's data.

### Principle X — Dataset Stewardship (NON-NEGOTIABLE) — **PASS**

- Demo accounts use synthetic names (existing seed). No StressID withheld-consent subject's frames appear in any monitoring-page demo/screenshot.

### Transport rule (Architecture Constraints) — **DEVIATION (justified, logged)**

The constitution says "Real-time prediction streams and live signal-quality indicators travel over WebSockets, not polling." This feature uses **per-window HTTP request/response** (multipart video upload → reading in the response), not a WebSocket. This is a conscious, documented deviation — recorded in **Complexity Tracking** below and in `docs/DECISIONS.md`. It is **not** polling (the prediction is the synchronous response to an upload the client must send regardless), and the live signal-quality indicator (framing/out-of-frame) is computed **on-device**, not streamed. WebSocket is reserved for a future server-push streaming optimization, paired with the deferred server-side rolling decoded-frame buffer (D-2 / R-5 future note).

**Gate result: PASS** with one logged, justified deviation. No NON-NEGOTIABLE principle is violated.

---

## Project Structure

### Documentation (this feature)

```text
specs/008-stress-inference-service/
├── plan.md                          # This file
├── research.md                      # Phase 0 — D-1…D-4, mock-gaps, window discrepancy, windowing
├── data-model.md                    # Phase 1 — entities, tables, RLS, retention, trend/recap, 009 seam
├── contracts/
│   ├── inference-api.md             # Phase 1 — session/window/end HTTP contract + outcomes
│   └── smoothing-and-banding.md     # Phase 1 — rolling window, banding thresholds, cold-start
├── quickstart.md                    # Phase 1 — run + verify locally
├── tasks.md                         # Phase 2 — /speckit-tasks (NOT created here)
└── smoke-tests.md                   # Phase 2/impl — human-validated checks
```

### Source Code (repository root)

```text
apps/api/                                   # FastAPI backend
├── app/
│   ├── main.py                             # +include monitoring.router; load operating point into app.state
│   ├── config.py                           # +SUPABASE_ANON_KEY (publishable), SUPABASE_URL now required, +STRESS_OPERATING_POINT, +STRESS_TENSE_BAND
│   ├── auth.py                             # existing verify_jwt (reused); + require_employee (forwarded-JWT select-self on profiles.role)
│   ├── schemas.py                          # +monitoring request/response (Pydantic discriminated outcomes)
│   ├── supabase_user.py                    # NEW — user-context Supabase client (anon key + per-request forwarded JWT); calls get_my_anchor(), RLS session/reading IO. NO service-role.
│   ├── routers/
│   │   └── monitoring.py                   # NEW — POST /monitoring/sessions, …/{id}/windows (segment), …/{id}/end, PATCH …/{id}
│   └── services/
│       ├── inference.py                    # NEW — tail-extract last 60 s→anchor→delta→predict→re-threshold→persist (continuous single-stream; no clip buffer)
│       └── smoothing.py                    # NEW — rolling smoothing + banding + cold-start (D-3)
└── tests/
    ├── test_monitoring_endpoints.py        # NEW — session/window/end, guards, RLS keying
    ├── test_inference_service.py           # NEW — the read path incl. anchor decode + re-threshold
    └── test_smoothing.py                   # NEW — D-3 numbers (window=4, bands, cold-start=4)

packages/ml-video/
├── src/ml_video/
│   └── anchor.py                           # +tail-window option on compute_anchor (trailing-window bound on the VFR sampler; reduces to compute_anchor for ≤60 s); reuses decode+sampler+features (R-5). RETIRED: compute_anchor_multiclip
└── tests/
    ├── test_predict_delta.py               # NEW — FIRST predict_delta test (shape + 0.53 re-threshold)
    ├── test_tail_window.py                 # NEW — pins the tail-window option: file-global-grid integer-index suffix invariant (faithful-by-construction guard, CI-runnable) + reduces to compute_anchor for a ≤60 s clip
    └── test_webm_vfr_fidelity.py           # NEW (scheduled hardening) — mp4/CFR vs webm/VFR 2958-d tolerance. RETIRED: test_multiclip_fidelity.py (multi-clip gate)

apps/web/                                   # Next.js frontend
├── app/(authed)/app/monitor/page.tsx       # NEW — employee-only monitoring page (server guard)
├── components/
│   ├── monitor/                            # NEW
│   │   ├── monitoring-session.tsx          # orchestrator (reuses capture + face-detect)
│   │   ├── use-monitoring-session.ts       # reducer/state machine (7 op states)
│   │   ├── window-recorder.ts              # continuous recorder: one MediaRecorder (timeslice for incremental capture), uploads the contiguous recording-so-far each stride (research R-5)
│   │   ├── bloom.tsx                        # ambient breathing bloom (band→bloom color)
│   │   ├── camera-pill.tsx + viewfinder.tsx # state-driven pill + peek/pin self-view (graphics only)
│   │   ├── op-surfaces.tsx                  # permission / warming-up / out-of-frame / paused / blocked / calibrate-first / skipped-note
│   │   └── session-trend.tsx               # page trend (shared reader with the card)
│   ├── home/todays-checkin-card.tsx        # REPLACE placeholder → idle/monitoring/paused + recap + empty state
│   └── anchor/failure-state.tsx            # reuse CAUSE vocabulary (extract a shared CauseChip)
├── lib/
│   ├── api/monitoring-client.ts            # NEW — typed client → FastAPI (session/window/end)
│   ├── api/monitoring-reads.ts             # NEW — typed Supabase RLS reads (trend + recap; SELECT-own)
│   └── face-detect/*                        # REUSE — detector, use-framing-guide, cause-telemetry
└── tests/
    ├── (unit) components/monitor/*.test.tsx # state machine, band color, warming gate, reduced-motion, card variants
    └── e2e/employee-monitoring.spec.ts      # NEW — employee happy path

supabase/migrations/
└── 20260619000000_monitoring_sessions_and_readings.sql   # NEW — 2 tables, RLS (insert/select/update-own, no manager), column-grant whitelist, get_my_anchor() SECURITY DEFINER
```

**Structure Decision**: This follows the monorepo's locked layout (`apps/web`, `apps/api`, `packages/ml-*`, `supabase/`). Inference + continuous-clip decode + **tail-extraction of the last 60 s** (no multi-clip frame-concat assembly — retired with B2) + persistence are server-side in `apps/api` (new `services/` + `supabase_user.py`); the capture/UI work is in `apps/web`, reusing the calibration stack; the model package is consumed plus **one additive tail-window option** on `compute_anchor` — no new extraction path, no model change. All DB access is in the **caller's RLS context via the forwarded user JWT** (no service-role): the API writes/reads sessions+readings and calls `get_my_anchor()` as the user, and the browser also reads its own trend/recap via Supabase RLS (typed client) — matching how the codebase already reads `profiles`.

---

## Phase 0 — Research

See [`research.md`](./research.md). Resolves: **R-0** the 60 s-vs-30 s `metadata.json` discrepancy (use 60 s; flag the stale block; doc-only cleanup, no model-version bump / no anchor invalidation); **D-1 (revised)** anchor read via self-scoped `SECURITY DEFINER` `get_my_anchor()` in the caller's RLS context — **no service-role key**; **D-2 (revised)** session-aware endpoints + **continuous single-stream upload + server-side tail-extraction of the last 60 s** (B2 multi-clip frame-concat rejected); **D-3** smoothing/banding/cold-start numbers; **D-4** persistence schema shape (RLS insert/select-own, raw signal server-only, write-integrity deferred); **R-5 (revised; B1 NO-GO, B2 rejected → continuous)** one continuous recorder uploading the contiguous recording-so-far + server tail-extract via a thin tail-window option on `compute_anchor` (B1 container reassembly and B2 multi-clip frame-concat both **rejected** — B1: silent `motion_features` corruption; B2: per-clip sampling-phase reset, cosine 0.991 < 0.999, not reconstructable for real clips); **R-6** the webm/VFR **codec** fidelity hardening plan (no assembly dimension under continuous — faithful by construction); **R-7** the front-loaded but **lighter** continuous-capture windowing validation (works + keeps up on real Chrome + Safari/iOS — no fidelity gate); plus the seven resolved mock-gap decisions (warming-up state, ~90 s first reading, distinct skipped-read affordance, calibrate-first surface, mobile stacking, ended→dashboard, idle recap empty state).

## Phase 1 — Design & Contracts

- [`data-model.md`](./data-model.md) — `monitoring_sessions`, `window_readings`, the derived Smoothed Display State, RLS + column grants, retention, trend/recap aggregation, and the FR-020 seam for feature 009.
- [`contracts/inference-api.md`](./contracts/inference-api.md) — the three endpoints, request/response shapes, the four distinct outcomes (scored / warming-up / skipped / no-anchor), error/status mapping, non-blocking guarantees, and the privacy-review note.
- [`contracts/smoothing-and-banding.md`](./contracts/smoothing-and-banding.md) — the concrete D-3 numbers and the config surface.
- [`quickstart.md`](./quickstart.md) — local run + verification recipe.
- Agent context updated: `CLAUDE.md` SPECKIT markers repointed to this plan.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **Per-window HTTP request/response transport instead of WebSocket** (Architecture Constraints "real-time streams over WebSockets, not polling") | Inference is **upload-bound**: the client uploads the contiguous recording-so-far every stride, and the reading is the natural synchronous response. Reusing the proven `/anchor` multipart path keeps one transport for all video. The live signal-quality indicator (framing/out-of-frame) is computed **on-device**, so nothing is "polled" from the server. | A WebSocket carrying video every 10 s adds reconnect, backpressure, and framing complexity with no latency benefit while inference is upload-bound. It is reserved for a **future** server-push streaming optimization. Logged in `docs/DECISIONS.md` (2026-06-19). |

*The single remaining entry is a justified deviation, not an unjustified violation, and does not touch a NON-NEGOTIABLE principle.*

> **Amendment note (2026-06-19)**: the original plan's second Complexity-Tracking entry (`apps/api` gains a Supabase **service-role** client) is **removed** — the revised D-1 uses a self-scoped `SECURITY DEFINER` read in the caller's RLS context with **no broad credential**, so there is no longer a Principle-IX deviation here (it is strictly stronger). See `research.md` D-1 and `docs/DECISIONS.md` (2026-06-19 amendment).

### Deferred / front-loaded items (recorded; not built in this plan)

- **Write-integrity (deferred, low-stakes)**: under RLS-as-the-user writes, a user could fabricate **their own** readings. Accepted (own data only; managers see nothing; privacy invariant intact). Upgrade path = a **dedicated INSERT-only Postgres role** held by the API, with INSERT revoked from `authenticated` — built only if integrity ever needs enforcing.
- **Continuous-capture windowing validation (front-loaded, light, R-7)**: validate that continuous recording + growing upload + last-60 s tail-extract **works and keeps up** on real Chrome + Safari/iOS — front-loaded, reusing the `/anchor` path. **No longer a fidelity gate** (faithful by construction); it stays the Safari/iOS pre-production gate. (Supersedes the B2 multi-clip fidelity HARD GATE and the B1 container-reassembly spike, both rejected.)
- **`metadata.json` hygiene**: remove/annotate the stale `window_eval_config` (30 s) block — metadata/doc only, **no `model_version` bump, no anchor invalidation**, do not edit the model artifact (R-0; flag for the model owner).
- **Server-side rolling decoded-frame buffer** (efficiency): under continuous upload the server re-decodes the **whole recording-so-far** each stride to reach its trailing 60 s, a cost that grows with elapsed session time (flagged in R-5 — it can exceed the 10 s stride late in a 5-min session on the droplet). A later optimization retains the trailing 60 s of sampled frames and decodes only the **newest increment** each stride (O(stride), not O(elapsed)). It addresses **only the growing-decode component**; the **constant per-window extract** (MediaPipe + LBP) is a separate fixed cost the buffer does **not** touch — an extract-bound breach calls for a slower cadence or GPU MediaPipe instead (R-5). **Deferred — not built now**; build it before relying on long droplet sessions in production. Pairs with the future WebSocket transport.
