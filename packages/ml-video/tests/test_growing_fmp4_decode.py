"""Growing (un-finalized) fragmented-MP4 decode gate.

fMP4 is the container Apple WebKit records reliably: Safari 26 *claims* WebM support
(the claim behind the #89 server-side decode death), while its mp4 recorder emits
timeslice chunks on schedule (avc1.42000a) with a realtime media clock (the
2026-08-05 device probes). Whenever a client records fMP4 — today via the recorder's
existing mp4 fallback, or under any future container preference — the server
receives, every stride, a **growing fMP4 prefix** (init segment + N complete
moof/mdat fragments — and, defensively, possibly a mid-fragment truncation). This
suite pins that the read path handles exactly that shape:

  * ``probe_recorded_seconds`` (the < 60 s warming-up gate) reads the prefix duration;
  * past 60 s, ``extract_landmarks(tail_seconds=60)`` (the O(stride) tail decode)
    keeps the expected ~150-frame 2.5 fps tail.

Two layers, mirroring ``test_tail_seek_keepup.py``:

  1. **Real-device fixture** (local-only, gitignored): the actual iPhone Safari
     recording-so-far fMP4 from the T009 device gate, through probe + tail decode +
     REAL FaceMesh + the full 2958-d feature build.
  2. **Synthetic** (runs wherever ffmpeg+libx264 exist): an ffmpeg-built fMP4 with the
     Safari layout (empty_moov + ~1 s fragments, H.264 baseline), truncated to
     fragment-boundary prefixes and one mid-fragment cut. FaceMesh is the scripted
     fake — this layer pins the DECODE plumbing, not the model input.

Verified 2026-08-05 against the real fixture: probe 59.8 s, tail kept 149 frames,
146 usable face rows, (2958,) features. (The real growing iOS *webm* sibling probes
fine at rest, so #89's live failure implicates the transport-scale of iOS webm —
~4.8 Mbit/s re-uploads — as much as the container.)
"""

import shutil
import struct
import subprocess
from pathlib import Path

import numpy as np
import pytest

from ml_video import anchor, pipeline
from ml_video.features import FEATURE_DIM, N_LANDMARKS, lbp_top_features, motion_features

_SAFARI_FMP4 = (
    Path(__file__).parent / "fixtures" / "continuous" / "safari" / "recording-so-far_062.mp4"
)
_HAVE_FFMPEG = bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))
_TAIL_S = 60.0

_needs_fixture = pytest.mark.skipif(
    not _SAFARI_FMP4.exists(), reason="Safari continuous fixture absent (gitignored) — local-only"
)
_needs_ffmpeg = pytest.mark.skipif(
    not _HAVE_FFMPEG, reason="ffmpeg/ffprobe required for the O(stride) tail path"
)


def _have_libx264() -> bool:
    if not _HAVE_FFMPEG:
        return False
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, timeout=30
    )
    return b"libx264" in out.stdout


class _FakeFaceMesh:
    """Deterministic scripted landmarker (points in [0.3, 0.7] → valid ROIs)."""

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


# ======================================================================================
# Layer 1 — the REAL iPhone Safari growing fMP4 (local-only, real FaceMesh)
# ======================================================================================


@_needs_fixture
@_needs_ffmpeg
def test_real_ios_growing_fmp4_probes_and_scores():
    """The actual iPhone recording-so-far fMP4 passes the whole read path: duration
    probe (past the ~40 s mark where the iOS webm session died), the bounded tail
    decode, and the full 2958-d feature build on real FaceMesh."""
    seconds = anchor.probe_recorded_seconds(_SAFARI_FMP4)
    assert seconds >= _TAIL_S - 1.0  # a ≥60 s window — the gate the webm path never reached

    clip = pipeline.extract_landmarks(_SAFARI_FMP4, tail_seconds=_TAIL_S)
    assert 140 <= len(clip.frames) <= 155  # ~150 = 2.5 fps × 60 s
    usable = int(np.count_nonzero(np.any(clip.landmarks, axis=1)))
    assert usable > 100  # a real face, actually detected, in most of the tail

    vec = np.concatenate(
        [lbp_top_features(clip.frames, clip.landmarks), motion_features(clip.landmarks)]
    )
    assert vec.shape == (FEATURE_DIM,)


# ======================================================================================
# Layer 2 — synthetic Safari-layout prefixes (decode plumbing; fake FaceMesh)
# ======================================================================================


@pytest.fixture(scope="module")
def synthetic_fmp4(tmp_path_factory):
    """A 75 s / 15 fps H.264-baseline fMP4 with Safari's layout (empty_moov +
    ~1 s frag_keyframe fragments), plus the byte offsets of its moof boxes."""
    if not _have_libx264():
        pytest.skip("ffmpeg lacks libx264 — cannot synthesize the Safari-layout fMP4")
    path = tmp_path_factory.mktemp("fmp4") / "growing.mp4"
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-v", "error", "-f", "lavfi",
            "-i", "testsrc2=size=192x144:rate=15:duration=75",
            "-c:v", "libx264", "-profile:v", "baseline", "-level", "3.0",
            "-pix_fmt", "yuv420p", "-g", "15",
            "-movflags", "empty_moov+frag_keyframe+default_base_moof",
            "-y", str(path),
        ],
        check=True,
        timeout=120,
    )
    data = path.read_bytes()
    moofs = []
    off = 0
    while off + 8 <= len(data):
        size = struct.unpack(">I", data[off : off + 4])[0]
        kind = data[off + 4 : off + 8]
        if kind == b"moof":
            moofs.append(off)
        if size == 1:
            size = struct.unpack(">Q", data[off + 8 : off + 16])[0]
        if size == 0:
            break
        off += size
    assert len(moofs) > 70, "expected ~1 s fragments"
    return data, moofs


@_needs_ffmpeg
@pytest.mark.parametrize("prefix_s", [10, 40, 50])
def test_synthetic_prefix_probes_below_gate(synthetic_fmp4, tmp_path, prefix_s):
    """A chunk-shaped prefix (init + N complete fragments) under 60 s probes to ~its
    duration — the warming-up gate keeps working on the new container, including past
    the ~40 s mark that killed the iOS webm sessions."""
    data, moofs = synthetic_fmp4
    p = tmp_path / f"prefix_{prefix_s}.mp4"
    p.write_bytes(data[: moofs[prefix_s]])  # ~1 s fragments → index ≈ seconds
    seconds = anchor.probe_recorded_seconds(p)
    assert prefix_s - 2.5 <= seconds <= prefix_s + 0.5


@_needs_ffmpeg
@pytest.mark.parametrize("cut", ["fragment-boundary", "mid-fragment"])
def test_synthetic_70s_prefix_tail_decodes(synthetic_fmp4, tmp_path, monkeypatch, cut):
    """A ≥60 s growing prefix goes through the O(stride) tail decode and keeps the
    ~150-frame 2.5 fps tail — including a defensive mid-fragment truncation (an
    interrupted upload must degrade to a skipped window at worst, never poison the
    grid; here it decodes cleanly)."""
    monkeypatch.setattr(pipeline, "_build_face_mesh", _FakeFaceMesh)
    data, moofs = synthetic_fmp4
    end = moofs[70] if cut == "fragment-boundary" else moofs[70] + 1234
    p = tmp_path / f"prefix_70_{cut}.mp4"
    p.write_bytes(data[:end])

    assert anchor.probe_recorded_seconds(p) >= _TAIL_S
    clip = pipeline.extract_landmarks(p, tail_seconds=_TAIL_S)
    assert 140 <= len(clip.frames) <= 155
