"""Client-trimmed (header+tail) uploads — fidelity + fail-closed guards (2026-08-06).

The bounded-upload fix has the client send ``header + a contiguous tail of chunks`` cut at
structural container boundaries, instead of the whole accumulated recording. The 2026-08-06
spike proved (GO) that both containers stamp media with ABSOLUTE original-timeline
positions, so a header+tail file stays on the original clock and the file-global 2.5 fps
grid reproduces exactly. This suite pins the productionised version of that emulation:

Layer 1 (local-only, fixture+ffmpeg gated) — **fidelity**: features from a header+tail
file, produced by the same structural cutters the client uses (``helpers/container_cuts``),
are **bit-identical** to the whole-file reference on the real Chrome webm and real iPhone
fMP4 fixtures. Thresholds untouched; the fMP4 fixture is only ~60 s so it uses a 20 s
window exactly as ``test_growing_fmp4_decode.py`` does.

Layer 2 (CI-runnable, no video) — **routing + fail-closed**: a trimmed file must NEVER
reach ``_extract_landmarks_wholefile`` (its re-zeroed OpenCV clock re-anchors the grid at
the cut point — the B2 phase reset, silent). Trim is self-detected from the absolute
timestamps when ffprobe runs; when ffprobe is ABSENT the client's ``trimmed_upload``
declaration fails closed (loud skipped window) instead of falling back. The un-trimmed
fallback behaviour is unchanged. The one-probe-per-window pass-through (``probe=``) never
re-runs the demux.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import cv2
import numpy as np
import pytest

from ml_video import pipeline
from ml_video.errors import FeatureExtractionError
from ml_video.features import FEATURE_DIM, lbp_top_features, motion_features

from helpers.container_cuts import (
    build_header_plus_tail,
    fmp4_moof_cuts,
    latest_cut_at_or_before,
    webm_cluster_cuts,
)

_FIX = Path(__file__).parent / "fixtures" / "continuous"
_CHROME_WEBM = _FIX / "chrome" / "recording-so-far_301.webm"
_SAFARI_FMP4 = _FIX / "safari" / "recording-so-far_062.mp4"
_HAVE_FFMPEG = bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))

_needs_ffmpeg = pytest.mark.skipif(
    not _HAVE_FFMPEG, reason="ffmpeg/ffprobe required for the tail path"
)
_needs_webm = pytest.mark.skipif(
    not _CHROME_WEBM.exists(), reason="Chrome continuous fixture absent (gitignored)"
)
_needs_fmp4 = pytest.mark.skipif(
    not _SAFARI_FMP4.exists(), reason="Safari continuous fixture absent (gitignored)"
)


def _features(clip: pipeline.DecodedClip) -> np.ndarray:
    return np.concatenate(
        [lbp_top_features(clip.frames, clip.landmarks), motion_features(clip.landmarks)]
    )


# ======================================================================================
# Layer 1 — bit-identical fidelity on real fixtures (local-only)
# ======================================================================================


def _write_trim(tmp_path: Path, source: Path, trimmed: bytes) -> Path:
    out = tmp_path / f"trimmed{source.suffix}"
    out.write_bytes(trimmed)
    return out


@_needs_webm
@_needs_ffmpeg
@pytest.mark.parametrize(
    ("tail_margin_s", "case"),
    [(66.0, "normal"), (120.0, "fat")],
    ids=["cut-at-duration-66s", "fat-tail-cut-at-duration-120s"],
)
def test_webm_header_plus_tail_is_bit_identical(tmp_path, tail_margin_s, case):
    """webm header+tail (cut at a validated cluster start) scores bit-identically to the
    whole-file read. The 66 s case is the client's normal cut (window + cluster-granularity
    margin → ``_decode_all_anchored``); the 120 s case is a late-trimming client, which must
    route through the ffmpeg remux (anchored, bounded) — never the whole-file fallback."""
    data = _CHROME_WEBM.read_bytes()
    header_end, cuts = webm_cluster_cuts(data)
    assert len(cuts) > 10, "cluster scan found implausibly few clusters"
    cut_off, cut_ts = latest_cut_at_or_before(cuts, cuts[-1][1] - tail_margin_s * 1000.0)
    trimmed_path = _write_trim(
        tmp_path, _CHROME_WEBM, build_header_plus_tail(data, header_end, cut_off)
    )

    ref = _features(pipeline._extract_landmarks_wholefile(_CHROME_WEBM, tail_seconds=60.0))
    # Self-detected trim (no trimmed_upload declaration needed when ffprobe runs).
    opt = _features(pipeline.extract_landmarks(trimmed_path, tail_seconds=60.0))
    assert opt.shape == (FEATURE_DIM,)
    assert np.array_equal(opt, ref), (
        f"webm header+tail ({case}, cut at {cut_ts:.0f}ms) diverged: "
        f"max|Δ|={np.max(np.abs(opt - ref)):.6g}"
    )


@_needs_fmp4
@_needs_ffmpeg
def test_fmp4_header_plus_tail_is_bit_identical(tmp_path):
    """fMP4 header+tail (cut at a moof start, timed via tfdt) scores bit-identically to the
    whole-file read. 20 s window because the fixture is only ~60 s (same reasoning as
    ``test_growing_fmp4_decode.py``; thresholds untouched)."""
    data = _SAFARI_FMP4.read_bytes()
    header_end, cuts = fmp4_moof_cuts(data)
    assert len(cuts) > 10, "moof walk found implausibly few fragments"
    cut_off, _cut_ts = latest_cut_at_or_before(cuts, cuts[-1][1] - 30_000.0)
    trimmed_path = _write_trim(
        tmp_path, _SAFARI_FMP4, build_header_plus_tail(data, header_end, cut_off)
    )

    ref = _features(pipeline._extract_landmarks_wholefile(_SAFARI_FMP4, tail_seconds=20.0))
    opt = _features(pipeline.extract_landmarks(trimmed_path, tail_seconds=20.0))
    assert opt.shape == (FEATURE_DIM,)
    assert np.array_equal(opt, ref), (
        f"fMP4 header+tail diverged: max|Δ|={np.max(np.abs(opt - ref)):.6g}"
    )


@_needs_webm
@_needs_ffmpeg
def test_webm_trim_is_self_detected_from_absolute_timestamps(tmp_path):
    """The trimmed file's first ffprobe timestamp sits at the cut point (absolute clock),
    beyond ``_TRIMMED_START_MS`` — the property the server-side self-detection rests on."""
    data = _CHROME_WEBM.read_bytes()
    header_end, cuts = webm_cluster_cuts(data)
    cut_off, cut_ts = latest_cut_at_or_before(cuts, cuts[-1][1] - 66_000.0)
    trimmed_path = _write_trim(
        tmp_path, _CHROME_WEBM, build_header_plus_tail(data, header_end, cut_off)
    )
    _fps, ts = pipeline.probe_global_timestamps_fast(trimmed_path)
    assert ts[0] > pipeline._TRIMMED_START_MS
    # The first packet belongs to the cut cluster (within one cluster of its timestamp).
    assert abs(ts[0] - cut_ts) < 5_000.0


# ======================================================================================
# Layer 2 — routing + fail-closed (CI-runnable, no video)
# ======================================================================================

_SENTINEL = pipeline.DecodedClip(frames=[], landmarks=np.zeros((0, 956)))


def _never_wholefile(monkeypatch):
    def _fail(*_a, **_k):
        pytest.fail(
            "_extract_landmarks_wholefile reached for a trimmed upload — its re-zeroed "
            "OpenCV clock would silently re-anchor the grid at the cut point (B2 reset)"
        )

    monkeypatch.setattr(pipeline, "_extract_landmarks_wholefile", _fail)


def test_declared_tail_fails_closed_when_ffprobe_absent(monkeypatch):
    """``trimmed_upload=True`` + ffprobe absent → loud FeatureExtractionError, and the
    whole-file fallback is NEVER touched. This is the fail-closed contract (c)."""
    def _unavailable(*_a, **_k):
        raise pipeline._FFmpegUnavailable("ffprobe not found")

    monkeypatch.setattr(pipeline, "probe_global_timestamps_fast", _unavailable)
    _never_wholefile(monkeypatch)
    with pytest.raises(FeatureExtractionError, match="failing closed"):
        pipeline.extract_landmarks("whatever.webm", tail_seconds=60.0, trimmed_upload=True)


def test_untrimmed_fallback_when_ffprobe_absent_is_unchanged(monkeypatch):
    """An UN-trimmed upload on an ffprobe-less host still degrades to the whole-file decode
    (correct, O(elapsed)) — the pre-existing CI/degraded-deploy behaviour."""
    def _unavailable(*_a, **_k):
        raise pipeline._FFmpegUnavailable("ffprobe not found")

    monkeypatch.setattr(pipeline, "probe_global_timestamps_fast", _unavailable)
    monkeypatch.setattr(
        pipeline, "_extract_landmarks_wholefile", lambda *_a, **_k: _SENTINEL
    )
    out = pipeline.extract_landmarks("whatever.webm", tail_seconds=60.0)
    assert out is _SENTINEL


def test_selfdetected_trim_routes_to_trimmed_decoder(monkeypatch):
    """ffprobe timestamps starting far from 0 → the trimmed decoder, never the whole-file
    path (even though the file span alone would qualify for the short-clip shortcut)."""
    # ~66 s of 25 fps packets starting at t=240 s — a typical header+tail upload.
    ts = [240_000.0 + i * 40.0 for i in range(1650)]
    monkeypatch.setattr(
        pipeline, "probe_global_timestamps_fast", lambda *_a, **_k: (25.0, ts)
    )
    _never_wholefile(monkeypatch)
    seen: dict = {}

    def _fake_trimmed(video_path, all_ts, global_keep, tail_seconds):
        seen["all_ts"] = all_ts
        seen["tail_seconds"] = tail_seconds
        return _SENTINEL

    monkeypatch.setattr(pipeline, "_tail_from_trimmed", _fake_trimmed)
    out = pipeline.extract_landmarks("whatever.webm", tail_seconds=60.0)
    assert out is _SENTINEL
    assert seen["all_ts"][0] == 240_000.0
    assert seen["tail_seconds"] == 60.0


def test_probe_passthrough_never_reprobes(monkeypatch):
    """``probe=`` (the one-ffprobe-per-window dedupe) is used as-is — the demux must not
    run a second time inside the tail path."""
    monkeypatch.setattr(
        pipeline,
        "probe_global_timestamps_fast",
        lambda *_a, **_k: pytest.fail("re-probed despite probe= being supplied"),
    )
    monkeypatch.setattr(
        pipeline, "_tail_from_trimmed", lambda *_a, **_k: _SENTINEL
    )
    ts = [240_000.0 + i * 40.0 for i in range(1650)]
    out = pipeline.extract_landmarks("whatever.webm", tail_seconds=60.0, probe=(25.0, ts))
    assert out is _SENTINEL


def test_fat_trimmed_tail_fails_closed_when_ffmpeg_absent(monkeypatch):
    """A late-trimming client's fat tail needs the ffmpeg remux for a bounded decode; with
    the binary absent it fails closed (never the whole-file fallback)."""
    def _unavailable(*_a, **_k):
        raise pipeline._FFmpegUnavailable("ffmpeg not found")

    monkeypatch.setattr(pipeline, "_decode_tail_ffmpeg_remux", _unavailable)
    _never_wholefile(monkeypatch)
    # file spans 100 s → local seek target is ~37 s past the file start (>= _MIN_SEEK_MS).
    ts = [200_000.0 + i * 40.0 for i in range(2500)]
    with pytest.raises(FeatureExtractionError, match="failing closed"):
        pipeline._tail_from_trimmed("whatever.webm", ts, [len(ts) - 1], 60.0)


@pytest.fixture
def short_clip(tmp_path):
    """A deterministic 90-frame / 30 fps (~3 s) MJPG clip (mirrors test_tail_seek_keepup)."""
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


def test_decode_all_anchored_anchors_last_frame_to_duration(short_clip):
    """``_decode_all_anchored`` recovers the absolute clock by pinning the LAST decoded
    frame to the known absolute duration; deltas are preserved, order is monotonic."""
    abs_ts, frames = pipeline._decode_all_anchored(short_clip, duration_ms=500_000.0)
    assert len(frames) == len(abs_ts) > 0
    assert abs_ts[-1] == pytest.approx(500_000.0)
    assert all(b >= a for a, b in zip(abs_ts, abs_ts[1:]))
    # The whole span sits in the immediate past of the anchor — never re-zeroed at 0.
    assert abs_ts[0] > 490_000.0
