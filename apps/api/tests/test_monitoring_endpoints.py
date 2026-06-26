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
from postgrest.exceptions import APIError

from app.services import inference
from app.services.scoring_gate import scoring_gate
from tests.conftest import make_token

SUB = "11111111-1111-1111-1111-111111111111"  # conftest make_token() default subject


# ── a configurable PostgREST fake (profiles role + get_my_anchor + session/reading IO) ──


class _Resp:
    def __init__(self, data):
        self.data = data


def _ordered(rows, order, limit):
    """Apply a PostgREST .order()/.limit() to fake rows (ISO strings sort chronologically)."""
    rows = list(rows)
    if order is not None:
        col, desc = order
        rows.sort(key=lambda r: r.get(col) or "", reverse=desc)
    if limit is not None:
        rows = rows[:limit]
    return rows


class _Query:
    def __init__(self, fake, table):
        self._fake = fake
        self._table = table
        self._op = None
        self._row = None
        self._filters: dict = {}
        self._is: dict = {}
        self._order = None
        self._limit = None

    def select(self, _cols):
        self._op = "select"
        return self

    def is_(self, col, val):
        self._is[col] = val
        return self

    def order(self, col, desc=False):
        self._order = (col, desc)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def insert(self, row, *, returning="representation"):
        self._op = "insert"
        self._row = row
        self._returning = returning
        return self

    def update(self, fields):
        self._op = "update"
        self._row = fields
        return self

    def eq(self, col, val):
        self._filters[col] = val
        return self

    def execute(self):
        return self._fake._execute(
            self._table, self._op, self._row, self._filters,
            returning=getattr(self, "_returning", "representation"),
            is_filters=self._is, order=self._order, limit=self._limit,
        )


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
        self.readings: list[dict] = []
        self.inserts: list[dict] = []
        self.updates: list[dict] = []
        self.rpc_calls: list[str] = []
        # One-shot: force the NEXT monitoring_sessions insert to raise a 23505 unique
        # violation, modelling the one-active-per-user partial unique index losing a race.
        self.fail_next_session_insert = False
        self._seq = 0

    def table(self, name):
        return _Query(self, name)

    def rpc(self, fn):
        return _Rpc(self, fn)

    def _execute(self, table, op, row, filters, returning="representation",
                 is_filters=None, order=None, limit=None):
        is_filters = is_filters or {}
        if table == "profiles" and op == "select":
            return _Resp([{"role": self.role}] if self.role else [])
        if table == "monitoring_sessions" and op == "insert":
            if self.fail_next_session_insert:
                # Model the partial unique index (one active session per user) rejecting a
                # second active row — the create route must finalize + retry, not 500.
                self.fail_next_session_insert = False
                raise APIError({
                    "code": "23505", "message": "duplicate key value violates unique "
                    'constraint "monitoring_sessions_one_active_per_user_idx"',
                    "hint": None, "details": None,
                })
            self._seq += 1
            full = {"id": f"sess-{self._seq}", "status": "active", "started_at": None,
                    "ended_at": None, **row}
            self.sessions[full["id"]] = full
            self.inserts.append({"table": table, "row": row})
            return _Resp([full])
        if table == "monitoring_sessions" and op == "select":
            sid = filters.get("id")
            if sid is not None:
                return _Resp([self.sessions[sid]] if sid in self.sessions else [])
            # Active-session lookup (get_active_session): ended_at IS NULL, newest first.
            if is_filters.get("ended_at") == "null":
                rows = [s for s in self.sessions.values() if s.get("ended_at") is None]
                return _Resp(_ordered(rows, order, limit))
            return _Resp([])
        if table == "monitoring_sessions" and op == "update":
            # RLS update-own: only an OWNED (visible) session matches; an unknown OR
            # another user's id resolves to no row, exactly as the select-own gate does.
            sid = filters.get("id")
            if sid not in self.sessions:
                return _Resp([])
            self.sessions[sid].update(row)
            self.updates.append({"table": table, "row": row, "filters": filters})
            return _Resp([self.sessions[sid]])
        if table == "window_readings" and op == "insert":
            # Mirror the real I/O boundary: window_readings withholds
            # label/stress_probability from the SELECT whitelist, so a representation
            # read-back is denied (42501). The score path MUST use return=minimal.
            if str(returning) != "minimal":
                raise AssertionError(
                    "window_readings insert must use return=minimal — a representation "
                    "read-back is denied by the SELECT column whitelist (42501)"
                )
            self.inserts.append({"table": table, "row": row})
            self.readings.append(row)  # queryable for latest_reading_at
            return _Resp([])  # minimal → PostgREST returns no representation
        if table == "window_readings" and op == "select":
            # latest_reading_at: a session's readings, time-ordered (captured_at).
            sid = filters.get("session_id")
            rows = [r for r in self.readings if r.get("session_id") == sid]
            return _Resp(_ordered(rows, order, limit))
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
    # The per-session scoring gate is module-level too; clear it so a lock bound to one
    # test's TestClient loop is never reused (under the same "sess-N" id) on the next.
    scoring_gate.clear()
    yield
    inference.buffers.clear()
    scoring_gate.clear()


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


