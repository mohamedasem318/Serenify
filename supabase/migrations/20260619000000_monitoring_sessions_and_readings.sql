-- Stress-inference monitoring storage — two tables, owner-only RLS, column-grant
-- whitelist, and a self-scoped SECURITY DEFINER anchor read.
--   Feature:   008-stress-inference-service (T010 + T011)
--   Decisions: docs/DECISIONS.md (2026-06-19 — revised D-1: no service-role key,
--              all DB I/O as the user via the forwarded JWT; revised D-2/D-4)
--   Data model: specs/008-stress-inference-service/data-model.md
--   Contract:   specs/008-stress-inference-service/contracts/inference-api.md
--
-- Privacy is STRUCTURAL here, exactly mirroring the anchor mechanism
-- (20260527000000_anchor_columns.sql):
--   * NO manager/admin policy on either table — the manager layer gets NOTHING
--     from this feature (Principle I). Unlike public.profiles (which grants
--     direct-report SELECT), monitoring data is owner-only, full stop.
--   * ENABLE + FORCE RLS on both tables. FORCE is safe (and desirable) because
--     there is no service-role / table-owner write path to exempt — every writer
--     (the API and the browser) acts as the `authenticated` role via a forwarded
--     user JWT and is fully subject to RLS. FORCE additionally blocks any
--     accidental table-owner bypass.
--   * The raw decision signal (window_readings.label + .stress_probability) is
--     held server-only via a SELECT COLUMN WHITELIST that OMITS those two columns
--     (the anchor_vector withholding pattern). The owner can never SELECT a
--     probability — only the coarse {captured_at, scored, band, skip_cause}. The
--     INSERT grant DOES include them, so the API (running as the user) writes them
--     while they stay unreadable to that same owner. This structurally enforces
--     FR-015 ("no number, ever").
--   * Per-role grants are enumerated explicitly: Supabase grants table privileges
--     per role, so `REVOKE … FROM PUBLIC` alone is a no-op (DECISIONS 2026-05-25
--     slice 1). We REVOKE ALL from anon + authenticated, then GRANT the precise
--     column sets back to `authenticated` only. anon gets nothing.
--
-- Write-integrity (a user could fabricate THEIR OWN readings under insert-own RLS)
-- is a deliberately deferred, low-stakes item (own data only; managers see
-- nothing). Upgrade path = a dedicated INSERT-only Postgres role held by the API
-- with INSERT revoked from `authenticated` (not built here). See data-model.md.

-- ── monitoring_sessions ──────────────────────────────────────────────────
-- One check-in run for one employee; groups the run's readings and anchors the
-- recap + trend (FR-008).
CREATE TABLE public.monitoring_sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  status        text        NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'paused', 'out_of_frame', 'ended')),
  end_reason    text        CHECK (end_reason IN ('user', 'auto_absence', 'error')),
  model_version text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Recap query: most-recent ended session for a user.
CREATE INDEX monitoring_sessions_user_started_idx
  ON public.monitoring_sessions (user_id, started_at DESC);

