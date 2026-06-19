"""App factory + startup fail-fast model load (DECISION-10, Principle II)."""

from __future__ import annotations

from contextlib import asynccontextmanager

import ml_video
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .auth import ForbiddenRoleError
from .config import get_settings
from .logging_config import configure_logging
from .routers import anchor, health


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail-fast: load + contract-check the model/scaler at boot. If the artifacts
    # are missing or mismatched, load_model raises and the service never serves
    # (handoff §8 red-flags 1-2). The predictor is stored for /healthz + /anchor.
    app.state.predictor = ml_video.load_model()
    # Resolve the calibrated operating point (and the display tense band) into
    # app.state at startup (feature 008 T017). The operating point default is READ
    # FROM metadata.json by Settings (never a literal); constructing settings has
    # already fail-fast-validated that read at import, so a malformed metadata block
    # would have stopped boot before here.
    settings = get_settings()
    app.state.operating_point = settings.stress_operating_point
    app.state.tense_band = settings.stress_tense_band
    yield


async def _forbidden_role_handler(_request, _exc: ForbiddenRoleError) -> JSONResponse:
    # Render require_employee's rejection as the documented body (FR-010) — the
    # /anchor-style {"error": …} shape, not FastAPI's default {"detail": …} wrapper.
    return JSONResponse(status_code=403, content={"error": "forbidden_role"})


def create_app() -> FastAPI:
    settings = get_settings()
    # Install the service's logging before anything emits: apps/api otherwise ships
    # no logging config, so ml_video's INFO records (the usable-face-coverage reject
    # line) would be suppressed under uvicorn. Server-side only — no response change.
    configure_logging(settings.log_level)
    app = FastAPI(title="Serenify Anchor API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.add_exception_handler(ForbiddenRoleError, _forbidden_role_handler)
    app.include_router(health.router)
    app.include_router(anchor.router)
    # NOTE (feature 008): the monitoring router (POST /monitoring/sessions, …/windows,
    # …/end, PATCH …/{id}) is built in Phase 4 / US1 (task T021) — the inference read
    # path is out of Phase-3 scope. Its include lands with T021:
    #     from .routers import monitoring
    #     app.include_router(monitoring.router)
    # The Phase-3 startup wiring it relies on (app.state.operating_point / .tense_band
    # above, require_employee, the user-context client) is already in place.
    return app


app = create_app()
