"""T071 — opportunistic recent-video context + no fusion (FR-047/048/049/050)."""

from __future__ import annotations

import pytest

from app.services import chat_orchestrator
from tests.chat_fakes import FakeChatClient, FakeLLM


@pytest.fixture(autouse=True)
def _reset_state():
    chat_orchestrator._conversation_locks.clear()
    chat_orchestrator._rate_state.clear()
    yield


def _conv(message_count=0):
    return {
        "id": "conv1", "user_id": "u1", "state": "open", "title": None,
        "rollup_band": None, "message_count": message_count, "last_message_at": None,
        "created_at": "2026-06-28T00:00:00+00:00", "updated_at": "2026-06-28T00:00:00+00:00",
    }


async def _send(client, llm):
    return await chat_orchestrator.send_message(
        client=client, user_id="u1", conversation_id="conv1", content="hey", llm=llm
    )


async def test_opener_uses_a_recent_video_read():
    client = FakeChatClient(conversation=_conv(0), recent_band="a_little_tense")
    llm = FakeLLM()
    await _send(client, llm)
    ren_system = llm.messages_for("ren")[0].content
    assert "a little uneasy" in ren_system  # the calm, hedged recent-read note


async def test_no_recent_read_means_no_opener_note():
    client = FakeChatClient(conversation=_conv(0), recent_band=None)
    llm = FakeLLM()
    await _send(client, llm)
    ren_system = llm.messages_for("ren")[0].content
    assert "quiet check-in" not in ren_system
    assert "{recent_read_line}" not in ren_system  # placeholder substituted, not left raw


async def test_recent_read_only_on_the_first_message():
    client = FakeChatClient(conversation=_conv(3), recent_band="tense")  # not the first turn
    llm = FakeLLM()
    await _send(client, llm)
    ren_system = llm.messages_for("ren")[0].content
    assert "quiet check-in" not in ren_system


async def test_video_band_does_not_fuse_into_the_chat_rollup():
    # Fifth message → rollup. Recent video says "tense" but the rollup lands "at_ease":
    # the chat band is the rollup's, never an average/fusion with the video read.
    client = FakeChatClient(conversation=_conv(4), recent_band="tense")
    llm = FakeLLM(rollup='{"band": "at_ease", "crisis": false}')
    r = await _send(client, llm)
    assert r.rollup_band == "at_ease"
    assert client.conversation["rollup_band"] == "at_ease"
