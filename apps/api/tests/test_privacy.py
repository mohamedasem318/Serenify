"""Privacy verification gate (feature 008, T055 — SC-009 / Constitution Principle I).

A *real* privacy gate, not a smoke test. Three guarantees, each of which is a hard
requirement — if any assertion here fails it is a genuine privacy leak, NOT something to
relax:

  1. **No raw video persists.** The uploaded contiguous-recording-so-far is written to a
     temp file that is deleted in ``finally`` on EVERY outcome (reading / warming-up /
     skipped / an unexpected exception), and the only cross-window state the server keeps is
     the in-memory smoothing buffer of floats — there is **no per-session clip buffer**.
  2. **No manager policy** on either ``monitoring_sessions`` or ``window_readings`` — the
     manager layer gets nothing from this feature (every RLS policy on these tables is
     owner-self-scoped).
  3. **``label`` / ``stress_probability`` are unreadable by the owner** — the
     ``window_readings`` SELECT column whitelist omits them (they are written by the INSERT
     grant but never selectable), structurally enforcing FR-015 ("no number, ever").

(1) is verified behaviorally against ``score_window``; (2) and (3) are verified statically
against the migration SQL (no live DB needed — CI-runnable). The behavioral no-read-back of
``stress_probability`` is additionally enforced in ``test_inference_service.py`` (the fake
client's ``select`` raises).
"""

from __future__ import annotations

import os
import re
import tempfile
from pathlib import Path

import ml_video
import numpy as np
import pytest
from ml_video import FEATURE_DIM, FeatureExtractionError

from app.services import inference

OP = 0.53
TENSE = 0.70

# Repo root: apps/api/tests/test_privacy.py -> parents[3] == repo root.
_MIGRATIONS = Path(__file__).resolve().parents[3] / "supabase" / "migrations"
_RLS_MIGRATION = _MIGRATIONS / "20260619000000_monitoring_sessions_and_readings.sql"
_MONITORING_TABLES = ("monitoring_sessions", "window_readings")
_SERVER_ONLY_COLUMNS = ("label", "stress_probability")
# Tokens that would indicate a manager/admin/cross-user read path on these tables.
_MANAGER_TOKENS = ("manager", "team_lead", "reports_to", "manager_id", "is_admin", "direct_report")


# ── Part A — no raw video persists (behavioral, all outcomes) ─────────────────


class _StubPredictor:
    def __init__(self, proba):
        self.proba = np.asarray(proba, dtype=np.float64)

    def predict_delta(self, delta):  # noqa: ARG002 - delta unused by the stub
        return int(self.proba.argmax()), self.proba


@pytest.fixture(autouse=True)
def _clear_buffers():
    inference.buffers.clear()
    yield
    inference.buffers.clear()


@pytest.fixture(autouse=True)
def _ffprobe_less(monkeypatch):
    """Route score_window through its ffprobe-less branch so this file's existing stubs
    (``probe_recorded_seconds`` + ``compute_anchor`` fakes without the new kwargs) keep
    working unchanged (same fixture as test_inference_service.py)."""
    def _unavailable(_p):
        raise ml_video.FFmpegUnavailable("ffprobe not found (test)")

    monkeypatch.setattr(ml_video, "probe_window_timestamps", _unavailable)


def _run_capturing_tempfiles(monkeypatch, *, duration, compute, get_anchor, predictor):
    """Run ``score_window`` while spying on every temp file it creates.

    Returns the list of temp paths created (so the caller can assert they were all deleted)
    and the list of persisted rows. ``compute`` / ``get_anchor`` drive the outcome path.
    """
    created: list[str] = []
    real_mkstemp = tempfile.mkstemp

    def spy_mkstemp(*args, **kwargs):
        fd, path = real_mkstemp(*args, **kwargs)
        created.append(path)
        return fd, path

    monkeypatch.setattr(inference.tempfile, "mkstemp", spy_mkstemp)
    monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: duration)
    monkeypatch.setattr(ml_video, "compute_anchor", compute)
    monkeypatch.setattr(inference, "get_my_anchor", get_anchor)
    rows: list[dict] = []
    monkeypatch.setattr(inference, "insert_reading", lambda _client, **row: rows.append(row))

    outcome = inference.score_window(
        clip_bytes=b"\x00\x01\x02\x03 pretend this is 60s of video",
        content_type="video/webm",
        client=object(),  # unused: get_my_anchor + insert_reading are stubbed
        predictor=predictor,
        operating_point=OP,
        tense_band=TENSE,
        session_id="sess-privacy",
        user_id="user-privacy",
    )
    return outcome, created, rows


