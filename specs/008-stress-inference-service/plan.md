# Implementation Plan: Stress Inference Service

**Branch**: `008-stress-inference-service` | **Date**: 2026-06-19 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from `specs/008-stress-inference-service/spec.md`

**Visual contract**: [`serenify-008-monitoring-mock.html`](../../serenify-008-monitoring-mock.html) (repo root) — reference for *intent*; build against real Graphite tokens (`apps/web/app/globals.css`) and existing `apps/web` components, not the mock's inline hex/CSS.

**Supporting artifacts**: [`research.md`](./research.md) (D-1…D-4 + mock-gap resolutions + window discrepancy + windowing approach), [`data-model.md`](./data-model.md), [`contracts/inference-api.md`](./contracts/inference-api.md), [`contracts/smoothing-and-banding.md`](./contracts/smoothing-and-banding.md), [`quickstart.md`](./quickstart.md).

---

## Summary

Feature 008 is the **wiring** that turns the already-built, already-verified video model into the first real stress reading an employee sees. The trained model, `Predictor.predict_delta`, and the shared 2958-d feature-extraction path exist; this feature connects them to (1) a webcam capture loop that records fixed **60-second windows on a 10-second stride**, (2) an authenticated, **employees-only** backend inference endpoint, (3) per-window persistence, and (4) the monitoring UI surfaces from the approved mock.

The technical shape, after resolving the four deferred decisions:

- **Session-aware inference, server-authoritative.** A small set of FastAPI endpoints (`create session` → `score window` (×N) → `end session`) group readings cleanly. The server runs extraction, reads the user's anchor, computes `delta`, calls `predict_delta`, **re-thresholds `proba[1]` at the calibrated operating point 0.53** (ignoring `predict_delta`'s internal 0.5 label), **smooths and bands server-side**, persists the reading, and returns the band. The client is a thin renderer — this eliminates client/server smoothing divergence and guarantees the two trend surfaces agree (SC-008). (D-2, D-3)
- **Service-role anchor read (D-1 option a).** The API gains a scoped Supabase service-role client to read the caller's anchor by the **JWT-verified `user_id`** and to write sessions/readings server-side. This resolves the anchor-read path that feature 004 **explicitly deferred** to this feature ("future 005 server-side read" in `20260527000000_anchor_columns.sql`; 005 = now-008 after the ordering reshuffle). The anchor never reaches any authenticated client SELECT.
- **Two new tables, employee-only.** `monitoring_sessions` + `window_readings`, RLS-scoped to the owner with **no manager policy at all** (Principle I), and the raw per-window `stress_probability`/`label` columns held server-only via the column-grant whitelist pattern (mirrors `anchor_vector`). The persisted shape is sufficient for feature 009 to detect "sustained tense" without 008 building any trigger (FR-020). (D-4)
- **Reuse, no duplication.** The shared 2958-d extraction path (`ml_video.compute_anchor`, the same function calibration uses — it also runs the feature-006 coverage gate), feature 005's on-device face detector + self-view, and feature 006's usable-face-coverage gate + cause vocabulary are reused as-is. No second copy of extraction (Principle III).

The signature experience stays calm: an ambient breathing **bloom** drifts between **At ease / A little tense / Tense**; the first reading the user sees is already smoothed (warming-up until ~90–105 s); there is deliberately **no number or gauge** anywhere.

---

## Technical Context

**Language/Version**: Python 3.12 (FastAPI backend, `apps/api`); TypeScript strict (Next.js 16 App Router, `apps/web`); SQL (Supabase/Postgres migrations).

**Primary Dependencies**:
- Backend: FastAPI, Pydantic v2 / pydantic-settings, PyJWT (existing `verify_jwt`), `supabase-py` (**new** — service-role client), `ml_video` workspace package (existing: `compute_anchor`, `load_model`, `Predictor.predict_delta`), NumPy.
- Frontend: existing capture stack (`MediaRecorder`, `getUserMedia`), `@mediapipe/tasks-vision` FaceDetector (existing `lib/face-detect/*`), Framer Motion (existing, reduced-motion-gated), the typed Supabase browser client (existing), shadcn/Card/Button primitives (existing).
- DB: Supabase Postgres, RLS + column grants.

