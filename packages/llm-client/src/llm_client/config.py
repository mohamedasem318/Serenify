"""Config-driven provider selection (FR-002, FR-003, FR-006; Principle IV + IX).

Provider choice, models, the bot display name, and the silent-fallback flag are all
config — swapping providers requires no code change outside this package. Secrets
(the Groq API key, the LM Studio Cloudflare Tunnel base URL) are read from the
environment ONLY and never committed (Principle IX); an absent key is tolerated at
construction and surfaces as a fail-clean provider error at call time, so tests and
import never need a real secret.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass

from .provider import LLMProviderName, ReasoningEffort

# Locked defaults (constitution v1.9.0 Technology Stack; data-model.md "Provider
# configuration"). Models are defaults, overridable by env for future swaps.
_GROQ_BASE_URL_DEFAULT = "https://api.groq.com/openai/v1"
_GROQ_MODEL_DEFAULT = "openai/gpt-oss-120b"
_LM_STUDIO_MODEL_DEFAULT = "openai/gpt-oss-20b"
_BOT_NAME_DEFAULT = "Ren"
_REQUEST_TIMEOUT_MS_DEFAULT = 20000
_MAX_RETRIES_DEFAULT = 2  # "retry once or twice" (FR-051)


@dataclass(frozen=True)
class ProviderEndpoint:
    name: LLMProviderName
    base_url: str
    model: str
    api_key: str | None = None
    reasoning_effort: ReasoningEffort | None = None


@dataclass(frozen=True)
class LLMClientConfig:
    primary: ProviderEndpoint
    fallback: ProviderEndpoint
    # Fail-clean is the DEFAULT (FR-003): when the primary is down we error rather
    # than silently degrade. Silent fallback ON only when explicitly configured.
    silent_fallback: bool
    # FR-006: the bot display name comes from ONE config string. "Ren" is never
    # hardcoded as duplicated copy across unrelated files.
    bot_display_name: str
    request_timeout_ms: int = _REQUEST_TIMEOUT_MS_DEFAULT
    max_retries: int = _MAX_RETRIES_DEFAULT


def _flag(raw: str | None) -> bool:
    return (raw or "").strip().lower() in {"1", "true", "yes", "on"}


def load_config(env: Mapping[str, str] | None = None) -> LLMClientConfig:
    """Build the config from environment variables (defaults applied).

    Env:
      GROQ_API_KEY                  primary provider key (secret; env-only)
      GROQ_BASE_URL                 default https://api.groq.com/openai/v1
      GROQ_MODEL                    default openai/gpt-oss-120b
      LM_STUDIO_BASE_URL            fallback base URL — the Cloudflare Tunnel
                                    (private-service pointer; env-only, Principle IX)
      LM_STUDIO_API_KEY             optional (LM Studio usually ignores it)
      LM_STUDIO_MODEL               default openai/gpt-oss-20b
      LLM_SILENT_FALLBACK           "true" to allow silent fallback (default off)
      LLM_BOT_NAME                  default "Ren"
      LLM_REQUEST_TIMEOUT_MS        default 20000
      LLM_MAX_RETRIES               default 2
    """
    e = os.environ if env is None else env

    primary = ProviderEndpoint(
        name="groq",
        base_url=e.get("GROQ_BASE_URL", _GROQ_BASE_URL_DEFAULT).rstrip("/"),
        model=e.get("GROQ_MODEL", _GROQ_MODEL_DEFAULT),
        api_key=e.get("GROQ_API_KEY") or None,
        # Primary runs at low reasoning effort (FR-002, Principle IV).
        reasoning_effort="low",
    )
    fallback = ProviderEndpoint(
        name="lm_studio",
        base_url=(e.get("LM_STUDIO_BASE_URL") or "http://localhost:1234/v1").rstrip("/"),
        model=e.get("LM_STUDIO_MODEL", _LM_STUDIO_MODEL_DEFAULT),
        api_key=e.get("LM_STUDIO_API_KEY") or None,
        reasoning_effort="low",
    )

    def _int(key: str, default: int) -> int:
        raw = e.get(key)
        try:
            return int(raw) if raw else default
        except ValueError:
            return default

    return LLMClientConfig(
        primary=primary,
        fallback=fallback,
        silent_fallback=_flag(e.get("LLM_SILENT_FALLBACK")),
        bot_display_name=e.get("LLM_BOT_NAME", _BOT_NAME_DEFAULT),
        request_timeout_ms=_int("LLM_REQUEST_TIMEOUT_MS", _REQUEST_TIMEOUT_MS_DEFAULT),
        max_retries=_int("LLM_MAX_RETRIES", _MAX_RETRIES_DEFAULT),
    )
