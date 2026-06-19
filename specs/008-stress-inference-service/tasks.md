---
description: "Task list — Stress Inference Service (008)"
---

# Tasks: Stress Inference Service

**Input**: Design documents from `specs/008-stress-inference-service/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/inference-api.md`, `contracts/smoothing-and-banding.md`, `quickstart.md`

**Tests**: INCLUDED. Constitution Principle VII makes testing mandatory for this PR (first-ever `predict_delta` test; smoothing/endpoint/RLS tests; one employee Playwright happy-path; the multi-clip fidelity **HARD GATE**; the webm/VFR codec hardening check; real-Safari smoke — **not** Playwright-only).

**Organization**: Tasks are grouped by user story (US1–US4 from `spec.md`). **Phase 2 is a front-loaded, gating windowing validation** — per the amended plan (B1 container-reassembly **NO-GO** → **B2** standalone-clips + multi-clip frame-concat). Nothing past the Phase-2 GATE is built until both gate checks pass.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 / US4 (setup, gate, foundational, and polish tasks carry no story label)

## Windowing decision in force (read before starting)

- **B1 (single timeslice recorder + server-side container reassembly) is REJECTED** — R-7 structural NO-GO (research R-5/R-7, `docs/DECISIONS.md` 2026-06-19, `docs/CHANGELOG.md`). Reasons: `[chunk0 + recent tail]` isn't a clean trailing 60 s without container surgery; the splice's time discontinuity **silently corrupts `motion_features`** (spurious diff inflates max/std across the 2868 motion dims — a decode can "succeed" yet be wrong); webm timeslice boundaries aren't guaranteed cluster-aligned.
- **B2 (ADOPTED)**: the client **stops/restarts** a single `MediaRecorder` every ~10–12 s so each clip is a **complete, independently-decodable** standalone clip; the server buffers the last ~6 clips, **decodes each via the existing extraction path**, and **concatenates the sampled frames** into one ~150-frame / ~60 s set for LBP-TOP ⊕ motion (a **new** `compute_anchor_multiclip` ml-video entry — reuses per-clip internals, not a second copy; Principle III).
- A B1 harness exists at `_scratch-008-b1-spike/` for **optional** empirical confirmation; the decision does **not** wait on it.

---

## Phase 1: Setup (enable the gate — minimal)

**Purpose**: Just enough scaffolding to run the Phase-2 windowing GATE. No feature code yet.

- [x] T001 [P] Verify `packages/ml-video` test env: `compute_anchor`, `Predictor.predict_delta`, `load_model()` import and `load_model()` passes its startup contract check (baseline for the gate). Record the working interpreter (`packages/ml-video/.venv`) in `specs/008-stress-inference-service/smoke-tests.md`.
- [x] T002 [P] Build the throwaway **B2 capture spike harness** at `_scratch-008-b2-spike/` (a minimal static page: a single `MediaRecorder` in **stop/restart** mode emitting standalone ~10–12 s clips with a download button per clip, plus a **continuous 60 s** reference-record mode). This is disposable scaffolding for the real-device gate, not shipped UI.
- [x] T003 [P] Add `packages/ml-video/tests/fixtures/multiclip/` (with `chrome/` and `safari/` subdirs) and a tiny decode-smoke helper `packages/ml-video/tests/helpers/decode_smoke.py` (`cv2.VideoCapture` opens a path and yields a frame count) used by the capture-validation task.

**Checkpoint**: harness + fixture scaffolding ready — the GATE can run.

---

## Phase 2: 🚧 WINDOWING VALIDATION GATE (B2) — FRONT-LOADED, BLOCKS EVERYTHING BELOW

**Purpose**: De-risk the windowing approach on **real devices** before any feature build. Per the amended plan, **no Phase-3+ task may start until BOTH gate checks (T008) pass** on Chrome **and** Safari/iOS.

**⚠️ CRITICAL**: This is the Safari/iOS pre-production gate. Validate on **real browsers, not Playwright** (Playwright has given false cross-browser capture/timing confidence — see the e2e-load-timing flake history).

### Gate check 1 — B2 capture validation (real devices)

