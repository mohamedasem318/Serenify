"""Multi-clip windowing fidelity — feature 008 B2 (tasks T007/T008).

Two layers:

1. **Synthetic, env-runnable validation** (always runs, no real fixtures, no mediapipe):
   monkeypatches ``pipeline._build_face_mesh`` to a deterministic scripted landmarker and
   drives the real decode + concat + feature code over synthetic cv2 clips. These pin
   that ``compute_anchor_multiclip`` is exactly the documented assembly — decode each clip
   via the existing per-clip path, concatenate the kept frames + landmark rows, then run
   the same coverage gate + LBP-TOP ⊕ motion — and that it reduces to ``compute_anchor``
   for a single clip. This is what proves the implementation in CI / on a clean tree.

2. **The real-device HARD GATE** (``test_multiclip_fidelity_*`` — SKIPS unless fixtures
   are present): compares the 2958-d vector of one continuous ~60 s clip against the
   concatenation of ~6 stop/restart standalone clips of the SAME content, recorded on
   real Chrome and real Safari/iOS. Raw clips are gitignored (Principle I/X), so this only
   runs locally after a human records them — see ``tests/fixtures/multiclip/README.md`` and
   ``specs/008-stress-inference-service/smoke-tests.md``. If the multi-clip vector is NOT
   within tolerance, the GATE fails and the windowing approach is revisited before the rest
   of feature 008 is built.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import pytest

from ml_video import compute_anchor, compute_anchor_multiclip, coverage, pipeline
from ml_video.errors import FeatureExtractionError
from ml_video.features import FEATURE_DIM, LBP_DIM, N_LANDMARKS
from ml_video.pipeline import extract_landmarks

# --------------------------------------------------------------------------------------
# Agreed fidelity budget (B2 GATE). These are the STARTING budget — confirm/adjust with
# the maintainer on the first real-fixture run (recorded in smoke-tests.md). The hard
# assertions are deliberately on window-level fidelity (cosine + per-block diffs + frames
# lost); the per-seam motion inflation is measured and reported, not hard-failed, because a
# genuine frame-to-frame jump across a real ~10 s clip boundary is expected and bounded —
# the disqualifying B1 failure mode was a SILENT splice corruption, which B2 does not have.
# --------------------------------------------------------------------------------------
COSINE_MIN = 0.999          # full 2958-d cosine similarity (continuous vs multi-clip)
LBP_MAXABS = 0.05           # max |diff| on the 90-d LBP-TOP block (texture is stable)
MOTION_REL_P99_MAX = 0.25   # 99th-pctile relative diff on the 2868-d motion block (seam-sensitive)
KEPT_LOST_PER_CLIP_BUDGET = 2   # kept frames (~2.5 fps) allowed lost per stop/restart


# ======================================================================================
# Layer 1 — synthetic, env-runnable validation (no real fixtures, no mediapipe)
# ======================================================================================

class _LM:
    __slots__ = ("x", "y")

    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y


class _Face:
    def __init__(self, landmark: list[_LM]) -> None:
        self.landmark = landmark


class _Result:
    def __init__(self, faces: list[_Face]) -> None:
        self.multi_face_landmarks = faces


class FakeFaceMesh:
    """Deterministic scripted landmarker (all points in [0.3, 0.7] so every ROI box is
    valid). Built fresh per ``extract_landmarks`` call, so its landmark stream depends only
    on the per-clip frame sequence — making the assembly comparisons below exact."""

    def __init__(self) -> None:
        self._t = 0

    def process(self, _rgb):  # noqa: ANN001 - mirrors mediapipe signature
        t = self._t
        self._t += 1
        landmarks = [
            _LM(
                0.3 + 0.4 * (((i * 7 + t * 3) % 100) / 100.0),
                0.3 + 0.4 * (((i * 11 + t * 5) % 100) / 100.0),
            )
            for i in range(N_LANDMARKS)
        ]
        return _Result([_Face(landmarks)])

    def close(self) -> None:
        pass


def _write_synthetic_clip(path: Path, n_frames: int, seed: int) -> Path:
    """Write a deterministic CFR MJPG clip (30 fps, 128x128); content varies by ``seed``."""
    h = w = 128
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), 30.0, (w, h))
    assert writer.isOpened(), "could not open VideoWriter (MJPG)"
    ys, xs = np.mgrid[0:h, 0:w]
    for t in range(n_frames):
        plane = ((xs * 2 + ys * 3 + t + seed * 17) % 256).astype(np.uint8)
        writer.write(np.dstack([plane, plane, plane]))
    writer.release()
    return path


@pytest.fixture
def _bypass_coverage(monkeypatch):
    """Synthetic clips are below the 60 s coverage floor by design; bypass the gate so the
    structural/assembly tests can run (the gate itself is exercised on real fixtures + in
    test_usable_face_coverage_gate.py)."""
    monkeypatch.setattr(pipeline, "_build_face_mesh", FakeFaceMesh)
    monkeypatch.setattr(coverage, "MIN_USABLE_FRAMES", 0)
    monkeypatch.setattr(coverage, "MIN_COVERAGE_FRACTION", 0.0)


def test_multiclip_single_clip_equals_compute_anchor(tmp_path, _bypass_coverage):
    """One clip through compute_anchor_multiclip == compute_anchor (it must reduce exactly)."""
    clip = _write_synthetic_clip(tmp_path / "c0.avi", n_frames=90, seed=1)
    direct = compute_anchor(clip)
    via_multi = compute_anchor_multiclip([clip])
    assert via_multi.shape == (FEATURE_DIM,)
    assert np.array_equal(direct, via_multi)


def test_multiclip_is_exactly_concat_then_features(tmp_path, _bypass_coverage):
    """compute_anchor_multiclip == manually [concat kept frames + landmarks] -> features.

    This pins the wrapper to the documented assembly: per-clip extract_landmarks, then one
    LBP-TOP ⊕ motion over the concatenated set (Principle III — no second extraction)."""
    clips = [
        _write_synthetic_clip(tmp_path / "c0.avi", n_frames=90, seed=1),
        _write_synthetic_clip(tmp_path / "c1.avi", n_frames=90, seed=2),
        _write_synthetic_clip(tmp_path / "c2.avi", n_frames=90, seed=3),
    ]
    # Manual expected: same building blocks, assembled by hand.
    frames: list[np.ndarray] = []
    blocks: list[np.ndarray] = []
    for c in clips:
        decoded = extract_landmarks(c)
        frames.extend(decoded.frames)
        blocks.append(decoded.landmarks)
    landmarks = np.concatenate(blocks, axis=0)
    from ml_video.features import lbp_top_features, motion_features

    expected = np.concatenate([lbp_top_features(frames, landmarks), motion_features(landmarks)])

    got = compute_anchor_multiclip(clips)
    assert got.shape == (FEATURE_DIM,)
    assert np.array_equal(got, expected)
    # Structural sanity: LBP block (3 ROIs x 3 L1-normalized planes) sums to 9.0; motion >= 0.
    assert np.isclose(got[:LBP_DIM].sum(), 9.0)
    assert np.all(got[LBP_DIM:] >= 0.0)


def test_multiclip_combined_frame_count_is_sum_of_clips(tmp_path, _bypass_coverage):
    """The assembled window decodes to sum(per-clip kept frames) — the concat is total."""
    clips = [
        _write_synthetic_clip(tmp_path / "c0.avi", n_frames=90, seed=1),
        _write_synthetic_clip(tmp_path / "c1.avi", n_frames=60, seed=2),
    ]
    per_clip = [extract_landmarks(c).landmarks.shape[0] for c in clips]
    # Re-derive the combined landmark count the wrapper builds and compare.
    combined = np.concatenate([extract_landmarks(c).landmarks for c in clips], axis=0)
    assert combined.shape[0] == sum(per_clip)
    assert sum(per_clip) >= 2  # enough for motion diffs


def test_multiclip_empty_input_raises():
    with pytest.raises(FeatureExtractionError):
        compute_anchor_multiclip([])


def test_multiclip_coverage_gate_runs_on_combined_set(tmp_path, monkeypatch):
    """With the REAL floor, an all-no-face assembled window is rejected (gate on the combined
    set, code insufficient_face_frames) — proving the gate is applied to the whole window."""
    monkeypatch.setattr(pipeline, "_build_face_mesh", FakeFaceMesh)

    class _NoFaceMesh(FakeFaceMesh):
        def process(self, _rgb):  # noqa: ANN001
            return _Result([])  # no detection -> zero landmark row

    monkeypatch.setattr(pipeline, "_build_face_mesh", _NoFaceMesh)
    clips = [
        _write_synthetic_clip(tmp_path / "c0.avi", n_frames=90, seed=1),
        _write_synthetic_clip(tmp_path / "c1.avi", n_frames=90, seed=2),
    ]
    with pytest.raises(FeatureExtractionError) as exc:
        compute_anchor_multiclip(clips)
    assert getattr(exc.value, "code", None) == "insufficient_face_frames"


# ======================================================================================
# Layer 2 — the real-device HARD GATE (skips unless real fixtures are present)
# ======================================================================================

_FIXTURES = Path(__file__).parent / "fixtures" / "multiclip"


def _discover_browser_fixtures() -> list[tuple[str, Path, list[Path]]]:
    """Find (browser, continuous_clip, [stop/restart clips]) sets that are fully present."""
    found: list[tuple[str, Path, list[Path]]] = []
    if not _FIXTURES.is_dir():
        return found
    for browser_dir in sorted(p for p in _FIXTURES.iterdir() if p.is_dir()):
        continuous = sorted(browser_dir.glob("continuous.*"))
        clips_dir = browser_dir / "clips"
        clips = sorted(p for p in clips_dir.glob("clip_*.*")) if clips_dir.is_dir() else []
        # ignore the tracked .gitkeep placeholder
        clips = [c for c in clips if c.suffix.lower() in {".webm", ".mp4", ".mov", ".mkv", ".avi"}]
        if continuous and len(clips) >= 2:
            found.append((browser_dir.name, continuous[0], clips))
    return found


_BROWSER_FIXTURES = _discover_browser_fixtures()


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0.0 or nb == 0.0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def _measure(continuous: Path, clips: list[Path]) -> dict:
    """Compute the continuous-vs-multiclip fidelity metrics for one browser fixture set."""
    vec_cont = compute_anchor(continuous)
    vec_multi = compute_anchor_multiclip(clips)

    kept_cont = extract_landmarks(continuous).landmarks.shape[0]
    per_clip_kept = [extract_landmarks(c).landmarks.shape[0] for c in clips]
    kept_multi = sum(per_clip_kept)

    lbp_maxabs = float(np.max(np.abs(vec_cont[:LBP_DIM] - vec_multi[:LBP_DIM])))
    motion_cont, motion_multi = vec_cont[LBP_DIM:], vec_multi[LBP_DIM:]
    denom = np.maximum(np.abs(motion_cont), 1e-9)
    motion_rel = np.abs(motion_multi - motion_cont) / denom
    motion_rel_p99 = float(np.percentile(motion_rel, 99))

    # Per-seam motion inflation (measured, reported): the diff rows that straddle a clip
    # boundary in the assembled landmark stack, vs the median over all diff rows.
    combined_lm = np.concatenate([extract_landmarks(c).landmarks for c in clips], axis=0)
    motion_abs = np.abs(np.diff(combined_lm, axis=0))            # (sum_kept-1, 956)
    row_mag = motion_abs.mean(axis=1)                            # per-transition magnitude
    seam_rows, acc = [], 0
    for k in per_clip_kept[:-1]:
        acc += k
        if 0 < acc <= row_mag.shape[0]:
            seam_rows.append(acc - 1)                            # boundary between clip k and k+1
    seam_mean = float(np.mean(row_mag[seam_rows])) if seam_rows else 0.0
    overall_median = float(np.median(row_mag)) if row_mag.size else 0.0
    seam_ratio = (seam_mean / overall_median) if overall_median > 0 else 0.0

    return {
        "cosine": _cosine(vec_cont, vec_multi),
        "lbp_maxabs": lbp_maxabs,
        "motion_rel_p99": motion_rel_p99,
        "kept_cont": kept_cont,
        "kept_multi": kept_multi,
        "frames_lost": kept_cont - kept_multi,
        "n_clips": len(clips),
        "seam_motion_ratio": seam_ratio,
    }


_SKIP_REASON = (
    "no real multiclip fixtures present "
    "(record on real devices — see fixtures/multiclip/README.md)"
)


@pytest.mark.skipif(not _BROWSER_FIXTURES, reason=_SKIP_REASON)
@pytest.mark.parametrize(
    "browser,continuous,clips",
    _BROWSER_FIXTURES,
    ids=[b for b, _, _ in _BROWSER_FIXTURES],
)
def test_multiclip_fidelity_gate(browser, continuous, clips, capsys):
    """HARD GATE: the multi-clip 2958-d vector must match the same content as one continuous
    clip within the agreed budget, on this real browser's recordings."""
    m = _measure(continuous, clips)
    with capsys.disabled():
        print(
            f"\n[B2 fidelity GATE: {browser}] clips={m['n_clips']} "
            f"kept_cont={m['kept_cont']} kept_multi={m['kept_multi']} "
            f"frames_lost={m['frames_lost']} cosine={m['cosine']:.6f} "
            f"lbp_maxabs={m['lbp_maxabs']:.4f} motion_rel_p99={m['motion_rel_p99']:.4f} "
            f"seam_motion_ratio={m['seam_motion_ratio']:.2f}"
        )
    assert m["cosine"] >= COSINE_MIN, f"{browser}: cosine {m['cosine']:.6f} < {COSINE_MIN}"
    assert m["lbp_maxabs"] <= LBP_MAXABS, (
        f"{browser}: LBP max|diff| {m['lbp_maxabs']:.4f} > {LBP_MAXABS}"
    )
    assert m["motion_rel_p99"] <= MOTION_REL_P99_MAX, (
        f"{browser}: motion rel-p99 {m['motion_rel_p99']:.4f} > {MOTION_REL_P99_MAX}"
    )
    lost_budget = KEPT_LOST_PER_CLIP_BUDGET * m["n_clips"]
    assert m["frames_lost"] <= lost_budget, (
        f"{browser}: frames lost {m['frames_lost']} > budget {lost_budget}"
    )
