"""Frame-sampling robustness against unreliable container metadata (VFR webm).

Browser getUserMedia + MediaRecorder produces VARIABLE-frame-rate webm whose
``CAP_PROP_FPS`` / ``CAP_PROP_FRAME_COUNT`` OpenCV reports are unreliable (observed
fps=1000.0 on a real Chrome capture). The legacy ``skip_ratio = round(fps/5)``
downsample then collapses the kept-frame count to a handful, sampling live captures
at wildly inconsistent rates. These tests pin the fix: sampling is driven by actual
frame timestamps (``CAP_PROP_POS_MSEC``) so any input lands at a consistent ~2.5 fps,
WITHOUT changing the bit-exact frame selection on the CFR clips the model was
validated on.

The sampler is exercised here as PURE functions over (n_frames, reported_fps,
timestamps) — no decode, no mediapipe — so the garbage-metadata logic is provable in
CI. A CFR decode is separately driven through the real ``extract_landmarks`` in
``test_pipeline_fixtures.py`` (the 7-kept-frame synthetic clip), which stays green
iff this fix preserves the CFR selection.
"""

from __future__ import annotations

import numpy as np

from ml_video import pipeline

TARGET_FPS = 5
EFFECTIVE_FPS = 2.5  # TARGET_FPS / FRAME_SKIP_MOD


def _cfr_timestamps_ms(n: int, fps: float) -> list[float]:
    """Constant-rate timestamps a CFR container reports: i * 1000 / fps."""
    return [i * 1000.0 / fps for i in range(n)]


def _legacy_kept(n: int, fps: float) -> int:
    """Re-implements the ORIGINAL skip_ratio sampler's kept count (the baseline)."""
    skip_ratio = max(1, round(fps / TARGET_FPS)) if fps and fps > 0 else 1
    five = [i for i in range(n) if i % skip_ratio == 0]
    return sum(1 for k in range(1, len(five) + 1) if k % 2 == 0)


# --- The legacy index selection is reproduced exactly (documents the baseline) ----


def test_index_keep_indices_matches_legacy_30fps():
    # 90-frame / 30fps -> the exact frames the shipped pipeline keeps today.
    assert pipeline._index_keep_indices(90, 30.0) == [6, 18, 30, 42, 54, 66, 78]


def test_index_keep_indices_matches_legacy_24fps():
    assert pipeline._index_keep_indices(72, 24.0) == [5, 15, 25, 35, 45, 55, 65]


# --- Timestamp sampler reproduces the legacy selection on CFR (mp4 fidelity) -------


def test_timestamp_sampler_is_bit_identical_to_legacy_on_cfr_30fps():
    ts = _cfr_timestamps_ms(90, 30.0)
    assert pipeline._timestamp_keep_indices(ts) == [6, 18, 30, 42, 54, 66, 78]


# --- THE CORE FIX: garbage reported fps must NOT collapse the kept count -----------


def test_garbage_fps_with_true_timestamps_does_not_collapse():
    # Simulate the real pathology: a ~60s capture at a true ~24 fps whose container
    # reports fps=1000.0 (so legacy skip_ratio=200 keeps a handful of frames), but
    # whose POS_MSEC timestamps are truthful. Sampling must land at ~2.5 fps.
    rng = np.random.default_rng(20240606)
    n = 1440  # ~24 fps * 60 s
    # jittered (variable) intervals around 1000/24 ms -> a faithful VFR stream
    intervals = rng.uniform(5.0, 80.0, size=n - 1)
    intervals *= (60_000.0 / intervals.sum())  # normalize total span to 60.0 s
    ts = [0.0, *np.cumsum(intervals).tolist()]
    span_s = ts[-1] / 1000.0

    kept = pipeline._select_keep_indices(n, 1000.0, ts)

    # legacy collapses to a handful; the fix must NOT.
    assert _legacy_kept(n, 1000.0) < 10
    expected = EFFECTIVE_FPS * span_s  # ~150
    assert abs(len(kept) - expected) <= 3
    # strictly increasing, in range
    assert kept == sorted(set(kept))
    assert all(0 <= i < n for i in kept)


def test_garbage_fps_kept_count_is_stable_across_two_reported_fps():
    # Two captures of the SAME true clip reporting WILDLY different fps must yield the
    # SAME kept count (the consistency guarantee the bug breaks).
    rng = np.random.default_rng(7)
    n = 600
    intervals = rng.uniform(10.0, 60.0, size=n - 1)
    intervals *= (30_000.0 / intervals.sum())  # 30 s span
    ts = [0.0, *np.cumsum(intervals).tolist()]
    keep_a = pipeline._select_keep_indices(n, 1000.0, ts)   # garbage-high
    keep_b = pipeline._select_keep_indices(n, 8.4, ts)      # plausible-but-VFR
    assert keep_a == keep_b  # both routed to the timestamp sampler -> identical


# --- CFR mp4 selection is UNCHANGED (the fidelity guarantee), for any framerate ----


def test_cfr_mp4_selection_unchanged_30fps():
    ts = _cfr_timestamps_ms(90, 30.0)
    assert pipeline._select_keep_indices(90, 30.0, ts) == pipeline._index_keep_indices(90, 30.0)


def test_cfr_mp4_selection_unchanged_24fps():
    # The binding case: a true-CFR 24fps mp4 must keep the LEGACY frames bit-for-bit,
    # not the (different) frames a naive fixed-2.5fps timestamp sampler would pick.
    ts = _cfr_timestamps_ms(72, 24.0)
    assert pipeline._select_keep_indices(72, 24.0, ts) == [5, 15, 25, 35, 45, 55, 65]


# --- Fallbacks: broken timestamps must never beat the legacy behavior --------------


def test_unreliable_timestamps_fall_back_to_legacy_index():
    # POS_MSEC stuck at 0 (some broken containers) -> behave exactly like today.
    ts = [0.0] * 90
    assert pipeline._select_keep_indices(90, 30.0, ts) == pipeline._index_keep_indices(90, 30.0)


def test_non_monotonic_timestamps_fall_back_to_legacy_index():
    ts = _cfr_timestamps_ms(90, 30.0)
    ts[40] = ts[39] - 5.0  # a backwards jump -> not trustworthy
    assert pipeline._select_keep_indices(90, 30.0, ts) == pipeline._index_keep_indices(90, 30.0)