**Storage**: Supabase Postgres. Two new tables (`monitoring_sessions`, `window_readings`). The anchor is read from the existing `profiles.anchor_vector bytea`. **No raw video is ever persisted** (extracted in a temp file, deleted in `finally` — reuse of the `/anchor` Principle-I pattern).

**Testing**: pytest (backend + `ml-video`, incl. the **first-ever `predict_delta` test**); Vitest + React Testing Library (frontend component/state-machine logic); Playwright (one **employee** e2e happy path); ml-video fixture regression (incl. the **scheduled** webm/VFR fidelity hardening check — not a ship blocker); `smoke-tests.md` (human-validated, incl. camera flows that need HTTPS/localhost).

**Target Platform**: Web — Next.js on Vercel (frontend), FastAPI on a DigitalOcean droplet (backend), Supabase (DB/auth). Dev: `localhost` (secure context for webcam). Mobile ≥ 360 px supported (Principle VI).

**Project Type**: Web application (frontend + backend + ML package + DB migrations) — the monorepo's established layout.

**Performance Goals**: First smoothed reading within ~90–105 s; a refreshed reading ~every 10 s thereafter (SC-001). Per-window CPU extraction ~3–5 s on the dev laptop (MediaPipe is CPU-bound), comfortably inside the 10 s stride. A slow window must never stall the next window's capture/upload (FR-016, SC-007).

**Constraints**:
- Window/stride is **locked at 60 s / 10 s** by Constitution Principle II (NON-NEGOTIABLE), the spec (FR-002), and `docs/MODELS.md`. It MUST NOT be shortened. (The stale `window_eval_config: 30s` block in `metadata.json` is **not** the production config — see research R-0.)
- No numeric percentage/score/gauge anywhere (FR-015, SC-002); the model's `predict_proba` is **not** probability-calibrated.
- No global/fallback anchor; a user without an anchor gets the calibrate-first outcome (FR-011, SC-004).
- Webcam capture requires a secure context (HTTPS or `localhost`).
- Inference is **employees-only** (FR-010).

**Scale/Scope**: Graduation-project scale (tens of demo users, one concurrent session per user). One new backend router, one service-role data layer, two tables, one new employee route + the check-in card states, reusing the calibration capture/detector stack.

---

## Constitution Check

*GATE: must pass before Phase 0 research; re-checked after Phase 1 design. Constitution v1.4.0.*

### Principle I — Privacy by Architecture (NON-NEGOTIABLE) — **PASS**

- Raw video frames stay within the device and the backend inference layer. The window upload is extracted to a temp file and **deleted in a `finally` block** (reuse of the proven `/anchor` pattern); no raw video is persisted or forwarded. (FR-027, SC-009)
- The manager-facing layer receives **nothing** from this feature: `monitoring_sessions` and `window_readings` have **no manager RLS policy** (unlike `profiles`, which grants direct-report SELECT). Managers cannot read sessions or readings at all.
- The raw decision signal (`stress_probability`, `label`) is held **server-only** via the column-grant whitelist (the `anchor_vector` mechanism): the authenticated owner can SELECT only `{captured_at, scored, band, skip_cause}` for the trend — never the probability. This also structurally enforces FR-015 ("no number").
- The anchor is read **server-side only** (service role, keyed to the verified `user_id`); it never enters an authenticated client SELECT. (D-1)
- Privacy-review note (Quality Gate 6) is recorded in this plan and in `contracts/inference-api.md`.

### Principle II — Subject-Disjoint ML Evaluation / calibration & windows (NON-NEGOTIABLE) — **PASS**

