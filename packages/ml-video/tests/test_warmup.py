from __future__ import annotations

from pathlib import Path

import numpy as np

from ml_video import warmup
from ml_video.features import FEATURE_DIM


class _Predictor:
    def __init__(self) -> None:
        self.delta = None

    def predict_delta(self, delta):
        self.delta = np.asarray(delta)
        return 0, np.array([0.75, 0.25])


def test_prewarm_extractor_uses_tail_compute_and_predict(monkeypatch):
    calls = {}

    def write_clip(path: Path) -> None:
        calls["path"] = path
        path.write_bytes(b"synthetic")

    def compute_anchor(path, *, tail_seconds):
        calls["compute_path"] = Path(path)
        calls["tail_seconds"] = tail_seconds
        return np.ones(FEATURE_DIM, dtype=np.float64)

    monkeypatch.setattr(warmup, "_write_warmup_clip", write_clip)
    monkeypatch.setattr(warmup, "compute_anchor", compute_anchor)

    predictor = _Predictor()
    result = warmup.prewarm_extractor(predictor, tail_seconds=60.0)

    assert calls["tail_seconds"] == 60.0
    assert calls["compute_path"] == calls["path"]
    assert not calls["path"].exists()
    assert predictor.delta.shape == (FEATURE_DIM,)
    assert np.all(predictor.delta == 0.0)
    assert result.frames == warmup._FRAMES
    assert result.fps == warmup._FPS
    assert result.elapsed_s >= 0.0
