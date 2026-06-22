"""The inference read path (feature 008, T023; contracts/inference-api.md §2).

Stubbed predictor + anchor, no real video/model. Locks: anchor ``bytea`` → ``(2958,)``,
``delta = current − anchor``, the **0.53 re-threshold** on ``proba[1]`` (with the internal
0.5 label ignored), server-only ``label`` + ``stress_probability`` written, the smoothed
mean sourced from the **in-memory buffer across calls** (NOT a DB read of
``stress_probability``), the ``skipped`` path on ``FeatureExtractionError``, the ``< 60 s``
warming-up gate, and the temp clip deleted in ``finally``.
"""

from __future__ import annotations

import base64
import os

import ml_video
import numpy as np
import pytest
from ml_video import FEATURE_DIM, FeatureExtractionError

from app import supabase_user
from app.services import inference
from app.services.smoothing import BAND_AT_EASE, band_for_mean

OP = 0.53
TENSE = 0.70


# ── a PostgREST fake: rpc + insert work; ANY select raises (read-path guard) ──


class _Resp:
    def __init__(self, data):
        self.data = data


class _InsertExec:
    def __init__(self, row):
        self._row = row

    def execute(self):
        return _Resp([{"id": "row-id", **self._row}])


class _Table:
    def __init__(self, client, name):
        self._client = client
        self._name = name

    def insert(self, row, *, returning="representation"):
        # Mirror the real PostgREST I/O boundary: window_readings withholds
        # label/stress_probability from the SELECT whitelist, so a representation
        # read-back (INSERT … RETURNING *) is denied with 42501. The score path MUST
        # insert with return=minimal — this fake fails loudly otherwise, so the bug
        # (default representation → 500 on every window) can never silently return.
        if self._name == "window_readings" and str(returning) != "minimal":
            raise AssertionError(
                "window_readings insert must use return=minimal — a representation "
                "read-back is denied by the SELECT column whitelist (42501)"
            )
        self._client.inserts.append({"table": self._name, "row": row})
        return _InsertExec(row)

    def select(self, *cols):  # noqa: D401 - the whole point is that this must never run
        raise AssertionError(
            f"read path must NOT SELECT from {self._name} (cols={cols!r}) — "
            "the smoothing buffer is in-memory; stress_probability/label are server-only"
        )


class _Rpc:
    def __init__(self, client, fn):
        self._client = client
        self._fn = fn

    def execute(self):
        self._client.rpc_calls.append(self._fn)
        return _Resp(self._client.anchor_payload)


class FakeClient:
    """Supports ``rpc('get_my_anchor')`` and ``table(...).insert(...)``; raises on any
    ``select`` so a stray probability read-back would fail the test loudly."""

    def __init__(self, anchor_payload):
        self.anchor_payload = anchor_payload
        self.inserts: list[dict] = []
        self.rpc_calls: list[str] = []

    def table(self, name):
        return _Table(self, name)

    def rpc(self, fn):
        return _Rpc(self, fn)


class StubPredictor:
    """Returns a fixed ``proba``; ``predict_delta``'s internal label is argmax (which the
    display path must ignore). Records the delta it was handed."""

    def __init__(self, proba):
        self.proba = np.asarray(proba, dtype=np.float64)
        self.seen_delta: np.ndarray | None = None

    def predict_delta(self, delta):
        self.seen_delta = np.asarray(delta, dtype=np.float64)
        return int(self.proba.argmax()), self.proba


def _anchor_payload(vec: np.ndarray) -> str:
    """Base64 of the LE-float32 anchor — the PostgREST JSON-scalar form get_my_anchor decodes."""
    return base64.b64encode(vec.astype("<f4").tobytes()).decode("ascii")


def _decoded(vec: np.ndarray) -> np.ndarray:
    """The float32-round-tripped vector get_my_anchor will actually return."""
    return vec.astype("<f4").astype(np.float64)


@pytest.fixture(autouse=True)
def _clear_buffers():
    inference.buffers.clear()
    yield
    inference.buffers.clear()


def _score(monkeypatch, *, proba, anchor_vec, features, content_type="video/webm",
           session_id="sess-1", user_id="user-1", duration=120.0, captured_existed=None):
    """Run score_window with stubbed probe/extract/predictor/client → (outcome, client, pred)."""
    monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: duration)

    def fake_compute(path, tail_seconds=None):
        if captured_existed is not None:
            captured_existed["path"] = path
            captured_existed["existed_during"] = os.path.exists(path)
        assert tail_seconds == inference.WINDOW_SECONDS  # tail-extract the locked 60 s
        return features

    monkeypatch.setattr(ml_video, "compute_anchor", fake_compute)
    predictor = StubPredictor(proba)
    client = FakeClient(_anchor_payload(anchor_vec))
    outcome = inference.score_window(
        clip_bytes=b"fake-video",
        content_type=content_type,
        client=client,
        predictor=predictor,
        operating_point=OP,
        tense_band=TENSE,
        session_id=session_id,
        user_id=user_id,
    )
    return outcome, client, predictor


