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

## System dependency: the `ffmpeg` CLI (`ffmpeg` + `ffprobe`)

The feature-008 live-read keep-up path decodes only the **trailing 60 s** of the growing
recording each window instead of re-decoding the whole clip (per-window cost O(stride), not
O(elapsed)). It uses the **ffmpeg CLI** for the part OpenCV cannot do on an un-finalized
MediaRecorder webm — a cheap `ffprobe` packet probe for the file-global sampling grid + the
`< 60 s` gate, and an `ffmpeg -c copy` lossless tail remux (OpenCV `cap.set` seek is a silent
no-op on those files, though it works natively for mp4). Install it on every host that runs
the service (the Docker image already does — `apt-get install ffmpeg`). If the binary is
**absent** the read path still works but **degrades to the whole-file decode** (O(elapsed) —
the lag the fix removes); a binary that **runs-but-fails** on a clip skips that window (200),
never 500s. Run `packages/ml-video/tests/test_tail_seek_keepup.py` on the deploy target — it
asserts the tail decode is **bit-identical** to the whole-file path, so an ffmpeg version
difference can't silently shift fidelity.

## Run locally

```sh
cd apps/api
cp .env.example .env          # SUPABASE_JWT_SECRET + ALLOWED_ORIGINS (dev: http://localhost:3000)
# ffmpeg/ffprobe on PATH (Windows: `winget install Gyan.FFmpeg`; macOS: `brew install ffmpeg`;
# Debian/Ubuntu: `apt-get install ffmpeg`) — see "System dependency" above.
uv sync
# Dev with auto-reload — watcher scoped to source only (`--reload-dir app`), so
# cache/test-file writes and branch checkouts don't restart the worker:
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app
# Clean live-monitor test pass — NO reload (never drops the in-memory band buffer;
# see "Live-monitor testing" below):
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
curl localhost:8000/healthz
```

> **`--host 0.0.0.0` is load-bearing.** The bare `uvicorn … --port 8000` binds
> **loopback only** (`127.0.0.1`), so the browser can only reach the API when
> `NEXT_PUBLIC_API_URL` is also `127.0.0.1`/`localhost`. Point it at any other host
> (e.g. a LAN IP for device testing) and the connection is refused → the
> calibration readiness gate (`GET /healthz`, FR-048) reports "temporarily
> unavailable" and **recording never starts**. Binding `0.0.0.0` is harmless for
> localhost dev and required for LAN access.

### Live-monitor testing: don't run under bare `--reload`

The feature-008 live read path keeps a **per-session in-memory smoothing buffer**
(`_SessionBuffers` in `app/services/inference.py`); the smoothed band only latches
after ~4 scored windows (~90 s). Any uvicorn **worker restart drops that buffer**,
forcing a fresh ~90 s re-warm. Under **bare `--reload`** the watcher restarts on
*any* file change in the tree — a cache write, a test-file save, a `git checkout` —
so during a live session the bloom can stay stuck on **"getting a read on things"**
for the whole run, even though the recap afterward shows a normal band line (the
persisted DB rows survive each restart; only the in-memory buffer doesn't). For the
full empirical fingerprint and the production fix, see `docs/BACKLOG.md` (the
live-monitor readings-stability / in-memory smoothing-buffer items).

So for a live-monitor test pass:

- Run with **no `--reload`** (the plain `--host 0.0.0.0 --port 8000` command above)
  for the cleanest pass, **or** scope the watcher with **`--reload --reload-dir app`**
  so only `app/` source — not cache/test churn — can trigger a restart.
- Either way, **don't edit `app/` source mid-session** — even under
  `--reload-dir app`, saving a watched source file restarts the worker and drops the
  buffer, re-warming the bloom from scratch.

The service refuses to start unless the model artifacts load and pass the
contract check (`scaler.n_features_in_ == 2958`, `model.classes_ == [0, 1]`).

## Test

```sh
uv run pytest        # happy (mocked FaceMesh), 422 no-face, 401, 415, raw-byte deletion
```

Python **3.12** only (mediapipe wheel ceiling). Env vars are read at startup and
never embedded (Principle IX).
