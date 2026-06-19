"""Tail-window option on ``compute_anchor`` — feature 008 (task T006).

The continuous single-stream read path uploads the whole contiguous recording-so-far each
stride and scores its **last 60 s** via ``compute_anchor(clip, tail_seconds=60)``. That window
is *faithful by construction* — but only while the tail is taken as the **suffix of the
file-global sampling grid** (anchored at the file's t=0), never as a re-sampled trailing
sub-stream (the per-clip ``CAP_PROP_POS_MSEC`` re-zero that sank B2; see ``research.md`` R-5,
``smoke-tests.md`` Step F). These tests make "faithful by construction" an **enforced** invariant.

Three assertions (per tasks.md T006):

1. **Regression-guard invariant** — CI-runnable, synthetic VFR timestamps, no video, no
   tolerance. The tail keep-set is **exactly the suffix** of the global keep-set. This is the
   guard the deferred rolling decoded-frame buffer (R-5) must keep passing.
2. **Degenerate case** — a clip <= ``tail_seconds`` scores **bit-identical** to the un-bounded
   ``compute_anchor`` (reduce-to-``compute_anchor`` path).
3. **Decode-based bound** — LOCAL-ONLY (the >60 s continuous fixture is gitignored, see T003):
   on the real continuous clip the tail keeps only the trailing-60 s frames.

This is **exact integer-index equality on identical source frames** — NOT the retired multi-clip
human-motion fidelity gate (no cosine, no motion tolerance).
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import pytest

from ml_video import compute_anchor, coverage, pipeline
from ml_video.features import FEATURE_DIM, N_LANDMARKS
from ml_video.pipeline import (
    _probe_timestamps,
    _select_keep_indices,
    _timestamp_keep_indices,
)

_SAMPLE_PERIOD_MS = 400.0  # effective 2.5 fps grid (pipeline._SAMPLE_PERIOD_MS)
_TAIL_S = 60
_TAIL_MS = _TAIL_S * 1000.0


# ======================================================================================
# Assertion 1 — CI-runnable suffix invariant on synthetic VFR timestamps (no video)
# ======================================================================================


def _vfr_timestamps_ms(total_ms: float, n: int, seed: int) -> list[float]:
    """Deterministic monotonic VFR timestamps spanning EXACTLY ``total_ms`` (ms), starting at 0."""
    rng = np.random.default_rng(seed)
    intervals = rng.uniform(20.0, 90.0, size=n - 1)
    intervals *= total_ms / intervals.sum()  # normalize the span to exactly total_ms
    return [0.0, *np.cumsum(intervals).tolist()]


def test_tail_keepset_is_exact_suffix_of_global_keepset():
    """``_timestamp_keep_indices(ts, tail_seconds=60)`` == the trailing-60 s suffix of the
    whole-file keep-set. Span is **not** a multiple of 400 ms — the case where a re-zeroed
    *local* grid would pick different frames than the *global* grid.
    """
    # ~90.123 s @ ~22 fps. 90123 ms is NOT a multiple of the 400 ms sampling period.
    ts = _vfr_timestamps_ms(total_ms=90_123.0, n=2000, seed=20260619)
    assert (ts[-1] - ts[0]) > _TAIL_MS  # the tail bound must actually bite
    assert ts[-1] % _SAMPLE_PERIOD_MS != 0.0

    global_keep = _timestamp_keep_indices(ts)  # whole-file grid, anchored at t=0
    tail_keep = _timestamp_keep_indices(ts, tail_seconds=_TAIL_S)  # tail option under test

    # The locked invariant (tasks.md T006 assertion 1): ts is in milliseconds.
    expected = [i for i in global_keep if ts[i] >= ts[-1] - _TAIL_MS]
    assert tail_keep == expected

    # Stated equivalently: it is a CONTIGUOUS suffix, every pick is inside the window, and it
    # genuinely trimmed (non-empty, strictly fewer than the whole-file selection).
    assert tail_keep == global_keep[len(global_keep) - len(tail_keep):]
    assert all(ts[i] >= ts[-1] - _TAIL_MS for i in tail_keep)
    assert 0 < len(tail_keep) < len(global_keep)


def test_tail_window_is_not_a_rezeroed_substream_resample():
    """The guard has teeth: a re-zeroed **local** grid (the B2 phase reset) picks a DIFFERENT
    set on this fixture, so a regression to trim-and-resample would fail assertion 1."""
    ts = _vfr_timestamps_ms(total_ms=90_123.0, n=2000, seed=20260619)
    tail_keep = _timestamp_keep_indices(ts, tail_seconds=_TAIL_S)

    # Re-zero the trailing window to its own t=0 and resample (what the option MUST NOT do).
    start = tail_keep[0]
    local_ts = [ts[i] - ts[start] for i in range(start, len(ts))]
    rezeroed_keep = [start + j for j in _timestamp_keep_indices(local_ts)]

    # Different frames -> the suffix invariant (assertion 1) is a real constraint, not tautology.
    assert rezeroed_keep != tail_keep


# ======================================================================================
# Assertion 2 — degenerate case: a clip <= tail_seconds reduces EXACTLY to compute_anchor
# ======================================================================================


class _LM:
    __slots__ = ("x", "y")

    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y


class _Face:
    def __init__(self, landmark: list[_LM]) -> None:
        self.landmark = landmark


class _Result:
    def __init__(self, faces: list[_Face]) -> None:
        self.multi_face_landmarks = faces


class FakeFaceMesh:
    """Deterministic scripted landmarker (all points in [0.3, 0.7] so every ROI box is valid)."""

    def __init__(self) -> None:
        self._t = 0

    def process(self, _rgb):  # noqa: ANN001 - mirrors mediapipe signature
        t = self._t
        self._t += 1
        landmarks = [
            _LM(
                0.3 + 0.4 * (((i * 7 + t * 3) % 100) / 100.0),
                0.3 + 0.4 * (((i * 11 + t * 5) % 100) / 100.0),
            )
            for i in range(N_LANDMARKS)
        ]
        return _Result([_Face(landmarks)])

    def close(self) -> None:
        pass


@pytest.fixture
def short_cfr_clip(tmp_path):
    """A deterministic 90-frame / 30 fps (~3 s) MJPG clip — well under the 60 s tail bound."""
    path = tmp_path / "short.avi"
    h = w = 128
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), 30.0, (w, h))
    assert writer.isOpened(), "could not open VideoWriter (MJPG)"
    ys, xs = np.mgrid[0:h, 0:w]
    for t in range(90):
        plane = ((xs * 2 + ys * 3 + t) % 256).astype(np.uint8)
        writer.write(np.dstack([plane, plane, plane]))
    writer.release()
    return path


def test_clip_shorter_than_tail_is_bit_identical_to_compute_anchor(short_cfr_clip, monkeypatch):
    """On a clip <= tail_seconds, compute_anchor(path, tail_seconds=60) == compute_anchor(path),
    bit-for-bit — the cutoff falls before t=0 so every frame survives the filter."""
    monkeypatch.setattr(pipeline, "_build_face_mesh", FakeFaceMesh)
    # The 7-kept-frame fixture is below the 006 coverage floor by design; bypass the gate (the
    # gate is exercised in test_usable_face_coverage_gate.py). This pins the reduce-to path only.
    monkeypatch.setattr(coverage, "MIN_USABLE_FRAMES", 0)
    monkeypatch.setattr(coverage, "MIN_COVERAGE_FRACTION", 0.0)

    direct = compute_anchor(short_cfr_clip)
    tailed = compute_anchor(short_cfr_clip, tail_seconds=_TAIL_S)

    assert tailed.shape == (FEATURE_DIM,)
    assert np.array_equal(direct, tailed)


# ======================================================================================
# Assertion 3 — decode-based bound on the real >60 s continuous fixture (LOCAL-ONLY)
# ======================================================================================

_CONTINUOUS_FIXTURE = (
    Path(__file__).parent
    / "fixtures"
    / "multiclip"
    / "chrome-singlesource"
    / "continuous.webm"
)

_SKIP_REASON = (
    "continuous fixture absent (gitignored, ~21 MB) — local-only; "
    "the CI-runnable guard is the synthetic suffix invariant above"
)


@pytest.mark.skipif(not _CONTINUOUS_FIXTURE.exists(), reason=_SKIP_REASON)
def test_tail_window_keeps_only_trailing_60s_on_real_continuous_clip():
    """On the real >60 s continuous webm, the tail keeps ONLY the trailing-60 s frames
    (timestamp >= duration - 60), and the public entry returns a well-formed (2958,) vector.
    Decode-bound -> cannot run in CI (fixture gitignored); assertion 1 is the CI guard."""
    fps, _fc, _w, _h, ts = _probe_timestamps(_CONTINUOUS_FIXTURE)
    assert (ts[-1] - ts[0]) > _TAIL_MS, "fixture must be >60 s for the tail bound to bite"

    global_keep = _select_keep_indices(len(ts), fps, ts)
    tail_keep = _select_keep_indices(len(ts), fps, ts, tail_seconds=_TAIL_S)
    cutoff = ts[-1] - _TAIL_MS

    # Keeps ONLY trailing-60 s frames, and exactly the suffix of the file-global selection.
    assert tail_keep == [i for i in global_keep if ts[i] >= cutoff]
    assert all(ts[i] >= cutoff for i in tail_keep)
    assert 0 < len(tail_keep) < len(global_keep)

    # The public entry produces a well-formed vector from the trailing window.
    vec = compute_anchor(_CONTINUOUS_FIXTURE, tail_seconds=_TAIL_S)
    assert vec.shape == (FEATURE_DIM,)
    assert np.all(np.isfinite(vec))
