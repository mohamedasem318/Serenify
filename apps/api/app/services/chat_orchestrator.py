"""Chat orchestration — Ren + scorer, rollup, auto-title (FR-023–032b, 045–059;
contract: orchestration.md). Prompts are loaded by id from `llm_client` (never
inlined). Crisis is live-only and never persisted. Per-message scores are never
persisted. Chat bands are written only to chat_conversations.
"""

from __future__ import annotations

import asyncio
import time
from datetime import UTC, datetime, timedelta
from typing import Any

from llm_client import (
    LLMMessage,
    LLMProviderError,
    LLMRequest,
    ScorerValidationError,
    parse_scorer,
    render_prompt,
    rollup_band,
)
from supabase import Client

from ..schemas import (
    ChatMessageOut,
    ConversationSummary,
    CrisisPanel,
    EndConversationResponse,
    SendMessageResponse,
)
from . import chat_store, chat_video_context, crisis_resources
from .llm_client import LLMClient

# ── tuning constants ────────────────────────────────────────────────────
_ROLLUP_EVERY = 5  # every fifth USER message (FR-027)
_SCORER_CONTEXT_MESSAGES = 5  # current user message + previous two complete turns (FR-025)
_MODEL_INPUT_MAX_MESSAGES = 24  # sliding-window guard for Ren input (FR-055)
_ROLLUP_INPUT_MAX_MESSAGES = 60  # fresh whole-conversation rollup, bounded (no summarization)
_RECENT_READ_LOOKBACK_DAYS = 3  # "today / last few days" shallow recent read (FR-047)

# rate limit (FR-059): per-employee chat send window.
_RATE_WINDOW_SECONDS = 60.0
_RATE_MAX_SENDS = 20

_CRISIS_TOKEN = "[CRISIS]"
_END_TOKEN = "[END]"

# in-memory state (graduation scale: one process, one user at a time).
_conversation_locks: dict[str, asyncio.Lock] = {}
_rate_state: dict[str, list[float]] = {}


class ConversationBusyError(Exception):
    """A send is already in flight for this conversation (FR-032a). The router turns
    this into 409; the UI's send-lock normally prevents it."""


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _conversation_lock(conversation_id: str) -> asyncio.Lock:
    return _conversation_locks.setdefault(conversation_id, asyncio.Lock())


def _rate_limited(user_id: str) -> bool:
    """True if the caller has exceeded the send window. Allowed sends are recorded;
    blocked attempts are NOT counted (FR-059)."""
    now = time.monotonic()
    window = [t for t in _rate_state.get(user_id, []) if now - t < _RATE_WINDOW_SECONDS]
    if len(window) >= _RATE_MAX_SENDS:
        _rate_state[user_id] = window
        return True
    window.append(now)
    _rate_state[user_id] = window
    return False


# ── control tokens ────────────────────────────────────────────────────────


def _parse_control_tokens(text: str) -> tuple[str, bool, bool]:
    """Strip Ren's silent [CRISIS]/[END] control tokens; report whether each fired.
    Tokens are never shown to the user or persisted (FR-034)."""
    had_crisis = _CRISIS_TOKEN in text
    had_end = _END_TOKEN in text
    cleaned = text.replace(_CRISIS_TOKEN, "").replace(_END_TOKEN, "")
    cleaned = "\n".join(line.rstrip() for line in cleaned.splitlines()).strip()
    return cleaned, had_crisis, had_end


# ── mappers ────────────────────────────────────────────────────────────────


def _summary(row: dict[str, Any]) -> ConversationSummary:
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


def _message_out(row: dict[str, Any]) -> ChatMessageOut:
    return ChatMessageOut(
        id=str(row["id"]),
        role=row["role"],
        content=row["content"],
        created_at=row["created_at"],
    )


def _to_llm_messages(rows: list[dict[str, Any]]) -> list[LLMMessage]:
    return [LLMMessage(role=r["role"], content=r["content"]) for r in rows]


def _window(rows: list[dict[str, Any]], max_n: int) -> list[dict[str, Any]]:
    """Most-recent `max_n` messages. The sliding-window guard (FR-055): persisted
    history stays intact; only the MODEL INPUT is trimmed, oldest first. No
    summarization (FR-056)."""
    return rows[-max_n:] if len(rows) > max_n else rows


