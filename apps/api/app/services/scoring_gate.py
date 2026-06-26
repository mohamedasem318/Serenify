"""Per-session scoring gate — bound live concurrency to ONE window + shed the backlog.

The robustness half of the live-monitor lag fix (docs/BACKLOG.md #78 embedded note (b) +
#79; DECISIONS 2026-06-26). The symptom: the browser uploads a fresh 60 s window every
~10 s *regardless* of whether the previous one has finished scoring (fire-and-forget, no
in-flight guard), and the windows route dispatched every upload to ``run_in_threadpool``
with the anyio default ``CapacityLimiter`` of 40. On a single session that meant ~10
windows scoring at once on one laptop, oversubscribing the CPU so each window ballooned
from ~10 s (isolated) to 40-110 s — the displayed reading fell minutes behind and the lag
*grew*. The client back-pressure (``monitoring-session.tsx``) is the bandwidth half; this
is the server-side backstop that caps lag regardless of client behaviour (a misbehaving
client, a second tab, a reconnect storm).

**Mechanism — a per-session lock + a monotonic "latest" sequence (NOT captured_at):**

  * Each arriving window is stamped, on entry, with a per-session sequence number that only
    ever increases; the highest stamped value *is* the "latest" marker (a monotonic counter,
    not a wall-clock ``captured_at`` — so there is never a same-millisecond tie and "freshest"
    is unambiguous).
  * The window then acquires the session's ``asyncio.Lock`` before it may score. The lock is
    held across the whole ``run_in_threadpool`` scoring call, so **at most one window per
    session is ever scoring** — concurrency is bounded to 1, not 40.
  * When a waiter finally acquires the lock it re-checks whether a *newer* window for the same
    session has since arrived (``my_seq == latest_seq``). If a newer one did, this window is
    **stale → shed** (the caller returns a clean ``superseded`` outcome; it is never scored
    and never persists a ``window_readings`` row). So while one window scores, the backlog
    that piles up behind the lock is collapsed to **only its freshest member**.

**Why concurrency 1 (not 2):** the D-3 smoothing buffer (``inference._SessionBuffers``)
assumes a single writer per session (DECISIONS 2026-06-20, BACKLOG #79) — its ``deque`` /
``OrderedDict`` mutations are not guarded for concurrent threads. Bounding to 1 keeps that
invariant; 2 would let two threads mutate one session's buffer at once.

**Why warm-up is never starved (the HARD CONSTRAINT):** the *freshest* window always wins
the ``my_seq == latest_seq`` check (nothing newer than it exists), so it always scores.
Drop-stale only ever sheds the *backlog* behind it, never the newest — so scored windows
still accumulate steadily and the band still latches at its 4th scored window (~90-105 s).
In normal single-tab operation the client sends one window at a time, so nothing is ever
in the backlog and this gate is transparent (every window scores).

This module owns only async-loop state (single-threaded event loop), so the sequence stamp
and the freshness check need no locking of their own — there is no ``await`` between reading
``latest_seq`` and deciding, so the check is atomic with respect to the event loop.
"""

from __future__ import annotations

import asyncio
from collections import OrderedDict
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager

from .smoothing import M


class _GateState:
    """One session's gate state: the steady-state serializing lock, the warm-up semaphore
    (bounded concurrency for the cold-start burst), the loop they are bound to, and the
    monotonic latest-arrived sequence number."""

    __slots__ = ("lock", "warmup_sem", "loop", "latest_seq")

    def __init__(self, loop: asyncio.AbstractEventLoop) -> None:
        self.lock = asyncio.Lock()
        # Warm-up admits up to M cold-start windows at once; the steady-state lock is the
        # special case of concurrency 1. Both are rebuilt together on a loop change (below).
        self.warmup_sem = asyncio.Semaphore(M)
        self.loop = loop
        self.latest_seq = 0


