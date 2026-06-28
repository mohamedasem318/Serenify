"""T049 — verified crisis resources: EG/US rows, universal fallback, no persistence
(FR-035–FR-040; contract crisis-resources.md)."""

from __future__ import annotations

import inspect

from app.services import crisis_resources
from app.services.crisis_resources import build_panel


def test_egypt_row_matches_verified_table():
    panel = build_panel("EG")
    assert len(panel.resources) == 1
    row = panel.resources[0]
    assert row.country == "EG"
    assert row.name == "General Secretariat of Mental Health & Addiction Treatment hotline"
    assert row.number == "16328"
    assert row.last_checked == "2026-06-28"
    # Egypt rendering includes the 123 emergency number (FR-039) …
    assert panel.emergency_number == "123"
    # … and always the universal immediate-danger line.
    assert panel.universal_line


def test_us_row_matches_verified_table():
    panel = build_panel("US")
    assert len(panel.resources) == 1
    row = panel.resources[0]
    assert row.country == "US"
    assert row.name == "988 Suicide & Crisis Lifeline"
    assert row.number == "Call/text 988"
    assert row.last_checked == "2026-06-28"
    assert panel.emergency_number is None
    assert panel.universal_line


def test_unsupported_or_missing_country_shows_universal_line_only():
    for country in (None, "", "FR", "xx"):
        panel = build_panel(country)
        assert panel.resources == []  # no fabricated row
        assert panel.universal_line  # never blank (FR-040)


def test_case_insensitive_country():
    assert build_panel("eg").resources[0].country == "EG"
    assert build_panel("us").resources[0].country == "US"


def test_building_a_panel_persists_nothing():
    # Pure function — takes no DB client, performs no I/O (FR-041/042). Rendering
    # the panel cannot create a crisis row/event/log/notification.
    params = list(inspect.signature(build_panel).parameters)
    assert params == ["country"]
    assert not hasattr(crisis_resources, "save_crisis")
