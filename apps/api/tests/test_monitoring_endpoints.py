"""Monitoring endpoints — US1 slice (feature 008, T024; contracts/inference-api.md).

Covers create ``201`` / **403 forbidden_role** / **409 no_anchor**; window
``warming_up`` → ``reading`` → ``skipped``; the endpoint **never returns a probability**;
and that writes are keyed to the **verified ``sub``** (RLS-as-the-user; SC-004 — no global
anchor, a caller can't reach another user's session). DB + extraction are faked; the real
``require_employee`` / router / ``supabase_user`` / inference logic runs against the fake.
RLS itself is enforced by Postgres (migration-reviewed) — here we assert the server keys
every write to the verified token ``sub`` and never to a client-supplied id.
"""

from __future__ import annotations

import base64

import ml_video
import numpy as np
import pytest
from ml_video import FEATURE_DIM, FeatureExtractionError

from app.services import inference
from tests.conftest import make_token

SUB = "11111111-1111-1111-1111-111111111111"  # conftest make_token() default subject


# ── a configurable PostgREST fake (profiles role + get_my_anchor + session/reading IO) ──


class _Resp:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, fake, table):
        self._fake = fake
        self._table = table
        self._op = None
        self._row = None
        self._filters: dict = {}

    def select(self, _cols):
        self._op = "select"
        return self

    def insert(self, row):
        self._op = "insert"
        self._row = row
        return self

    def update(self, fields):
        self._op = "update"
        self._row = fields
        return self

    def eq(self, col, val):
        self._filters[col] = val
        return self

    def execute(self):
        return self._fake._execute(self._table, self._op, self._row, self._filters)


class _Rpc:
    def __init__(self, fake, fn):
        self._fake = fake
        self._fn = fn

    def execute(self):
        self._fake.rpc_calls.append(self._fn)
        return _Resp(self._fake.anchor_payload)


class FakeClient:
    def __init__(self, *, role="employee", anchor_payload=None):
        self.role = role
        self.anchor_payload = anchor_payload
        self.sessions: dict[str, dict] = {}
        self.inserts: list[dict] = []
        self.rpc_calls: list[str] = []
        self._seq = 0

    def table(self, name):
        return _Query(self, name)

    def rpc(self, fn):
        return _Rpc(self, fn)

    def _execute(self, table, op, row, filters):
        if table == "profiles" and op == "select":
            return _Resp([{"role": self.role}] if self.role else [])
        if table == "monitoring_sessions" and op == "insert":
            self._seq += 1
            full = {"id": f"sess-{self._seq}", "status": "active", "started_at": None,
                    "ended_at": None, **row}
            self.sessions[full["id"]] = full
            self.inserts.append({"table": table, "row": row})
            return _Resp([full])
        if table == "monitoring_sessions" and op == "select":
            sid = filters.get("id")
            return _Resp([self.sessions[sid]] if sid in self.sessions else [])
        if table == "window_readings" and op == "insert":
            self.inserts.append({"table": table, "row": row})
            return _Resp([{"id": "reading-x", **row}])
        raise AssertionError(f"unexpected DB op: {table}.{op} filters={filters!r}")


class StubPredictor:
    model_version = "serenify-video-lbptop-motion-rf-calibrated@2.0.0"

    def __init__(self, proba1=0.10):
        self.proba1 = proba1

    def predict_delta(self, _delta):
        proba = np.array([1.0 - self.proba1, self.proba1])
        return int(proba.argmax()), proba


def _anchor_payload() -> str:
    return base64.b64encode(np.zeros(FEATURE_DIM, dtype="<f4").tobytes()).decode("ascii")


def _install_fake(monkeypatch, fake):
    # require_employee late-imports user_client from supabase_user; the router binds it at
    # import → patch BOTH references to hand back the one shared fake.
    monkeypatch.setattr("app.supabase_user.user_client", lambda _s, _t: fake)
    monkeypatch.setattr("app.routers.monitoring.user_client", lambda _s, _t: fake)


@pytest.fixture(autouse=True)
def _clear_buffers():
    inference.buffers.clear()
    yield
    inference.buffers.clear()


def _auth(token=None):
    return {"Authorization": f"Bearer {token or make_token()}"}


# ── create session ────────────────────────────────────────────────────────────


def test_create_session_returns_201(client, monkeypatch):
    _install_fake(monkeypatch, FakeClient(role="employee", anchor_payload=_anchor_payload()))
    resp = client.post("/monitoring/sessions", headers=_auth())
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["session_id"].startswith("sess-")
    assert body["model_version"] == "serenify-video-lbptop-motion-rf-calibrated@2.0.0"


def test_create_session_non_employee_returns_403_forbidden_role(client, monkeypatch):
    _install_fake(monkeypatch, FakeClient(role="team_lead", anchor_payload=_anchor_payload()))
    resp = client.post("/monitoring/sessions", headers=_auth())
    assert resp.status_code == 403
    assert resp.json() == {"error": "forbidden_role"}