- [ ] T004 [P] Record B2 fixtures on **real Chrome (webm)** using the T002 harness: the same ~60 s of content **two ways** — (a) one continuous clip, (b) ~6 stop/restart standalone clips — into `packages/ml-video/tests/fixtures/multiclip/chrome/`.
- [ ] T005 [P] Record B2 fixtures on **real Safari/iOS (fragmented MP4)** the same two ways into `packages/ml-video/tests/fixtures/multiclip/safari/`. (Safari emits fMP4, not webm — the fragile case.)
- [ ] T006 B2 capture validation smoke (manual, real Chrome + Safari/iOS — **not** Playwright): assert each standalone clip is **independently decodable** (`decode_smoke.py` opens it and yields frames), the **frames-lost-per-restart seam is within an agreed budget**, and there are **no recorder glitches across the ~5 seams** of a 60 s window. Define the seam budget and record pass/fail + frame counts per browser in `specs/008-stress-inference-service/smoke-tests.md`. (depends T004, T005)

### Gate check 2 — multi-clip extraction entry + fidelity HARD GATE

- [x] T007 Implement `compute_anchor_multiclip(clip_paths) -> (2958,)` in `packages/ml-video/src/ml_video/anchor.py` (decode each clip via the existing `extract_landmarks`, concatenate the per-clip **sampled frames + landmarks** into one ~150-frame / ~60 s set, then run `lbp_top_features` ⊕ `motion_features`; per-clip feature-006 coverage gate preserved). Export it from `packages/ml-video/src/ml_video/__init__.py`. **Reuses** existing internals — not a second copy (Principle III).
- [x] T008 **Multi-clip fidelity HARD GATE** test `packages/ml-video/tests/test_multiclip_fidelity.py`: asserts the multi-clip 2958-d vector (T007 over the ~6 stop/restart clips) is **within tolerance** of the same ~60 s as **one continuous clip**, for **both** the Chrome and Safari fixtures; explicitly **measures and bounds** the two known seam effects — the per-seam `motion_features` diff and the frames lost per restart. **Agent-built + synthetic layer green** (5 tests prove the assembly); the real-fixture gate **skips until the human records** (T004/T005). (depends T007, T004, T005)

### 🚦 GATE DECISION

- [ ] T009 **GATE checkpoint**: T006 (capture) **and** T008 (fidelity) pass on Chrome **and** Safari/iOS → unblock Phase 3+. **If the fidelity gate fails, STOP** — the windowing approach must be revisited (escalate a B2 NO-GO and re-plan) **before any further build**. Record the gate outcome in `specs/008-stress-inference-service/smoke-tests.md` and note it in `docs/DECISIONS.md`.

**Checkpoint**: windowing proven on real devices — feature build may begin.

---

## Phase 3: Foundational (post-GATE blocking prerequisites)

**Purpose**: Shared backend/DB infrastructure every user story needs. **Depends on the Phase-2 GATE (T009).**

- [ ] T010 [P] DB migration `supabase/migrations/20260619000000_monitoring_sessions_and_readings.sql`: create `public.monitoring_sessions` + `public.window_readings` per `data-model.md` (columns, CHECKs, FKs `ON DELETE CASCADE`, indexes `(user_id, started_at desc)`, `(session_id, captured_at)`, `(user_id, captured_at)`); enable **+ FORCE** RLS; **select-own / insert-own / update-own** policies; **no manager policy**; per-role `REVOKE ALL FROM anon, authenticated` then explicit grants with the **SELECT column whitelist excluding `label` + `stress_probability`** and the **INSERT grant including** them.
- [ ] T011 Add `public.get_my_anchor()` (`SECURITY DEFINER`, filters `auth.uid()`, `STABLE`, `SET search_path=''`, `OWNER TO postgres`, `REVOKE EXECUTE FROM PUBLIC, anon`, `GRANT EXECUTE TO authenticated`; mirrors `has_anchor()`) to the **same** migration file `supabase/migrations/20260619000000_monitoring_sessions_and_readings.sql`. (same file as T010 → sequential)
- [ ] T012 [P] `apps/api/app/config.py`: add `SUPABASE_ANON_KEY` (required; **publishable**, not a secret), make `SUPABASE_URL` required, add `STRESS_OPERATING_POINT` (default **read from** `metadata.json → loso_metrics_60s_calibrated.threshold_sweep_recommended.threshold` = 0.53 — never a hard-coded literal) and `STRESS_TENSE_BAND` (default 0.70). **No service-role key.** (contracts/inference-api.md Config surface; FR-012)
- [ ] T013 [P] `apps/api/app/supabase_user.py` (NEW): user-context Supabase client (`create_client(url, anon_key)` + per-request `postgrest.auth(<forwarded JWT>)`); helpers to call `get_my_anchor()` and to do RLS session/reading insert/select/update **as the user** — **no service-role**. (revised D-1)
- [ ] T014 [P] `apps/api/app/auth.py`: add `require_employee` dependency (forwarded-JWT select-self on `profiles.role`; non-employee → **403** `{"error":"forbidden_role"}`). Reuse existing `verify_jwt`. (FR-010)
- [ ] T015 [P] `apps/api/app/schemas.py`: Pydantic monitoring models — create/end/patch payloads + the **discriminated `outcome`** response union (`reading` | `warming_up` | `skipped`), and the create-session response (`session_id`, `model_version`). (contracts/inference-api.md)
- [ ] T016 [P] **First-ever `predict_delta` test** `packages/ml-video/tests/test_predict_delta.py`: assert `predict_delta(delta)` returns `(label, proba)` with `proba` shape `(2,)`; lock the **0.53 re-threshold** semantics on `proba[1]` and that the internal 0.5 label is ignored for display. (Principle VII; Test Plan Notes)
- [ ] T017 `apps/api/app/main.py`: include `monitoring.router`; at startup load the model + resolve `STRESS_OPERATING_POINT` from metadata into `app.state` (fail-fast). (depends T012)

