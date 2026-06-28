"""The single LLM provider boundary (Constitution Principle IV; contract:
specs/011-llm-client-chatbot/contracts/llm-provider.md).

`LLMProvider` is a structural `Protocol` — app/test code drives any conforming
object (the real Groq/LM Studio adapters or a fake) without importing a vendor SDK.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Protocol, runtime_checkable

LLMProviderName = Literal["groq", "lm_studio"]
LLMRole = Literal["system", "user", "assistant"]
ResponseFormat = Literal["text", "json_object"]
ReasoningEffort = Literal["low", "medium", "high"]
FinishReason = Literal["stop", "length", "tool_calls", "content_filter", "error"]


@dataclass(frozen=True)
class LLMMessage:
    role: LLMRole
    content: str


@dataclass(frozen=True)
class LLMRequest:
    messages: list[LLMMessage] = field(default_factory=list)
    temperature: float | None = None
    max_tokens: int | None = None
    response_format: ResponseFormat = "text"
    reasoning_effort: ReasoningEffort | None = None
    timeout_ms: int | None = None


@dataclass(frozen=True)
class LLMResponse:
    provider: LLMProviderName
    model: str
    content: str
    finish_reason: FinishReason
    latency_ms: int


class LLMProviderError(Exception):
    """Any failure reaching or decoding a provider response. ``retryable`` lets the
    orchestrator decide whether a transient retry (FR-051) makes sense; ``timeout``
    is surfaced separately for privacy-safe telemetry buckets. Carries NO message,
    prompt, or reasoning text — only the operational shape (Principle I)."""

    def __init__(
        self,
        message: str,
        *,
        provider: LLMProviderName | None = None,
        retryable: bool = True,
        timeout: bool = False,
    ) -> None:
        super().__init__(message)
        self.provider = provider
        self.retryable = retryable
        self.timeout = timeout


@runtime_checkable
class LLMProvider(Protocol):
    """One async completion call. Implementations: ``GroqProvider`` (primary),
    ``LMStudioProvider`` (fallback), and test fakes."""

    name: LLMProviderName

    async def complete(self, request: LLMRequest) -> LLMResponse: ...
