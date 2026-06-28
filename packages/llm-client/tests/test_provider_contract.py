"""T013 — app/test code drives the boundary with a fake, no vendor SDK (Principle IV)."""

from __future__ import annotations

import sys

from llm_client.provider import LLMMessage, LLMProvider, LLMRequest


def test_fake_provider_satisfies_the_protocol_structurally(make_fake_provider):
    fake = make_fake_provider(contents=["hello"])
    # runtime_checkable Protocol: a stand-in conforms by shape, no inheritance.
    assert isinstance(fake, LLMProvider)


async def test_fake_provider_returns_a_well_formed_response(make_fake_provider):
    fake = make_fake_provider(name="groq", contents=["hi there"])
    resp = await fake.complete(
        LLMRequest(messages=[LLMMessage(role="user", content="hey")])
    )
    assert resp.provider == "groq"
    assert resp.content == "hi there"
    assert resp.finish_reason == "stop"
    assert isinstance(resp.latency_ms, int)
    # the request reached the provider unchanged
    assert fake.calls and fake.calls[0].messages[0].content == "hey"


def test_importing_the_boundary_pulls_no_vendor_sdk():
    # Importing the package must not drag in a vendor SDK — the boundary talks to
    # OpenAI-compatible endpoints over httpx only (Principle IV).
    import llm_client  # noqa: F401

    assert "groq" not in sys.modules
    assert "openai" not in sys.modules
