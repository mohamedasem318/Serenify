"""Session-aware inference endpoints (feature 008; contracts/inference-api.md).

US1 (T021):
- ``POST /monitoring/sessions`` — create a run with the **calibrate-first guard up front**
  (no anchor → 409 ``no_anchor``, before any 60 s of video is captured);
- ``POST /monitoring/sessions/{id}/windows`` — accept the **contiguous recording-so-far**,
  run the CPU-bound read path in a **threadpool** so a slow window never blocks the next,
  and return only the outcome union (``reading`` / ``warming_up`` / ``skipped``) — **never a
  probability**.

US2 lifecycle (T036):
- ``PATCH /monitoring/sessions/{id}`` — record a pause / resume / out-of-frame transition
  on the row (status only; camera control is client-side);
- ``POST /monitoring/sessions/{id}/end`` — terminal: stamp ``ended_at`` / ``status='ended'`` /
  ``end_reason``, and **evict the per-session in-memory smoothing buffer** so ended sessions
  don't leak memory. The only invalid transition is touching an **ended** session → 409.

Out of scope here: the defensive mid-session ``409 no_anchor`` re-check (US3 / T042).

All DB access is **as the caller** — the user-context client (publishable anon key +
forwarded JWT), so ``auth.uid()`` resolves to the verified ``sub`` and RLS (select-own /
insert-own / **update-own**) is the control. There is **no service-role**; the server never
trusts a client-supplied id (SC-004).
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials

# Reuse the single HTTPBearer scheme so we can build the user-context client from the
# forwarded token; require_employee has already verified it + gated the role.
from ..auth import _bearer, require_employee
from ..config import Settings, get_settings
from ..schemas import (
    CreateSessionResponse,
    EndSessionRequest,
    EndSessionResponse,
    PatchSessionRequest,
    PatchSessionResponse,
)
from ..services.inference import WINDOW_MEDIA_SUFFIX, buffers, score_window
from ..supabase_user import (
    get_my_anchor,
    get_session,
    insert_session,
    update_session,
    user_client,
)

router = APIRouter()


@router.post("/monitoring/sessions", status_code=201)
async def create_session(
    request: Request,
    user_id: str = Depends(require_employee),
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    settings: Settings = Depends(get_settings),
):
    """Start a run. ``require_employee`` gates the role (non-employee → 403 forbidden_role).
    The **calibrate-first guard runs up front** (FR-011): if the caller has no anchor →
    **409 ``{"outcome":"no_anchor"}``** before any capture, and **no global/fallback anchor
    is ever substituted** (SC-004)."""
    client = user_client(settings, credentials.credentials)
    if get_my_anchor(client) is None:
        return JSONResponse(status_code=409, content={"outcome": "no_anchor"})
    model_version = request.app.state.predictor.model_version
    row = insert_session(client, user_id=user_id, model_version=model_version)
    return CreateSessionResponse(session_id=row["id"], model_version=model_version)


@router.post("/monitoring/sessions/{session_id}/windows")
async def submit_window(
    session_id: str,
    request: Request,
    clip: UploadFile = File(...),
    user_id: str = Depends(require_employee),
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    settings: Settings = Depends(get_settings),
):
    """Score one uploaded **contiguous-recording-so-far** window. Returns the outcome union
    (``reading`` / ``warming_up`` / ``skipped``) — **never a probability** (FR-015)."""
    base_type = (clip.content_type or "").split(";")[0].strip().lower()
    if base_type not in WINDOW_MEDIA_SUFFIX:
        return JSONResponse(
            status_code=415,
            content={
                "error": "unsupported_media_type",
                "reason": "expected video/mp4 or video/webm",
            },
        )

    client = user_client(settings, credentials.credentials)
    # RLS select-own: the session is only visible if owned by the verified caller, so an
    # unknown OR someone-else's id both resolve to None → 404 (SC-004).
    session = get_session(client, session_id)
    if session is None:
        return JSONResponse(status_code=404, content={"error": "unknown_session"})
    if session["status"] == "ended":
        return JSONResponse(status_code=409, content={"error": "ended_session"})

    clip_bytes = await clip.read()
    # CPU-bound decode + MediaPipe + LBP + (blocking) supabase I/O — off the event loop so a
    # slow window never serializes the next (FR-016, SC-007). The client keeps its single
    # continuous recorder running and uploads on its own timer regardless of this response.
    outcome = await run_in_threadpool(
        score_window,
        clip_bytes=clip_bytes,
        content_type=base_type,
        client=client,
        predictor=request.app.state.predictor,
        operating_point=request.app.state.operating_point,
        tense_band=request.app.state.tense_band,
        session_id=session_id,
        user_id=user_id,
    )
    return outcome


# Statuses that may NOT be transitioned out of — ``ended`` is terminal. The data-model
# lifecycle allows free movement between active / paused / out_of_frame (the Pydantic body
# already bars an ``ended`` PATCH target — that is ``…/end``'s job), so the single rule both
# write routes enforce is "you cannot transition a session that has already ended."
_TERMINAL_STATUS = "ended"


@router.patch("/monitoring/sessions/{session_id}")
async def patch_session(
    session_id: str,
    payload: PatchSessionRequest,
    user_id: str = Depends(require_employee),
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    settings: Settings = Depends(get_settings),
):
    """Record a pause / resume / out-of-frame transition for the recap (US2 / T036).

    Camera control is client-side; this only moves ``status`` on the **owned** row under
    RLS update-own. An unknown or another user's session resolves to ``None`` → 404 (SC-004);
    a terminal (``ended``) session can't transition → 409 (a clean 4xx, never a 500)."""
    client = user_client(settings, credentials.credentials)
    # RLS select-own: only an owned session is visible; an unknown OR foreign id → None → 404.
    session = get_session(client, session_id)
    if session is None:
        return JSONResponse(status_code=404, content={"error": "unknown_session"})
    if session["status"] == _TERMINAL_STATUS:
        return JSONResponse(status_code=409, content={"error": "ended_session"})

    updated = update_session(
        client,
        session_id,
        status=payload.status,
        updated_at=datetime.now(UTC).isoformat(),
    )
    if updated is None:  # defensive: RLS update-own denied after a select-own pass
        return JSONResponse(status_code=404, content={"error": "unknown_session"})
    return PatchSessionResponse(session_id=session_id, status=payload.status)


