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


def extract_landmarks(video_path, tail_seconds: float | None = None) -> DecodedClip:
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
    """
    if tail_seconds is None:
        return _extract_landmarks_wholefile(video_path, tail_seconds=None)
    return _extract_landmarks_tail(video_path, tail_seconds)


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


def _extract_landmarks_tail(video_path, tail_seconds: float) -> DecodedClip:
    """O(stride) tail decode — the live read path (feature-008 keep-up fix).

    Never walks the whole growing clip: (1) a cheap ffprobe PACKET read gives the file-global
    per-frame timestamps + reported fps (demux only, no pixel decode); (2) the file-global
    2.5 fps keep-set is computed exactly as the whole-file path would (``_select_keep_indices``
    — both samplers, faithful by construction); (3) only the bounded trailing window is decoded
    (native seek for mp4, ffmpeg ``-c copy`` remux for un-seekable webm); (4) each kept
    file-global timestamp is matched to its decoded tail frame. The result is the *identical*
    suffix of frames the whole-file path keeps (bit-identical — ``test_tail_seek_keepup.py``).

    Falls back to ``_extract_landmarks_wholefile`` when the ffmpeg CLI is absent or the clip is
    short enough that a whole-file decode is already bounded. A binary that RUNS but fails or
    times out raises ``FeatureExtractionError`` (the caller maps it to a skipped window)."""
    try:
        fps, all_ts = probe_global_timestamps_fast(video_path)
    except _FFmpegUnavailable:
        return _extract_landmarks_wholefile(video_path, tail_seconds=tail_seconds)

    if not all_ts:
        raise FeatureExtractionError("ffprobe returned no frame timestamps")
    duration_ms = all_ts[-1]
    global_keep = _select_keep_indices(len(all_ts), fps, all_ts, tail_seconds=tail_seconds)
    if not global_keep:
        raise FeatureExtractionError("no frames left after downsample")

    seek_ms = duration_ms - (tail_seconds + _TAIL_SEEK_MARGIN_S) * 1000.0
    if seek_ms < _MIN_SEEK_MS:
        # The whole clip is (about) the window — a whole-file decode is already bounded, and
        # reduces EXACTLY to the tail selection (cutoff falls at/before the clip start).
        return _extract_landmarks_wholefile(video_path, tail_seconds=tail_seconds)

    try:
        tail_ts, tail_frames = _decode_tail(video_path, seek_ms, duration_ms)
    except _FFmpegUnavailable:
        return _extract_landmarks_wholefile(video_path, tail_seconds=tail_seconds)

    want_ts = [all_ts[g] for g in global_keep]
    kept = _pick_frames_by_timestamp(tail_ts, tail_frames, want_ts)
    landmarks = _landmarks_for_frames(kept)

    if logger.isEnabledFor(logging.DEBUG):
        try:
            logger.debug(
                "tail-decode: container=%s duration=%.1fs seek=%.1fs global_decoded=%d "
                "tail_decoded=%d kept=%d",
                Path(str(video_path)).suffix or "?",
                duration_ms / 1000.0,
                seek_ms / 1000.0,
                len(all_ts),
                len(tail_frames),
                len(kept),
            )
        except Exception:  # noqa: BLE001 - logging must never affect extraction
            pass

    return DecodedClip(frames=kept, landmarks=landmarks)


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


def _decode_tail(video_path, seek_ms: float, duration_ms: float) -> tuple[list[float], list]:
    """Decode only the trailing window. Return ``(abs_ts_ms, frames)`` on the file-global
    clock so the caller can match frames to the file-global keep-set.

    Tries OpenCV's native seek first (works for mp4/finalized clips — POS_MSEC is absolute);
    if the seek is a no-op rewind to ~0 (the un-finalized webm case) it falls back to an
    ffmpeg ``-c copy`` lossless tail remux + OpenCV decode, anchored to the duration."""
    native = _decode_tail_native_seek(video_path, seek_ms)
    if native is not None:
        return native
    return _decode_tail_ffmpeg_remux(video_path, seek_ms, duration_ms)


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


def _decode_tail_ffmpeg_remux(video_path, seek_ms: float, duration_ms: float):
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
    tail_ts: list[float], tail_frames: list, want_ts: list[float]
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
    for wt in want_ts:
        i = int(np.argmin(np.abs(arr - wt)))
        if abs(arr[i] - wt) > _TS_MATCH_TOL_MS:
            raise FeatureExtractionError(
                f"tail frame for file-global ts {wt:.1f}ms missing (nearest off "
                f"{abs(arr[i] - wt):.1f}ms) — seek did not cover the window"
            )
        frame = tail_frames[i]
        if frame is None:
            raise FeatureExtractionError("tail frame retrieve failed")
        out.append(frame)
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
