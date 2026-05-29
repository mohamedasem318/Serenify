# Forward artifact (DECISION-7): feature 004 ships local-only; this image is not
# deployed here. Build from the REPO ROOT so the ml-video path dep resolves:
#
#   docker build -f apps/api/Dockerfile -t serenify-api .
#
# Python pinned to 3.12 — mediapipe==0.10.13 has no 3.13 wheel (DECISION-1).
FROM python:3.12-slim

# OpenCV / mediapipe runtime shared libraries.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /srv
# Copy the editable path-dep target first, then the API project.
COPY packages/ml-video /srv/packages/ml-video
COPY apps/api /srv/apps/api

WORKDIR /srv/apps/api
RUN uv sync --frozen --no-dev

EXPOSE 8000
# SUPABASE_JWT_SECRET and ALLOWED_ORIGIN are injected at run time, never baked in
# (Principle IX). The production ALLOWED_ORIGIN is [TBD by deployment].
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