def test_create_session_without_anchor_returns_409_no_anchor(client, monkeypatch):
    # No global/fallback anchor is ever substituted (SC-004): no anchor → 409 up front.
    _install_fake(monkeypatch, FakeClient(role="employee", anchor_payload=None))
    resp = client.post("/monitoring/sessions", headers=_auth())
    assert resp.status_code == 409
    assert resp.json() == {"outcome": "no_anchor"}


def test_create_session_keys_to_verified_sub_not_client_input(client, monkeypatch):
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    _install_fake(monkeypatch, fake)
    resp = client.post("/monitoring/sessions", headers=_auth(make_token(sub=SUB)))
    assert resp.status_code == 201
    inserted = [i["row"] for i in fake.inserts if i["table"] == "monitoring_sessions"][0]
    assert inserted["user_id"] == SUB  # keyed to the verified token sub


def test_create_session_requires_auth(client):
    assert client.post("/monitoring/sessions").status_code == 401


# ── submit window ──────────────────────────────────────────────────────────────


def _create_session(client, fake, monkeypatch):
    _install_fake(monkeypatch, fake)
    resp = client.post("/monitoring/sessions", headers=_auth(make_token(sub=SUB)))
    assert resp.status_code == 201, resp.text
    return resp.json()["session_id"]


def _post_window(client, session_id, *, content_type="video/webm"):
    return client.post(
        f"/monitoring/sessions/{session_id}/windows",
        files={"clip": ("w.webm", b"fake-video", content_type)},
        headers=_auth(make_token(sub=SUB)),
    )


def test_window_under_60s_is_warming_up(client, monkeypatch):
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)
    monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: 30.0)  # < 60 s
    monkeypatch.setattr(client.app.state, "predictor", StubPredictor())

    resp = _post_window(client, sid)
    assert resp.status_code == 200
    assert resp.json() == {"outcome": "warming_up", "captured_at": resp.json()["captured_at"]}


def test_window_progresses_warming_up_then_reading(client, monkeypatch):
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)
    monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: 120.0)  # full window
    monkeypatch.setattr(ml_video, "compute_anchor",
                        lambda _p, tail_seconds=None: np.zeros(FEATURE_DIM))
    monkeypatch.setattr(client.app.state, "predictor", StubPredictor(proba1=0.10))

    outcomes = [_post_window(client, sid).json()["outcome"] for _ in range(4)]
    assert outcomes == ["warming_up", "warming_up", "warming_up", "reading"]

    final = _post_window(client, sid).json()
    assert final["outcome"] == "reading"
    assert final["band"] == "at_ease"  # mean of 0.10s < 0.53
    assert "captured_at" in final


def test_window_skipped_on_extraction_failure(client, monkeypatch):
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)
    monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: 120.0)

    def raise_gate(_p, tail_seconds=None):
        raise FeatureExtractionError("no usable face", code="insufficient_face_frames")

    monkeypatch.setattr(ml_video, "compute_anchor", raise_gate)
    monkeypatch.setattr(client.app.state, "predictor", StubPredictor())

    resp = _post_window(client, sid)
    assert resp.status_code == 200  # skipped is routine, NOT an error
    assert resp.json() == {"outcome": "skipped", "cause": "insufficient-face"}


def test_window_never_returns_a_probability(client, monkeypatch):
    """The wire carries only the outcome union — no probability, no raw label (FR-015)."""
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)
    monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: 120.0)
    monkeypatch.setattr(ml_video, "compute_anchor",
                        lambda _p, tail_seconds=None: np.zeros(FEATURE_DIM))
    monkeypatch.setattr(client.app.state, "predictor", StubPredictor(proba1=0.9))

    body = _post_window(client, sid).json()
    assert set(body) <= {"outcome", "band", "captured_at", "cause"}
    assert "stress_probability" not in body and "label" not in body and "proba" not in body


def test_window_persists_server_only_columns_keyed_to_sub(client, monkeypatch):
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)
    monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: 120.0)
    monkeypatch.setattr(ml_video, "compute_anchor",
                        lambda _p, tail_seconds=None: np.zeros(FEATURE_DIM))
    monkeypatch.setattr(client.app.state, "predictor", StubPredictor(proba1=0.9))

    _post_window(client, sid)
    reading = [i["row"] for i in fake.inserts if i["table"] == "window_readings"][0]
    assert reading["user_id"] == SUB and reading["session_id"] == sid  # keyed to verified sub
    # server-only raw signal IS written (INSERT grant), even though the owner can't read it.
    assert reading["label"] is not None and reading["stress_probability"] is not None


def test_window_unknown_or_foreign_session_returns_404(client, monkeypatch):
    # RLS select-own → an unknown OR another user's session id both resolve to None → 404.
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    _install_fake(monkeypatch, fake)
    resp = _post_window(client, "sess-does-not-exist")
    assert resp.status_code == 404


def test_window_wrong_media_type_returns_415(client, monkeypatch):
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)
    resp = client.post(
        f"/monitoring/sessions/{sid}/windows",
        files={"clip": ("x.txt", b"nope", "text/plain")},
        headers=_auth(make_token(sub=SUB)),
    )
    assert resp.status_code == 415
    assert resp.json()["error"] == "unsupported_media_type"
