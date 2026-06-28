"""Employee-only chat endpoints (feature 011).

Every route is gated by `require_employee` (team leads/admins → 403) and runs DB I/O
as the caller via the user-context client (forwarded JWT + publishable anon key, RLS
the control). No service-role. Conversation CRUD is implemented here; send/end/retry
delegate to `services.chat_orchestrator` (Ren + scorer + rollup/title).
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client

from ..auth import require_employee
from ..config import Settings, get_settings
from ..schemas import (
    ChatMessageOut,
    ConversationDetail,
    ConversationListResponse,
    ConversationSummary,
    EndConversationResponse,
    RenameConversationRequest,
    SendMessageRequest,
    SendMessageResponse,
)
from ..services import chat_store
from ..services.llm_client import get_llm_client
from ..supabase_user import user_client

router = APIRouter(prefix="/chat", tags=["chat"])

_bearer = HTTPBearer(auto_error=False)


@dataclass
class ChatCtx:
    user_id: str
    client: Client


def get_chat_ctx(
    user_id: str = Depends(require_employee),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> ChatCtx:
    """Verified employee (require_employee gates non-employees → 403) plus a
    user-scoped Supabase client built from the forwarded JWT."""
    assert credentials is not None  # require_employee/verify_jwt guarantee it
    return ChatCtx(user_id=user_id, client=user_client(settings, credentials.credentials))


def _summary(row: dict) -> ConversationSummary:
    return ConversationSummary(
        id=str(row["id"]),
        title=row.get("title"),
        state=row["state"],
        rollup_band=row.get("rollup_band"),
        message_count=row.get("message_count", 0),
        last_message_at=row.get("last_message_at"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _message(row: dict) -> ChatMessageOut:
    return ChatMessageOut(
        id=str(row["id"]),
        role=row["role"],
        content=row["content"],
        created_at=row["created_at"],
    )


def _require_owned(ctx: ChatCtx, conversation_id: str) -> dict:
    row = chat_store.get_conversation(ctx.client, conversation_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return row


# ── Conversation CRUD (US1) ───────────────────────────────────────────────


@router.get("/conversations", response_model=ConversationListResponse)
def list_conversations(ctx: ChatCtx = Depends(get_chat_ctx)) -> ConversationListResponse:
    rows = chat_store.list_conversations(ctx.client)
    return ConversationListResponse(conversations=[_summary(r) for r in rows])


@router.post(
    "/conversations",
    response_model=ConversationSummary,
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(ctx: ChatCtx = Depends(get_chat_ctx)) -> ConversationSummary:
    row = chat_store.insert_conversation(ctx.client, user_id=ctx.user_id)
    return _summary(row)


@router.get("/conversations/current", response_model=ConversationDetail | None)
def get_current_conversation(ctx: ChatCtx = Depends(get_chat_ctx)) -> ConversationDetail | None:
    """The most-recently-active conversation with its messages (the pill's "current
    chat"), or null when the employee has none yet."""
    row = chat_store.get_current_conversation(ctx.client)
    if row is None:
        return None
    messages = chat_store.get_messages(ctx.client, str(row["id"]))
    return ConversationDetail(
        conversation=_summary(row), messages=[_message(m) for m in messages]
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation_detail(
    conversation_id: str, ctx: ChatCtx = Depends(get_chat_ctx)
) -> ConversationDetail:
    row = _require_owned(ctx, conversation_id)
    messages = chat_store.get_messages(ctx.client, conversation_id)
    return ConversationDetail(
        conversation=_summary(row), messages=[_message(m) for m in messages]
    )


@router.patch("/conversations/{conversation_id}", response_model=ConversationSummary)
def rename_conversation(
    conversation_id: str,
    body: RenameConversationRequest,
    ctx: ChatCtx = Depends(get_chat_ctx),
) -> ConversationSummary:
    _require_owned(ctx, conversation_id)
    updated = chat_store.update_conversation(
        ctx.client, conversation_id, title=body.title.strip()
    )
    return _summary(updated)  # type: ignore[arg-type]


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(conversation_id: str, ctx: ChatCtx = Depends(get_chat_ctx)) -> None:
    _require_owned(ctx, conversation_id)
    chat_store.delete_conversation(ctx.client, conversation_id)


# ── Send / Retry / End (US2, US4, US5 — orchestrated) ──────────────────────


@router.post("/conversations/{conversation_id}/messages", response_model=SendMessageResponse)
async def send_message(
    conversation_id: str,
    body: SendMessageRequest,
    ctx: ChatCtx = Depends(get_chat_ctx),
) -> SendMessageResponse:
    from ..services import chat_orchestrator  # lazy: orchestration layer

    _require_owned(ctx, conversation_id)
    try:
        return await chat_orchestrator.send_message(
            client=ctx.client,
            user_id=ctx.user_id,
            conversation_id=conversation_id,
            content=body.content,
            llm=get_llm_client(),
        )
    except chat_orchestrator.ConversationBusyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="conversation_busy"
        ) from None


@router.post("/conversations/{conversation_id}/retry", response_model=SendMessageResponse)
async def retry_assistant(
    conversation_id: str, ctx: ChatCtx = Depends(get_chat_ctx)
) -> SendMessageResponse:
    from ..services import chat_orchestrator

    _require_owned(ctx, conversation_id)
    try:
        return await chat_orchestrator.retry_assistant(
            client=ctx.client,
            user_id=ctx.user_id,
            conversation_id=conversation_id,
            llm=get_llm_client(),
        )
    except chat_orchestrator.ConversationBusyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="conversation_busy"
        ) from None


@router.post("/conversations/{conversation_id}/end", response_model=EndConversationResponse)
async def end_conversation(
    conversation_id: str, ctx: ChatCtx = Depends(get_chat_ctx)
) -> EndConversationResponse:
    from ..services import chat_orchestrator

    _require_owned(ctx, conversation_id)
    try:
        return await chat_orchestrator.end_conversation(
            client=ctx.client,
            user_id=ctx.user_id,
            conversation_id=conversation_id,
            llm=get_llm_client(),
        )
    except chat_orchestrator.ConversationBusyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="conversation_busy"
        ) from None
