"""Best-effort extractor/model warm-up for API startup.

The live monitoring read path scores the trailing 60 s with ``compute_anchor(...,
tail_seconds=60)`` and then ``Predictor.predict_delta``.  This module builds a
small temporary clip that is known to pass the usable-face gate and pushes it
through those same public entry points so MediaPipe, LBP-TOP, and model/scaler
lazy initialization happen before the first user window.
"""

from __future__ import annotations

import os
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from skimage import data

from .anchor import compute_anchor


@dataclass(frozen=True)
class ExtractorWarmupResult:
    """Timing for one startup warm-up pass."""

    elapsed_s: float
    frames: int
    fps: float


_FRAME_SIZE = (192, 192)
_FPS = 15.0
_FRAMES = 330


def _write_warmup_clip(path: Path) -> None:
    """Write a deterministic short clip with enough detected frames for the gate."""

    source = data.astronaut()
    frame = cv2.cvtColor(source, cv2.COLOR_RGB2BGR)
    frame = cv2.resize(frame, _FRAME_SIZE)

    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), _FPS, _FRAME_SIZE)
    if not writer.isOpened():
        raise RuntimeError("could not open MJPG VideoWriter for extractor warm-up")
    try:
        for t in range(_FRAMES):
            shift = int(np.sin(t / 12.0))
            writer.write(np.roll(frame, shift, axis=1))
    finally:
        writer.release()


def prewarm_extractor(predictor: object, *, tail_seconds: float = 60.0) -> ExtractorWarmupResult:
    """Run one real extraction + predict pass and return elapsed wall time.

    Callers own best-effort error handling.  Any exception should be logged as a
    warning and must not abort API startup.
    """

    started = time.perf_counter()
    fd, tmp_path = tempfile.mkstemp(suffix=".avi")
    os.close(fd)
    try:
        _write_warmup_clip(Path(tmp_path))
        features = compute_anchor(tmp_path, tail_seconds=tail_seconds)
        _label, proba = predictor.predict_delta(features - features)
        proba = np.asarray(proba)
        if proba.shape != (2,):
            raise RuntimeError(f"predict_delta returned proba shape {proba.shape}, expected (2,)")
        return ExtractorWarmupResult(
            elapsed_s=time.perf_counter() - started,
            frames=_FRAMES,
            fps=_FPS,
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
