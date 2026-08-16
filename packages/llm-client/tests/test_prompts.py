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


def test_exactly_the_wired_seams():
    # Five from 011 plus feature 014's `reflective_copy`. This set is CLOSED: a prompt
    # file appearing on disk is not enough to make it loadable, which is the whole point
    # of the registry (see the reference-only seam below).
    assert set(PROMPT_IDS) == {
        "ren",
        "ren_preference_block",
        "scorer_per_message",
        "scorer_rollup",
        "auto_title",
        "reflective_copy",
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
        current_pick_line="",
        preferences="",
    )
    assert "Sam" in rendered
    # the placeholders are gone after substitution
    assert "{user_first_name}" not in rendered
    assert "{recent_read_line}" not in rendered
    assert "{current_pick_line}" not in rendered
    assert "{preferences}" not in rendered


_REFLECTIVE_COPY_VARIABLES = {
    "state",
    "checkin_count",
    "times",
    "band_labels",
    "tried_item_title",
    "tried_at_label",
    "fallback_text",
}


def test_reflective_copy_is_wired_and_loads():
    assert "reflective_copy" in PROMPT_IDS
    assert load_prompt("reflective_copy").strip()


def test_reflective_copy_renders_every_declared_variable():
    # Feature 014 (T023). The facts bundle is the ONLY material the seam may phrase
    # (data-model §4), so every field has to be a real, substituted placeholder — a
    # typo'd one would silently ship `{tried_at_label}` to the provider.
    rendered = render_prompt(
        "reflective_copy",
        state="2",
        checkin_count="3",
        times="9:40, 11:15",
        band_labels="Calm",
        tried_item_title="",
        tried_at_label="",
        fallback_text="Calm at all 3 check-ins today, at 9:40 and 11:15.",
    )
    for name in _REFLECTIVE_COPY_VARIABLES:
        assert "{" + name + "}" not in rendered, f"{name} left unsubstituted"
    assert "Calm at all 3 check-ins today, at 9:40 and 11:15." in rendered


def test_reflective_copy_declares_no_undocumented_variable():
    # Anything `{like_this}` still standing after every documented variable is
    # substituted is either a new variable nobody is passing or a stray brace. The
    # literal JSON example `{"text": …}` is excluded by requiring an identifier.
    import re

    rendered = render_prompt(
        "reflective_copy", **dict.fromkeys(_REFLECTIVE_COPY_VARIABLES, "x")
    )
    leftover = re.findall(r"\{[a-z_][a-z0-9_]*\}", rendered)
    assert leftover == []


def test_reflective_copy_literal_json_braces_survive_render():
    # Same hazard as the scorer prompts: the response-shape example contains literal
    # JSON braces, and literal replacement (not str.format) must leave them alone.
    text = render_prompt("reflective_copy", **dict.fromkeys(_REFLECTIVE_COPY_VARIABLES, "x"))
    assert '{"text":' in text


def test_scorer_prompt_literal_braces_survive_render():
    # The scorer prompt contains literal JSON braces; loading/rendering must not
    # treat them as format fields or mangle them.
    text = render_prompt("scorer_per_message")
    assert '"band"' in text
    assert "{" in text and "}" in text
