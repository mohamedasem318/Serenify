# Implementation Plan: Onboarding Video Anchor Flow

**Branch**: `004-onboarding-video-anchor` | **Date**: 2026-05-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-onboarding-video-anchor/spec.md`

## Summary

This feature gives every new employee a per-user calibration "anchor" — a
2958-dimensional float vector computed once from a ~60-second calm baseline
recording — without which the video stress model can deliver no predictions
(Constitution Principle II: predictions are deltas from the per-user baseline,
no global fallback). It is the first feature to stand up the backend
(`apps/api/`, FastAPI) and the first ML package (`packages/ml-video/`).

The work falls in five streams:

1. **Backend foundation** — scaffold `apps/api/` (FastAPI) and
   `packages/ml-video/` (the LBP-TOP + motion feature-extraction pipeline and
   the model loader). One endpoint `POST /anchor` runs the pipeline and returns
   the vector; `GET /healthz` reports model-loaded readiness. The model artifacts
   move from `tmp/model-artifacts/` to `packages/ml-video/models/` and load at
   startup as a sanity check. **No `/predict` endpoint** (feature 005). Raw
   video bytes are deleted immediately after extraction (Principle I).
2. **Database** — three nullable columns on `public.profiles` (`anchor_vector
   BYTEA`, `anchor_captured_at TIMESTAMPTZ`, `anchor_model_version TEXT`), a
   column-grant change that makes all three anchor columns unreadable by ANY
   client role (so the existing manager/admin row-level SELECT policies cannot
   expose them), plus a scope-guarded `has_anchor()` function that exposes only a
   self-calibration boolean — the load-bearing Principle I decision,
   📌 DECISION-12 — and a widened UPDATE whitelist so a user can write their own
   anchor.
3. **Web app** — a client recording component (device picker → permission →
   60-second countdown → upload → extract → success/fail) driven by an explicit
   state machine, surfaced inline as the onboarding second step and at a new
   employee-only `/app/calibrate` route, plus the `/app` calibration banner.
4. **Demo seed** — inject one deterministic synthetic anchor (fixed seed) into
   every `*@demo.serenify.local` profile so the demo cohort bypasses the banner.
5. **Security headers & cross-tab sync** — scope `camera=(self)` to the two
   capture routes (site-wide deny stays), add the FastAPI origin to CSP
   `connect-src`, and extend the feature-003 cross-tab broadcast with an
   anchor-captured event.

All spec-deferred items are already resolved in the spec's **Resolved
Decisions** section (10 items). This plan does not re-litigate them; it closes
the *build-time* architectural decisions enumerated in **§ Plan-Level
Decisions** (📌 DECISION-1 … 📌 DECISION-18) for one-shot review. Each
permanent architectural choice becomes a `docs/DECISIONS.md` entry during
`/speckit.implement` — enumerated in **§ DECISIONS.md entries this plan
implies**.

## Technical Context

**Language/Version**:

- Backend: **Python 3.12** (📌 DECISION-1 — `mediapipe==0.10.13` ships wheels
  for 3.10/3.11/3.12 only, NOT 3.13; 3.12 is the newest supported).
- Web: TypeScript 5.x strict, React 19.2.4, Next.js 16.2.6 — all already
  installed; `apps/web/AGENTS.md` rule stands (consult
  `node_modules/next/dist/docs/` before applying training-data Next knowledge).

**Primary Dependencies**:

Backend — exact pins read from `tmp/model-artifacts/metadata.json`
`dependencies` block (📌 DECISION-3), so joblib loading matches the trained
artifact:

- `fastapi`, `uvicorn[standard]`, `python-multipart` (multipart upload),
  `pyjwt` (JWT verification, 📌 DECISION-9)
- `scikit-learn==1.6.1`, `numpy==2.0.2`, `pandas==2.3.3`,
  `opencv-python==4.13.0`, `scikit-image==0.25.2`, `mediapipe==0.10.13`,
  `joblib==1.5.3`
- `xgboost` is **excluded** — `metadata.json` lists it but `MODEL_HANDOFF.md`
  §7 marks it "research log only, not required for inference".

Web — all already installed (`@supabase/ssr`, `@supabase/supabase-js`,
`react-hook-form`, `zod`, `lucide-react`, Tailwind v4, shadcn primitives from
003). **No new web runtime dependency** — MediaRecorder, `getUserMedia`, and
`enumerateDevices` are browser APIs; the FastAPI call uses a typed `fetch`
wrapper (📌 DECISION-13), not a new SDK.

**Storage**: `public.profiles` gains three nullable columns (📌 DECISION-12).
`anchor_vector` is a `BYTEA` blob of 11832 bytes (2958 × float32). No CHECK
constraint on the byte length (validation is application-layer; a CHECK adds
DB-side cost without proportional safety). The anchor artifacts (`model.joblib`,
`scaler.joblib`, `metadata.json`) relocate to `packages/ml-video/models/`.

**Testing**:

- Backend: **pytest** — happy-path extraction (mocked-FaceMesh fixture),
  failure-path (no-face → `FeatureExtractionError` → mapped response), the
  raw-byte-deletion invariant, JWT 401, and 415 on an unsupported format.
- Web: **Vitest + RTL** for the recording state machine and banner logic;
  **Playwright** for the happy path (sign up → name → anchor → `/app`) and the
  skip path (→ `/app` with banner), with MediaRecorder + the FastAPI call mocked
  (📌 DECISION-18 — CI does not record 60s of real video).
- `smoke-tests.md` — the human cross-browser webcam matrix (FR-045).

**Target Platform**: Web on Vercel (Next 16, 360px floor). Backend: a
**locally-runnable** FastAPI service on `uvicorn` (`http://127.0.0.1:8000`).
Production droplet deploy is **explicitly scoped out of 004** (📌 DECISION-7) —
the spec requires only a working local service the web app can call. A pinned
`Dockerfile` ships as a forward artifact for the later ops task.

**Project Type**: Web + backend (first cross-`apps/` feature). `apps/web/`
(frontend) calls `apps/api/` (FastAPI) which imports `packages/ml-video/`.

**Performance Goals / Constraints**:

- Extraction latency: ~5s on Kaggle CPU, **10–15s on a 2GB droplet**
  (`MODEL_HANDOFF.md` §6). The `extracting` UI state must read as
  intentional, not frozen (📌 DECISION-13, Risk R-1).
