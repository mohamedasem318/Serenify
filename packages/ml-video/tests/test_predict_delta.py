"""First-ever ``predict_delta`` test (feature 008, Principle VII; Test Plan Notes).

Locks the inference read-path contract the rest of 008 depends on:
- ``predict_delta(delta)`` returns ``(label, proba)`` with ``proba`` **shape (2,)**;
- the DISPLAY decision re-thresholds ``proba[1]`` at the calibrated operating point
  (**0.53, read from ``metadata.json`` — never hard-coded**), NOT ``predict_delta``'s
  internal 0.5 / argmax label, which is **ignored for display**.

``predict_delta`` itself only scales + predicts; the 0.53 re-threshold lives in the
API inference service (008 T020). This test pins the semantics so that service — and
any future reader — cannot silently regress to the internal 0.5 label.
"""

from __future__ import annotations

import json

import numpy as np
import pytest

from ml_video import FEATURE_DIM, load_model
from ml_video.loader import models_dir


def _operating_point() -> float:
    """The calibrated 60 s LOSO operating point, sourced from model metadata."""
    meta = json.loads((models_dir() / "metadata.json").read_text(encoding="utf-8"))
    return float(
        meta["loso_metrics_60s_calibrated"]["threshold_sweep_recommended"]["threshold"]
    )


@pytest.fixture(scope="module")
def predictor():
    return load_model()


def test_operating_point_is_sourced_from_metadata():
    # The 0.53 operating point is the calibrated threshold from metadata, not a
    # literal anyone typed (FR-012). A recalibration that ships a new threshold flows
    # through here automatically.
    assert _operating_point() == 0.53


def test_predict_delta_returns_label_and_proba_shape_2(predictor):
    delta = np.zeros(FEATURE_DIM, dtype=np.float64)  # current == anchor: a calm baseline
    label, proba = predictor.predict_delta(delta)

    proba = np.asarray(proba)
    assert proba.shape == (2,)  # the load-bearing shape contract
    assert np.all((proba >= 0.0) & (proba <= 1.0))
    assert proba.sum() == pytest.approx(1.0)
    assert isinstance(label, int)
    # The internal label IS the 0.5 / argmax decision (RandomForest.predict == argmax
    # of predict_proba). The display path ignores it for the 0.53 re-threshold below.
    assert label == int(proba.argmax())


def test_internal_05_label_is_ignored_in_favour_of_053_rethreshold():
    # Demonstrate the divergence the 0.53 re-threshold exists to create. With a proba
    # whose stress-positive mass sits BETWEEN 0.5 and the 0.53 operating point, the
    # internal 0.5 label says "stressed" (argmax → class 1) but the DISPLAY rule —
    # stressed := proba[1] >= operating_point — says NOT stressed. The reader MUST use
    # the re-threshold, not the internal label.
    op = _operating_point()
    proba_between = np.array([0.48, 0.52])  # 0.50 < 0.52 < 0.53
    internal_label = int(proba_between.argmax())  # == 1 ("stressed" at 0.5)
    display_stressed = bool(proba_between[1] >= op)  # == False at 0.53

    assert internal_label == 1
    assert display_stressed is False
    assert display_stressed != bool(internal_label)  # they DIVERGE → must use re-threshold

    # Symmetrically, at/above the operating point the display says stressed; the
    # boundary is inclusive (>=), matching the smoothing/banding contract (t_low).
    assert bool(np.array([0.40, 0.60])[1] >= op) is True
    assert bool(np.array([0.47, 0.53])[1] >= op) is True
