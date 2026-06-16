"""Video decode + downsample + MediaPipe FaceMesh landmark extraction.

Implements MODEL_HANDOFF §3 Steps 1-3. Modality logic stays inside this package
(Constitution Principle III). The mediapipe import is deferred into
``_build_face_mesh`` so that unit tests can monkeypatch the landmarker without
loading mediapipe's native runtime, and so that importing this module is cheap.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from .errors import FeatureExtractionError
from .features import LANDMARK_DIM

logger = logging.getLogger(__name__)

TARGET_FPS = 5
FRAME_SKIP_MOD = 2


@dataclass
class DecodedClip:
    """Output of the decode pipeline: kept BGR frames and their landmark rows.

    ``frames[i]`` is the BGR frame whose FaceMesh landmarks are ``landmarks[i]``.
    LBP-TOP needs the pixels (``frames``); motion needs only ``landmarks``.
    """

    frames: list[np.ndarray]
    landmarks: np.ndarray  # (N_kept, 956)


def _build_face_mesh():  # pragma: no cover - exercised only with real mediapipe
    """Construct the locked FaceMesh detector (models/metadata.json["pipeline"])."""
    import mediapipe as mp

    return mp.solutions.face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,  # 478 landmarks (adds iris)
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )


def _landmarks_from_result(result) -> np.ndarray:
    """Flatten a FaceMesh result to a (956,) row; zero-row when no face detected."""
    faces = getattr(result, "multi_face_landmarks", None)
    if not faces:
        return np.zeros(LANDMARK_DIM, dtype=np.float64)
    coords = np.array([[p.x, p.y] for p in faces[0].landmark], dtype=np.float64).ravel()
    if coords.shape[0] != LANDMARK_DIM:
        # Unexpected landmark count -> treat defensively as a no-detection row.
        return np.zeros(LANDMARK_DIM, dtype=np.float64)
    return coords


def extract_landmarks(video_path) -> DecodedClip:
    """Decode ``video_path``, downsample to ~2.5 fps, and run FaceMesh per frame."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise FeatureExtractionError(f"could not open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    skip_ratio = max(1, round(fps / TARGET_FPS)) if fps and fps > 0 else 1

    # TEMPORARY (feature 006 decode diagnostic — remove/gate before merge): read-only
    # probes of the container's reported metadata. They do NOT influence decoding or the
    # sampling math (skip_ratio is unchanged); they are only echoed in the log below.
    _diag_frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    _diag_width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    _diag_height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)

    # Step 1 - keep every skip_ratio-th frame (downsample toward 5 fps).
    frames_5fps: list[np.ndarray] = []
    i = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if i % skip_ratio == 0:
            frames_5fps.append(frame)
        i += 1
    cap.release()

    # Step 2 - the %2 skip. frame_idx increments BEFORE the check, so kept frames
    # are the 5fps-stream positions 1, 3, 5, ... (handoff §3 Step 2). ~2.5 fps.
    kept: list[np.ndarray] = []
    frame_idx = 0
    for frame in frames_5fps:
        frame_idx += 1
        if frame_idx % FRAME_SKIP_MOD != 0:
            continue
        kept.append(frame)
    if not kept:
        raise FeatureExtractionError("no frames left after 5fps + %2 downsample")

    # Step 3 - FaceMesh per kept frame (BGR -> RGB).
    face_mesh = _build_face_mesh()
    rows: list[np.ndarray] = []
    try:
        for frame in kept:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rows.append(_landmarks_from_result(face_mesh.process(rgb)))
    finally:
        close = getattr(face_mesh, "close", None)
        if callable(close):
            close()

    landmarks = np.asarray(rows, dtype=np.float64)

    # TEMPORARY (feature 006 decode diagnostic — remove/gate before merge): ONE INFO
    # line per decode, SERVER-SIDE ONLY (nothing here reaches the HTTP client; the 422
    # body stays categorical — Principle I / FR-016). Confirms whether a live VFR webm
    # collapses the kept-frame count vs a CFR mp4 fixture. `usable` = non-zero rows, the
    # same detected-face predicate the coverage gate uses. Wrapped so a diagnostic error
    # can never alter extraction behaviour.
    try:
        _diag_usable = int(np.count_nonzero(np.any(landmarks, axis=1)))
        logger.info(
            "TEMP decode-diagnostic (006): container=%s reported_fps=%.3f "
            "frame_count=%d resolution=%dx%d skip_ratio=%d raw_decoded=%d "
            "kept=%d usable=%d",
            Path(str(video_path)).suffix or "?",
            fps if fps else 0.0,
            int(_diag_frame_count),
            int(_diag_width),
            int(_diag_height),
            skip_ratio,
            i,
            len(kept),
            _diag_usable,
        )
    except Exception:  # noqa: BLE001 - a diagnostic must never affect extraction
        pass

    return DecodedClip(frames=kept, landmarks=landmarks)
