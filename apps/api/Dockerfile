# Serenify anchor / monitoring / chat API — x86 (linux/amd64) runtime image.
#
# Build from the REPO ROOT so the editable path deps resolve (ml-video AND
# llm-client live under packages/, referenced as ../../packages/... in uv.lock):
#
#   docker build --platform linux/amd64 -f apps/api/Dockerfile -t serenify-api .
#
# Target host: Azure Container Apps (`serenify-api` in `serenify-prod-rg`), francecentral,
# x86/amd64 (the ARM path is dead). Building --platform linux/amd64 keeps the image matched to
# the x86-validated ML pipeline. Container Apps replaced ACI as the production target in
# Constitution Amendment 14 (2026-07-12); no ACI remains — this image tag, published to
# `ghcr.io/mohamedasem318/serenify-api:production`, is the durable recovery artifact.
#
# Python pinned to 3.12 — mediapipe==0.10.13 has no 3.13 wheel (DECISION-1).
FROM python:3.12-slim

# OpenCV / mediapipe runtime shared libraries, plus the ffmpeg CLI.
# ffmpeg/ffprobe are REQUIRED for the feature-008 O(stride) live-read keep-up path: the server
# decodes only the trailing 60 s of the growing recording each window (ffprobe packet probe +
# ffmpeg `-c copy` tail remux for un-seekable webm) instead of re-decoding the whole clip. Without
# the binary the read path still works but degrades to the whole-file decode (O(elapsed) — the
# lag the fix removes). Run the local fidelity test (`ml-video/tests/test_tail_seek_keepup.py`) on
# the deploy image so an ffmpeg version difference can't silently shift fidelity.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Fail the build loudly if ffmpeg is unusable (a silent video-decode break otherwise).
RUN ffmpeg -version

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Deterministic + offline-friendly uv: never fetch a Python (the base image supplies
# 3.12), compile bytecode for faster cold starts, copy (not hardlink) across layers.
ENV UV_PYTHON_DOWNLOADS=never \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /srv
# Copy the editable path-dep targets first, then the API project. ALL THREE are
# required by uv.lock — omitting llm-client (feature 011) fails `uv sync --frozen`.
COPY packages/ml-video   /srv/packages/ml-video
COPY packages/llm-client /srv/packages/llm-client
COPY apps/api            /srv/apps/api

WORKDIR /srv/apps/api
# --frozen: install EXACTLY what uv.lock pins (scikit-learn==1.6.1 is load-bearing —
# a mismatch unpickles the RandomForest to a silently-wrong model). --no-dev drops
# pytest/ruff from the runtime image.
RUN uv sync --frozen --no-dev

EXPOSE 8000
# Single worker (the in-memory smoothing buffer is per-process; NO --reload).
# --no-sync: the env was already synced at build time, so container start never
# re-checks the lock or touches the network. SUPABASE_JWT_SECRET / SUPABASE_URL /
# SUPABASE_ANON_KEY / ALLOWED_ORIGINS are injected at RUN time, never baked in
# (Principle IX). The production ALLOWED_ORIGINS is [TBD by deployment].
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
