---
description: "Task list — Stress Inference Service (008)"
---

# Tasks: Stress Inference Service

**Input**: Design documents from `specs/008-stress-inference-service/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/inference-api.md`, `contracts/smoothing-and-banding.md`, `quickstart.md`

**Tests**: INCLUDED. Constitution Principle VII makes testing mandatory for this PR (first-ever `predict_delta` test; the tail-window unit test; smoothing/endpoint/RLS tests; one employee Playwright happy-path; the webm/VFR codec hardening check; real-Safari **works-and-keeps-up** smoke — **not** Playwright-only). *(The multi-clip fidelity HARD GATE is retired — the continuous 60 s window is faithful by construction; see the windowing note below.)*

**Organization**: Tasks are grouped by user story (US1–US4 from `spec.md`). **Phase 2 is a front-loaded but *light* windowing validation** — per the revised plan (windowing D-2 reversed: B1 container-reassembly and B2 multi-clip frame-concat both rejected → **continuous single-stream upload + server tail-extract**). The continuous 60 s window is **faithful by construction**, so there is **no fidelity gate**; Phase 2 only de-risks that the continuous capture/upload/tail-extract path **works and keeps up** on real devices (still the Safari/iOS pre-production gate).

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 / US4 (setup, gate, foundational, and polish tasks carry no story label)

## Windowing decision in force (read before starting)

- **Continuous single-stream upload is ADOPTED** (windowing D-2 reversed — research R-5/R-7, `docs/DECISIONS.md` 2026-06-19, `docs/CHANGELOG.md`). The client runs **one continuous `MediaRecorder`** (timeslice for incremental capture only — no stop/restart) and uploads the **contiguous recording-so-far** each stride (init + all chunks in order — always decodable). The **server** decodes that one clip and **tail-extracts the last 60 s** via the existing single-clip path (`compute_anchor` + the VFR `POS_MSEC` sampler, bounded to frames with timestamp ≥ duration − 60 s). **No multi-clip assembly, no clip buffer.**
- **Faithful by construction → no fidelity gate.** The scored window is a genuine continuous 60 s segment sampled by one continuous grid — exactly the single-clip input the extraction is already validated on. The only `ml-video` change is a thin **tail-window option** on `compute_anchor` (reuses decode+sampler+features; Principle III).
- **B1 (single timeslice recorder + container reassembly) is REJECTED** — R-7 structural NO-GO (silent `motion_features` corruption at the splice; non-decodable timeslice chunks; unaligned webm cluster boundaries).
- **B2 (standalone stop/restart clips + multi-clip frame-concat) is REJECTED** — on the single-source fidelity fixture: a per-clip sampling-phase reset → cosine 0.991 < 0.999, ~14% motion shortfall, only 31.5% of sampled frames coinciding; not reconstructable for real clips (no global clock). `compute_anchor_multiclip`, `motion_features_seamaware`, and `test_multiclip_fidelity.py` are **retired** (kept in git history; the single-source diagnostic + fixture + finding stay recorded).
- The `_scratch-008-b1-spike/` and `_scratch-008-b2-spike/` harnesses are superseded by a continuous-capture harness (T002).

---

## Phase 1: Setup (enable the validation — minimal)

**Purpose**: Just enough scaffolding to run the Phase-2 windowing validation. No feature code yet.

