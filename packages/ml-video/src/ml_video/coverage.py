"""Usable-face-coverage gate for the baseline/anchor capture path (feature 006).

Modality logic lives in this package (Constitution Principle III). The gate counts
frames with a detected face — a NON-ZERO landmark row, the same predicate
``features.lbp_top_features`` uses to skip no-detection frames — and rejects a
capture that clears too few usable frames OR too little coverage. It runs in
``anchor.compute_anchor`` BEFORE the existing degenerate floors (LBP-TOP ≥1 usable
frame per ROI; motion ≥2 kept frames), so it is **additive and strictly stricter**,
never loosening them. See specs/006-calibration-capture-quality/contracts/gate.md.
"""

from __future__ import annotations

import logging

import numpy as np

from .errors import FeatureExtractionError

logger = logging.getLogger(__name__)

# Recalibrated against four real browser-webm clips (006 DECISION-32), recorded on
# the fixed VFR-timestamp decode (DECISION-29) in the pinned env (Python 3.12.13,
# mediapipe 0.10.13). Coverage = usable/kept:
#   thin            11/150  0.073  (face ~2-3 s of the minute)   -> reject
#   good-ideal     150/150  1.000  (present, steady)             -> accept
#   good-realistic 151/151  1.000  (natural seated look-aways)   -> accept
#   half            77/150  0.513  (~30 s present / 30 s absent) -> reject (boundary)
# good-realistic held at 1.000 despite genuine look-aways — FaceMesh tracks through
# seated glances — so legitimate captures cluster at ~1.0 and a stricter gate does
# not clip them. half validates that coverage ~= fraction-of-minute-present (~0.5, as
# even-time sampling predicts), so 0.65 ~= "face present >= ~40 s of the 60 s": it
# rejects the half-absent baseline (0.513, a 0.137 margin) while both good clips clear
# it by 0.35. The anchor is the reference every later delta is measured against, so a
# half-absent baseline is rejected (incomplete / possibly biased; a redo is cheap).
# Coverage fraction is the primary lever (the face-absent bug); the absolute floor is
# the secondary backstop (too-short captures). Provisional: only one intermediate
# sample (half), so the accept-side absence tolerance (~15-20 s) is extrapolated from
# the validated linearity, not directly measured — revisit against real-user data
# (the apps/api logging config emits the reject line, so the reject rate is observable).
MIN_USABLE_FRAMES: int = 50          # floor: thin 11 < 50; half 77 & good 150 clear it
MIN_COVERAGE_FRACTION: float = 0.65  # lever: half 0.513 < 0.65 < 1.000 (both good clips)


def usable_face_coverage(landmarks: np.ndarray) -> tuple[int, int, float]:
    """Return ``(usable, kept, fraction)`` for a ``(N_kept, 956)`` landmark array.

    ``kept`` is the number of kept frames (rows); ``usable`` is the number of
    NON-ZERO rows (a detected face — the all-zero row is the pipeline's no-detection
    marker, ``pipeline._landmarks_from_result``); ``fraction = usable / kept``
    (0.0 when ``kept == 0``).
    """
    kept = int(landmarks.shape[0])
    usable = int(np.count_nonzero(np.any(landmarks, axis=1)))
    fraction = (usable / kept) if kept else 0.0
    return usable, kept, fraction


def assert_usable_face_coverage(landmarks: np.ndarray) -> None:
    """Reject the capture if it fails EITHER the absolute floor OR the coverage
    fraction (accept iff BOTH clear — FR-005/006/007).

    Raises ``FeatureExtractionError(code="insufficient_face_frames")``. The numeric
    detail (usable / kept / fraction) is emitted ONLY to the server log — never the
    exception message and never the wire (Constitution Principle I / FR-016): the
    422 ``reason`` is the categorical code alone.
    """
    usable, kept, fraction = usable_face_coverage(landmarks)
    if usable < MIN_USABLE_FRAMES or fraction < MIN_COVERAGE_FRACTION:
        logger.info(
            "usable-face-coverage reject: usable=%d kept=%d fraction=%.3f",
            usable,
            kept,
            fraction,
        )
        raise FeatureExtractionError(
            "insufficient usable face coverage", code="insufficient_face_frames"
        )
