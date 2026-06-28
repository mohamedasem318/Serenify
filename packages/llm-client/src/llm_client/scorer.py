"""Scorer JSON validation + defensive extraction (FR-004, FR-005; research R-3;
contract: scorer-json.md).

gpt-oss is a reasoning model; reasoning can leak into `content`. The scorer is strict
enough that contamination never corrupts a stored rollup, while keeping a clean retry
path for malformed output:

  1. Trim the content.
  2. If it parses as a JSON object, use it.
  3. Otherwise extract the FIRST balanced ``{...}`` (string/escape aware) and parse that.
  4. Reject on: not parseable, not an object, missing keys, bad enum, non-bool crisis.

Per call site: the per-message scorer uses both `band` and `crisis` (live only); the
rollup reads `band` ONLY and discards `crisis` (crisis is live-only via the
per-message scorer + Ren's `[CRISIS]` token — never the rollup).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Literal

from .telemetry import ValidationFailureType

Band = Literal["at_ease", "a_little_tense", "tense"]
_BANDS: frozenset[str] = frozenset(("at_ease", "a_little_tense", "tense"))


@dataclass(frozen=True)
class ScorerResult:
    band: Band
    # None only when crisis was not required (rollup), where it is discarded anyway.
    crisis: bool | None


class ScorerValidationError(Exception):
    """Rejected scorer output. `failure_type` feeds privacy-safe telemetry — it
    carries the SHAPE of the failure, never the content."""

    def __init__(self, failure_type: ValidationFailureType) -> None:
        super().__init__(failure_type)
        self.failure_type: ValidationFailureType = failure_type


def extract_json_object(content: str) -> dict:
    """Return the first JSON object in `content` (defensive extraction)."""
    text = content.strip()
    if not text:
        raise ScorerValidationError("not_json")

    # Fast path: the whole thing is clean JSON.
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        parsed = None
    if isinstance(parsed, dict):
        return parsed
    if parsed is not None:
        # Parsed cleanly but it was a list/number/etc., not an object.
        raise ScorerValidationError("not_object")

    # Slow path: scan the WHOLE text string/escape aware (so a brace inside an
    # earlier quoted prose span isn't mistaken for an object), collecting balanced
    # top-level {...} candidates, and return the first that parses to an object.
    saw_non_object = False
    for snippet in _iter_balanced_objects(text):
        try:
            obj = json.loads(snippet)
        except json.JSONDecodeError:
            continue
        if isinstance(obj, dict):
            return obj
        saw_non_object = True
    raise ScorerValidationError("not_object" if saw_non_object else "not_json")


def _iter_balanced_objects(text: str):
    """Yield each balanced top-level ``{...}`` substring, string/escape aware.

    Quote tracking runs across the entire text from the start, so braces inside a
    quoted span (JSON string or prose) are never counted as structure.
    """
    depth = 0
    start = -1
    in_string = False
    escaped = False
    for i, ch in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            if depth > 0:
                depth -= 1
                if depth == 0 and start != -1:
                    yield text[start : i + 1]
                    start = -1


def _validate_band(obj: dict) -> Band:
    if "band" not in obj:
        raise ScorerValidationError("missing_key")
    band = obj["band"]
    if band not in _BANDS:
        raise ScorerValidationError("invalid_enum")
    return band  # type: ignore[return-value]


def parse_scorer(content: str, *, require_crisis: bool = True) -> ScorerResult:
    """Validate scorer output to `{band, crisis}`.

    `require_crisis=True` (per-message): `crisis` must be present and boolean.
    `require_crisis=False` (rollup): `crisis` is ignored/discarded — only `band` is
    validated and used.
    """
    obj = extract_json_object(content)
    band = _validate_band(obj)

    if not require_crisis:
        return ScorerResult(band=band, crisis=None)

    if "crisis" not in obj:
        raise ScorerValidationError("missing_key")
    crisis = obj["crisis"]
    if not isinstance(crisis, bool):
        raise ScorerValidationError("crisis_not_bool")
    return ScorerResult(band=band, crisis=crisis)


def rollup_band(content: str) -> Band:
    """The conversation-level band from a rollup response. `crisis` is discarded
    here by construction (never returned, never persisted, never drives the panel)."""
    return parse_scorer(content, require_crisis=False).band
