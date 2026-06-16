"""POST /anchor contract + the raw-byte-deletion privacy invariant (Principle I)."""

from __future__ import annotations

import base64
import os

import ml_video
import numpy as np
from ml_video import FeatureExtractionError, coverage, pipeline

from tests.conftest import FakeFaceMesh, NoFaceMesh, make_es256_token, make_token

FEATURE_DIM = 2958


def _post(client, token, content, content_type="video/mp4", filename="clip.mp4"):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.post(
        "/anchor",
        files={"clip": (filename, content, content_type)},
        headers=headers,
    )


def test_anchor_happy_path_returns_2958d_vector(client, valid_token, mp4_clip_bytes, monkeypatch):
    monkeypatch.setattr(pipeline, "_build_face_mesh", FakeFaceMesh)
    # The synthetic conftest clip yields only 7 kept frames — below the calibrated
    # MIN_USABLE_FRAMES floor (feature 006). This test exercises the happy 200 path
    # and the real 2958-d vector, NOT the coverage gate (proven on real .npy fixtures
    # in packages/ml-video), so disable the gate here. Mirrors test_pipeline_fixtures.py.
    monkeypatch.setattr(coverage, "MIN_USABLE_FRAMES", 0)
    monkeypatch.setattr(coverage, "MIN_COVERAGE_FRACTION", 0.0)

    resp = _post(client, valid_token, mp4_clip_bytes)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["dim"] == FEATURE_DIM
    assert body["model_version"] == "serenify-video-lbptop-motion-rf-calibrated@2.0.0"
    raw = base64.b64decode(body["vector_b64"])
    assert len(raw) == FEATURE_DIM * 4  # 11832 little-endian float32
    assert np.frombuffer(raw, dtype="<f4").shape == (FEATURE_DIM,)


def test_anchor_no_face_returns_422(client, valid_token, mp4_clip_bytes, monkeypatch):
    monkeypatch.setattr(pipeline, "_build_face_mesh", NoFaceMesh)

    resp = _post(client, valid_token, mp4_clip_bytes)

    assert resp.status_code == 422, resp.text
    assert resp.json()["error"] == "extraction_failed"


def test_anchor_coverage_gate_surfaces_categorical_reason(
    client, valid_token, mp4_clip_bytes, monkeypatch
):
    """The usable-face-coverage gate's ``code`` becomes the 422 ``reason`` verbatim,
    and NO count detail (usable/kept/fraction, or any digit) may reach the wire
    (feature 006, DECISION-31 / FR-016 / Principle I)."""

    def raise_gate(_path):
        # Message carries no counts (they live only in a server log line); the wire
        # reason is the categorical code.
        raise FeatureExtractionError(
            "insufficient usable face coverage", code="insufficient_face_frames"
        )

    monkeypatch.setattr(ml_video, "compute_anchor", raise_gate)

    resp = _post(client, valid_token, mp4_clip_bytes)

    assert resp.status_code == 422, resp.text
    # Categorical reason only — body is byte-for-byte the existing shape + the token.
    assert resp.json() == {"error": "extraction_failed", "reason": "insufficient_face_frames"}
    # FR-016: no numeric detail and no count vocabulary may leak through the body.
    body_text = resp.text
    assert not any(ch.isdigit() for ch in body_text), body_text
    for token in ("usable", "kept", "fraction"):
        assert token not in body_text, body_text


def test_anchor_legacy_error_keeps_message_reason(
    client, valid_token, mp4_clip_bytes, monkeypatch
):
    """A pre-006 extraction failure (no ``code``) still surfaces ``str(exc)`` as the
    422 reason — backward-compatible, unchanged."""

    def raise_legacy(_path):
        raise FeatureExtractionError("some message")

    monkeypatch.setattr(ml_video, "compute_anchor", raise_legacy)

    resp = _post(client, valid_token, mp4_clip_bytes)

    assert resp.status_code == 422, resp.text
    assert resp.json() == {"error": "extraction_failed", "reason": "some message"}


def test_anchor_missing_token_returns_401(client, mp4_clip_bytes):
    assert _post(client, None, mp4_clip_bytes).status_code == 401


def test_anchor_invalid_token_returns_401(client, mp4_clip_bytes):
    assert _post(client, "not-a-jwt", mp4_clip_bytes).status_code == 401


def test_anchor_expired_token_returns_401(client, mp4_clip_bytes):
    expired = make_token(exp_delta=-10)
    assert _post(client, expired, mp4_clip_bytes).status_code == 401


def test_anchor_accepts_es256_token_via_jwks(client, mp4_clip_bytes, monkeypatch, es256_keypair):
    """A Supabase-style ES256 token verifies against the JWKS public key (FR-046).

    The current Supabase signing default is asymmetric; the JWK client is stubbed
    to return our test public key (no network), proving the asymmetric branch.
    """
    from app import auth

    private_key, public_key = es256_keypair

    class _FakeSigningKey:
        key = public_key

    class _FakeJWKClient:
        def get_signing_key_from_jwt(self, _token):
            return _FakeSigningKey()

    monkeypatch.setattr(auth, "_jwk_client", lambda _url: _FakeJWKClient())
    monkeypatch.setattr(pipeline, "_build_face_mesh", FakeFaceMesh)
    # Disable the 006 coverage gate — this exercises the ES256 auth branch through a
    # real extraction, not the gate; the 7-frame synthetic clip is below the floor.
    monkeypatch.setattr(coverage, "MIN_USABLE_FRAMES", 0)
    monkeypatch.setattr(coverage, "MIN_COVERAGE_FRACTION", 0.0)

    resp = _post(client, make_es256_token(private_key), mp4_clip_bytes)

    assert resp.status_code == 200, resp.text
    assert resp.json()["dim"] == FEATURE_DIM


def test_anchor_rejects_es256_signed_by_wrong_key(
    client, mp4_clip_bytes, monkeypatch, es256_keypair
):
    """A real signature check: a token signed by a key other than the JWKS key 401s."""
    from cryptography.hazmat.primitives.asymmetric import ec

    from app import auth

    private_key, _ = es256_keypair
    foreign_public_key = ec.generate_private_key(ec.SECP256R1()).public_key()

    class _FakeSigningKey:
        key = foreign_public_key

    class _FakeJWKClient:
        def get_signing_key_from_jwt(self, _token):
            return _FakeSigningKey()

    monkeypatch.setattr(auth, "_jwk_client", lambda _url: _FakeJWKClient())

    resp = _post(client, make_es256_token(private_key), mp4_clip_bytes)

    assert resp.status_code == 401


def test_anchor_wrong_media_type_returns_415(client, valid_token):
    resp = _post(client, valid_token, b"hello", content_type="text/plain", filename="x.txt")
    assert resp.status_code == 415
    assert resp.json()["error"] == "unsupported_media_type"


def test_anchor_deletes_raw_bytes_on_success(client, valid_token, mp4_clip_bytes, monkeypatch):
    """The temp upload exists during extraction and is gone after (Principle I)."""
    captured: dict[str, object] = {}

    def fake_compute(path):
        captured["path"] = path
        captured["existed_during"] = os.path.exists(path)
        return np.zeros(FEATURE_DIM, dtype=np.float64)

    monkeypatch.setattr(ml_video, "compute_anchor", fake_compute)

    resp = _post(client, valid_token, mp4_clip_bytes)

    assert resp.status_code == 200, resp.text
    assert captured["existed_during"] is True
    assert not os.path.exists(captured["path"])  # deleted in finally
