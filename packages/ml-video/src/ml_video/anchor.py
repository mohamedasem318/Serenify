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
    motion_features_seamaware,
)
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


def compute_anchor_multiclip(clip_paths) -> np.ndarray:
    """Multi-clip variant of :func:`compute_anchor` — the feature-008 windowing path (B2).

    The live monitoring read path records the rolling 60 s window as ~6 short
    **standalone** clips: the client stops/restarts the recorder each ~10 s stride so
    every clip carries its own container init and is independently decodable (see
    ``specs/008-stress-inference-service/research.md`` R-5/R-7 — the B1
    container-reassembly path was rejected because the mid-cluster splice silently
    corrupts ``motion_features``). This decodes **each** clip through the **same**
    per-clip path :func:`compute_anchor` uses (``extract_landmarks`` → kept frames +
    FaceMesh landmark rows), concatenates the kept frames and landmark rows across the
    clips into one ~150-frame / ~60 s set, runs the **identical** coverage gate +
    ``lbp_top_features`` on that assembled set, and builds the motion block **seam-aware**
    via :func:`motion_features_seamaware` (per-clip diffs, cross-seam diffs excluded — see
    below).

    It is a thin assembly wrapper, **not** a second extraction (Constitution Principle
    III): per-clip decode/sampling, the feature-006 coverage gate, and the feature math
    are all the existing ``compute_anchor`` building blocks. The only B2-specific
    behaviour is concatenating **frames** (never muxing containers) and building the
    motion block **seam-aware**: the frame-to-frame ``np.diff`` is taken *within each
    clip* via :func:`motion_features_seamaware`, and the cross-seam diffs (last frame of
    clip N → first frame of clip N+1) are **excluded** before the mean/std/max
    aggregation. Those cross-seam jumps are stop/restart artifacts (a ~0.5–2 s recorder
    gap separates the standalone clips) absent from a true continuous stream; including
    them collapsed windowing fidelity to cosine ≈ 0.90 (vs the ≥0.999 budget), so they
    are dropped — see ``smoke-tests.md`` T009 and ``research.md`` R-5. The LBP/texture
    path, the coverage gate, and frame concatenation are unchanged.

    The remaining bounded difference from a single continuous 60 s clip is the handful of
    frames lost at each stop/restart; it is **measured** by
    ``tests/test_multiclip_fidelity.py`` (the hard fidelity gate), not silently absorbed.
    The single-clip ``compute_anchor`` / ``motion_features`` path is intentionally left
    untouched so the continuous reference and the multi-clip assembly stay comparable.

    The coverage gate runs on the **combined** landmark set (not per clip): the 60 s
    thresholds (``MIN_USABLE_FRAMES=50``, ``fraction >= 0.65``) describe a full window,
    which a single ~10 s clip could never clear on its own — running the gate on the
    assembled set is exactly what makes ``compute_anchor`` (continuous) and this
    (multi-clip) comparable, and is the equivalence the fidelity gate asserts.

    Raises ``FeatureExtractionError`` on empty input, an unreadable/empty clip, a
    coverage-gate rejection (``code="insufficient_face_frames"``), a malformed shape, or
    non-finite values — the same contract as :func:`compute_anchor`, so the API maps it
    to the skipped-window outcome (FR-013).
    """
    paths = list(clip_paths)
    if not paths:
        raise FeatureExtractionError("compute_anchor_multiclip requires at least one clip path")

    frames: list[np.ndarray] = []
    landmark_blocks: list[np.ndarray] = []
    for path in paths:
        clip = extract_landmarks(path)  # reuse the per-clip decode + FaceMesh path (Principle III)
        frames.extend(clip.frames)
        landmark_blocks.append(clip.landmarks)

    landmarks = np.concatenate(landmark_blocks, axis=0)  # (sum_i N_i, 956)

    # Gate the ASSEMBLED window (combined set), exactly as compute_anchor gates its clip.
    assert_usable_face_coverage(landmarks)
    features = np.concatenate(
        [
            lbp_top_features(frames, landmarks),  # (90,) — over the concatenated frames
            motion_features_seamaware(landmark_blocks),  # (2868,) — cross-seam diffs excluded
        ]
    )
    if features.shape != (FEATURE_DIM,):
        raise FeatureExtractionError(
            f"expected multiclip anchor shape ({FEATURE_DIM},), got {features.shape}"
        )
    if not np.all(np.isfinite(features)):
        raise FeatureExtractionError("multiclip anchor vector contains non-finite values")
    return features
