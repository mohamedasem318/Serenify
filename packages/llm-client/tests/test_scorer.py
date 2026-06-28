"""T018 — scorer clean JSON, reasoning-contaminated extraction, enum rejection,
rollup crisis discard (FR-004, FR-005; contract scorer-json.md)."""

from __future__ import annotations

import pytest

from llm_client.scorer import (
    ScorerValidationError,
    extract_json_object,
    parse_scorer,
    rollup_band,
)


def test_clean_object_parses():
    r = parse_scorer('{"band": "tense", "crisis": false}')
    assert r.band == "tense"
    assert r.crisis is False


def test_reasoning_contaminated_content_is_extracted():
    raw = 'We need to think... the user seems calm.\n{"band": "at_ease", "crisis": false}\nDone.'
    r = parse_scorer(raw)
    assert r.band == "at_ease"
    assert r.crisis is False


def test_code_fenced_object_is_extracted():
    raw = '```json\n{"band": "a_little_tense", "crisis": false}\n```'
    r = parse_scorer(raw)
    assert r.band == "a_little_tense"


def test_object_after_a_brace_in_a_string_still_parses():
    raw = 'note: "use {curly} carefully" then {"band": "tense", "crisis": true}'
    r = parse_scorer(raw)
    assert r.band == "tense"
    assert r.crisis is True


def test_invalid_band_enum_rejected():
    with pytest.raises(ScorerValidationError) as exc:
        parse_scorer('{"band": "panic", "crisis": false}')
    assert exc.value.failure_type == "invalid_enum"


def test_crisis_not_bool_rejected():
    with pytest.raises(ScorerValidationError) as exc:
        parse_scorer('{"band": "tense", "crisis": "yes"}')
    assert exc.value.failure_type == "crisis_not_bool"


def test_missing_band_rejected():
    with pytest.raises(ScorerValidationError) as exc:
        parse_scorer('{"crisis": false}')
    assert exc.value.failure_type == "missing_key"


def test_unparseable_content_rejected():
    with pytest.raises(ScorerValidationError) as exc:
        parse_scorer("the user is fine, no json here")
    assert exc.value.failure_type == "not_json"


def test_non_object_json_rejected():
    with pytest.raises(ScorerValidationError) as exc:
        parse_scorer("[1, 2, 3]")
    assert exc.value.failure_type == "not_object"


def test_extract_json_object_returns_dict():
    obj = extract_json_object('{"band": "tense", "crisis": false}')
    assert obj == {"band": "tense", "crisis": False}


def test_rollup_reads_band_only_and_discards_crisis():
    # Rollup output carries crisis=true, but rollup must NEVER surface it.
    band = rollup_band('{"band": "a_little_tense", "crisis": true}')
    assert band == "a_little_tense"

    # parse_scorer(require_crisis=False) returns crisis as None (discarded).
    r = parse_scorer('{"band": "tense", "crisis": true}', require_crisis=False)
    assert r.band == "tense"
    assert r.crisis is None


def test_rollup_tolerates_missing_crisis():
    assert rollup_band('{"band": "at_ease"}') == "at_ease"
