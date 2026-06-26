"""Response/error models for the anchor + monitoring services (DECISION-8; 008)."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


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


# ── Monitoring (feature 008, contracts/inference-api.md) ─────────────────────

# The three smoothed bands shown on the bloom (FR-026); the server-coarse skip
# causes the API returns (the client refines low-light vs out-of-frame from its
# on-device telemetry). NEVER a numeric probability on the wire (FR-015).
Band = Literal["at_ease", "a_little_tense", "tense"]
SkipCause = Literal["insufficient-face", "our-side"]


class CreateSessionResponse(BaseModel):
    """201 body for ``POST /monitoring/sessions``."""

    model_config = ConfigDict(protected_namespaces=())

    session_id: str
    model_version: str


class PatchSessionRequest(BaseModel):
    """Body for ``PATCH /monitoring/sessions/{id}`` — lifecycle status only."""

    status: Literal["paused", "active", "out_of_frame"]


class PatchSessionResponse(BaseModel):
    session_id: str
    status: str


class EndSessionRequest(BaseModel):
    """Body for ``POST /monitoring/sessions/{id}/end`` (defaults to a user end)."""

    reason: Literal["user", "auto_absence", "error"] = "user"


class EndSessionResponse(BaseModel):
    session_id: str
    ended_at: datetime


# The window outcome is a DISCRIMINATED union on ``outcome`` — the client switches
# on the tag and never sees a probability. Three shapes (contracts/inference-api.md):
class ReadingOutcome(BaseModel):
    """A scored, warmed window: the smoothed three-band reading."""

    outcome: Literal["reading"] = "reading"
    band: Band
    captured_at: datetime


class WarmingUpOutcome(BaseModel):
    """Not yet a reading — either < 60 s recorded, or < M=4 scored readings."""

    outcome: Literal["warming_up"] = "warming_up"
    captured_at: datetime


class SkippedOutcome(BaseModel):
    """Couldn't read this window (coverage/extract failure) — routine, not an error."""

    outcome: Literal["skipped"] = "skipped"
    cause: SkipCause


class SupersededOutcome(BaseModel):
    """This window was shed by the per-session scoring gate: a newer window for the same
    session arrived before this one could be scored (drop-stale; see ``services.scoring_gate``).
    Routine back-pressure, never an error — no probability, no reading, and **no
    ``window_readings`` row is persisted** (so the trend has fewer points, by design). The
    client treats it as a no-op (the held band stays; the freshest window carries the next
    reading)."""

    outcome: Literal["superseded"] = "superseded"


WindowOutcome = Annotated[
    ReadingOutcome | WarmingUpOutcome | SkippedOutcome | SupersededOutcome,
    Field(discriminator="outcome"),
]
