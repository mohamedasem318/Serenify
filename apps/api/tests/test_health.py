"""GET /healthz + the startup fail-fast contract (DECISION-10)."""

from __future__ import annotations

import ml_video
import pytest
from fastapi.testclient import TestClient


def test_healthz_reports_ready_with_model_version(client):
    resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    assert body["model_version"] == "serenify-video-lbptop-motion-rf-calibrated@2.0.0"


def test_startup_aborts_when_model_fails_to_load(monkeypatch):
    """If load_model raises, the lifespan startup fails and the app never serves."""
    from app.main import create_app

    def boom():
        raise ValueError("scaler.n_features_in_ mismatch")

    monkeypatch.setattr(ml_video, "load_model", boom)

    with pytest.raises(ValueError):
        with TestClient(create_app()):
            pass


def test_extractor_prewarm_failure_does_not_abort_startup(monkeypatch):
    """The startup warm-up is best-effort: a failure logs and the app still serves."""
    from app.config import get_settings
    from app.main import create_app

    calls = 0

    def boom(_predictor, *, tail_seconds):
        nonlocal calls
        calls += 1
        assert tail_seconds == 60.0
        raise RuntimeError("warmup clip failed")

    monkeypatch.setenv("EXTRACTOR_PREWARM_ENABLED", "true")
    get_settings.cache_clear()
    monkeypatch.setattr(ml_video, "prewarm_extractor", boom)

    try:
        with TestClient(create_app()) as test_client:
            resp = test_client.get("/healthz")
    finally:
        get_settings.cache_clear()

    assert calls == 1
    assert resp.status_code == 200