**Checkpoint**: backend foundation + DB ready — user stories can begin (US1 first).

---

## Phase 4: User Story 1 — Live stress read during a check-in (Priority: P1) 🎯 MVP

**Goal**: A calibrated employee starts a check-in, grants the camera, and sees an already-smoothed three-band reading on the ambient bloom — warming-up until ~90–105 s, then refreshing ~every 10 s — with **no number anywhere**.

**Independent Test**: With a calibrated employee account, Start check-in → grant camera → confirm warming-up, then a smoothed band (At ease / A little tense / Tense) appears at ~90–105 s and updates ~every 10 s, with no percentage/gauge on any surface.

### Backend (US1)

- [ ] T018 [P] [US1] `apps/api/app/services/segment_buffer.py` (NEW): transient per-session **standalone-clip** buffer — append each uploaded clip, keep the last ~6, evict the oldest; expose the ~6 clip paths for extraction; **clear on pause/end**; delete clips + any temp files in `finally`. (research R-5/B2; Principle I)
- [ ] T019 [P] [US1] `apps/api/app/services/smoothing.py` (NEW): rolling mean over the last **N=4 scored** `proba[1]`, banding (`t_low=0.53`, `t_high=0.70`), cold-start **M=4** → `warming_up`; skipped windows excluded from the buffer and the M count. (contracts/smoothing-and-banding.md; D-3)
- [ ] T020 [US1] `apps/api/app/services/inference.py` (NEW): the read path — assemble clip set (T018) → `compute_anchor_multiclip` (T007) → `get_my_anchor()` (T013) → `delta = current − anchor` → `predict_delta` → **re-threshold `proba[1] ≥ STRESS_OPERATING_POINT`** → smooth + band (T019) → persist a `window_readings` row under RLS (server-only `label`+`stress_probability`). On `FeatureExtractionError` → skipped reading. (depends T007, T013, T018, T019)
- [ ] T021 [US1] `apps/api/app/routers/monitoring.py` (NEW): `POST /monitoring/sessions` (require_employee; **anchor-presence guard up front** → **409** `{"outcome":"no_anchor"}`; insert session under RLS) and `POST /monitoring/sessions/{id}/windows` (accept one standalone clip; run T020 in a **threadpool** so a slow window never blocks the next; return `reading` / `warming_up` / `skipped`; **never** return a probability). (depends T014, T015, T020)
- [ ] T022 [P] [US1] `apps/api/tests/test_smoothing.py`: warm-up (<4 scored → `band is None`), banding boundaries (`0.52→at_ease`, `0.53→a_little_tense`, `0.69→a_little_tense`, `0.70→tense`), drift-not-flicker (SC-003), skipped excluded, config override moves boundaries (proves no hard-coded literal). (contracts/smoothing-and-banding.md Tests)
- [ ] T023 [P] [US1] `apps/api/tests/test_inference_service.py`: read path with a stubbed predictor + anchor — anchor `bytea` decode to `(2958,)`, `delta`, **re-threshold at 0.53**, server-only columns written, skipped path on `FeatureExtractionError`.
- [ ] T024 [US1] `apps/api/tests/test_monitoring_endpoints.py` (US1 slice): create returns 201 / **403 forbidden_role** (non-employee) / **409 no_anchor**; window returns `warming_up` before ~60 s of clips, `reading` after warm-up, `skipped` on coverage failure; RLS keys writes to the **verified `sub`** (a caller can't write another user's rows; SC-004 no global anchor). (depends T021)

