"""Serenify video stress modality (LBP-TOP + motion, per-user anchor).

Public surface used by ``apps/api``:
- ``compute_anchor(video_path, tail_seconds=None)`` -> (2958,) anchor vector (raises
  FeatureExtractionError); ``tail_seconds`` bounds extraction to the trailing window
  (feature-008 continuous single-stream tail-extract — faithful by construction)
- ``probe_recorded_seconds(video_path)`` -> recorded duration in seconds (feature-008
  ``< 60 s`` warming-up gate; reuses the decode pass-1 timestamp probe)
- ``probe_window_timestamps(video_path)`` -> ``(fps, timestamps_ms)`` — the ONE ffprobe
  packet read a window request needs (gate + tail grid); pass into
  ``compute_anchor(probe=...)`` so the demux never runs twice per window. Raises
  ``FFmpegUnavailable`` when the ffprobe binary is absent (a trimmed upload must then
  fail closed — see ``compute_anchor(trimmed_upload=...)``)
- ``load_model()`` -> Predictor (startup fail-fast contract check)
- ``FeatureExtractionError``; ``FFmpegUnavailable`` (ffprobe/ffmpeg binary absent)
- ``FEATURE_DIM`` (2958)
"""

from __future__ import annotations

from .anchor import compute_anchor, probe_recorded_seconds, probe_window_timestamps
from .coverage import assert_usable_face_coverage, usable_face_coverage
from .errors import FeatureExtractionError
from .features import (
    FEATURE_DIM,
    lbp_top_features,
    motion_features,
)
from .loader import Predictor, load_model, models_dir
from .pipeline import _FFmpegUnavailable as FFmpegUnavailable

__all__ = [
    "compute_anchor",
    "probe_recorded_seconds",
    "probe_window_timestamps",
    "FFmpegUnavailable",
    "assert_usable_face_coverage",
    "usable_face_coverage",
    "load_model",
    "models_dir",
    "Predictor",
    "FeatureExtractionError",
    "FEATURE_DIM",
    "lbp_top_features",
    "motion_features",
]
