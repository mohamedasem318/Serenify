"""Honest boundary test for the usable-face-coverage gate (feature 006, FR-017/018).

The gate's own logic is NEVER mocked. Phase 3 (gate core) proves the
reject-if-either / accept-if-both logic with small hand-authored landmark arrays
and INJECTED thresholds (monkeypatched) — no calibrated number is asserted here, so
the production constants stay [CALIBRATION-PENDING]/inert until Phase 5. Phase 4
(wiring) drives the REAL ``compute_anchor`` with the native FaceMesh extraction as
the only injected seam (mirrors ``test_pipeline_fixtures.py``).
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import pytest

from ml_video import compute_anchor, coverage, pipeline
from ml_video.errors import FeatureExtractionError
from ml_video.features import FEATURE_DIM, LANDMARK_DIM, N_LANDMARKS

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def _fixture(name: str) -> np.ndarray:
    return np.load(FIXTURES / f"{name}.npy")


def _landmarks(presence: list[bool]) -> np.ndarray:
    """(len(presence), 956) landmark array. A True row is a detected face (non-zero,
    varied coords in [0.3, 0.7] — a faithful face row); a False row is the pipeline's
    exact no-detection row (all zeros)."""
    arr = np.zeros((len(presence), LANDMARK_DIM), dtype=np.float64)
    template = 0.3 + 0.4 * ((np.arange(LANDMARK_DIM) % 50) / 50.0)
    for i, present in enumerate(presence):
        if present:
            arr[i] = template
    return arr


# ---------------------------------------------------------------------------
# Phase 3 / Step 1 (T004): gate logic — reject if EITHER fails, accept iff BOTH.
# Thresholds are injected via monkeypatch; the gate's own logic is real.
# ---------------------------------------------------------------------------


def test_usable_face_coverage_counts():
    lm = _landmarks([True, True, False, True, False])  # 3 usable of 5
    usable, kept, fraction = coverage.usable_face_coverage(lm)
    assert (usable, kept) == (3, 5)
    assert fraction == pytest.approx(3 / 5)


def test_absolute_floor_rejects_even_at_full_coverage(monkeypatch):
    # usable=3 at full coverage — fails ONLY the absolute floor.
    monkeypatch.setattr(coverage, "MIN_USABLE_FRAMES", 5)
    monkeypatch.setattr(coverage, "MIN_COVERAGE_FRACTION", 0.5)
    lm = _landmarks([True, True, True])  # usable=3, kept=3, fraction=1.0
    with pytest.raises(FeatureExtractionError) as exc:
        coverage.assert_usable_face_coverage(lm)
    assert exc.value.code == "insufficient_face_frames"


def test_coverage_fraction_rejects_even_with_nontrivial_usable(monkeypatch):
    # usable=4 but coverage 0.4 — fails ONLY the coverage fraction.
    monkeypatch.setattr(coverage, "MIN_USABLE_FRAMES", 3)
    monkeypatch.setattr(coverage, "MIN_COVERAGE_FRACTION", 0.5)
    lm = _landmarks([True, False, True, False, True, False, True, False, False, False])
    with pytest.raises(FeatureExtractionError) as exc:
        coverage.assert_usable_face_coverage(lm)
    assert exc.value.code == "insufficient_face_frames"


def test_accepts_when_both_clear(monkeypatch):
    monkeypatch.setattr(coverage, "MIN_USABLE_FRAMES", 3)
    monkeypatch.setattr(coverage, "MIN_COVERAGE_FRACTION", 0.5)
    lm = _landmarks([True] * 9 + [False])  # usable=9, kept=10, fraction=0.9
    coverage.assert_usable_face_coverage(lm)  # must NOT raise


def test_reject_message_is_count_free(monkeypatch):
    # Privacy (FR-016): counts go to the log, NEVER into the exception message.
    monkeypatch.setattr(coverage, "MIN_USABLE_FRAMES", 5)
    monkeypatch.setattr(coverage, "MIN_COVERAGE_FRACTION", 0.5)
    lm = _landmarks([True, True])
    with pytest.raises(FeatureExtractionError) as exc:
        coverage.assert_usable_face_coverage(lm)
    assert not any(ch.isdigit() for ch in str(exc.value))


# ---------------------------------------------------------------------------
# Phase 4 / Step 2 (T008-T010): the gate WIRED into compute_anchor.
# The only injected seam is the native FaceMesh extraction (mirrors
# test_pipeline_fixtures.py); the real decode + gate + (for the good clip) the real
# feature floors run. Thresholds are still injected, not the production constants.
# ---------------------------------------------------------------------------


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


def _face(t: int = 0) -> _Face:
    return _Face(
        [
            _LM(
                0.3 + 0.4 * (((i * 7 + t * 3) % 100) / 100.0),
                0.3 + 0.4 * (((i * 11 + t * 5) % 100) / 100.0),
            )
            for i in range(N_LANDMARKS)
        ]
    )


class _PartialFaceMesh:
    """Emits a detected face on the first ``n_present`` process() calls, then a
    no-face result (which the pipeline turns into an all-zero row)."""

    def __init__(self, n_present: int) -> None:
        self._t = 0
        self._n = n_present

    def process(self, _rgb):  # noqa: ANN001 - mirrors the mediapipe signature
        t = self._t
        self._t += 1
        return _Result([_face(t)]) if t < self._n else _Result([])

    def close(self) -> None:
        pass


@pytest.fixture
def synthetic_clip(tmp_path):
    """90-frame / 30fps MJPG clip -> 7 kept frames (per test_pipeline_fixtures.py)."""
    path = tmp_path / "clip.avi"
    h = w = 128
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), 30.0, (w, h))
    assert writer.isOpened(), "could not open VideoWriter (MJPG)"
    ys, xs = np.mgrid[0:h, 0:w]
    for t in range(90):
        plane = ((xs * 2 + ys * 3 + t) % 256).astype(np.uint8)
        writer.write(np.dstack([plane, plane, plane]))
    writer.release()
    return path


def test_compute_anchor_rejects_thin_clip_via_gate(synthetic_clip, monkeypatch):
    # 1 detected frame of 7 kept -> the gate must reject INSIDE compute_anchor,
    # before the feature floors (which a 1-face clip would otherwise clear).
    monkeypatch.setattr(pipeline, "_build_face_mesh", lambda: _PartialFaceMesh(1))
    monkeypatch.setattr(coverage, "MIN_USABLE_FRAMES", 3)
    monkeypatch.setattr(coverage, "MIN_COVERAGE_FRACTION", 0.5)
    with pytest.raises(FeatureExtractionError) as exc:
        compute_anchor(synthetic_clip)
    assert exc.value.code == "insufficient_face_frames"


def test_compute_anchor_accepts_detected_clip_through_gate(synthetic_clip, monkeypatch):
    # All 7 kept frames detected -> the gate passes and control reaches the real
    # feature extraction, returning the (2958,) vector.
    monkeypatch.setattr(pipeline, "_build_face_mesh", lambda: _PartialFaceMesh(99))
    monkeypatch.setattr(coverage, "MIN_USABLE_FRAMES", 1)
    monkeypatch.setattr(coverage, "MIN_COVERAGE_FRACTION", 0.5)
    vec = compute_anchor(synthetic_clip)
    assert vec.shape == (FEATURE_DIM,)
    assert np.all(np.isfinite(vec))


def test_gate_does_not_loosen_existing_floors(monkeypatch):
    # The gate PASSES (1 detected frame, full coverage) yet an EXISTING floor (motion
    # needs >=2 frames) still rejects -> the gate is additive/stricter, never a
    # replacement that loosens the floors. extract_landmarks is stubbed to a 1-frame
    # detected clip so the gate clears and control reaches the floors.
    from ml_video import anchor as anchor_mod
    from ml_video.pipeline import DecodedClip

    clip = DecodedClip(
        frames=[np.full((128, 128, 3), 127, dtype=np.uint8)],
        landmarks=_landmarks([True]),  # (1, 956), non-zero
    )
    monkeypatch.setattr(anchor_mod, "extract_landmarks", lambda _p: clip)
    monkeypatch.setattr(coverage, "MIN_USABLE_FRAMES", 1)
    monkeypatch.setattr(coverage, "MIN_COVERAGE_FRACTION", 0.5)
    with pytest.raises(FeatureExtractionError) as exc:
        compute_anchor("ignored-path")
    # Rejected by an existing floor (no gate code) — the gate let control through.
    assert exc.value.code != "insufficient_face_frames"


# ---------------------------------------------------------------------------
# Phase 5 / Step 3 (T016): the honest boundary test with the REAL calibrated
# constants (NO monkeypatch) over the committed landmark fixtures. This LOCKS the
# calibration — thin rejects, both good clips accept. CI runs NO mediapipe: only
# numpy over the committed .npy arrays (extracted once, offline, in the pinned env).
# ---------------------------------------------------------------------------


def test_real_thin_fixture_is_rejected():
    # ~2s of face in a full minute (4 usable / 172 kept / 0.023) -> rejected.
    with pytest.raises(FeatureExtractionError) as exc:
        coverage.assert_usable_face_coverage(_fixture("thin"))
    assert exc.value.code == "insufficient_face_frames"


def test_real_good_ideal_fixture_is_accepted():
    # Face present throughout (154 / 154 / 1.000) -> accepted (must NOT raise).
    coverage.assert_usable_face_coverage(_fixture("good_ideal"))


def test_real_good_realistic_fixture_is_accepted():
    # Natural brief look-aways — the binding lower bound (129 / 129 / 1.000) ->
    # accepted: the no-false-reject guarantee (SC-002).
    coverage.assert_usable_face_coverage(_fixture("good_realistic"))


def test_detected_throughout_passes_regardless_of_framing():
    # No-regression (FR-013): the gate counts face PRESENCE only, not framing — an
    # off-centre-but-detected capture (all non-zero rows) is NOT rejected here; only
    # a largely-absent face trips it, so it never overlaps the existing framing chips.
    coverage.assert_usable_face_coverage(_landmarks([True] * 60))  # 60 usable, 1.000
