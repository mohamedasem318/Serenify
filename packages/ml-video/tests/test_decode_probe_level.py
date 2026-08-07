"""The decode probe must stay armed under a production ``LOG_LEVEL=INFO``.

The per-window probe was originally DEBUG-only, which meant the instrumentation was armed
only for as long as someone remembered to leave ``LOG_LEVEL=DEBUG`` set on the revision —
and post-promotion cleanup reverts exactly that. A DEBUG-only probe would therefore go
silent without saying so, discarding the healthy baseline and the pre-failure drift signal
that the 2026-08-07 session existed to establish.

So the level is adaptive: off-baseline windows emit at WARNING (survives INFO), healthy
ones at DEBUG (production stays quiet). These tests pin both halves, plus the ``-1``
unknown-value encoding, which must never be mistaken for a deviation.
"""

from __future__ import annotations

import logging

from ml_video import pipeline

_HEALTHY = {
    "outcome": "ok",
    "branch": "remux",
    "container_packets": 987,
    "decoded": 987,
    "none_frames": 0,
    "undecoded_packets": 0,
    "head_gap_ms": 0.0,
    "tail_gap_ms": 0.0,
    "match_max_off_ms": 0.0,
}


def _emit(caplog, level: int, **overrides):
    caplog.set_level(level, logger="ml_video.pipeline")
    caplog.clear()
    pipeline._emit_decode_probe(**{**_HEALTHY, **overrides})
    return [r for r in caplog.records if "decode-probe" in r.getMessage()]


def test_healthy_window_is_silent_at_info(caplog):
    """A clean decode must not chatter in production."""
    assert _emit(caplog, logging.INFO) == []


def test_healthy_window_still_emits_at_debug(caplog):
    """...but the baseline is still recoverable by turning DEBUG on."""
    records = _emit(caplog, logging.DEBUG)
    assert len(records) == 1
    assert records[0].levelno == logging.DEBUG


def test_tail_truncation_warns_at_info(caplog):
    """The mis-anchor — the one truncation the last-frame anchor cannot absorb."""
    records = _emit(caplog, logging.INFO, tail_gap_ms=6704.0, undecoded_packets=101)
    assert len(records) == 1
    assert records[0].levelno == logging.WARNING
    assert "tail_gap_ms=6704.0" in records[0].getMessage()


def test_grid_drift_warns_before_the_cliff(caplog):
    """The match tolerance is 10 ms, so a 2 ms offset is still a PASSING window — it must
    warn anyway, because seeing the drift before a window fails is the point."""
    records = _emit(caplog, logging.INFO, match_max_off_ms=2.0)
    assert len(records) == 1
    assert records[0].levelno == logging.WARNING


def test_miss_outcome_warns_at_info(caplog):
    records = _emit(caplog, logging.INFO, outcome="miss")
    assert len(records) == 1
    assert records[0].levelno == logging.WARNING


def test_unretrievable_frame_warns_at_info(caplog):
    records = _emit(caplog, logging.INFO, none_frames=1)
    assert len(records) == 1
    assert records[0].levelno == logging.WARNING


def test_unknown_values_do_not_trip_the_check(caplog):
    """``-1`` means "not measured on this branch" (e.g. container_packets when the ffprobe
    failed). Treating it as a deviation would warn on every such window forever."""
    assert (
        _emit(
            caplog,
            logging.INFO,
            container_packets=-1,
            undecoded_packets=-1,
            head_gap_ms=-1.0,
            tail_gap_ms=-1.0,
            match_max_off_ms=-1.0,
            none_frames=-1,
        )
        == []
    )


def test_head_drop_alone_does_not_warn(caplog):
    """The remux's keyframe snap drops whole 101-frame units off the HEAD on almost every
    window (56/67 in the 2026-08-07 session). The last-frame anchor absorbs it, so warning
    on it would bury the signal under a permanent false positive."""
    assert _emit(caplog, logging.INFO, head_gap_ms=6704.0) == []
