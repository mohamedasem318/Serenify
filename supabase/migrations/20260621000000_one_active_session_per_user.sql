-- One active monitoring session per user — close the orphaned-active + concurrent-session
-- gaps surfaced by the 008 edge-case pass (2026-06-21; docs/DECISIONS.md).
--
-- Two gaps the deferred US4 read path and the demo would otherwise hit:
--   * C1 orphaned-active: ending is client-driven (even the 5-min auto-end is a browser
--     timer), so a crash / closed tab leaves a row active (ended_at IS NULL) FOREVER — and
--     a never-ended session also shadows the recap's "most-recent ENDED session" read.
--   * C2 concurrency: two tabs created two parallel active sessions; nothing enforced the
--     "one session per user" assumption (plan.md Scale/Scope).
--
-- The fix makes "at most one active (ended_at IS NULL) session per user" a DB invariant via
-- a partial unique index; the create route finalizes a prior active session ('abandoned')
-- BEFORE starting a new one (last-tab-wins). Structural, mirroring the rest of 008 — the
-- index is the backstop even if the route logic is bypassed or races.

-- 'abandoned' is a new terminal end_reason: a session the create route force-ended to start
-- a fresh run (distinct from a user End, the 5-min auto_absence, or an error).
ALTER TABLE public.monitoring_sessions
  DROP CONSTRAINT monitoring_sessions_end_reason_check,
  ADD  CONSTRAINT monitoring_sessions_end_reason_check
       CHECK (end_reason IN ('user', 'auto_absence', 'error', 'abandoned'));

-- Backfill BEFORE the unique index: collapse any pre-existing duplicate active rows so each
-- user has AT MOST one active session (else CREATE UNIQUE INDEX fails on existing data).
-- Keep each user's most recent active session (latest started_at); finalize the rest as
-- 'abandoned', stamping ended_at at that session's last reading — the honest end-of-activity
-- — or its started_at if it never scored a window.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id ORDER BY started_at DESC) AS rn
  FROM public.monitoring_sessions
  WHERE ended_at IS NULL
)
UPDATE public.monitoring_sessions AS s
SET    status     = 'ended',
       end_reason = 'abandoned',
       ended_at   = COALESCE(
                      (SELECT max(r.captured_at)
                         FROM public.window_readings r
                        WHERE r.session_id = s.id),
                      s.started_at),
       updated_at = now()
FROM   ranked
WHERE  s.id = ranked.id
  AND  ranked.rn > 1;

-- The invariant: at most one active (not-yet-ended) session per user.
CREATE UNIQUE INDEX monitoring_sessions_one_active_per_user_idx
  ON public.monitoring_sessions (user_id)
  WHERE ended_at IS NULL;
