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

# [CALIBRATION-PENDING] — inert (gate disabled; never false-rejects) until the
# calibration task (006 T015) sets values measured against the three real fixture
# clips (thin / good-ideal / good-realistic). With these inert defaults the gate
# never fires, so wiring it changes no existing behaviour. Tests inject thresholds
# via monkeypatch; no calibrated number is committed before Phase 5.
MIN_USABLE_FRAMES: int = 0
MIN_COVERAGE_FRACTION: float = 0.0


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
