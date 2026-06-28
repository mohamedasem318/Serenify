"""Verified crisis resources — app-owned, human-checked, never model-generated
(FR-035–FR-040; contract: crisis-resources.md; Principle I).

Ren MUST NOT produce phone numbers or service names; all crisis contacts come from
this table plus a universal immediate-danger line. Building a panel persists NOTHING
(no crisis row/event/log/badge/notification) — it is live, render-only state.
"""

from __future__ import annotations

from ..schemas import CrisisPanel, CrisisResourceOut

# 011 verified table — Egypt + United States only, each with a last-checked date.
_LAST_CHECKED = "2026-06-28"

_EGYPT = CrisisResourceOut(
    country="EG",
    name="General Secretariat of Mental Health & Addiction Treatment hotline",
    number="16328",
    url=None,
    last_checked=_LAST_CHECKED,
)
_UNITED_STATES = CrisisResourceOut(
    country="US",
    name="988 Suicide & Crisis Lifeline",
    number="Call/text 988",
    url=None,
    last_checked=_LAST_CHECKED,
)

# Always present, for every user — prevents a blank panel (FR-040).
UNIVERSAL_LINE = (
    "If you're in immediate danger, contact your local emergency services right away."
)
# Egypt-specific emergency number, included for Egypt rendering (FR-039).
_EGYPT_EMERGENCY = "123"

SupportedCountry = str  # "EG" | "US" | anything else / None


def build_panel(country: SupportedCountry | None) -> CrisisPanel:
    """The live crisis panel for the employee's country.

    Known country → its verified row(s) + the universal line (+ Egypt's 123).
    Missing/unsupported country → the universal line ONLY, never blank (FR-040).
    """
    normalized = (country or "").strip().upper()
    if normalized == "EG":
        return CrisisPanel(
            resources=[_EGYPT],
            universal_line=UNIVERSAL_LINE,
            emergency_number=_EGYPT_EMERGENCY,
        )
    if normalized == "US":
        return CrisisPanel(
            resources=[_UNITED_STATES],
            universal_line=UNIVERSAL_LINE,
            emergency_number=None,
        )
    return CrisisPanel(resources=[], universal_line=UNIVERSAL_LINE, emergency_number=None)