- 60 s window / 10 s stride honored and not shortened (FR-002). The stale 30 s `window_eval_config` is explicitly **not** used (research R-0); the production contract is the 60 s LOSO block (recall 0.83) per `docs/MODELS.md` + constitution.
- Every reading is a **per-user delta** from the stored anchor; **no global/fallback anchor**; a missing anchor fails clearly to the calibrate-first outcome (FR-011). (Principle II red-flag 2 respected.)
- Operating point **0.53** is read from model metadata (`loso_metrics_60s_calibrated.threshold_sweep_recommended.threshold`), exposed as config, never a hard-coded literal (FR-012).
- No model change, no retraining, no new artifact; the committed `serenify-video-lbptop-motion-rf-calibrated@2.0.0` is used as-is (`docs/MODELS.md` entry exists). This feature adds the **first caller and first test** of `predict_delta`.

### Principle III — Modality Isolation — **PASS**

- Inference consumes `packages/ml-video`'s public interface only (`compute_anchor` for the shared 2958-d extraction + coverage gate; `Predictor.predict_delta`). **No second copy** of extraction. New code lives in `apps/api` + `apps/web` + a migration; `ml-video` is unchanged except for new tests.

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
- ML fixture regression: the webm/VFR fidelity hardening check is **scheduled hardening, not a ship blocker** (Test Plan Notes).
- `smoke-tests.md` lists human checks (camera permission on real browsers; HTTPS/localhost secure-context; low-light skip; mobile 360 px; reduced-motion).

### Principle IX — Secrets Discipline (NON-NEGOTIABLE) — **PASS (new secret, guardrailed)**

