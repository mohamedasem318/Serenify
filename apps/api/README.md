# serenify-api

FastAPI anchor-extraction service (feature 004). Verifies a Supabase JWT,
extracts a `(2958,)` calm-baseline anchor from an uploaded clip via the
`ml-video` package, and returns it base64-encoded. **It holds no Supabase DB
credentials** (DECISION-9) — the web app writes the vector with the user's own
session client. Raw video is deleted server-side immediately (Principle I).

## Endpoints

| Method | Path       | Auth        | Notes |
|--------|------------|-------------|-------|
| GET    | `/healthz` | none        | `{status:"ready", model_version}` — readiness pre-check (FR-048) |
| POST   | `/anchor`  | Bearer JWT  | multipart `clip` (video/mp4 \| video/webm) -> 200 `{model_version, dim, vector_b64}`; 401 / 415 / 422 |

## Run locally

```sh
cd apps/api
cp .env.example .env          # set SUPABASE_JWT_SECRET + ALLOWED_ORIGIN
uv sync
uv run uvicorn app.main:app --port 8000
curl localhost:8000/healthz
```

The service refuses to start unless the model artifacts load and pass the
contract check (`scaler.n_features_in_ == 2958`, `model.classes_ == [0, 1]`).

## Test

```sh
uv run pytest        # happy (mocked FaceMesh), 422 no-face, 401, 415, raw-byte deletion
```

Python **3.12** only (mediapipe wheel ceiling). Env vars are read at startup and
never embedded (Principle IX).
