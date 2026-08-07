"""Video decode + downsample + MediaPipe FaceMesh landmark extraction.

Implements MODEL_HANDOFF §3 Steps 1-3. Modality logic stays inside this package
(Constitution Principle III). The mediapipe import is deferred into
``_build_face_mesh`` so that unit tests can monkeypatch the landmarker without
loading mediapipe's native runtime, and so that importing this module is cheap.
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import tempfile
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from .errors import FeatureExtractionError
from .features import LANDMARK_DIM

logger = logging.getLogger(__name__)

TARGET_FPS = 5
FRAME_SKIP_MOD = 2

# ── feature-008 O(stride) tail decode (keep-up fix) ───────────────────────────────────
# The live read path uploads the whole growing recording-so-far each window; the server
# scores its last 60 s. The original implementation re-decoded the WHOLE clip every window
# (O(elapsed)) so readings fell behind and the lag grew. The surgical fix decodes only the
# bounded TAIL: it re-derives the file-global sampling grid from a cheap ffprobe PACKET read
# (demux only, no pixel decode) and decodes only the trailing window via a seek — OpenCV's
# native ``cap.set`` for mp4/finalized clips, and (because ``cap.set`` is a SILENT NO-OP on
# un-finalized MediaRecorder webm — it rewinds to t=0) an ffmpeg ``-c copy`` lossless tail
# remux for webm. Proven bit-identical to the whole-file path (``test_tail_seek_keepup.py``).
# Requires the ffmpeg/ffprobe CLI on the host (see README / docs/BACKLOG.md); if the binary
# is ABSENT the tail path falls back to the whole-file OpenCV decode (correct, O(elapsed)) so
# CI / degraded deploys keep working — only a binary that RUNS-BUT-FAILS skips the window.
_TAIL_SEEK_MARGIN_S = 3.0   # seek this far before (duration-60) so the trailing bucket reps
                            # are decoded from before their first frame (else B2 phase reset)
_MIN_SEEK_MS = 8_000.0      # below this trailing offset the clip is short enough that a
                            # whole-file decode is already bounded — skip the seek machinery
_NATIVE_SEEK_TOL_MS = 2_000.0   # a real forward seek lands near the target; a webm no-op
                                # rewinds to ~0 — used to detect the un-seekable webm case
_TS_MATCH_TOL_MS = 10.0     # file-global grid ts ↔ decoded tail ts must align this tightly
                            # (proven 0 ms); a larger gap means a mis-seek -> skip the window
_TRIMMED_START_MS = 1_000.0  # a fresh continuous recording's first packet sits at ~0 ms; a
                             # header+tail upload's first packet sits at its cut point, which
                             # is >= ~60 s in before the client ever trims (2026-08-06 spike:
                             # both containers stamp ABSOLUTE original-timeline positions, so
                             # ffprobe sees the cut point) — 1 s splits the two cleanly
_FF_TIMEOUT_S = 30.0        # hard cap on any ffmpeg/ffprobe subprocess
_FFMPEG_BIN = "ffmpeg"
_FFPROBE_BIN = "ffprobe"


class _FFmpegUnavailable(Exception):
    """The ffmpeg/ffprobe BINARY is not installed (vs. present-but-failed-on-this-clip).

    Absence is a host/deploy condition, not a bad upload: the tail path degrades to the
    whole-file OpenCV decode (correct, O(elapsed)) rather than skipping every window, which
    also keeps the synthetic CI tests (no ffmpeg) green. A binary that RUNS but fails or
    times out on a specific clip raises ``FeatureExtractionError`` instead -> skipped window."""

# Effective kept rate after Step 1 (5 fps) + Step 2 (%2): 2.5 fps -> one frame every
# 400 ms. The 200 ms phase (half the period) is the time of the FIRST frame the legacy
# skip_ratio sampler keeps on constant-rate input, so the timestamp sampler reproduces
# the legacy CFR selection bit-for-bit (see _timestamp_keep_indices).
EFFECTIVE_FPS = TARGET_FPS / FRAME_SKIP_MOD     # 2.5
_SAMPLE_PERIOD_MS = 1000.0 / EFFECTIVE_FPS      # 400.0
_SAMPLE_PHASE_MS = _SAMPLE_PERIOD_MS / 2.0      # 200.0
_TS_EPSILON_MS = 1e-3                            # float guard at exact grid boundaries

# A stream is treated as constant-frame-rate (and therefore safe to sample with the
# legacy index path, preserving validated mp4 fidelity) only when its inter-frame
# intervals are near-uniform AND the container's reported fps matches the timestamps.
# Real Chrome MediaRecorder webm sits far on the other side of both (interval CoV ~1.6,
# reported fps 1000 vs true ~24); a CFR mp4/avi sits at CoV ~0.0 with an exact fps.
_CFR_INTERVAL_COV_MAX = 0.05
_FPS_REL_TOL = 0.10


# ── per-window decode probe (#247, 2026-08-07) ────────────────────────────────────────
# The blip under investigation is a DECODE TRUNCATION: OpenCV stops producing frames
# before the container's last packet. Because both trimmed-tail branches recover the
# absolute clock by anchoring the LAST decoded frame to the known duration
# (``offset = duration_ms - rel_ts[-1]``), a truncation does not lose the tail — it shifts
# EVERY timestamp forward by however much was truncated, and ``_pick_frames_by_timestamp``
# then rejects the window. That shift is invisible in the anchored output (the anchor is
# self-consistent), so it cannot be recovered after the fact from ``abs_ts`` alone.
#
# The two quantities that name the mechanism are therefore captured BEFORE the anchor:
#
#   ``anchor_skew_ms``      = container_span - decoded_span. The truncation, in ms,
#                             computed against an INDEPENDENT reference (the container's
#                             own packet span) rather than the suspect last-frame anchor.
#                             0 ⇒ the decode reached the last packet; > 0 ⇒ it stopped
#                             early by exactly that much, and every abs_ts is that wrong.
#   ``undecoded_packets``   = container_packets - decoded. The same fact in frames — the
#                             field the observed 101-frame quantisation reads out of.
#
# ``container_*`` is the file OpenCV was actually handed: the original upload for
# ``all_anchored``, the ffmpeg remux TEMP for ``remux`` (whose packets are counted with one
# extra ffprobe). Splitting those two is what tells a decoder-side truncation apart from a
# remux that itself dropped the tail, and what makes the remux-vs-all_anchored asymmetry
# testable from logs alone.
#
# LEVEL IS ADAPTIVE, and deliberately not tied to ``LOG_LEVEL=DEBUG``. A DEBUG-only line is
# armed only while someone remembers to leave DEBUG on; the moment production reverts to
# INFO the instrumentation goes silent without saying so. So a window that is OFF-BASELINE
# — any tail truncation, any undecoded packet, any unretrievable frame, or a grid offset
# drifting off zero — emits at WARNING and survives INFO, while an ordinary healthy window
# stays at DEBUG and keeps production quiet. In the 2026-08-07 session all 122 windows read
# exactly 0.0 on every one of those fields, so the baseline is measured, not assumed.
#
# The remux ffprobe is therefore NOT gated on DEBUG either: whether a window is off-baseline
# cannot be known until ``container_packets`` has been read, so the read has to happen first.
# Its cost is already inside the measured budget — the 2026-08-07 session ran with it on for
# every remux window and the per-window median was 5.24 s against a ~10 s stride.


def _probe_packet_span(video_path) -> tuple[int, float, float]:
    """``(packet_count, first_pts_ms, last_pts_ms)`` of what a container actually holds.

    Best-effort: any failure returns ``(-1, -1.0, -1.0)``. A diagnostic must never turn a
    decodable window into a skipped one."""
    try:
        _fps, ts = probe_global_timestamps_fast(video_path)
    except Exception:  # noqa: BLE001 - diagnostics must never affect extraction
        return -1, -1.0, -1.0
    if not ts:
        return 0, -1.0, -1.0
    return len(ts), ts[0], ts[-1]


def _decode_telemetry(rel_ts: list[float], frames: list) -> dict:
    """The pre-anchor decode facts: how many frames came out, how many were unretrievable,
    and WHERE on the decoder's own (container-relative, re-zeroed) clock they start and end.

    ``rel_first_ms`` / ``rel_last_ms`` are kept separately rather than collapsed into a span
    because a span cannot say at WHICH END frames went missing — and the two ends have
    opposite consequences. OpenCV re-zeroes POS_MSEC to the container's first packet, so
    ``rel_first_ms > 0`` means leading packets were dropped (HEAD loss: harmless, the
    last-frame anchor absorbs it) and ``rel_last_ms < container_span`` means the decoder
    stopped before the last packet (TAIL loss: the mis-anchor, and the only one that can
    produce this blip). Collapsing them hides that distinction — a real ``-c copy`` mp4
    remux was observed dropping 13 leading packets while anchoring perfectly."""
    return {
        "decoded": len(rel_ts),
        "none_frames": sum(1 for f in frames if f is None),
        "rel_first_ms": round(rel_ts[0], 1) if rel_ts else -1.0,
        "rel_last_ms": round(rel_ts[-1], 1) if rel_ts else -1.0,
        "decoded_span_ms": round(rel_ts[-1] - rel_ts[0], 1) if len(rel_ts) >= 2 else -1.0,
    }


# A healthy webm window reads exactly 0.0 on every field below (122/122 in the 2026-08-07
# session) and the grid-match tolerance is 10 ms, so 1 ms sits well inside the noise floor
# while still tripping long before the cliff — the drift is visible in the windows BEFORE
# one fails, which is the whole point of keeping the match offset on success.
_PROBE_DRIFT_TOL_MS = 1.0


def _probe_is_off_baseline(fields: dict) -> bool:
    """Is this window anything other than a clean decode? Unknown values are encoded as
    ``-1`` and must NOT trip the check — only positive deviations count."""

    def num(key: str) -> float:
        try:
            return float(fields.get(key, 0) or 0)
        except (TypeError, ValueError):
            return 0.0

    return (
        fields.get("outcome") == "miss"
        or num("tail_gap_ms") > 0
        or num("undecoded_packets") > 0
        or num("none_frames") > 0
        or num("match_max_off_ms") > _PROBE_DRIFT_TOL_MS
    )


def _emit_decode_probe(**fields) -> None:
    """One flat ``key=value`` line per window (server-side only, no frame content). Flat so
    it filters out of Log Analytics with a single ``decode-probe:`` substring match and
    parses without a schema.

    WARNING when the window is off-baseline — so the instrumentation stays armed under a
    production ``LOG_LEVEL=INFO`` — and DEBUG otherwise, so a healthy production session
    emits nothing. See the module note above for why the level is not simply DEBUG."""
    off_baseline = _probe_is_off_baseline(fields)
    if not off_baseline and not logger.isEnabledFor(logging.DEBUG):
        return
    try:
        line = "decode-probe: " + " ".join(f"{k}={v}" for k, v in fields.items())
        if off_baseline:
            logger.warning("%s", line)
        else:
            logger.debug("%s", line)
    except Exception:  # noqa: BLE001 - logging must never affect extraction
        pass


@dataclass
class DecodedClip:
    """Output of the decode pipeline: kept BGR frames and their landmark rows.

    ``frames[i]`` is the BGR frame whose FaceMesh landmarks are ``landmarks[i]``.
    LBP-TOP needs the pixels (``frames``); motion needs only ``landmarks``.
    """

    frames: list[np.ndarray]
    landmarks: np.ndarray  # (N_kept, 956)


def _build_face_mesh():  # pragma: no cover - exercised only with real mediapipe
    """Construct the locked FaceMesh detector (models/metadata.json["pipeline"])."""
    import mediapipe as mp

    return mp.solutions.face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,  # 478 landmarks (adds iris)
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )


def _landmarks_from_result(result) -> np.ndarray:
    """Flatten a FaceMesh result to a (956,) row; zero-row when no face detected."""
    faces = getattr(result, "multi_face_landmarks", None)
    if not faces:
        return np.zeros(LANDMARK_DIM, dtype=np.float64)
    coords = np.array([[p.x, p.y] for p in faces[0].landmark], dtype=np.float64).ravel()
    if coords.shape[0] != LANDMARK_DIM:
        # Unexpected landmark count -> treat defensively as a no-detection row.
        return np.zeros(LANDMARK_DIM, dtype=np.float64)
    return coords


def _index_keep_indices(n_frames: int, fps: float) -> list[int]:
    """The ORIGINAL skip_ratio selection, as explicit raw-frame indices.

    ``skip_ratio`` downsamples toward 5 fps (keep every skip_ratio-th frame), then the
    %2 step (FRAME_SKIP_MOD) halves it to ~2.5 fps. This is the shipped, model-validated
    selection; it is retained verbatim for CFR / reliable-metadata inputs so that path
    stays bit-identical (handoff §3 Steps 1-2).
    """
    skip_ratio = max(1, round(fps / TARGET_FPS)) if fps and fps > 0 else 1
    five = range(0, n_frames, skip_ratio)  # raw indices i with i % skip_ratio == 0
    return [idx for k, idx in enumerate(five, start=1) if k % FRAME_SKIP_MOD == 0]


def _timestamp_keep_indices(
    timestamps_ms: Sequence[float], tail_seconds: float | None = None
) -> list[int]:
    """Keep the first frame that lands in each 1/2.5 s timestamp bucket.

    Driven by the frames' ACTUAL timestamps (CAP_PROP_POS_MSEC) instead of the reported
    fps, so a variable-frame-rate webm with unreliable container metadata still samples
    at a consistent ~2.5 fps. The bucket grid is phased at 200 ms so that, on a
    constant-rate stream (timestamps i*1000/fps), it selects exactly the frames the
    legacy index path keeps — preserving validated CFR fidelity. A large gap simply
    leaves intervening buckets empty (no catch-up clustering).

    ``tail_seconds`` (feature-008 tail-window option): the kept set is first computed on
    the WHOLE stream's **file-global grid** (anchored at the file's t=0, exactly as with no
    bound) and only THEN filtered to frames whose timestamp ``>= timestamps_ms[-1] -
    tail_seconds*1000`` — i.e. the *suffix* of the full-file selection. This is **never** a
    re-sample of the trailing sub-stream: re-zeroing the grid to the sub-stream's t=0 would
    offset every bucket by up to ½ the 400 ms period (the per-clip phase reset that sank B2;
    see :func:`_filter_to_tail` and ``research.md`` R-5).
    """
    kept: list[int] = []
    last_bucket = -1
    for idx, t in enumerate(timestamps_ms):
        bucket = int((t - _SAMPLE_PHASE_MS + _TS_EPSILON_MS) // _SAMPLE_PERIOD_MS)
        if bucket >= 0 and bucket > last_bucket:
            kept.append(idx)
            last_bucket = bucket
    if tail_seconds is not None:
        kept = _filter_to_tail(kept, timestamps_ms, tail_seconds)
    return kept


def _filter_to_tail(
    kept_indices: list[int], timestamps_ms: Sequence[float], tail_seconds: float
) -> list[int]:
    """Filter a FILE-GLOBAL keep-set down to its trailing ``tail_seconds`` window.

    The cutoff is ``timestamps_ms[-1] - tail_seconds*1000`` (POS_MSEC is in ms). Because the
    input indices were selected on the file-global grid anchored at the file's t=0, the
    returned indices are **exactly the suffix** of that selection — the property that makes
    the feature-008 tail-window "faithful by construction". This filtering MUST NOT be
    replaced by trimming/seeking to the last ``tail_seconds`` and re-running the sampler:
    that re-zeroes ``CAP_PROP_POS_MSEC`` to the sub-stream's t=0 and offsets every bucket by
    up to ½ the 400 ms sampling period (the exact per-clip phase reset that sank B2 — see
    ``research.md`` R-5 / ``smoke-tests.md`` Step F). On an empty keep-set it is a no-op; on
    a clip shorter than ``tail_seconds`` the cutoff falls before t=0 so every kept frame
    survives (reduces to the un-bounded selection).
    """
    if not kept_indices:
        return kept_indices
    cutoff_ms = timestamps_ms[-1] - tail_seconds * 1000.0
    return [i for i in kept_indices if timestamps_ms[i] >= cutoff_ms]


def _timestamps_reliable(timestamps_ms: Sequence[float]) -> bool:
    """True iff timestamps are usable for sampling: monotonic and spanning >0 ms."""
    arr = np.asarray(timestamps_ms, dtype=np.float64)
    if arr.size < 2:
        return False
    if not bool(np.all(np.diff(arr) >= 0)):  # non-decreasing
        return False
    return bool(arr[-1] - arr[0] > 0)


def _reported_fps_trustworthy(fps: float, timestamps_ms: Sequence[float]) -> bool:
    """True iff the stream is CFR with metadata that matches its timestamps.

    Only then is the legacy index path correct, so we keep it (bit-identical mp4). VFR
    webm fails the interval-regularity check even when its reported fps happens to be
    plausible, so it is routed to the timestamp sampler — making all webm sample at the
    same ~2.5 fps regardless of what fps the container reports.
    """
    if not fps or fps <= 0:
        return False
    arr = np.asarray(timestamps_ms, dtype=np.float64)
    diffs = np.diff(arr)
    if diffs.size == 0:
        return False
    mean = float(diffs.mean())
    if mean <= 0:
        return False
    if float(diffs.std() / mean) > _CFR_INTERVAL_COV_MAX:  # irregular intervals -> VFR
        return False
    span_s = (arr[-1] - arr[0]) / 1000.0
    true_fps = (arr.size - 1) / span_s if span_s > 0 else 0.0
    if true_fps <= 0:
        return False
    return abs(fps - true_fps) <= _FPS_REL_TOL * true_fps


def _select_keep_indices(
    n_frames: int,
    fps: float,
    timestamps_ms: Sequence[float],
    tail_seconds: float | None = None,
) -> list[int]:
    """Choose which raw-frame indices to keep, robust to unreliable container metadata.

    - broken timestamps (non-monotonic / zero span) -> legacy index path (no regression);
    - CFR with metadata matching the timestamps -> legacy index path (bit-identical mp4);
    - otherwise (VFR webm, garbage reported fps) -> timestamp sampler (~2.5 fps).

    ``tail_seconds`` (feature-008 tail-window option) bounds the result to the trailing window.
    It is applied **after** the file-global selection above (regardless of which path is taken),
    so the kept tail frames are exactly the *suffix* of the full-file selection — never a
    re-sampled sub-stream (the B2 phase reset; see :func:`_filter_to_tail`). ``None`` (or a clip
    shorter than ``tail_seconds``) leaves the selection unchanged — reducing exactly to the
    un-bounded path.
    """
    if not _timestamps_reliable(timestamps_ms):
        kept = _index_keep_indices(n_frames, fps)
    elif _reported_fps_trustworthy(fps, timestamps_ms):
        kept = _index_keep_indices(n_frames, fps)
    else:
        kept = _timestamp_keep_indices(timestamps_ms)
    if tail_seconds is not None:
        kept = _filter_to_tail(kept, timestamps_ms, tail_seconds)
    return kept


def extract_landmarks(
    video_path,
    tail_seconds: float | None = None,
    *,
    probe: tuple[float, list[float]] | None = None,
    trimmed_upload: bool = False,
) -> DecodedClip:
    """Decode ``video_path``, downsample to ~2.5 fps, and run FaceMesh per frame.

    Frame selection is driven by the frames' actual timestamps (CAP_PROP_POS_MSEC), not
    the container's reported fps, so a variable-frame-rate webm with unreliable metadata
    (observed fps=1000) samples at the same ~2.5 fps as a CFR mp4 — without changing the
    bit-exact selection on the CFR clips the model was validated on. See
    ``_select_keep_indices``.

    ``tail_seconds`` (feature-008 tail-window option) bounds the kept frames to the trailing
    window. With ``None`` the WHOLE clip is decoded (``_extract_landmarks_wholefile`` — the
    anchor/calibration path, unchanged). With ``tail_seconds`` set the read path uses the
    **O(stride) tail decode** (``_extract_landmarks_tail``): it never walks (decodes) the whole
    growing clip — the file-global grid comes from a cheap ffprobe packet read and only the
    bounded trailing window is decoded. Both yield the *identical* (file-global-grid) suffix of
    frames — proven bit-identical in ``test_tail_seek_keepup.py``.

    ``probe`` (tail path only): a precomputed ``(fps, timestamps_ms)`` from
    ``probe_global_timestamps_fast`` — the caller already ran the ffprobe packet read (for the
    ``< 60 s`` gate) and passes it through so the same demux is not run twice per window.

    ``trimmed_upload`` (tail path only): the caller declares the file a client-side
    header+tail upload. Only consulted when ffprobe is UNAVAILABLE — a trimmed file must
    then fail closed rather than fall back to the whole-file OpenCV decode, whose re-zeroed
    clock would re-anchor the sampling grid at the cut point (the B2 phase reset — silently
    wrong-ish scores). With ffprobe present the trim is self-detected from the absolute
    timestamps regardless of this flag.
    """
    if tail_seconds is None:
        return _extract_landmarks_wholefile(video_path, tail_seconds=None)
    return _extract_landmarks_tail(
        video_path, tail_seconds, probe=probe, trimmed_upload=trimmed_upload
    )


def _landmarks_for_frames(frames: list[np.ndarray]) -> np.ndarray:
    """Run FaceMesh over an ordered frame list (BGR→RGB) → (N, 956) landmark rows.

    A FRESH FaceMesh per call, fed the kept frames in order — so the same kept-frame
    sequence yields identical landmarks whether the frames came from the whole-file decode
    or the bounded tail decode (the motion block's faithfulness rests on this)."""
    face_mesh = _build_face_mesh()
    rows: list[np.ndarray] = []
    try:
        for frame in frames:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rows.append(_landmarks_from_result(face_mesh.process(rgb)))
    finally:
        close = getattr(face_mesh, "close", None)
        if callable(close):
            close()
    return np.asarray(rows, dtype=np.float64)


def _extract_landmarks_wholefile(video_path, tail_seconds: float | None = None) -> DecodedClip:
    """The whole-file decode path (unchanged): pass-1 grab probes per-frame timestamps to
    choose the keep set, pass-2 retrieves just those frames, then FaceMesh.

    This is the anchor/calibration path (``tail_seconds=None``) AND the fidelity REFERENCE +
    graceful FALLBACK for the tail path (a clip ``<= tail`` or a host without the ffmpeg CLI).
    Decode is O(elapsed) — fine for a fixed-size anchor clip, but the reason the live read
    path uses ``_extract_landmarks_tail`` instead.
    """
    fps, frame_count, width, height, timestamps_ms = _probe_timestamps(video_path)
    n_decoded = len(timestamps_ms)
    keep_set = set(_select_keep_indices(n_decoded, fps, timestamps_ms, tail_seconds=tail_seconds))

    # Pass 2 - retrieve only the selected frames (sequential decode; no seeking, which is
    # unreliable on VFR webm). Stop once the last kept frame is read.
    kept = _retrieve_frames(video_path, keep_set)
    if not kept:
        raise FeatureExtractionError("no frames left after downsample")

    landmarks = _landmarks_for_frames(kept)

    # DEBUG observability (quiet by default — emits only when this logger is at DEBUG):
    # one line per decode recording the chosen sampling path and frame counts, to diagnose
    # any future VFR / decode regression. SERVER-SIDE ONLY (nothing here reaches the HTTP
    # client); `usable` = non-zero rows, the detected-face predicate the coverage gate uses.
    # Wrapped so a logging error can never affect extraction.
    if logger.isEnabledFor(logging.DEBUG):
        try:
            reliable = _timestamps_reliable(timestamps_ms)
            sampling = (
                "index(legacy)"
                if (not reliable or _reported_fps_trustworthy(fps, timestamps_ms))
                else "timestamp(2.5fps)"
            )
            span_s = (timestamps_ms[-1] - timestamps_ms[0]) / 1000.0 if reliable else 0.0
            true_fps = (n_decoded - 1) / span_s if span_s > 0 else 0.0
            usable = int(np.count_nonzero(np.any(landmarks, axis=1)))
            logger.debug(
                "decode: container=%s reported_fps=%.3f frame_count=%d resolution=%dx%d "
                "true_fps=%.3f sampling=%s raw_decoded=%d kept=%d usable=%d",
                Path(str(video_path)).suffix or "?",
                fps if fps else 0.0,
                int(frame_count),
                int(width),
                int(height),
                true_fps,
                sampling,
                n_decoded,
                len(kept),
                usable,
            )
        except Exception:  # noqa: BLE001 - logging must never affect extraction
            pass

    return DecodedClip(frames=kept, landmarks=landmarks)


def _extract_landmarks_tail(
    video_path,
    tail_seconds: float,
    *,
    probe: tuple[float, list[float]] | None = None,
    trimmed_upload: bool = False,
) -> DecodedClip:
    """O(stride) tail decode — the live read path (feature-008 keep-up fix).

    Never walks the whole growing clip: (1) a cheap ffprobe PACKET read gives the file-global
    per-frame timestamps + reported fps (demux only, no pixel decode) — or the caller passes
    it in via ``probe`` so the same demux never runs twice per window; (2) the file-global
    2.5 fps keep-set is computed exactly as the whole-file path would (``_select_keep_indices``
    — both samplers, faithful by construction); (3) only the bounded trailing window is decoded
    (native seek for mp4, ffmpeg ``-c copy`` remux for un-seekable webm); (4) each kept
    file-global timestamp is matched to its decoded tail frame. The result is the *identical*
    suffix of frames the whole-file path keeps (bit-identical — ``test_tail_seek_keepup.py``).

    **Trimmed (header+tail) uploads** (2026-08-06 spike, verdict GO): both containers stamp
    media with ABSOLUTE original-timeline positions, so the ffprobe timestamps of a trimmed
    file sit on the original clock and the file-global grid above is already correct. What a
    trimmed file must NEVER touch is any path that trusts OpenCV's clock from t=0 — OpenCV
    re-zeroes POS_MSEC on a trimmed container, so ``_extract_landmarks_wholefile`` would
    re-anchor the grid at the cut point (the B2 phase reset — silently wrong-ish scores, no
    error). A trim is self-detected from ``timestamps[0]`` (``_TRIMMED_START_MS``) and routed
    to ``_tail_from_trimmed``, which recovers the absolute clock by anchoring the decoded
    frames' last timestamp to the known absolute duration (the same anchoring the webm remux
    path already uses) and verifies every kept frame within ``_TS_MATCH_TOL_MS``.

    Falls back to ``_extract_landmarks_wholefile`` ONLY for un-trimmed input, when the ffmpeg
    CLI is absent or the clip is short enough that a whole-file decode is already bounded. A
    trimmed upload with ffprobe unavailable (declared via ``trimmed_upload`` — without ffprobe
    the trim cannot be self-detected) fails closed with ``FeatureExtractionError`` (skipped
    window, loud) instead. A binary that RUNS but fails or times out raises
    ``FeatureExtractionError`` likewise."""
    if probe is not None:
        fps, all_ts = probe
    else:
        try:
            fps, all_ts = probe_global_timestamps_fast(video_path)
        except _FFmpegUnavailable:
            if trimmed_upload:
                raise FeatureExtractionError(
                    "trimmed (header+tail) upload with ffprobe unavailable — refusing the "
                    "whole-file fallback (its re-zeroed OpenCV clock would re-anchor the "
                    "sampling grid at the cut point); failing closed"
                ) from None
            return _extract_landmarks_wholefile(video_path, tail_seconds=tail_seconds)

    if not all_ts:
        raise FeatureExtractionError("ffprobe returned no frame timestamps")
    duration_ms = all_ts[-1]
    global_keep = _select_keep_indices(len(all_ts), fps, all_ts, tail_seconds=tail_seconds)
    if not global_keep:
        raise FeatureExtractionError("no frames left after downsample")

    if trimmed_upload or all_ts[0] > _TRIMMED_START_MS:
        if not trimmed_upload:
            # Self-detection fired on a file the caller did NOT declare trimmed. Every
            # container measured so far (Chrome WebM, Safari WebM, Safari fMP4) stamps
            # all_ts[0] == 0.0, so this should not happen for an un-trimmed upload — but
            # "no container stamps a nonzero first packet" is three stacks measured, not
            # proven. WARNING, not DEBUG: if the assumption is wrong somewhere we have not
            # looked, it must leave a trace rather than silently re-route the decode.
            logger.warning(
                "trim self-detected without a client declaration: first packet at "
                "%.1f ms (> %.0f ms) in %s — routing through the trimmed tail path",
                all_ts[0],
                _TRIMMED_START_MS,
                Path(str(video_path)).suffix or "?",
            )
        return _tail_from_trimmed(video_path, all_ts, global_keep, tail_seconds)

    seek_ms = duration_ms - (tail_seconds + _TAIL_SEEK_MARGIN_S) * 1000.0
    if seek_ms < _MIN_SEEK_MS:
        # The whole clip is (about) the window — a whole-file decode is already bounded, and
        # reduces EXACTLY to the tail selection (cutoff falls at/before the clip start).
        return _extract_landmarks_wholefile(video_path, tail_seconds=tail_seconds)

    tele: dict = {}
    try:
        tail_ts, tail_frames = _decode_tail(video_path, seek_ms, duration_ms, telemetry=tele)
    except _FFmpegUnavailable:
        return _extract_landmarks_wholefile(video_path, tail_seconds=tail_seconds)

    want_ts = [all_ts[g] for g in global_keep]
    # Same shape of line as the trimmed path, so one Log Analytics filter covers a whole
    # session — including the untrimmed windows at its start, before the client can cut.
    probe = {
        "branch": f"untrimmed/{tele.get('sub_branch', '?')}",
        "container": Path(str(video_path)).suffix or "?",
        "file_start_ms": f"{all_ts[0]:.1f}",
        "file_last_ms": f"{duration_ms:.1f}",
        "file_span_ms": f"{duration_ms - all_ts[0]:.1f}",
        "probe_packets": len(all_ts),
        "local_seek_ms": f"{seek_ms:.1f}",
        "container_packets": tele.get("container_packets", -1),
        "container_span_ms": tele.get("container_span_ms", -1.0),
        "decoded": tele.get("decoded", len(tail_frames)),
        "decoded_span_ms": tele.get("decoded_span_ms", -1.0),
        "rel_first_ms": tele.get("rel_first_ms", -1.0),
        "rel_last_ms": tele.get("rel_last_ms", -1.0),
        "none_frames": tele.get("none_frames", -1),
        "wanted": len(want_ts),
        "want_first_ms": f"{want_ts[0]:.1f}" if want_ts else -1.0,
        "want_last_ms": f"{want_ts[-1]:.1f}" if want_ts else -1.0,
    }
    try:
        kept = _pick_frames_by_timestamp(tail_ts, tail_frames, want_ts, telemetry=tele)
    except FeatureExtractionError:
        _emit_decode_probe(outcome="miss", **probe, **_match_fields(tele))
        raise
    landmarks = _landmarks_for_frames(kept)
    _emit_decode_probe(outcome="ok", **probe, **_match_fields(tele), kept=len(kept))

    return DecodedClip(frames=kept, landmarks=landmarks)


def _tail_from_trimmed(
    video_path, all_ts: list[float], global_keep: list[int], tail_seconds: float
) -> DecodedClip:
    """Decode a client-trimmed (header+tail) upload on the file-global absolute clock.

    The ffprobe timestamps (``all_ts``) are absolute (both containers stamp original-timeline
    positions), so the keep-set is already on the original grid. OpenCV, however, re-zeroes
    POS_MSEC on a trimmed container (both webm and fMP4 — 2026-08-06 spike) while preserving
    inter-frame deltas, so the absolute clock is recovered by anchoring the LAST decoded frame
    to the known absolute duration (the file's last packet IS its last frame — exactly the
    anchoring ``_decode_tail_ffmpeg_remux`` already relies on). ``_pick_frames_by_timestamp``
    then verifies every kept frame within ``_TS_MATCH_TOL_MS`` — a mis-cut, a decode
    truncation, or a mis-anchor all surface as a LOUD skipped window, never a wrong score.

    The whole (bounded, client-cut) file is normally decoded sequentially — the client sends
    ~``tail_seconds`` + margin, so this is O(window). Defensively, a much longer trimmed file
    (a client that trims late) is tail-decoded via the ffmpeg remux (anchored to the absolute
    duration, so still correct); it must never fall through to ``_extract_landmarks_wholefile``.
    """
    duration_ms = all_ts[-1]
    local_seek_ms = (duration_ms - (tail_seconds + _TAIL_SEEK_MARGIN_S) * 1000.0) - all_ts[0]
    file_span_ms = duration_ms - all_ts[0]
    # Always collected (counts and spans the decode already has in hand); the extra ffprobe
    # on the remux temp inside _decode_tail_ffmpeg_remux is separately DEBUG-gated.
    tele: dict = {}
    if local_seek_ms >= _MIN_SEEK_MS:
        # Fat tail: bound the decode with the remux path, seeking in the FILE-LOCAL clock
        # (ffmpeg -ss addresses the trimmed file's own timeline) and anchoring the result to
        # the absolute duration. _FFmpegUnavailable must fail closed here (see above).
        branch = "remux"
        try:
            abs_ts, frames = _decode_tail_ffmpeg_remux(
                video_path, local_seek_ms, duration_ms, telemetry=tele
            )
        except _FFmpegUnavailable:
            raise FeatureExtractionError(
                "trimmed upload needs the ffmpeg CLI for a bounded tail decode — failing "
                "closed rather than re-anchoring the grid at the cut point"
            ) from None
    else:
        branch = "all_anchored"
        # The container OpenCV is handed here IS the upload, whose packets the caller already
        # probed — so container_packets/container_span come free and exactly, with no second
        # ffprobe. This is the branch's one structural advantage over remux as a diagnostic.
        tele.update(container_packets=len(all_ts), container_span_ms=round(file_span_ms, 1))
        abs_ts, frames = _decode_all_anchored(video_path, duration_ms, telemetry=tele)

    # The derived quantities that name a truncation. All measured against the container's
    # own span/packet count — NOT against the anchored abs_ts, which a truncation shifts
    # self-consistently and therefore cannot betray itself in.
    #
    # head_gap_ms and tail_gap_ms are reported separately and ONLY tail_gap_ms is the
    # suspect: the clock is recovered by pinning the LAST decoded frame to the known
    # duration, so dropped leading frames change nothing while a decoder that stops early
    # shifts every timestamp forward by exactly tail_gap_ms.
    container_span = tele.get("container_span_ms", -1.0)
    container_packets = tele.get("container_packets", -1)
    decoded_span = tele.get("decoded_span_ms", -1.0)
    decoded_n = tele.get("decoded", len(frames))
    rel_first = tele.get("rel_first_ms", -1.0)
    rel_last = tele.get("rel_last_ms", -1.0)
    head_gap_ms = round(rel_first, 1) if rel_first >= 0 else -1.0
    tail_gap_ms = (
        round(container_span - rel_last, 1) if container_span >= 0 and rel_last >= 0 else -1.0
    )
    anchor_skew_ms = (
        round(container_span - decoded_span, 1)
        if container_span >= 0 and decoded_span >= 0
        else -1.0
    )
    undecoded_packets = container_packets - decoded_n if container_packets >= 0 else -1

    want_ts = [all_ts[g] for g in global_keep]
    probe = {
        "branch": branch,
        "container": Path(str(video_path)).suffix or "?",
        "file_start_ms": f"{all_ts[0]:.1f}",
        "file_last_ms": f"{duration_ms:.1f}",
        "file_span_ms": f"{file_span_ms:.1f}",
        "probe_packets": len(all_ts),
        "local_seek_ms": f"{local_seek_ms:.1f}",
        "container_packets": container_packets,
        "container_span_ms": container_span,
        "decoded": decoded_n,
        "decoded_span_ms": decoded_span,
        "rel_first_ms": rel_first,
        "rel_last_ms": rel_last,
        "none_frames": tele.get("none_frames", -1),
        # ↓ the ones that name the mechanism; tail_gap_ms is the mis-anchor, head_gap_ms is
        #   harmless, undecoded_packets is the same fact in frames (the 101-quantum reads here)
        "undecoded_packets": undecoded_packets,
        "head_gap_ms": head_gap_ms,
        "tail_gap_ms": tail_gap_ms,
        "anchor_skew_ms": anchor_skew_ms,
        "wanted": len(want_ts),
        "want_first_ms": f"{want_ts[0]:.1f}" if want_ts else -1.0,
        "want_last_ms": f"{want_ts[-1]:.1f}" if want_ts else -1.0,
    }
    try:
        kept = _pick_frames_by_timestamp(abs_ts, frames, want_ts, telemetry=tele)
    except FeatureExtractionError as exc:
        # A skip here is classified `our-side` and the coarse cause is ALL the caller keeps,
        # so without this the failure is invisible in production — which is exactly what
        # happened on 2026-08-06: seven consecutive skips whose cause could not be recovered
        # from the logs. Re-raise the SAME failure with the state needed to tell the two
        # decode branches apart and to see whether the clock anchoring or the cut is at
        # fault. Timestamps and counts only — no frame content.
        _emit_decode_probe(outcome="miss", **probe, **_match_fields(tele))
        dec_span = (abs_ts[-1] - abs_ts[0]) / 1000.0 if len(abs_ts) >= 2 else -1.0
        dec_last = abs_ts[-1] if abs_ts else -1.0
        want_last = want_ts[-1] if want_ts else -1.0
        raise FeatureExtractionError(
            f"{exc} [branch={branch} file_start={all_ts[0]:.1f}ms "
            f"duration={duration_ms:.1f}ms span={file_span_ms / 1000.0:.1f}s "
            f"local_seek={local_seek_ms:.1f}ms probe_packets={len(all_ts)} "
            f"decoded={len(frames)} wanted={len(want_ts)} decoded_span={dec_span:.1f}s "
            f"decoded_last={dec_last:.1f}ms want_last={want_last:.1f}ms "
            f"container_packets={container_packets} undecoded_packets={undecoded_packets} "
            f"head_gap_ms={head_gap_ms} tail_gap_ms={tail_gap_ms} "
            f"anchor_skew_ms={anchor_skew_ms} "
            f"match_max_off_ms={tele.get('match_max_off_ms', -1.0)} "
            f"matched={tele.get('matched', -1)}]"
        ) from exc
    landmarks = _landmarks_for_frames(kept)
    _emit_decode_probe(outcome="ok", **probe, **_match_fields(tele), kept=len(kept))

    return DecodedClip(frames=kept, landmarks=landmarks)


def _match_fields(tele: dict) -> dict:
    """The grid-match outcome fields, present on both the success and the miss line."""
    return {
        "match_max_off_ms": tele.get("match_max_off_ms", -1.0),
        "match_worst_want_ms": tele.get("match_worst_want_ms", -1.0),
        "matched": tele.get("matched", -1),
    }


def _decode_all_anchored(
    video_path, duration_ms: float, *, telemetry: dict | None = None
) -> tuple[list[float], list]:
    """Sequentially decode ALL frames of a bounded trimmed file; return them on the
    file-global absolute clock by anchoring the last frame to ``duration_ms``.

    OpenCV's re-zeroed POS_MSEC is never trusted as an absolute time — only its deltas are
    used, via the last-frame anchor. A decode truncation (OpenCV stopping before the file's
    last packet) mis-anchors every timestamp, which ``_pick_frames_by_timestamp``'s
    ``_TS_MATCH_TOL_MS`` check then rejects loudly (the 400 ms grid cannot hide a >10 ms
    shift) — never a silent wrong score."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise FeatureExtractionError(f"could not open video: {video_path}")
    rel_ts: list[float] = []
    frames: list = []
    try:
        while cap.grab():
            rel_ts.append(cap.get(cv2.CAP_PROP_POS_MSEC))
            ok, frame = cap.retrieve()
            frames.append(frame if ok else None)
    finally:
        cap.release()
    if not rel_ts:
        raise FeatureExtractionError("trimmed upload decoded no frames")
    if telemetry is not None:
        telemetry.update(_decode_telemetry(rel_ts, frames))
    offset = duration_ms - rel_ts[-1]
    return [offset + t for t in rel_ts], frames


def _run_ff(cmd: list[str]) -> subprocess.CompletedProcess:
    """Run an ffmpeg/ffprobe subprocess with a hard timeout.

    A missing BINARY (``FileNotFoundError``) raises ``_FFmpegUnavailable`` so the caller can
    fall back to the whole-file decode; a timeout raises ``FeatureExtractionError`` (the
    window is skipped). stdout/stderr are captured so ffmpeg never writes to the API's logs."""
    try:
        return subprocess.run(cmd, capture_output=True, timeout=_FF_TIMEOUT_S)
    except FileNotFoundError as exc:
        raise _FFmpegUnavailable(f"{cmd[0]} not found on PATH") from exc
    except subprocess.TimeoutExpired as exc:
        raise FeatureExtractionError(f"{cmd[0]} timed out after {_FF_TIMEOUT_S:.0f}s") from exc


def probe_global_timestamps_fast(video_path) -> tuple[float, list[float]]:
    """File-global per-frame timestamps (ms, sorted) + reported fps via an ffprobe PACKET
    read — demux only, NO pixel decode, so it does not grow with the recording the way the
    whole-file grab probe does (the O(stride) replacement for the ``< 60 s`` gate + the grid).

    Reported fps is the stream's ``avg_frame_rate`` (``r_frame_rate`` fallback), or ``0.0``
    when the container reports none — the same routing input ``_select_keep_indices`` already
    handles (webm's garbage rate → timestamp sampler; a true CFR rate → legacy index path).
    Raises ``FeatureExtractionError`` on an unreadable clip / empty stream; ``_FFmpegUnavailable``
    if the ffprobe binary is absent (caller falls back to the whole-file probe)."""
    proc = _run_ff([
        _FFPROBE_BIN, "-v", "error", "-select_streams", "v:0",
        "-show_entries", "packet=pts_time",
        "-show_entries", "stream=avg_frame_rate,r_frame_rate",
        "-of", "json", str(video_path),
    ])
    if proc.returncode != 0:
        raise FeatureExtractionError(f"ffprobe failed on {video_path}")
    try:
        data = json.loads(proc.stdout or b"{}")
    except json.JSONDecodeError as exc:
        raise FeatureExtractionError("ffprobe returned invalid JSON") from exc

    ts = sorted(
        float(p["pts_time"]) * 1000.0
        for p in data.get("packets", [])
        if p.get("pts_time") not in (None, "N/A")
    )
    stream = (data.get("streams") or [{}])[0]
    rate = stream.get("avg_frame_rate") or stream.get("r_frame_rate") or "0/1"
    try:
        num, den = rate.split("/")
        fps = float(num) / float(den) if float(den) else 0.0
    except (ValueError, ZeroDivisionError):
        fps = 0.0
    return fps, ts


def _decode_tail(
    video_path, seek_ms: float, duration_ms: float, *, telemetry: dict | None = None
) -> tuple[list[float], list]:
    """Decode only the trailing window. Return ``(abs_ts_ms, frames)`` on the file-global
    clock so the caller can match frames to the file-global keep-set.

    Tries OpenCV's native seek first (works for mp4/finalized clips — POS_MSEC is absolute);
    if the seek is a no-op rewind to ~0 (the un-finalized webm case) it falls back to an
    ffmpeg ``-c copy`` lossless tail remux + OpenCV decode, anchored to the duration."""
    native = _decode_tail_native_seek(video_path, seek_ms)
    if native is not None:
        if telemetry is not None:
            telemetry.update(_decode_telemetry(native[0], native[1]), sub_branch="native_seek")
        return native
    if telemetry is not None:
        telemetry["sub_branch"] = "remux"
    return _decode_tail_ffmpeg_remux(video_path, seek_ms, duration_ms, telemetry=telemetry)


def _decode_tail_native_seek(video_path, seek_ms: float):
    """OpenCV native seek tail decode (mp4/finalized). Returns ``(abs_ts, frames)`` if the
    seek actually moved forward, else ``None`` (an un-finalized webm rewinds to ~0 — caller
    falls back to ffmpeg). POS_MSEC after a real seek is the absolute file-global time."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise FeatureExtractionError(f"could not open video: {video_path}")
    try:
        cap.set(cv2.CAP_PROP_POS_MSEC, seek_ms)
        if not cap.grab():
            return None
        first = cap.get(cv2.CAP_PROP_POS_MSEC)
        # A genuine forward seek lands near the target (a keyframe at/just before it); an
        # un-finalized webm ignores the seek and rewinds to ~0. seek_ms >= _MIN_SEEK_MS here.
        if first < seek_ms - _NATIVE_SEEK_TOL_MS and first < _NATIVE_SEEK_TOL_MS:
            return None
        ts: list[float] = []
        frames: list = []
        ok, frame = cap.retrieve()
        ts.append(first)
        frames.append(frame if ok else None)
        while cap.grab():
            ts.append(cap.get(cv2.CAP_PROP_POS_MSEC))
            ok, frame = cap.retrieve()
            frames.append(frame if ok else None)
        return ts, frames
    finally:
        cap.release()


def _decode_tail_ffmpeg_remux(
    video_path, seek_ms: float, duration_ms: float, *, telemetry: dict | None = None
):
    """ffmpeg ``-c copy`` lossless tail remux (un-seekable webm) → OpenCV decode.

    ``-ss <seek> -c copy`` copies the VP8/VP9 packets unchanged from the keyframe at/before
    the seek to EOF, so OpenCV decodes them to bit-identical pixels (same decoder). OpenCV
    re-zeroes the remux's POS_MSEC, so the file-global clock is recovered by anchoring the
    remux's LAST frame to the known duration (its last frame IS the file's last frame)."""
    suffix = Path(str(video_path)).suffix or ".webm"
    fd, tmp = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        proc = _run_ff([
            _FFMPEG_BIN, "-hide_banner", "-v", "error", "-ss", f"{seek_ms / 1000.0:.3f}",
            "-i", str(video_path), "-c", "copy", "-y", tmp,
        ])
        if proc.returncode != 0 or not os.path.getsize(tmp):
            raise FeatureExtractionError("ffmpeg tail remux failed")
        if telemetry is not None:
            # What the REMUX contains, independently of what OpenCV manages to decode from
            # it. Without this the two candidate mechanisms — ffmpeg dropped the tail during
            # the copy, vs OpenCV stopped early on a complete remux — are indistinguishable.
            # One extra ffprobe (demux only) per remux window, unconditional: the
            # off-baseline test cannot run until this count exists (see the module note).
            n_pk, first_pk, last_pk = _probe_packet_span(tmp)
            telemetry.update(
                container_packets=n_pk,
                container_span_ms=round(last_pk - first_pk, 1) if n_pk > 1 else -1.0,
                remux_bytes=os.path.getsize(tmp),
            )
        cap = cv2.VideoCapture(tmp)
        if not cap.isOpened():
            raise FeatureExtractionError("could not open remuxed tail clip")
        rel_ts: list[float] = []
        frames: list = []
        try:
            while cap.grab():
                rel_ts.append(cap.get(cv2.CAP_PROP_POS_MSEC))
                ok, frame = cap.retrieve()
                frames.append(frame if ok else None)
        finally:
            cap.release()
        if not rel_ts:
            raise FeatureExtractionError("remuxed tail clip decoded no frames")
        if telemetry is not None:
            telemetry.update(_decode_telemetry(rel_ts, frames))
        # Anchor to the file-global clock: the remux's last frame == the file's last frame,
        # at absolute time ``duration_ms``. POS_MSEC deltas are preserved by the lossless copy.
        offset = duration_ms - rel_ts[-1]
        abs_ts = [offset + t for t in rel_ts]
        return abs_ts, frames
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def _pick_frames_by_timestamp(
    tail_ts: list[float],
    tail_frames: list,
    want_ts: list[float],
    *,
    telemetry: dict | None = None,
) -> list:
    """Pick, for each wanted file-global timestamp, the decoded tail frame at that time.

    The wanted timestamps are the file-global keep-set; the tail frames carry the same
    file-global clock, so each match is exact (proven 0 ms). A gap beyond ``_TS_MATCH_TOL_MS``
    means the seek did not cover that frame (a mis-seek) → ``FeatureExtractionError`` so the
    window is skipped rather than scored on the wrong frames."""
    arr = np.asarray(tail_ts, dtype=np.float64)
    if arr.size == 0:
        raise FeatureExtractionError("tail decode produced no frames")
    out: list = []
    # Worst grid offset over ALL wanted frames, recorded on SUCCESS too. The tolerance is a
    # cliff — a window either matches or is skipped — so a binary outcome cannot show a
    # failure being approached. This turns it into a continuous signal: on a healthy window
    # it is ~0 ms (proven), and any drift toward the 10 ms tolerance is visible in the
    # windows BEFORE one fails.
    worst_off = 0.0
    worst_want = -1.0
    try:
        for wt in want_ts:
            i = int(np.argmin(np.abs(arr - wt)))
            off = float(abs(arr[i] - wt))
            if off > worst_off:
                worst_off, worst_want = off, wt
            if off > _TS_MATCH_TOL_MS:
                raise FeatureExtractionError(
                    f"tail frame for file-global ts {wt:.1f}ms missing (nearest off "
                    f"{off:.1f}ms) — seek did not cover the window"
                )
            frame = tail_frames[i]
            if frame is None:
                raise FeatureExtractionError("tail frame retrieve failed")
            out.append(frame)
    finally:
        if telemetry is not None:
            telemetry.update(
                match_max_off_ms=round(worst_off, 2),
                match_worst_want_ms=round(worst_want, 1),
                matched=len(out),
            )
    return out


def _probe_timestamps(video_path) -> tuple[float, float, float, float, list[float]]:
    """Pass 1: open the clip and collect per-frame timestamps without decoding pixels.

    Returns ``(reported_fps, frame_count, width, height, timestamps_ms)``. ``grab()``
    advances the decoder and updates CAP_PROP_POS_MSEC without the pixel ``retrieve()``,
    so this pass is cheaper than a full read. frame_count/width/height feed the DEBUG
    decode log only.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise FeatureExtractionError(f"could not open video: {video_path}")
    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        timestamps_ms: list[float] = []
        while cap.grab():
            timestamps_ms.append(cap.get(cv2.CAP_PROP_POS_MSEC))
    finally:
        cap.release()
    return fps, frame_count, width, height, timestamps_ms


def _retrieve_frames(video_path, keep_set: set[int]) -> list[np.ndarray]:
    """Pass 2: sequentially decode and return the frames whose raw index is in keep_set."""
    if not keep_set:
        return []
    last = max(keep_set)
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise FeatureExtractionError(f"could not open video: {video_path}")
    kept: list[np.ndarray] = []
    i = 0
    try:
        while i <= last:
            ok, frame = cap.read()
            if not ok:
                break
            if i in keep_set:
                kept.append(frame)
            i += 1
    finally:
        cap.release()
    return kept