-- ── window_readings ──────────────────────────────────────────────────────
-- The result of one captured window, keyed to user + session + timestamp.
-- Source of the trend, the recap, and the FR-020 sustained-tense seam (FR-017).
CREATE TABLE public.window_readings (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         uuid        NOT NULL
                       REFERENCES public.monitoring_sessions(id) ON DELETE CASCADE,
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  captured_at        timestamptz NOT NULL,
  scored             boolean     NOT NULL,
  band               text        CHECK (band IN ('at_ease', 'a_little_tense', 'tense')),
  skip_cause         text        CHECK (skip_cause IN ('low-light', 'out-of-frame',
                                                       'insufficient-face', 'our-side')),
  -- Server-only raw decision signal (withheld from the owner by the SELECT
  -- whitelist below; written by the API via the INSERT grant).
  label              smallint    CHECK (label IN (0, 1)),
  stress_probability real,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Trend (per session, time-ordered) and 009 + recap (per user, time-ordered).
CREATE INDEX window_readings_session_captured_idx
  ON public.window_readings (session_id, captured_at);
CREATE INDEX window_readings_user_captured_idx
  ON public.window_readings (user_id, captured_at);

-- ── RLS — ENABLE + FORCE on both tables ──────────────────────────────────
ALTER TABLE public.monitoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_sessions FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.window_readings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.window_readings     FORCE  ROW LEVEL SECURITY;

-- Owner reads own rows only. NO admin/manager policy on either table
-- (Principle I — the manager layer gets nothing from this feature).
CREATE POLICY ms_select_self ON public.monitoring_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY wr_select_self ON public.window_readings
  FOR SELECT USING (auth.uid() = user_id);

-- Owner writes own rows only (the API performs these as the user via the
-- forwarded JWT; RLS is the control).
CREATE POLICY ms_insert_self ON public.monitoring_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ms_update_self ON public.monitoring_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- window_readings insert additionally requires that session_id is an OWNED
-- session — a reading can never be attached to someone else's session.
CREATE POLICY wr_insert_self ON public.window_readings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.monitoring_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );
-- No UPDATE/DELETE policy on window_readings — append-only from the owner's side.

-- ── Per-role grants (explicit; PUBLIC/table-level revoke is a no-op) ──────
REVOKE ALL ON public.monitoring_sessions FROM anon, authenticated;
REVOKE ALL ON public.window_readings     FROM anon, authenticated;

-- monitoring_sessions: no sensitive raw columns here, so the owner may SELECT
-- all columns; INSERT is the creatable subset; UPDATE is the lifecycle subset.
GRANT SELECT ON public.monitoring_sessions TO authenticated;
GRANT INSERT (id, user_id, started_at, status, model_version)
  ON public.monitoring_sessions TO authenticated;
GRANT UPDATE (status, ended_at, end_reason, updated_at)
  ON public.monitoring_sessions TO authenticated;

-- window_readings:
--   * SELECT whitelist EXCLUDES label + stress_probability (the raw signal) →
--     the owner builds the trend from {id, session_id, user_id, captured_at,
--     scored, band, skip_cause, created_at} but can never read a probability.
--   * INSERT grant INCLUDES label + stress_probability so the API (as the user)
--     writes them; they remain unreadable to the owner via the SELECT whitelist.
GRANT SELECT (id, session_id, user_id, captured_at, scored, band, skip_cause, created_at)
  ON public.window_readings TO authenticated;
GRANT INSERT (id, session_id, user_id, captured_at, scored, band, skip_cause,
              label, stress_probability, created_at)
  ON public.window_readings TO authenticated;

-- ── get_my_anchor() — self-scoped SECURITY DEFINER anchor read (T011) ─────
-- Returns the CALLER'S OWN anchor_vector bytea (or NULL when uncalibrated),
-- resolving auth.uid() from the forwarded user JWT. The anchor columns are
-- withheld from every client SELECT by the anchor_columns whitelist, so the API
-- reads the anchor through this function (server-side, in the caller's RLS
-- context) and never via a browser SELECT. Mirrors has_anchor()
-- (20260527000000_anchor_columns.sql): takes NO user-id parameter (so it cannot
-- be pointed at another user), STABLE, SET search_path = '', OWNER TO postgres,
-- EXECUTE revoked from PUBLIC + anon and granted to authenticated only.
CREATE OR REPLACE FUNCTION public.get_my_anchor()
RETURNS bytea
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT anchor_vector
  FROM public.profiles
  WHERE id = auth.uid();
$$;

ALTER FUNCTION public.get_my_anchor() OWNER TO postgres;
-- Newly created functions grant EXECUTE to PUBLIC by default and Supabase also
-- grants it explicitly to anon; enumerate both so neither path remains.
REVOKE EXECUTE ON FUNCTION public.get_my_anchor() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_anchor() TO authenticated;
