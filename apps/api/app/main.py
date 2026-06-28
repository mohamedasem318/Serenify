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
from .routers import anchor, chat, health, monitoring


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
        # PATCH is required for the monitoring lifecycle transition; DELETE for chat
        # conversation hard-delete (feature 011). web→API is always cross-origin, so an
        # omitted method makes the browser preflight 400 and the call silently never runs.
        # Kept an EXPLICIT allow-list (no "*") to avoid any wildcard-vs-credentials interaction.
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.add_exception_handler(ForbiddenRoleError, _forbidden_role_handler)
    app.include_router(health.router)
    app.include_router(anchor.router)
    # Feature 008 / US1 (T021): the session-aware inference read path. POST
    # /monitoring/sessions (create + calibrate-first guard) and …/{id}/windows (score one
    # contiguous-recording-so-far window). PATCH …/{id} + …/end are US2 (T036). Relies on
    # the Phase-3 startup wiring above (app.state.operating_point / .tense_band), the
    # require_employee gate, and the user-context client.
    app.include_router(monitoring.router)
    # Feature 011: employee-only Ren chat. Conversation CRUD + orchestrated
    # send/retry/end. RLS-as-user; no service-role; crisis is live-only.
    app.include_router(chat.router)
    return app


app = create_app()
