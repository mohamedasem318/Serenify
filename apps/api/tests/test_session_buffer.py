"""_SessionBuffers capture-order + thread-safety (Tier-2 warm-up concurrency).

The merged lag fix serialized scoring per session, so the smoothing buffer only ever
saw ONE writer at a time and appends arrived in capture order for free. The warm-up
concurrency spike lets the first M=4 cold-start windows score *concurrently*, which
breaks both assumptions:

  * **concurrent mutation** — several threads append to one session's buffer at once
    (needs a lock so the appends don't interleave/corrupt);
  * **ordering** — the 4 warm-up windows finish in COMPLETION order, which is not
    capture order. A mean is order-independent (the first band is safe), but the moment
    steady-state resumes and the window slides, ``maxlen=N`` must evict the EARLIEST
    CAPTURED window, not the earliest *completed* one. So the buffer keeps the top-N by
    a per-window capture key (the recording-so-far length, strictly increasing with
    capture), independent of the order the appends actually land.
"""

from __future__ import annotations

import threading

from app.services.inference import _SessionBuffers
from app.services.smoothing import N


def test_buffer_orders_by_capture_key_not_completion_order():
    # The 4 warm-up windows finish out of capture order (90 completes first, then 60, 80,
    # 70). The returned buffer must be in CAPTURE order regardless, so the mean and the
    # eventual eviction are both correct.
    buf = _SessionBuffers()
    buf.record_scored("s", 0.4, order_key=90.0)  # captured 4th, completed 1st
    buf.record_scored("s", 0.1, order_key=60.0)  # captured 1st, completed 2nd
    buf.record_scored("s", 0.3, order_key=80.0)  # captured 3rd, completed 3rd
    recent = buf.record_scored("s", 0.2, order_key=70.0)  # captured 2nd, completed last
    assert recent == [0.1, 0.2, 0.3, 0.4]  # ascending capture order, not completion order


def test_steadystate_eviction_drops_earliest_captured_after_concurrent_warmup():
    # Warm-up filled the buffer out of order; when the first steady-state window (captured
    # 100) slides in, maxlen=N must evict capture-60 (the earliest CAPTURED), never capture-90
    # (which merely COMPLETED first). Evicting by completion order would silently corrupt the
    # trailing mean.
    buf = _SessionBuffers()
    for proba1, key in [(0.4, 90.0), (0.1, 60.0), (0.3, 80.0), (0.2, 70.0)]:
        buf.record_scored("s", proba1, order_key=key)
    recent = buf.record_scored("s", 0.5, order_key=100.0)
    assert recent == [0.2, 0.3, 0.4, 0.5]  # capture-60 evicted; capture order preserved


def test_buffer_is_threadsafe_and_keeps_top_n_by_capture_under_true_concurrency():
    # Many threads append to ONE session's buffer simultaneously (a barrier maximizes true
    # overlap). No interleaving may corrupt or drop an entry, and the buffer must end holding
    # the N highest capture keys — in capture order — proving both the lock and the ordering.
    buf = _SessionBuffers()  # window == N
    count = 200
    barrier = threading.Barrier(count)

    def worker(i: int) -> None:
        barrier.wait()
        buf.record_scored("s", i / 1000.0, order_key=float(i))

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(count)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # One final deterministic insert (highest key) reads back the buffer cleanly.
    recent = buf.record_scored("s", 2.0, order_key=1_000.0)
    assert len(recent) == N
    # Top-N capture keys are 197, 198, 199 (from the burst) then 1000 (this insert).
    assert recent == [197 / 1000.0, 198 / 1000.0, 199 / 1000.0, 2.0]


def test_scored_count_tracks_appends_and_drop_clears():
    buf = _SessionBuffers()
    assert buf.scored_count("s") == 0
    buf.record_scored("s", 0.1, order_key=60.0)
    buf.record_scored("s", 0.2, order_key=70.0)
    assert buf.scored_count("s") == 2
    buf.drop("s")
    assert buf.scored_count("s") == 0
