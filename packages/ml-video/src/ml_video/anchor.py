"""Anchor computation: a 60s calm-baseline clip -> the (2958,) feature vector.

This is the only path 004 invokes. It is identical to the inference feature
extraction (handoff §4) EXCEPT it does not subtract anything — anchors are
themselves absolute features. The per-user delta subtraction + predict belongs
to feature 005 and lives in ``loader.Predictor.predict_delta``.
"""

from __future__ import annotations

import numpy as np

from .coverage import assert_usable_face_coverage
from .errors import FeatureExtractionError
from .features import FEATURE_DIM, lbp_top_features, motion_features
from .pipeline import extract_landmarks


def compute_anchor(video_path) -> np.ndarray:
    """Decode + extract -> (2958,) float64. Raises ``FeatureExtractionError``.

    Raised when the usable-face-coverage gate rejects the capture
    (``code="insufficient_face_frames"`` — feature 006, too few usable face frames
    or too little coverage), when an ROI drops out (LBP-TOP < 90-d), when there are
    too few frames for motion, or when the result is otherwise malformed/non-finite
    (handoff §3 Step 4, FR-012). The caller (API) maps this to HTTP 422, never a 500.

    The coverage gate runs FIRST — immediately after extraction, before the feature
    floors — so it is additive and strictly stricter, never loosening them.
    """
    clip = extract_landmarks(video_path)
    assert_usable_face_coverage(clip.landmarks)
    features = np.concatenate(
        [
            lbp_top_features(clip.frames, clip.landmarks),  # (90,)
            motion_features(clip.landmarks),  # (2868,)
        ]
    )
    if features.shape != (FEATURE_DIM,):
        raise FeatureExtractionError(
            f"expected anchor shape ({FEATURE_DIM},), got {features.shape}"
        )
    if not np.all(np.isfinite(features)):
        raise FeatureExtractionError("anchor vector contains non-finite values")
    return features
