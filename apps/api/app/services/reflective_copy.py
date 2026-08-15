"""Feature 014 — reflective-copy generation for card states 2 and 9 (T024).

`contracts/reflective-copy.md`. One job: take a bundle of already-computed facts and one
already-approved deterministic sentence, ask the provider to say the same thing in
different words, and return the string. That is the whole surface.

── What this module deliberately does NOT do ────────────────────────────────────────
* **No database, of any kind.** Not `window_readings`, not chat, not `profiles`. The facts
  arrive precomputed from the client (FR-020/FR-023) and this module imports nothing that
  could reach a table. If a future change needs a fact from the database, that is a spec
  change, not a new import here.
* **No fallback.** On any failure this raises and the endpoint answers non-200. The
  fallback decision belongs next to the deterministic string, on the client, where the
  string actually is (`contracts/reflective-copy.md` §Endpoint).
* **No validation of MEANING.** The shape check below (`{"text": <string>}`) is the API's
  half. The fabrication rules — every number, time and band word must have been supplied —
  run client-side in `reflective-copy-validation.ts`, next to the facts, immediately before
  paint. Doing it twice in two languages would create two sources of truth for SC-004.

Credential: `get_reflective_copy_llm_client()` — a second key to the same provider, never
Ren's (Amendment 3; see `services/llm_client.py`).
"""

from __future__ import annotations

from dataclasses import dataclass

from llm_client import (
    LLMMessage,
    LLMRequest,
    ScorerValidationError,
    extract_json_object,
    render_prompt,
)

from .llm_client import LLMClient

#: Card states that generate copy. Every other state's line is deterministic-only.
REFLECTIVE_STATES = (2, 9)


@dataclass(frozen=True)
class ReflectiveFacts:
    """`data-model.md` §4 — the only material the generator may phrase.

    Everything is already rendered for reading: counts are counts, times are preformatted
    clock strings, bands are display labels. No raw readings, no probabilities, no chat
    content, no user name ever reaches this object.
    """

    state: int
    checkin_count: int
    times: tuple[str, ...]
    band_labels: tuple[str, ...]
    fallback_text: str
    tried_item_title: str | None = None
    tried_at_label: str | None = None


def _facts_variables(facts: ReflectiveFacts) -> dict[str, str]:
    """Render the facts as the prompt's documented variables.

    Lists become comma-joined strings and absent optionals become the empty string — the
    prompt tells the model that a blank fact does not exist and may not be referred to.
    """
    return {
        "state": str(facts.state),
        "checkin_count": str(facts.checkin_count),
        "times": ", ".join(facts.times),
        "band_labels": ", ".join(facts.band_labels),
        "tried_item_title": facts.tried_item_title or "",
        "tried_at_label": facts.tried_at_label or "",
        "fallback_text": facts.fallback_text,
    }


def build_messages(facts: ReflectiveFacts) -> list[LLMMessage]:
    """The one-shot request: the fixed prompt with the facts substituted, and nothing
    else. There is no conversation here and no history to window."""
    system = render_prompt("reflective_copy", **_facts_variables(facts))
    return [LLMMessage(role="system", content=system)]


def parse_reflective_copy(content: str) -> str:
    """Pull `text` out of the provider's JSON object.

    Defensive extraction first (`extract_json_object` handles code fences and reasoning
    that leaked into `content`), then the shape check. Raises `ScorerValidationError` —
    the same failure vocabulary the scorer uses, so one telemetry type covers both.
    """
    obj = extract_json_object(content)
    if "text" not in obj:
        raise ScorerValidationError("missing_key")
    value = obj["text"]
    if not isinstance(value, str) or not value.strip():
        # Present but unusable: a number, a null, a nested object, or an empty string.
        raise ScorerValidationError("invalid_enum")
    return value.strip()


async def generate_reflective_copy(llm: LLMClient, facts: ReflectiveFacts) -> str:
    """One re-phrasing of `facts.fallback_text`.

    Raises `LLMProviderError` (provider down, or the credential absent/invalid) or
    `ScorerValidationError` (the JSON contract broke). Both are the endpoint's cue to
    answer non-200; neither is recoverable here.
    """
    response = await llm.complete(
        LLMRequest(messages=build_messages(facts), response_format="json_object")
    )
    try:
        return parse_reflective_copy(response.content)
    except ScorerValidationError as exc:
        # Privacy-safe: the failure TYPE is recorded, never the offending body.
        llm.emit_validation_failure(provider=response.provider, failure=exc.failure_type)
        raise
