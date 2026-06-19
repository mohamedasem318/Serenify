"""LBP-TOP (90-d) and motion (2868-d) feature extraction.

Implements MODEL_HANDOFF §3 Steps 4-5 and the locked parameters in
models/metadata.json["pipeline"]. The feature column order is contractual:
``f0..f89`` (LBP-TOP) then ``motion_0..motion_2867`` (motion), concatenated by
``ml_video.anchor.compute_anchor`` into the (2958,) vector.

Two choices are underdetermined by the handoff prose and are pinned here
explicitly (see ``# CAVEAT`` markers); they must be confirmed against the
training notebook's ``compute_anchor_from_video`` before production vectors are
trusted, because the fixture regression test guards *this* implementation, not
fidelity to the notebook:

1. Per-plane LBP histograms are L1-normalized (density, sum-to-1). This is the
   standard LBP-TOP convention and keeps the 90 LBP features on a comparable
   scale to the StandardScaler's training distribution.
2. The 30-d per-ROI block is ``[XY, XT, YT]`` and ROIs concatenate in the fixed
   order ``mouth, left_eye, right_eye`` (handoff §3 Step 4 "fixed ROI order").
"""

from __future__ import annotations

import cv2
import numpy as np
from skimage.feature import local_binary_pattern

from .errors import FeatureExtractionError

# --- Locked pipeline parameters (models/metadata.json["pipeline"]) ------------

# MediaPipe FaceMesh with refine_landmarks=True emits 478 landmarks; each row is
# flattened [x0, y0, ..., x477, y477] in normalized 0-1 coords.
N_LANDMARKS = 478
LANDMARK_DIM = N_LANDMARKS * 2  # 956

# Fixed ROI order and the MediaPipe landmark indices that bound each ROI.
ROI_ORDER = ("mouth", "left_eye", "right_eye")
ROI_LANDMARKS: dict[str, tuple[int, ...]] = {
    "mouth": (61, 291, 13, 14, 78, 308),
    "left_eye": (33, 133, 159, 145),
    "right_eye": (362, 263, 386, 374),
}

ROI_SIZE = (64, 64)  # (width, height) passed to cv2.resize
MARGIN_PX = 10

# LBP-TOP: P=8, R=1, "uniform" -> P+2 = 10 distinct codes -> 10 histogram bins.
LBP_P = 8
LBP_R = 1
LBP_METHOD = "uniform"
LBP_BINS = 10

LBP_DIM_PER_ROI = 3 * LBP_BINS  # 30 (XY + XT + YT)
LBP_DIM = len(ROI_ORDER) * LBP_DIM_PER_ROI  # 90
MOTION_DIM = LANDMARK_DIM * 3  # 2868 (mean, std, max)
FEATURE_DIM = LBP_DIM + MOTION_DIM  # 2958


def _lbp_hist(image: np.ndarray) -> np.ndarray:
    """L1-normalized histogram of uniform-LBP codes for one 2-D plane (10-d)."""
    codes = local_binary_pattern(image, LBP_P, LBP_R, method=LBP_METHOD)
    hist, _ = np.histogram(
        codes.ravel(), bins=LBP_BINS, range=(0, LBP_BINS), density=False
    )
    total = hist.sum()
    hist = hist.astype(np.float64)
    if total > 0:
        # CAVEAT(1): density-normalize each plane histogram to sum to 1.
        hist /= total
    return hist


def _lbp_top(cube: np.ndarray) -> np.ndarray:
    """LBP-TOP on a (T, 64, 64) cube -> 30-d ``[XY(10), XT(10), YT(10)]``."""
    _t, h, w = cube.shape
    # XY plane: one histogram per frame, averaged.
    xy = np.mean([_lbp_hist(cube[t]) for t in range(cube.shape[0])], axis=0)
    # XT plane: one histogram per even-indexed row (32 planes for H=64), averaged.
    xt = np.mean([_lbp_hist(cube[:, y, :]) for y in range(0, h, 2)], axis=0)
    # YT plane: one histogram per even-indexed column (32 planes for W=64), averaged.
    yt = np.mean([_lbp_hist(cube[:, :, x]) for x in range(0, w, 2)], axis=0)
    return np.concatenate([xy, xt, yt])  # (30,)


def _roi_crop(
    frame_bgr: np.ndarray, row: np.ndarray, indices: tuple[int, ...]
) -> np.ndarray | None:
    """Crop, grayscale and resize one ROI to 64x64; None if the box is degenerate."""
    h, w = frame_bgr.shape[:2]
    xs = [row[2 * i] * w for i in indices]
    ys = [row[2 * i + 1] * h for i in indices]
    x0 = max(0, int(min(xs)) - MARGIN_PX)
    y0 = max(0, int(min(ys)) - MARGIN_PX)
    x1 = min(w, int(max(xs)) + MARGIN_PX)
    y1 = min(h, int(max(ys)) + MARGIN_PX)
    if x1 <= x0 or y1 <= y0:
        return None
    crop = frame_bgr[y0:y1, x0:x1]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    # Resize with cv2's DEFAULT interpolation (INTER_LINEAR): the training
    # notebook's build_roi_video calls bare ``cv2.resize(roi, (64, 64))``. Do NOT
    # pass interpolation=cv2.INTER_AREA here — although INTER_AREA is the
    # textbook-better downscale filter, it yields different 64x64 pixels, hence
    # different LBP codes, hence a 90-d LBP-TOP block outside the feature space
    # the scaler/model were trained on. Pinned by
    # tests/test_lbp_interpolation_fidelity.py.
    return cv2.resize(gray, ROI_SIZE)


def lbp_top_features(frames: list[np.ndarray], landmarks: np.ndarray) -> np.ndarray:
    """90-d LBP-TOP across the three ROIs in fixed order.

    Zero-row frames (no face detected) are skipped per ROI. If any ROI yields
    zero valid frames the vector would be < 90-d, which the original pipeline
    silently dropped — here it raises ``FeatureExtractionError`` (handoff §3
    Step 4, §8 red-flag 6).
    """
    blocks: list[np.ndarray] = []
    for roi in ROI_ORDER:
        indices = ROI_LANDMARKS[roi]
        crops: list[np.ndarray] = []
        for frame, row in zip(frames, landmarks, strict=True):
            if not np.any(row):  # zero-row landmark => no detection => skip frame
                continue
            crop = _roi_crop(frame, row, indices)
            if crop is not None:
                crops.append(crop)
        if not crops:
            raise FeatureExtractionError(
                f"ROI '{roi}' produced no valid frames; LBP-TOP would be < 90-d"
            )
        blocks.append(_lbp_top(np.stack(crops, axis=0)))
    return np.concatenate(blocks)  # (90,)


def motion_features(landmarks: np.ndarray) -> np.ndarray:
    """2868-d motion features: mean, std, max of |frame-to-frame landmark delta|.

    Computed over the FULL landmark array, zero-rows included — the model was
    trained with that contamination and §8 red-flag 8 says not to "fix" it.
    """
    if landmarks.shape[0] < 2:
        raise FeatureExtractionError(
            "need at least 2 frames to compute motion features"
        )
    motion_abs = np.abs(np.diff(landmarks, axis=0))
    return np.concatenate(
        [
            motion_abs.mean(axis=0),
            motion_abs.std(axis=0),  # population std (ddof=0)
            motion_abs.max(axis=0),
        ]
    )  # (2868,)
