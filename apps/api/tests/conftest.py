"""Shared fixtures for the anchor service tests (DECISION-18, Principles VII + I).

Env is seeded BEFORE ``app`` is imported so settings validate. Real MediaPipe is
never constructed — ``pipeline._build_face_mesh`` is monkeypatched per test.
"""

from __future__ import annotations

import os
import time

# Seed env before any app import (settings are required, no defaults).
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-please-change-0123456789abcdef")
os.environ.setdefault("ALLOWED_ORIGIN", "http://127.0.0.1:3000")

import cv2  # noqa: E402
import jwt  # noqa: E402
import numpy as np  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from ml_video.features import N_LANDMARKS  # noqa: E402

TEST_SECRET = os.environ["SUPABASE_JWT_SECRET"]


# --- Scripted FaceMesh stand-ins ---------------------------------------------


class _LM:
    __slots__ = ("x", "y")

    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y


class _Result:
    def __init__(self, faces) -> None:
        self.multi_face_landmarks = faces

    def close(self) -> None:  # pragma: no cover
        pass


class FakeFaceMesh:
    """Emits valid landmarks (all in [0.3, 0.7]) -> a happy extraction."""

    def __init__(self) -> None:
        self._t = 0

    def process(self, _rgb):
        t = self._t
        self._t += 1

        class _Face:
            landmark = [
                _LM(
                    0.3 + 0.4 * (((i * 7 + t * 3) % 100) / 100.0),
                    0.3 + 0.4 * (((i * 11 + t * 5) % 100) / 100.0),
                )
                for i in range(N_LANDMARKS)
            ]

        return _Result([_Face()])

    def close(self) -> None:
        pass


class NoFaceMesh:
    """Never detects a face -> zero rows -> FeatureExtractionError -> 422."""

    def process(self, _rgb):
        return _Result(None)

    def close(self) -> None:
        pass


# --- Fixtures ----------------------------------------------------------------


@pytest.fixture(scope="session")
def mp4_clip_bytes(tmp_path_factory) -> bytes:
    """A genuine 90-frame/30fps mp4v clip as raw bytes (real video/mp4)."""
    path = tmp_path_factory.mktemp("clips") / "clip.mp4"
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 30.0, (128, 128))
    assert writer.isOpened(), "mp4v VideoWriter unavailable"
    ys, xs = np.mgrid[0:128, 0:128]
    for t in range(90):
        plane = ((xs * 2 + ys * 3 + t) % 256).astype(np.uint8)
        writer.write(np.dstack([plane, plane, plane]))
    writer.release()
    return path.read_bytes()


@pytest.fixture
def client():
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


def make_token(
    *,
    secret: str = TEST_SECRET,
    sub: str = "11111111-1111-1111-1111-111111111111",
    aud: str = "authenticated",
    exp_delta: int = 3600,
) -> str:
    return jwt.encode(
        {"sub": sub, "aud": aud, "exp": int(time.time()) + exp_delta},
        secret,
        algorithm="HS256",
    )


@pytest.fixture
def valid_token() -> str:
    return make_token()
