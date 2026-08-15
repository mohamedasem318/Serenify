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
import os
from dataclasses import asdict, replace
from functools import lru_cache

import httpx
from llm_client import (
    GroqProvider,
    LLMCallTelemetry,
    LLMClientConfig,
    LLMProviderError,
    LLMProviderName,
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


# ── Feature 014: the reflective-copy client, on its own credential ────────────
#
# Amendment 3 (2026-08-16, plan.md §Principle IX): the "Things that might help" card may
# have its deterministic sentence re-phrased by the SAME provider Ren uses (FR-024 — no
# new provider), but never on Ren's key. A card that quietly ate Ren's rate limit would
# take the conversation down with it, and the conversation is the thing that matters.
#
# Everything below is ADDITIVE. `get_llm_client()` above, `packages/llm-client`, Ren's
# retries and Ren's limits are untouched — this is a second `@lru_cache` accessor that
# rebuilds the primary endpoint's key from a second environment variable and hands the
# registry a fallback that cannot run.

#: The reflective-copy credential. Placed by Mohamed at deploy time; absent in CI and in
#: every test. Absence is tolerated at import and construction and surfaces as a
#: non-retryable provider error at request time (the endpoint then returns non-200 and the
#: web client paints the deterministic string).
REFLECTIVE_COPY_API_KEY_ENV = "GROQ_API_KEY_REFLECTIVE_COPY"

#: Ren's credential — named here ONLY so it can be excluded. This path must never resolve
#: it, so it is filtered out of the environment before the config loader ever sees it,
#: rather than loaded and then overwritten.
_RENS_API_KEY_ENV = "GROQ_API_KEY"


class _NoFallbackProvider:
    """The absence of a fallback, made explicit.

    `ProviderRegistry` takes a primary AND a fallback, and this path is specified to have
    no fallback at all. Passing the real LM Studio adapter and trusting
    `silent_fallback=False` to never reach it would leave a live second provider one
    config flag away from answering card copy; passing this instead makes the reflective
    path's shape true by construction. It conforms to the `LLMProvider` protocol and
    raises non-retryably if anything ever calls it.
    """

    name: LLMProviderName = "groq"

    async def complete(self, _request: LLMRequest) -> LLMResponse:
        raise LLMProviderError(
            "reflective-copy path has no fallback provider",
            provider=self.name,
            retryable=False,
        )


def reflective_copy_config() -> LLMClientConfig:
    """Ren's config with the primary key swapped for the reflective-copy credential and
    silent fallback forced off.

    The environment handed to `load_config` has `GROQ_API_KEY` **removed by key**, so
    Ren's secret is never read on this path — not read-then-discarded, not read-then-
    overwritten. Everything else (base URL, model, timeout, `LLM_MAX_RETRIES`) is
    deliberately shared: same provider, same operational behaviour, different credential.
    """
    env = {name: os.environ[name] for name in os.environ if name != _RENS_API_KEY_ENV}
    base = load_config(env=env)
    return replace(
        base,
        primary=replace(
            base.primary,
            api_key=os.environ.get(REFLECTIVE_COPY_API_KEY_ENV) or None,
        ),
        silent_fallback=False,
    )


def build_reflective_copy_registry(
    config: LLMClientConfig, *, client: httpx.AsyncClient | None = None
) -> ProviderRegistry:
    """The reflective-copy registry: the Groq adapter on the reflective credential, and a
    fallback that raises. `client` is an injection seam for tests that assert what
    actually goes on the wire."""
    return ProviderRegistry(
        GroqProvider(
            config.primary, request_timeout_ms=config.request_timeout_ms, client=client
        ),
        _NoFallbackProvider(),
        silent_fallback=False,
    )


@lru_cache
def get_reflective_copy_llm_client() -> LLMClient:
    """Process-wide reflective-copy client (config read once), on its own credential.

    Constructing this never raises, whether or not the credential exists — the failure is
    a request-time provider error, which is what lets the card ship before the secret is
    placed.
    """
    config = reflective_copy_config()
    return LLMClient(config=config, registry=build_reflective_copy_registry(config))