def _features():
    return np.zeros(FEATURE_DIM, dtype=np.float64)


def test_temp_clip_deleted_on_reading_path(monkeypatch):
    outcome, created, _rows = _run_capturing_tempfiles(
        monkeypatch,
        duration=120.0,
        compute=lambda _p, tail_seconds=None: _features(),
        get_anchor=lambda _c: _features(),
        predictor=_StubPredictor([0.3, 0.7]),
    )
    assert outcome.outcome in ("reading", "warming_up")  # scored window
    assert created and all(not os.path.exists(p) for p in created)  # nothing left on disk


def test_temp_clip_deleted_on_warming_under_60s_path(monkeypatch):
    outcome, created, rows = _run_capturing_tempfiles(
        monkeypatch,
        duration=42.0,  # < 60 s → no extraction, no persistence
        compute=lambda *_a, **_k: pytest.fail("must not extract a partial window"),
        get_anchor=lambda _c: _features(),
        predictor=_StubPredictor([0.5, 0.5]),
    )
    assert outcome.outcome == "warming_up"
    assert rows == []  # partial window persists nothing
    assert created and all(not os.path.exists(p) for p in created)


def test_temp_clip_deleted_on_skipped_path(monkeypatch):
    def raise_gate(_p, tail_seconds=None):
        raise FeatureExtractionError("coverage", code="insufficient_face_frames")

    outcome, created, _rows = _run_capturing_tempfiles(
        monkeypatch,
        duration=120.0,
        compute=raise_gate,
        get_anchor=lambda _c: _features(),
        predictor=_StubPredictor([0.5, 0.5]),
    )
    assert outcome.outcome == "skipped"
    assert created and all(not os.path.exists(p) for p in created)


def test_temp_clip_deleted_on_unexpected_exception_path(monkeypatch):
    """The ``finally`` must hold even for an exception that ISN'T a FeatureExtractionError —
    e.g. the anchor vanishing mid-session (MissingAnchorError, which the router maps to 409).
    The exception propagates, but the raw clip must STILL be deleted."""
    created: list[str] = []
    real_mkstemp = tempfile.mkstemp

    def spy_mkstemp(*args, **kwargs):
        fd, path = real_mkstemp(*args, **kwargs)
        created.append(path)
        return fd, path

    monkeypatch.setattr(inference.tempfile, "mkstemp", spy_mkstemp)
    monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: 120.0)
    monkeypatch.setattr(ml_video, "compute_anchor", lambda _p, tail_seconds=None: _features())
    monkeypatch.setattr(inference, "get_my_anchor", lambda _c: None)  # → MissingAnchorError

    with pytest.raises(inference.MissingAnchorError):
        inference.score_window(
            clip_bytes=b"raw-video-bytes",
            content_type="video/webm",
            client=object(),
            predictor=_StubPredictor([0.5, 0.5]),
            operating_point=OP,
            tense_band=TENSE,
            session_id="s",
            user_id="u",
        )
    assert created and all(not os.path.exists(p) for p in created)  # deleted despite the raise


def test_no_per_session_clip_buffer_only_floats_retained(monkeypatch):
    """The only cross-window state is the in-memory smoothing buffer of floats — never the
    clip bytes. After a scored window the retained per-session state is the proba floats."""
    _outcome, created, _rows = _run_capturing_tempfiles(
        monkeypatch,
        duration=120.0,
        compute=lambda _p, tail_seconds=None: _features(),
        get_anchor=lambda _c: _features(),
        predictor=_StubPredictor([0.4, 0.6]),
    )
    assert created and all(not os.path.exists(p) for p in created)
    # White-box: the buffer holds floats (the smoothing signal), not bytes (a clip buffer).
    buffered = inference.buffers._store.get("sess-privacy")
    assert buffered is not None and len(buffered) == 1
    assert all(isinstance(v, float) for v in buffered)
    assert inference.buffers.scored_count("sess-privacy") == 1


# ── Part B — migration: no manager policy on either table (static) ────────────


def _all_migration_sql() -> str:
    return "\n".join(p.read_text(encoding="utf-8") for p in sorted(_MIGRATIONS.glob("*.sql")))


def _policies_on_monitoring_tables() -> list[tuple[str, str, str]]:
    """Every ``CREATE POLICY`` across all migrations targeting a monitoring table.

    Returns (policy_name, table, full_statement_body)."""
    sql = _all_migration_sql()
    pattern = re.compile(
        r"CREATE\s+POLICY\s+(\w+)\s+ON\s+public\.(\w+)(.*?);",
        re.IGNORECASE | re.DOTALL,
    )
    return [
        (m.group(1), m.group(2), m.group(0))
        for m in pattern.finditer(sql)
        if m.group(2) in _MONITORING_TABLES
    ]


