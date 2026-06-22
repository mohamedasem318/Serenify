"""webm/VFR vs mp4/CFR codec fidelity hardening (feature 008, T052 — research R-6).

The model was trained on **mp4 / constant-frame-rate** clips (StressID), but production
captures **webm / variable-frame-rate** from the browser ``MediaRecorder``. This test is the
**scheduled hardening check** that the codec + VFR difference does NOT materially change the
2958-d feature vector: it takes a **real browser webm capture**, renders the *same content* as
an **mp4/CFR** clip via ffmpeg, runs the *same* ``compute_anchor`` extraction on both, and
asserts the two vectors agree within tolerance.

This is **scheduled hardening, not a ship blocker** (R-6): under the continuous single-stream
design there is **no assembly dimension** (the 60 s window is faithful by construction —
``test_tail_window.py``), so this only probes the codec/VFR robustness of the extraction.

**Local-only by design.** It needs (a) a real webm fixture — gitignored (the fixtures
``.gitignore`` excludes video), so absent in CI — and (b) the ``ffmpeg`` CLI. When either is
missing the test **skips** with a clear reason (it never silently passes).

**Tolerance is a HARD gate (do NOT relax to go green).** If a real run shows divergence beyond
these bounds, STOP and report it — it would mean the webm/VFR path is not faithful to the
training distribution, which is a finding, not a tolerance to loosen.

Measured baseline (2026-06-21, real Chrome `continuous.webm` vs its libx264/30fps CFR render,
real MediaPipe): FULL cosine **0.9951**, LBP-block cosine **0.9881**, motion-block cosine
**0.9987**, full max|Δ| **0.057**. The bounds below sit a deliberate margin under those
measurements (room for ffmpeg-version / CRF variation in the CFR render), low enough to still
catch a GROSS divergence (a broken decode would crater the cosine toward 0).
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import pytest

from ml_video import FeatureExtractionError, compute_anchor
from ml_video.features import LBP_DIM

# --- Tolerances (margin below the measured baseline; see the module docstring) -----
MIN_FULL_COSINE = 0.97  # measured 0.9951
MIN_LBP_COSINE = 0.95  # measured 0.9881 (the codec-sensitive texture block)
MIN_MOTION_COSINE = 0.97  # measured 0.9987 (landmark-driven, codec-robust)
MAX_FULL_MAXABS = 0.12  # measured 0.057 (an L1-normalized LBP bin can shift modestly per codec)

_FIXTURES = Path(__file__).resolve().parent / "fixtures"
# Prefer the single-source continuous clip (one real ~60 s take, a real framed face); fall
# back to the other real captures. All gitignored → CI sees none of them → skip.
_WEBM_CANDIDATES = (
    _FIXTURES / "multiclip" / "chrome-singlesource" / "continuous.webm",
    _FIXTURES / "continuous" / "chrome" / "recording-so-far_301.webm",
    _FIXTURES / "continuous" / "chrome" / "recording-so-far_062.webm",
    _FIXTURES / "continuous" / "safari" / "recording-so-far_061.webm",
)


def _first_existing_webm() -> Path | None:
    return next((p for p in _WEBM_CANDIDATES if p.exists()), None)


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def _transcode_to_mp4_cfr(webm: Path, out: Path) -> None:
    """Render the SAME content as a constant-frame-rate H.264 mp4 (the model's training
    container shape). ``-r 30`` forces CFR; ``-an`` drops audio (the pipeline is video-only)."""
    result = subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", str(webm),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-an",
            str(out),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0 or not out.exists():
        raise RuntimeError(f"ffmpeg transcode failed: {result.stderr[-400:]}")


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg CLI not available (CI)")
def test_webm_vfr_matches_mp4_cfr_within_tolerance():
    """A real webm/VFR capture and its mp4/CFR render extract to ~the same 2958-d vector."""
    webm = _first_existing_webm()
    if webm is None:
        pytest.skip("no real webm fixture present (gitignored; record via the T002 harness)")

    out = Path(tempfile.gettempdir()) / f"t052_{webm.stem}_cfr.mp4"
    try:
        _transcode_to_mp4_cfr(webm, out)
        try:
            v_webm = compute_anchor(webm)
            v_mp4 = compute_anchor(out)
        except FeatureExtractionError as exc:
            # A coverage/decode failure is a different failure mode than codec fidelity (the
            # fixture must carry a usable face). Skip loudly rather than reporting a false
            # fidelity divergence — the webm→(2958,) decodability is covered by the device
            # gate (smoke-tests.md T008) and test_tail_window.py.
            pytest.skip(f"fixture not usable for the fidelity check: {exc}")
    finally:
        out.unlink(missing_ok=True)

    assert v_webm.shape == v_mp4.shape == (LBP_DIM + 2868,)
    assert np.all(np.isfinite(v_webm)) and np.all(np.isfinite(v_mp4))

    full_cos = _cosine(v_webm, v_mp4)
    lbp_cos = _cosine(v_webm[:LBP_DIM], v_mp4[:LBP_DIM])
    motion_cos = _cosine(v_webm[LBP_DIM:], v_mp4[LBP_DIM:])
    full_maxabs = float(np.max(np.abs(v_webm - v_mp4)))

    # A descriptive message so a real divergence is legible in the failure (STOP-and-report).
    detail = (
        f"\n  fixture={webm.name}"
        f"\n  FULL   cosine={full_cos:.6f} (>= {MIN_FULL_COSINE})"
        f"  maxabs={full_maxabs:.6f} (<= {MAX_FULL_MAXABS})"
        f"\n  LBP    cosine={lbp_cos:.6f} (>= {MIN_LBP_COSINE})"
        f"\n  MOTION cosine={motion_cos:.6f} (>= {MIN_MOTION_COSINE})"
    )
    assert full_cos >= MIN_FULL_COSINE, f"full-vector divergence too large:{detail}"
    assert lbp_cos >= MIN_LBP_COSINE, f"LBP texture divergence too large:{detail}"
    assert motion_cos >= MIN_MOTION_COSINE, f"motion-block divergence too large:{detail}"
    assert full_maxabs <= MAX_FULL_MAXABS, f"a single feature diverged too far:{detail}"