# ── US3 slice (T043): the defensive MID-SESSION no_anchor 409 ───────────────────
#
# The create-time no_anchor 409 (a no-anchor employee can never START a session) is the
# US1 slice above (test_create_session_without_anchor_returns_409_no_anchor). This US3
# slice covers the OTHER half of SC-004: if the caller's anchor disappears AFTER the
# create-time guard, a scored window must NEVER fabricate a reading or substitute a
# global/fallback anchor — it returns the SAME 409 {"outcome":"no_anchor"} shape (a clean
# 4xx, never a 500), and persists no reading. Injected only at the real I/O boundaries
# (the ml-video extract + the get_my_anchor RPC payload on the user-context client).


def test_window_anchor_vanished_midsession_returns_409_no_anchor(client, monkeypatch):
    # Create succeeds (anchor present at start), THEN the anchor disappears: the RPC now
    # returns NULL, so score_window raises MissingAnchorError. The router must turn that
    # into the same 409 no_anchor the create route uses — never a 500 (SC-004, FR-011).
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)
    monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: 120.0)  # full window
    monkeypatch.setattr(ml_video, "compute_anchor",
                        lambda _p, tail_seconds=None: np.zeros(FEATURE_DIM))
    monkeypatch.setattr(client.app.state, "predictor", StubPredictor(proba1=0.9))
    fake.anchor_payload = None  # the anchor vanished mid-session (get_my_anchor → NULL)

    resp = _post_window(client, sid)
    assert resp.status_code == 409
    # EXACT same body as the create-time 409 — the client routes both to calibrate-first.
    assert resp.json() == {"outcome": "no_anchor"}


def test_window_without_anchor_never_persists_a_reading(client, monkeypatch):
    # SC-004 the other way round: a window scored without the user's own anchor MUST NOT
    # write a window_readings row — no reading is ever produced without the user's anchor.
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)
    monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: 120.0)
    monkeypatch.setattr(ml_video, "compute_anchor",
                        lambda _p, tail_seconds=None: np.zeros(FEATURE_DIM))
    monkeypatch.setattr(client.app.state, "predictor", StubPredictor(proba1=0.9))
    fake.anchor_payload = None

    _post_window(client, sid)
    assert not [i for i in fake.inserts if i["table"] == "window_readings"]


# ── lifecycle: PATCH status + end (US2 slice / T037) ────────────────────────────
#
# Covers the happy-path transitions (pause/resume/out-of-frame, end+reason), the
# ended-session 409 (both PATCH-on-ended and end-on-ended — a terminal session can't
# transition), RLS update-own denial of an unknown/another-user's session (→ 404), and
# the on-end eviction of the per-session in-memory smoothing buffer (no memory leak).
# Transitions only move `status`/`ended_at`/`end_reason` on the OWNED row under RLS
# update-own; camera control is client-side. The real router / require_employee /
# supabase_user / inference buffer run against the fake's RLS-modelled boundary.