def test_rls_force_enabled_on_both_tables():
    sql = _RLS_MIGRATION.read_text(encoding="utf-8")
    for table in _MONITORING_TABLES:
        assert re.search(rf"{table}\s+ENABLE\s+ROW LEVEL SECURITY", sql, re.IGNORECASE), table
        assert re.search(rf"{table}\s+FORCE\s+ROW LEVEL SECURITY", sql, re.IGNORECASE), table


def test_no_manager_policy_on_monitoring_tables():
    policies = _policies_on_monitoring_tables()
    assert policies, "expected RLS policies on the monitoring tables — found none"
    for name, table, body in policies:
        lowered = body.lower()
        # Every policy is self-scoped to the owner …
        assert "auth.uid() = user_id" in lowered, f"{name} on {table} is not owner-self-scoped"
        # … and none reaches for a manager / cross-user relationship.
        for token in _MANAGER_TOKENS:
            assert token not in lowered, f"{name} on {table} references a manager token: {token!r}"


def test_only_owner_self_policies_exist_on_monitoring_tables():
    names = {name for name, _table, _body in _policies_on_monitoring_tables()}
    assert names == {
        "ms_select_self",
        "ms_insert_self",
        "ms_update_self",
        "wr_select_self",
        "wr_insert_self",
    }


# ── Part C — migration: label/stress_probability unreadable by the owner ──────


def _grant_columns(sql: str, verb: str, table: str) -> set[str]:
    """The column set of a ``GRANT <verb> (cols) ON public.<table>`` statement."""
    m = re.search(
        rf"GRANT\s+{verb}\s*\(([^)]*)\)\s*ON\s+public\.{table}\b",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    assert m, f"no GRANT {verb} (...) on public.{table} found"
    return {c.strip() for c in m.group(1).split(",") if c.strip()}


def test_window_readings_select_whitelist_excludes_raw_signal():
    sql = _RLS_MIGRATION.read_text(encoding="utf-8")
    select_cols = _grant_columns(sql, "SELECT", "window_readings")
    for col in _SERVER_ONLY_COLUMNS:
        assert col not in select_cols, f"{col} must NOT be owner-SELECTable (FR-015)"
    # The coarse trend columns the owner DOES read are present.
    assert {"captured_at", "scored", "band", "skip_cause"} <= select_cols


def test_window_readings_insert_grant_includes_raw_signal():
    """The API (as the user) writes the raw signal; it stays unreadable via the SELECT
    whitelist. So INSERT must include both columns the SELECT excludes."""
    sql = _RLS_MIGRATION.read_text(encoding="utf-8")
    insert_cols = _grant_columns(sql, "INSERT", "window_readings")
    for col in _SERVER_ONLY_COLUMNS:
        assert col in insert_cols, f"{col} must be INSERTable by the API"


def test_anon_and_authenticated_revoked_before_grants():
    sql = _RLS_MIGRATION.read_text(encoding="utf-8")
    for table in _MONITORING_TABLES:
        assert re.search(
            rf"REVOKE\s+ALL\s+ON\s+public\.{table}\s+FROM\s+anon,\s*authenticated",
            sql,
            re.IGNORECASE,
        ), table


def test_get_my_anchor_is_self_scoped_security_definer():
    """The anchor is readable only server-side via a self-scoped SECURITY DEFINER function —
    never via a client SELECT, and never by anon/PUBLIC."""
    sql = _RLS_MIGRATION.read_text(encoding="utf-8")
    assert re.search(
        r"CREATE OR REPLACE FUNCTION\s+public\.get_my_anchor\(\)", sql, re.IGNORECASE
    )
    assert re.search(r"SECURITY DEFINER", sql, re.IGNORECASE)
    assert re.search(r"SET\s+search_path\s*=\s*''", sql, re.IGNORECASE)
    assert re.search(
        r"REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_my_anchor\(\)\s+FROM\s+PUBLIC,\s*anon",
        sql,
        re.IGNORECASE,
    )
    assert re.search(
        r"GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_my_anchor\(\)\s+TO\s+authenticated",
        sql,
        re.IGNORECASE,
    )
    # The function takes NO user-id parameter (so it can't be pointed at another user).
    assert re.search(r"get_my_anchor\(\)\s*\n?\s*RETURNS\s+bytea", sql, re.IGNORECASE)
