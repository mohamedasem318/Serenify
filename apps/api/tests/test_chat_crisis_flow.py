"""T050 — crisis live flow: scorer flag and Ren [CRISIS] both trigger the panel;
the control token is stripped; numbers come only from the verified table; nothing is
persisted (FR-033/034/035/041)."""

from __future__ import annotations

import pytest

from app.services import chat_orchestrator
from tests.chat_fakes import FakeChatClient, FakeLLM


@pytest.fixture(autouse=True)
def _reset_state():
    chat_orchestrator._conversation_locks.clear()
    chat_orchestrator._rate_state.clear()
    yield


async def _send(client, llm, content="I can't do this anymore"):
    return await chat_orchestrator.send_message(
        client=client, user_id="u1", conversation_id="conv1", content=content, llm=llm
    )


async def test_scorer_crisis_flag_triggers_panel():
    client = FakeChatClient()  # country None → universal line only
    llm = FakeLLM(scorer='{"band": "tense", "crisis": true}', ren="I'm really glad you told me.")
    r = await _send(client, llm)
    assert r.crisis is not None
    assert r.crisis.universal_line
    assert r.crisis.resources == []


async def test_ren_crisis_token_triggers_panel_and_is_stripped():
    client = FakeChatClient()
    llm = FakeLLM(ren="Glad you told me.\n[CRISIS]", scorer='{"band": "tense", "crisis": false}')
    r = await _send(client, llm)
    assert r.crisis is not None
    # token never shown or stored
    assert "[CRISIS]" not in r.assistant_message.content
    assert all("[CRISIS]" not in m["content"] for m in client.messages)


async def test_crisis_numbers_come_from_the_verified_table_not_the_model():
    client = FakeChatClient(profile={"full_name": "Sam", "country": "EG"})
    # Even if Ren's text contained a number, the panel is built ONLY from the table.
    llm = FakeLLM(ren="please reach out", scorer='{"band": "tense", "crisis": true}')
    r = await _send(client, llm)
    assert r.crisis is not None
    assert [row.number for row in r.crisis.resources] == ["16328"]
    assert r.crisis.emergency_number == "123"


async def test_unsupported_country_still_shows_universal_line():
    client = FakeChatClient(profile={"full_name": "Sam", "country": None})
    r = await _send(client, FakeLLM(scorer='{"band": "tense", "crisis": true}'))
    assert r.crisis is not None
    assert r.crisis.resources == []
    assert r.crisis.universal_line  # never blank


async def test_missing_country_column_is_tolerated():
    client = FakeChatClient(profile={"full_name": "Sam"}, country_column_exists=False)
    r = await _send(client, FakeLLM(scorer='{"band": "tense", "crisis": true}'))
    assert r.crisis is not None
    assert r.crisis.resources == []


async def test_crisis_is_not_persisted():
    client = FakeChatClient()
    llm = FakeLLM(scorer='{"band": "tense", "crisis": true}', ren="I hear you.\n[CRISIS]")
    await _send(client, llm)
    # No crisis field on the conversation; no per-message band stored either.
    assert "crisis" not in client.conversation
    assert client.conversation["rollup_band"] is None
    for m in client.messages:
        assert "crisis" not in m and "band" not in m