# ── profile context ─────────────────────────────────────────────────────────


def _first_name(client: Client, user_id: str) -> str:
    try:
        resp = client.table("profiles").select("full_name").eq("id", user_id).execute()
        full = (resp.data[0]["full_name"] if resp.data else None) or ""
    except Exception:
        full = ""
    first = full.strip().split(" ")[0] if full.strip() else ""
    return first or "there"


def _country(client: Client, user_id: str) -> str | None:
    """Best-effort employee country. Profiles may not carry a country column yet; any
    failure means "unknown" → the crisis panel shows the universal line only (FR-040)."""
    try:
        resp = client.table("profiles").select("country").eq("id", user_id).execute()
    except Exception:
        return None
    if not resp.data:
        return None
    return resp.data[0].get("country")


# ── prompt assembly ──────────────────────────────────────────────────────────


def _ren_messages(
    *, first_name: str, recent_read_line: str, transcript: list[dict[str, Any]]
) -> list[LLMMessage]:
    # 011: preferences seam is empty (FR-009) → {preferences} renders to "".
    system = render_prompt(
        "ren",
        user_first_name=first_name,
        recent_read_line=recent_read_line,
        preferences="",
    )
    history = _to_llm_messages(_window(transcript, _MODEL_INPUT_MAX_MESSAGES))
    return [LLMMessage(role="system", content=system), *history]


def _scorer_messages(transcript: list[dict[str, Any]]) -> list[LLMMessage]:
    system = render_prompt("scorer_per_message")
    tail = _to_llm_messages(_window(transcript, _SCORER_CONTEXT_MESSAGES))
    return [LLMMessage(role="system", content=system), *tail]


def _rollup_messages(transcript: list[dict[str, Any]]) -> list[LLMMessage]:
    system = render_prompt("scorer_rollup")
    body = _to_llm_messages(_window(transcript, _ROLLUP_INPUT_MAX_MESSAGES))
    return [LLMMessage(role="system", content=system), *body]


def _title_messages(transcript: list[dict[str, Any]]) -> list[LLMMessage]:
    system = render_prompt("auto_title")
    body = _to_llm_messages(_window(transcript, _ROLLUP_INPUT_MAX_MESSAGES))
    return [LLMMessage(role="system", content=system), *body]


# ── LLM steps ────────────────────────────────────────────────────────────────


async def _run_ren(llm: LLMClient, messages: list[LLMMessage]) -> str:
    resp = await llm.complete(LLMRequest(messages=messages, response_format="text"))
    return resp.content


async def _run_scorer(llm: LLMClient, messages: list[LLMMessage]) -> bool:
    """Return the live crisis flag. Band is computed but discarded (never persisted,
    FR-026). Validation failures are recorded as telemetry and treated as scorer
    failure (no per-message band) — Ren's [CRISIS] remains the backstop."""
    resp = await llm.complete(LLMRequest(messages=messages, response_format="json_object"))
    try:
        result = parse_scorer(resp.content, require_crisis=True)
    except ScorerValidationError as exc:
        llm.emit_validation_failure(provider=resp.provider, failure=exc.failure_type)
        raise
    return bool(result.crisis)


async def _compute_rollup_band(llm: LLMClient, transcript: list[dict[str, Any]]) -> str:
    """Fresh whole-conversation band. Raises on provider/validation failure. The
    rollup's crisis field is discarded by `rollup_band` (FR-028)."""
    resp = await llm.complete(
        LLMRequest(messages=_rollup_messages(transcript), response_format="json_object")
    )
    try:
        return rollup_band(resp.content)
    except ScorerValidationError as exc:
        llm.emit_validation_failure(provider=resp.provider, failure=exc.failure_type)
        raise


_TITLE_FALLBACK = "A brief check-in"


async def _compute_auto_title(llm: LLMClient, transcript: list[dict[str, Any]]) -> str:
    resp = await llm.complete(
        LLMRequest(messages=_title_messages(transcript), response_format="text")
    )
    return _clean_title(resp.content)


