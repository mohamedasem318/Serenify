"""Thin app integration around the shared `llm_client` boundary (Principle IV).

apps/api imports LLMs ONLY through here → `llm_client` (the package). No vendor SDK is
imported anywhere in this service. This wrapper adds the app-side concerns the package
deliberately leaves out:

  * transient retry with backoff (FR-051), honoring `LLMProviderError.retryable`;
  * privacy-safe telemetry emission (FR-058) — only outcome / provider / latency
    bucket / retry count / validation-failure type / fallback flag ever leave here.

Provider selection, fail-clean vs silent fallback, prompt loading, and scorer
validation all live in the package.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import asdict
from functools import lru_cache

from llm_client import (
    LLMCallTelemetry,
    LLMClientConfig,
    LLMProviderError,
    LLMRequest,
    LLMResponse,
    ProviderRegistry,
    ValidationFailureType,
    latency_bucket,
    load_config,
)

_log = logging.getLogger("app.chat.telemetry")


def emit_telemetry(event: LLMCallTelemetry) -> None:
    """Emit one privacy-safe telemetry record. The shape is allow-list only — there
    is no field here for message/prompt text, crisis flags, bands, or resource
    events (Principle I). Logged as INFO with structured extras."""
    _log.info("llm_call", extra={"llm_telemetry": asdict(event)})


class LLMClient:
    def __init__(
        self,
        config: LLMClientConfig | None = None,
        *,
        registry: ProviderRegistry | None = None,
    ) -> None:
        self._config = config or load_config()
        self._registry = registry or ProviderRegistry.from_config(self._config)

    @property
    def bot_display_name(self) -> str:
        """FR-006 — the one configured bot name; never duplicated as hardcoded copy."""
        return self._config.bot_display_name

    @staticmethod
    def _backoff_seconds(attempt: int) -> float:
        # 0.2s, 0.4s, 0.8s … small backoff; "retry once or twice" (FR-051).
        return 0.2 * (2 ** (attempt - 1))

    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Run a request with fail-clean selection + transient retry, emitting one
        telemetry record. Raises `LLMProviderError` once retries/fail-clean are
        exhausted (the orchestrator turns that into a calm degraded state)."""
        attempt = 0
        while True:
            try:
                result = await self._registry.complete(request)
            except LLMProviderError as exc:
                if exc.retryable and attempt < self._config.max_retries:
                    attempt += 1
                    await asyncio.sleep(self._backoff_seconds(attempt))
                    continue
                emit_telemetry(
                    LLMCallTelemetry(
                        outcome="timeout" if exc.timeout else "provider_error",
                        provider=exc.provider or self._config.primary.name,
                        latency_bucket="n/a",
                        retry_count=attempt,
                    )
                )
                raise
            emit_telemetry(
                LLMCallTelemetry(
                    outcome="success",
                    provider=result.response.provider,
                    latency_bucket=latency_bucket(result.response.latency_ms),
                    retry_count=attempt,
                    used_fallback=result.used_fallback,
                )
            )
            return result.response

    def emit_validation_failure(
        self, *, provider: str, failure: ValidationFailureType
    ) -> None:
        """Record a scorer/structured-output validation rejection (FR-058). Called by
        the orchestrator after a successful provider call whose body failed to
        validate, so the failure type is captured without any content."""
        emit_telemetry(
            LLMCallTelemetry(
                outcome="validation_error",
                provider=provider,  # type: ignore[arg-type]
                latency_bucket="n/a",
                validation_failure=failure,
            )
        )


@lru_cache
def get_llm_client() -> LLMClient:
    """Process-wide LLM client (config read once). Providers create a per-call httpx
    client — fine at graduation scale; no lifespan wiring needed."""
    return LLMClient()
