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


# ── Chat (feature 011, contracts/orchestration.md + chat-storage-rls.md) ─────
# Reuses `Band` (at_ease | a_little_tense | tense). Note what is DELIBERATELY
# absent from every response below: no crisis flag is ever persisted or echoed as
# stored state, no per-message band, no raw scorer JSON, no prompt text. The live
# crisis panel (CrisisPanel) is a render-only payload (FR-041).

ConversationState = Literal["open", "ended"]
ChatRole = Literal["user", "assistant"]


class ConversationSummary(BaseModel):
    """A conversation row for history / recent-chats. Carries the ONE stored
    chat-derived band (rollup_band) — never a crisis field."""

    id: str
    title: str | None
    state: ConversationState
    rollup_band: Band | None
    message_count: int
    last_message_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ChatMessageOut(BaseModel):
    id: str
    role: ChatRole
    content: str
    created_at: datetime


class ConversationDetail(BaseModel):
    conversation: ConversationSummary
    messages: list[ChatMessageOut]


class ConversationListResponse(BaseModel):
    conversations: list[ConversationSummary]


class CrisisResourceOut(BaseModel):
    """A verified app-table resource row — never model-generated (FR-035)."""

    country: Literal["EG", "US"]
    name: str
    number: str
    url: str | None = None
    last_checked: str


class CrisisPanel(BaseModel):
    """Live, render-only crisis payload. Surfaces verified resources + the
    universal immediate-danger line. Rendering it persists NOTHING (FR-041/042)."""

    resources: list[CrisisResourceOut]
    universal_line: str
    emergency_number: str | None = None


class SendMessageRequest(BaseModel):
    content: str


class SendMessageResponse(BaseModel):
    """Outcome of one user send.

    - ``ok``: Ren replied; ``assistant_message`` present. ``crisis`` may be set
      (scorer flag OR Ren's [CRISIS] token). ``rollup_band`` set when a fifth-message
      rollup ran. Per-message score is never persisted or returned.
    - ``assistant_failed``: the user message persisted but Ren failed after retry; the
      client shows a calm trouble state and can retry without retyping (FR-052/054).
    - ``rate_limited``: the send was blocked; nothing persisted (FR-059).
    """

    outcome: Literal["ok", "assistant_failed", "rate_limited"]
    user_message: ChatMessageOut | None = None
    assistant_message: ChatMessageOut | None = None
    crisis: CrisisPanel | None = None
    rollup_band: Band | None = None
    conversation: ConversationSummary | None = None
    retry_after_seconds: int | None = None


class RenameConversationRequest(BaseModel):
    title: str


class EndConversationResponse(BaseModel):
    """End flow. ``ended``: rollup + auto-title both succeeded and the conversation
    is closed. ``retry``: rollup or title failed after retry — the conversation stays
    OPEN with a calm retry state (FR-032b); it is not marked ended."""

    outcome: Literal["ended", "retry"]
    conversation: ConversationSummary | None = None

