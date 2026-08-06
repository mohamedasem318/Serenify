"""The stress-inference read path — continuous single-stream (feature 008, US1 / T020).

Each window POST hands us the **contiguous recording-so-far** from one continuous
``MediaRecorder``. For one window we:

  1. write it to a temp file (deleted in ``finally`` — Principle I, no raw video persists);
  2. probe its recorded duration — ``< 60 s`` → ``warming_up`` (gate (a); the 60 s window
     is locked by Principle II / FR-002, partial windows are NEVER scored);
  3. else tail-extract the trailing 60 s — ``compute_anchor(clip, tail_seconds=60)``
     (faithful by construction);
  4. read the caller's anchor (``get_my_anchor()``, forwarded JWT); ``delta = current − anchor``;
  5. ``predict_delta(delta)`` → ``proba``; **re-threshold** ``proba[1] >= operating_point``
     (``predict_delta``'s internal 0.5 / argmax label is IGNORED for both display AND the
     persisted per-window label);
  6. append ``proba[1]`` to the session's in-memory rolling buffer, smooth + band over the
     last ``N=4`` SCORED values (cold-start ``M=4`` → ``warming_up``);
  7. persist a ``window_readings`` row under RLS — server-only ``label`` + ``stress_probability``;
  8. on ``FeatureExtractionError`` → ``skipped`` (HTTP 200; routine, not an error).

**The operating point (0.53, config — never a literal) is applied TWICE:**
  - *per-window*: ``proba[1] >= operating_point`` → the persisted server-only ``label``;
  - *display*: the **smoothed mean** of ``proba[1]`` is banded at ``t_low=operating_point``
    / ``t_high=tense_band``. The displayed band derives from the smoothed mean, NOT from a
    single-window re-threshold.

**Smoothing buffer lives in server memory, not the DB (revised D-1 resolution).** The raw
``stress_probability`` is withheld from the ``authenticated`` role by the
``window_readings`` SELECT column whitelist, and there is no service-role — so the API
*cannot* read prior probabilities back. Instead it keeps the last ``N`` scored
``proba[1]`` per active session in memory (``_SessionBuffers``). No code path SELECTs
``stress_probability`` / ``label``. (Multi-worker / restart caveat: see ``docs/BACKLOG.md``
— single-worker, session affinity, or a shared cache is a production-deploy concern,
deferred. Recorded in ``docs/DECISIONS.md`` 2026-06-20.)
"""

from __future__ import annotations

import logging
import os
import tempfile
import time
from collections import OrderedDict, deque
from datetime import UTC, datetime

import ml_video
import numpy as np
from ml_video import FeatureExtractionError
from supabase import Client

from ..schemas import ReadingOutcome, SkippedOutcome, WarmingUpOutcome
from ..supabase_user import get_my_anchor, insert_reading
from .smoothing import N, smooth

logger = logging.getLogger(__name__)

# The 60 s window is LOCKED by Constitution Principle II (NON-NEGOTIABLE) / FR-002 — it is
# not a tunable threshold (unlike the config operating point / tense band), so it is a
# named constant, never sourced from env. Partial windows below it are never scored.
WINDOW_SECONDS = 60.0

# Content-type → temp-file suffix (matches the /anchor upload shape). The router validates
# membership (415 otherwise) before calling score_window.
WINDOW_MEDIA_SUFFIX = {"video/mp4": ".mp4", "video/webm": ".webm"}


class MissingAnchorError(Exception):
    """The caller's anchor is NULL at scoring time. The create-time guard (T021) ensures
    an anchor exists when a session starts, so this is only reachable if the anchor
    disappears mid-session. It is raised here (rather than fabricating a global/fallback
    anchor, which SC-004 forbids) so the gap is loud, never silent; the windows route
    (US3 / T042) catches it and returns the same defensive ``409 no_anchor`` the create
    route uses — never a 500, never a reading without the user's own anchor."""


