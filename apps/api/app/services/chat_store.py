"""Employee-private chat persistence — RLS-as-the-user, NO service-role (FR-021/022).

Every function takes a user-context PostgREST `Client` (built by
`app.supabase_user.user_client` from the forwarded JWT + publishable anon key), so
Postgres resolves `auth.uid()` to the caller and the owner-only RLS policies are the
control. There is no service-role path here. Mirrors the module-level style of
`app.supabase_user`.

Nothing in this layer stores crisis state, per-message bands, raw scorer JSON, or
prompt text — those columns do not exist (migration 20260628000000).
"""

from __future__ import annotations

from typing import Any

from supabase import Client

CONVERSATIONS_TABLE = "chat_conversations"
MESSAGES_TABLE = "chat_messages"

_CONVERSATION_COLS = (
    "id, user_id, state, title, rollup_band, message_count, "
    "last_message_at, created_at, updated_at"
)
_MESSAGE_COLS = "id, conversation_id, user_id, role, content, created_at"


def insert_conversation(client: Client, *, user_id: str) -> dict[str, Any]:
    """Create an open conversation owned by the caller (RLS insert-own)."""
    resp = (
        client.table(CONVERSATIONS_TABLE)
        .insert({"user_id": user_id, "state": "open", "message_count": 0})
        .execute()
    )
    return resp.data[0]


def list_conversations(client: Client, *, limit: int = 50) -> list[dict[str, Any]]:
    """The caller's conversations, most-recently-active first (RLS select-own)."""
    resp = (
        client.table(CONVERSATIONS_TABLE)
        .select(_CONVERSATION_COLS)
        .order("updated_at", desc=True)
        .limit(limit)
        .execute()
    )
    return resp.data or []


def get_conversation(client: Client, conversation_id: str) -> dict[str, Any] | None:
    """One owned conversation, or ``None`` if not visible to the caller."""
    resp = (
        client.table(CONVERSATIONS_TABLE)
        .select(_CONVERSATION_COLS)
        .eq("id", conversation_id)
        .execute()
    )
    return resp.data[0] if resp.data else None


def get_current_conversation(client: Client) -> dict[str, Any] | None:
    """The caller's most-recently-active OPEN conversation (the pill's "current chat").

    A finalized conversation is NEVER "current": the end/finalize path sets
    ``state='ended'`` (orchestrator auto-title + rollup lock), and once ended a
    conversation drops out of this lookup. The endpoint then returns nothing, so any
    surface (pill, page, after a navigation/remount) opens a FRESH chat rather than
    resuming the just-ended one. An unfinished (``state='open'``) conversation still
    resumes normally. Equality on `state` rides the
    `chat_conversations_user_state_updated_idx` index (migration 20260628000000)."""
    resp = (
        client.table(CONVERSATIONS_TABLE)
        .select(_CONVERSATION_COLS)
        .eq("state", "open")
        .order("updated_at", desc=True)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


def update_conversation(
    client: Client, conversation_id: str, **fields: Any
) -> dict[str, Any] | None:
    """Update an owned conversation's fields (RLS update-own). Returns the row."""
    resp = (
        client.table(CONVERSATIONS_TABLE)
        .update(fields)
        .eq("id", conversation_id)
        .execute()
    )
    return resp.data[0] if resp.data else None


def delete_conversation(client: Client, conversation_id: str) -> None:
    """Hard delete an owned conversation; messages cascade (ON DELETE CASCADE)."""
    client.table(CONVERSATIONS_TABLE).delete().eq("id", conversation_id).execute()


def get_messages(client: Client, conversation_id: str) -> list[dict[str, Any]]:
    """All messages of an owned conversation, oldest first (transcript order)."""
    resp = (
        client.table(MESSAGES_TABLE)
        .select(_MESSAGE_COLS)
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .execute()
    )
    return resp.data or []


def insert_message(
    client: Client, *, conversation_id: str, user_id: str, role: str, content: str
) -> dict[str, Any]:
    """Persist one message (RLS insert-own; insert WITH CHECK also requires an owned
    conversation). `content` is the full text AFTER control tokens are stripped."""
    resp = (
        client.table(MESSAGES_TABLE)
        .insert(
            {
                "conversation_id": conversation_id,
                "user_id": user_id,
                "role": role,
                "content": content,
            }
        )
        .execute()
    )
    return resp.data[0]


def count_user_messages_since(client: Client, *, user_id: str, since_iso: str) -> int:
    """How many user messages the caller has sent since `since_iso` — the per-employee
    rate-limit window count (FR-059). Counts only role='user' rows."""
    resp = (
        client.table(MESSAGES_TABLE)
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("role", "user")
        .gte("created_at", since_iso)
        .execute()
    )
    return resp.count or 0
