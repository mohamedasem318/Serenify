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
from .features import (
    FEATURE_DIM,
    lbp_top_features,
    motion_features,
)
from .pipeline import _probe_timestamps, extract_landmarks


def probe_recorded_seconds(video_path) -> float:
    """Recorded duration (seconds) of ``video_path`` — the server-side ``< 60 s``
    warming-up gate for the feature-008 continuous single-stream read path.

    The continuous recorder uploads the whole contiguous recording-so-far each stride;
    the server must NOT score a window until a full 60 s has accrued (the 60 s window is
    locked by Constitution Principle II / FR-002 — partial windows are never scored). The
    server measures the duration itself rather than trusting any client-supplied value.

    Reuses the decode pipeline's pass-1 timestamp probe (``_probe_timestamps``) — the same
    grab-only pass ``extract_landmarks`` already uses — so the VFR ``CAP_PROP_POS_MSEC``
    handling (reliable + monotonic on real Chrome webm) is shared, not re-copied
    (Principle III). The span is ``timestamps[-1] - timestamps[0]`` (a near-zero start on a
    continuous recording), so it measures the actual recorded length regardless of the
    container's (often garbage) reported fps. Raises ``FeatureExtractionError`` if the clip
    cannot be opened (the caller maps that to a skipped reading).

    (Under continuous upload this probe re-walks the growing clip each stride — an
    O(elapsed) cost the deferred server-side rolling decoded-frame buffer would remove;
    negligible on localhost, bounded by the 5-min session cap. See research R-5.)
    """
    _fps, _frame_count, _width, _height, timestamps_ms = _probe_timestamps(video_path)
    if len(timestamps_ms) < 2:
        return 0.0
    return (timestamps_ms[-1] - timestamps_ms[0]) / 1000.0


def compute_anchor(video_path, tail_seconds: float | None = None) -> np.ndarray:
    """Decode + extract -> (2958,) float64. Raises ``FeatureExtractionError``.

    Raised when the usable-face-coverage gate rejects the capture
    (``code="insufficient_face_frames"`` — feature 006, too few usable face frames
    or too little coverage), when an ROI drops out (LBP-TOP < 90-d), when there are
    too few frames for motion, or when the result is otherwise malformed/non-finite
    (handoff §3 Step 4, FR-012). The caller (API) maps this to HTTP 422, never a 500.

    The coverage gate runs FIRST — immediately after extraction, before the feature
    floors — so it is additive and strictly stricter, never loosening them.

    ``tail_seconds`` (feature-008 continuous single-stream tail-extract): when set, only the
    trailing ``tail_seconds`` of the clip is scored — the server uploads the whole contiguous
    recording-so-far each stride and scores its last 60 s.

    **Implementation contract (load-bearing — this is what makes the window "faithful by
    construction").** With ``tail_seconds`` set, extraction MUST sample the keep-indices on the
    **whole decoded stream's file-global grid (anchored at the file's t=0)** and then **filter**
    that global index set to frames whose timestamp ``>= duration - tail_seconds``. It MUST NOT
    trim/seek to the last ``tail_seconds`` and re-run the sampler on the sub-stream — that
    re-zeroes ``CAP_PROP_POS_MSEC`` to the sub-stream's t=0 and offsets every bucket by up to ½
    the 400 ms sampling period (the per-clip phase reset that sank B2; ``research.md`` R-5).
    Because the grid is preserved, the kept tail frames are **exactly the suffix** of the frames
    the full-file extraction would keep, so a continuous 60 s window scores identically to the
    equivalent single clip (no fidelity gate needed). This is enforced downstream in
    ``pipeline._select_keep_indices`` → ``_filter_to_tail`` (reusing the existing decode + sampler
    + features — not a second copy, Principle III) and guarded by ``tests/test_tail_window.py``.
    For ``tail_seconds=None``, or a clip shorter than ``tail_seconds``, this **reduces exactly to**
    the un-bounded ``compute_anchor``.
    """
    clip = extract_landmarks(video_path, tail_seconds=tail_seconds)
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
