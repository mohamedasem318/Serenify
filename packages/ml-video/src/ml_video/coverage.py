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

# Calibrated against three real clips (006 T013/T015, DECISION-31): thin
# 4 usable / 0.023 coverage (reject) vs good-ideal 154/1.000 and good-realistic
# 129/1.000 (accept). The values sit in a WIDE EMPTY GAP — the clips proved clean
# separation of the egregious thin case, but there is NO genuine sub-100%-coverage
# sample (good-realistic held at 1.000: FaceMesh is robust to seated glances —
# coverage drops only when the face truly leaves the frame), so these are a
# CONSERVATIVE judgment to revisit against real-user data, not a data-derived
# precise bound. Coverage fraction is the primary lever (the face-absent bug); the
# absolute floor is the secondary backstop (too-short captures).
MIN_USABLE_FRAMES: int = 50          # 4 (thin) << 50 << 129 (good-realistic, binding)
MIN_COVERAGE_FRACTION: float = 0.40  # 0.023 (thin) << 0.40 << 1.000 (both good clips)


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
