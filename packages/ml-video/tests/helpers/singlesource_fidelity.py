"""Single-source multi-clip fidelity diagnostic for the feature-008 B2 windowing GATE.

WHY THIS EXISTS (2026-06-19, windowing design session).
The hard GATE (``test_multiclip_fidelity.py``) originally compared a continuous ~60 s
recording against a SEPARATE 6-clip stop/restart recording of "the same" content. Those are
two independent takes: involuntary micro-motion (blinks, sway, breathing) and VFR sampling do
not reproduce frame-for-frame take-to-take, so the motion block (97% of the 2958-d vector)
diverged for reasons unrelated to the multi-clip ASSEMBLY. That fixture conflated *assembly
fidelity* with *recording reproducibility* and could not answer the real question.

This diagnostic isolates the assembly by feeding it ONE source recording two ways:
  * ``continuous``         — the reference clip, scored with :func:`compute_anchor`;
  * ``clips`` (segments)   — the SAME clip losslessly segmented (``ffmpeg -c copy -f segment``,
                             same frames, no re-encode), scored with
                             :func:`compute_anchor_multiclip`.
Because the segments are bit-identical frames re-chunked into standalone containers, the ONLY
remaining difference is the windowing assembly itself (per-clip decode + the 2.5 fps timestamp
sampler re-phasing from each clip's t=0, plus the handful of frames lost at each seam).

It prints the GATE metrics (cosine / lbp_maxabs / motion_rel_p99 / frames_lost /
seam_motion_ratio), a per-block decomposition, and a continuous-vs-multiclip SAMPLED-FRAME
TIMESTAMP comparison — enough to either (a) confirm the assembly is faithful (cosine ≥ 0.999),
or (b) localize a real assembly/sampling divergence to the per-clip sampling phase.

Usage (run from ``packages/ml-video`` with its ``.venv`` python; direct script path, not ``-m``):

    .venv/Scripts/python tests/helpers/singlesource_fidelity.py \
        tests/fixtures/multiclip/chrome-singlesource/continuous.webm \
        tests/fixtures/multiclip/chrome-singlesource/clips/clip_*.webm

NOTE — lossless segmentation snaps cuts to keyframes, so segment durations are NOT uniform
(they land on the container's ~3.36 s GOP grid); that is expected and does not affect the
frames (their union is identical to the continuous decode).
"""

from __future__ import annotations

import sys

import numpy as np

