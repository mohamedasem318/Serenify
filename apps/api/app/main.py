"""App factory + startup fail-fast model load (DECISION-10, Principle II)."""

from __future__ import annotations

from contextlib import asynccontextmanager

import ml_video
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import anchor, health


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail-fast: load + contract-check the model/scaler at boot. If the artifacts
    # are missing or mismatched, load_model raises and the service never serves
    # (handoff §8 red-flags 1-2). The predictor is stored for /healthz + /anchor.
    app.state.predictor = ml_video.load_model()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Serenify Anchor API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.allowed_origin],
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(health.router)
    app.include_router(anchor.router)
    return app


app = create_app()