def _patch_status(client, session_id, status, *, sub=SUB):
    return client.patch(
        f"/monitoring/sessions/{session_id}",
        json={"status": status},
        headers=_auth(make_token(sub=sub)),
    )


def _end_session(client, session_id, *, reason=None, sub=SUB):
    body = {"reason": reason} if reason is not None else {}
    return client.post(
        f"/monitoring/sessions/{session_id}/end",
        json=body,
        headers=_auth(make_token(sub=sub)),
    )


def test_patch_session_pauses_then_resumes(client, monkeypatch):
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)

    paused = _patch_status(client, sid, "paused")
    assert paused.status_code == 200, paused.text
    assert paused.json() == {"session_id": sid, "status": "paused"}
    assert fake.sessions[sid]["status"] == "paused"  # written through RLS update-own

    resumed = _patch_status(client, sid, "active")
    assert resumed.status_code == 200
    assert resumed.json() == {"session_id": sid, "status": "active"}
    assert fake.sessions[sid]["status"] == "active"


def test_patch_session_out_of_frame(client, monkeypatch):
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)
    resp = _patch_status(client, sid, "out_of_frame")
    assert resp.status_code == 200
    assert resp.json() == {"session_id": sid, "status": "out_of_frame"}
    assert fake.sessions[sid]["status"] == "out_of_frame"


def test_patch_rejects_ended_status_target_422(client, monkeypatch):
    # 'ended' is /end's job, never a PATCH target — the Pydantic body bars it up front.
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)
    assert _patch_status(client, sid, "ended").status_code == 422
    assert _patch_status(client, sid, "bogus").status_code == 422


def test_patch_ended_session_returns_409(client, monkeypatch):
    # Cannot transition a terminal (ended) session — clean 409, not a 500.
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)
    assert _end_session(client, sid).status_code == 200
    resp = _patch_status(client, sid, "paused")
    assert resp.status_code == 409
    assert resp.json() == {"error": "ended_session"}


def test_patch_unknown_or_foreign_session_returns_404(client, monkeypatch):
    # RLS update-own: an unknown OR another user's session is not visible → 404 (SC-004 —
    # a caller can never patch a session that isn't their own).
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    _install_fake(monkeypatch, fake)
    resp = _patch_status(client, "sess-does-not-exist", "paused")
    assert resp.status_code == 404


def test_patch_non_employee_returns_403(client, monkeypatch):
    fake = FakeClient(role="team_lead", anchor_payload=_anchor_payload())
    _install_fake(monkeypatch, fake)
    resp = _patch_status(client, "sess-1", "paused")
    assert resp.status_code == 403
    assert resp.json() == {"error": "forbidden_role"}


def test_patch_requires_auth(client):
    assert client.patch("/monitoring/sessions/sess-1", json={"status": "paused"}).status_code == 401


def test_end_session_marks_ended_default_reason_user(client, monkeypatch):
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)
    resp = _end_session(client, sid)  # empty body → default reason="user"
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["session_id"] == sid
    assert "ended_at" in body
    assert fake.sessions[sid]["status"] == "ended"
    assert fake.sessions[sid]["end_reason"] == "user"
    assert fake.sessions[sid]["ended_at"] is not None


def test_end_session_with_auto_absence_reason(client, monkeypatch):
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)
    resp = _end_session(client, sid, reason="auto_absence")
    assert resp.status_code == 200
    assert fake.sessions[sid]["status"] == "ended"
    assert fake.sessions[sid]["end_reason"] == "auto_absence"


def test_end_already_ended_session_returns_409(client, monkeypatch):
    # Ending an already-ended session is a clean 409, not a 500.
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)
    assert _end_session(client, sid).status_code == 200
    resp = _end_session(client, sid)
    assert resp.status_code == 409
    assert resp.json() == {"error": "ended_session"}


def test_end_unknown_or_foreign_session_returns_404(client, monkeypatch):
    # RLS update-own: an unknown OR another user's session is not visible → 404.
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    _install_fake(monkeypatch, fake)
    resp = _end_session(client, "sess-does-not-exist")
    assert resp.status_code == 404