### Frontend (US1)

- [ ] T025 [P] [US1] `apps/web/lib/api/monitoring-client.ts` (NEW): typed client → FastAPI (`createSession`, `submitClip`, `endSession`, `patchStatus`); sends the forwarded access token; multipart for the clip.
- [ ] T026 [P] [US1] `apps/web/components/monitor/window-recorder.ts` (NEW): **stop/restart standalone-clip** recorder — a single `MediaRecorder` stopped/restarted each ~10–12 s stride, emitting one standalone clip and uploading the newest (fire-and-forget, **non-blocking**; FR-016). Reuse feature-005 `getUserMedia` + secure-context. (B2)
- [ ] T027 [P] [US1] `apps/web/components/monitor/use-monitoring-session.ts` (NEW): reducer/state machine — US1 op-states (permission, **warming-up**, active, blocked, + transient skipped-read note over the last band). Maps `outcome`→state and `band`→display; holds warming-up until the server stops returning `warming_up`. (mock-gap #1/#2)
- [ ] T028 [P] [US1] `apps/web/components/monitor/bloom.tsx` (NEW): ambient breathing **bloom**; band→color role (meadow = At ease; **amber soft-tint** = a-little-tense/tense; warming-up = neutral/meadow-muted); `prefers-reduced-motion` suppresses breathing; built on **Graphite tokens**, no number/gauge. (FR-021, FR-022, Principle V)
- [ ] T029 [P] [US1] `apps/web/components/anchor/failure-state.tsx`: extract a **shared `CauseChip`** from the feature 005/006 cause vocabulary so the skipped-read note and calibration reuse one component. (Principle III reuse)
- [ ] T030 [P] [US1] `apps/web/components/monitor/op-surfaces.tsx` (US1 subset): permission, **warming-up** ("getting a read on things"), blocked, and the **foggy "skipped a read" note** (distinct from out-of-frame; names a likely cause + gentle fix via `CauseChip`; bloom keeps the last band). (mock-gap #3; FR-013, FR-022 foggy-not-amber)
- [ ] T031 [US1] `apps/web/components/monitor/camera-pill.tsx` + `viewfinder.tsx` (NEW; US1 subset): state-driven pill (recording / camera off) + peek/pin self-view showing **framing graphics only** (no words on the raw video). (FR-023)
- [ ] T032 [US1] `apps/web/components/monitor/monitoring-session.tsx` (NEW): orchestrator wiring the recorder (T026), the feature-005 **face detector gate** (no face → **no upload**, FR-003), the state machine (T027), bloom (T028), op-surfaces (T030), and the pill (T031). (depends T025–T031)
- [ ] T033 [US1] `apps/web/app/(authed)/app/monitor/page.tsx` (NEW): **employee-only** monitoring page with a **server-side role guard** (non-employees redirected); mounts `monitoring-session`; requires secure context. (FR-010)
- [ ] T034 [US1] `apps/web/components/home/todays-checkin-card.tsx`: add the **Start check-in** action (explicit camera-permission request; FR-001) routing idle → `/app/monitor`. (recap/empty-state deferred to US4)
- [ ] T035 [P] [US1] `apps/web/tests/unit/components/monitor/` (Vitest + RTL): state-machine transitions, band→color mapping, **warming-up gating** (no band before cold-start), reduced-motion suppression, "no number rendered" assertion. (Principle VII)

**Checkpoint**: US1 is a complete, demoable MVP — a real live smoothed read end-to-end.

---

## Phase 5: User Story 2 — Session control & presence handling (Priority: P2)

**Goal**: Pause/Resume (release/re-acquire camera) and End; out-of-frame auto-pause (self-view + foggy prompt) with auto-resume; auto-end on prolonged absence; no-face windows never upload.

**Independent Test**: During a session, step out of frame → auto-pause + self-view + foggy prompt → auto-resume on return; manual Pause releases the camera, Resume restarts, End returns to the dashboard with an updated recap.

- [ ] T036 [US2] `apps/api/app/routers/monitoring.py`: add `PATCH /monitoring/sessions/{id}` (status `paused|active|out_of_frame` under RLS update-own; **clear the clip buffer on `paused`**) and `POST /monitoring/sessions/{id}/end` (`ended_at`, `status='ended'`, `end_reason`; **clear the buffer**). (depends T021)
- [ ] T037 [P] [US2] `apps/api/tests/test_monitoring_endpoints.py` (US2 slice): PATCH transitions, end, **409 cannot-transition an ended session**, RLS update-own; buffer cleared on pause/end.
- [ ] T038 [US2] Extend `apps/web/components/monitor/use-monitoring-session.ts` + `monitoring-session.tsx`: out-of-frame (auto-pause after **90 s** no-face, show self-view + foggy prompt, **auto-resume** on return within ~one stride), manual **Pause** (release camera) / **Resume** (re-acquire, re-enter permission if revoked), **auto-end** after **5 min** absence, manual **End** → dashboard. (FR-005/006/007; SC-006)
- [ ] T039 [P] [US2] Extend `apps/web/components/monitor/op-surfaces.tsx`: **out-of-frame** surface (foggy, self-view, "move back into frame") and **paused** surface — both **foggy, not amber**. (FR-004/007, FR-022)
- [ ] T040 [P] [US2] Extend `apps/web/components/monitor/camera-pill.tsx` / `viewfinder.tsx`: out-of-frame + paused pill states; self-view reveal on out-of-frame.
- [ ] T041 [P] [US2] `apps/web/tests/unit/components/monitor/` (US2): out-of-frame/paused/resume/end transitions, auto-pause/auto-end timing logic, foggy-not-amber styling assertions.

**Checkpoint**: US1 + US2 both work; sessions are robust and respectful.

---

## Phase 6: User Story 3 — Calibrate-first guard for users without an anchor (Priority: P2)

**Goal**: A no-anchor employee gets a recognizable **calibrate-first** outcome routing to calibration — never a fabricated reading, never a global/fallback anchor.

**Independent Test**: With an account that has no stored anchor, Start check-in → the foggy calibrate-first panel with "Start calibration"; no stress band is ever shown.

- [ ] T042 [US3] `apps/api/app/routers/monitoring.py`: finalize the **no_anchor** outcome — **409** `{"outcome":"no_anchor"}` at create when `get_my_anchor()` is NULL, plus a **defensive mid-session 409** if the anchor disappears; never substitute a global/fallback anchor. (FR-011, SC-004)
- [ ] T043 [P] [US3] `apps/api/tests/test_monitoring_endpoints.py` (US3 slice): create with no anchor → 409 no_anchor; assert **no** reading is ever produced without the user's own anchor (SC-004).
- [ ] T044 [US3] `apps/web/components/monitor/op-surfaces.tsx` + `use-monitoring-session.ts`: **calibrate-first** foggy panel (attention, not stress) with a short line and a **meadow "Start calibration"** forward action routing to the calibration flow; the `no_anchor` outcome → calibrate-first state, **never** a band. (mock-gap #4 / MG-1; FR-011, Principle V)
- [ ] T045 [P] [US3] `apps/web/tests/unit/components/monitor/` (US3): `no_anchor` → calibrate-first surface rendered, no stress band rendered.

**Checkpoint**: US1 + US2 + US3 independently functional.

---

## Phase 7: User Story 4 — Retrospective trend, recap & the questionnaire seam (Priority: P3)

**Goal**: A session trend on the monitoring page **and** the dashboard card (consistent, SC-008); an idle last-session recap with a graceful empty state; the persisted shape sufficient for feature 009's sustained-tense detection (seam only — no questionnaire here).

**Independent Test**: Complete a session, then confirm the page and card render the **same** session trend from persisted readings, the idle card shows a last-session recap (and the empty state when none), and `window_readings` carries `band`+`captured_at`+`session_id` for 009.

- [ ] T046 [P] [US4] `apps/web/lib/api/monitoring-reads.ts` (NEW): typed Supabase **RLS** reads — `getSessionTrend(sessionId)` (`select id, captured_at, scored, band, skip_cause`; never the probability) and `getLastSessionRecap(userId)` (most recent **ended** session, or **null**). (data-model.md § Reads)
- [ ] T047 [US4] `apps/web/components/monitor/session-trend.tsx` (NEW): the page trend (band→height; **skipped points render as gap/last-value, never a fabricated reading**); uses the shared `getSessionTrend` reader. (FR-018)
- [ ] T048 [US4] `apps/web/components/home/todays-checkin-card.tsx`: idle **recap** (duration + overall tenor from `getLastSessionRecap`) + **empty state** ("Start your first check-in"); monitoring/paused card states; **mini-trend downsampling the SAME `getSessionTrend` rows** as the page (guaranteed consistent, SC-008). Ending returns here — **no standalone "ended" screen** (mock-gap #6). (FR-019, mock-gap #7)
- [ ] T049 [P] [US4] `apps/web/tests/unit/components/` (US4): trend **consistency** (card mini-trend vs page trend = same source), recap empty state, recap duration/tenor derivation.
- [ ] T050 [US4] FR-020 **seam** confirmation (no trigger built): a backend test asserting the persisted `window_readings` shape (`band` + `captured_at` + `session_id`) supports the 009 sustained-tense query; document in `data-model.md` that 008 builds **no** questionnaire trigger/UI/flow. (FR-020, Out-of-Scope)

**Checkpoint**: all four stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T051 [P] Playwright **employee happy-path** e2e `apps/web/tests/e2e/employee-monitoring.spec.ts` (start → permission → warming-up → reading → end → dashboard recap) using the feature-005 **detector-injection seam**. NOTE: this is **not** the cross-browser capture gate — that is the real-Safari smoke (Phase 2), which Playwright must not replace.
- [ ] T052 [P] webm/VFR **codec** fidelity hardening `packages/ml-video/tests/test_webm_vfr_fidelity.py` (mp4/CFR vs webm/VFR 2958-d tolerance) — **scheduled hardening, not a ship blocker** (R-6; the assembly dimension is already covered by the Phase-2 multi-clip gate).
- [ ] T053 [P] Responsive & a11y pass (Principle VI / FR-025): monitoring stage **stacks at ≥360 px** (bloom shrinks, controls full-width/stack, pill/viewfinder reposition — mock-gap #3); `prefers-reduced-motion` across all surfaces; visible keyboard focus; ≥44×44 px touch targets. Covered in `apps/web/components/monitor/*` + the page.
- [ ] T054 [P] Author/expand `specs/008-stress-inference-service/smoke-tests.md`: human checks — camera permission on real browsers; **Safari/iOS** secure-context + capture; HTTPS/localhost; low-light skip; mobile 360 px; reduced-motion; privacy (temp/clip deleted); no manager surface reads sessions/readings.
- [ ] T055 Privacy verification (Principle I / Quality Gate 6): test + smoke that **no raw video persists** (clips + temp deleted in `finally`; buffer cleared on pause/end), **no manager policy** exists on either table, and `label`/`stress_probability` are **unreadable** by the owner (SELECT column whitelist). (SC-009)
- [ ] T056 [P] **Model-owner note** (carry-over, do **not** act in 008): record the `metadata.json` stale `window_eval_config` (30 s) cleanup as a model-owner task — **metadata/doc-only, no `model_version` bump, no anchor invalidation, do not edit the model artifact**. Add to `docs/backlog.md` (or the MODELS.md note) flagged for the model owner. (research R-0)
- [ ] T057 [P] **Retention follow-up note**: document the 90-day `window_readings` purge (a `pg_cron` job or scheduled task) as a follow-up **not built in 008**; the policy is decided, the job is deferred. (data-model.md § Retention)
- [ ] T058 Run `quickstart.md` verification (SC-001…SC-010) and the full Principle VII test sweep (pytest `apps/api` + `packages/ml-video`; Vitest `apps/web`; Playwright employee e2e; the multi-clip gate + webm/VFR hardening). Confirm green before review.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no dependencies — start immediately.
- **Phase 2 (WINDOWING GATE)**: depends on Setup. **🚦 BLOCKS Phases 3–8 entirely** — the GATE (T009) must pass on Chrome **and** Safari/iOS first. If the fidelity gate (T008) fails, the windowing approach is revisited before any further build.
- **Phase 3 (Foundational)**: depends on the GATE (T009). Blocks all user stories.
- **Phase 4 (US1, P1)**: depends on Foundational. The MVP.
- **Phase 5 (US2, P2)**: depends on Foundational; extends US1 surfaces (endpoints/state machine).
- **Phase 6 (US3, P2)**: depends on Foundational; small branch off US1's create path.
- **Phase 7 (US4, P3)**: depends on Foundational + persisted readings from US1 (and `end` from US2 for recap).
- **Phase 8 (Polish)**: depends on the stories it touches.

### Key cross-task dependencies

- T007 (`compute_anchor_multiclip`) → T008 (fidelity gate) and → T020 (inference service).
- T010/T011 (migration: tables/RLS + `get_my_anchor()`) → T013 (supabase_user) → T020/T021 (service/router).
- T018 (clip buffer) + T019 (smoothing) → T020 (inference) → T021 (router) → T036 (lifecycle) and T042 (no-anchor finalize).
- T025–T031 → T032 (orchestrator) → T033 (page) → T034 (entry).
- T046 (reads) → T047 (page trend) + T048 (card recap/mini-trend).

### Within each user story

- Pure-function/contract tests (smoothing, predict_delta, endpoints) alongside the code they cover.
- Backend service before router; models/migration before service.
- Leaf components before the orchestrator; orchestrator before the page; page before the dashboard entry.

---

## Parallel Opportunities

- **Setup**: T001, T002, T003 in parallel.
- **Gate**: T004 + T005 (record fixtures on the two browsers) in parallel; then T006 (capture smoke) and T007→T008 (entry→fidelity) proceed; T009 joins them.
- **Foundational**: T012, T013, T014, T015, T016 in parallel (distinct files); T010→T011 sequential (same migration file); T017 after T012.
- **US1 backend**: T018 ∥ T019 (then T020→T021); tests T022 ∥ T023.
- **US1 frontend**: T025 ∥ T026 ∥ T027 ∥ T028 ∥ T029 ∥ T030 (distinct files), then T031→T032→T033→T034; T035 in parallel with the page.
- **Polish**: T051, T052, T053, T054, T056, T057 largely in parallel.

### Parallel example — US1 frontend leaves

```bash
Task: "window-recorder.ts — stop/restart standalone-clip recorder (apps/web/components/monitor/)"
Task: "use-monitoring-session.ts — reducer/state machine (apps/web/components/monitor/)"
Task: "bloom.tsx — ambient bloom, band→color (apps/web/components/monitor/)"
Task: "op-surfaces.tsx — permission/warming-up/blocked/skipped-note (apps/web/components/monitor/)"
Task: "monitoring-client.ts — typed FastAPI client (apps/web/lib/api/)"
```

---

## Implementation Strategy

### GATE FIRST (non-negotiable ordering)

1. Phase 1 Setup → 2. **Phase 2 WINDOWING GATE** → validate B2 on real Chrome + Safari/iOS and pass the multi-clip fidelity HARD GATE (T009). **Do not start Phase 3+ until the gate is green.** A gate failure re-opens the windowing decision before any feature code.

### MVP (after the gate)

3. Phase 3 Foundational → 4. Phase 4 **US1** → **STOP and validate** the live read end-to-end (the demoable MVP).

### Incremental delivery

5. Add **US2** (session control/presence) → validate → 6. Add **US3** (calibrate-first) → validate → 7. Add **US4** (trend/recap/seam) → validate. Each story is independently testable and additive.

8. Phase 8 Polish (e2e, hardening, responsive/a11y, smoke, privacy, carry-over notes) → run `quickstart.md` + full test sweep.

---

## Notes

- **B1 is dead**: no container reassembly, no init-segment retention, no timeslice mode anywhere. Every clip is standalone and decoded on its own; the server concatenates **frames**, not containers (B2).
- **No service-role** anywhere in `apps/api`: all DB I/O is RLS-as-the-user via the forwarded JWT + the publishable anon key; the anchor is read only via `get_my_anchor()`. Write-integrity is deliberately deferred (own-data only; upgrade path = a dedicated INSERT-only role — not built here).
- **No number, ever** (FR-015): the client receives only a `band`; `label`/`stress_probability` are server-only via the SELECT column whitelist.
- **Operating point 0.53** is read from `metadata.json`, not hard-coded; `t_high=0.70` is a documented display-only product band.
- **Reuse, not re-copy** (Principle III): shared 2958-d extraction (`compute_anchor` internals via the new `compute_anchor_multiclip`), feature-005 detector/self-view, feature-006 coverage gate + cause vocabulary.
- `[P]` = different files, no incomplete-task dependency. Commit after each task or logical group. Stop at any checkpoint to validate a story independently.