- 60-second baseline is fixed by the model contract (FR-008, Principle II) — the
  UI never accepts shorter.
- 360px responsive, light+dark parity, `prefers-reduced-motion`, ≥44×44px
  (Principle VI).

**Scale/Scope**: ~1 new Python service (5–8 modules) + 1 new Python package
(3–5 modules) + ~10 new web components/modules + 1 migration + 1 seed extension
+ header/CSP edits. The recording component is the bulk of the web work.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature engages Principles **I, II, III, V, VI, VII, IX, X** and the
**Architecture Constraints** transport/boundary rules. Principle IV (LLM) is
not engaged (no LLM). VIII is engaged structurally (this is the plan artifact).

| Principle | Status | How this plan honours it |
|-----------|--------|--------------------------|
| I. Privacy by Architecture (NON-NEG) | ✅ | Raw video bytes are deleted server-side immediately after extraction, on success or failure, and never written to durable storage (📌 DECISION-8); the upload is held in a temp file deleted in a `finally`. The 2958-d vector is the only capture artifact stored. **No anchor column is readable by any client role** — the SELECT column-whitelist (📌 DECISION-12) excludes all three (`anchor_vector`, `anchor_captured_at`, `anchor_model_version`), so the pre-existing `profiles_select_admin` / `profiles_select_direct_reports` row-level policies (which would otherwise expose them to managers, since Postgres RLS is row- not column-scoped) cannot reach them; calibration status is exposed only through the scope-guarded `has_anchor()` SECURITY DEFINER function (a caller may ask only about themselves). No manager-facing surface renders anchor data. The backend holds **no Supabase DB credentials** (📌 DECISION-9 / resolved decision 2); it returns the vector and the *web app* writes it via the user's session-scoped client. |
| II. Subject-Disjoint ML Evaluation (NON-NEG) | ✅ | 60-second baseline is fixed (FR-008). The model artifact has a `docs/MODELS.md` entry (`serenify-video-lbptop-motion-rf-calibrated@2.0.0`, created in the feature's first commit) and artifacts live in `packages/ml-video/models/` per the principle. The anchor is the per-user calibration reference the principle mandates. Storage is `BYTEA` (📌 DECISION-12), which does not preclude the feature-005 rolling-window loop (the bytes decode to a `(2958,)` float32 array either way). No metrics are computed here. |
| III. Modality Isolation | ✅ | The LBP-TOP + motion pipeline and model loader live in `packages/ml-video/` (per the Principle III description as amended to "video stress pipeline (LBP-TOP + motion features, per-user delta calibration)"). `apps/api/` imports from it (📌 DECISION-4/5); the extraction logic is **not** inlined in route handlers. No audio/physio coupling; the package exposes a clean `compute_anchor(video_path) -> np.ndarray` plus a model-loader the predict path (005) will consume. |
| V. Calm-First Design Language | ✅ | Every copy string in the anchor flow and banner uses calm voice (📌 DECISION-14, copy drafted in research.md, finalized at `/speckit.tasks`): explanation ("we need a moment to learn what calm looks like for you"), permission-denied, failure/retry ("we couldn't read your face clearly — try again with better lighting or facing the camera"), the temporarily-unavailable health-fail copy, and the banner — no exclamation marks, no "REQUIRED"/"MANDATORY", no clinical jargon. Mist & Meadow tokens + shadcn primitives from 003; amber (never red) for any callout. |
| VI. Responsive & Accessible by Default | ✅ | The whole flow is designed mobile-first at the 360px floor: device picker, self-preview, countdown, retry, skip, banner. `prefers-reduced-motion` collapses the countdown animation to a numeric tick (📌 DECISION-13). Light+dark parity via the existing tokens. All controls ≥44×44px (reuse 003's `h-11`/`h-12` patterns). Permission-denied and failure copy meet WCAG AA in both modes (FR-042). |
| VII. Mandatory Testing Per PR | ✅ | pytest for `/anchor` incl. failure modes + the raw-byte-deletion invariant + JWT 401 + 415 (📌 DECISION-18); Vitest+RTL for the state machine and banner; Playwright happy + skip paths (MediaRecorder + FastAPI mocked); `smoke-tests.md` with the Chrome/Firefox/Safari mobile+desktop webcam matrix (FR-045). ML-package fixture test on the loader (`n_features_in_ == 2958`, `classes_ == [0,1]`). |
| IX. Secrets Discipline (NON-NEG) | ✅ | The backend reads `SUPABASE_JWT_SECRET` (and the allowed CORS origin) **only** from env vars (📌 DECISION-9); it has no Supabase DB credentials, no service-role key. The web app's FastAPI origin is a public env var (`NEXT_PUBLIC_API_URL`). No `.env*` is committed; `apps/api/.env.example` documents the variable names with no values. The seed's service-role key is already env-sourced (existing `scripts/lib/env.ts`). |
| X. Dataset Stewardship (NON-NEG) | ✅ | The model is StressID-trained but the anchor flow records the **live user's own webcam** — no StressID media or consent-withheld subject frames are surfaced anywhere. Demo users already use synthetic names (feature 002). The non-commercial license is recorded in `docs/MODELS.md`. |
| Architecture Constraints (transport / boundary) | ✅ | The web→backend call uses a **typed client** wrapper (`apps/web/lib/api/anchor-client.ts`), not an untyped `fetch` (📌 DECISION-13). The anchor upload is a single request/response, not a stream — a typed **`multipart/form-data` POST** is correct; a WebSocket would add a connection lifecycle for no benefit (no progress frames; the "extracting" state is a client spinner over the synchronous request). Raw signal data (video bytes) stays inside `apps/api/` + `packages/ml-video/` — the boundary rule holds; `apps/web/` only ever sees the derived vector. |

**Gate result**: PASS. No Complexity Tracking entries required (see § Complexity
Tracking).

## Plan-Level Decisions (resolved here, not deferred)

### 📌 DECISION-1 — Python 3.12 for `apps/api/`

Pin the service to **Python 3.12**. `mediapipe==0.10.13` (the trained artifact's
pinned version) publishes wheels for CPython 3.10/3.11/3.12 only — **not 3.13**
(`MODEL_HANDOFF.md` §7 red flag). 3.12 is the newest supported, so it maximizes
runtime life while staying installable. The `Dockerfile` base is
`python:3.12-slim`; local dev uses a 3.12 venv. A `.python-version` file pins it
for `uv`.

### 📌 DECISION-2 — Dependency manifest: `pyproject.toml` + `uv` lockfile

Use **`pyproject.toml`** (PEP 621 metadata) with **`uv`** managing the venv and
emitting a committed **`uv.lock`** (hash-locked, fully reproducible).

- *Why uv over `requirements.txt` with manual pins*: `uv.lock` records transitive
  pins + hashes, so the droplet and Mohamed's Windows box resolve byte-identically
  — reproducibility is a constitution-adjacent value (Principle II artifacts must
  load against the exact trained versions). uv is a single fast tool for
  venv + install + lock.
- *Why not pip-tools*: pip-tools needs a separate `pip-compile`/`pip-sync` dance
  and does not manage the venv; uv subsumes both.
- *Deploy bridge*: the `Dockerfile` runs `uv sync --frozen` (or `uv export`
  to a `requirements.txt` if a plain-pip build is ever preferred). The direct
  dependency *versions* are still pinned exactly in `pyproject.toml` per
  📌 DECISION-3 so the manifest itself is unambiguous.

### 📌 DECISION-3 — Exact ML dependency pins from `metadata.json`

Pin the ML stack to the versions in `tmp/model-artifacts/metadata.json`
`dependencies` (read at plan time): `scikit-learn==1.6.1`, `numpy==2.0.2`,
`pandas==2.3.3`, `opencv-python==4.13.0`, `scikit-image==0.25.2`,
`mediapipe==0.10.13`, `joblib==1.5.3`. **scikit-learn is the load-bearing pin** —
a joblib model unpickles cleanly only against a compatible sklearn
major.minor; a mismatch warns or silently misbehaves (`MODEL_HANDOFF.md` §7).
`xgboost` is omitted (research-only). FastAPI/uvicorn/python-multipart/pyjwt are
pinned to current stable at scaffold time and recorded in `uv.lock`.

### 📌 DECISION-4 — `apps/api/` layout

```text
apps/api/
├── pyproject.toml            # PEP 621 + tool config (ruff, pytest)
├── uv.lock                   # committed lockfile
├── .python-version           # 3.12
├── .env.example              # SUPABASE_JWT_SECRET=, ALLOWED_ORIGIN=  (no values)
├── Dockerfile                # python:3.12-slim + uv sync (forward artifact; not deployed in 004)
├── README.md                 # local run instructions (mirrors quickstart.md)
├── app/
│   ├── __init__.py
│   ├── main.py               # FastAPI app factory; loads model at startup; mounts routers; CORS
│   ├── config.py             # pydantic-settings; reads env vars only (Principle IX)
│   ├── auth.py               # verify_jwt() dependency — SUPABASE_JWT_SECRET, HS256, returns user_id
│   ├── routers/
│   │   ├── anchor.py         # POST /anchor  (the only feature endpoint)
│   │   └── health.py         # GET /healthz
│   └── schemas.py            # pydantic request/response models
└── tests/
    ├── conftest.py           # fixtures: test client, synthetic videos, fake JWT
    ├── test_anchor.py        # happy, no-face, 401, 415, raw-byte-deletion
    └── test_health.py
```

Business logic (decode, FaceMesh, LBP-TOP, motion, concat) is **NOT** in
`routers/anchor.py` — it lives in `packages/ml-video/` and is imported
(📌 DECISION-5). The router's job is: authenticate (📌 DECISION-9), accept the
upload, hand the temp path to `compute_anchor()`, delete the bytes in a
`finally`, shape the response, map `FeatureExtractionError` → a calm failure
payload.

### 📌 DECISION-5 — `packages/ml-video/` as an installed editable package

`packages/ml-video/` is a **real Python package** (`pyproject.toml`, importable
as `ml_video`) installed **editable** into the API venv (`uv pip install -e
../../packages/ml-video`, declared as a path dependency in
`apps/api/pyproject.toml`).

- *Why editable install over `PYTHONPATH`*: an installed package gives a stable
  import name (`import ml_video`), its own pinned deps and its own pytest
  fixtures, and survives the Docker build cleanly (the image `COPY`s the package
  and installs it). A `PYTHONPATH` hack is implicit, breaks in Docker, and
  couples the API's CWD to the repo layout.
- *npm-workspace note*: the root `package.json` globs `packages/*` as npm
  workspaces, but npm only adopts dirs containing `package.json`. `packages/ml-video/`
  is Python-only (no `package.json`), so npm ignores it. Same for `apps/api/`.
  No `package.json` is added to either.

```text
packages/ml-video/
├── pyproject.toml            # name = "ml-video", import pkg = ml_video
├── README.md
├── models/                   # relocated artifacts (📌 DECISION-6)
│   ├── model.joblib
│   ├── scaler.joblib
│   └── metadata.json
├── src/ml_video/
│   ├── __init__.py
│   ├── pipeline.py           # MODEL_HANDOFF §3/§4: decode→5fps→%2→FaceMesh→LBP-TOP→motion→concat
│   ├── features.py           # LBP-TOP per ROI (90-d) + motion (2868-d) helpers
│   ├── anchor.py             # compute_anchor(video_path) -> np.ndarray (2958,)  [no subtraction]
│   ├── loader.py             # load_model() -> Predictor (scaler+model wired; predict NOT exposed in 004)
│   └── errors.py             # FeatureExtractionError
├── scripts/
│   └── inspect_anchor.py     # debug helper: decode a stored bytea blob, print shape/stats (resolved decision 1)
└── tests/
    └── test_pipeline_fixtures.py   # fixture-locked regression on a known vector (Principle VII ML rule)
```

`anchor.py::compute_anchor` is the exact Section-4 recipe (no anchor
subtraction — anchors are absolute features). `loader.py::load_model` validates
`scaler.n_features_in_ == 2958` and `model.classes_ == [0, 1]` and returns a
`Predictor` object; **the predict path exists but is not exposed by any 004
endpoint** — feature 005 wires it.

### 📌 DECISION-6 — Artifact relocation + `tmp/` gitignore

Move the three artifacts from `tmp/model-artifacts/` to
`packages/ml-video/models/` (they are untracked today, so it is a plain move +
`git add`). Add **`tmp/`** to `.gitignore` (the repo currently has no such line —
verified) so the remaining `tmp/` contents never get committed. The
training-results figure was already moved to `docs/models/` in the first commit.
After the move, `tmp/model-artifacts/` retains nothing tracked.

### 📌 DECISION-7 — Local-only service in 004; production deploy scoped out

004 delivers a **locally-runnable** service, not a droplet deploy. The spec
requires only a working local backend the web app can call. A pinned
`Dockerfile` is committed as a forward artifact (so the later ops task is a
build+ship, not a from-scratch design), but **no DigitalOcean deploy, no
systemd unit, no CI publish step lands in 004**. Production CSP `connect-src`
and CORS origin are env-var-driven and documented `[TBD by deployment]`
(📌 DECISION-16). This keeps 004 shippable without entangling it with ops.

### 📌 DECISION-8 — `POST /anchor` contract

`POST /anchor`, `multipart/form-data`, field `clip` (the recorded blob).
Pipeline: authenticate (📌 DECISION-9) → write the upload to a temp file →
`compute_anchor(path)` → delete the temp file in a `finally` (Principle I,
unconditional) → respond.

- **Success 200**: `{ "model_version": "serenify-video-lbptop-motion-rf-calibrated@2.0.0", "dim": 2958, "vector_b64": "<base64 of 11832 float32 LE bytes>" }`. Returning base64 float32 bytes (not a 2958-element JSON array) keeps the payload ~16 KB and lets the web app re-encode to `BYTEA` without precision drift. The web app writes it to Supabase (resolved decision 2).
- **Extraction failure 422**: `{ "error": "extraction_failed", "reason": "no_face" | "roi_empty" | "bad_vector" }` — mapped from `FeatureExtractionError`. The UI shows calm retry copy (FR-026); this is the event that increments the three-failure counter (FR-027).
- **401**: missing/invalid JWT (📌 DECISION-9).
- **415**: unsupported media type (📌 DECISION-11).
- Raw bytes are never persisted; no `anchor_video_path` is stored (FR-016/017).

### 📌 DECISION-9 — JWT verification; backend has no DB credentials

`POST /anchor` (and only it) depends on `verify_jwt()`: read the
`Authorization: Bearer <token>` header, verify the Supabase session JWT with
`SUPABASE_JWT_SECRET` (HS256), check `exp` and `aud == "authenticated"`, and
return `sub` as `user_id`. Missing/invalid → **401**, no extraction. The
verified `user_id` is the only identity the backend trusts — no client-supplied
id (FR-046). `SUPABASE_JWT_SECRET` comes from env only (Principle IX). The
backend has **no** Supabase DB credentials and performs **no** DB write — the
web app does the write with the user's session client (resolved decision 2),
which is why `user_id` is used only for logging/scoping here, not for a DB row
write.

### 📌 DECISION-10 — `GET /healthz`

`GET /healthz` returns `200 {"status":"ready","model_version":"…"}` only after
the model + scaler loaded successfully at startup; otherwise the app fails to
start (so an unready service is unreachable rather than answering). No auth (it
exposes nothing sensitive). The web app pings it before showing the recording
step; unreachable → calm "calibration is temporarily unavailable, please try
again later" (FR-048).

### 📌 DECISION-11 — Accept MP4 + WebM

`POST /anchor` accepts `video/mp4` and `video/webm` (both decode via
`cv2.VideoCapture` + FFmpeg, no transcoding). Validate by content-type + a
`cv2` open probe; anything else → **415** (FR-047). Browser `MediaRecorder`
defaults satisfy this: Safari emits MP4, Chrome/Firefox emit WebM
(📌 DECISION-13).

### 📌 DECISION-12 — Migration: columns, the SELECT column-whitelist (Principle I), and the UPDATE whitelist

New migration `supabase/migrations/20260527000000_anchor_columns.sql` (timestamp
after the latest existing `20260525000100_*`, and **before** any seed run — the
seed needs the columns; 📌 DECISION-17).

**DDL** — all three nullable (a profile without an anchor must be valid):

```sql
ALTER TABLE public.profiles
  ADD COLUMN anchor_vector        bytea,
  ADD COLUMN anchor_captured_at   timestamptz,
  ADD COLUMN anchor_model_version text;
```

No CHECK on `octet_length(anchor_vector) = 11832` — length validation is
application-layer (the web app only writes a vector it received from the
backend; a CHECK adds DB cost without proportional safety, and the spec made
encoding an app-layer responsibility).

**The Principle-I column-grant decision (load-bearing).** Postgres RLS is
row-scoped, not column-scoped. The existing `profiles_select_admin` (admins see
all rows) and `profiles_select_direct_reports` (a team_lead sees their reports'
rows) policies therefore expose **every column** of those rows — including a new
`anchor_vector` — to managers. Column-level `REVOKE SELECT (anchor_vector)` is a
**no-op** while `authenticated` holds the table-level SELECT grant (the same
Supabase gotcha slice-1 hit for UPDATE — verified there via
`has_column_privilege`). So, mirroring the slice-1 UPDATE-whitelist precedent,
this migration converts `authenticated`'s table SELECT into an explicit column
whitelist that **excludes all three anchor columns**:

```sql
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT  SELECT (id, full_name, role, manager_id, created_at, updated_at)
  ON public.profiles TO authenticated;
```

Result: **no client role can SELECT any anchor column** — not `anchor_vector`,
`anchor_captured_at`, or `anchor_model_version`, for the owner or a team_lead or
an admin. The three columns are *write-only* from any browser/PostgREST path in
004; the manager/admin row policies stay intact but structurally cannot reach
the anchor data. (Feature 005's inference read path will be decided in 005 —
server-side service-role read, or a self-scoped SECURITY DEFINER function; out
of scope here and **unaffected** by this change.)

**Banner visibility via `has_anchor()`.** Because the owner can no longer read
`anchor_captured_at` directly, calibration status is exposed through a
scope-guarded SECURITY DEFINER function (slice-1 hardening pattern):

```sql
CREATE OR REPLACE FUNCTION public.has_anchor(target_user uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- scope guard: a caller may only ask about themselves, so a manager cannot
  -- probe a report's calibration state.
  IF target_user <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden: may only query own anchor state'
      USING ERRCODE = '42501';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_user AND anchor_vector IS NOT NULL
  );
END;
$$;

ALTER FUNCTION public.has_anchor(uuid) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.has_anchor(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_anchor(uuid) TO authenticated;
```

- `SECURITY DEFINER` + `SET search_path = ''` (all object names fully-qualified
  inside — `public.profiles`, `auth.uid()`), per the slice-1 hardening posture;
  `OWNER TO postgres` pinned for parity with the other DEFINER helpers.
- **Scope guard** raises `42501` when `target_user <> auth.uid()`, so a caller
  can only ask about themselves — a manager cannot probe a report.
- `EXECUTE` revoked from `PUBLIC`/`anon`, granted only to `authenticated`
  (slice-1 default posture for SECURITY DEFINER functions; not referenced by any
  RLS policy, so no `anon` grant is needed).
- The web app calls `has_anchor(auth.uid())` via the user's session-scoped
  client to drive banner visibility (📌 DECISION-13/14), replacing the prior
  plan-time read of `anchor_captured_at IS NULL`.

*(Audit note: an earlier draft of this decision left `anchor_captured_at` and
`anchor_model_version` in the SELECT whitelist — readable by managers/admins via
the row-level policies — reasoning that FR-019 scopes the invariant to the
vector. Mohamed elected the stricter posture: a manager knowing whether or when
a report calibrated could be used to pressure them, undercutting the Principle I
"managers see aggregates, not individuals" trust story. The function adds one
SECURITY DEFINER construct for a real, bounded privacy gain. See
`docs/CHANGELOG.md` and `docs/DECISIONS.md` 2026-05-27.)*

**UPDATE whitelist widened** (extends slice-1's `full_name`-only grant):

```sql
GRANT UPDATE (full_name, anchor_vector, anchor_captured_at, anchor_model_version)
  ON public.profiles TO authenticated;
```

The owner writes their three anchor columns on their own row via the existing
`profiles_update_self_safe_fields` policy (its `WITH CHECK` already permits any
column except `role`/`manager_id`).

**Blast-radius audit** (in `/speckit.tasks`): every existing `profiles` SELECT
(`proxy.ts` `select("full_name")`, header/account/`role-gate` reads) selects
*explicit* columns, not `*` — so the whitelist (which lists every currently-read
column) keeps them working. Any `select("*")` discovered is pinned to explicit
columns. Verification uses `has_column_privilege` to assert `authenticated` has
no SELECT on `anchor_vector` and has SELECT on the eight whitelisted columns
(slice-1 verification style).

### 📌 DECISION-13 — Web recording component: boundary, state machine, device/codec/upload

**Server/client boundary.** The recording UI is a **Client Component**
(`"use client"`) — `getUserMedia`, `MediaRecorder`, `enumerateDevices`, and
`localStorage` are all client-only. The server boundary stays tight: the
`/app/calibrate` page and the onboarding page are Server Components that
role-gate and then render the client recorder. No camera API touches a Server
Component.

**State machine** (one reducer in `components/anchor/use-anchor-recorder.ts`):

```text
idle
  → device-selecting        (enumerate devices; show picker)
  → permission-requesting    (getUserMedia)
  → permission-granted       (live self-preview)        ──perm denied──▶ permission-denied
  → recording                (60s countdown, MediaRecorder)
  → uploading                (typed POST /anchor)        ──network fail─▶ upload-failed (retry, not a 3-fail strike)
  → extracting               (awaiting backend)          ──422─────────▶ extract-failed (retry; ++failureCount)
  → success                  (web writes vector → /app)
```

`failureCount` counts only backend `422`s (FR-027); transport failures
(`upload-failed`) and permission denials do not. The "Skip for now" affordance
is hidden until `failureCount ≥ 1` **or** the user scrolled past the explanation
(`scrolledPastExplanation` flag) (FR-004); permission-denied/health-fail states
always expose skip (FR-007). At `failureCount ≥ 3`, the escape affordance appears
(FR-027/028).

**Device picker pre-permission quirk.** `enumerateDevices()` returns device
*labels* only after `getUserMedia` has been granted at least once. So before
first grant the picker shows a single **"Default camera"** placeholder; on first
grant, re-enumerate and populate real labels (resolved decision 5).

**`localStorage` device memory.** Key `serenify-anchor-camera`, value the chosen
`deviceId` string (last-write-wins, no eviction). On mount, if the stored
`deviceId` is present among `enumerateDevices()` results, pre-select it; else
fall back to the default camera without error (FR-005 edge case).

**MediaRecorder codec.** Probe `MediaRecorder.isTypeSupported` in order:
`video/webm;codecs=vp9` → `video/webm;codecs=vp8` → `video/mp4` → unspecified
(browser default). Safari yields MP4, Chrome/Firefox WebM; the backend accepts
both (FR-047), so the frontend does not force one format.

**Upload mechanism.** `FormData` + `multipart/form-data` POST via the typed
client `apps/web/lib/api/anchor-client.ts` (`postAnchor(blob, accessToken):
Promise<AnchorResult>`), which attaches `Authorization: Bearer <token>` (the
Supabase session access token, read client-side) and types the
success/422/415/401 union. **No untyped `fetch`** in component code (transport
rule). On success the component decodes `vector_b64` → re-encodes to a `\x…`
hex `BYTEA` literal and writes `anchor_vector`/`anchor_captured_at`/
`anchor_model_version` via the user's session Supabase client (resolved
decision 2), then broadcasts (📌 DECISION-15) and routes to `/app`.

**`prefers-reduced-motion`.** The countdown ring animation is gated on a
`useReducedMotion`-style check (reuse the 003 pattern); when reduced, it renders
a plain numeric tick (FR-009).

### 📌 DECISION-14 — Calibration banner + `/app/calibrate` route + onboarding integration

- **Banner** (`components/anchor/calibration-banner.tsx`) renders on `/app` for
  an **employee with no stored anchor** — the `/app` Server Component calls
  `has_anchor(auth.uid())` via the session client and shows the banner when it
  returns `false` (managers never reach this branch, FR-029). Calm copy + a
  "Calibrate now" control linking to `/app/calibrate`.
  Dismissal is **session-only**: a `sessionStorage` key
  `serenify-anchor-banner-dismissed` hides it for the tab session; it reappears
  next session until calibrated (FR-023/024). (`sessionStorage`, not
  `localStorage`, encodes "this session only" precisely.)
- **`/app/calibrate`** (`app/(authed)/app/calibrate/page.tsx`) — a thin
  Server-Component wrapper that role-gates to employees (mirrors the `/app`
  role branch; team_lead/admin get a redirect to `/app`) and renders the **same**
  client recorder used by the onboarding step. It sits under the `/app`
  protected prefix (proxy already requires auth + `full_name`), so no new proxy
  gate. On success it routes to `/app` (banner now gone). The account-settings
  recalibration entry point stays out of scope (feature 005).
- **Onboarding integration** (the proxy interaction): once `full_name` is set,
  `proxy.ts` step 5 bounces `/onboarding` → `/app`, so the anchor step cannot be
  a *fresh navigation* to `/onboarding`. Instead, the onboarding page renders
  both steps as **in-page client state**: `completeOnboarding` is changed so
  that for an **employee** it returns `{status:"ok"}` (no server redirect) and
  the client advances in place to the anchor recorder; for **team_lead/admin**
  it keeps the existing server redirect to `/app` (no anchor step, FR-029). A
  mid-step refresh (now `full_name`-set) bounces to `/app` and the banner takes
  over — an acceptable, skip-equivalent durability path. This is the one
  behavioral edit to a feature-001 artifact
  (`(onboarding)/onboarding/actions.ts`).

### 📌 DECISION-15 — Cross-tab anchor-captured broadcast

Extend `apps/web/lib/auth-broadcast.ts` (the single source of truth for cross-tab
markers) with a sibling helper rather than a parallel mechanism (FR-035):

- New key `serenify-anchor-captured`; `broadcastAnchorCaptured()` writes
  `captured:${Date.now()}`; `parseAnchorBroadcast(newValue)` recognizes it.
- The existing `components/cross-tab-auth.tsx` listener (already subscribed to
  `window "storage"`) gains a branch: on an anchor-captured event, if the tab is
  on the onboarding anchor step or `/app/calibrate`, it **refreshes**
  (`router.refresh()` → `has_anchor(auth.uid())` now returns true and re-renders
  to `/app` without the step/banner). Refresh, not hard navigate, matches the 003
  pattern and lets the server components recompute state (FR-034).

### 📌 DECISION-16 — Security headers: per-route `camera=(self)` + CSP `connect-src`

- **Permissions-Policy** lives in `next.config.ts` `headers()` (static). Keep the
  site-wide default `camera=(), microphone=(), …` on `source: "/(.*)"`, and add
  **two narrower `source` entries** for `"/onboarding"` and `"/app/calibrate"`
  with `camera=(self), microphone=(), …` — camera relaxed, **microphone still
  denied** (audio is 013), all other features still denied. Site-wide deny
  remains everywhere else (FR-036/037). `/speckit.tasks` verifies Next's
  per-source header precedence empirically (the `headers()` array order and
  matching semantics — consult `node_modules/next/dist/docs/` per
  `apps/web/AGENTS.md`).
- **CSP `connect-src`** is built per-request in `proxy.ts::buildCsp`. Add the
  FastAPI origin from a public env var `NEXT_PUBLIC_API_URL`; in dev default it
  to `http://127.0.0.1:8000`; in prod use the configured origin
  (`[TBD by deployment]`). This is the first non-Supabase, non-same-origin
  `connect-src` entry (FR-038). **COEP stays unset** (FR-039) — extraction is
  server-side, no WASM in `apps/web/`.
- **Rollout order** (Risk R-5): the `connect-src` edit MUST land before the
  component first calls the backend, or the call is CSP-blocked. `/speckit.tasks`
  sequences the proxy edit ahead of the recorder wiring.

### 📌 DECISION-17 — Demo seed: one deterministic synthetic anchor

After the cohort's profiles exist, inject **one shared** synthetic anchor into
every `*@demo.serenify.local` profile (one anchor for all — simpler, still
deterministic, still a valid 2958-d blob for UI testing).

- Generation lives in a new `scripts/lib/synthetic-anchor.ts`, called from
  `seed-demo.ts` and written via the existing service-role admin client
  (`scripts/lib/supabase-admin.ts`) — service_role bypasses RLS and retains its
  grants, so it writes `anchor_vector` despite the `authenticated` whitelist.
- Determinism in TypeScript: a seeded PRNG (`mulberry32(42)`) → 2958 float32
  values → `Buffer` of 11832 LE bytes → `\x…` hex literal for the `bytea` column.
  Re-runnable, identical bytes every run (FR-031/032). `anchor_captured_at = now()`,
  `anchor_model_version = "serenify-video-lbptop-motion-rf-calibrated@2.0.0"`.
- Real (non-demo) users are untouched (FR-033). The injection runs only for the
  `@demo.serenify.local` cohort the seed already manages. (Seed RNG `42` for the
  anchor is distinct from the cohort's existing `SEED = 1729`.)

### 📌 DECISION-18 — Testing strategy

**pytest fixtures** (`apps/api/tests/conftest.py`):

- *Failure-path (primary, cheap, deterministic)*: generate a synthetic clip
  on the fly with OpenCV (`cv2.VideoWriter`, a few seconds of plain frames with
  no detectable face) → FaceMesh finds nothing → `FeatureExtractionError` →
  asserts the 422 mapping. Covers FR-044's failure-mode requirement without any
  human face.
- *Happy-path*: **mock MediaPipe FaceMesh** at the package boundary to return a
  scripted landmark stream so the pipeline produces a valid `(2958,)` vector —
  this validates the LBP-TOP + motion + concat math and the endpoint contract
  without committing real face video (privacy-clean, fast, deterministic). A
  fixture-locked expected vector guards preprocessing regressions (Principle VII
  ML rule).
- *Invariants*: the raw-byte-deletion test asserts the temp file path does not
  exist after the response (patch `compute_anchor` to capture the path); JWT 401
  with a forged/missing token; 415 on a `text/plain` upload.

**Playwright** (`apps/web/tests/e2e/anchor-onboarding.spec.ts`,
`anchor-skip.spec.ts`): **mock `MediaRecorder` and the FastAPI call** — CI does
not record 60s of real video nor run MediaPipe. A test shim replaces
`navigator.mediaDevices.getUserMedia` / `MediaRecorder` with a stub that yields a
tiny canned blob, and `anchor-client` is pointed at a mocked endpoint (Playwright
route interception) returning a canned `vector_b64`. The specs assert the *flow*
(name → recorder shown → "recording" → success → `/app` no banner; and skip →
`/app` with banner), not the recording itself. Runs under the existing
`workers: 1`.

**`smoke-tests.md`** — categorized like 003: webcam permission flow, device
picker (incl. remembered-device fallback), 60s countdown + reduced-motion tick,
extraction failure + 3-fail escape, skip reveal timing, banner session
persistence, dark-mode + 360px, calm-voice copy scan, and the explicit
**cross-browser webcam matrix** Chrome/Firefox/Safari × mobile/desktop (FR-045).
Human-run by Mohamed after `/speckit.implement`.

## Project Structure

### Documentation (this feature)

```text
specs/004-onboarding-video-anchor/
├── plan.md                 # this file
├── spec.md                 # committed
├── research.md             # Phase 0 — long-form treatment of 📌 DECISION-1…18
├── data-model.md           # Phase 1 — the three columns, grants, RLS interaction
├── contracts/
│   ├── api.md              # FastAPI: POST /anchor, GET /healthz (request/response/auth/errors)
│   ├── components.md       # web component contracts + the recorder state machine
│   └── migration.md        # the DDL + SELECT/UPDATE grant change + verification queries
├── quickstart.md           # run the FastAPI service + web app locally end-to-end
├── checklists/requirements.md  # refreshed note (this commit)
├── tasks.md                # /speckit.tasks (NOT yet)
└── smoke-tests.md          # /speckit.tasks (NOT yet)
```

### Source Code (repository — additions and modifications)

```text
serenify/
├── apps/
│   ├── api/                                   # NEW — FastAPI service (📌 DECISION-4)
│   │   └── …                                  # (tree in 📌 DECISION-4)
│   └── web/
│       ├── app/
│       │   ├── (onboarding)/onboarding/
│       │   │   ├── actions.ts                 # MODIFIED — employee path returns ok (no redirect) → inline anchor step (📌 DECISION-14)
│       │   │   ├── onboarding-form.tsx        # MODIFIED — 2-step: name → anchor recorder
│       │   │   └── page.tsx                    # MODIFIED — render step state
│       │   └── (authed)/app/
│       │       ├── page.tsx                    # MODIFIED — employee branch renders calibration banner when has_anchor(auth.uid()) is false
│       │       └── calibrate/page.tsx          # NEW — employee-only recorder wrapper (📌 DECISION-14)
│       ├── components/anchor/                   # NEW
│       │   ├── anchor-recorder.tsx             # the client recorder (device→perm→record→upload→extract)
│       │   ├── use-anchor-recorder.ts          # state-machine reducer (📌 DECISION-13)
│       │   ├── device-picker.tsx
│       │   ├── countdown.tsx                   # reduced-motion-aware
│       │   ├── calibration-banner.tsx
│       │   └── *.test.tsx / *.test.ts          # Vitest + RTL
│       ├── lib/
│       │   ├── api/anchor-client.ts            # NEW — typed POST /anchor + GET /healthz client
│       │   └── auth-broadcast.ts               # MODIFIED — add anchor-captured helpers (📌 DECISION-15)
│       ├── components/cross-tab-auth.tsx       # MODIFIED — handle anchor-captured event
│       ├── proxy.ts                            # MODIFIED — connect-src += NEXT_PUBLIC_API_URL (📌 DECISION-16)
│       ├── next.config.ts                      # MODIFIED — per-route camera=(self) (📌 DECISION-16)
│       └── tests/e2e/
│           ├── anchor-onboarding.spec.ts       # NEW
│           └── anchor-skip.spec.ts             # NEW
├── packages/
│   └── ml-video/                               # NEW — pipeline + loader + models (📌 DECISION-5)
│       └── …                                   # (tree in 📌 DECISION-5)
├── supabase/migrations/
│   └── 20260527000000_anchor_columns.sql       # NEW — DDL + grants (📌 DECISION-12)
├── scripts/
│   ├── seed-demo.ts                            # MODIFIED — inject synthetic anchor (📌 DECISION-17)
│   └── lib/synthetic-anchor.ts                 # NEW — deterministic 2958-d float32 blob (seed 42)
├── docs/
│   ├── DECISIONS.md                            # APPENDED during /speckit.implement (entries below)
│   └── CHANGELOG.md                            # APPENDED if any spec deviation arises
├── .gitignore                                  # MODIFIED — add tmp/ (📌 DECISION-6)
└── CLAUDE.md                                   # MODIFIED — SPECKIT pointer → 004 plan (this commit)
```

**Structure Decision**: First feature to span `apps/web/` + `apps/api/` +
`packages/ml-video/` + `supabase/` + `scripts/`. The raw-signal boundary rule
holds: video bytes live only in `apps/api/` + `packages/ml-video/`; `apps/web/`
sees only the derived vector.

## Branch Commit Ordering

The canonical ordering for `/speckit.tasks` to decompose. Each step is one
PR-sized unit landing on `004-onboarding-video-anchor`; tests pass before the
next starts. **CSP/connect-src ordering is load-bearing** (Risk R-5).

1. **`packages/ml-video/` package** — `pyproject.toml`, relocate artifacts
   (📌 DECISION-6) + `.gitignore tmp/`, port the pipeline (`pipeline.py`,
   `features.py`, `anchor.py`), the loader (`loader.py`), `inspect_anchor.py`,
   the fixture regression test. `uv` venv. Tests green standalone.
2. **`apps/api/` service** — scaffold (📌 DECISION-4), editable-install
   `ml-video`, `main.py` startup model load (📌 DECISION-10 readiness),
   `auth.py` JWT (📌 DECISION-9), `POST /anchor` (📌 DECISION-8/11) + `GET
   /healthz`, pytest suite (📌 DECISION-18). `.env.example`, `Dockerfile`,
   README.
3. **Migration** — `20260527000000_anchor_columns.sql` (📌 DECISION-12): DDL +
   SELECT whitelist + UPDATE whitelist. Blast-radius audit of existing `profiles`
   reads. `has_column_privilege` verification.
4. **Security headers** — `proxy.ts` `connect-src += NEXT_PUBLIC_API_URL` and
   `next.config.ts` per-route `camera=(self)` (📌 DECISION-16). **Before** any
   component calls the backend.
5. **Typed API client** — `lib/api/anchor-client.ts` (📌 DECISION-13).
6. **Recorder component** — state machine, device picker, countdown, preview,
   upload, failure/retry/escape (📌 DECISION-13). Vitest for the reducer.
7. **Onboarding integration** — `completeOnboarding` employee-path change +
   2-step form (📌 DECISION-14).
8. **`/app` banner + `/app/calibrate` route** (📌 DECISION-14).
9. **Cross-tab anchor broadcast** (📌 DECISION-15) + listener branch.
10. **Demo seed** — `synthetic-anchor.ts` + `seed-demo.ts` injection
    (📌 DECISION-17).
11. **Playwright specs** — onboarding + skip paths with mocks (📌 DECISION-18).
12. **Test pass** — pytest + Vitest + Playwright full suites.
13. **`smoke-tests.md`** authored; Mohamed runs after `/speckit.implement`.

## Edits to prior features

- **Feature 001**: `(onboarding)/onboarding/actions.ts` — `completeOnboarding`
  no longer redirects employees to `/app` (returns ok so the client shows the
  anchor step); managers keep the redirect. `onboarding-form.tsx` / `page.tsx`
  gain the 2-step shape. No change to auth, RLS *policies* (only column grants),
  route guards, or schemas beyond the new columns.
- **Security slice-1**: the `authenticated` SELECT/UPDATE grants on
  `public.profiles` are tightened/widened per 📌 DECISION-12 — a continuation of
  the slice-1 whitelist posture, not a reversal.
- **Feature 003**: `auth-broadcast.ts` + `cross-tab-auth.tsx` gain the
  anchor-captured event (additive). shadcn primitives reused as-is.

## Test Strategy

(Full detail in 📌 DECISION-18.) Layers: pytest (backend + ml-video fixtures),
Vitest+RTL (recorder reducer, banner, device picker), Playwright (two specs,
mocked capture), `smoke-tests.md` (human webcam matrix). Coverage target ≥70%
on backend business logic (router + pipeline) per Principle VII.

## DECISIONS.md entries this plan implies

Appended to `docs/DECISIONS.md` during `/speckit.implement` (date `2026-05-27+`,
feature 004):

1. **`apps/api/` FastAPI scaffold** — Python 3.12 pin (mediapipe ceiling),
   `pyproject.toml` + `uv` lock, exact ML pins from `metadata.json` (sklearn
   1.6.1 load-bearing). 📌 DECISION-1/2/3/4.
2. **`packages/ml-video/` editable package** — real package over PYTHONPATH;
   pipeline/loader layout; predict path present but unexposed in 004. 📌 DECISION-5.
3. **Artifact relocation + `tmp/` gitignore.** 📌 DECISION-6.
4. **Local-only backend in 004; production deploy deferred** (Dockerfile as
   forward artifact). 📌 DECISION-7.
5. **`POST /anchor` + JWT-only auth; backend has no DB credentials** — the web
   app writes the vector with the user's session client. 📌 DECISION-8/9.
6. **No anchor column is readable by any client role** via a SELECT
   column-whitelist that excludes all three (Principle I; column-REVOKE-is-a-no-op
   under a table grant — slice-1 precedent), plus a scope-guarded `has_anchor()`
   SECURITY DEFINER boolean for banner status. UPDATE whitelist widened.
   📌 DECISION-12.
7. **Web recorder state machine + device-label-after-grant quirk + codec probe
   + multipart upload + typed client.** 📌 DECISION-13.
8. **Banner session-only dismissal (`sessionStorage`) + dedicated
   `/app/calibrate` route + onboarding inline-step (proxy bounce rationale).**
   📌 DECISION-14.
9. **Cross-tab anchor-captured broadcast extends `auth-broadcast.ts`; siblings
   `router.refresh()`.** 📌 DECISION-15.
10. **Per-route `camera=(self)` in `next.config.ts`; CSP `connect-src` += FastAPI
    origin in `proxy.ts`; COEP unset; rollout-order constraint.** 📌 DECISION-16.
11. **One deterministic synthetic demo anchor (seed 42) via service-role.**
    📌 DECISION-17.
12. **Testing: mocked MediaPipe (happy) + synthetic no-face clip (failure) for
    pytest; mocked MediaRecorder + route-intercept for Playwright.** 📌 DECISION-18.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| (none) | — | — |

The plan passes the Constitution Check without waivers. The one item that *looks*
like added complexity — the SELECT column-whitelist (📌 DECISION-12) — is the
*minimum* mechanism that satisfies Principle I given the columns-on-`profiles`
constraint and Postgres's row-not-column RLS; a CHECK-free, function-free
column grant is the simplest construct that actually blocks the vector read.

## Risks & Mitigations

| ID | Risk | Mitigation |
|----|------|------------|
| R-1 | **Extraction latency** ~10–15s on the 2GB droplet (`MODEL_HANDOFF.md` §6) reads as a frozen app. | A distinct `extracting` state with calm progress copy ("reading your recording…") and an indeterminate indicator; never a bare spinner with no text. Documented in 📌 DECISION-13. The synchronous request is fine for a one-time onboarding step. |
| R-2 | **MediaPipe Python ceiling** — `0.10.13` won't install on 3.13. | Pin 3.12 in `.python-version`, `Dockerfile` (`python:3.12-slim`), and `pyproject.toml` `requires-python = ">=3.10,<3.13"` (📌 DECISION-1). |
| R-3 | **scikit-learn joblib mismatch** — wrong sklearn version mis-loads the model. | Exact pin `scikit-learn==1.6.1` from `metadata.json` (📌 DECISION-3); the startup loader asserts `n_features_in_ == 2958` + `classes_ == [0,1]` and refuses to start otherwise (📌 DECISION-10). |
| R-4 | **MediaRecorder cross-browser** — Safari MP4 vs Chrome/Firefox WebM. | Codec probe in priority order; backend accepts both via FFmpeg (FR-047 / 📌 DECISION-11); smoke matrix covers all three browsers (📌 DECISION-18). |
| R-5 | **CSP rollout order** — the recorder's first backend call is blocked if `connect-src` lacks the FastAPI origin. | Commit-ordering step 4 lands the `proxy.ts` `connect-src` edit before step 5/6 wire the call (📌 DECISION-16). |
| R-6 | **SELECT-grant blast radius** — converting `authenticated` table SELECT to a whitelist could break an existing `select("*")`. | Blast-radius audit in `/speckit.tasks` (📌 DECISION-12); the whitelist enumerates every currently-read column; `has_column_privilege` verification. |