- D-1 introduces `SUPABASE_SERVICE_ROLE_KEY` to `apps/api` env. It is **env-only**, gitignored, set in the platform panel for prod — never committed (mirrors `apps/web`'s `serverEnv` posture and the existing `SUPABASE_JWT_SECRET`). The service-role client is used **only** to (a) read the caller's own anchor by the verified `user_id`, (b) read the caller's role for the employee gate, (c) write/read that user's sessions + readings. **Every query is keyed by the verified JWT `sub`; a client-supplied id is never trusted.** This keying discipline is the control (service role bypasses RLS) and is tested.

### Principle X — Dataset Stewardship (NON-NEGOTIABLE) — **PASS**

- Demo accounts use synthetic names (existing seed). No StressID withheld-consent subject's frames appear in any monitoring-page demo/screenshot.

### Transport rule (Architecture Constraints) — **DEVIATION (justified, logged)**

The constitution says "Real-time prediction streams and live signal-quality indicators travel over WebSockets, not polling." This feature uses **per-window HTTP request/response** (multipart video upload → reading in the response), not a WebSocket. This is a conscious, documented deviation — recorded in **Complexity Tracking** below and in `docs/DECISIONS.md`. It is **not** polling (the prediction is the synchronous response to an upload the client must send regardless), and the live signal-quality indicator (framing/out-of-frame) is computed **on-device**, not streamed. WebSocket is reserved for a future server-push streaming optimization, paired with the deferred server-side rolling-feature cache (D-2 future note).

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
│   ├── config.py                           # +SUPABASE_SERVICE_ROLE_KEY, +STRESS_OPERATING_POINT, +STRESS_TENSE_BAND
│   ├── auth.py                             # existing verify_jwt (reused); + require_employee dependency
│   ├── schemas.py                          # +monitoring request/response (Pydantic discriminated outcomes)
│   ├── supabase_admin.py                   # NEW — scoped service-role client (anchor read; sessions/readings IO)
│   ├── routers/
│   │   └── monitoring.py                   # NEW — POST /monitoring/sessions, …/{id}/windows, …/{id}/end
│   └── services/
│       ├── inference.py                    # NEW — extract→anchor→delta→predict→re-threshold→persist
│       └── smoothing.py                    # NEW — rolling smoothing + banding + cold-start (D-3)
└── tests/
    ├── test_monitoring_endpoints.py        # NEW — session/window/end, guards, RLS keying
    ├── test_inference_service.py           # NEW — the read path incl. anchor decode + re-threshold
    └── test_smoothing.py                   # NEW — D-3 numbers (window=4, bands, cold-start=4)

packages/ml-video/
└── tests/
    ├── test_predict_delta.py               # NEW — FIRST predict_delta test (shape + 0.53 re-threshold)
    └── test_webm_vfr_fidelity.py           # NEW (scheduled hardening) — mp4/CFR vs webm/VFR 2958-d tolerance

apps/web/                                   # Next.js frontend
├── app/(authed)/app/monitor/page.tsx       # NEW — employee-only monitoring page (server guard)
├── components/
│   ├── monitor/                            # NEW
│   │   ├── monitoring-session.tsx          # orchestrator (reuses capture + face-detect)
│   │   ├── use-monitoring-session.ts       # reducer/state machine (7 op states)
│   │   ├── window-recorder.ts              # 60s-window-on-10s-stride assembly (research R-5)
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
└── 20260619000000_monitoring_sessions_and_readings.sql   # NEW — 2 tables, RLS, column-grant whitelist
```

**Structure Decision**: This follows the monorepo's locked layout (`apps/web`, `apps/api`, `packages/ml-*`, `supabase/`). Inference and persistence are server-side in `apps/api` (new `services/` + `supabase_admin.py`); the capture/UI work is in `apps/web`, reusing the calibration stack; the model package is consumed, not modified. Reads split cleanly: **writes via FastAPI (service role)**, **reads via Supabase RLS in the browser** (typed client) — matching how the codebase already reads `profiles`.

---

## Phase 0 — Research

See [`research.md`](./research.md). Resolves: **R-0** the 60 s-vs-30 s `metadata.json` discrepancy (use 60 s; flag the stale block); **D-1** anchor read path (service-role, option a); **D-2** endpoint shape + upload/buffer model (session-aware + client-assembled 60 s window per stride; rolling-feature cache deferred); **D-3** smoothing/banding/cold-start numbers; **D-4** persistence schema shape; **R-5** the client 60 s-window-on-10 s-stride assembly approach; **R-6** the webm/VFR fidelity hardening plan; plus the seven resolved mock-gap decisions (warming-up state, ~90 s first reading, distinct skipped-read affordance, calibrate-first surface, mobile stacking, ended→dashboard, idle recap empty state).

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
| **Per-window HTTP request/response transport instead of WebSocket** (Architecture Constraints "real-time streams over WebSockets, not polling") | Inference is **upload-bound**: the client must send a 60 s video window every stride, and the reading is the natural synchronous response to that upload. Reusing the proven `/anchor` multipart path keeps one transport for all video. The live signal-quality indicator (framing/out-of-frame) is computed **on-device**, so nothing is "polled" from the server. | A WebSocket carrying 60 s video blobs every 10 s adds reconnect, backpressure, and framing complexity with no latency benefit while inference is upload-bound. It is reserved for a **future** server-push streaming optimization paired with the deferred server-side rolling-feature cache (D-2). Logged in `docs/DECISIONS.md` (2026-06-19). |
| **`apps/api` gains a Supabase service-role client** (extends DECISION-9's "no DB credentials" posture for the API) | The server must read the per-user anchor and write sessions/readings server-side (integrity: the client must not be able to fabricate persisted readings that feed feature 009). Feature 004 **explicitly deferred** this anchor-read path to this feature and anticipated the service-role read (`20260527000000_anchor_columns.sql`). | A self-scoped `SECURITY DEFINER` RPC (D-1 option b) adds a new DB-function surface and, if called from the browser, would deliver the anchor to the client — contrary to "keep the anchor out of any authenticated client SELECT." Service-role read is the maintainer's lean and the design's anticipated path. Guardrailed per Principle IX (env-only; keyed by verified `sub`). Logged in `docs/DECISIONS.md` (2026-06-19, D-1). |

*Both entries are justified deviations, not unjustified violations; neither touches a NON-NEGOTIABLE principle.*
