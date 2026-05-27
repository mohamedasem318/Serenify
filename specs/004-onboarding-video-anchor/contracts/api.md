# Contract: FastAPI service (`apps/api/`)

Two endpoints. The service holds **no Supabase database credentials**; it
verifies the caller's JWT with `SUPABASE_JWT_SECRET` and returns the computed
vector for the web app to persist. See 📌 DECISION-8/9/10/11.

Base URL: `NEXT_PUBLIC_API_URL` (dev `http://127.0.0.1:8000`).

---

## `POST /anchor`

Compute the per-user anchor vector from a recorded baseline clip.

**Auth**: required. `Authorization: Bearer <supabase-access-token>`. Verified
with `SUPABASE_JWT_SECRET` (HS256), `exp` not past, `aud == "authenticated"`.
The `sub` claim is the trusted `user_id` (logging/scoping only — no DB write).

**Request**: `multipart/form-data`, one part:

| Field | Type | Notes |
|-------|------|-------|
| `clip` | file | `video/mp4` (H.264) or `video/webm` (VP8/VP9). Other types → 415. |

**Processing**: write the upload to a temp file → `ml_video.compute_anchor(path)`
→ delete the temp file in a `finally` (unconditional; Principle I) → respond.
Raw bytes are never persisted; no `anchor_video_path` stored (FR-016/017).

**Responses**:

| Status | Body | Meaning |
|--------|------|---------|
| `200` | `{ "model_version": "serenify-video-lbptop-motion-rf-calibrated@2.0.0", "dim": 2958, "vector_b64": "<base64 of 11832 LE float32 bytes>" }` | Extraction succeeded. Web decodes → writes own profile row. |
| `401` | `{ "error": "unauthenticated" }` | Missing / invalid / expired JWT. No extraction performed. |
| `415` | `{ "error": "unsupported_media_type" }` | Body is neither MP4 nor WebM (content-type + cv2 open probe). |
| `422` | `{ "error": "extraction_failed", "reason": "no_face" \| "roi_empty" \| "bad_vector" }` | `FeatureExtractionError`. UI shows calm retry copy; increments the 3-fail counter (FR-026/027). |

- `200` payload is ~16 KB (base64 of 11832 bytes). Float32 round-trips losslessly
  through base64 → `BYTEA`.
- The endpoint never returns the model's prediction (no `/predict` in 004).

## `GET /healthz`

Readiness probe. No auth.

**Responses**:

| Status | Body | Meaning |
|--------|------|---------|
| `200` | `{ "status": "ready", "model_version": "…@2.0.0" }` | Model + scaler loaded at startup; service ready. |

If the model/scaler fail to load at startup the app **fails to start** (so an
unready service is unreachable rather than answering). The web app pings this
before showing the recording step; an unreachable/failed probe → calm
"calibration is temporarily unavailable, please try again later" (FR-048).

## Startup sanity check (📌 DECISION-10)

On boot, `ml_video.load_model()` loads `packages/ml-video/models/{model,scaler}.joblib`
and asserts `scaler.n_features_in_ == 2958` and `model.classes_ == [0, 1]`
(`MODEL_HANDOFF.md` §8). Failure aborts startup.

## CORS

Allow the single web origin from `ALLOWED_ORIGIN` (env). `POST /anchor` is a
cross-origin call from `apps/web/`; the response is consumed by JS, so CORS must
permit the web origin + the `Authorization` header.

## Errors → UI mapping (web side)

| Backend | UI state | 3-fail counter |
|---------|----------|----------------|
| `200` | `success` → write row → `/app` | — |
| `422` | `extract-failed` (calm retry copy) | **++** |
| `401` | "something went wrong, try signing out and back in"; no auto-retry | no |
| `415` / network | `upload-failed` (retry) | no |
| `/healthz` unreachable | "temporarily unavailable" before recording | no |
