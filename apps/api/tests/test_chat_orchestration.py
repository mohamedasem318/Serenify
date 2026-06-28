"""T042 — send orchestration: parallel Ren/scorer, no steering, retry path,
per-conversation lock, and no per-message score persistence (FR-023/024/032a/026/053)."""

from __future__ import annotations

import pytest
from llm_client import LLMProviderError

from app.services import chat_orchestrator
from tests.chat_fakes import FakeChatClient, FakeLLM


@pytest.fixture(autouse=True)
def _reset_state():
    chat_orchestrator._conversation_locks.clear()
    chat_orchestrator._rate_state.clear()
    yield


async def _send(client, llm, *, content="hi", user="u1", conv="conv1"):
    return await chat_orchestrator.send_message(
        client=client, user_id=user, conversation_id=conv, content=content, llm=llm
    )


async def test_ren_and_scorer_run_in_parallel():
    llm = FakeLLM()
    await _send(FakeChatClient(), llm)
    kinds = [k for k, _ in llm.requests]
    assert "ren" in kinds and "scorer" in kinds


async def test_scorer_output_never_steers_ren():
    llm = FakeLLM(scorer='{"band": "tense", "crisis": false}', ren="What's been heaviest?")
    await _send(FakeChatClient(), llm)
    ren_messages = llm.messages_for("ren")
    assert ren_messages and ren_messages[0].role == "system"
    # No scorer JSON leaks into Ren's inputs.
    for m in ren_messages:
        assert '"band"' not in m.content and '"crisis"' not in m.content


async def test_ren_failure_preserves_user_message_then_retry_recovers():
    client = FakeChatClient()
    down = FakeLLM(ren=LLMProviderError("down", provider="groq", retryable=False))
    r1 = await _send(client, down, content="I'm swamped")
    assert r1.outcome == "assistant_failed"
    assert r1.user_message is not None and r1.user_message.content == "I'm swamped"
    assert [m["role"] for m in client.messages] == ["user"]  # no invented assistant

    ok = FakeLLM(ren="I'm here. What's piling up?")
    r2 = await chat_orchestrator.retry_assistant(
        client=client, user_id="u1", conversation_id="conv1", llm=ok
    )
    assert r2.outcome == "ok"
    assert r2.assistant_message is not None
    assert [m["role"] for m in client.messages] == ["user", "assistant"]


async def test_scorer_failure_still_shows_ren_reply():
    client = FakeChatClient()
    llm = FakeLLM(ren="That sounds like a lot.", scorer="not json at all")
    r = await _send(client, llm)
    assert r.outcome == "ok"
    assert r.assistant_message is not None
    assert r.crisis is None
    # The malformed scorer was recorded as a validation failure (privacy-safe).
    assert llm.validation_failures == ["not_json"]


async def test_concurrent_send_is_locked_per_conversation():
    client = FakeChatClient()
    lock = chat_orchestrator._conversation_lock("conv1")
    await lock.acquire()
    try:
        with pytest.raises(chat_orchestrator.ConversationBusyError):
            await _send(client, FakeLLM())
    finally:
        lock.release()


async def test_no_per_message_band_or_crisis_persisted():
    client = FakeChatClient()
    await _send(client, FakeLLM(scorer='{"band": "tense", "crisis": false}'))
    # First turn: conversation keeps no per-message band and no crisis field.
    assert client.conversation["rollup_band"] is None
    assert "crisis" not in client.conversation
    # Stored messages carry only text — no band/crisis columns.
    expected = {"id", "conversation_id", "user_id", "role", "content", "created_at"}
    for m in client.messages:
        assert set(m.keys()) == expected
