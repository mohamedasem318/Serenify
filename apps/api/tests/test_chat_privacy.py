"""T043 — privacy-safe telemetry: allow-list only; success + validation records carry
no message/prompt/crisis/band content (FR-058, Principle I)."""

from __future__ import annotations

from dataclasses import asdict

from llm_client import LLMCallTelemetry, LLMMessage, LLMRequest
from llm_client.provider import LLMResponse
from llm_client.registry import ProviderCallResult

from app.services import llm_client as llm_mod

_ALLOWED = {
    "outcome", "provider", "latency_bucket", "retry_count", "validation_failure", "used_fallback",
}
_FORBIDDEN = {"message", "content", "prompt", "crisis", "band", "text", "resources", "reasoning"}


class _OkRegistry:
    async def complete(self, request) -> ProviderCallResult:
        return ProviderCallResult(
            response=LLMResponse(
                provider="groq", model="m", content="hi", finish_reason="stop", latency_ms=120
            ),
            used_fallback=False,
        )


def test_telemetry_dataclass_is_allowlist_only():
    fields = set(LLMCallTelemetry.__dataclass_fields__)
    assert fields == _ALLOWED
    assert not (fields & _FORBIDDEN)


async def test_success_emits_only_safe_fields(monkeypatch):
    events: list[LLMCallTelemetry] = []
    monkeypatch.setattr(llm_mod, "emit_telemetry", lambda e: events.append(e))

    client = llm_mod.LLMClient(registry=_OkRegistry())
    await client.complete(LLMRequest(messages=[LLMMessage(role="user", content="secret text")]))

    assert len(events) == 1
    event = events[0]
    assert event.outcome == "success"
    assert event.provider == "groq"
    assert event.retry_count == 0
    assert event.validation_failure == "none"
    # the emitted record contains no content keys
    assert set(asdict(event)) == _ALLOWED


def test_validation_failure_record_has_no_content(monkeypatch):
    events: list[LLMCallTelemetry] = []
    monkeypatch.setattr(llm_mod, "emit_telemetry", lambda e: events.append(e))

    client = llm_mod.LLMClient(registry=_OkRegistry())
    client.emit_validation_failure(provider="groq", failure="invalid_enum")

    assert events[0].outcome == "validation_error"
    assert events[0].validation_failure == "invalid_enum"
    assert set(asdict(events[0])) == _ALLOWED
