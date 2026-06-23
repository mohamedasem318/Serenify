# Quickstart: Onboarding Video Anchor Flow

From a clean clone to a working anchor flow locally. Two processes: the Next.js
web app (existing) and the new FastAPI service.

## Prerequisites

- Node + npm (existing web toolchain).
- **Python 3.12** (mediapipe ceiling — 📌 DECISION-1) and **`uv`**
  (`pip install uv` or the standalone installer).
- Local Supabase running (existing dev setup) with migrations applied.

## 1. Apply the migration

```bash
# from repo root — applies 20260527000000_anchor_columns.sql
supabase db reset          # or your usual local-migrate command
```

Verify the columns + grants:

```sql
select has_column_privilege('authenticated','public.profiles','anchor_vector','SELECT');  -- false
select has_column_privilege('authenticated','public.profiles','anchor_vector','UPDATE');  -- true
```

## 2. Start the FastAPI service

```bash
cd apps/api
uv sync --frozen                     # installs from uv.lock (incl. editable ../../packages/ml-video)
cp .env.example .env                 # then fill SUPABASE_JWT_SECRET + ALLOWED_ORIGIN (never commit .env)
uv run uvicorn app.main:app --reload --reload-dir app --port 8000   # watch source only (avoids churn restarts)
```

- `SUPABASE_JWT_SECRET` — the local Supabase JWT secret (from `supabase status`
  / the Studio API settings). Env only (Principle IX).
- `ALLOWED_ORIGIN` — `http://localhost:3000` for local web.
- Startup loads `packages/ml-video/models/{model,scaler}.joblib` and asserts
  `n_features_in_ == 2958` / `classes_ == [0,1]`; if the artifacts are missing or
  mismatched, the service refuses to start.

Check it:

```bash
curl http://127.0.0.1:8000/healthz
# {"status":"ready","model_version":"serenify-video-lbptop-motion-rf-calibrated@2.0.0"}
```

## 3. Point the web app at the service

In `apps/web/.env.local` (gitignored):

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

This origin is added to CSP `connect-src` in `proxy.ts` (dev default
`http://127.0.0.1:8000`) and is required for the browser to call `/anchor`.

```bash
cd apps/web
npm run dev
```

## 4. Walk the flow

1. Sign up + confirm a fresh **non-demo** employee; set the name.
2. The onboarding advances to the anchor step → pick a camera → grant permission
   → 60s countdown → upload → land on `/app` with no banner.
3. Or "Skip for now" (revealed after scrolling past the explanation or one
   failure) → `/app` with the calibration banner → "Calibrate now" →
   `/app/calibrate`.
4. Demo users (`*@demo.serenify.local`, via `npm run seed`) already have a
   synthetic anchor → no banner.

## 5. Tests

```bash
# backend
cd apps/api && uv run pytest
# ml-video package
cd packages/ml-video && uv run pytest
# web unit + e2e
cd apps/web && npm run test && npm run test:e2e
```

Playwright mocks MediaRecorder + the FastAPI call (no real 60s recording). The
human cross-browser webcam matrix lives in `smoke-tests.md`.

## Inspect a stored anchor (debug)

```bash
cd packages/ml-video
uv run python scripts/inspect_anchor.py <\x-hex-or-base64-blob>
# prints shape (2958,), min/max/mean
```