# ── anchor bytea decode → (2958,) ─────────────────────────────────────────────


def test_decode_anchor_accepts_bytes_hex_and_base64_to_2958d():
    vec = np.linspace(-1.0, 1.0, FEATURE_DIM).astype("<f4")
    raw = vec.tobytes()
    for payload in (raw, "\\x" + raw.hex(), base64.b64encode(raw).decode("ascii")):
        out = supabase_user._decode_anchor(payload)
        assert out.shape == (FEATURE_DIM,)
        assert out.dtype == np.float64


# ── delta = current − anchor ──────────────────────────────────────────────────


def test_delta_is_current_minus_anchor(monkeypatch):
    anchor = np.linspace(-2.0, 2.0, FEATURE_DIM)
    features = _decoded(anchor) + 0.25  # current = anchor + a known offset
    _outcome, _client, predictor = _score(
        monkeypatch, proba=[0.1, 0.9], anchor_vec=anchor, features=features
    )
    assert predictor.seen_delta is not None
    assert np.allclose(predictor.seen_delta, 0.25)  # delta == current − anchor


# ── the 0.53 re-threshold drives the persisted label (internal 0.5 label ignored) ──


def test_per_window_label_is_proba1_ge_operating_point_not_argmax(monkeypatch):
    anchor = np.zeros(FEATURE_DIM)
    features = _decoded(anchor)
    # proba[1] == 0.52 sits BETWEEN 0.50 and 0.53: argmax (internal label) == 1, but the
    # re-threshold says 0 (0.52 < 0.53). The persisted label MUST follow the re-threshold.
    outcome, client, predictor = _score(
        monkeypatch, proba=[0.48, 0.52], anchor_vec=anchor, features=features
    )
    assert int(predictor.proba.argmax()) == 1  # internal label says "stressed"
    row = [i["row"] for i in client.inserts if i["table"] == "window_readings"][0]
    assert row["label"] == 0  # … but the re-thresholded per-window label is 0
    assert row["stress_probability"] == pytest.approx(0.52)
    assert row["scored"] is True


def test_per_window_label_is_1_at_or_above_operating_point(monkeypatch):
    anchor = np.zeros(FEATURE_DIM)
    _outcome, client, _pred = _score(
        monkeypatch, proba=[0.40, 0.60], anchor_vec=anchor, features=_decoded(anchor)
    )
    row = [i["row"] for i in client.inserts if i["table"] == "window_readings"][0]
    assert row["label"] == 1
    assert row["stress_probability"] == pytest.approx(0.60)


# ── server-only columns written under RLS keyed to the verified user ──────────


def test_scored_row_writes_server_only_columns_keyed_to_user(monkeypatch):
    anchor = np.zeros(FEATURE_DIM)
    _outcome, client, _pred = _score(
        monkeypatch, proba=[0.3, 0.7], anchor_vec=anchor, features=_decoded(anchor),
        session_id="sess-X", user_id="user-Z",
    )
    row = [i["row"] for i in client.inserts if i["table"] == "window_readings"][0]
    assert row["user_id"] == "user-Z" and row["session_id"] == "sess-X"
    assert row["scored"] is True
    assert row["label"] is not None and row["stress_probability"] is not None
    assert client.rpc_calls == ["get_my_anchor"]  # anchor read only via the self-scoped RPC


# ── the smoothed mean comes from the in-memory buffer across calls, not the DB ──


def test_smoothed_mean_is_built_from_in_memory_buffer_across_calls(monkeypatch):
    anchor = np.zeros(FEATURE_DIM)
    features = _decoded(anchor)
    probas1 = [0.10, 0.20, 0.30, 0.40]  # mean over the 4 == 0.25 → at_ease
    outcomes = []
    for p1 in probas1:
        monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: 120.0)
        monkeypatch.setattr(ml_video, "compute_anchor", lambda _p, tail_seconds=None: features)
        # A FRESH client each call: its select() raises, so a stray DB read-back would fail.
        outcome = inference.score_window(
            clip_bytes=b"v", content_type="video/webm",
            client=FakeClient(_anchor_payload(anchor)),
            predictor=StubPredictor([1.0 - p1, p1]),
            operating_point=OP, tense_band=TENSE,
            session_id="sess-buffer", user_id="u",
        )
        outcomes.append(outcome)

    # First 3 scored → warming-up; the 4th yields a band whose mean is the BUFFERED 4.
    assert [o.outcome for o in outcomes] == ["warming_up", "warming_up", "warming_up", "reading"]
    assert outcomes[-1].band == band_for_mean(sum(probas1) / 4, t_low=OP, t_high=TENSE)
    assert outcomes[-1].band == BAND_AT_EASE  # mean 0.25 < 0.53
    # And no read-back helper exists on the data layer (the buffer is the only source).
    assert not hasattr(supabase_user, "recent_scored_proba")