def test_end_evicts_in_memory_smoothing_buffer(client, monkeypatch):
    # On end the per-session deque(maxlen=4) buffer MUST be evicted so ended sessions
    # don't leak server memory (the docstring contract on _SessionBuffers.drop).
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)
    monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: 120.0)
    monkeypatch.setattr(ml_video, "compute_anchor",
                        lambda _p, tail_seconds=None: np.zeros(FEATURE_DIM))
    monkeypatch.setattr(client.app.state, "predictor", StubPredictor(proba1=0.10))

    _post_window(client, sid)
    _post_window(client, sid)
    assert inference.buffers.scored_count(sid) == 2  # buffer populated by scored windows
    assert sid in scoring_gate._store  # the gate also holds per-session state while live

    assert _end_session(client, sid).status_code == 200
    assert inference.buffers.scored_count(sid) == 0  # evicted on end — no leak
    assert sid not in scoring_gate._store  # the gate state is dropped on end too — no leak


def test_sequential_windows_all_score_through_the_gate(client, monkeypatch):
    # Gate transparency / the HARD CONSTRAINT in the common path: a single-tab client uploads
    # one window at a time (the client back-pressure guarantees this), so EVERY window is the
    # freshest when it reaches the gate and scores — drop-stale sheds only a backlog, never the
    # newest, so warm-up still reaches its 4 scored windows on schedule. (Concurrent supersede
    # is unit-tested in test_scoring_gate.py; the sync TestClient can't drive true overlap.)
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    sid = _create_session(client, fake, monkeypatch)
    monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: 120.0)
    monkeypatch.setattr(ml_video, "compute_anchor",
                        lambda _p, tail_seconds=None: np.zeros(FEATURE_DIM))
    monkeypatch.setattr(client.app.state, "predictor", StubPredictor(proba1=0.10))

    outcomes = [_post_window(client, sid).json()["outcome"] for _ in range(4)]
    assert outcomes == ["warming_up", "warming_up", "warming_up", "reading"]  # M=4 latch holds
    assert inference.buffers.scored_count(sid) == 4  # all four scored — none falsely shed


def test_end_non_employee_returns_403(client, monkeypatch):
    fake = FakeClient(role="team_lead", anchor_payload=_anchor_payload())
    _install_fake(monkeypatch, fake)
    resp = _end_session(client, "sess-1")
    assert resp.status_code == 403
    assert resp.json() == {"error": "forbidden_role"}


def test_end_requires_auth(client):
    assert client.post("/monitoring/sessions/sess-1/end").status_code == 401


# ── one active session per user: finalize-prior-active-on-create (T0xx) ─────────
#
# Ending is client-driven, so a crash or a second tab can leave a session active
# (ended_at IS NULL) forever — which also shadows the recap's "most-recent ENDED session"
# query. Creating a new run FINALIZES any prior active session as 'abandoned' first
# (last-tab-wins), stamping ended_at at that session's last reading (the honest
# end-of-activity), or now() if it never scored — so the one-active-per-user partial
# unique index (migration 20260621000000) always holds. A concurrent insert that loses the
# index race is recovered with one finalize+retry, never a 500.


def _active(fake):
    return [s for s in fake.sessions.values() if s.get("ended_at") is None]


def test_create_finalizes_prior_active_session_at_last_reading(client, monkeypatch):
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    # A prior session left active (crash / second tab): ended_at IS NULL, and it scored.
    fake.sessions["sess-old"] = {
        "id": "sess-old", "user_id": SUB, "status": "active",
        "started_at": "2026-06-21T09:55:00+00:00", "ended_at": None,
        "end_reason": None, "model_version": "m@1",
    }
    fake.readings += [
        {"session_id": "sess-old", "user_id": SUB, "captured_at": "2026-06-21T10:00:00+00:00"},
        {"session_id": "sess-old", "user_id": SUB, "captured_at": "2026-06-21T10:00:30+00:00"},
    ]
    _install_fake(monkeypatch, fake)

    resp = client.post("/monitoring/sessions", headers=_auth(make_token(sub=SUB)))
    assert resp.status_code == 201, resp.text
    new_id = resp.json()["session_id"]

    old = fake.sessions["sess-old"]
    assert old["status"] == "ended"
    assert old["end_reason"] == "abandoned"
    assert old["ended_at"] == "2026-06-21T10:00:30+00:00"  # last reading time, NOT now()
    # exactly one active session remains — the brand-new one
    active = _active(fake)
    assert len(active) == 1 and active[0]["id"] == new_id


