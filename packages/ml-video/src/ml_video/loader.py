"""Model + scaler loader with startup contract checks (handoff §8 red-flags 1-2).

``load_model`` is the FastAPI startup fail-fast gate (DECISION-10): the service
must refuse to boot if the scaler is missing/mismatched or the classes are
wrong. The predict path exists for feature 005 but no 004 caller invokes it.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np

from .features import FEATURE_DIM

# loader.py is at src/ml_video/loader.py; the committed artifacts live at the
# package-root models/ (parents[2]), per Constitution Principle II.
DEFAULT_MODELS_DIR = Path(__file__).resolve().parents[2] / "models"


def models_dir() -> Path:
    """Resolve the artifact directory; ``ML_VIDEO_MODELS_DIR`` overrides."""
    override = os.environ.get("ML_VIDEO_MODELS_DIR")
    return Path(override) if override else DEFAULT_MODELS_DIR


@dataclass
class Predictor:
    """Scaler + RandomForest wired together. ``model_version`` is reported by /healthz."""

    model: object
    scaler: object
    model_version: str

    def predict_delta(self, delta: np.ndarray) -> tuple[int, np.ndarray]:
        """Feature-005 path: scale a (2958,) calibrated delta and predict.

        NOT invoked anywhere in feature 004 — 004 only computes/stores anchors.
        """
        x = self.scaler.transform(np.asarray(delta, dtype=np.float64).reshape(1, -1))
        label = int(self.model.predict(x)[0])
        proba = self.model.predict_proba(x)[0]
        return label, proba


def _read_metadata(directory: Path) -> dict:
    return json.loads((directory / "metadata.json").read_text(encoding="utf-8"))


def load_model() -> Predictor:
    """Load artifacts and assert the feature/label contract; raise on any mismatch."""
    directory = models_dir()
    meta = _read_metadata(directory)
    scaler = joblib.load(directory / "scaler.joblib")
    model = joblib.load(directory / "model.joblib")

    n_features = getattr(scaler, "n_features_in_", None)
    if n_features != FEATURE_DIM:
        raise ValueError(
            f"scaler.n_features_in_ == {n_features}, expected {FEATURE_DIM} "
            "(wrong artifact or sklearn version mismatch)"
        )

    classes = [int(c) for c in getattr(model, "classes_", [])]
    if classes != [0, 1]:
        raise ValueError(f"model.classes_ == {classes}, expected [0, 1]")

    version = f"{meta['model_name']}@{meta['model_version']}"
    return Predictor(model=model, scaler=scaler, model_version=version)
