"""D-3 smoothing + banding + cold-start — the PURE display rule (feature 008, T019).

Computed server-side so the band is authoritative and the two trend surfaces agree
(SC-008). The model is binary with **non-probability-calibrated** ``predict_proba``;
**no numeric value is ever shown** (FR-015) — these rules only choose one of three
bands from a rolling mean of recent stress-positive probabilities.

This module is intentionally **pure and stateless**: it is handed the recent *scored*
``proba[1]`` values and the two config thresholds, and returns a band (or warming-up).
The per-session rolling buffer that accumulates those values lives in the inference
service (``inference.py``, T020) — under revised D-1 the raw ``stress_probability`` is
**never read back from the DB** (the SELECT column whitelist withholds it from the
``authenticated`` role and there is no service-role), so the recent values are held in
server memory, not re-queried. See ``docs/DECISIONS.md`` (2026-06-20).

**Thresholds are arguments, never literals (FR-012).** ``t_low`` / ``t_high`` are
required keyword args; the caller sources them from ``STRESS_OPERATING_POINT`` (read
from ``metadata.json`` at startup) and ``STRESS_TENSE_BAND``. There is deliberately no
``0.53`` / ``0.70`` anywhere in this file. ``N`` and ``M`` are genuine code constants
(``contracts/smoothing-and-banding.md`` Constants table).
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

# Rolling smoothing window — the count of recent SCORED readings averaged. Consecutive
# 60 s windows overlap 50 s, so a 4-reading trailing mean drifts rather than flickers
# (SC-003) while spanning ~90 s of underlying video.
N = 4
# Cold-start gate — scored readings required before ANY band is shown. M == N by the
# contract, so the first band lands with the 4th scored reading (~90-105 s; SC-001).
M = N

# Stable enum keys for the three bands. The user-facing WORDING ("You're calm", …)
# is a later frontend/copy decision (T028/T030) governed by the mock — NOT set here.
# These keys match window_readings.band's CHECK constraint and schemas.Band.
BAND_AT_EASE = "at_ease"
BAND_A_LITTLE_TENSE = "a_little_tense"
BAND_TENSE = "tense"


@dataclass(frozen=True)
class SmoothedReading:
    """The derived display state for one scored window.

    ``band`` is ``None`` during cold-start (warming-up). ``smoothed`` is the trailing
    mean — a SERVER-ONLY diagnostic value that is *never* placed on the wire (FR-015);
    the API returns only ``band``.
    """

    warming_up: bool
    band: str | None
    smoothed: float | None


def band_for_mean(mean: float, *, t_low: float, t_high: float) -> str:
    """Map a smoothed mean to a band. Boundaries are INCLUSIVE at ``t_low``/``t_high``:

    - ``mean <  t_low``            → ``at_ease``
    - ``t_low <= mean <  t_high``  → ``a_little_tense``
    - ``mean >= t_high``           → ``tense``

    So ``0.52 → at_ease``, ``0.53 → a_little_tense``, ``0.69 → a_little_tense``,
    ``0.70 → tense`` at the default thresholds (the contract's locked boundaries).
    """
    if mean < t_low:
        return BAND_AT_EASE
    if mean < t_high:
        return BAND_A_LITTLE_TENSE
    return BAND_TENSE


def smooth(scored_probas: Sequence[float], *, t_low: float, t_high: float) -> SmoothedReading:
    """Smooth + band a window from the session's recent SCORED ``proba[1]`` values.

    ``scored_probas`` are the recent scored stress-positive probabilities for this
    session, current reading included (skipped windows are never in this sequence — they
    are excluded from the buffer and from the ``M`` count by the caller, so they neither
    advance warm-up nor enter the mean). Ordering is irrelevant (a mean is symmetric);
    only the trailing ``N`` are averaged.

    Fewer than ``M`` scored readings → ``warming_up`` (no band). Otherwise the trailing
    mean of the most recent ``N`` is banded through ``t_low``/``t_high``.
    """
    values = list(scored_probas)
    if len(values) < M:
        return SmoothedReading(warming_up=True, band=None, smoothed=None)
    window = values[-N:]
    mean = sum(window) / len(window)
    return SmoothedReading(
        warming_up=False,
        band=band_for_mean(mean, t_low=t_low, t_high=t_high),
        smoothed=mean,
    )
