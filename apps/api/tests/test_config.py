"""Config fail-fast tests (feature 008 stabilization).

Locks in the regression that broke local startup: ``SUPABASE_ANON_KEY`` became a
*required* setting in Phase 3 (revised D-1), but a real ``.env`` copied before that
change lacked it, so the service died at boot with a raw ``pydantic_core``
ValidationError. The fix keeps the field REQUIRED (no posture relaxation) and only
translates the traceback into an actionable message — these tests pin both halves.
"""

from __future__ import annotations

import pytest

from app import config


def test_missing_required_env_raises_actionable_message(monkeypatch, tmp_path):
    """A missing required var yields a human-readable RuntimeError that NAMES the
    var and points at apps/api/.env — not a raw pydantic ValidationError."""
    # chdir to an empty dir so the real apps/api/.env is not picked up, leaving
    # os.environ (seeded by conftest) as the only source; then drop the one var.
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    config.get_settings.cache_clear()
    try:
        with pytest.raises(RuntimeError) as exc_info:
            config.get_settings()
        message = str(exc_info.value)
        assert "SUPABASE_ANON_KEY" in message
        assert "apps/api/.env" in message
        # The requirement is NOT relaxed — it still fails to start, just clearly.
        assert "cannot start" in message
    finally:
        config.get_settings.cache_clear()


def test_anon_key_is_still_required(monkeypatch, tmp_path):
    """Guard against a future 'just make it optional' regression: with the var
    absent and no .env fallback, settings must NOT silently construct."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    config.get_settings.cache_clear()
    try:
        with pytest.raises(RuntimeError):
            config.get_settings()
    finally:
        config.get_settings.cache_clear()
