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
from app.services.smoothing import M


def _run(coro):
    return asyncio.run(coro)


# ── Tier-2 warm-up concurrency (scored_count < M): admit concurrently, never shed ──


def test_warmup_admits_windows_concurrently_and_none_superseded():
    # During warm-up (scored_count < M) the first M cold-start windows must score
    # CONCURRENTLY — impossible under the single steady-state lock — and NONE may be shed as
    # superseded, or the band would be starved and never reach its M scored windows. All M
    # hold the gate at once; all yield True.
    async def scenario():
        gate = SessionScoringGate(scored_count=lambda _s: 0)  # always warm-up
        results: list[bool] = []
        holding: list[str] = []
        release = asyncio.Event()

        async def run(label):
            async with gate.window("s") as fresh:
                results.append(fresh)
                holding.append(label)
                await release.wait()  # hold the slot so true overlap is forced

        tasks = [asyncio.create_task(run(f"w{i}")) for i in range(M)]
        while len(holding) < M:  # all M acquire the warm-up semaphore at once
            await asyncio.sleep(0)
        release.set()
        await asyncio.gather(*tasks)
        return results

    results = _run(asyncio.wait_for(scenario(), timeout=5))
    assert len(results) == M
    assert all(results)  # every warm-up window scores — none superseded


def test_warmup_concurrency_is_bounded_at_M():
    # The server-side backstop mirrors the client's relaxed cap: at most M warm-up windows
    # ever score at once (trap b — 4 concurrent decodes is the worst case), so a misbehaving
    # client that fires more than M during warm-up cannot storm the CPU.
    async def scenario():
        gate = SessionScoringGate(scored_count=lambda _s: 0)  # warm-up
        concurrent = 0
        peak = 0
        entered = asyncio.Semaphore(0)
        release = asyncio.Event()

        async def run():
            nonlocal concurrent, peak
            async with gate.window("s"):
                concurrent += 1
                peak = max(peak, concurrent)
                entered.release()
                await release.wait()
                concurrent -= 1

        tasks = [asyncio.create_task(run()) for _ in range(M + 3)]
        for _ in range(M):  # M get in; the extra 3 block on the warm-up semaphore
            await entered.acquire()
        await asyncio.sleep(0)  # give any extra a chance to (wrongly) slip in
        peak_while_held = peak
        release.set()
        await asyncio.gather(*tasks)
        return peak_while_held, peak

    peak_while_held, peak = _run(asyncio.wait_for(scenario(), timeout=5))
    assert peak_while_held == M  # exactly M held at once while the rest waited
    assert peak == M  # never exceeded M across the whole run


def test_phase_follows_live_scored_count_and_rearms_after_resume():
    # The phase is read fresh from scored_count on every admission (no sticky clamp flag).
    # Steady-state (count >= M) sheds a backlog; when the buffer is dropped on Resume
    # (count → 0) the gate RE-ENTERS warm-up, so the resumed run's cold-start windows overlap
    # again instead of staying clamped to single-flight.
    async def scenario():
        count = {"n": M}  # steady-state to start
        gate = SessionScoringGate(scored_count=lambda _s: count["n"])

        # Steady: one held window sheds the STALE middle of the backlog behind it (drop-stale
        # restored) — w1 holds while w2 then w3 queue; w2 is superseded by w3, w3 scores.
        steady: dict[str, bool] = {}
        rel = asyncio.Event()
        held = asyncio.Event()

        async def steady_run(label, *, hold=None, signal=None):
            async with gate.window("s") as fresh:
                steady[label] = fresh
                if signal:
                    signal.set()
                if hold:
                    await hold.wait()

        t1 = asyncio.create_task(steady_run("w1", hold=rel, signal=held))
        await held.wait()
        t2 = asyncio.create_task(steady_run("w2"))
        await asyncio.sleep(0)
        t3 = asyncio.create_task(steady_run("w3"))
        await asyncio.sleep(0)
        rel.set()
        await asyncio.gather(t1, t2, t3)

        # Resume clears the buffer → re-arm warm-up: two windows now overlap and BOTH score.
        count["n"] = 0
        warm: list[bool] = []
        holding: list[str] = []
        rel2 = asyncio.Event()

        async def warm_run(label):
            async with gate.window("s") as fresh:
                warm.append(fresh)
                holding.append(label)
                await rel2.wait()

        tw = [asyncio.create_task(warm_run(f"r{i}")) for i in range(2)]
        while len(holding) < 2:
            await asyncio.sleep(0)
        rel2.set()
        await asyncio.gather(*tw)
        return steady, warm

    steady, warm = _run(asyncio.wait_for(scenario(), timeout=5))
    assert steady == {"w1": True, "w2": False, "w3": True}  # drop-stale shed the stale middle
    assert warm == [True, True]  # warm-up re-armed: both overlapping windows scored


def test_uncontended_windows_are_all_fresh():
    # The normal single-tab STEADY-STATE path (client back-pressure sends one at a time): every
    # window is the freshest when it reaches the gate, so none is ever falsely shed. Pinned to
    # steady-state (scored_count >= M) so it exercises the lock + freshness check, not warm-up.
    async def scenario():
        gate = SessionScoringGate(scored_count=lambda _s: M)
        seen = []
        for _ in range(5):
            async with gate.window("s") as fresh:
                seen.append(fresh)
        return seen

    assert _run(scenario()) == [True, True, True, True, True]


def test_supersedes_backlog_keeps_only_freshest():
    # Steady-state (scored_count >= M): w1 holds the lock (scoring) while w2 then w3 queue
    # behind it. When w1 releases, w2 is stale (w3 arrived after it) and is shed; w3 — the
    # freshest — scores. (Drop-stale is suspended during warm-up; here the band has latched.)
    async def scenario():
        gate = SessionScoringGate(scored_count=lambda _s: M)
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
    # Steady-state drop-stale under a deep backlog: a backlog queues behind one held window;
    # the newest of the backlog ALWAYS scores and every earlier one is shed. (Warm-up never
    # starves the band a different way — by scoring ALL of the first M; covered above.)
    async def scenario():
        gate = SessionScoringGate(scored_count=lambda _s: M)
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
    # Pinned to steady-state so the rebind path exercised is the LOCK (the original concern).
    gate = SessionScoringGate(scored_count=lambda _s: M)

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
