"""Session-aware inference endpoints (feature 008, US1 / T021; contracts/inference-api.md).

In scope for this slice (US1):
- ``POST /monitoring/sessions`` — create a run with the **calibrate-first guard up front**
  (no anchor → 409 ``no_anchor``, before any 60 s of video is captured);
- ``POST /monitoring/sessions/{id}/windows`` — accept the **contiguous recording-so-far**,
  run the CPU-bound read path in a **threadpool** so a slow window never blocks the next,
  and return only the outcome union (``reading`` / ``warming_up`` / ``skipped``) — **never a
  probability**.

Out of this slice: ``PATCH /{id}`` + ``…/end`` (US2 / T036) and the defensive mid-session
``409 no_anchor`` re-check (US3 / T042).

All DB access is **as the caller** — the user-context client (publishable anon key +
forwarded JWT), so ``auth.uid()`` resolves to the verified ``sub`` and RLS (select-own /
insert-own) is the control. There is **no service-role**; the server never trusts a
client-supplied id (SC-004).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials

# Reuse the single HTTPBearer scheme so we can build the user-context client from the
# forwarded token; require_employee has already verified it + gated the role.
from ..auth import _bearer, require_employee
from ..config import Settings, get_settings
from ..schemas import CreateSessionResponse
from ..services.inference import WINDOW_MEDIA_SUFFIX, score_window
from ..supabase_user import get_my_anchor, get_session, insert_session, user_client

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
