"""T012 — provider config parsing + fail-clean/silent-fallback selection (FR-002/003/006)."""

from __future__ import annotations

import pytest

from llm_client.config import load_config
from llm_client.provider import LLMProviderError, LLMRequest, LLMResponse
from llm_client.registry import ProviderRegistry


def test_defaults_lock_groq_primary_and_lm_studio_fallback():
    cfg = load_config(env={})
    assert cfg.primary.name == "groq"
    assert cfg.primary.model == "openai/gpt-oss-120b"
    assert cfg.primary.reasoning_effort == "low"
    assert cfg.fallback.name == "lm_studio"
    assert cfg.fallback.model == "openai/gpt-oss-20b"
    # FR-006: one config string for the bot name; FR-003: fail-clean is the default.
    assert cfg.bot_display_name == "Ren"
    assert cfg.silent_fallback is False


def test_env_overrides_models_key_name_and_flags():
    cfg = load_config(
        env={
            "GROQ_API_KEY": "sk-test",
            "GROQ_MODEL": "openai/gpt-oss-120b-x",
            "LM_STUDIO_BASE_URL": "https://tunnel.example/v1/",
            "LM_STUDIO_MODEL": "openai/gpt-oss-20b-x",
            "LLM_SILENT_FALLBACK": "true",
            "LLM_BOT_NAME": "Ren",
            "LLM_MAX_RETRIES": "1",
        }
    )
    assert cfg.primary.api_key == "sk-test"
    assert cfg.primary.model == "openai/gpt-oss-120b-x"
    # trailing slash trimmed
    assert cfg.fallback.base_url == "https://tunnel.example/v1"
    assert cfg.silent_fallback is True
    assert cfg.max_retries == 1


def test_missing_key_is_not_committed_default():
    # No GROQ_API_KEY in env → None (env-only secret, Principle IX). Construction is
    # tolerated; the provider fails clean at call time.
    cfg = load_config(env={})
    assert cfg.primary.api_key is None


# --- registry selection ------------------------------------------------------


class _Fixed:
    def __init__(self, name, content):
        self.name = name
        self._content = content

    async def complete(self, request: LLMRequest) -> LLMResponse:
        return LLMResponse(
            provider=self.name, model="m", content=self._content,
            finish_reason="stop", latency_ms=1,
        )


class _Failing:
    def __init__(self, name="groq"):
        self.name = name

    async def complete(self, request: LLMRequest) -> LLMResponse:
        raise LLMProviderError("down", provider=self.name, retryable=True)


async def test_fail_clean_default_raises_when_primary_down():
    reg = ProviderRegistry(_Failing("groq"), _Fixed("lm_studio", "fallback"), silent_fallback=False)
    with pytest.raises(LLMProviderError):
        await reg.complete(LLMRequest())


async def test_silent_fallback_used_only_behind_flag():
    reg = ProviderRegistry(_Failing("groq"), _Fixed("lm_studio", "fallback"), silent_fallback=True)
    result = await reg.complete(LLMRequest())
    assert result.used_fallback is True
    assert result.response.content == "fallback"
    assert result.response.provider == "lm_studio"


async def test_primary_success_does_not_touch_fallback():
    reg = ProviderRegistry(_Fixed("groq", "primary"), _Failing("lm_studio"), silent_fallback=True)
    result = await reg.complete(LLMRequest())
    assert result.used_fallback is False
    assert result.response.content == "primary"