def _clean_title(raw: str) -> str:
    title = raw.strip().splitlines()[0].strip() if raw.strip() else ""
    title = title.strip('"').strip("'").rstrip(".").strip()
    return title or _TITLE_FALLBACK


# ── public orchestration ─────────────────────────────────────────────────────


async def send_message(
    *, client: Client, user_id: str, conversation_id: str, content: str, llm: LLMClient
) -> SendMessageResponse:
    text = content.strip()
    lock = _conversation_lock(conversation_id)
    if lock.locked():
        raise ConversationBusyError()

    async with lock:
        # 1. rate limit — blocked attempts persist nothing (FR-059).
        if _rate_limited(user_id):
            return SendMessageResponse(outcome="rate_limited", retry_after_seconds=10)

        # 2. persist the user message (source of truth, FR-020).
        user_row = await asyncio.to_thread(
            chat_store.insert_message,
            client,
            conversation_id=conversation_id,
            user_id=user_id,
            role="user",
            content=text,
        )

        # conversation bookkeeping: message_count is the USER-message count (cadence).
        conv = await asyncio.to_thread(chat_store.get_conversation, client, conversation_id)
        new_count = (conv.get("message_count", 0) if conv else 0) + 1

        # opener context (FR-047): only on the first user message, from a recent read.
        recent_line = ""
        if new_count <= 1:
            since = (
                datetime.now(UTC) - timedelta(days=_RECENT_READ_LOOKBACK_DAYS)
            ).isoformat()
            band = await asyncio.to_thread(
                chat_video_context.recent_read_band, client, since_iso=since
            )
            recent_line = chat_video_context.recent_read_line(band)

        first_name = await asyncio.to_thread(_first_name, client, user_id)
        transcript = await asyncio.to_thread(chat_store.get_messages, client, conversation_id)

        # 3+4+5. Ren and the scorer run in PARALLEL; the scorer never steers Ren (FR-024).
        ren_msgs = _ren_messages(
            first_name=first_name, recent_read_line=recent_line, transcript=transcript
        )
        scorer_msgs = _scorer_messages(transcript)
        ren_out, scorer_out = await asyncio.gather(
            _run_ren(llm, ren_msgs),
            _run_scorer(llm, scorer_msgs),
            return_exceptions=True,
        )

        scorer_crisis = scorer_out is True  # exception/None → no per-message band

        # Ren failure → do not invent a reply; preserve the typed message for retry.
        if isinstance(ren_out, BaseException):
            updated = await asyncio.to_thread(
                chat_store.update_conversation,
                client,
                conversation_id,
                message_count=new_count,
                last_message_at=_now_iso(),
                updated_at=_now_iso(),
            )
            return SendMessageResponse(
                outcome="assistant_failed",
                user_message=_message_out(user_row),
                conversation=_summary(updated) if updated else None,
            )

        # 6. strip control tokens; 7. persist assistant text.
        clean_text, ren_crisis, ren_end = _parse_control_tokens(str(ren_out))
        assistant_row = await asyncio.to_thread(
            chat_store.insert_message,
            client,
            conversation_id=conversation_id,
            user_id=user_id,
            role="assistant",
            content=clean_text,
        )

        # 8. crisis is LIVE-only: scorer flag OR Ren [CRISIS]. Never persisted.
        crisis_panel: CrisisPanel | None = None
        if scorer_crisis or ren_crisis:
            country = await asyncio.to_thread(_country, client, user_id)
            crisis_panel = crisis_resources.build_panel(country)

        # rollup cadence: every fifth user message, plus the [END] farewell path.
        transcript_after = await asyncio.to_thread(
            chat_store.get_messages, client, conversation_id
        )
        rollup_value: str | None = None
        ended = False
        title: str | None = conv.get("title") if conv else None

        if ren_end:
            # Ren said goodbye → end flow (rollup + title). Failure keeps it open.
            try:
                rollup_value = await _compute_rollup_band(llm, transcript_after)
                if not title:
                    title = await _compute_auto_title(llm, transcript_after)
                ended = True
            except (LLMProviderError, ScorerValidationError):
                ended = False  # stay open; the farewell still shows
        elif new_count % _ROLLUP_EVERY == 0:
            try:
                rollup_value = await _compute_rollup_band(llm, transcript_after)
            except (LLMProviderError, ScorerValidationError):
                rollup_value = None  # non-fatal on a normal turn

        fields: dict[str, Any] = {
            "message_count": new_count,
            "last_message_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        if rollup_value is not None:
            fields["rollup_band"] = rollup_value
        if ended:
            fields["state"] = "ended"
            if title:
                fields["title"] = title
        updated = await asyncio.to_thread(
            chat_store.update_conversation, client, conversation_id, **fields
        )

        return SendMessageResponse(
            outcome="ok",
            user_message=_message_out(user_row),
            assistant_message=_message_out(assistant_row),
            crisis=crisis_panel,
            rollup_band=rollup_value,
            conversation=_summary(updated) if updated else None,
        )


async def retry_assistant(
    *, client: Client, user_id: str, conversation_id: str, llm: LLMClient
) -> SendMessageResponse:
    """Re-run Ren (+scorer) for the latest user turn that has no assistant reply —
    retry without retyping (FR-052). Adds no new user message and no rollup."""
    lock = _conversation_lock(conversation_id)
    if lock.locked():
        raise ConversationBusyError()

    async with lock:
        transcript = await asyncio.to_thread(chat_store.get_messages, client, conversation_id)
        if not transcript:
            return SendMessageResponse(outcome="assistant_failed")
        if transcript[-1]["role"] == "assistant":
            # Nothing to retry — the turn already has a reply (idempotent).
            return SendMessageResponse(
                outcome="ok", assistant_message=_message_out(transcript[-1])
            )

        first_name = await asyncio.to_thread(_first_name, client, user_id)
        ren_msgs = _ren_messages(
            first_name=first_name, recent_read_line="", transcript=transcript
        )
        scorer_msgs = _scorer_messages(transcript)
        ren_out, scorer_out = await asyncio.gather(
            _run_ren(llm, ren_msgs),
            _run_scorer(llm, scorer_msgs),
            return_exceptions=True,
        )

        if isinstance(ren_out, BaseException):
            return SendMessageResponse(outcome="assistant_failed")

        clean_text, ren_crisis, _ren_end = _parse_control_tokens(str(ren_out))
        assistant_row = await asyncio.to_thread(
            chat_store.insert_message,
            client,
            conversation_id=conversation_id,
            user_id=user_id,
            role="assistant",
            content=clean_text,
        )
        crisis_panel: CrisisPanel | None = None
        if scorer_out is True or ren_crisis:
            country = await asyncio.to_thread(_country, client, user_id)
            crisis_panel = crisis_resources.build_panel(country)

        await asyncio.to_thread(
            chat_store.update_conversation,
            client,
            conversation_id,
            updated_at=_now_iso(),
        )
        return SendMessageResponse(
            outcome="ok",
            assistant_message=_message_out(assistant_row),
            crisis=crisis_panel,
        )


async def end_conversation(
    *, client: Client, user_id: str, conversation_id: str, llm: LLMClient
) -> EndConversationResponse:
    """Explicit [END]: fresh rollup + auto-title, then mark ended. If either fails
    after retry, keep the conversation OPEN with a retry state (FR-032b)."""
    lock = _conversation_lock(conversation_id)
    if lock.locked():
        raise ConversationBusyError()

    async with lock:
        conv = await asyncio.to_thread(chat_store.get_conversation, client, conversation_id)
        transcript = await asyncio.to_thread(chat_store.get_messages, client, conversation_id)
        try:
            band = await _compute_rollup_band(llm, transcript)
            title = conv.get("title") if conv else None
            if not title:
                title = await _compute_auto_title(llm, transcript)
        except (LLMProviderError, ScorerValidationError):
            # Not marked ended; the conversation stays usable with a retry state.
            return EndConversationResponse(
                outcome="retry",
                conversation=_summary(conv) if conv else None,
            )

        updated = await asyncio.to_thread(
            chat_store.update_conversation,
            client,
            conversation_id,
            state="ended",
            rollup_band=band,
            title=title,
            updated_at=_now_iso(),
        )
        return EndConversationResponse(
            outcome="ended", conversation=_summary(updated) if updated else None
        )
