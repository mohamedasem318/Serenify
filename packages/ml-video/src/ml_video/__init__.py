"""Serenify video stress modality (LBP-TOP + motion, per-user anchor).

Public surface used by ``apps/api``:
- ``compute_anchor(video_path, tail_seconds=None)`` -> (2958,) anchor vector (raises
  FeatureExtractionError); ``tail_seconds`` bounds extraction to the trailing window
  (feature-008 continuous single-stream tail-extract — faithful by construction)
- ``probe_recorded_seconds(video_path)`` -> recorded duration in seconds (feature-008
  ``< 60 s`` warming-up gate; reuses the decode pass-1 timestamp probe)
- ``load_model()`` -> Predictor (startup fail-fast contract check)
- ``FeatureExtractionError``
- ``FEATURE_DIM`` (2958)
"""

from __future__ import annotations

from .anchor import compute_anchor, probe_recorded_seconds
from .coverage import assert_usable_face_coverage, usable_face_coverage
from .errors import FeatureExtractionError
from .features import (
    FEATURE_DIM,
    lbp_top_features,
    motion_features,
)
from .loader import Predictor, load_model, models_dir

__all__ = [
    "compute_anchor",
    "probe_recorded_seconds",
    "assert_usable_face_coverage",
    "usable_face_coverage",
    "load_model",
    "models_dir",
    "Predictor",
    "FeatureExtractionError",
    "FEATURE_DIM",
    "lbp_top_features",
    "motion_features",
]
