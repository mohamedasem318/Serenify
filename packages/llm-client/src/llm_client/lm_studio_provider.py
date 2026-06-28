"""LM Studio fallback provider adapter (FR-002, FR-057, Principle IV).

The fallback (`openai/gpt-oss-20b`) is presented through the SAME provider boundary
as the primary, so future app code is unaffected by provider choice. LM Studio is
reached via the configured Cloudflare Tunnel base URL (a private-service pointer kept
in env, Principle IX) and usually ignores the API key, so a key is not required.
"""

from __future__ import annotations

import httpx

from ._openai_compat import OpenAICompatProvider
from .config import ProviderEndpoint


class LMStudioProvider(OpenAICompatProvider):
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
            require_api_key=False,
        )
