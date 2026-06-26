"""SessionScoringGate — bound-to-1 concurrency + drop-stale (docs/BACKLOG.md #78b / #79).

The endpoint tests (``test_monitoring_endpoints.py``) post windows SEQUENTIALLY through the
sync ``TestClient``, so they only ever exercise the uncontended path (every window is the
freshest → scored). These tests drive the gate DIRECTLY with ``asyncio.run`` so we can force
true overlap — a window held inside the lock while a backlog queues behind it — and assert
the two load-bearing properties:

  * **drop-stale:** of a backlog that piled up behind one scoring window, only the FRESHEST
    is scored; the rest are shed as ``superseded`` (``fresh is False``);
  * **the HARD CONSTRAINT (warm-up never starved):** the freshest window ALWAYS scores, no
    matter how deep the backlog — so the band still reaches its 4 scored windows.
"""

from __future__ import annotations

import asyncio

from app.services.scoring_gate import SessionScoringGate


def _run(coro):
    return asyncio.run(coro)


def test_uncontended_windows_are_all_fresh():
    # The normal single-tab path (client back-pressure sends one at a time): every window is
    # the freshest when it reaches the gate, so none is ever falsely shed.
    async def scenario():
        gate = SessionScoringGate()
        seen = []
        for _ in range(5):
            async with gate.window("s") as fresh:
                seen.append(fresh)
        return seen

    assert _run(scenario()) == [True, True, True, True, True]


def test_supersedes_backlog_keeps_only_freshest():
    # w1 holds the lock (scoring) while w2 then w3 queue behind it. When w1 releases, w2 is
    # stale (w3 arrived after it) and is shed; w3 — the freshest — scores.
    async def scenario():
        gate = SessionScoringGate()
        results: dict[str, bool] = {}
        release_w1 = asyncio.Event()
        w1_holds = asyncio.Event()

        async def run(label, *, hold=None, signal=None):
            async with gate.window("s") as fresh:
                results[label] = fresh
                if signal is not None:
                    signal.set()
                if hold is not None:
                    await hold.wait()  # stay inside the lock, holding it

        t1 = asyncio.create_task(run("w1", hold=release_w1, signal=w1_holds))
        await w1_holds.wait()  # w1 now holds the lock (seq 1)

        t2 = asyncio.create_task(run("w2"))
        await asyncio.sleep(0)  # w2 registers seq 2 and queues on the lock
        t3 = asyncio.create_task(run("w3"))
        await asyncio.sleep(0)  # w3 registers seq 3 and queues on the lock

        release_w1.set()  # w1 leaves the lock → w2 then w3 take their turn
        await asyncio.gather(t1, t2, t3)
        return results

    results = _run(scenario())
    assert results["w1"] is True   # freshest when it acquired (nothing newer yet) → scored
    assert results["w2"] is False  # superseded by w3 while it waited → shed
    assert results["w3"] is True   # the freshest of the backlog → scored


def test_freshest_always_scores_under_heavy_backlog():
    # The warm-up-not-starved guarantee: a deep backlog queues behind one held window; the
    # newest of the backlog ALWAYS scores and every earlier one is shed. Drop-stale sheds the
    # backlog, never the newest.
    async def scenario():
        gate = SessionScoringGate()
        scored: list[str] = []
        release = asyncio.Event()
        holder_holds = asyncio.Event()

        async def hold_window():
            async with gate.window("s") as fresh:
                if fresh:
                    scored.append("holder")
                holder_holds.set()
                await release.wait()

        async def quick(label):
            async with gate.window("s") as fresh:
                if fresh:
                    scored.append(label)

        t0 = asyncio.create_task(hold_window())
        await holder_holds.wait()  # holder holds the lock

        backlog = []
        for i in range(8):
            backlog.append(asyncio.create_task(quick(f"q{i}")))
            await asyncio.sleep(0)  # each registers its seq + queues before the next

        release.set()
        await asyncio.gather(t0, *backlog)
        return scored

    scored = _run(scenario())
    assert "holder" in scored          # the freshest when it ran → scored
    assert "q7" in scored              # the newest of the backlog → scored (never starved)
    assert all(f"q{i}" not in scored for i in range(7))  # every earlier one shed
    assert len(scored) == 2


def test_lock_rebinds_when_event_loop_changes():
    # Production runs one event loop per worker, but the TestClient spins a fresh portal/loop
    # per test. Reusing the SAME module-level gate + session id across two asyncio loops must
    # NOT raise "bound to a different event loop" — _state_for rebinds the lock on a new loop.
    gate = SessionScoringGate()

    async def one():
        async with gate.window("s") as fresh:
            return fresh

    assert asyncio.run(one()) is True
    assert asyncio.run(one()) is True  # second, separate loop — no loop-binding error


def test_drop_and_clear_remove_state():
    async def scenario():
        gate = SessionScoringGate()
        async with gate.window("a"):
            pass
        async with gate.window("b"):
            pass
        assert "a" in gate._store and "b" in gate._store
        gate.drop("a")
        assert "a" not in gate._store and "b" in gate._store
        gate.clear()
        assert not gate._store

    _run(scenario())


def test_lru_cap_evicts_least_recently_used():
    # Memory backstop (mirrors _SessionBuffers): an abandoned session can't grow the map
    # without limit. At graduation scale (tens) this never fires; drop() on End is the path.
    async def scenario():
        gate = SessionScoringGate(max_sessions=2)
        for sid in ("a", "b"):
            async with gate.window(sid):
                pass
        async with gate.window("c"):  # exceeds the cap → evicts the LRU ("a")
            pass
        return list(gate._store.keys())

    keys = _run(scenario())
    assert "a" not in keys and "b" in keys and "c" in keys
