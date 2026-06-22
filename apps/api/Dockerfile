# Forward artifact (DECISION-7): feature 004 ships local-only; this image is not
# deployed here. Build from the REPO ROOT so the ml-video path dep resolves:
#
#   docker build -f apps/api/Dockerfile -t serenify-api .
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

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /srv
# Copy the editable path-dep target first, then the API project.
COPY packages/ml-video /srv/packages/ml-video
COPY apps/api /srv/apps/api

WORKDIR /srv/apps/api
RUN uv sync --frozen --no-dev

EXPOSE 8000
# SUPABASE_JWT_SECRET and ALLOWED_ORIGINS are injected at run time, never baked in
# (Principle IX). The production ALLOWED_ORIGINS is [TBD by deployment].
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
