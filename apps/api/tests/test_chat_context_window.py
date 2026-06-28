"""T044a — FR-055 sliding-window context guard: under context pressure the model
input keeps the system prompt + most-recent turns and drops oldest turns; persisted
history is untouched; the conversation is never summarized (FR-056)."""

from __future__ import annotations

import pytest

from app.services import chat_orchestrator
from app.services.chat_orchestrator import _MODEL_INPUT_MAX_MESSAGES
from tests.chat_fakes import FakeChatClient, FakeLLM


@pytest.fixture(autouse=True)
def _reset_state():
    chat_orchestrator._conversation_locks.clear()
    chat_orchestrator._rate_state.clear()
    yield


def _big_history(client: FakeChatClient, n: int) -> None:
    for i in range(n):
        client.messages.append(
            {
                "id": f"old{i}",
                "conversation_id": "conv1",
                "user_id": "u1",
                "role": "user" if i % 2 == 0 else "assistant",
                "content": f"old-{i}",
                "created_at": f"2026-06-01T00:00:{i:02d}+00:00",
            }
        )


async def test_model_input_is_windowed_but_history_is_intact():
    client = FakeChatClient()
    _big_history(client, 40)
    # user-message count well past the rollup cadence boundary but not ON it.
    client.conversation["message_count"] = 20

    llm = FakeLLM()
    await chat_orchestrator.send_message(
        client=client, user_id="u1", conversation_id="conv1", content="newest", llm=llm
    )

    ren_messages = llm.messages_for("ren")
    # system prompt is always kept; the rest is capped at the window size.
    assert ren_messages[0].role == "system"
    assert len(ren_messages) <= 1 + _MODEL_INPUT_MAX_MESSAGES
    contents = [m.content for m in ren_messages]
    assert "newest" in contents  # most recent kept
    assert "old-0" not in contents  # oldest dropped from the model input

    # Persisted history is intact: 40 old + 1 user + 1 assistant.
    assert len(client.messages) == 42


async def test_no_summarization_call_is_made():
    client = FakeChatClient()
    _big_history(client, 40)
    client.conversation["message_count"] = 20
    llm = FakeLLM()
    await chat_orchestrator.send_message(
        client=client, user_id="u1", conversation_id="conv1", content="newest", llm=llm
    )
    kinds = [k for k, _ in llm.requests]
    # Only Ren + scorer this turn — no summarize/title pass (not a 5th msg, no [END]).
    assert set(kinds) == {"ren", "scorer"}
