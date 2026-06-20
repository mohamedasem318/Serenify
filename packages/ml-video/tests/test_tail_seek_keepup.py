"""O(stride) tail-seek decode — bit-identical fidelity guard + failure-robustness (008 keep-up).

The live read path re-decoded the whole growing recording-so-far each window just to
tail-extract the last 60 s — per-window decode cost O(elapsed), so live readings fell behind
and the lag grew. The fix decodes only the **bounded tail** each window:

  * webm (un-finalized MediaRecorder; OpenCV ``cap.set`` seek is a SILENT NO-OP — it rewinds
    to t=0): an ffmpeg ``-c copy`` lossless tail remux (`-ss <abs>`) -> OpenCV decode;
  * mp4/fMP4 (OpenCV seeks natively): ``cap.set(POS_MSEC)`` -> OpenCV decode;
  * the file-global 2.5 fps sampling grid is re-derived from a CHEAP ffprobe packet read
    (demux only, no pixel decode), so the <60 s gate + the grid never walk (decode) the
    whole clip.

Two layers of guard:
  1. **Fidelity** (local-only, ffmpeg-gated): the optimized tail decode is **bit-identical** to
     the whole-file path on the real continuous fixtures — a decode-compare, not a synthesized
     expectation. (The CI suffix-invariant stays the synthetic ``test_tail_window.py``.) Run on
     the deploy target too, so an ffmpeg version difference can't silently shift fidelity.
  2. **Failure robustness** (CI-runnable, no video): a missing ffmpeg binary degrades to the
     whole-file decode (never skips every window); a binary that runs-but-fails / a mis-seek
     raises ``FeatureExtractionError`` (the caller maps it to a skipped window, never a 500).
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import cv2
import numpy as np
import pytest

from ml_video import coverage, pipeline
from ml_video.errors import FeatureExtractionError
from ml_video.features import FEATURE_DIM, N_LANDMARKS, lbp_top_features, motion_features

_FIX = Path(__file__).parent / "fixtures" / "continuous"
_FIXTURES = [
    _FIX / "chrome" / "recording-so-far_062.webm",
    _FIX / "chrome" / "recording-so-far_122.webm",
    _FIX / "chrome" / "recording-so-far_182.webm",
    _FIX / "chrome" / "recording-so-far_241.webm",
    _FIX / "chrome" / "recording-so-far_301.webm",
    _FIX / "safari" / "recording-so-far_061.webm",
    _FIX / "safari" / "recording-so-far_062.mp4",
]
_PRESENT = [p for p in _FIXTURES if p.exists()]
_HAVE_FFMPEG = bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))
_TAIL_S = 60.0

_needs_fixtures = pytest.mark.skipif(
    not _PRESENT, reason="continuous fixtures absent (gitignored) — local-only"
)
_needs_ffmpeg = pytest.mark.skipif(
    not _HAVE_FFMPEG, reason="ffmpeg/ffprobe required for the O(stride) tail path"
)


def _features(clip: pipeline.DecodedClip) -> np.ndarray:
    return np.concatenate(
        [lbp_top_features(clip.frames, clip.landmarks), motion_features(clip.landmarks)]
    )


# ======================================================================================
# Layer 1 — bit-identical fidelity on the real fixtures (local-only, ffmpeg-gated)
# ======================================================================================


@_needs_fixtures
@_needs_ffmpeg
@pytest.mark.parametrize("fixture", _PRESENT, ids=lambda p: p.name)
def test_tail_seek_decode_is_bit_identical_to_wholefile(fixture):
    """The O(stride) tail decode == the whole-file tail decode, frame-for-frame.

    Reference = the real current whole-file path (``_extract_landmarks_wholefile``): decode
    the WHOLE clip, select the file-global tail grid, retrieve+FaceMesh. Optimized =
    ``_extract_landmarks_tail`` (ffprobe grid + bounded tail decode). Bit-identical means the
    keep-up fix changed nothing the model sees."""
    ref = _features(pipeline._extract_landmarks_wholefile(fixture, tail_seconds=_TAIL_S))
    opt = _features(pipeline._extract_landmarks_tail(fixture, tail_seconds=_TAIL_S))
    assert opt.shape == (FEATURE_DIM,)
    assert np.array_equal(opt, ref), (
        f"tail-seek decode diverged from whole-file on {fixture.name}: "
        f"max|Δ|={np.max(np.abs(opt - ref)):.6g}"
    )


@_needs_fixtures
@_needs_ffmpeg
@pytest.mark.parametrize("fixture", _PRESENT, ids=lambda p: p.name)
def test_extract_landmarks_dispatches_tail_to_optimized_path(fixture):
    """The public ``extract_landmarks(tail_seconds=60)`` yields the same vector as the
    whole-file reference (the dispatcher routes the tail through the optimized path without
    changing the output)."""
    via_public = _features(pipeline.extract_landmarks(fixture, tail_seconds=_TAIL_S))
    ref = _features(pipeline._extract_landmarks_wholefile(fixture, tail_seconds=_TAIL_S))
    assert np.array_equal(via_public, ref)


# ======================================================================================
# Layer 2 — failure robustness (CI-runnable, no video)
# ======================================================================================


class _FakeFaceMesh:
    """Deterministic scripted landmarker (all points in [0.3, 0.7] -> valid ROIs)."""

    def __init__(self) -> None:
        self._t = 0

    def process(self, _rgb):  # noqa: ANN001 - mirrors mediapipe signature
        t = self._t
        self._t += 1

        class _LM:
            __slots__ = ("x", "y")

            def __init__(self, x, y):
                self.x = x
                self.y = y

        class _Face:
            def __init__(self, lm):
                self.landmark = lm

        class _Result:
            def __init__(self, faces):
                self.multi_face_landmarks = faces

        lms = [
            _LM(0.3 + 0.4 * (((i * 7 + t * 3) % 100) / 100.0),
                0.3 + 0.4 * (((i * 11 + t * 5) % 100) / 100.0))
            for i in range(N_LANDMARKS)
        ]
        return _Result([_Face(lms)])

    def close(self):
        pass


@pytest.fixture
def short_clip(tmp_path):
    """A deterministic 90-frame / 30 fps (~3 s) MJPG clip — under the tail bound."""
    path = tmp_path / "short.avi"
    h = w = 128
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), 30.0, (w, h))
    assert writer.isOpened()
    ys, xs = np.mgrid[0:h, 0:w]
    for t in range(90):
        plane = ((xs * 2 + ys * 3 + t) % 256).astype(np.uint8)
        writer.write(np.dstack([plane, plane, plane]))
    writer.release()
    return path


def test_missing_binary_raises_ffmpeg_unavailable(monkeypatch):
    """A missing ffmpeg/ffprobe binary surfaces as ``_FFmpegUnavailable`` (not a crash), so
    callers can fall back rather than skip every window."""
    def _boom(*_a, **_k):
        raise FileNotFoundError("ffprobe")

    monkeypatch.setattr(subprocess, "run", _boom)
    with pytest.raises(pipeline._FFmpegUnavailable):
        pipeline._run_ff(["ffprobe", "-version"])


def test_tail_falls_back_to_wholefile_when_ffmpeg_unavailable(short_clip, monkeypatch):
    """ffmpeg/ffprobe BINARY absent -> the tail path degrades to the whole-file decode
    (correct, O(elapsed)) instead of skipping — keeps CI / degraded deploys producing
    readings. Result is bit-identical to the whole-file path."""
    monkeypatch.setattr(pipeline, "_build_face_mesh", _FakeFaceMesh)
    monkeypatch.setattr(coverage, "MIN_USABLE_FRAMES", 0)
    monkeypatch.setattr(coverage, "MIN_COVERAGE_FRACTION", 0.0)

    def _unavailable(*_a, **_k):
        raise pipeline._FFmpegUnavailable("ffprobe not found")

    monkeypatch.setattr(pipeline, "probe_global_timestamps_fast", _unavailable)

    opt = _features(pipeline.extract_landmarks(short_clip, tail_seconds=_TAIL_S))
    ref = _features(pipeline._extract_landmarks_wholefile(short_clip, tail_seconds=_TAIL_S))
    assert np.array_equal(opt, ref)


def test_ffmpeg_remux_runs_but_fails_raises_feature_extraction_error(short_clip, monkeypatch):
    """A binary that RUNS but returns non-zero (corrupt clip, transient flake) raises
    ``FeatureExtractionError`` -> the caller skips the window (200), never a 500."""
    def _fail(_cmd):
        return subprocess.CompletedProcess(_cmd, returncode=1, stdout=b"", stderr=b"boom")

    monkeypatch.setattr(pipeline, "_run_ff", _fail)
    with pytest.raises(FeatureExtractionError):
        pipeline._decode_tail_ffmpeg_remux(short_clip, seek_ms=10_000.0, duration_ms=80_000.0)


def test_pick_frames_by_timestamp_skips_on_misseek():
    """A wanted file-global frame not covered by the decoded tail (gap beyond tolerance) ->
    ``FeatureExtractionError`` rather than silently scoring the wrong (nearest) frame."""
    tail_ts = [70_000.0, 70_400.0, 70_800.0]
    frames = [object(), object(), object()]
    # 60_000 ms is >> tolerance from any decoded tail frame -> a mis-seek.
    with pytest.raises(FeatureExtractionError):
        pipeline._pick_frames_by_timestamp(tail_ts, frames, [70_000.0, 60_000.0])


def test_pick_frames_by_timestamp_exact_match_returns_frames():
    """Within tolerance, each wanted timestamp returns its decoded tail frame, in order."""
    tail_ts = [70_000.0, 70_400.0, 70_800.0]
    f0, f1, f2 = object(), object(), object()
    out = pipeline._pick_frames_by_timestamp(tail_ts, [f0, f1, f2], [70_000.0, 70_800.0])
    assert out == [f0, f2]
