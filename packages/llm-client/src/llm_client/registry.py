"""Provider registry + fail-clean selection (FR-003, FR-057; Principle IV).

The registry holds the primary and fallback providers (both behind the same
`LLMProvider` boundary) and applies the selection policy:

  * Default (fail-clean): if the primary errors, raise. We do NOT silently swap to a
    visibly weaker model mid-demo.
  * Silent fallback (explicit config flag only): if the primary errors, try the
    fallback and report that it was used.

Retry/backoff for transient failures lives in the API orchestration layer
(FR-051), not here — the registry's one job is which provider answers.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from .config import LLMClientConfig
from .groq_provider import GroqProvider
from .lm_studio_provider import LMStudioProvider
from .provider import LLMProvider, LLMProviderError, LLMRequest, LLMResponse


@dataclass(frozen=True)
class ProviderCallResult:
    response: LLMResponse
    used_fallback: bool


class ProviderRegistry:
    def __init__(
        self,
        primary: LLMProvider,
        fallback: LLMProvider,
        *,
        silent_fallback: bool,
    ) -> None:
        self.primary = primary
        self.fallback = fallback
        self.silent_fallback = silent_fallback

    @classmethod
    def from_config(
        cls, config: LLMClientConfig, *, client: httpx.AsyncClient | None = None
    ) -> ProviderRegistry:
        return cls(
            GroqProvider(
                config.primary, request_timeout_ms=config.request_timeout_ms, client=client
            ),
            LMStudioProvider(
                config.fallback, request_timeout_ms=config.request_timeout_ms, client=client
            ),
            silent_fallback=config.silent_fallback,
        )

    async def complete(self, request: LLMRequest) -> ProviderCallResult:
        """Run `request` against the primary; on error, fail-clean (raise) unless
        silent fallback is enabled, in which case try the fallback."""
        try:
            response = await self.primary.complete(request)
            return ProviderCallResult(response=response, used_fallback=False)
        except LLMProviderError:
            if not self.silent_fallback:
                # Fail-clean default — propagate, do NOT degrade silently.
                raise
            response = await self.fallback.complete(request)
            return ProviderCallResult(response=response, used_fallback=True)
