"""Video decode + downsample + MediaPipe FaceMesh landmark extraction.

Implements MODEL_HANDOFF §3 Steps 1-3. Modality logic stays inside this package
(Constitution Principle III). The mediapipe import is deferred into
``_build_face_mesh`` so that unit tests can monkeypatch the landmarker without
loading mediapipe's native runtime, and so that importing this module is cheap.
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from .errors import FeatureExtractionError
from .features import LANDMARK_DIM

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

    return DecodedClip(frames=kept, landmarks=np.asarray(rows, dtype=np.float64))
