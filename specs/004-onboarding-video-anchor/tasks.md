---
description: "Ordered task list for feature 004-onboarding-video-anchor"
---

# Tasks: Onboarding Video Anchor Flow

**Input**: Design documents from `/specs/004-onboarding-video-anchor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, contracts/components.md, contracts/migration.md, quickstart.md

**Tests**: Per Constitution Principle VII, this feature ships: pytest for `packages/ml-video/` (fixture-locked regression) and `apps/api/` (`/anchor` happy + failure modes + raw-byte-deletion invariant + 401 + 415); Vitest + RTL for the recorder reducer, device picker, countdown, banner, typed client, and cross-tab helpers; two Playwright specs (`anchor-onboarding.spec.ts` happy path, `anchor-skip.spec.ts` skip path) with MediaRecorder + the FastAPI call mocked (📌 DECISION-18 — CI does not record 60s of real video); and a human-run `smoke-tests.md` (authored in this same commit) including the cross-browser webcam matrix (FR-045).

**Organization**: Tasks follow the plan's **Branch Commit Ordering** (steps 1–13). Each step is a PR-sized unit; the ordering is contractual — earlier steps gate later steps. Two orderings are **load-bearing**: (R-5) the CSP `connect-src` edit (Step 4) lands BEFORE any component calls the backend (Steps 5–6); and the migration (Step 3) lands BEFORE the demo seed (Step 10) since the seed writes the new columns. CI must be green at the end of each step before the next starts.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel within the same step (different files, no incomplete deps).
- **[Story]**: User-story label (`US1`–`US7`) for traceability — matches `spec.md` priorities (US1 calibrate-during-onboarding, US2 skip+banner, US3 private-capture/RLS, US4 managers-never-see, US5 failure-recovery, US6 demo-clean-dashboard, US7 cross-tab-sync).
- **⚠ Principle VII**: marker when a task introduces code without immediate test coverage; the line names the downstream task that exercises it.
- **📌 DECISION-n**: marker tagging the task as the source for the `docs/DECISIONS.md` entry `n` from plan.md's "DECISIONS.md entries this plan implies" list (entries 1–12). T061 collects all entries during `/speckit.implement`; the source task is named at the point of work so Mohamed can audit each entry against the actual diff.
- **🙋 NEEDS MOHAMED**: marker for a task that needs Mohamed's decision/sign-off before or during implementation (copy wording, prod deploy origin).

## Path Conventions

Paths are repo-relative. This is the first feature to span `apps/web/` (frontend), `apps/api/` (new FastAPI service), `packages/ml-video/` (new Python package), `supabase/migrations/`, and `scripts/`. The raw-signal boundary rule (Constitution Architecture Constraints) holds: video bytes live only in `apps/api/` + `packages/ml-video/`; `apps/web/` only ever handles the derived 2958-d vector.

## Cross-cutting notes

- **Privacy is structural (📌 DECISION-12, Principle I).** All three anchor columns (`anchor_vector`, `anchor_captured_at`, `anchor_model_version`) are excluded from the `authenticated` SELECT column whitelist — no client role can read them. Calibration status is exposed only via the scope-guarded `has_anchor(auth.uid())` SECURITY DEFINER function. This is the amended (stricter) posture per CHANGELOG/DECISIONS 2026-05-27.
- **Raw video bytes are deleted server-side immediately** after extraction, on success or failure (Principle I). The temp file is removed in a `finally`. No `anchor_video_path` is stored.
- **The backend holds no Supabase DB credentials** (📌 DECISION-9, Principle IX). It verifies the caller's JWT (`SUPABASE_JWT_SECRET`, env-only) and returns the vector; the **web app** writes it via the user's session-scoped client.
- **Python 3.12 only** (📌 DECISION-1) — `mediapipe==0.10.13` has no 3.13 wheel. ML deps pinned exactly to `metadata.json` (sklearn `1.6.1` load-bearing, 📌 DECISION-3).
- **Calm voice on every string** (Principle V): no exclamation marks, no "REQUIRED"/"MANDATORY", no clinical/alarmist words. Copy is drafted in research/plan; final wording is locked with Mohamed (T038/T044, 🙋).
- **Responsive + accessible** (Principle VI): 360px floor, light+dark parity, `prefers-reduced-motion` collapses the countdown to a numeric tick, ≥44×44px targets.
- **Commit cadence**: one step ≈ one commit (a few tasks may share a commit where they form one coherent unit). Commit messages use `<scope>(004): <imperative summary>` matching feature-002/003 convention.
- **The constitution amendment + `docs/MODELS.md` + the plan amendment already landed** (commits on this branch). This task list builds against the amended v1.3.0 constitution and the stricter DECISION-12.

---

## Phase 1: Setup (pre-flight verification)

**Purpose**: Confirm the toolchain and artifact prerequisites are in place. No code is written in this phase.

- [X] T001 [P] Verify **Python 3.12** and **`uv`** are available on the dev machine (`python --version` → 3.12.x; `uv --version` succeeds). Python 3.13 will NOT work — `mediapipe==0.10.13` has no 3.13 wheel (📌 DECISION-1). NOT a code task.
- [X] T002 [P] Verify the model artifacts still exist at `tmp/model-artifacts/` (`model.joblib`, `scaler.joblib`, `metadata.json`) — they are the source for the Step-1 relocation (📌 DECISION-6). The training figure already moved to `docs/models/` in the first commit. NOT a code task.
- [X] T003 [P] Verify `apps/api/` and `packages/` do NOT yet exist (this feature scaffolds both fresh). Confirm root `package.json` `workspaces` globs `apps/*` + `packages/*` — npm only adopts dirs with a `package.json`, so the Python-only `apps/api/` and `packages/ml-video/` are ignored by npm (no `package.json` is added to either). NOT a code task.

**Checkpoint**: Pre-flight green. Step 1 may begin.

---

## Phase 2: Step 1 — `packages/ml-video/` package (US1, US3, US5) 🎯 prerequisite for the API

**Goal**: Stand up the first ML package: the LBP-TOP + motion feature-extraction pipeline and the model loader, with the artifacts relocated from `tmp/`. The package is importable as `ml_video` and tests green standalone. **No `/predict` exposure** — the predict path exists in the loader but is unused in 004 (feature 005).

**Independent Test**: `cd packages/ml-video && uv run pytest` passes; `inspect_anchor.py` decodes a sample blob and prints shape `(2958,)`.

**📌 DECISION-5 sourced here** (real editable package over PYTHONPATH; pipeline/loader layout). **📌 DECISION-6 sourced here** (artifact relocation + `tmp/` gitignore).

### Implementation for Step 1

- [X] T004 Create `packages/ml-video/pyproject.toml` (PEP 621): `name = "ml-video"`, import package `ml_video`, `requires-python = ">=3.10,<3.13"`, deps pinned exactly per 📌 DECISION-3 (`scikit-learn==1.6.1`, `numpy==2.0.2`, `pandas==2.3.3`, `opencv-python==4.13.0`, `scikit-image==0.25.2`, `mediapipe==0.10.13`, `joblib==1.5.3`); `xgboost` excluded (research-only). Ruff + pytest config. ⚠ Principle VII: covered by T012.
- [X] T005 Relocate `tmp/model-artifacts/{model.joblib,scaler.joblib,metadata.json}` → `packages/ml-video/models/` and add a `tmp/` line to repo-root `.gitignore` (📌 DECISION-6, Principle II — artifacts live in `packages/ml-*/models/`). Confirm `git status` no longer shows the artifacts as committable and `tmp/` is ignored.
- [X] T006 [P] [US1] Create `packages/ml-video/src/ml_video/features.py`: LBP-TOP per ROI (mouth/left_eye/right_eye, fixed order, `P=8 R=1` uniform → 30/ROI → 90-d) and motion features (`np.diff` → abs → mean/std/max → 2868-d), per `MODEL_HANDOFF.md` §4 Steps 4–5. ⚠ Principle VII: covered by T012.
- [X] T007 [P] [US1] Create `packages/ml-video/src/ml_video/pipeline.py`: decode → 5fps downsample (`skip_ratio = round(fps/5)`) → `%2` frame skip → MediaPipe FaceMesh (`refine_landmarks=True`, 478 landmarks → 956 flat; zero-row on no-detect) → returns the kept-frame landmark array, per `MODEL_HANDOFF.md` §4 Steps 1–3 (Principle III — modality logic stays in this package). ⚠ Principle VII: covered by T012.
- [X] T008 [US1] Create `packages/ml-video/src/ml_video/anchor.py`: `compute_anchor(video_path) -> np.ndarray` running pipeline → features → concat to `(2958,)`. **No anchor subtraction** (anchors are absolute features). Raises `FeatureExtractionError` on `<90`-d LBP (ROI dropped) or any malformed result (📌 DECISION-5, FR-012). ⚠ Principle VII: covered by T012.
- [X] T009 [US1] Create `packages/ml-video/src/ml_video/loader.py`: `load_model()` loads `models/{model,scaler}.joblib`, asserts `scaler.n_features_in_ == 2958` and `model.classes_ == [0, 1]`, returns a `Predictor` (scaler+model wired). The predict method exists but **no 004 caller invokes it** (feature 005). (📌 DECISION-10 startup-check source; Principle II.) ⚠ Principle VII: covered by T012.
- [X] T010 [P] Create `packages/ml-video/src/ml_video/errors.py` defining `FeatureExtractionError`.
- [X] T011 [P] Create `packages/ml-video/scripts/inspect_anchor.py` — decode a `\x`-hex or base64 bytea blob → `np.frombuffer(..., "<f4")` → print shape/min/max/mean (resolved decision 1 debug helper).
- [X] T012 [US1] Create `packages/ml-video/tests/test_pipeline_fixtures.py` (Principle VII ML rule, 📌 DECISION-18): mock MediaPipe FaceMesh to emit a scripted landmark stream → assert `compute_anchor` returns `(2958,)` and matches a **fixture-locked** expected vector (guards preprocessing regressions); plus `load_model()` passes the `n_features_in_`/`classes_` assertions.

**Checkpoint**: `packages/ml-video/` installs and tests green; artifacts in `models/`; `tmp/` gitignored.

---

## Phase 3: Step 2 — `apps/api/` FastAPI service (US1, US3, US5)

**Goal**: Scaffold the FastAPI service, editable-install `ml-video`, load the model at startup (fail-fast), and expose `POST /anchor` (JWT-verified, deletes raw bytes) + `GET /healthz`. No `/predict`.

**Independent Test**: `cd apps/api && uv run uvicorn app.main:app --port 8000` starts only when the model loads; `curl /healthz` → 200 with model_version; `uv run pytest` green (happy mocked, 422 no-face, 401, 415, raw-byte-deletion).

**📌 DECISION-1/2/4 sourced here** (Python 3.12 pin, `pyproject.toml`+`uv.lock`, layout). **📌 DECISION-8 sourced here** (`/anchor` contract). **📌 DECISION-9 sourced here** (JWT; no DB creds). **📌 DECISION-10 sourced here** (`/healthz`). **📌 DECISION-11 sourced here** (MP4+WebM). **📌 DECISION-7 sourced here** (local-only; Dockerfile forward artifact).

### Implementation for Step 2

- [X] T013 Scaffold `apps/api/`: `pyproject.toml` (PEP 621, `requires-python = ">=3.10,<3.13"`, deps `fastapi`, `uvicorn[standard]`, `python-multipart`, `pyjwt`, `pydantic-settings`, and the path dep `ml-video` editable), `.python-version` (3.12), `uv.lock` (`uv sync`), `app/__init__.py` (📌 DECISION-1/2/4). ⚠ Principle VII: covered by T021/T022.
- [X] T014 Create `apps/api/app/config.py` (pydantic-settings) reading `SUPABASE_JWT_SECRET` and `ALLOWED_ORIGIN` from **env only** — no defaults that embed secrets (Principle IX, 📌 DECISION-9). ⚠ Principle VII: covered by T021.
- [X] T015 Create `apps/api/app/auth.py`: `verify_jwt()` FastAPI dependency — parse `Authorization: Bearer`, verify HS256 with `SUPABASE_JWT_SECRET`, check `exp` + `aud == "authenticated"`, return `sub` as `user_id`; raise 401 on missing/invalid. No client-supplied id trusted (FR-046, 📌 DECISION-9, Principle IX). ⚠ Principle VII: covered by T021.
- [X] T016 Create `apps/api/app/main.py`: app factory; **startup** calls `ml_video.load_model()` and aborts boot on failure (📌 DECISION-10, Principle II); CORS allows `ALLOWED_ORIGIN` + `Authorization` header; mounts routers. ⚠ Principle VII: covered by T021/T022.
- [X] T017 [P] Create `apps/api/app/schemas.py`: pydantic response models (`AnchorResponse {model_version, dim, vector_b64}`, error shapes).
- [X] T018 [P] [US1] Create `apps/api/app/routers/health.py`: `GET /healthz` → 200 `{status:"ready", model_version}` (no auth) (📌 DECISION-10, FR-048). ⚠ Principle VII: covered by T023.
- [X] T019 [US3] Create `apps/api/app/routers/anchor.py`: `POST /anchor` — `Depends(verify_jwt)`; accept `multipart/form-data` field `clip` (MP4/WebM; else 415, 📌 DECISION-11); write to a temp file; `compute_anchor(path)`; **delete the temp file in a `finally`** (Principle I, unconditional); on success return base64 LE-float32 (`vector_b64`); map `FeatureExtractionError` → 422 `{error:"extraction_failed", reason}` (📌 DECISION-8, FR-016/017). ⚠ Principle VII: covered by T022.
- [X] T020 [P] Create `apps/api/.env.example` (`SUPABASE_JWT_SECRET=`, `ALLOWED_ORIGIN=`, no values), `apps/api/Dockerfile` (`python:3.12-slim`, `uv sync --frozen`, copies `packages/ml-video`), `apps/api/README.md` (local run; mirrors quickstart.md) (📌 DECISION-7, Principle IX). 🙋 NEEDS MOHAMED: the production deploy target (droplet origin) is `[TBD by deployment]` — 004 ships local-only; the Dockerfile is a forward artifact, not deployed here.
- [X] T021 [US3] Create `apps/api/tests/conftest.py` + `test_anchor.py` (📌 DECISION-18, Principles VII + I): fixtures = FastAPI `TestClient`, a fake-but-valid JWT signed with a test secret, a synthetic no-face clip (`cv2.VideoWriter`), and a mocked-FaceMesh happy path. Tests: (a) happy → 200 valid `vector_b64`; (b) no-face → 422 `extraction_failed`; (c) missing/invalid JWT → 401; (d) `text/plain` upload → 415; (e) **raw-byte-deletion invariant** — patch `compute_anchor` to capture the temp path, assert it does not exist after the response.
- [X] T022 [P] [US1] Create `apps/api/tests/test_health.py`: `/healthz` → 200 with `model_version`; (optionally) a startup-fails-without-model assertion.

**Checkpoint**: API boots only with a loaded model; `/healthz` + `/anchor` behave per contract; pytest green incl. the privacy invariant.

---

## Phase 4: Step 3 — Migration: anchor columns, grants, `has_anchor()` (US3)

**Goal**: Add the three nullable columns, tighten the `authenticated` SELECT whitelist to **exclude all three anchor columns**, widen the UPDATE whitelist, and add the scope-guarded `has_anchor()` function — the load-bearing Principle I mechanism (amended/stricter DECISION-12).

**Independent Test**: After the migration, `has_column_privilege('authenticated', ..., 'anchor_vector'/'anchor_captured_at'/'anchor_model_version', 'SELECT')` all return **false**; UPDATE on those columns returns **true**; `has_anchor(auth.uid())` works for self and **raises 42501** for another user's id. A team_lead/admin cannot read any anchor column of a report (SC-005).

**📌 DECISION-12 sourced here** (columns + SELECT whitelist excluding all three + `has_anchor()`; Principles I + IX).

### Implementation for Step 3

- [X] T023 [US3] **Blast-radius audit** (Risk R-6): grep `apps/web/` for every `profiles` read (`proxy.ts`, `components/header/*`, `(authed)/app/account/*`, `lib/auth/role-gate.ts`) and confirm each selects **explicit columns**, not `select("*")`. Pin any `*` to explicit columns BEFORE T025 lands. The new SELECT whitelist enumerates every currently-read column (`id, full_name, role, manager_id, created_at, updated_at`). NOT a code task unless a `*` is found.
- [X] T024 [US3] Create `supabase/migrations/20260527000000_anchor_columns.sql` — DDL: `ALTER TABLE public.profiles ADD COLUMN anchor_vector bytea, ADD COLUMN anchor_captured_at timestamptz, ADD COLUMN anchor_model_version text;` (all nullable, no CHECK; 📌 DECISION-12). ⚠ Principle VII: covered by T027.
- [X] T025 [US3] Same migration — SELECT column whitelist (Principle I): `REVOKE SELECT ON public.profiles FROM authenticated;` then `GRANT SELECT (id, full_name, role, manager_id, created_at, updated_at) ON public.profiles TO authenticated;` (excludes all three anchor columns). Widen UPDATE: `GRANT UPDATE (full_name, anchor_vector, anchor_captured_at, anchor_model_version) ON public.profiles TO authenticated;` (extends slice-1's `full_name`-only grant). RLS policies are **left unchanged** (📌 DECISION-12, per contracts/migration.md). ⚠ Principle VII: covered by T027.
- [X] T026 [US3] Same migration — `CREATE OR REPLACE FUNCTION public.has_anchor(target_user uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''` with a scope guard (`RAISE 42501` if `target_user <> auth.uid()`) returning `EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user AND anchor_vector IS NOT NULL)`; `ALTER FUNCTION ... OWNER TO postgres;` `REVOKE EXECUTE ... FROM PUBLIC, anon;` `GRANT EXECUTE ... TO authenticated;` (📌 DECISION-12, Principles I + IX; slice-1 hardening pattern). ⚠ Principle VII: covered by T027.
- [X] T027 [US3] Verification (SC-005): run the `has_column_privilege` checks from `contracts/migration.md` (all three anchor columns SELECT=false; `full_name` SELECT=true; anchor UPDATE=true), `has_function_privilege` (authenticated EXECUTE=true, anon=false), and a behavioral check that `has_anchor(<other user's id>)` raises `42501`. NOT a code task; record results.

**Checkpoint**: Columns exist; no client role can read any anchor column; owner can write own anchor; `has_anchor()` is self-only.

---

## Phase 5: Step 4 — Security headers (US1) ⚠ R-5: lands BEFORE any backend call

**Goal**: Relax `camera=(self)` to the two capture routes only (site-wide deny stays; mic stays denied), and add the FastAPI origin to CSP `connect-src`. COEP stays unset.

**Independent Test**: Emitted headers show `camera=(self)` ONLY on `/onboarding` and `/app/calibrate`, `camera=()` everywhere else, `microphone=()` everywhere, `connect-src` includes the FastAPI origin (dev `http://127.0.0.1:8000`), no COEP header (SC-011).

**📌 DECISION-16 sourced here** (per-route `camera=(self)`; CSP `connect-src` += API origin; COEP unset).

### Implementation for Step 4

- [X] T028 [US1] Add `NEXT_PUBLIC_API_URL` to `apps/web/lib/env/` schema + `client.ts` (public env var) and document it in `apps/web/.env.example` (dev `http://127.0.0.1:8000`). ⚠ Principle VII: covered by T032 + existing env schema tests.
- [X] T029 [US1] Edit `apps/web/proxy.ts` `buildCsp`: append the FastAPI origin (`clientEnv.apiUrl`) to the `connect-src` directive — dev default `http://127.0.0.1:8000`; prod the configured origin (📌 DECISION-16, FR-038). This is the first non-Supabase, non-same-origin `connect-src` entry. ⚠ Principle VII: covered by T032.
- [X] T030 [US1] Edit `apps/web/next.config.ts` `headers()`: keep the site-wide `camera=(), microphone=(), …` on `source: "/(.*)"`; add narrower `source` entries for `/onboarding` and `/app/calibrate` with `camera=(self), microphone=(), …` (mic still denied — audio is 013) (📌 DECISION-16, FR-036/037). Consult `node_modules/next/dist/docs/` for per-`source` header precedence (per `apps/web/AGENTS.md`) before relying on match order. ⚠ Principle VII: covered by T032.
- [X] T031 [US1] Confirm **COEP stays unset** in both `next.config.ts` and `proxy.ts` — no WASM is loaded in `apps/web/` (extraction is server-side) (FR-039). NOT a code task (a verification/assertion).
- [X] T032 [US1] Verify emitted headers (curl or Playwright `response.headers()`): `Permissions-Policy` is `camera=(self)` on the two routes and `camera=()` elsewhere; `microphone=()` everywhere; `Content-Security-Policy` `connect-src` contains the API origin; no `Cross-Origin-Embedder-Policy` header (SC-011). NOT a code task.

**Checkpoint** (R-5 satisfied): the browser is now allowed to call the FastAPI origin and use the camera on the two routes — BEFORE any component attempts it.

---

## Phase 6: Step 5 — Typed API client (US1)

**Goal**: The single typed module that talks to the FastAPI origin (transport rule — no untyped `fetch` in components).

**Independent Test**: Vitest mocks `fetch`; `postAnchor` sends `multipart/form-data` with `Authorization: Bearer`, and maps 200/401/415/422 to the typed union; `checkHealth` returns a boolean.

**📌 DECISION-13 sourced here** (typed client wrapper).

### Implementation for Step 5

- [X] T033 [US1] Create `apps/web/lib/api/anchor-client.ts`: `postAnchor(clip: Blob, accessToken: string): Promise<AnchorResult>` (FormData multipart, `Authorization: Bearer`, typed `{ok:true,...} | {ok:false,kind}` union) and `checkHealth(): Promise<boolean>` (GET `/healthz`). Reads the origin from `clientEnv.apiUrl`. No untyped `fetch` leaks out of this module (Architecture Constraints transport rule). ⚠ Principle VII: covered by T034.
- [X] T034 [US1] Create `apps/web/lib/api/anchor-client.test.ts` (Vitest): mock `fetch`; assert multipart body + Authorization header on `postAnchor`; assert the 200/401/415/422 → union mapping; assert `checkHealth` true/false on reachable/unreachable.

**Checkpoint**: a typed, tested client exists; CSP already permits its origin (Step 4).

---

## Phase 7: Step 6 — Recorder component (US1, US5)

**Goal**: The client recording component and its state machine — device picker, permission, 60s countdown, upload, extract, failure/retry/escape, skip reveal — reused by both onboarding and `/app/calibrate`.

**Independent Test**: Vitest drives the reducer through all transitions; the device picker shows "Default camera" pre-grant and real labels post-grant; the countdown collapses to a numeric tick under reduced motion; `failureCount` increments only on 422; skip reveals after 1 failure or scroll; the 3-fail escape appears at exactly 3.

**📌 DECISION-13 sourced here** (boundary, state machine, device/codec/upload).

### Implementation for Step 6

- [X] T035 [US1] Create `apps/web/components/anchor/use-anchor-recorder.ts` — the reducer state machine (`idle → device-selecting → permission-requesting → permission-granted → recording → uploading → extracting → success`; branches `permission-denied`, `upload-failed`, `extract-failed`). `failureCount` increments ONLY on backend 422 (FR-027); transport/permission failures do not. Skip visibility = `failureCount ≥ 1 || scrolledPastExplanation` (FR-004). Escape affordance at `failureCount ≥ 3` (FR-027/028). (📌 DECISION-13.) ⚠ Principle VII: covered by T039.
- [X] T036 [US1] Create `apps/web/components/anchor/device-picker.tsx`: `enumerateDevices()` video inputs; pre-grant "Default camera" placeholder → post-grant real labels; persist chosen `deviceId` to `localStorage["serenify-anchor-camera"]`; on mount pre-select stored device if present, else fall back to default without error (📌 DECISION-13, FR-005). ⚠ Principle VII: covered by T040.
- [X] T037 [US1] Create `apps/web/components/anchor/countdown.tsx`: 60→0 visible countdown, auto-stop at 0; animated ring by default; numeric tick under `prefers-reduced-motion` (FR-008/009, Principle VI). ⚠ Principle VII: covered by T040.
- [X] T038 [US1] [US5] Create `apps/web/components/anchor/anchor-recorder.tsx`: orchestrates the machine — `checkHealth()` pre-check (unreachable → "calibration is temporarily unavailable" copy, no recording offered, FR-048); self-preview via `getUserMedia`; MediaRecorder codec probe (`vp9 → vp8 → mp4 → default`); on success decode `vector_b64` → `\x` hex bytea → write `anchor_vector`/`anchor_captured_at`/`anchor_model_version` to own row via the session Supabase client (resolved decision 2) → `broadcastAnchorCaptured()` (T048) → `onComplete()`; failure/retry copy + skip + 3-fail escape (📌 DECISION-13; FR-004/007/026/027/048; Principles V + VI). 🙋 NEEDS MOHAMED: lock the calm-voice copy strings (explanation, permission-denied, failure/retry, temporarily-unavailable) against the Principle V rubric. ⚠ Principle VII: e2e-covered by T054/T055.
- [X] T039 [US5] Create `apps/web/components/anchor/use-anchor-recorder.test.ts` (Vitest): all transitions; `failureCount` only on 422; skip-reveal logic; 3-fail escape at exactly 3 (SC-006).
- [X] T040 [P] [US1] Create `apps/web/components/anchor/device-picker.test.tsx` + `countdown.test.tsx` (Vitest + RTL): pre/post-grant labels, remembered-device fallback; countdown numeric tick under mocked reduced-motion (SC-010).

**Checkpoint**: the recorder works in isolation; reducer + picker + countdown unit-tested.

---

## Phase 8: Step 7 — Onboarding integration (US1, US4)

**Goal**: Make the anchor step the second onboarding step for employees (in-page, post-name); managers complete at the name step.

**Independent Test**: A fresh employee sets their name and advances in-page to the recorder (no `/app` redirect); a team_lead/admin sets their name and is redirected to `/app` (no anchor step).

**📌 DECISION-14 sourced here** (onboarding inline-step; proxy bounce rationale).

### Implementation for Step 7

- [X] T041 [US1] [US4] Edit `apps/web/app/(onboarding)/onboarding/actions.ts`: `completeOnboarding` sets `full_name`, then for an **employee** returns `{status:"ok"}` (no server redirect) so the client advances to the anchor step; for **team_lead/admin** keeps the existing server redirect to `/app` (📌 DECISION-14, FR-001/029, Principle I product-coherence). ⚠ Principle VII: covered by T043 + T054.
- [X] T042 [US1] Edit `apps/web/app/(onboarding)/onboarding/onboarding-form.tsx` + `page.tsx`: 2-step client state — step 1 name (unchanged), on employee `ok` advance to `<AnchorRecorder context="onboarding" onComplete={→ /app} onSkip={→ /app} />` (FR-001/003). ⚠ Principle VII: covered by T043 + T054.
- [X] T043 [US1] Create `apps/web/app/(onboarding)/onboarding/onboarding-form.test.tsx` (placed at `tests/unit/onboarding-form.test.tsx` per project convention + vitest include) (Vitest + RTL): name save → employee sees recorder (no navigation); manager path does not render the recorder.

**Checkpoint**: onboarding shows the anchor step to employees only; managers unaffected.

---

## Phase 9: Step 8 — `/app` banner + `/app/calibrate` route (US2, US4)

**Goal**: The calibration banner on `/app` (employee, no anchor) and the dedicated employee-only recording route.

**Independent Test**: An uncalibrated employee on `/app` sees the banner; dismiss → hidden this session; "Calibrate now" → `/app/calibrate` → record → `/app` no banner. A team_lead/admin never sees the banner and `/app/calibrate` redirects them to `/app`.

**📌 DECISION-14 sourced here** (banner `sessionStorage` dismissal; dedicated route).

### Implementation for Step 8

- [ ] T044 [US2] Create `apps/web/components/anchor/calibration-banner.tsx`: calm copy (stress detection unavailable until calibration) + "Calibrate now" → `/app/calibrate`; dismiss via `sessionStorage["serenify-anchor-banner-dismissed"]` (session-only; reappears next session, FR-023/024); amber, never red (Principle V). 🙋 NEEDS MOHAMED: lock banner copy. ⚠ Principle VII: covered by T047 + T055.
- [ ] T045 [US2] [US4] Edit `apps/web/app/(authed)/app/page.tsx`: employee branch calls `has_anchor(auth.uid())` via the session client; renders `<CalibrationBanner />` when it returns `false`; managers see their existing role placeholder (no banner) (📌 DECISION-14, FR-021/029, Principle I — banner status via `has_anchor`, never a direct column read). ⚠ Principle VII: covered by T055.
- [ ] T046 [US2] [US4] Create `apps/web/app/(authed)/app/calibrate/page.tsx` — Server Component that role-gates to **employees** (redirect team_lead/admin → `/app`) and renders `<AnchorRecorder context="calibrate" onComplete={→ /app} onSkip={→ /app} />` (📌 DECISION-14, FR-022/029). ⚠ Principle VII: covered by T055.
- [ ] T047 [US2] Create `apps/web/components/anchor/calibration-banner.test.tsx` (Vitest + RTL): renders for uncalibrated employee; dismiss hides for session; the "Calibrate now" control links to `/app/calibrate`.

**Checkpoint**: banner + recalibration route work; managers excluded; status read only via `has_anchor`.

---

## Phase 10: Step 9 — Cross-tab anchor broadcast (US7)

**Goal**: Completing the anchor in one tab refreshes sibling tabs on the onboarding step / `/app/calibrate` to `/app`.

**Independent Test**: Two tabs on the onboarding step; complete in tab A; tab B refreshes to `/app` without a manual reload (SC-008).

**📌 DECISION-15 sourced here** (extend `auth-broadcast.ts`; `router.refresh()`).

### Implementation for Step 9

- [ ] T048 [US7] Edit `apps/web/lib/auth-broadcast.ts`: add `AUTH_*`-style `ANCHOR_BROADCAST_KEY = "serenify-anchor-captured"`, `broadcastAnchorCaptured()` (writes `captured:${Date.now()}`), and `parseAnchorBroadcast(newValue)` — sibling helpers, not a parallel mechanism (📌 DECISION-15, FR-035). ⚠ Principle VII: covered by T050.
- [ ] T049 [US7] Edit `apps/web/components/cross-tab-auth.tsx`: add a `storage`-event branch — on an anchor-captured marker, if the tab is on the onboarding step or `/app/calibrate`, call `router.refresh()` (server recomputes `has_anchor(auth.uid())` → falls through to `/app`) (📌 DECISION-15, FR-034). ⚠ Principle VII: covered by T050 + T054.
- [ ] T050 [US7] Extend `apps/web/lib/auth-broadcast.test.ts` (or a sibling): `broadcastAnchorCaptured` writes the key; `parseAnchorBroadcast` recognizes it / rejects others; the listener branch calls `router.refresh()` on the marker and ignores unrelated keys.

**Checkpoint**: cross-tab anchor completion propagates via the reused broadcast pattern.

---

## Phase 11: Step 10 — Demo seed synthetic anchor (US6) ⚠ requires Step 3 migration

**Goal**: Inject one deterministic synthetic anchor into every demo profile so the demo cohort bypasses the banner.

**Independent Test**: `npm run seed` writes an identical 11832-byte blob to every `*@demo.serenify.local` profile (same bytes across re-runs); a demo employee signs in to `/app` with NO banner; a fresh non-demo employee still has no anchor.

**📌 DECISION-17 sourced here** (one shared deterministic anchor via service-role).

### Implementation for Step 10

- [ ] T051 [US6] Create `scripts/lib/synthetic-anchor.ts`: `mulberry32(42)` PRNG → 2958 `float32` → `Buffer` of 11832 LE bytes → `\x…` hex literal. Deterministic, re-runnable (FR-031/032). ⚠ Principle VII: covered by T053.
- [ ] T052 [US6] Edit `scripts/seed-demo.ts`: after demo profiles exist, write `anchor_vector` (the synthetic blob), `anchor_captured_at = now()`, `anchor_model_version = "serenify-video-lbptop-motion-rf-calibrated@2.0.0"` for every `@demo.serenify.local` profile via the existing service-role admin client (`scripts/lib/supabase-admin.ts`) — service_role bypasses RLS + the `authenticated` whitelist. Non-demo users untouched (📌 DECISION-17, FR-031/033). ⚠ Principle VII: covered by T053.
- [ ] T053 [US6] Add a scripts test (alongside `scripts/__tests__/`): `synthetic-anchor` produces identical bytes across two calls (determinism, FR-032); the seed writes the anchor only for the demo cohort (scope, FR-033).

**Checkpoint**: demo cohort lands on a clean `/app`; real users unaffected.

---

## Phase 12: Step 11 — Playwright e2e (US1, US2, US4, US6, US7)

**Goal**: Two new specs covering the happy and skip paths, with MediaRecorder + the FastAPI call mocked; plus manager-exclusion and demo-clean assertions.

**Independent Test**: Both specs pass under `workers: 1`; no real 60s recording occurs.

**📌 DECISION-18 sourced here** (mocked MediaRecorder + route-intercept).

### Implementation for Step 11

- [ ] T054 [US1] [US7] Create `apps/web/tests/e2e/anchor-onboarding.spec.ts`: a test shim stubs `navigator.mediaDevices.getUserMedia` / `MediaRecorder` (canned blob) and Playwright route-intercepts `/anchor` (canned `vector_b64`) and `/healthz` (200). Sign up → name → recorder shown → "recording" → success → `/app` with NO banner (FR-043). Include the cross-tab assertion (two pages, complete in A, B refreshes to `/app`, SC-008).
- [ ] T055 [US2] [US4] Create `apps/web/tests/e2e/anchor-skip.spec.ts`: employee → name → skip (revealed after scroll/first failure) → `/app` WITH banner → "Calibrate now" → `/app/calibrate` → mocked success → `/app` no banner. Plus: a team_lead and an admin complete onboarding with NO anchor step and see NO banner on `/app` (FR-029, SC-007).
- [ ] T056 [US6] Add a demo-cohort assertion (extend an existing demo spec or T055): a `*@demo.serenify.local` employee lands on `/app` with no banner (synthetic anchor present, SC-007).

**Checkpoint**: e2e specs green; manager + demo paths asserted.

---

## Phase 13: Step 12 — Full test pass

**Goal**: All layers green together.

- [ ] T057 Run `cd apps/api && uv run pytest` and `cd packages/ml-video && uv run pytest` — green; coverage ≥70% on backend business logic (router handlers + pipeline transforms) per Principle VII.
- [ ] T058 Run `npm run test --workspace=apps/web` (Vitest) + `npm run test:e2e --workspace=apps/web` (Playwright, incl. the existing feature-001/003 suites — no regressions) + `npm run lint` + `npm run typecheck` — all green.

**Checkpoint**: every test layer passes; no regressions in prior features.

---

## Phase 14: Step 13 — `smoke-tests.md` + DECISIONS.md entries

**Goal**: Author the human smoke matrix and (during implement) record the architectural decisions.

- [ ] T059 `specs/004-onboarding-video-anchor/smoke-tests.md` is authored **with this tasks.md commit** (categorized ST-NN human checks incl. the Chrome/Firefox/Safari × mobile/desktop webcam matrix, FR-045, Principle VII). Mohamed runs it after `/speckit.implement` and records results inline.
- [ ] T060 During `/speckit.implement`, append the 12 architectural entries from plan.md's "DECISIONS.md entries this plan implies" to `docs/DECISIONS.md` (Principle VIII). The 📌 DECISION-n markers on the tasks above name each source. Note: the DECISION-12 (stricter `has_anchor`) entry already landed in the plan-amendment commit — confirm it is not duplicated.
- [ ] T061 🙋 NEEDS MOHAMED: smoke-test sign-off gate (Principle VII / governance). Mohamed runs `smoke-tests.md`, records pass/fail inline, and approves the merge to `main`. NOT a code task.

**Checkpoint**: smoke-tests.md present; decision entries planned; awaiting Mohamed's smoke sign-off.

---

## Dependencies & story completion order

- **Setup (Phase 1)** → gates everything.
- **Step 1 (ml-video)** → **Step 2 (api)** (the API imports the package).
- **Step 3 (migration)** is independent of Steps 1–2 but → gates **Step 10 (seed)** (columns must exist) and underpins **US3** privacy verification.
- **Step 4 (headers)** → MUST precede **Step 5 (client)** → **Step 6 (recorder)** (Risk R-5: CSP/connect-src + camera permission before any backend call).
- **Step 6 (recorder)** → **Step 7 (onboarding)** + **Step 8 (banner/calibrate)** (both mount the recorder).
- **Step 8 (banner)** → **Step 9 (cross-tab)** (the broadcast refreshes the banner/step surfaces).
- **Steps 7–10** → **Step 11 (e2e)** (the surfaces must exist) → **Step 12 (full test pass)** → **Step 13 (smoke + decisions)**.

**Story → phase map**: US1 (Steps 1–2, 5–8, 11); US2 (Step 8, 11); US3 (Steps 1–4); US4 (Steps 7–8, 11); US5 (Steps 1–2, 6); US6 (Steps 3, 10–11); US7 (Step 9, 11).

## Parallel execution opportunities

- Phase 1: T001–T003 all `[P]`.
- Step 1: T006/T007 `[P]` (features vs pipeline, different files); T010/T011 `[P]`.
- Step 2: T017/T018/T020/T022 `[P]` (schemas, health router, env/docker, health test — distinct files).
- Step 6: T040 `[P]` (picker + countdown tests) alongside reducer work.
- Cross-step parallelism is bounded by the load-bearing ordering above — do NOT start Step 5/6 before Step 4 commits (R-5).

## Implementation strategy (MVP first)

- **MVP = US1 + US3** (Steps 1–8 minus the skip/banner polish): a fresh employee can record → backend extracts → web writes the (structurally private) vector → lands on `/app`. This is the headline value and proves the cross-`apps/` + privacy architecture end-to-end.
- **Then US2/US5** (skip + banner + failure recovery), **US4** (manager exclusion), **US6** (demo seed), **US7** (cross-tab) — each an independent increment.
