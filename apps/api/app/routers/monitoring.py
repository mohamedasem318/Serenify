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

US3 guard (T042):
- the create route's anchor-presence check 409s a no-anchor employee up front, and
  ``POST …/windows`` re-checks defensively — if the anchor vanishes mid-session
  ``score_window`` raises ``MissingAnchorError``, which the route turns into the **same**
  ``409 {"outcome":"no_anchor"}`` body (never a 500, never a fabricated reading; SC-004).

All DB access is **as the caller** — the user-context client (publishable anon key +
forwarded JWT), so ``auth.uid()`` resolves to the verified ``sub`` and RLS (select-own /
insert-own / **update-own**) is the control. There is **no service-role**; the server never
trusts a client-supplied id (SC-004).
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials
from postgrest.exceptions import APIError

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
    SupersededOutcome,
)
from ..services.inference import (
    WINDOW_MEDIA_SUFFIX,
    MissingAnchorError,
    buffers,
    score_window,
)
from ..services.scoring_gate import scoring_gate
from ..supabase_user import (
    finalize_active_session,
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
    is ever substituted** (SC-004).

    **One active session per user** (DECISIONS 2026-06-21): ending is client-driven, so a
    crash or a second tab can leave a PRIOR session active (``ended_at IS NULL``) forever —
    which also shadows the recap's "most-recent ENDED session" read. Before inserting the
    new run we finalize any prior active session as ``'abandoned'`` (stamped at its last
    reading, or now() if it never scored), so the one-active-per-user partial unique index
    always holds — **last-tab-wins**. A concurrent create that loses the index race (23505)
    is recovered with one finalize+retry, never a 500."""
    client = user_client(settings, credentials.credentials)
    if get_my_anchor(client) is None:
        return JSONResponse(status_code=409, content={"outcome": "no_anchor"})
    model_version = request.app.state.predictor.model_version
    finalize_active_session(client, now_iso=datetime.now(UTC).isoformat())
    try:
        row = insert_session(client, user_id=user_id, model_version=model_version)
    except APIError as exc:
        # The partial unique index rejected our insert: a concurrent create grabbed the
        # single active slot between our finalize and insert. Finalize that racer and retry
        # once (last-tab-wins); any other API error propagates unchanged.
        if getattr(exc, "code", None) != "23505":
            raise
        finalize_active_session(client, now_iso=datetime.now(UTC).isoformat())
        row = insert_session(client, user_id=user_id, model_version=model_version)
    return CreateSessionResponse(session_id=row["id"], model_version=model_version)


@router.post("/monitoring/sessions/{session_id}/windows")
async def submit_window(
    session_id: str,
    request: Request,
    clip: UploadFile = File(...),
    upload_kind: str = Form("full"),
    user_id: str = Depends(require_employee),
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    settings: Settings = Depends(get_settings),
):
    """Score one uploaded window. Returns the outcome union (``reading`` / ``warming_up`` /
    ``skipped``) — **never a probability** (FR-015).

    ``upload_kind`` (optional form field; absent = ``"full"``): ``"tail"`` declares a
    client-side **header+tail** upload (bounded w.r.t. session length — 2026-08-06). The
    server self-detects the trim from the media's absolute timestamps whenever ffprobe is
    available; the declaration exists so an ffprobe-less host fails CLOSED on a trimmed
    file instead of silently re-anchoring the sampling grid at the cut point. Unknown
    values are treated as ``"full"`` (the always-safe-when-ffprobe-present default)."""
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

    # Bound live scoring to ONE window per session + shed the backlog (drop-stale): the
    # browser fires a new 60 s window every ~10 s regardless of whether the last one finished,
    # which (with the anyio default CapacityLimiter of 40) used to run ~10 windows at once on
    # one session and oversubscribe the CPU, so each window ballooned to 40-110 s and the live
    # lag GREW. The gate serializes scoring per session and, when a window finally gets its
    # turn, sheds it as ``superseded`` if a NEWER window for the same session has since arrived
    # — so only the freshest window is ever scored. The freshest window always wins the
    # freshness check, so warm-up still reaches its 4 scored windows on schedule (the band is
    # never starved); only the backlog is dropped. See ``services.scoring_gate`` + the client
    # back-pressure in ``monitoring-session.tsx`` (this gate is the server-side backstop).
    try:
        async with scoring_gate.window(session_id) as is_freshest:
            if not is_freshest:
                # Superseded by a newer window for this session — shed cleanly: no scoring, no
                # ``window_readings`` row. The client tolerates this as a no-op (never an error
                # surface, never a band regression).
                return SupersededOutcome()
            clip_bytes = await clip.read()
            # CPU-bound decode + MediaPipe + LBP + (blocking) supabase I/O — off the event loop
            # so a slow window never serializes the next (FR-016, SC-007). The gate holds the
            # per-session lock across this call so at most one window per session ever scores.
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
                upload_kind="tail" if upload_kind == "tail" else "full",
            )
    except MissingAnchorError:
        # Defensive mid-session guard (US3 / T042): the caller's anchor vanished AFTER the
        # create-time check (T021) — score_window raises rather than fabricating a
        # global/fallback anchor (SC-004). Surface the EXACT same 409 no_anchor body the
        # create route uses so the client routes to calibrate-first; never a 500, and never a
        # reading without the user's own anchor (SC-004, FR-011).
        return JSONResponse(status_code=409, content={"outcome": "no_anchor"})
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

    # Free the session's smoothing buffer AND its scoring-gate state now it can never score
    # again (no memory leak on ended sessions; the deferred LRU caps are the backstop, these
    # are the explicit drops the _SessionBuffers / SessionScoringGate contracts promise on End).
    buffers.drop(session_id)
    scoring_gate.drop(session_id)
    return EndSessionResponse(session_id=session_id, ended_at=ended_at)
