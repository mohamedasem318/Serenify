"""T015 — prompt loading reads the fixed files; it never authors or asserts wording.

Per the Prompt input rule, these tests confirm the seams LOAD and that the
reference-only seam stays unwired — they do not assert the prompt text itself.
"""

from __future__ import annotations

import pytest

from llm_client.prompts import (
    PROMPT_IDS,
    REFERENCE_ONLY_IDS,
    PromptError,
    load_prompt,
    prompts_dir,
    render_prompt,
    validate_prompts,
)


def test_exactly_the_five_wired_seams():
    assert set(PROMPT_IDS) == {
        "ren",
        "ren_preference_block",
        "scorer_per_message",
        "scorer_rollup",
        "auto_title",
    }


def test_every_wired_seam_loads_non_empty():
    for pid in PROMPT_IDS:
        text = load_prompt(pid)
        assert text.strip(), f"{pid} loaded empty"


def test_validate_prompts_passes():
    validate_prompts()  # raises if any seam is missing/empty


def test_scorer_crisis_only_exists_on_disk_but_is_not_wired():
    # Present as reference-only material …
    assert (prompts_dir() / "scorer_crisis_only.txt").is_file()
    assert "scorer_crisis_only" in REFERENCE_ONLY_IDS
    assert "scorer_crisis_only" not in PROMPT_IDS
    # … and the loader refuses to wire it into any call site.
    with pytest.raises(PromptError):
        load_prompt("scorer_crisis_only")  # type: ignore[arg-type]


def test_unknown_id_raises():
    with pytest.raises(PromptError):
        load_prompt("nope")  # type: ignore[arg-type]


def test_render_substitutes_declared_variables_in_ren():
    rendered = render_prompt(
        "ren",
        user_first_name="Sam",
        recent_read_line="",
        preferences="",
    )
    assert "Sam" in rendered
    # the placeholders are gone after substitution
    assert "{user_first_name}" not in rendered
    assert "{recent_read_line}" not in rendered
    assert "{preferences}" not in rendered


def test_scorer_prompt_literal_braces_survive_render():
    # The scorer prompt contains literal JSON braces; loading/rendering must not
    # treat them as format fields or mangle them.
    text = render_prompt("scorer_per_message")
    assert '"band"' in text
    assert "{" in text and "}" in text
