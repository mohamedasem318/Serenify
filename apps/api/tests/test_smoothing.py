"""D-3 smoothing/banding/cold-start (feature 008, T022; contracts/smoothing-and-banding.md).

Pure-function tests — no model, no DB. Lock: the cold-start gate (M=4), the inclusive
band boundaries (0.52→at_ease, 0.53→a_little_tense, 0.69→a_little_tense, 0.70→tense),
drift-not-flicker (SC-003), skipped windows excluded from the buffer + the M count, and
that the thresholds are ARGUMENTS — moving them moves the boundaries (proving no
hard-coded 0.53/0.70 literal; FR-012).
"""

from __future__ import annotations

import pytest

from app.services.smoothing import (
    BAND_A_LITTLE_TENSE,
    BAND_AT_EASE,
    BAND_TENSE,
    M,
    N,
    band_for_mean,
    smooth,
)

# The config DEFAULTS, passed in as the thresholds-under-test. They are NOT baked into
# smoothing.py (band_for_mean/smooth take them as required kwargs); the config-override
# test below proves that by moving them.
T_LOW = 0.53   # STRESS_OPERATING_POINT (metadata operating point)
T_HIGH = 0.70  # STRESS_TENSE_BAND (display-only product split)


# ── cold-start / warming-up gate ─────────────────────────────────────────────


@pytest.mark.parametrize("count", [0, 1, 2, 3])
def test_fewer_than_M_scored_is_warming_up_with_no_band(count):
    result = smooth([0.9] * count, t_low=T_LOW, t_high=T_HIGH)
    assert result.warming_up is True
    assert result.band is None
    assert result.smoothed is None


def test_the_Mth_scored_reading_produces_a_band():
    assert M == 4 and N == 4  # the contract's locked constants
    result = smooth([0.9] * M, t_low=T_LOW, t_high=T_HIGH)
    assert result.warming_up is False
    assert result.band is not None


# ── inclusive band boundaries (the authoritative check on band_for_mean) ──────


@pytest.mark.parametrize(
    ("mean", "expected"),
    [
        (0.52, BAND_AT_EASE),         # < t_low
        (0.53, BAND_A_LITTLE_TENSE),  # == t_low (INCLUSIVE → a_little_tense)
        (0.69, BAND_A_LITTLE_TENSE),  # < t_high
        (0.70, BAND_TENSE),           # == t_high (INCLUSIVE → tense)
    ],
)
def test_band_boundaries_are_inclusive_at_t_low_and_t_high(mean, expected):
    assert band_for_mean(mean, t_low=T_LOW, t_high=T_HIGH) == expected


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (0.52, BAND_AT_EASE),
        (0.53, BAND_A_LITTLE_TENSE),
        (0.69, BAND_A_LITTLE_TENSE),
        (0.70, BAND_TENSE),
    ],
)
def test_smooth_bands_the_mean_at_the_same_boundaries(value, expected):
    # A window of 4 identical scored values means a mean exactly == value, so smooth()
    # routes through the same inclusive boundaries end-to-end.
    result = smooth([value] * N, t_low=T_LOW, t_high=T_HIGH)
    assert result.warming_up is False
    assert result.band == expected
    assert result.smoothed == pytest.approx(value)


# ── drift, not flicker (SC-003) ──────────────────────────────────────────────


def test_signal_straddling_the_boundary_drifts_not_flickers():
    """A raw signal alternating across t_low would flip the band every window if
    re-thresholded per-window; the trailing mean of N=4 holds a STABLE band (SC-003)."""
    # Raw alternates 0.50 (below t_low) / 0.60 (above t_low) — per-window it flips.
    raw = [0.50, 0.60] * 6  # 12 readings

    # Per-window re-threshold (the WRONG approach) genuinely flickers:
    per_window = [band_for_mean(v, t_low=T_LOW, t_high=T_HIGH) for v in raw]
    assert BAND_AT_EASE in per_window and BAND_A_LITTLE_TENSE in per_window

    # The smoothed band over every trailing-4 window, once warmed, is constant.
    smoothed_bands = [
        smooth(raw[: i + 1], t_low=T_LOW, t_high=T_HIGH).band
        for i in range(N - 1, len(raw))  # only warmed windows
    ]
    assert all(b == BAND_A_LITTLE_TENSE for b in smoothed_bands)  # no flip
    assert len(set(smoothed_bands)) == 1  # genuinely stable


# ── skipped windows excluded from the buffer + the M count ───────────────────


def test_skipped_windows_do_not_advance_warmup_or_enter_the_mean():
    """A skipped window contributes NO value to the scored stream the smoother sees, so
    it neither advances the M=4 cold-start count nor moves the mean (the buffer in T020
    simply does not append on a skip). Simulated here as the scored-only stream."""
    scored: list[float] = []

    # 3 scored readings → still warming.
    for v in (0.10, 0.20, 0.30):
        scored.append(v)
    assert smooth(scored, t_low=T_LOW, t_high=T_HIGH).warming_up is True

    # …two skipped windows in a row: nothing is appended → still 3 scored, still warming.
    # (No code runs here — that is the point: a skip adds nothing to `scored`.)
    assert smooth(scored, t_low=T_LOW, t_high=T_HIGH).warming_up is True
    assert len(scored) == 3

    # The 4th SCORED reading (not the skips) is what crosses M and produces a band, whose
    # mean excludes the skips entirely.
    scored.append(0.40)
    result = smooth(scored, t_low=T_LOW, t_high=T_HIGH)
    assert result.warming_up is False
    assert result.smoothed == pytest.approx((0.10 + 0.20 + 0.30 + 0.40) / 4)


# ── thresholds are config, not literals (FR-012) ─────────────────────────────


def test_moving_the_operating_point_moves_the_at_ease_boundary():
    # mean 0.60: a_little_tense at the default t_low=0.53 …
    assert band_for_mean(0.60, t_low=0.53, t_high=T_HIGH) == BAND_A_LITTLE_TENSE
    # … but at_ease once the operating point is raised above it — the boundary tracks the
    # CONFIG value, so there is no hard-coded 0.53 in the banding logic.
    assert band_for_mean(0.60, t_low=0.61, t_high=T_HIGH) == BAND_AT_EASE


def test_moving_the_tense_band_moves_the_tense_boundary():
    # mean 0.65: a_little_tense at the default t_high=0.70 …
    assert band_for_mean(0.65, t_low=T_LOW, t_high=0.70) == BAND_A_LITTLE_TENSE
    # … but tense once the tense band is lowered below it — tracks STRESS_TENSE_BAND.
    assert band_for_mean(0.65, t_low=T_LOW, t_high=0.64) == BAND_TENSE
