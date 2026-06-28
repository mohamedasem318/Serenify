"""T058 — Ren behavior is governed by the LOCKED prompt, not app code.

The qualitative rubric (listen-first, one concrete suggestion, professional-care
refusal) is human-validated against the model in smoke-tests.md (SC-013). These unit
tests assert the structural guarantees the app is responsible for: Ren runs from the
file-backed prompt verbatim, and the app neither truncates nor rewrites the reply.
"""

from __future__ import annotations

import pytest
from llm_client import render_prompt

from app.services import chat_orchestrator
from tests.chat_fakes import FakeChatClient, FakeLLM


@pytest.fixture(autouse=True)
def _reset_state():
    chat_orchestrator._conversation_locks.clear()
    chat_orchestrator._rate_state.clear()
    yield


async def test_ren_system_message_is_the_rendered_locked_prompt():
    client = FakeChatClient(profile={"full_name": "Sam Lee", "country": None})
    llm = FakeLLM(ren="Try one small thing — a short walk.")
    await chat_orchestrator.send_message(
        client=client, user_id="u1", conversation_id="conv1", content="what should I do?", llm=llm
    )
    ren_system = llm.messages_for("ren")[0].content
    # Behavior comes from the file, not inlined app strings.
    assert ren_system == render_prompt(
        "ren", user_first_name="Sam", recent_read_line="", preferences=""
    )


async def test_api_does_not_rewrite_or_truncate_rens_reply():
    client = FakeChatClient()
    reply = "Here's one idea; want to talk it through more first?"
    llm = FakeLLM(ren=reply)
    r = await chat_orchestrator.send_message(
        client=client, user_id="u1", conversation_id="conv1", content="help", llm=llm
    )
    assert r.assistant_message.content == reply
