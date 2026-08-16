"""Feature 014 — the recommendations service surface (T024).

Exactly one route: `POST /recommendations/reflective-copy`, which re-phrases one already
-approved deterministic sentence for card states 2 and 9. The card's real work — choosing
an item, recording a pick, recording an outcome — is client-side against Supabase under
RLS and never passes through here.

── Two properties this router is required to have, and how they are kept ────────────
* **No database access at all** (FR-020/FR-023). The facts arrive precomputed in the
  request body, so this module imports no Supabase client, no `chat_store`, no
  `supabase_user` — nothing that could reach a table. `POST` with the facts, get a string
  back; the service is stateless.
* **Auth is JWT verification and nothing more.** `verify_jwt` — not `require_employee`,
  which would read `profiles.role` and therefore read user data, which the contract
  forbids this endpoint from doing ("MUST NOT read … any other user data"). A verified
  token is the gate; the caller learns nothing they did not already send.

Failures answer non-200 and the endpoint NEVER falls back. The deterministic string lives
on the client next to the facts, so the fallback decision is made there
(`contracts/reflective-copy.md` §Endpoint).
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from llm_client import LLMProviderError, ScorerValidationError
from pydantic import BaseModel, ConfigDict, Field

from ..auth import verify_jwt
from ..services.llm_client import get_reflective_copy_llm_client
from ..services.reflective_copy import ReflectiveFacts, generate_reflective_copy

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


class ReflectiveCopyRequest(BaseModel):
    """The `ReflectiveFacts` bundle (`data-model.md` §4) — and nothing else.

    `extra="forbid"` is load-bearing, not tidiness: it is what makes "facts-only" an
    enforced input surface rather than a convention. A client that starts sending a
    reading, a probability or a name gets a 422 instead of quietly handing it to a model.

    **Every field is also bounded in SIZE.** `extra="forbid"` stops unknown fields; it says
    nothing about a known field carrying a megabyte. Since the body is forwarded to a paid
    provider, an unbounded field is an unbounded bill and an unbounded prompt, so each
    bound below is the real surface's shape with headroom, and a body outside it is
    rejected before any provider is touched. Rate limiting is a separate concern and
    deliberately out of scope here.
    """

    model_config = ConfigDict(extra="forbid")

    # Only the two reflective states generate; anything else is a client bug, rejected
    # at the door rather than phrased.
    state: Literal[2, 9]
    # A check-in is a monitoring session. 288 is a five-minute session every five minutes
    # for 24 hours — far past anything real, and still a number rather than no number.
    checkin_count: int = Field(ge=0, le=288)
    # One preformatted clock string per check-in, e.g. "9:40" (longer in other locales).
    times: list[Annotated[str, Field(max_length=16)]] = Field(default_factory=list, max_length=24)
    # At most the three display labels; 32 chars each leaves room for a translation.
    band_labels: list[Annotated[str, Field(max_length=32)]] = Field(
        default_factory=list, max_length=8
    )
    # The deterministic line being re-phrased. Bounded by the same cap the web validator
    # enforces on what it gets back (`REFLECTIVE_COPY_MAX_LENGTH`).
    fallback_text: str = Field(min_length=1, max_length=220)
    # A library title, verbatim. The longest shipped title is well under this.
    tried_item_title: str | None = Field(default=None, max_length=120)
    tried_at_label: str | None = Field(default=None, max_length=32)


class ReflectiveCopyResponse(BaseModel):
    text: str


def _unavailable(reason: str) -> JSONResponse:
    """The one failure shape. 502, because the failure is always downstream of us — the
    provider, its credential, or the JSON contract. The `{"error": …}` body matches
    `/anchor`'s shape rather than FastAPI's `{"detail": …}` wrapper.

    The reason is operational only: which STEP failed, never what was said.
    """
    return JSONResponse(
        status_code=status.HTTP_502_BAD_GATEWAY,
        content={"error": "reflective_copy_unavailable", "reason": reason},
    )


@router.post("/reflective-copy", response_model=ReflectiveCopyResponse)
async def reflective_copy(
    body: ReflectiveCopyRequest,
    _user_id: str = Depends(verify_jwt),
) -> ReflectiveCopyResponse | JSONResponse:
    facts = ReflectiveFacts(
        state=body.state,
        checkin_count=body.checkin_count,
        times=tuple(body.times),
        band_labels=tuple(body.band_labels),
        fallback_text=body.fallback_text,
        tried_item_title=body.tried_item_title,
        tried_at_label=body.tried_at_label,
    )

    llm = get_reflective_copy_llm_client()
    try:
        text = await generate_reflective_copy(llm, facts)
    except ScorerValidationError as exc:
        # The provider answered but broke the JSON contract. Telemetry was already
        # emitted by the service with the failure type.
        return _unavailable(exc.failure_type)
    except LLMProviderError:
        # Provider down, timed out, or the reflective credential is absent/invalid —
        # the last of which is the expected state until the secret is placed.
        return _unavailable("provider_error")

    return ReflectiveCopyResponse(text=text)