@router.post("/monitoring/sessions/{session_id}/end")
async def end_session(
    session_id: str,
    payload: EndSessionRequest | None = None,
    user_id: str = Depends(require_employee),
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    settings: Settings = Depends(get_settings),
):
    """Terminal end of a run (US2 / T036): stamp ``ended_at`` / ``status='ended'`` /
    ``end_reason`` on the owned row under RLS update-own, then **evict the per-session
    in-memory smoothing buffer** so an ended session leaks no server memory.

    The body is optional and defaults to ``reason="user"`` (the client always sends a
    reason; a bare POST still ends cleanly). Ending an already-ended session is a clean
    409, not a 500; an unknown/foreign session → 404."""
    reason = payload.reason if payload is not None else "user"
    client = user_client(settings, credentials.credentials)
    session = get_session(client, session_id)
    if session is None:
        return JSONResponse(status_code=404, content={"error": "unknown_session"})
    if session["status"] == _TERMINAL_STATUS:
        return JSONResponse(status_code=409, content={"error": "ended_session"})

    ended_at = datetime.now(UTC)
    updated = update_session(
        client,
        session_id,
        status="ended",
        ended_at=ended_at.isoformat(),
        end_reason=reason,
        updated_at=ended_at.isoformat(),
    )
    if updated is None:  # defensive: RLS update-own denied after a select-own pass
        return JSONResponse(status_code=404, content={"error": "unknown_session"})

    # Free the session's smoothing buffer now it can never score again (no memory leak on
    # ended sessions; the deferred LRU cap is the backstop, this is the explicit drop the
    # _SessionBuffers contract promised on End).
    buffers.drop(session_id)
    return EndSessionResponse(session_id=session_id, ended_at=ended_at)
