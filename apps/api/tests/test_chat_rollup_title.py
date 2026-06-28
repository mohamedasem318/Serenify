"""T062 — rollup cadence + auto-title + end-flow retry (FR-027/028/031/032b)."""

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


def _conv(message_count=0, title=None, state="open"):
    return {
        "id": "conv1",
        "user_id": "u1",
        "state": state,
        "title": title,
        "rollup_band": None,
        "message_count": message_count,
        "last_message_at": None,
        "created_at": "2026-06-28T00:00:00+00:00",
        "updated_at": "2026-06-28T00:00:00+00:00",
    }


async def _send(client, llm):
    return await chat_orchestrator.send_message(
        client=client, user_id="u1", conversation_id="conv1", content="hi", llm=llm
    )


async def test_fifth_user_message_runs_rollup_and_discards_rollup_crisis():
    client = FakeChatClient(conversation=_conv(message_count=4))  # this send → 5th
    llm = FakeLLM(
        ren="ok",
        scorer='{"band": "a_little_tense", "crisis": false}',
        rollup='{"band": "tense", "crisis": true}',  # crisis here must be discarded
    )
    r = await _send(client, llm)
    assert r.rollup_band == "tense"
    assert client.conversation["rollup_band"] == "tense"
    # rollup crisis is discarded — it never drives the panel.
    assert r.crisis is None


async def test_non_fifth_message_does_not_roll_up():
    client = FakeChatClient(conversation=_conv(message_count=1))  # → 2nd
    llm = FakeLLM()
    await _send(client, llm)
    assert client.conversation["rollup_band"] is None
    assert "rollup" not in [k for k, _ in llm.requests]


async def test_end_token_ends_with_rollup_and_calm_title():
    client = FakeChatClient(conversation=_conv())
    llm = FakeLLM(
        ren="Take care of yourself.\n[END]",
        rollup='{"band": "a_little_tense", "crisis": false}',
        title="A heavy week at work",
    )
    r = await _send(client, llm)
    assert client.conversation["state"] == "ended"
    assert client.conversation["title"] == "A heavy week at work"
    assert client.conversation["rollup_band"] == "a_little_tense"
    assert "[END]" not in r.assistant_message.content


async def test_explicit_end_success():
    client = FakeChatClient(conversation=_conv())
    client.messages = [
        {
            "id": "m1", "conversation_id": "conv1", "user_id": "u1",
            "role": "user", "content": "rough night", "created_at": "t1",
        },
    ]
    llm = FakeLLM(rollup='{"band": "tense", "crisis": false}', title="Trouble winding down")
    r = await chat_orchestrator.end_conversation(
        client=client, user_id="u1", conversation_id="conv1", llm=llm
    )
    assert r.outcome == "ended"
    assert client.conversation["state"] == "ended"
    assert client.conversation["title"] == "Trouble winding down"
    assert client.conversation["rollup_band"] == "tense"


async def test_end_keeps_a_user_renamed_title():
    client = FakeChatClient(conversation=_conv(title="My note"))
    llm = FakeLLM(rollup='{"band": "at_ease", "crisis": false}', title="auto title")
    await chat_orchestrator.end_conversation(
        client=client, user_id="u1", conversation_id="conv1", llm=llm
    )
    assert client.conversation["title"] == "My note"  # auto-title does not clobber a rename


async def test_end_flow_rollup_failure_keeps_conversation_open():
    client = FakeChatClient(conversation=_conv())
    llm = FakeLLM(rollup=LLMProviderError("down", provider="groq", retryable=False))
    r = await chat_orchestrator.end_conversation(
        client=client, user_id="u1", conversation_id="conv1", llm=llm
    )
    assert r.outcome == "retry"
    assert client.conversation["state"] == "open"  # not marked ended (FR-032b)


async def test_end_flow_title_failure_keeps_conversation_open():
    client = FakeChatClient(conversation=_conv())
    llm = FakeLLM(
        rollup='{"band": "at_ease", "crisis": false}',
        title=LLMProviderError("down", provider="groq", retryable=False),
    )
    r = await chat_orchestrator.end_conversation(
        client=client, user_id="u1", conversation_id="conv1", llm=llm
    )
    assert r.outcome == "retry"
    assert client.conversation["state"] == "open"
