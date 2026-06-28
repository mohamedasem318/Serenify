"""Groq primary provider adapter (FR-002, Principle IV).

Groq exposes an OpenAI-compatible `/chat/completions` endpoint, so this is a thin
wrapper over `OpenAICompatProvider`. Model `openai/gpt-oss-120b` at
`reasoning_effort="low"` come from config. Requires an API key (fail-clean if absent).
"""

from __future__ import annotations

import httpx

from ._openai_compat import OpenAICompatProvider
from .config import ProviderEndpoint


class GroqProvider(OpenAICompatProvider):
    def __init__(
        self,
        endpoint: ProviderEndpoint,
        *,
        request_timeout_ms: int = 20000,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        super().__init__(
            endpoint,
            request_timeout_ms=request_timeout_ms,
            client=client,
            require_api_key=True,
        )
