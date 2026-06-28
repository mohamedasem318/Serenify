"""Privacy-safe operational telemetry for LLM calls (FR-058, Principle I;
contract: llm-provider.md "Telemetry").

The ALLOWED fields are the only things an LLM/chat call may record: request
outcome, provider used, latency bucket, retry count, validation failure type.
This module makes that allow-list structural — `LLMCallTelemetry` has no field
for message text, prompt text, crisis booleans, stress bands, resource-panel
events, or provider hidden reasoning, so there is no place to put them.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .provider import LLMProviderName

# Coarse outcome of one logical call (after any retry/fallback resolution).
CallOutcome = Literal["success", "provider_error", "timeout", "validation_error"]

# The kind of validation failure when a scorer/structured response is rejected.
# `None` (no failure) is represented by omitting it / the "none" literal.
ValidationFailureType = Literal[
    "none",
    "not_json",
    "not_object",
    "missing_key",
    "invalid_enum",
    "crisis_not_bool",
]

# Coarse latency buckets — never the raw millisecond value on a shared sink, so a
# bucket can't be a side channel for content length. Boundaries in ms.
_LATENCY_BUCKETS: tuple[tuple[int, str], ...] = (
    (250, "<250ms"),
    (500, "250-500ms"),
    (1000, "500ms-1s"),
    (2000, "1-2s"),
    (4000, "2-4s"),
    (8000, "4-8s"),
)


def latency_bucket(latency_ms: int) -> str:
    """Map a latency in ms to a coarse bucket label."""
    for upper, label in _LATENCY_BUCKETS:
        if latency_ms < upper:
            return label
    return ">8s"


@dataclass(frozen=True)
class LLMCallTelemetry:
    """The ONLY shape emitted for an LLM/chat call. Allow-list, by construction.

    There is deliberately no field for message/prompt text, crisis flags, bands, or
    resource-panel events — adding one would be a Principle I regression caught in
    review and by `apps/api/tests/test_chat_privacy.py`.
    """

    outcome: CallOutcome
    provider: LLMProviderName
    latency_bucket: str
    retry_count: int = 0
    validation_failure: ValidationFailureType = "none"
    # Set when fail-clean was overridden by the explicit silent-fallback flag and the
    # fallback provider answered. Operational only.
    used_fallback: bool = False
