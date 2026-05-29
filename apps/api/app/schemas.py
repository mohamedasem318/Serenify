"""Response/error models for the anchor service (DECISION-8)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class AnchorResponse(BaseModel):
    # `model_version` would otherwise trip pydantic's protected `model_` namespace.
    model_config = ConfigDict(protected_namespaces=())

    model_version: str
    dim: int
    vector_b64: str  # base64 of the (2958,) little-endian float32 vector


class HealthResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    status: str
    model_version: str


class ErrorResponse(BaseModel):
    error: str
    reason: str | None = None
