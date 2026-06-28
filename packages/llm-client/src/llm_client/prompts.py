"""File-backed prompt loading (FR-007, FR-008, FR-010; Principle IV; research R-2).

Prompts are FIXED INPUT: the wording lives in `packages/llm-client/prompts/<id>.txt`
and is loaded verbatim. Code may only interpolate documented variables at the call
boundary (`render_prompt`) — it never authors or rewrites wording, and inline prompt
strings in app code are a constitutional violation.

Only the five 011 seams are wired. `scorer_crisis_only` exists on disk as
reference-only and is intentionally absent from `PROMPT_IDS` so it cannot be loaded
into any call site (per the 011 prompt-tuning lock).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

PromptId = Literal[
    "ren",
    "ren_preference_block",
    "scorer_per_message",
    "scorer_rollup",
    "auto_title",
]

# The exact wired seams (FR-007). Order is stable for deterministic validation.
PROMPT_IDS: tuple[PromptId, ...] = (
    "ren",
    "ren_preference_block",
    "scorer_per_message",
    "scorer_rollup",
    "auto_title",
)

# Present on disk but deliberately NOT wired (reference-only). Never loaded.
REFERENCE_ONLY_IDS: tuple[str, ...] = ("scorer_crisis_only",)

_PROMPT_SUFFIX = ".txt"


class PromptError(Exception):
    """An unknown prompt id, or a missing/empty prompt file."""


def prompts_dir() -> Path:
    """The directory holding the fixed prompt files. `LLM_CLIENT_PROMPTS_DIR`
    overrides for tests; default is `packages/llm-client/prompts/`."""
    override = os.environ.get("LLM_CLIENT_PROMPTS_DIR")
    if override:
        return Path(override)
    # this file: packages/llm-client/src/llm_client/prompts.py
    # parents[2]: packages/llm-client  →  /prompts
    return Path(__file__).resolve().parents[2] / "prompts"


def load_prompt(prompt_id: PromptId) -> str:
    """Return the verbatim text of a wired prompt seam. Raises `PromptError` for an
    unknown id (including the reference-only seam) or a missing/empty file."""
    if prompt_id not in PROMPT_IDS:
        raise PromptError(f"unknown or non-wired prompt id: {prompt_id!r}")
    path = prompts_dir() / f"{prompt_id}{_PROMPT_SUFFIX}"
    if not path.is_file():
        raise PromptError(f"prompt file not found: {path}")
    text = path.read_text(encoding="utf-8")
    if not text.strip():
        raise PromptError(f"prompt file is empty: {path}")
    return text


def render_prompt(prompt_id: PromptId, /, **variables: str) -> str:
    """Load a prompt and substitute documented `{name}` variables.

    Uses explicit literal replacement (NOT `str.format`) so the scorer prompts'
    literal JSON braces (e.g. `{"band": "tense", "crisis": false}`) are never
    mistaken for format fields. Only the variables passed are replaced; an
    unreferenced placeholder is left intact for the caller to handle.
    """
    text = load_prompt(prompt_id)
    for name, value in variables.items():
        text = text.replace("{" + name + "}", value)
    return text


def validate_prompts() -> None:
    """Assert every wired seam loads non-empty (startup/load-from-files check)."""
    for prompt_id in PROMPT_IDS:
        load_prompt(prompt_id)
