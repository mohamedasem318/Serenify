"""Serenify shared LLM client (Constitution Principle IV).

The single LLM provider boundary for all server-side LLM calls. Application code
(apps/api, future questionnaire/recommendations) imports from here and NEVER from a
vendor SDK: the provider protocol, config-driven registry, file-backed prompts,
scorer JSON validation/extraction, and privacy-safe telemetry types.
"""

from __future__ import annotations

from .config import LLMClientConfig, ProviderEndpoint, load_config
from .groq_provider import GroqProvider
from .lm_studio_provider import LMStudioProvider
from .prompts import (
    PROMPT_IDS,
    REFERENCE_ONLY_IDS,
    PromptError,
    PromptId,
    load_prompt,
    prompts_dir,
    render_prompt,
    validate_prompts,
)
from .provider import (
    LLMMessage,
    LLMProvider,
    LLMProviderError,
    LLMProviderName,
    LLMRequest,
    LLMResponse,
    LLMRole,
    ReasoningEffort,
    ResponseFormat,
)
from .registry import ProviderCallResult, ProviderRegistry
from .scorer import (
    Band,
    ScorerResult,
    ScorerValidationError,
    extract_json_object,
    parse_scorer,
    rollup_band,
)
from .telemetry import (
    CallOutcome,
    LLMCallTelemetry,
    ValidationFailureType,
    latency_bucket,
)

__version__ = "0.1.0"

__all__ = [
    # provider boundary
    "LLMProvider",
    "LLMProviderError",
    "LLMProviderName",
    "LLMRole",
    "LLMMessage",
    "LLMRequest",
    "LLMResponse",
    "ResponseFormat",
    "ReasoningEffort",
    # config + registry
    "LLMClientConfig",
    "ProviderEndpoint",
    "load_config",
    "ProviderRegistry",
    "ProviderCallResult",
    "GroqProvider",
    "LMStudioProvider",
    # prompts
    "PromptId",
    "PROMPT_IDS",
    "REFERENCE_ONLY_IDS",
    "PromptError",
    "load_prompt",
    "render_prompt",
    "validate_prompts",
    "prompts_dir",
    # scorer
    "Band",
    "ScorerResult",
    "ScorerValidationError",
    "parse_scorer",
    "rollup_band",
    "extract_json_object",
    # telemetry
    "LLMCallTelemetry",
    "latency_bucket",
    "CallOutcome",
    "ValidationFailureType",
]