from ml_video import compute_anchor, compute_anchor_multiclip
from ml_video.features import LBP_DIM
from ml_video.pipeline import (
    _probe_timestamps,
    _reported_fps_trustworthy,
    _select_keep_indices,
    _timestamps_reliable,
    extract_landmarks,
)


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0.0 or nb == 0.0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def _sampling_path(video_path) -> tuple[str, list[float], list[int]]:
    """Return (sampling-path-label, all timestamps_ms, kept raw-frame indices) for a clip."""
    fps, _frame_count, _w, _h, ts = _probe_timestamps(video_path)
    keep = _select_keep_indices(len(ts), fps, ts)
    if not _timestamps_reliable(ts) or _reported_fps_trustworthy(fps, ts):
        label = "index(legacy)"
    else:
        label = "timestamp(2.5fps)"
    return label, ts, keep


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(
            "usage: python tests/helpers/singlesource_fidelity.py "
            "<continuous> <clip0> [<clip1> ...]",
            file=sys.stderr,
        )
        return 2
    continuous = argv[0]
    clips = argv[1:]

    # ---- vectors --------------------------------------------------------------------------
    vec_cont = compute_anchor(continuous)
    vec_multi = compute_anchor_multiclip(clips)

    # ---- kept-frame counts ----------------------------------------------------------------
    kept_cont = extract_landmarks(continuous).landmarks.shape[0]
    per_clip_kept = [extract_landmarks(c).landmarks.shape[0] for c in clips]
    kept_multi = sum(per_clip_kept)

    # ---- GATE metrics (same definitions as test_multiclip_fidelity._measure) --------------
    lbp_maxabs = float(np.max(np.abs(vec_cont[:LBP_DIM] - vec_multi[:LBP_DIM])))
    motion_cont, motion_multi = vec_cont[LBP_DIM:], vec_multi[LBP_DIM:]
    denom = np.maximum(np.abs(motion_cont), 1e-9)
    motion_rel = np.abs(motion_multi - motion_cont) / denom
    motion_rel_p99 = float(np.percentile(motion_rel, 99))
    full_cosine = _cosine(vec_cont, vec_multi)

    combined_lm = np.concatenate([extract_landmarks(c).landmarks for c in clips], axis=0)
    motion_abs = np.abs(np.diff(combined_lm, axis=0))
    row_mag = motion_abs.mean(axis=1)
    seam_rows, acc = [], 0
    for k in per_clip_kept[:-1]:
        acc += k
        if 0 < acc <= row_mag.shape[0]:
            seam_rows.append(acc - 1)
    seam_mean = float(np.mean(row_mag[seam_rows])) if seam_rows else 0.0
    overall_median = float(np.median(row_mag)) if row_mag.size else 0.0
    seam_ratio = (seam_mean / overall_median) if overall_median > 0 else 0.0

    # ---- per-block decomposition ----------------------------------------------------------
    lbp_cos = _cosine(vec_cont[:LBP_DIM], vec_multi[:LBP_DIM])
    motion_cos = _cosine(motion_cont, motion_multi)
    mc_norm = np.linalg.norm(motion_cont)
    mm_norm = np.linalg.norm(motion_multi)
    mag_ratio = (mm_norm / mc_norm) if mc_norm > 0 else 0.0
    p = lambda a, q: float(np.percentile(a, q))  # noqa: E731 - terse local

    print("\n================ SINGLE-SOURCE B2 FIDELITY (assembly isolated) ================")
    print(f"continuous: {continuous}")
    print(f"clips     : {len(clips)} lossless segments")
    print("\n-- GATE metrics (budget) --")
    print(f"  cosine            = {full_cosine:.6f}   (>= 0.999)")
    print(f"  lbp_maxabs        = {lbp_maxabs:.4f}       (<= 0.05)")
    print(f"  motion_rel_p99    = {motion_rel_p99:.4f}       (<= 0.25)")
    print(f"  frames_lost       = {kept_cont - kept_multi}   (kept_cont={kept_cont} "
          f"kept_multi={kept_multi}; budget <= {2 * len(clips)})")
    print(f"  seam_motion_ratio = {seam_ratio:.2f}        (reported only)")
    print("\n-- per-block decomposition --")
    print(f"  LBP-block cosine     = {lbp_cos:.6f}")
    print(f"  motion-block cosine  = {motion_cos:.6f}")
    print(f"  motion |multi|/|cont|= {mag_ratio:.4f}  (l2 norm ratio)")
    print(f"  rel motion err p50/p90/p99 = "
          f"{p(motion_rel, 50):.4f} / {p(motion_rel, 90):.4f} / {p(motion_rel, 99):.4f}")

    # ---- sampled-frame TIMESTAMP comparison (localizes per-clip sampling phase) ------------
    cont_label, cont_ts, cont_keep = _sampling_path(continuous)
    # Map each segment's locally-kept frames onto the continuous global frame index. The
    # segment frames are the continuous frames in order (lossless split), so segment k's
    # local raw index j == global continuous index (start_k + j).
    multi_keep_global: list[int] = []
    seg_labels: list[str] = []
    start = 0
    for c, n_dec in zip(clips, _decoded_counts(clips), strict=True):
        label, _ts, keep = _sampling_path(c)
        seg_labels.append(label)
        multi_keep_global.extend(start + j for j in keep)
        start += n_dec
    multi_keep_global.sort()

    cont_set, multi_set = set(cont_keep), set(multi_keep_global)
    common = cont_set & multi_set
    print("\n-- sampled-frame timestamp comparison (per-clip sampling phase) --")
    print(f"  continuous sampling path : {cont_label}")
    print(f"  segment sampling paths   : {sorted(set(seg_labels))}")
    print(f"  continuous decoded frames: {len(cont_ts)}")
    print(f"  kept (continuous)        : {len(cont_keep)} raw indices")
    print(f"  kept (multiclip, union)  : {len(multi_keep_global)} raw indices")
    print(f"  identical frame picks    : {len(common)} "
          f"({100.0 * len(common) / max(1, len(cont_keep)):.1f}% of continuous picks)")
    print(f"  only-in-continuous       : {len(cont_set - multi_set)}")
    print(f"  only-in-multiclip        : {len(multi_set - cont_set)}")
    # Nearest-neighbour temporal offset: for each multiclip pick, ms to the closest
    # continuous pick (using the global continuous timestamps as the shared clock).
    if cont_keep and multi_keep_global:
        cont_times = np.array([cont_ts[i] for i in cont_keep], dtype=np.float64)
        multi_times = np.array(
            [cont_ts[i] for i in multi_keep_global if i < len(cont_ts)], dtype=np.float64
        )
        nn = np.array([float(np.min(np.abs(cont_times - t))) for t in multi_times])
        print(f"  multiclip->continuous nearest-pick offset ms: "
              f"median={np.median(nn):.1f} p90={np.percentile(nn, 90):.1f} max={nn.max():.1f}")
    print("==============================================================================\n")
    return 0


def _decoded_counts(clips: list[str]) -> list[int]:
    """Raw decoded frame count per clip (pass-1 grab count) — for global index mapping."""
    counts: list[int] = []
    for c in clips:
        _fps, _fc, _w, _h, ts = _probe_timestamps(c)
        counts.append(len(ts))
    return counts


if __name__ == "__main__":  # pragma: no cover - dev-only diagnostic CLI
    raise SystemExit(main(sys.argv[1:]))
