# Tasks: Calibration Capture Quality

**Input**: Design documents from `/specs/006-calibration-capture-quality/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/{gate,messaging,unchanged}.md, quickstart.md

**Tests**: YES — this feature is TDD where the plan specifies it (Constitution
Principle VII / FR-017/018). Test tasks are written FIRST and must FAIL before the
implementation task that makes them pass.

**Organization**: This feature is a **sequential backend pipeline**, not a set of
parallel user stories. Per the plan's **Branch Commit Ordering**, the phases below
are the six PR-sized steps (plus Setup, a blocking Foundational confirmation, and a
Docs/Polish phase). Each phase lands on `006-calibration-capture-quality` with its
tests green before the next begins. `[US1]` = reject-thin (spec US1), `[US2]` =
accept-good / no-false-reject (US2), `[US3]` = calm message + chips-unchanged (US3)
— labels are for **traceability**, not independent/parallel delivery.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- Exact file paths are included in every task.

## Guardrails (carried from plan + tasks prompt — apply to EVERY task)

- **Thresholds stay `[CALIBRATION-PENDING]` until Phase 5 (Step 3).** No task before
  T015 may commit a calibrated threshold number. Earlier gate/wiring tests inject
  test-local thresholds via monkeypatch; the production constants are **inert**
  (`0` / `0.0`, gate disabled → never false-rejects) until calibration sets them.
- **Honest test, no mock-green.** The gate's own logic is NEVER mocked. The only
  injected seam is the native extraction (mediapipe). Fixtures are committed `.npy`
  landmark arrays extracted **once** in the pinned env (Python 3.12,
  `mediapipe==0.10.13` — **not** a 3.9 conda env). **CI runs no mediapipe.**
- **Categorical reason only on the wire.** `usable` / `kept` / `fraction` are
  **logged server-side only** and MUST NOT leave the server — keep them **out of the
  exception message string** (generic message + a separate `logger` line) so even
  `str(exc)` cannot leak counts. The 422 `reason` is the token `insufficient_face_frames`.
- **Additive only.** No new endpoint, status, response shape, dependency, or
  migration. Frontend gets exactly one new chip + one precedence branch; every
  existing chip still selects via `dominantCause`.

---

## Phase 1: Setup

**Purpose**: Confirm the environment and scaffold the fixtures location.

- [ ] T001 Confirm the active branch is `006-calibration-capture-quality` and the `packages/ml-video` env is the pinned one: `cd packages/ml-video && uv run python -c "import sys, mediapipe; print(sys.version.split()[0], mediapipe.__version__)"` MUST print `3.12.x 0.10.13` (NOT a 3.9 conda env). Record the output. If it differs, STOP and fix the env before any gate work.
- [ ] T002 [P] Scaffold `packages/ml-video/tests/fixtures/` with a placeholder `packages/ml-video/tests/fixtures/README.md` stating: fixtures are derived landmark `.npy` arrays (no frames), raw clips are intentionally NOT committed (Principle I/X), and provenance + the pinned env will be recorded at calibration (T015). Add `packages/ml-video/tests/fixtures/*.mp4` / `*.webm` to `.gitignore` so a raw clip can never be committed by accident.

**Checkpoint**: Pinned env verified; fixtures dir exists and raw clips are gitignored.

---

## Phase 2: Foundational (BLOCKING) — confirm the gate cannot touch inference

**Purpose**: Prove `compute_anchor` is on the baseline/anchor capture path ONLY,
**before** wiring the gate in, so the gate can never affect live inference.

**⚠️ CRITICAL**: T003 blocks Phase 4 (the wiring). Do not wire the gate until this
passes.

- [ ] T003 Trace every caller of `compute_anchor` / `ml_video.compute_anchor` across `apps/api/` and `packages/` (e.g. `grep -rn "compute_anchor" apps packages`). Confirm the ONLY invocation is the baseline/anchor capture path (`POST /anchor` in `apps/api/app/routers/anchor.py`), and that the live-inference path uses `Predictor.predict_delta` (a DIFFERENT entry point), not `compute_anchor`. Record the caller list in `specs/006-calibration-capture-quality/research.md` (a short "Path confirmation (T003)" note). If ANY live-inference or non-baseline caller of `compute_anchor` is found, STOP and report — do not proceed to wiring.

**Checkpoint**: `compute_anchor` confirmed baseline-path-only; safe to add the gate.

---

## Phase 3: Step 1 — Gate core (TDD)

**Goal**: A pure, correct usable-face-coverage gate, proven by hand-authored arrays
with injected thresholds — no real numbers, no real clips yet.

**Independent Test**: `uv run pytest -k coverage_gate` proves reject-if-either /
accept-if-both with the gate logic real and thresholds injected.

- [ ] T004 [US1] Write FAILING unit tests in `packages/ml-video/tests/test_usable_face_coverage_gate.py` using small hand-authored `(N, 956)` arrays (non-zero row = detected face; all-zero row = no-face, matching `pipeline._landmarks_from_result`). Monkeypatch `coverage.MIN_USABLE_FRAMES` / `coverage.MIN_COVERAGE_FRACTION` to test-local values. Assert: (a) `assert_usable_face_coverage` RAISES `FeatureExtractionError` with `exc.code == "insufficient_face_frames"` when `usable < floor` (high-coverage-but-too-few case) — reject via the **absolute floor**; (b) RAISES when `fraction < min` (full-length-but-intermittent case) — reject via the **coverage fraction**; (c) does NOT raise when BOTH clear; (d) `usable_face_coverage` returns `(usable, kept, fraction)` with `usable = count of non-zero rows`, `kept = N`. Do NOT mock the gate logic. Tests FAIL (module absent).
- [ ] T005 [US1] Add an optional keyword-only `code: str | None = None` to `FeatureExtractionError.__init__` in `packages/ml-video/src/ml_video/errors.py`, storing `self.code` (backward-compatible — existing raises keep `code=None`). Update the docstring to note `code` carries the categorical wire reason.
- [ ] T006 [US1] Create `packages/ml-video/src/ml_video/coverage.py`: `MIN_USABLE_FRAMES: int = 0` and `MIN_COVERAGE_FRACTION: float = 0.0` each marked `# [CALIBRATION-PENDING] — inert (gate disabled) until T015 sets calibrated values; tests inject thresholds`; `usable_face_coverage(landmarks) -> tuple[int,int,float]` using `kept = int(landmarks.shape[0])`, `usable = int(np.count_nonzero(np.any(landmarks, axis=1)))`, `fraction = usable/kept if kept else 0.0`; and `assert_usable_face_coverage(landmarks)` that, when `usable < MIN_USABLE_FRAMES or fraction < MIN_COVERAGE_FRACTION`, emits `logger.info("coverage reject: usable=%d kept=%d fraction=%.3f", usable, kept, fraction)` and raises `FeatureExtractionError("insufficient usable face coverage", code="insufficient_face_frames")` — **GENERIC message, NO counts in the string** (counts live only in the log line; supersedes the count-in-message snippet in `contracts/gate.md`).
- [ ] T007 [US1] Run T004 against the real `coverage.py` with monkeypatched thresholds → GREEN. Confirm reject-if-either / accept-if-both and the categorical `code`.

**Checkpoint**: Gate logic correct and proven; production thresholds still inert/pending.

---

## Phase 4: Step 2 — Wire the gate into `compute_anchor`

**Goal**: The gate runs at the real call site, before the existing floors, additively.

**Independent Test**: `compute_anchor` raises with `code=insufficient_face_frames`
on thin landmark rows (extraction monkeypatched; no mediapipe), and a detected clip
still reaches feature extraction.

- [ ] T008 [US1] Write FAILING tests in `packages/ml-video/tests/test_usable_face_coverage_gate.py` (wiring group): monkeypatch `pipeline._build_face_mesh` (per `test_pipeline_fixtures.py` pattern) so `extract_landmarks` yields a `DecodedClip` with mostly all-zero rows (thin), and monkeypatch the coverage thresholds to non-inert test values; assert `compute_anchor(path)` raises `FeatureExtractionError` with `code == "insufficient_face_frames"`. Add the inverse: an all-detected stream reaches `lbp_top_features`/`motion_features` (gate does not raise). FAIL (gate not wired).
- [ ] T009 [US1] Wire the gate into `packages/ml-video/src/ml_video/anchor.py`: insert `assert_usable_face_coverage(clip.landmarks)` on the line immediately AFTER `clip = extract_landmarks(video_path)` and BEFORE the `np.concatenate([lbp_top_features(...), motion_features(...)])`. Export `usable_face_coverage` / `assert_usable_face_coverage` from `packages/ml-video/src/ml_video/__init__.py`. Run T008 → GREEN. (Depends on T003, T006.)
- [ ] T010 [US1] Add a no-loosening regression test in `test_usable_face_coverage_gate.py`: a clip that the EXISTING floors reject (e.g. a stream that yields an ROI with zero usable frames, or `< 2` kept frames) is STILL rejected after the gate is wired, and when the gate passes, control reaches the floors unchanged. Confirms the gate is strictly additive (never loosens the floors). GREEN.

**Checkpoint**: Gate wired, additive, never loosening; still threshold-agnostic.

---

## Phase 5: Step 3 — Fixtures + calibration (sets the real numbers)

**Goal**: Extract landmark fixtures once in the pinned env, set the two thresholds
against the three real clips, and lock the honest boundary test.

**Independent Test**: `uv run pytest -k coverage_gate` rejects the thin fixture and
accepts BOTH good fixtures with the REAL constants and no monkeypatch.

- [ ] T011 [US2] Create the DEV-ONLY extractor `packages/ml-video/tests/fixtures/extract_coverage_fixtures.py` (NOT a `test_*` file → not collected by pytest; a `__main__` CLI). It takes `--thin`, `--good-ideal`, `--good-realistic` clip paths, runs `ml_video.pipeline.extract_landmarks` on each, and writes `{thin,good_ideal,good_realistic}.npy` (`float64 (N_kept,956)`) into `packages/ml-video/tests/fixtures/`. Docstring: run only via `uv run` in the pinned env (Python 3.12, mediapipe==0.10.13).
- [ ] T012 [US2] Run the extractor over the THREE real clips in the pinned env (clips supplied locally by Mohamed; raw clips NOT committed): `cd packages/ml-video && uv run python tests/fixtures/extract_coverage_fixtures.py --thin <thin> --good-ideal <ideal> --good-realistic <realistic>`. Commit the three `.npy` arrays only.
- [ ] T013 [US2] Measure and record: for each fixture print `usable_face_coverage(np.load(...))` (see quickstart §3) and record the per-clip `usable / kept / fraction` table in `specs/006-calibration-capture-quality/research.md` (a "Calibration measurements (T013)" section).
- [ ] T014 [US2] **STOP-gate**: verify a separating margin exists — the thin clip's coverage must be clearly BELOW both good clips' coverage, with the **good-realistic** clip the binding lower bound on the accept side. If the good-realistic clip's coverage is unexpectedly LOW (no gap that rejects thin while accepting good-realistic), DO NOT set a threshold under it — STOP and report (the clips or the metric need revisiting); do not proceed to T015.
- [ ] T015 [US2] Set `MIN_USABLE_FRAMES` and `MIN_COVERAGE_FRACTION` in `packages/ml-video/src/ml_video/coverage.py` so the thin fixture is REJECTED and BOTH good fixtures are ACCEPTED, with `MIN_COVERAGE_FRACTION` clearly below the good-realistic coverage and `MIN_USABLE_FRAMES` clearly below its usable count (coverage fraction = primary lever; absolute floor = secondary backstop). Record the chosen thresholds + the margin alongside the T013 table. Remove the `[CALIBRATION-PENDING]` inert markers.
- [ ] T016 [US2] Lock the honest boundary test (FR-017/018): in `test_usable_face_coverage_gate.py`, add fixture-based cases (no monkeypatch, REAL constants) asserting `assert_usable_face_coverage(load("thin.npy"))` raises with `code=insufficient_face_frames` (reject-below) and `assert_usable_face_coverage(load("good_ideal.npy"))` / `(load("good_realistic.npy"))` do NOT raise (accept-above; good-realistic is the binding **no-false-reject** case, SC-002). Add a gate-level no-regression assertion: the detected-throughout `good_*` arrays pass regardless of framing (off-centre-but-detected is not rejected here). Fill `tests/fixtures/README.md` with clip provenance + the pinned env + "raw clips not committed". Run `uv run pytest` → GREEN, and confirm the run imports no mediapipe (only numpy + committed `.npy`).

**Checkpoint**: Real thresholds set; thin rejects, both good clips accept; CI mediapipe-free.

---

## Phase 6: Step 4 — Surface the categorical reason through the 422

**Goal**: The gate's `code` reaches the existing 422 `reason` unchanged in shape;
no counts on the wire.

**Independent Test**: a gate-raised error → `422 {"error":"extraction_failed","reason":"insufficient_face_frames"}`; an existing error → `reason==str(exc)` as before.

- [ ] T017 [US3] Write FAILING pytest in `apps/api/tests/test_anchor.py` (extend if present, else create): monkeypatch `ml_video.compute_anchor` to raise `FeatureExtractionError("insufficient usable face coverage", code="insufficient_face_frames")` and assert the `POST /anchor` response is `422` with body exactly `{"error":"extraction_failed","reason":"insufficient_face_frames"}` (categorical; assert the body contains NO digits / no `usable`/`kept`/`fraction`). Second case: monkeypatch it to raise a legacy `FeatureExtractionError("some message")` (no code) and assert `reason == "some message"` (unchanged). FAIL first.
- [ ] T018 [US3] In `apps/api/app/routers/anchor.py`, change the 422 mapping to `reason = getattr(exc, "code", None) or str(exc)` (one line; same endpoint, status, and `{error, reason}` body). Run T017 → GREEN. Confirm the gate's generic message means no counts can surface even via `str(exc)`.

**Checkpoint**: Categorical reason on the wire; existing-error reasons unchanged; no new API surface.

---

## Phase 7: Step 5 — Frontend chip (additive) + no-regression

**Goal**: One new `insufficient-face` chip driven by the server reason; every
existing chip still selects via `dominantCause`.

**Independent Test**: a 422 with `insufficient_face_frames` → new chip; any other
reason → unchanged `dominantCause` selection; existing chips byte-for-byte unchanged.

- [ ] T019 [US3] Write FAILING Vitest in `apps/web/components/anchor/failure-state.test.tsx` (new chip render) and `apps/web/components/anchor/anchor-recorder.test.tsx` (selection precedence): (a) `reason==="insufficient_face_frames"` → `FailureState` gets `cause="insufficient-face"` and renders the face-absence copy; (b) a 422 with any OTHER reason (including detector-unavailable telemetry) → `cause === dominantCause(telemetry)` (unchanged, incl. `our-side`); (c) the three existing `CAUSE` entries (low-light / out-of-frame / our-side) are unchanged. FAIL first.
- [ ] T020 [US3] In `apps/web/components/anchor/failure-state.tsx`, add `"insufficient-face"` to the `FailureCause` union and ONE `CAUSE` entry — icon `ScanFace` (or `EyeOff`), line `"We couldn't see your face for enough of that recording — let's try again."`. Leave the existing three entries untouched.
- [ ] T021 [US3] In `apps/web/components/anchor/anchor-recorder.tsx::submitClip`, add the server-reason precedence branch on `extraction_failed`: `const cause = result.reason === "insufficient_face_frames" ? "insufficient-face" : dominantCause(telemetryRef.current); setFailureCause(cause);` (the existing `dominantCause` path is otherwise unchanged; `dispatch EXTRACT_FAILED reason` stays). Run T019 → GREEN.
- [ ] T022 [P] [US3] Static voice/colour check (mirrors the 005 SC-005/SC-009 checks): assert the new chip line contains no `!` and none of `detected|alert|abnormal|elevated risk`, and renders only foggy tokens (no amber/crimson) on `failure-state.tsx`. Add/extend the existing static test.

**Checkpoint**: Calm, specific face-absence message via the existing failure screen; existing chip selection proven unchanged.

---

## Phase 8: Step 6 — Docs, decisions & smoke (Polish & Cross-Cutting)

**Purpose**: Land the decision log, the ordering note, the glasses record, and the
manual smoke set.

- [ ] T023 [P] Append `docs/DECISIONS.md` entries 29–32 (continuing from 005's 28): 29 gate placement + composition with the floors; 30 messaging via new `insufficient_face_frames` reason in the existing 422 (categorical-only, counts log-only) + server-reason precedence; 31 calibration method + the recorded per-clip measurements and chosen thresholds (reference the T013/T015 record); 32 glasses guidance. Per plan "DECISIONS.md entries this plan implies".
- [ ] T024 [P] Append `docs/CHANGELOG.md` the feature-ordering drift note: the constitution's provisional slot `006-stress-inference-service` is realized as `006-calibration-capture-quality` (Principle VIII — provisional reordering recorded).
- [ ] T025 [P] Append `docs/PROGRESS.md` a running entry for feature 006 (gate shipped; thresholds calibrated; messaging additive).
- [ ] T026 [P] Record the glasses guidance + thesis limitation (DECISION-32 / thesis notes): "calibrate the way you normally sit, glasses included; avoid glare; do not ban glasses"; caveat that it is a **between-subject** comparison (not proof of zero effect), cannot test calibrate-with / infer-without mismatch, and group sizes are modest (24/53; macro-F1 0.720 vs 0.717; stress recall 0.844 vs 0.818). Investigation-only — no code.
- [ ] T027 Author `specs/006-calibration-capture-quality/smoke-tests.md` with the THREE manual flow-level checks (Mohamed runs after `/speckit-implement`, records results): (1) record a minute with the face out of frame for almost all of it (~2s of face) → expect **422 → the failure screen with the face-absence chip** ("We couldn't see your face for enough of that recording…"), NOT "Your baseline is set" and NOT the "our-side" chip; (2) record a genuine full minute sitting normally → expect **success** ("Your baseline is set"); (3) record a realistic minute with natural brief look-aways (glances down/away, a shift) → expect **success** — the **no-false-reject at the flow level** (not just the unit fixture). Plus a control: an off-centre-but-detected minute still behaves as before (this gate does not reject it; existing framing chips unchanged).
- [ ] T028 Final validation: run `cd packages/ml-video && uv run pytest`, the `apps/api` pytest suite, and `apps/web` Vitest — all GREEN; walk quickstart.md §1/§4/§5. Confirm via diff review that the change introduced **no new endpoint, status, response shape, dependency, or migration**, and that `usable`/`kept`/`fraction` appear only in a server `logger` line (never in the 422 body or the exception message). Update the `checklists/requirements.md` note if needed.

**Checkpoint**: Decisions logged, ordering recorded, smoke authored; full suite green; boundaries verified.

---

## Dependencies & Execution Order

### Phase order (sequential — the plan's Branch Commit Ordering)

1. **Phase 1 Setup** → 2. **Phase 2 Foundational (T003 path confirmation — BLOCKS Phase 4)** → 3. **Step 1 Gate core** → 4. **Step 2 Wiring** → 5. **Step 3 Fixtures + calibration** → 6. **Step 4 Router reason** → 7. **Step 5 Frontend chip** → 8. **Step 6 Docs + smoke**.

Each phase lands as a PR-sized commit on `006-calibration-capture-quality` with its
tests green before the next phase starts.

### Hard dependencies

- T003 (path confirmation) **blocks** T009 (wiring).
- T004 → T005 → T006 → T007 (TDD: test fails, error.code, gate module, test green).
- T008 → T009 → T010 (wiring TDD + no-loosening).
- T011 → T012 → T013 → **T014 (STOP-gate)** → T015 (set numbers) → T016 (lock fixtures test). No threshold number is committed before T015.
- T017 → T018 (router TDD then 1-line change). T018 depends on the gate raising `code` (T009/T015 exist) but is independent of the frontend.
- T019 → T020 → T021 → T022 (frontend TDD then additive chip + precedence + static check).
- Phase 8 depends on Phases 3–7 being complete (it records what was built); T027/T028 depend on everything.

### Parallel opportunities (limited — backend pipeline)

- T002 is `[P]` (independent scaffold).
- After the gate raises `code` and the calibration is locked (≤ Phase 5), **Phase 6
  (router)** and **Phase 7 (frontend)** are in different trees and could proceed in
  parallel if staffed.
- The docs tasks T023–T026 are `[P]` (different doc files); T022 is `[P]`.

### Why NOT independently-parallel user stories

The spec's US1/US2/US3 are three views of ONE mechanism: US1 (reject) and US2
(accept) are decided by the same gate function + calibration, and US3 (the message)
is meaningless until the gate rejects. So the labels trace requirements but the work
is the sequential pipeline above — this intentionally departs from the template's
parallel-story assumption, per the plan and the tasks directive.

---

## Implementation Strategy

### MVP (the correctness fix)

Phases 1–5 (Setup → Foundational → Gate core → Wiring → Fixtures + calibration)
deliver the load-bearing fix: the thin clip is **rejected** (HTTP 422) and both good
clips are **accepted**, decided server-side in `packages/ml-video/`. At this point
the bug is fixed; the user reaches the failure screen instead of a false success.

### Complete the spec

Phases 6–7 add the calm, specific face-absence message (US3) so the rejection is
explained correctly even when the on-device detector was unavailable (the FR-011
case where the client would otherwise show "our-side"). Phase 8 logs decisions and
authors the smoke set.

### Validate

Run the smoke set (T027): thin → 422 + face-absence chip; full minute → success;
realistic look-aways → success (no false reject at the flow level).

---

## Notes

- `[P]` = different files, no incomplete-task dependency.
- TDD tasks (T004, T008, T017, T019) write the failing test first; do not implement
  before the test fails for the right reason.
- Commit after each phase (PR-sized) with that phase's tests green.
- Privacy is load-bearing: counts live ONLY in a server `logger` line — never in the
  exception message, the 422 body, or anywhere the client can read (Principle I / FR-016).
- No new endpoint/status/response-shape/dependency/migration anywhere (verified in T028).
