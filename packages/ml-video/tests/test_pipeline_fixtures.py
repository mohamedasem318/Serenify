"""Fixture-locked regression test for the extraction pipeline (Principle VII, DECISION-18).

Real MediaPipe is never constructed here: ``pipeline._build_face_mesh`` is
monkeypatched to a deterministic scripted landmarker, so the real decode + crop +
LBP-TOP + motion code runs against a synthetic clip without the native runtime or
network. The guard is structural + determinism rather than 2958 hardcoded floats:

- the L1-normalized LBP-TOP block (first 90) sums to exactly 9.0 (3 ROIs x 3
  density-normalized planes), which catches normalization/shape regressions;
- motion features (last 2868) are non-negative |deltas|;
- two runs over the same clip are bit-identical (determinism, FR-032 spirit).

It also asserts the loader's startup contract against the real artifacts.
"""

from __future__ import annotations

import cv2
import numpy as np
import pytest

from ml_video import compute_anchor, load_model, pipeline
from ml_video.features import FEATURE_DIM, LANDMARK_DIM, LBP_DIM, N_LANDMARKS

# --- Scripted FaceMesh stand-in ----------------------------------------------


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
    """Emits a deterministic landmark stream; all points in [0.3, 0.7] so every
    ROI bounding box is non-degenerate and well inside the frame."""

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
def synthetic_clip(tmp_path):
    """Write a deterministic 90-frame/30fps MJPG clip; returns its path.

    30fps -> skip_ratio 6 -> 15 frames at 5fps -> %2 skip -> 7 kept frames,
    enough for LBP-TOP XT/YT planes and motion diffs.
    """
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


def test_compute_anchor_shape_and_structure(synthetic_clip, monkeypatch):
    monkeypatch.setattr(pipeline, "_build_face_mesh", FakeFaceMesh)

    vec = compute_anchor(synthetic_clip)

    assert vec.shape == (FEATURE_DIM,)
    assert np.all(np.isfinite(vec))

    # LBP-TOP block: each ROI = 3 L1-normalized plane histograms -> sums to 3.0.
    lbp = vec[:LBP_DIM]
    assert lbp.shape == (90,)
    assert np.isclose(lbp.sum(), 9.0)
    for start in (0, 30, 60):
        assert np.isclose(lbp[start : start + 30].sum(), 3.0)

    # Motion block: |frame-to-frame deltas|, non-negative.
    motion = vec[LBP_DIM:]
    assert motion.shape == (FEATURE_DIM - LBP_DIM,)
    assert np.all(motion >= 0.0)


def test_compute_anchor_is_deterministic(synthetic_clip, monkeypatch):
    monkeypatch.setattr(pipeline, "_build_face_mesh", FakeFaceMesh)
    first = compute_anchor(synthetic_clip)
    second = compute_anchor(synthetic_clip)
    assert np.array_equal(first, second)


def test_landmarks_from_result_no_face_is_zero_row():
    row = pipeline._landmarks_from_result(_Result([]))
    assert row.shape == (LANDMARK_DIM,)
    assert not np.any(row)


def test_load_model_satisfies_startup_contract():
    predictor = load_model()
    assert predictor.scaler.n_features_in_ == FEATURE_DIM
    assert [int(c) for c in predictor.model.classes_] == [0, 1]
    assert predictor.model_version == "serenify-video-lbptop-motion-rf-calibrated@2.0.0"
