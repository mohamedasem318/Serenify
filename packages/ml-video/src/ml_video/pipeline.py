"""Video decode + downsample + MediaPipe FaceMesh landmark extraction.

Implements MODEL_HANDOFF §3 Steps 1-3. Modality logic stays inside this package
(Constitution Principle III). The mediapipe import is deferred into
``_build_face_mesh`` so that unit tests can monkeypatch the landmarker without
loading mediapipe's native runtime, and so that importing this module is cheap.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from .errors import FeatureExtractionError
from .features import LANDMARK_DIM

logger = logging.getLogger(__name__)

TARGET_FPS = 5
FRAME_SKIP_MOD = 2

# Effective kept rate after Step 1 (5 fps) + Step 2 (%2): 2.5 fps -> one frame every
# 400 ms. The 200 ms phase (half the period) is the time of the FIRST frame the legacy
# skip_ratio sampler keeps on constant-rate input, so the timestamp sampler reproduces
# the legacy CFR selection bit-for-bit (see _timestamp_keep_indices).
EFFECTIVE_FPS = TARGET_FPS / FRAME_SKIP_MOD     # 2.5
_SAMPLE_PERIOD_MS = 1000.0 / EFFECTIVE_FPS      # 400.0
_SAMPLE_PHASE_MS = _SAMPLE_PERIOD_MS / 2.0      # 200.0
_TS_EPSILON_MS = 1e-3                            # float guard at exact grid boundaries

# A stream is treated as constant-frame-rate (and therefore safe to sample with the
# legacy index path, preserving validated mp4 fidelity) only when its inter-frame
# intervals are near-uniform AND the container's reported fps matches the timestamps.
# Real Chrome MediaRecorder webm sits far on the other side of both (interval CoV ~1.6,
# reported fps 1000 vs true ~24); a CFR mp4/avi sits at CoV ~0.0 with an exact fps.
_CFR_INTERVAL_COV_MAX = 0.05
_FPS_REL_TOL = 0.10


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


def _index_keep_indices(n_frames: int, fps: float) -> list[int]:
    """The ORIGINAL skip_ratio selection, as explicit raw-frame indices.

    ``skip_ratio`` downsamples toward 5 fps (keep every skip_ratio-th frame), then the
    %2 step (FRAME_SKIP_MOD) halves it to ~2.5 fps. This is the shipped, model-validated
    selection; it is retained verbatim for CFR / reliable-metadata inputs so that path
    stays bit-identical (handoff §3 Steps 1-2).
    """
    skip_ratio = max(1, round(fps / TARGET_FPS)) if fps and fps > 0 else 1
    five = range(0, n_frames, skip_ratio)  # raw indices i with i % skip_ratio == 0
    return [idx for k, idx in enumerate(five, start=1) if k % FRAME_SKIP_MOD == 0]


def _timestamp_keep_indices(timestamps_ms: Sequence[float]) -> list[int]:
    """Keep the first frame that lands in each 1/2.5 s timestamp bucket.

    Driven by the frames' ACTUAL timestamps (CAP_PROP_POS_MSEC) instead of the reported
    fps, so a variable-frame-rate webm with unreliable container metadata still samples
    at a consistent ~2.5 fps. The bucket grid is phased at 200 ms so that, on a
    constant-rate stream (timestamps i*1000/fps), it selects exactly the frames the
    legacy index path keeps — preserving validated CFR fidelity. A large gap simply
    leaves intervening buckets empty (no catch-up clustering).
    """
    kept: list[int] = []
    last_bucket = -1
    for idx, t in enumerate(timestamps_ms):
        bucket = int((t - _SAMPLE_PHASE_MS + _TS_EPSILON_MS) // _SAMPLE_PERIOD_MS)
        if bucket >= 0 and bucket > last_bucket:
            kept.append(idx)
            last_bucket = bucket
    return kept


def _timestamps_reliable(timestamps_ms: Sequence[float]) -> bool:
    """True iff timestamps are usable for sampling: monotonic and spanning >0 ms."""
    arr = np.asarray(timestamps_ms, dtype=np.float64)
    if arr.size < 2:
        return False
    if not bool(np.all(np.diff(arr) >= 0)):  # non-decreasing
        return False
    return bool(arr[-1] - arr[0] > 0)


def _reported_fps_trustworthy(fps: float, timestamps_ms: Sequence[float]) -> bool:
    """True iff the stream is CFR with metadata that matches its timestamps.

    Only then is the legacy index path correct, so we keep it (bit-identical mp4). VFR
    webm fails the interval-regularity check even when its reported fps happens to be
    plausible, so it is routed to the timestamp sampler — making all webm sample at the
    same ~2.5 fps regardless of what fps the container reports.
    """
    if not fps or fps <= 0:
        return False
    arr = np.asarray(timestamps_ms, dtype=np.float64)
    diffs = np.diff(arr)
    if diffs.size == 0:
        return False
    mean = float(diffs.mean())
    if mean <= 0:
        return False
    if float(diffs.std() / mean) > _CFR_INTERVAL_COV_MAX:  # irregular intervals -> VFR
        return False
    span_s = (arr[-1] - arr[0]) / 1000.0
    true_fps = (arr.size - 1) / span_s if span_s > 0 else 0.0
    if true_fps <= 0:
        return False
    return abs(fps - true_fps) <= _FPS_REL_TOL * true_fps


def _select_keep_indices(n_frames: int, fps: float, timestamps_ms: Sequence[float]) -> list[int]:
    """Choose which raw-frame indices to keep, robust to unreliable container metadata.

    - broken timestamps (non-monotonic / zero span) -> legacy index path (no regression);
    - CFR with metadata matching the timestamps -> legacy index path (bit-identical mp4);
    - otherwise (VFR webm, garbage reported fps) -> timestamp sampler (~2.5 fps).
    """
    if not _timestamps_reliable(timestamps_ms):
        return _index_keep_indices(n_frames, fps)
    if _reported_fps_trustworthy(fps, timestamps_ms):
        return _index_keep_indices(n_frames, fps)
    return _timestamp_keep_indices(timestamps_ms)


def extract_landmarks(video_path) -> DecodedClip:
    """Decode ``video_path``, downsample to ~2.5 fps, and run FaceMesh per frame.

    Frame selection is driven by the frames' actual timestamps (CAP_PROP_POS_MSEC), not
    the container's reported fps, so a variable-frame-rate webm with unreliable metadata
    (observed fps=1000) samples at the same ~2.5 fps as a CFR mp4 — without changing the
    bit-exact selection on the CFR clips the model was validated on. See
    ``_select_keep_indices``. Decode is two-pass: pass 1 collects per-frame timestamps
    (grab only, no pixel copy) to choose the keep set; pass 2 retrieves just those frames.
    """
    fps, frame_count, width, height, timestamps_ms = _probe_timestamps(video_path)
    n_decoded = len(timestamps_ms)
    keep_set = set(_select_keep_indices(n_decoded, fps, timestamps_ms))

    # Pass 2 - retrieve only the selected frames (sequential decode; no seeking, which is
    # unreliable on VFR webm). Stop once the last kept frame is read.
    kept = _retrieve_frames(video_path, keep_set)
    if not kept:
        raise FeatureExtractionError("no frames left after downsample")

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

    # TEMPORARY (decode diagnostic — remove/gate before merge): ONE INFO line per decode,
    # SERVER-SIDE ONLY (nothing here reaches the HTTP client). Confirms a live VFR webm no
    # longer collapses the kept count vs a CFR mp4. `usable` = non-zero rows (the detected-
    # face predicate the coverage gate uses). Wrapped so a diagnostic error can never alter
    # extraction behaviour.
    try:
        reliable = _timestamps_reliable(timestamps_ms)
        sampling = (
            "index(legacy)"
            if (not reliable or _reported_fps_trustworthy(fps, timestamps_ms))
            else "timestamp(2.5fps)"
        )
        span_s = (timestamps_ms[-1] - timestamps_ms[0]) / 1000.0 if reliable else 0.0
        true_fps = (n_decoded - 1) / span_s if span_s > 0 else 0.0
        usable = int(np.count_nonzero(np.any(landmarks, axis=1)))
        logger.info(
            "TEMP decode-diagnostic: container=%s reported_fps=%.3f frame_count=%d "
            "resolution=%dx%d true_fps=%.3f sampling=%s raw_decoded=%d kept=%d usable=%d",
            Path(str(video_path)).suffix or "?",
            fps if fps else 0.0,
            int(frame_count),
            int(width),
            int(height),
            true_fps,
            sampling,
            n_decoded,
            len(kept),
            usable,
        )
    except Exception:  # noqa: BLE001 - a diagnostic must never affect extraction
        pass

    return DecodedClip(frames=kept, landmarks=landmarks)


def _probe_timestamps(video_path) -> tuple[float, float, float, float, list[float]]:
    """Pass 1: open the clip and collect per-frame timestamps without decoding pixels.

    Returns ``(reported_fps, frame_count, width, height, timestamps_ms)``. ``grab()``
    advances the decoder and updates CAP_PROP_POS_MSEC without the pixel ``retrieve()``,
    so this pass is cheaper than a full read. frame_count/width/height feed the
    TEMPORARY decode diagnostic only.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise FeatureExtractionError(f"could not open video: {video_path}")
    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        timestamps_ms: list[float] = []
        while cap.grab():
            timestamps_ms.append(cap.get(cv2.CAP_PROP_POS_MSEC))
    finally:
        cap.release()
    return fps, frame_count, width, height, timestamps_ms


def _retrieve_frames(video_path, keep_set: set[int]) -> list[np.ndarray]:
    """Pass 2: sequentially decode and return the frames whose raw index is in keep_set."""
    if not keep_set:
        return []
    last = max(keep_set)
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise FeatureExtractionError(f"could not open video: {video_path}")
    kept: list[np.ndarray] = []
    i = 0
    try:
        while i <= last:
            ok, frame = cap.read()
            if not ok:
                break
            if i in keep_set:
                kept.append(frame)
            i += 1
    finally:
        cap.release()
    return kept
