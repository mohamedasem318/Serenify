"""GET /healthz — unauthenticated readiness probe (DECISION-10, FR-048).

The web app calls this before showing the recorder so the user never records
60s into a dead backend; returns the loaded model version.
"""

from __future__ import annotations

from fastapi import APIRouter, Request

from ..schemas import HealthResponse

router = APIRouter()


@router.get("/healthz", response_model=HealthResponse)
def healthz(request: Request) -> HealthResponse:
    predictor = request.app.state.predictor
    return HealthResponse(status="ready", model_version=predictor.model_version)