class _SessionBuffers:
    """Per-session in-memory rolling buffer of the last ``N`` SCORED ``proba[1]`` values.

    Skipped and ``< 60 s`` warming-up windows never call :meth:`record_scored`, so they are
    excluded from both the buffer and the cold-start ``M`` count (the deque's ``maxlen=N``
    and ``M == N`` together encode both the smoothing window and the cold-start gate).

    Bounded by an LRU cap on the number of concurrent sessions so an abandoned session
    cannot grow the map without limit; the explicit per-session drop on End is wired in
    US2 / T036 (which will call :meth:`drop`). Graduation scale is tens of sessions, so the
    cap is generous.
    """

    def __init__(self, *, window: int = N, max_sessions: int = 1024) -> None:
        self._window = window
        self._max_sessions = max_sessions
        self._store: OrderedDict[str, deque[float]] = OrderedDict()

    def record_scored(self, session_id: str, proba1: float) -> list[float]:
        """Append a scored ``proba[1]`` and return the current buffer (oldest → newest)."""
        buf = self._store.get(session_id)
        if buf is None:
            buf = deque(maxlen=self._window)
            self._store[session_id] = buf
        self._store.move_to_end(session_id)  # mark most-recently-used
        buf.append(float(proba1))
        while len(self._store) > self._max_sessions:
            self._store.popitem(last=False)  # evict the least-recently-used session
        return list(buf)

    def scored_count(self, session_id: str) -> int:
        """How many scored ``proba[1]`` are currently buffered for this session (0 if none).

        Read-only — used by the DEBUG per-window decision log (never reads the DB)."""
        buf = self._store.get(session_id)
        return len(buf) if buf is not None else 0

    def drop(self, session_id: str) -> None:
        """Forget a session's buffer (call on End — US2 / T036)."""
        self._store.pop(session_id, None)

    def clear(self) -> None:
        """Drop all buffers (used by tests for isolation)."""
        self._store.clear()


# Module-level buffer shared across requests within this worker process.
buffers = _SessionBuffers()


def _coarse_cause(exc: FeatureExtractionError) -> str:
    """The COARSE server-side skip cause (the client refines low-light vs out-of-frame from
    its on-device telemetry). ``insufficient_face_frames`` (the feature-006 coverage gate) →
    ``insufficient-face``; anything else (decode/coverage/malformed) → ``our-side``. Count-free,
    so no numeric detail leaks (FR-016, Principle I)."""
    if getattr(exc, "code", None) == "insufficient_face_frames":
        return "insufficient-face"
    return "our-side"


def _debug_window(
    session_id: str, *, probe_s: float, decision: str, reason: str, scored: int
) -> None:
    """DEBUG-only, per-window decision trace (quiet by default — emits only when this
    logger is at DEBUG). SERVER-SIDE ONLY: nothing here reaches the HTTP client.

    The gap that let the live no-reading ship was that only finalized fixtures were
    exercised through this path, and there was no per-window visibility into what the
    server actually decided on the live un-finalized stream. This line lets a supervised
    smoke confirm, per window, whether the server emits ``reading`` / ``warming_up`` /
    ``skipped`` (and the cold-start ``scored/M`` progress) — so a future no-reading can be
    pinned on the server vs the frontend without guessing. Wrapped so a logging error can
    never affect scoring."""
    if not logger.isEnabledFor(logging.DEBUG):
        return
    try:
        logger.debug(
            "window: session=%s probe_s=%.2f decision=%s reason=%s scored=%d/%d",
            session_id,
            probe_s,
            decision,
            reason,
            scored,
            N,
        )
    except Exception:  # noqa: BLE001 - diagnostics must never affect scoring
        pass


