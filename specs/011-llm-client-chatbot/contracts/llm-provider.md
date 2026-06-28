# Contract: LLMProvider Interface

## Purpose

All LLM calls go through `packages/llm-client`. Application code must not import vendor SDKs directly.

## Python Protocol

```python
from dataclasses import dataclass
from typing import Literal, Protocol

LLMProviderName = Literal["groq", "lm_studio"]
LLMRole = Literal["system", "user", "assistant"]

@dataclass(frozen=True)
class LLMMessage:
    role: LLMRole
    content: str

@dataclass(frozen=True)
class LLMRequest:
    messages: list[LLMMessage]
    temperature: float | None = None
    max_tokens: int | None = None
    response_format: Literal["text", "json_object"] = "text"
    reasoning_effort: Literal["low", "medium", "high"] | None = None
    timeout_ms: int | None = None

@dataclass(frozen=True)
class LLMResponse:
    provider: LLMProviderName
    model: str
    content: str
    finish_reason: Literal["stop", "length", "tool_calls", "content_filter", "error"]
    latency_ms: int

class LLMProvider(Protocol):
    name: LLMProviderName

    async def complete(self, request: LLMRequest) -> LLMResponse:
        ...
```

## Provider Selection

- Primary: Groq `openai/gpt-oss-120b`, `reasoning_effort=low`.
- Fallback: LM Studio `openai/gpt-oss-20b`.
- Default behavior: fail-clean when primary is unavailable.
- Silent fallback: allowed only behind an explicit configuration flag.

## Prompt Loading

Only these prompt ids are valid in 011:

- `ren`
- `ren_preference_block`
- `scorer_per_message`
- `scorer_rollup`
- `auto_title`

Prompt text loads from `packages/llm-client/prompts/<id>`. Inline prompt strings in app call sites are forbidden.

## Telemetry

Allowed telemetry fields:

- request outcome
- provider used
- latency bucket
- retry count
- validation failure type

Forbidden telemetry fields:

- message text
- prompt text
- crisis booleans
- stress bands
- resource-panel events
- provider hidden reasoning