def test_create_finalizes_prior_active_with_no_readings_uses_now(client, monkeypatch):
    from datetime import datetime as _dt

    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    fake.sessions["sess-old"] = {  # active but never produced a reading
        "id": "sess-old", "user_id": SUB, "status": "active",
        "started_at": "2026-06-21T09:55:00+00:00", "ended_at": None,
        "end_reason": None, "model_version": "m@1",
    }
    _install_fake(monkeypatch, fake)

    resp = client.post("/monitoring/sessions", headers=_auth(make_token(sub=SUB)))
    assert resp.status_code == 201, resp.text

    old = fake.sessions["sess-old"]
    assert old["status"] == "ended" and old["end_reason"] == "abandoned"
    assert old["ended_at"] is not None
    _dt.fromisoformat(old["ended_at"])  # a real now() timestamp, since it never scored
    assert len(_active(fake)) == 1  # only the new session is active


def test_create_does_not_finalize_when_no_prior_active(client, monkeypatch):
    # The common path (no orphan): create touches nothing but the new insert.
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    _install_fake(monkeypatch, fake)
    resp = client.post("/monitoring/sessions", headers=_auth(make_token(sub=SUB)))
    assert resp.status_code == 201, resp.text
    assert fake.updates == []  # nothing finalized
    assert len(_active(fake)) == 1


def test_create_recovers_from_concurrent_active_insert_conflict(client, monkeypatch):
    # A concurrent create won the single active slot between our finalize and insert: the
    # partial unique index rejects ours with 23505. The route finalizes + retries once
    # (last-tab-wins) rather than 500-ing.
    fake = FakeClient(role="employee", anchor_payload=_anchor_payload())
    fake.fail_next_session_insert = True
    _install_fake(monkeypatch, fake)

    resp = client.post("/monitoring/sessions", headers=_auth(make_token(sub=SUB)))
    assert resp.status_code == 201, resp.text
    assert resp.json()["session_id"].startswith("sess-")


# ── CORS: the PATCH lifecycle route must survive the browser preflight ──────────
#
# web→API is always cross-origin, so every PATCH (pause / resume / out-of-frame) is
# preceded by an OPTIONS preflight. If PATCH is not in the CORS allow_methods, Starlette
# answers the preflight 400 ("Disallowed CORS method") and the real PATCH never leaves the
# browser — the lifecycle transition silently never persists. This guards that regression.

# An allowed origin (matches conftest's ALLOWED_ORIGINS=http://127.0.0.1:3000).
_ALLOWED_ORIGIN = "http://127.0.0.1:3000"


def _preflight(client, method):
    return client.options(
        "/monitoring/sessions/sess-1",
        headers={
            "Origin": _ALLOWED_ORIGIN,
            "Access-Control-Request-Method": method,
        },
    )


def test_cors_preflight_allows_patch(client):
    # The PATCH route (pause/resume/out-of-frame) must pass preflight, or the transition
    # never reaches the server (the CORS-blocked lifecycle bug).
    resp = _preflight(client, "PATCH")
    assert resp.status_code == 200, resp.text
    allowed = resp.headers.get("access-control-allow-methods", "")
    assert "PATCH" in allowed, f"PATCH missing from allow-methods: {allowed!r}"


def test_cors_preflight_allows_the_other_methods_the_web_uses(client):
    # The frontend monitoring client also issues POST (create / window / end); confirm those
    # were not regressed while adding PATCH. (GET is used by the RLS trend reads.)
    for method in ("POST", "GET"):
        resp = _preflight(client, method)
        assert resp.status_code == 200, f"{method} preflight: {resp.text}"
        assert method in resp.headers.get("access-control-allow-methods", "")
