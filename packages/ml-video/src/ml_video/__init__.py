"""Serenify video stress modality (LBP-TOP + motion, per-user anchor).

Public surface used by ``apps/api``:
- ``compute_anchor(video_path)`` -> (2958,) anchor vector (raises FeatureExtractionError)
- ``compute_anchor_multiclip(clip_paths)`` -> (2958,) vector assembled from ~6 standalone
  clips (the feature-008 B2 windowing path; same contract/raises as compute_anchor)
- ``load_model()`` -> Predictor (startup fail-fast contract check)
- ``FeatureExtractionError``
- ``FEATURE_DIM`` (2958)
"""

from __future__ import annotations

from .anchor import compute_anchor, compute_anchor_multiclip
from .coverage import assert_usable_face_coverage, usable_face_coverage
from .errors import FeatureExtractionError
from .features import FEATURE_DIM, lbp_top_features, motion_features
from .loader import Predictor, load_model, models_dir

__all__ = [
    "compute_anchor",
    "compute_anchor_multiclip",
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