# ── skipped on FeatureExtractionError (HTTP 200; routine) ─────────────────────


def test_coverage_failure_is_skipped_insufficient_face(monkeypatch):
    monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: 120.0)

    def raise_gate(_path, tail_seconds=None):
        raise FeatureExtractionError("insufficient usable face coverage",
                                     code="insufficient_face_frames")

    monkeypatch.setattr(ml_video, "compute_anchor", raise_gate)
    client = FakeClient(_anchor_payload(np.zeros(FEATURE_DIM)))
    outcome = inference.score_window(
        clip_bytes=b"v", content_type="video/webm", client=client,
        predictor=StubPredictor([0.5, 0.5]), operating_point=OP, tense_band=TENSE,
        session_id="s", user_id="u",
    )
    assert outcome.outcome == "skipped" and outcome.cause == "insufficient-face"
    row = [i["row"] for i in client.inserts if i["table"] == "window_readings"][0]
    assert row["scored"] is False and row["skip_cause"] == "insufficient-face"
    assert row.get("label") is None and row.get("stress_probability") is None


def test_generic_extraction_failure_is_skipped_our_side(monkeypatch):
    monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: 120.0)

    def raise_generic(_path, tail_seconds=None):
        raise FeatureExtractionError("decode blew up")  # no code → coarse "our-side"

    monkeypatch.setattr(ml_video, "compute_anchor", raise_generic)
    client = FakeClient(_anchor_payload(np.zeros(FEATURE_DIM)))
    outcome = inference.score_window(
        clip_bytes=b"v", content_type="video/webm", client=client,
        predictor=StubPredictor([0.5, 0.5]), operating_point=OP, tense_band=TENSE,
        session_id="s", user_id="u",
    )
    assert outcome.outcome == "skipped" and outcome.cause == "our-side"


def test_skipped_window_does_not_enter_the_buffer(monkeypatch):
    """A skip between scored windows must not advance the M=4 count (excluded from buffer)."""
    anchor = np.zeros(FEATURE_DIM)
    features = _decoded(anchor)

    def score(p1=None, skip=False):
        monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: 120.0)
        if skip:
            monkeypatch.setattr(ml_video, "compute_anchor",
                                lambda _p, tail_seconds=None: (_ for _ in ()).throw(
                                    FeatureExtractionError("x")))
            proba = [0.5, 0.5]
        else:
            monkeypatch.setattr(ml_video, "compute_anchor", lambda _p, tail_seconds=None: features)
            proba = [1.0 - p1, p1]
        return inference.score_window(
            clip_bytes=b"v", content_type="video/webm", client=FakeClient(_anchor_payload(anchor)),
            predictor=StubPredictor(proba), operating_point=OP, tense_band=TENSE,
            session_id="sess-skip", user_id="u",
        )

    assert score(p1=0.1).outcome == "warming_up"   # 1 scored
    assert score(p1=0.1).outcome == "warming_up"   # 2 scored
    assert score(skip=True).outcome == "skipped"   # excluded — still 2 scored
    assert score(p1=0.1).outcome == "warming_up"   # 3 scored
    assert score(p1=0.1).outcome == "reading"      # 4 scored → banded (skip never counted)


# ── < 60 s → warming-up, no extraction, no persistence (gate a) ───────────────


def test_recording_under_60s_is_warming_up_without_extraction(monkeypatch):
    monkeypatch.setattr(ml_video, "probe_recorded_seconds", lambda _p: 42.0)  # < WINDOW_SECONDS

    def must_not_extract(_path, tail_seconds=None):
        raise AssertionError("compute_anchor must not run before a full 60 s window")

    monkeypatch.setattr(ml_video, "compute_anchor", must_not_extract)
    client = FakeClient(_anchor_payload(np.zeros(FEATURE_DIM)))
    outcome = inference.score_window(
        clip_bytes=b"v", content_type="video/webm", client=client,
        predictor=StubPredictor([0.5, 0.5]), operating_point=OP, tense_band=TENSE,
        session_id="s", user_id="u",
    )
    assert outcome.outcome == "warming_up"
    assert client.inserts == []  # nothing persisted for a partial window


# ── temp clip deleted in finally (Principle I) ────────────────────────────────


def test_temp_clip_deleted_in_finally(monkeypatch):
    anchor = np.zeros(FEATURE_DIM)
    captured: dict = {}
    _outcome, _client, _pred = _score(
        monkeypatch, proba=[0.3, 0.7], anchor_vec=anchor, features=_decoded(anchor),
        captured_existed=captured,
    )
    assert captured["existed_during"] is True       # existed during extraction
    assert not os.path.exists(captured["path"])      # deleted in finally
