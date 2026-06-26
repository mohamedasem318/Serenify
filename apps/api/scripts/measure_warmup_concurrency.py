#!/usr/bin/env python
"""Tier-2 warm-up concurrency — offline contention measurement (acceptance-bar trap b).

Replays the REAL continuous cold-start fixtures through the REAL ml_video extraction path
(``probe_recorded_seconds`` + ``compute_anchor(tail_seconds=60)`` — ffmpeg tail remux +
OpenCV decode + MediaPipe landmarks + LBP-TOP + motion), the exact CPU-bound work a scored
window pays, SERIALLY vs 4-way CONCURRENTLY. It quantifies how much 4 overlapping cold-start
decodes inflate per-window processing (the unknown the bar calls out) WITHOUT a live camera.

The true end-to-end first-read wall-clock still needs a supervised on-device smoke (camera +
the 10 s capture stride); this is the autonomous proxy that bounds the contention factor and
lets the first-band time be PROJECTED from real per-window numbers on this laptop.

Run it twice, as FRESH PROCESSES, so BOTH modes pay the one-time extractor cold start fairly:

    uv run python scripts/measure_warmup_concurrency.py serial
    uv run python scripts/measure_warmup_concurrency.py concurrent

Single-variable by design: it measures ONLY the shared extraction path, and it does NOT
pre-warm the extractor (pre-warming is a separate lever, deliberately out of scope here).
"""

from __future__ import annotations

import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import ml_video

_REPO_ROOT = Path(__file__).resolve().parents[3]
_FIXTURE_DIR = (
    _REPO_ROOT / "packages" / "ml-video" / "tests" / "fixtures" / "continuous" / "chrome"
)
# The locked 60 s window (Constitution Principle II): every scored window tail-extracts 60 s.
WINDOW_SECONDS = 60.0
# Mirrors the server warm-up semaphore / client cap (smoothing.M == 4).
MAX_CONCURRENCY = 4


def _score_one(path: Path) -> tuple[float, float]:
    """The CPU-bound per-window cost the endpoint pays under the gate's lock/semaphore: probe
    the recorded length, then tail-extract + featurize the trailing 60 s. Returns
    ``(recorded_seconds, wall_clock_seconds)``. Anchor subtraction + predict + DB insert are
    deliberately excluded — they are sub-second and constant, not the contention variable."""
    started = time.perf_counter()
    recorded = ml_video.probe_recorded_seconds(str(path))
    ml_video.compute_anchor(str(path), tail_seconds=WINDOW_SECONDS)
    return recorded, time.perf_counter() - started


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "serial"
    n = int(sys.argv[2]) if len(sys.argv) > 2 else MAX_CONCURRENCY
    fixtures = sorted(_FIXTURE_DIR.glob("recording-so-far_*.webm"))[:n]
    if len(fixtures) < n:
        print(f"need >= {n} fixtures, found {len(fixtures)} in {_FIXTURE_DIR}", file=sys.stderr)
        return 1
    if mode not in ("serial", "concurrent"):
        print(f"mode must be 'serial' or 'concurrent', got {mode!r}", file=sys.stderr)
        return 2

    print(f"mode={mode}  windows={len(fixtures)}  max_concurrency="
          f"{MAX_CONCURRENCY if mode == 'concurrent' else 1}")

    span_start = time.perf_counter()
    if mode == "serial":
        results = [(f.name, *_score_one(f)) for f in fixtures]
    else:
        with ThreadPoolExecutor(max_workers=MAX_CONCURRENCY) as pool:
            futures = [pool.submit(_score_one, f) for f in fixtures]
            results = [(fixtures[i].name, *futures[i].result()) for i in range(len(fixtures))]
    span = time.perf_counter() - span_start

    per_window = [wall for _name, _rec, wall in results]
    for name, recorded, wall in results:
        print(f"  {name}  recorded={recorded:6.1f}s  process={wall:6.2f}s")
    print(f"per-window: min={min(per_window):.2f}s  mean={statistics.mean(per_window):.2f}s  "
          f"max={max(per_window):.2f}s")
    print(f"serial-sum (back-to-back) = {sum(per_window):.2f}s")
    print(f"wall-clock span ({'overlapped' if mode == 'concurrent' else 'sequential'}) "
          f"= {span:.2f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