def score_window(
    *,
    clip_bytes: bytes,
    content_type: str,
    client: Client,
    predictor: object,
    operating_point: float,
    tense_band: float,
    session_id: str,
    user_id: str,
    upload_kind: str = "full",
) -> ReadingOutcome | WarmingUpOutcome | SkippedOutcome:
    """Score one uploaded window. CPU-bound + blocking I/O — the router runs this in a
    threadpool. Returns the outcome and persists the row.

    ``upload_kind``: ``"full"`` (the contiguous recording-so-far — the original shape) or
    ``"tail"`` (a client-side **header+tail** upload, bounded w.r.t. session length — the
    2026-08-06 bounded-upload fix). The flag is advisory for one decision only: with the
    ffprobe binary absent a trimmed file cannot be told apart from a fresh recording (the
    OpenCV fallback clock re-zeroes), so a declared tail upload **fails closed** (skipped
    window, loud) rather than silently re-anchoring the sampling grid at the cut point.
    With ffprobe present the trim is self-detected from the absolute timestamps and the
    flag is not trusted for anything else.

    The uploaded clip is written to a temp file and **always deleted in ``finally``**
    (Principle I). The endpoint surfaces only the outcome union — never a probability.
    """
    captured_at = datetime.now(UTC)
    t_start = time.perf_counter()
    suffix = WINDOW_MEDIA_SUFFIX.get(content_type, ".bin")
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(clip_bytes)

        # ── extraction (skipped on any FeatureExtractionError) ───────────────
        recorded_s = -1.0  # for the DEBUG trace if the probe itself raises
        t_probe_ms = t_extract_ms = 0.0
        try:
            # ONE ffprobe packet read per window: the < 60 s gate reads its span, and the
            # tail decode reuses the same timestamps via ``probe=`` (previously the same
            # demux ran twice per window — the cheapest per-window saving named by the
            # 2026-08-06 spike).
            t0 = time.perf_counter()
            probe: tuple[float, list[float]] | None = None
            try:
                probe = ml_video.probe_window_timestamps(tmp_path)
                ts = probe[1]
                recorded_s = (ts[-1] - ts[0]) / 1000.0 if len(ts) >= 2 else 0.0
            except ml_video.FFmpegUnavailable:
                if upload_kind == "tail":
                    raise FeatureExtractionError(
                        "tail upload on an ffprobe-less host — failing closed (the "
                        "OpenCV fallback would re-anchor the grid at the cut point)"
                    ) from None
                # Un-trimmed upload on a degraded host: the OpenCV whole-file probe is
                # correct (span is re-zeroing-invariant), just O(elapsed).
                recorded_s = ml_video.probe_recorded_seconds(tmp_path)
            t_probe_ms = (time.perf_counter() - t0) * 1000.0
            if recorded_s < WINDOW_SECONDS:
                # Gate (a): not yet a full 60 s window — no extraction, no persistence.
                _debug_window(
                    session_id,
                    probe_s=recorded_s,
                    decision="warming_up",
                    reason="<60s (not scored)",
                    scored=buffers.scored_count(session_id),
                )
                return WarmingUpOutcome(captured_at=captured_at)
            t0 = time.perf_counter()
            # Only what deviates from the defaults is passed: the reused probe (when the
            # ffprobe read succeeded) and the tail declaration (when the client trimmed).
            extra: dict = {}
            if probe is not None:
                extra["probe"] = probe
            if upload_kind == "tail":
                extra["trimmed_upload"] = True
            features = ml_video.compute_anchor(
                tmp_path, tail_seconds=WINDOW_SECONDS, **extra
            )
            t_extract_ms = (time.perf_counter() - t0) * 1000.0
        except FeatureExtractionError as exc:
            cause = _coarse_cause(exc)
            insert_reading(
                client,
                session_id=session_id,
                user_id=user_id,
                captured_at=captured_at.isoformat(),
                scored=False,
                skip_cause=cause,
            )
            _debug_window(
                session_id,
                probe_s=recorded_s,
                decision="skipped",
                reason=f"FeatureExtractionError:{cause}",
                scored=buffers.scored_count(session_id),
            )
            return SkippedOutcome(cause=cause)

        # ── anchor → delta → predict ─────────────────────────────────────────
        anchor = get_my_anchor(client)
        if anchor is None:
            raise MissingAnchorError("anchor NULL at scoring time (mid-session) — see T042")
        delta = features - anchor
        _internal_label, proba = predictor.predict_delta(delta)
        proba1 = float(np.asarray(proba)[1])

        # FIRST application of the operating point: the per-window label (server-only). The
        # internal 0.5 / argmax label from predict_delta is deliberately discarded.
        per_window_label = int(proba1 >= operating_point)

        # SECOND application: band the SMOOTHED MEAN of the recent scored proba[1], not this
        # single window. record_scored appends THIS reading first (only scored windows enter
        # the buffer), so the mean includes the current value.
        recent = buffers.record_scored(session_id, proba1)
        reading = smooth(recent, t_low=operating_point, t_high=tense_band)

        insert_reading(
            client,
            session_id=session_id,
            user_id=user_id,
            captured_at=captured_at.isoformat(),
            scored=True,
            band=reading.band,  # None during cold-start (warming-up)
            label=per_window_label,
            stress_probability=proba1,
        )

        # DEBUG-only per-window timing (server-side only; the 2026-08-06 stride-budget
        # measurement reads these): payload size + where the time went.
        if logger.isEnabledFor(logging.DEBUG):
            try:
                logger.debug(
                    "window-timing: session=%s kind=%s bytes=%d probe_ms=%.0f "
                    "extract_ms=%.0f total_ms=%.0f",
                    session_id,
                    upload_kind,
                    len(clip_bytes),
                    t_probe_ms,
                    t_extract_ms,
                    (time.perf_counter() - t_start) * 1000.0,
                )
            except Exception:  # noqa: BLE001 - diagnostics must never affect scoring
                pass

        if reading.warming_up:
            _debug_window(
                session_id,
                probe_s=recorded_s,
                decision="warming_up",
                reason="scored, cold-start buffer < M",
                scored=len(recent),
            )
            return WarmingUpOutcome(captured_at=captured_at)
        _debug_window(
            session_id,
            probe_s=recorded_s,
            decision="reading",
            reason=f"scored>=M -> band={reading.band}",
            scored=len(recent),
        )
        return ReadingOutcome(band=reading.band, captured_at=captured_at)
    finally:
        # Principle I — the raw video never persists, on ANY outcome (reading / warming /
        # skipped / exception).
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