class SessionScoringGate:
    """Two-phase per-session scoring gate (Tier-2 warm-up concurrency on top of the merged
    lag fix, docs/BACKLOG.md #78b / #79).

    **Warm-up (``scored_count < M``):** the first M cold-start windows are the bulk of the
    time-to-first-read, scoring one-at-a-time at ~20-25 s each. Here the gate admits up to M
    of them CONCURRENTLY (an ``asyncio.Semaphore(M)``) and **never sheds** — every one of the
    first M scored windows must reach the smoothing buffer or the band is starved and never
    latches (the HARD CONSTRAINT). The semaphore caps the burst at M so 4 concurrent decodes
    is the worst case (the client relaxes its back-pressure to the same M; this is the
    server-side backstop for a misbehaving client / a second tab).

    **Steady-state (``scored_count >= M``, i.e. the band has latched):** the gate clamps back
    to the merged fix exactly — **one window per session** (the ``asyncio.Lock``) plus
    **drop-stale** (a window that is no longer the freshest when it acquires the lock is shed
    as ``superseded``). This is what bounds live lag for the rest of the session; the D-3
    buffer's own lock (``inference._SessionBuffers``) — not single-flight — is what keeps it
    correct across the brief warm-up→steady overlap.

    The phase is read FRESH from ``scored_count`` on every admission (no sticky clamp flag),
    so a Resume that drops the buffer (``scored_count`` → 0) re-enters warm-up and the resumed
    run's cold-start overlaps again. ``scored_count`` defaults to the in-memory smoothing
    buffer's count and is injectable for tests.

    Bounded by an LRU cap on concurrent sessions (mirrors ``_SessionBuffers``) so an abandoned
    session can't grow the map without limit; the explicit per-session :meth:`drop` is wired
    on End. Graduation scale is tens of sessions, so the cap is generous.
    """

    def __init__(
        self,
        *,
        max_sessions: int = 1024,
        scored_count: Callable[[str], int] | None = None,
    ) -> None:
        self._max_sessions = max_sessions
        self._store: OrderedDict[str, _GateState] = OrderedDict()
        # Lazily resolved to ``inference.buffers.scored_count`` on first use to avoid a
        # module-load import cycle (inference imports smoothing, not the gate). Injectable so
        # tests drive the warm-up/steady phase deterministically without populating the buffer.
        self._scored_count_fn = scored_count

    def _scored_count(self, session_id: str) -> int:
        fn = self._scored_count_fn
        if fn is None:
            from .inference import buffers

            fn = self._scored_count_fn = buffers.scored_count
        return fn(session_id)

    def _state_for(self, session_id: str) -> _GateState:
        loop = asyncio.get_running_loop()
        state = self._store.get(session_id)
        if state is None:
            state = _GateState(loop)
            self._store[session_id] = state
        elif state.loop is not loop:
            # The running event loop changed under us. In production this never happens —
            # uvicorn runs one loop for the worker's lifetime (and each worker has its own
            # process-local gate). It only fires in tests, where the TestClient spins a fresh
            # portal/loop per test: a different loop means no live waiters from the old loop
            # can exist here, so it is safe to rebind a fresh lock + semaphore and reset the
            # sequence.
            state.lock = asyncio.Lock()
            state.warmup_sem = asyncio.Semaphore(M)
            state.loop = loop
            state.latest_seq = 0
        self._store.move_to_end(session_id)  # most-recently-used
        while len(self._store) > self._max_sessions:
            self._store.popitem(last=False)  # evict the least-recently-used session
        return state

    @asynccontextmanager
    async def window(self, session_id: str) -> AsyncIterator[bool]:
        """Acquire this session's scoring slot. Yields ``True`` if this window should score,
        ``False`` if it was shed as ``superseded`` (only possible in steady-state). The held
        primitive is always released on exit, on any path (stale, scored, or an exception)."""
        state = self._state_for(session_id)
        state.latest_seq += 1
        my_seq = state.latest_seq
        if self._scored_count(session_id) < M:
            # WARM-UP: bounded-concurrent, never shed. The freshness check is bypassed so no
            # cold-start window is ever dropped as superseded — the buffer reaches M scored
            # windows on schedule and the band latches. The capture-ordered, locked buffer
            # (#79) keeps the mean + eviction correct even though these land out of order.
            await state.warmup_sem.acquire()
            try:
                yield True
            finally:
                state.warmup_sem.release()
        else:
            # STEADY-STATE: single-flight + drop-stale, the merged fix unchanged. No await
            # between reading latest_seq and yielding → the freshness decision is atomic w.r.t.
            # the event loop. A newer arrival has bumped latest_seq past my_seq.
            await state.lock.acquire()
            try:
                yield my_seq == state.latest_seq
            finally:
                state.lock.release()

    def drop(self, session_id: str) -> None:
        """Forget a session's gate state (call on End — mirrors ``buffers.drop``)."""
        self._store.pop(session_id, None)

    def clear(self) -> None:
        """Drop all gate state (used by tests for isolation)."""
        self._store.clear()


# Module-level gate shared across requests within this worker process (like ``buffers``).
scoring_gate = SessionScoringGate()