- [x] T001 [P] Verify `packages/ml-video` test env: `compute_anchor`, `Predictor.predict_delta`, `load_model()` import and `load_model()` passes its startup contract check (baseline). Record the working interpreter (`packages/ml-video/.venv`) in `specs/008-stress-inference-service/smoke-tests.md`. *(Done earlier; the env is unchanged.)*
- [x] T002 [P] Build a throwaway **continuous-capture spike harness** at `_scratch-008-continuous-spike/` — disposable scaffolding for the real-device validation, **not** shipped UI and **NOT** wired into `apps/api` (supersedes the retired `_scratch-008-b1-spike/` + `_scratch-008-b2-spike/` harnesses). Two parts:
  1. **Client** (a minimal static page): **one continuous `MediaRecorder`** in timeslice mode (incremental capture, **no stop/restart**); each ~10 s stride it uploads the **contiguous recording-so-far** (init + all chunks in order — always decodable) to the spike server (matching the `/anchor` upload shape), with a **manual save-to-disk** so those uploads become the T007 fixtures, and a **visible session clock** for the t≈60/120/180/240/300 s strides.
  2. **Standalone spike server** (its own tiny process — `http.server`/Flask/FastAPI-script, **NOT** `apps/api`): accept the uploaded recording-so-far → write to a temp file → run the ml-video extract with the **T005 `tail_seconds=60` option** (reusing `compute_anchor`'s building blocks — `extract_landmarks` decode/sampler then `lbp_top_features` ⊕ `motion_features`, not a copy) → return the vector shape `(2958,)` (or the `FeatureExtractionError` **"skipped"** case) **and the decode-to-tail time and the extract (MediaPipe + LBP) time as two separate numbers** (instrument the decode-to-the-tail-frames pass vs the FaceMesh + feature pass) → **delete the temp clip in `finally`**. This is the per-component-timing instrument the device gate (T008) reads.
  Add a **README** noting it is **disposable** and the **secure-context** requirement: the camera needs `localhost`/`127.0.0.1` on desktop, or **HTTPS via ngrok** for the iPhone — a LAN IP over plain HTTP blocks `getUserMedia`.
- [x] T003 [P] Continuous-fixture scaffolding: reuse the existing real continuous Chrome clip at `packages/ml-video/tests/fixtures/multiclip/chrome-singlesource/continuous.webm` (>60 s) as the tail-window unit-test input; keep the decode-smoke helper `packages/ml-video/tests/helpers/decode_smoke.py` (`cv2.VideoCapture` opens a path and yields a frame count) for the real-device decodability check. (No new stop/restart clip fixtures — those were B2.) **CI-runnability note**: `continuous.webm` is **gitignored** (~21 MB), so T006's *decode-based* assertion is **local-only** — it cannot run in CI. The CI-runnable faithfulness guard is therefore T006's **synthetic-timestamp invariant** (Change-1 guard; uses no video), so the "faithful by construction" property is enforced in CI regardless of whether the video fixture is present.

**Checkpoint**: harness + fixtures ready — the validation can run.

---

## Phase 2: 🚦 WINDOWING VALIDATION (continuous) — FRONT-LOADED, LIGHT (no fidelity gate)

**Purpose**: De-risk the **continuous** windowing path on **real devices** before the feature build. Because the 60 s window is **faithful by construction** (a real continuous clip through the already-validated single-clip extraction), there is **no multi-clip fidelity gate** — the only open question is whether the continuous capture/upload/tail-extract path **works** and **keeps up**. This stays the Safari/iOS pre-production gate.

**⚠️ Real browsers, not Playwright** (Playwright has given false cross-browser capture/timing confidence — see the e2e-load-timing flake history).

### Retire the rejected B2 multi-clip path

- [x] T004 Retire the rejected B2 artifacts (keep git history). This is a **complete, non-breaking** retirement, fixed to **resolution (a): inline into the diagnostic** — the active package source MUST carry **zero** retired B2 code; all remaining B2 code lives **only** in the labelled single-source diagnostic:
  1. **Delete from the package source entirely**: remove `compute_anchor_multiclip` (from `src/ml_video/anchor.py`) and `motion_features_seamaware` (from `src/ml_video/features.py`) **in full** — the definitions, their imports, and the `src/ml_video/__init__.py` export (the import line **and** `__all__` entries). Delete/retire the hard gate `packages/ml-video/tests/test_multiclip_fidelity.py`. **No retired B2 symbol may remain anywhere under `src/ml_video/`.**
  2. **Repo-wide reference sweep**: grep `compute_anchor_multiclip` and `motion_features_seamaware` across `packages/`, `apps/`, `tests/`, and the `_scratch-008-*` dirs; remove **every orphaned import/call site**, not just the `__init__` export. (Active-path references today: `src/ml_video/__init__.py`, `src/ml_video/anchor.py` (the `compute_anchor_multiclip` definition + its `motion_features_seamaware` call), `src/ml_video/features.py` (the `motion_features_seamaware` definition), `tests/test_multiclip_fidelity.py`, and the **kept** diagnostic `tests/helpers/singlesource_fidelity.py` — see step 3.)
  3. **Inline the assembly into the kept diagnostic (load-bearing — resolution (a)).** The kept single-source diagnostic `tests/helpers/singlesource_fidelity.py` currently **imports `compute_anchor_multiclip`** (`from ml_video import compute_anchor, compute_anchor_multiclip`) and calls it to reproduce B2's failure — so deleting the symbol from the package (step 1) would break the very file that records *why* B2 was rejected. Resolve by **inlining** the multi-clip assembly logic the two retired functions contained — per-clip `extract_landmarks` → concat frames/landmark rows → coverage gate → `lbp_top_features` ⊕ seam-aware motion (per-clip diffs, cross-seam diffs excluded) — into a **local helper inside `singlesource_fidelity.py`**, and drop its `compute_anchor_multiclip` import. After this, **all** retired B2 code lives **only** in this one labelled diagnostic, the active package/inference surface is clean, and the diagnostic still runs. Do **not** leave a broken import.
  4. **Delete/neutralize the B2 spike harness**: remove `_scratch-008-b2-spike/` so nothing in the tree imports or demonstrates the retired path (T002's continuous-capture harness supersedes it). (`_scratch-008-b1-spike/` is already absent.)
  5. **Remove orphaned cross-take B2 fixtures**: delete the **separately-recorded stop/restart** fixture dirs `tests/fixtures/multiclip/chrome/` and `tests/fixtures/multiclip/safari/` (the cross-take takes — the *flawed* fixture). **Keep** the single-source fixture `tests/fixtures/multiclip/chrome-singlesource/` (the continuous clip + its lossless re-segments) and the `docs/DECISIONS.md` / `smoke-tests.md` findings — they are the **evidence** B2 was rejected (and both the kept diagnostic and the T006 fixture depend on the single-source clip).
  6. **Correct `smoke-tests.md`'s active procedure (it must describe the live gate, not the retired one).** Its body today (≈ L36–132+) still presents the **retired** multi-clip extraction + the **multi-clip fidelity HARD GATE** + `compute_anchor_multiclip` as the *active* procedure (Steps A–F), with only a banner at the top noting the retirement. **Replace that active procedure section with the continuous works-and-keeps-up validation** (per `research.md` R-7 and T007/T008/T009): continuous single-stream capture → upload the contiguous recording-so-far → `decode_smoke.py` decodability + `compute_anchor(clip, tail_seconds=60)` returns `(2958,)` → per-stride keep-up within the 10 s stride across a ~5-min session, recording the **decode-to-tail and extract times separately**. So the live checklist matches T007/T008/T009. **Move the old multi-clip content (Steps A–F) verbatim under a clearly-labelled "Superseded (B2, retired)" heading** — it stays as the evidence that drove the decision, but is unmistakably *not* the active procedure. Note there that the retirement took **resolution (a) (inline into the diagnostic)** — the active package source carries zero retired B2 code.

### Tail-window extraction (replaces compute_anchor_multiclip)

- [x] T005 Add the **tail-window option** to `compute_anchor` in `packages/ml-video/src/ml_video/anchor.py`: a trailing-window bound (e.g. `tail_seconds: float | None = None`). **Implementation contract (load-bearing — this is what makes the window "faithful by construction"; state this prohibition in the code/docstring):** the option MUST compute its keep-indices by running the existing `_timestamp_keep_indices` / `POS_MSEC` sampler over the **whole decoded stream on the file-global grid (anchored at the file's t=0)**, then **filter** that global index set down to frames whose timestamp ≥ `duration − tail_seconds`. It MUST NOT trim/seek to the last `tail_seconds` and re-run the sampler on the sub-stream — that re-zeroes `CAP_PROP_POS_MSEC` to the sub-stream's t=0 and offsets every bucket by up to ½ the 400 ms sampling period (this is exactly the **per-clip phase reset that sank B2**; see R-5). Because the grid is preserved, the kept tail frames are then **exactly the suffix** of the frames the full-file extraction would keep. Run the existing `lbp_top_features` ⊕ `motion_features` on those kept frames (coverage gate preserved). For `tail_seconds=None`, or a clip ≤ `tail_seconds`, it **reduces exactly to `compute_anchor`**. **Reuses** the existing decode+sampler+features — not a second copy (Principle III). Export unchanged.
- [x] T006 [P] Unit test `packages/ml-video/tests/test_tail_window.py` (env-runnable, **not** a real-device gate). Three assertions:
  1. **Regression-guard invariant (CI-runnable — synthetic timestamps, no video, no tolerance).** This is the guard that makes "faithful by construction" an *enforced* invariant rather than a *trusted* assumption — it is what lets the future rolling decoded-frame buffer (R-5) be **validated** rather than trusted. On synthetic VFR timestamps whose total duration is **not** a multiple of the 0.4 s (400 ms) sampling period (the case where a re-zeroed *local* grid diverges from the *global* grid), assert the tail keep-set is **exactly the suffix** of the global keep-set:

     ```python
     global_keep = _timestamp_keep_indices(ts)                  # whole-file grid, anchored at t=0
     tail_keep   = _timestamp_keep_indices(ts, tail_seconds=60) # tail option under test
     assert tail_keep == [i for i in global_keep if ts[i] >= ts[-1] - 60_000.0]  # ts is in ms
     ```

     `_timestamp_keep_indices` is the real sampler seam in `pipeline.py`; **`ts` is in milliseconds**, so the tail bound is `ts[-1] − 60_000`. If the sampler does not currently expose kept indices under a `tail_seconds` bound to a test, add the **smallest** seam needed for this assertion — this is the only new test surface. It is **exact integer-index equality on identical source frames**, **not** the retired multi-clip human-motion fidelity gate (no cosine, no motion tolerance).
  2. **Degenerate case (kept, but not sufficient on its own).** On a clip ≤ `tail_seconds`, `compute_anchor(path, tail_seconds=60)` returns **bit-identical** to `compute_anchor(path)`. (Covers the reduce-to-`compute_anchor` path but does NOT exercise the global-vs-local-grid divergence — assertion 1 does.)
  3. **Decode-based bound (local-only — the T003 fixture is gitignored, see T003).** On the >60 s continuous fixture (T003), `compute_anchor(path, tail_seconds=60)` keeps only the trailing-60 s frames (timestamp ≥ duration − 60). Cannot run in CI; assertion 1 is the CI-runnable guard.

  Pins the bound — **no fidelity-tolerance assertion needed** (faithful by construction). (depends T005)

### Real-device continuous validation (Safari/iOS pre-production gate)

- [x] T007 [P] Record continuous fixtures on **real Chrome (webm)** and **real Safari/iOS (fragmented MP4)** with the T002 harness: a ~5-min continuous session, capturing the **contiguous recording-so-far** at several strides (e.g. t≈60/120/180/240/300 s). Drop under `packages/ml-video/tests/fixtures/continuous/{chrome,safari}/` (raw video gitignored). (Safari emits fMP4, not webm — the fragile encoder.)
- [x] T008 Continuous-capture **works-and-keeps-up** validation (manual, real Chrome + Safari/iOS — **not** Playwright). For each browser and each stride sample: **(works)** the uploaded contiguous recording-so-far is **decodable** (`decode_smoke.py`) and `compute_anchor(clip, tail_seconds=60)` returns a `(2958,)` vector; **(keeps up)** the per-stride server time stays **within the 10 s stride** across the 5-min session — and **record the decode-to-tail time and the extract (MediaPipe + LBP) time SEPARATELY, not just the combined total**, at t≈60/120/180/240/300 s (worst case is the last, ~300 s decoded). The split is required so any breach can be attributed to the right component — *growing decode-to-tail* vs *constant extract* (see R-5 / T009) — **without re-running** the 5-min session. Reuses the **ml-video extract (`compute_anchor`) via the T002 spike server** — the same extraction code `/anchor` uses, **not** the literal `/anchor` HTTP route (the real `apps/api` route stays untouched until Phase 3). Record pass/fail + the **per-component** per-stride times per browser in `specs/008-stress-inference-service/smoke-tests.md`. (depends T005, T007)

### 🚦 VALIDATION CHECKPOINT

- [x] T009 **Checkpoint (light)**: T008 **works and keeps up** on Chrome **and** Safari/iOS → unblock Phase 3+. **A keep-up breach is NOT a windowing failure and never re-opens the windowing approach** — it is a **production-deploy concern only** (localhost/demo is unaffected and the build proceeds). **Diagnose which component breached, using T008's separately-recorded decode-to-tail vs extract times:**
  - a breach that **grows with session length** (late strides ≫ early strides; decode-to-tail dominates) ⇒ the lever is the **deferred server-side rolling decoded-frame buffer** (decode only the newest increment; R-5) — the *decode* side;
  - a breach **present even early / dominated by the constant extract time** (MediaPipe + LBP, ~10–15 s/window projected on a slow target) ⇒ the lever is a **slower reading cadence** (FR-016 non-blocking + D-3 smoothing tolerate variable arrival) or **GPU MediaPipe**, **not** the buffer — the *extract* side (the buffer would not help here).
  There is **no fidelity outcome to fail** (faithful by construction). Record the outcome **with the per-component attribution** in `specs/008-stress-inference-service/smoke-tests.md` and note it in `docs/DECISIONS.md`.

**Checkpoint**: continuous windowing proven on real devices — feature build may begin.

---

## Phase 3: Foundational (post-validation prerequisites)

**Purpose**: Shared backend/DB infrastructure every user story needs. **Depends on the Phase-2 windowing validation (T009)** — the continuous path confirmed working on real devices; a keep-up breach is a production-deploy note (the deferred rolling decoded-frame buffer), **not** a build blocker (fidelity can no longer fail — faithful by construction).

- [x] T010 [P] DB migration `supabase/migrations/20260619000000_monitoring_sessions_and_readings.sql`: create `public.monitoring_sessions` + `public.window_readings` per `data-model.md` (columns, CHECKs, FKs `ON DELETE CASCADE`, indexes `(user_id, started_at desc)`, `(session_id, captured_at)`, `(user_id, captured_at)`); enable **+ FORCE** RLS; **select-own / insert-own / update-own** policies; **no manager policy**; per-role `REVOKE ALL FROM anon, authenticated` then explicit grants with the **SELECT column whitelist excluding `label` + `stress_probability`** and the **INSERT grant including** them.
- [x] T011 Add `public.get_my_anchor()` (`SECURITY DEFINER`, filters `auth.uid()`, `STABLE`, `SET search_path=''`, `OWNER TO postgres`, `REVOKE EXECUTE FROM PUBLIC, anon`, `GRANT EXECUTE TO authenticated`; mirrors `has_anchor()`) to the **same** migration file `supabase/migrations/20260619000000_monitoring_sessions_and_readings.sql`. (same file as T010 → sequential)
- [x] T012 [P] `apps/api/app/config.py`: add `SUPABASE_ANON_KEY` (required; **publishable**, not a secret), make `SUPABASE_URL` required, add `STRESS_OPERATING_POINT` (default **read from** `metadata.json → loso_metrics_60s_calibrated.threshold_sweep_recommended.threshold` = 0.53 — never a hard-coded literal) and `STRESS_TENSE_BAND` (default 0.70). **No service-role key.** (contracts/inference-api.md Config surface; FR-012)
- [x] T013 [P] `apps/api/app/supabase_user.py` (NEW): user-context Supabase client (`create_client(url, anon_key)` + per-request `postgrest.auth(<forwarded JWT>)`); helpers to call `get_my_anchor()` and to do RLS session/reading insert/select/update **as the user** — **no service-role**. (revised D-1)
- [x] T014 [P] `apps/api/app/auth.py`: add `require_employee` dependency (forwarded-JWT select-self on `profiles.role`; non-employee → **403** `{"error":"forbidden_role"}`). Reuse existing `verify_jwt`. (FR-010)
- [x] T015 [P] `apps/api/app/schemas.py`: Pydantic monitoring models — create/end/patch payloads + the **discriminated `outcome`** response union (`reading` | `warming_up` | `skipped`), and the create-session response (`session_id`, `model_version`). (contracts/inference-api.md)
- [x] T016 [P] **First-ever `predict_delta` test** `packages/ml-video/tests/test_predict_delta.py`: assert `predict_delta(delta)` returns `(label, proba)` with `proba` shape `(2,)`; lock the **0.53 re-threshold** semantics on `proba[1]` and that the internal 0.5 label is ignored for display. (Principle VII; Test Plan Notes)
- [x] T017 `apps/api/app/main.py`: include `monitoring.router`; at startup load the model + resolve `STRESS_OPERATING_POINT` from metadata into `app.state` (fail-fast). (depends T012)

**Checkpoint**: backend foundation + DB ready — user stories can begin (US1 first).

---

## Phase 4: User Story 1 — Live stress read during a check-in (Priority: P1) 🎯 MVP

**Goal**: A calibrated employee starts a check-in, grants the camera, and sees an already-smoothed three-band reading on the ambient bloom — warming-up until ~90–105 s, then refreshing ~every 10 s — with **no number anywhere**.

**Independent Test**: With a calibrated employee account, Start check-in → grant camera → confirm warming-up, then a smoothed band (At ease / A little tense / Tense) appears at ~90–105 s and updates ~every 10 s, with no percentage/gauge on any surface.

### Backend (US1)

- [ ] ~~T018~~ **REMOVED** — no per-session clip buffer under continuous single-stream. The server receives the whole **contiguous recording-so-far** each stride, decodes it, tail-extracts the last 60 s, and deletes the temp clip in `finally` (handled inline by the inference service, T020). The deferred **rolling decoded-frame buffer** (research R-5) is the only future buffer and is **not built in 008**.
- [x] T019 [P] [US1] `apps/api/app/services/smoothing.py` (NEW): rolling mean over the last **N=4 scored** `proba[1]`, banding (`t_low=0.53`, `t_high=0.70`), cold-start **M=4** → `warming_up`; skipped windows excluded from the smoothing buffer and the M count. (contracts/smoothing-and-banding.md; D-3) — **Done.** Pure, stateless: `smooth(scored_probas, *, t_low, t_high)` + `band_for_mean` + stable band keys; `t_low`/`t_high` are required args (no literal). The buffer lives in T020 (DECISIONS 2026-06-20).
- [x] T020 [US1] `apps/api/app/services/inference.py` (NEW): the read path — write the uploaded **contiguous recording-so-far** to a temp file → if **< 60 s** recorded return `warming_up` → else `compute_anchor(clip, tail_seconds=60)` (T005) → `get_my_anchor()` (T013) → `delta = current − anchor` → `predict_delta` → **re-threshold `proba[1] ≥ STRESS_OPERATING_POINT`** → smooth + band (T019) → persist a `window_readings` row under RLS (server-only `label`+`stress_probability`) → **delete the temp clip in `finally`**. On `FeatureExtractionError` → skipped reading. (depends T005, T013, T019) — **Done.** Smoothing reads a **per-session in-memory buffer** (`_SessionBuffers`), NOT the DB — raw `stress_probability` is never read back (DECISIONS 2026-06-20; BACKLOG multi-worker note). Added a thin `ml_video.probe_recorded_seconds()` (reuses the decode pass-1 timestamp probe) for the server-side `< 60 s` gate.
- [x] T021 [US1] `apps/api/app/routers/monitoring.py` (NEW): `POST /monitoring/sessions` (require_employee; **anchor-presence guard up front** → **409** `{"outcome":"no_anchor"}`; insert session under RLS) and `POST /monitoring/sessions/{id}/windows` (accept the **contiguous recording-so-far**; run T020 in a **threadpool** so a slow window never blocks the next; return `reading` / `warming_up` / `skipped`; **never** return a probability). (depends T014, T015, T020) — **Done.** Included in `main.py`. (PATCH/end = US2/T036; mid-session 409 = US3/T042, out of scope.)
- [x] T022 [P] [US1] `apps/api/tests/test_smoothing.py`: warm-up (<4 scored → `band is None`), banding boundaries (`0.52→at_ease`, `0.53→a_little_tense`, `0.69→a_little_tense`, `0.70→tense`), drift-not-flicker (SC-003), skipped excluded, config override moves boundaries (proves no hard-coded literal). (contracts/smoothing-and-banding.md Tests) — **Done (17 tests).**
- [x] T023 [P] [US1] `apps/api/tests/test_inference_service.py`: read path with a stubbed predictor + anchor — anchor `bytea` decode to `(2958,)`, `delta`, **re-threshold at 0.53**, server-only columns written, skipped path on `FeatureExtractionError`. (depends T020) — **Done (11 tests).** Also asserts the mean is built from the in-memory buffer across calls and the read path never SELECTs `stress_probability`/`label`.
- [x] T024 [US1] `apps/api/tests/test_monitoring_endpoints.py` (US1 slice): create returns 201 / **403 forbidden_role** (non-employee) / **409 no_anchor**; window returns `warming_up` before ~60 s of recording, `reading` after warm-up, `skipped` on coverage failure; RLS keys writes to the **verified `sub`** (a caller can't write another user's rows; SC-004 no global anchor). (depends T021) — **Done (12 tests).**

### Frontend (US1)

- [x] T025 [P] [US1] `apps/web/lib/api/monitoring-client.ts` (NEW): typed client → FastAPI (`createSession`, `submitWindow`, `endSession`, `patchStatus`); sends the forwarded access token; multipart for the contiguous recording-so-far. — **Done.** Outcome union only on the wire (never a probability); endSession/patchStatus provided but are US2 endpoints (T036).
- [x] T026 [P] [US1] `apps/web/components/monitor/window-recorder.ts` (NEW): **continuous** recorder — **one `MediaRecorder`** in timeslice mode (incremental capture, **no stop/restart**); each ~10–12 s stride it uploads the **contiguous recording-so-far** (init + all chunks in order — always decodable) (fire-and-forget, **non-blocking**; FR-016). Reuse feature-005 `getUserMedia` + secure-context. (continuous single-stream) — **Done.** Feature-detects webm-first with an fMP4 fallback (device-gate finding; never hard-codes one); `isSecureContextOk()` guard; injectable `createRecorder`.
- [x] T027 [P] [US1] `apps/web/components/monitor/use-monitoring-session.ts` (NEW): reducer/state machine — US1 op-states (permission, **warming-up**, active, blocked, + transient skipped-read note over the last band). Maps `outcome`→state and `band`→display; holds warming-up until the server stops returning `warming_up`. (mock-gap #1/#2) — **Done.** Pure reducer + BAND_DISPLAY (copy traced to the mock); calibrate-first is a US3 seam. No numeric field.
- [x] T028 [P] [US1] `apps/web/components/monitor/bloom.tsx` (NEW): ambient breathing **bloom**; band→color role (meadow = At ease; **amber soft-tint** = a-little-tense/tense; warming-up = neutral/meadow-muted); `prefers-reduced-motion` suppresses breathing; built on **Graphite tokens**, no number/gauge. (FR-021, FR-022, Principle V) — **Done.** 3 bloom colours (ease=meadow, little=color-mix(amber,meadow) for the mock's `--bloom-little`, tense=amber, warming=meadow); reuses the orb's Framer-Motion + useMediaQuery technique; reduced-motion → static.
- [x] T029 [P] [US1] `apps/web/components/anchor/failure-state.tsx`: extract a **shared `CauseChip`** from the feature 005/006 cause vocabulary so the skipped-read note and calibration reuse one component. (Principle III reuse) — **Done.** New `components/anchor/cause-chip.tsx` (CauseChip + CAUSE + FailureCause); failure-state.tsx + the monitoring skip-note both consume it; copy byte-identical.
- [x] T030 [P] [US1] `apps/web/components/monitor/op-surfaces.tsx` (US1 subset): permission, **warming-up** ("getting a read on things"), blocked, and the **foggy "skipped a read" note** (distinct from out-of-frame; names a likely cause + gentle fix via `CauseChip`; bloom keeps the last band). **Also surface the one short in-product reassurance line (FR-024)** — light-touch, *not* a privacy lecture (the detailed privacy story stays in the ToS / Privacy Policy, feature 012, and any landing page). Its **copy and placement are design authority and MUST trace to the approved monitoring mock** (`serenify-008-monitoring-mock.html`, mocks-first): do **not** author the wording or invent the placement here. **If the mock shows no such reassurance line, flag it as a mock gap for the design owner** (record it with the other monitoring mock-gaps) rather than authoring copy. (mock-gap #3; FR-013, FR-022 foggy-not-amber; **FR-024**) — **Done (US1 subset).** FR-024 line = the permission panel's "Your manager never sees your video" (mock placement); no separate reassurance line on the active surface in the mock (noted as a possible mock-gap). Permission = meadow affirmative (per mock); paused/out-of-frame/calibrate-first deferred.
- [x] T031 [US1] `apps/web/components/monitor/camera-pill.tsx` + `viewfinder.tsx` (NEW; US1 subset): state-driven pill (recording / camera off) + peek/pin self-view showing **framing graphics only** (no words on the raw video). (FR-023) — **Done.** Pill states recording/off (out-of-frame/paused = US2); viewfinder = self-view + corner brackets only.
- [x] T032 [US1] `apps/web/components/monitor/monitoring-session.tsx` (NEW): orchestrator wiring the recorder (T026), the feature-005 **face detector gate** (no face → **no upload**, FR-003), the state machine (T027), bloom (T028), op-surfaces (T030), and the pill (T031). (depends T025–T031) — **Done.** Calibrate-first guard via createSession up front; uploads fire-and-forget; camera released on unmount; no Pause/End (US2) — exit via back link. Injectable deps.
- [x] T033 [US1] `apps/web/app/(authed)/app/monitor/page.tsx` (NEW): **employee-only** monitoring page with a **server-side role guard** (non-employees redirected); mounts `monitoring-session`; requires secure context. (FR-010) — **Done.** Server-component guard (login/onboarding/non-employee redirects); secure-context enforced client-side.
- [x] T034 [US1] `apps/web/components/home/todays-checkin-card.tsx`: add the **Start check-in** action (explicit camera-permission request; FR-001) routing idle → `/app/monitor`. (recap/empty-state deferred to US4) — **Done.** Meadow Start-check-in CTA → /app/monitor; mock copy verbatim ("stress"/"stressed" dropped from the card's calm-voice blocklist per maintainer). Chat (010)/recs (011) cards untouched.
- [x] T035 [P] [US1] `apps/web/tests/unit/components/monitor/` (Vitest + RTL): state-machine transitions, band→color mapping, **warming-up gating** (no band before cold-start), reduced-motion suppression, "no number rendered" assertion. (Principle VII) — **Done (22 tests).** reducer + bloom + op-surfaces + orchestrator. Full web suite 483 passed; eslint + tsc clean.

**Checkpoint**: US1 is a complete, demoable MVP — a real live smoothed read end-to-end.

---

## Phase 5: User Story 2 — Session control & presence handling (Priority: P2)

**Goal**: Pause/Resume (release/re-acquire camera) and End; out-of-frame auto-pause (self-view + foggy prompt) with auto-resume; auto-end on prolonged absence; no-face windows never upload.

**Independent Test**: During a session, step out of frame → auto-pause + self-view + foggy prompt → auto-resume on return; manual Pause releases the camera, Resume restarts, End returns to the dashboard with an updated recap.

- [x] T036 [US2] `apps/api/app/routers/monitoring.py`: add `PATCH /monitoring/sessions/{id}` (status `paused|active|out_of_frame` under RLS update-own) and `POST /monitoring/sessions/{id}/end` (`ended_at`, `status='ended'`, `end_reason`). (No server-side clip buffer to clear under continuous single-stream; on pause the **client** stops the continuous recorder and starts a fresh recording on resume → warms up again.) (depends T021) — **Done.** No new migration needed (the T010 migration already carries `status` (incl. `ended`), `ended_at`, `end_reason`, `updated_at` + the `GRANT UPDATE (status, ended_at, end_reason, updated_at)`). Reuses `update_session()` (RLS update-own) + the `EndSession`/`PatchSession` schemas. `ended` is terminal → both routes 409 on an ended session (clean 4xx, not 500); unknown/foreign → 404 (RLS select-own). **On end the per-session `_SessionBuffers` entry is evicted (`buffers.drop`)** so ended sessions leak no memory.
- [x] T037 [P] [US2] `apps/api/tests/test_monitoring_endpoints.py` (US2 slice): PATCH transitions, end, **409 cannot-transition an ended session**, RLS update-own. — **Done (12 tests).** Pause→resume / out_of_frame, end (+reason), ended-session 409 (PATCH-on-ended & end-on-ended), unknown/foreign → 404 (RLS update-own denial), non-employee 403, 401, the `ended` PATCH target → 422, and the on-end buffer eviction at the real `inference.buffers` boundary. Full `apps/api` suite green (70 passed); ruff clean.
- [x] T038 [US2] Extend `apps/web/components/monitor/use-monitoring-session.ts` + `monitoring-session.tsx`: out-of-frame (auto-pause after **90 s** no-face, show self-view + foggy prompt, **auto-resume** on return within ~one stride), manual **Pause** (release camera) / **Resume** (re-acquire, re-enter permission if revoked), **auto-end** after **5 min** absence, manual **End** → dashboard. (FR-005/006/007; SC-006) — **Done.** The two absence timers live in a new injectable `presence-monitor.ts` controller (fake-timer-testable), fed by the SAME feature-005 framing signal (`onSignal.facePresent`) that already gates uploads (FR-003) — no second detector. Reducer adds `out-of-frame` / `paused` / `ended` ops + GO_OUT_OF_FRAME / RETURN_TO_FRAME / PAUSE / RESUME / END (late in-flight readings guarded off non-live ops, FR-016). Orchestrator wires PATCH out_of_frame/active + POST end (reason user / auto_absence). **Camera lifecycle:** out-of-frame KEEPS the camera on (self-view + return detection); manual Pause + End/auto-end RELEASE it — acquire-late/release-always preserved (shared `openCameraAndRecord` for grant + resume). **Re-end race:** an `endingRef` collapses the manual-End / auto-end race onto one caller, and `endSession` maps the backend **409 → ok** so the loser resolves silently → ended → `/app`. **Ambiguities flagged (most spec-faithful reading taken):** (a) the 5-min auto-end clock starts at **face-loss** (SC-006 "5 min of continuous absence"), so auto-end is 3.5 min past the out-of-frame pause — not 5 min after it; (b) auto-resume fires on the **first** face-present signal (within one stride, SC-006) — a literal "continuous" reading where any reappearance resets the 90 s clock.
- [x] T039 [P] [US2] Extend `apps/web/components/monitor/op-surfaces.tsx`: **out-of-frame** surface (foggy, self-view, "move back into frame") and **paused** surface — both **foggy, not amber**. (FR-004/007, FR-022) — **Done.** Out-of-frame = FOGGY ("Waiting for you" + the "We've lost sight of you / Move back into frame" foggy-tinted note) with the dimmed held bloom; paused = calm neutral (ink "Paused — taking a break", camera-off line). Lifecycle controls added (Pause/End on live + out-of-frame; meadow Resume + End on paused), 44 px min targets. `ended` renders nothing (mock-gap #6 — the orchestrator navigates to the dashboard). Amber stays exclusively on the stress bands.
- [x] T040 [P] [US2] Extend `apps/web/components/monitor/camera-pill.tsx` / `viewfinder.tsx`: out-of-frame + paused pill states; self-view reveal on out-of-frame. (FR-023) — **Done.** Pill is now `status`-driven (recording = meadow pulse / out-of-frame = FOGGY dot / paused + off = muted) per the mock's pill map; the viewfinder gains an `outOfFrame` prop that force-reveals the self-view (no hover) and turns the brackets foggy.
- [x] T041 [P] [US2] `apps/web/tests/unit/components/monitor/` (US2): out-of-frame/paused/resume/end transitions, auto-pause/auto-end timing logic, foggy-not-amber styling assertions. — **Done (+36 tests).** `presence-monitor.test.ts` (fake timers — 90 s/5 min, return-cancels, flicker-reset, stop); reducer US2 transitions + late-reading guards; op-surfaces out-of-frame/paused (foggy-not-amber, dimmed held bloom, controls); a new `camera-pill.test.tsx`; `tests/unit/lib/monitoring-client.test.ts` (the **409-on-end → ok** race + PATCH); orchestrator US2 (manual pause releases camera / resume re-acquires / End navigates / out-of-frame keeps camera / auto-resume / auto-end / the re-end race ends + navigates exactly once). Full web suite **528 passed**; tsc clean; the new/changed files lint clean (the 2 standing `monitoring-session.tsx` lint errors pre-date this work — the camera-lifecycle fix — and are unchanged).

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
- [ ] T052 [P] webm/VFR **codec** fidelity hardening `packages/ml-video/tests/test_webm_vfr_fidelity.py` (mp4/CFR vs webm/VFR 2958-d tolerance) — **scheduled hardening, not a ship blocker** (R-6; there is **no assembly dimension** under continuous single-stream — faithful by construction).
- [ ] T053 [P] Responsive & a11y pass (Principle VI / FR-025): monitoring stage **stacks at ≥360 px** (bloom shrinks, controls full-width/stack, pill/viewfinder reposition — mock-gap #3); `prefers-reduced-motion` across all surfaces; visible keyboard focus; ≥44×44 px touch targets. Covered in `apps/web/components/monitor/*` + the page.
- [ ] T054 [P] Author/expand `specs/008-stress-inference-service/smoke-tests.md`: human checks — camera permission on real browsers; **Safari/iOS** secure-context + capture; HTTPS/localhost; low-light skip; mobile 360 px; reduced-motion; privacy (temp/clip deleted); no manager surface reads sessions/readings.
- [ ] T055 Privacy verification (Principle I / Quality Gate 6): test + smoke that **no raw video persists** (the uploaded clip + temp deleted in `finally`; no clip buffer), **no manager policy** exists on either table, and `label`/`stress_probability` are **unreadable** by the owner (SELECT column whitelist). (SC-009)
- [ ] T056 [P] **Model-owner note** (carry-over, do **not** act in 008): record the `metadata.json` stale `window_eval_config` (30 s) cleanup as a model-owner task — **metadata/doc-only, no `model_version` bump, no anchor invalidation, do not edit the model artifact**. Add to `docs/backlog.md` (or the MODELS.md note) flagged for the model owner. (research R-0)
- [ ] T057 [P] **Retention follow-up note**: document the 90-day `window_readings` purge (a `pg_cron` job or scheduled task) as a follow-up **not built in 008**; the policy is decided, the job is deferred. (data-model.md § Retention)
- [ ] T058 Run `quickstart.md` verification (SC-001…SC-010) and the full Principle VII test sweep (pytest `apps/api` + `packages/ml-video`; Vitest `apps/web`; Playwright employee e2e; the tail-window unit test + webm/VFR hardening). Confirm green before review.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no dependencies — start immediately.
- **Phase 2 (WINDOWING VALIDATION)**: depends on Setup. Front-loaded; **confirm the continuous path works + keeps up** on Chrome **and** Safari/iOS (T009). It is **no longer a hard fidelity gate** — fidelity can't fail (faithful by construction), so a keep-up breach is a production-deploy note (the deferred rolling buffer), not a build blocker. Still the Safari/iOS pre-production gate.
- **Phase 3 (Foundational)**: depends on the Phase-2 validation (T009). Blocks all user stories.
- **Phase 4 (US1, P1)**: depends on Foundational. The MVP.
- **Phase 5 (US2, P2)**: depends on Foundational; extends US1 surfaces (endpoints/state machine).
- **Phase 6 (US3, P2)**: depends on Foundational; small branch off US1's create path.
- **Phase 7 (US4, P3)**: depends on Foundational + persisted readings from US1 (and `end` from US2 for recap).
- **Phase 8 (Polish)**: depends on the stories it touches.

### Key cross-task dependencies

- T005 (tail-window option on `compute_anchor`) → T006 (tail-window unit test) and → T020 (inference service).
- T010/T011 (migration: tables/RLS + `get_my_anchor()`) → T013 (supabase_user) → T020/T021 (service/router).
- T019 (smoothing) → T020 (inference; **T018 removed — no clip buffer**) → T021 (router) → T036 (lifecycle) and T042 (no-anchor finalize).
- T025–T031 → T032 (orchestrator) → T033 (page) → T034 (entry).
- T046 (reads) → T047 (page trend) + T048 (card recap/mini-trend).

### Within each user story

- Pure-function/contract tests (smoothing, predict_delta, endpoints) alongside the code they cover.
- Backend service before router; models/migration before service.
- Leaf components before the orchestrator; orchestrator before the page; page before the dashboard entry.

---

## Parallel Opportunities

- **Setup**: T001, T002, T003 in parallel.
- **Windowing validation**: T004 (retire B2) and T005→T006 (tail-window + its unit test) proceed; T007 records continuous fixtures on the two browsers; T008 (works-and-keeps-up) depends on T005 + T007; T009 joins them.
- **Foundational**: T012, T013, T014, T015, T016 in parallel (distinct files); T010→T011 sequential (same migration file); T017 after T012.
- **US1 backend**: T019 (smoothing) then T020→T021 (T018 removed — no clip buffer); tests T022 ∥ T023.
- **US1 frontend**: T025 ∥ T026 ∥ T027 ∥ T028 ∥ T029 ∥ T030 (distinct files), then T031→T032→T033→T034; T035 in parallel with the page.
- **Polish**: T051, T052, T053, T054, T056, T057 largely in parallel.

### Parallel example — US1 frontend leaves

```bash
Task: "window-recorder.ts — continuous recorder, uploads recording-so-far (apps/web/components/monitor/)"
Task: "use-monitoring-session.ts — reducer/state machine (apps/web/components/monitor/)"
Task: "bloom.tsx — ambient bloom, band→color (apps/web/components/monitor/)"
Task: "op-surfaces.tsx — permission/warming-up/blocked/skipped-note (apps/web/components/monitor/)"
Task: "monitoring-client.ts — typed FastAPI client (apps/web/lib/api/)"
```

---

## Implementation Strategy

### VALIDATION FIRST (front-loaded ordering)

1. Phase 1 Setup → 2. **Phase 2 WINDOWING VALIDATION** → confirm the continuous capture/upload/tail-extract path **works and keeps up** on real Chrome + Safari/iOS (T009). Front-load it (it stays the Safari/iOS pre-production gate), but it is **not a hard fidelity gate** — fidelity can't fail (faithful by construction); a keep-up breach calls for the deferred rolling-buffer optimization in production, not a re-plan.

### MVP (after the validation)

3. Phase 3 Foundational → 4. Phase 4 **US1** → **STOP and validate** the live read end-to-end (the demoable MVP).

### Incremental delivery

5. Add **US2** (session control/presence) → validate → 6. Add **US3** (calibrate-first) → validate → 7. Add **US4** (trend/recap/seam) → validate. Each story is independently testable and additive.

8. Phase 8 Polish (e2e, hardening, responsive/a11y, smoke, privacy, carry-over notes) → run `quickstart.md` + full test sweep.

---

## Notes

- **B1 and B2 are dead** (continuous single-stream): no container reassembly, no init-segment retention, no stop/restart, no multi-clip frame concatenation, no clip buffer. The client uploads **one continuous, always-decodable file** (the recording-so-far) and the server **tail-extracts the last 60 s** of it.
- **No service-role** anywhere in `apps/api`: all DB I/O is RLS-as-the-user via the forwarded JWT + the publishable anon key; the anchor is read only via `get_my_anchor()`. Write-integrity is deliberately deferred (own-data only; upgrade path = a dedicated INSERT-only role — not built here).
- **No number, ever** (FR-015): the client receives only a `band`; `label`/`stress_probability` are server-only via the SELECT column whitelist.
- **Operating point 0.53** is read from `metadata.json`, not hard-coded; `t_high=0.70` is a documented display-only product band.
- **Reuse, not re-copy** (Principle III): the shared 2958-d extraction (`compute_anchor` + a thin **tail-window option** — no new extraction path), feature-005 detector/self-view, feature-006 coverage gate + cause vocabulary.
- `[P]` = different files, no incomplete-task dependency. Commit after each task or logical group. Stop at any checkpoint to validate a story independently.
