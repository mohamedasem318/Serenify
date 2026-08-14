-- Purpose-made seeding identity — the fix for #208, implementing Option B
-- (docs/DECISIONS.md 2026-08-14: a purpose-made seeding identity, NOT a widened
-- service_role).
--
-- WHY THIS ROLE EXISTS. On this project's default privileges, service_role holds
-- no DML on any public table (only TRUNCATE/REFERENCES/TRIGGER/MAINTAIN), so the
-- e2e globalSetup and both seed scripts died at 42501 on a freshly reset stack.
-- Widening service_role was rejected: it is the key whose job is to have no
-- limits, and its reach in production must not grow for a test convenience.
-- `serenify_seeder` starts with nothing; everything it holds is enumerated here,
-- and each grant traces to a write the seed scripts / Playwright fixtures
-- demonstrably perform. If a future fixture needs more, it gets a new enumerated
-- grant in a new migration — never a blanket one.
--
-- HOW IT IS (AND IS NOT) REACHABLE.
--   * NOLOGIN — it can never open a database connection itself.
--   * This migration deliberately does NOT grant it to `authenticator`, so
--     PostgREST cannot switch into it. On any database where only migrations
--     have run — the cloud project included — the role is INERT: grants with no
--     path that can exercise them.
--   * The local enablement lives in supabase/seed.sql (`GRANT serenify_seeder
--     TO authenticator`), which `supabase db reset` applies to LOCAL stacks only
--     and `db push` never ships. Locally, seeding tooling then assumes the role
--     through PostgREST with a JWT signed by the CLI's fixed, public dev secret
--     (apps/web/tests/e2e/setup/seeder-client.ts) — a token that validates
--     nowhere else, so the identity carries no secret and cannot reach a
--     deployed project.
--   * No runtime code path may use it: enforced by
--     apps/web/tests/unit/runtime-secret-posture.test.ts.
--
-- RLS POSTURE UNCHANGED for every existing role. All four tables below are
-- ENABLE + FORCE RLS; the seeder gets its own TO serenify_seeder policies
-- (permissive policies are OR'd per role, so anon/authenticated evaluation is
-- untouched). No BYPASSRLS — creating such a role needs superuser, which the
-- hosted migration runner does not have, and an enumerated policy is the more
-- inspectable shape anyway.

-- ── the role ─────────────────────────────────────────────────────────────
-- Roles are cluster-level and survive `supabase db reset`, so creation is
-- guarded; the grants/policies below live in the database and are re-created
-- by every reset.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'serenify_seeder') THEN
    CREATE ROLE serenify_seeder NOLOGIN;
  END IF;
END $$;

-- ── public.profiles ──────────────────────────────────────────────────────
-- Writers: e2e global-setup (promote the test admin), anchor-helpers
-- (role/full_name/anchor columns), scripts/seed-demo.ts + seed-accounts.ts
-- (bulk upsert of full_name/role/manager_id, + the synthetic anchor for the
-- demo cohort). Readers: role/hierarchy assertions and anchor-presence probes.
--
-- SELECT deliberately EXCLUDES anchor_vector: the anchor bytes stay unreadable
-- to every client role (20260527000000_anchor_columns.sql) — the seeder WRITES
-- the synthetic anchor but never needs to read one back; presence probes read
-- anchor_captured_at / anchor_model_version instead. Two consequences of
-- PostgREST upserts compiling to `ON CONFLICT (id) DO UPDATE SET col =
-- excluded.col, …` over every payload column:
--   * UPDATE must include id (set to excluded.id; the value never changes),
--     and SELECT must include every upserted column — reading EXCLUDED counts
--     as SELECT on that column — which is why full_name is in the SELECT list.
--   * anchor_vector therefore CANNOT travel through an upsert at all, so
--     seed-demo writes the anchor trio as a plain bulk UPDATE instead (a
--     plain UPDATE reads nothing back).
GRANT SELECT (id, full_name, role, manager_id, anchor_captured_at, anchor_model_version)
  ON public.profiles TO serenify_seeder;
GRANT INSERT (id, full_name, role, manager_id,
              anchor_vector, anchor_captured_at, anchor_model_version)
  ON public.profiles TO serenify_seeder;
GRANT UPDATE (id, full_name, role, manager_id,
              anchor_vector, anchor_captured_at, anchor_model_version)
  ON public.profiles TO serenify_seeder;

CREATE POLICY profiles_seeder_select ON public.profiles
  FOR SELECT TO serenify_seeder USING (true);
CREATE POLICY profiles_seeder_insert ON public.profiles
  FOR INSERT TO serenify_seeder WITH CHECK (true);
CREATE POLICY profiles_seeder_update ON public.profiles
  FOR UPDATE TO serenify_seeder USING (true) WITH CHECK (true);

-- ── public.user_consents ─────────────────────────────────────────────────
-- Writer: anchor-helpers seedCameraConsent (camera_inference rows for capture
-- fixtures). Reader: consent-entry-gate.spec asserting which revision a signup
-- recorded. Append-only invariants hold: no UPDATE/DELETE grant, and the
-- user_consents_no_update trigger is untouched.
GRANT SELECT (user_id, consent_key, document_version)
  ON public.user_consents TO serenify_seeder;
GRANT INSERT (user_id, consent_key, document_version)
  ON public.user_consents TO serenify_seeder;

CREATE POLICY user_consents_seeder_select ON public.user_consents
  FOR SELECT TO serenify_seeder USING (true);
CREATE POLICY user_consents_seeder_insert ON public.user_consents
  FOR INSERT TO serenify_seeder WITH CHECK (true);

-- ── public.monitoring_sessions ───────────────────────────────────────────
-- Writer: monitoring-helpers seeds retrospective + live-no-read sessions.
-- SELECT is only the returned id of the inserted row.
GRANT SELECT (id) ON public.monitoring_sessions TO serenify_seeder;
GRANT INSERT (user_id, started_at, ended_at, status, end_reason, model_version)
  ON public.monitoring_sessions TO serenify_seeder;

CREATE POLICY ms_seeder_select ON public.monitoring_sessions
  FOR SELECT TO serenify_seeder USING (true);
CREATE POLICY ms_seeder_insert ON public.monitoring_sessions
  FOR INSERT TO serenify_seeder WITH CHECK (true);

-- ── public.window_readings ───────────────────────────────────────────────
-- Writer: monitoring-helpers reading rows. INSERT deliberately EXCLUDES
-- label + stress_probability: fixtures seed only the coarse band surface, so
-- the raw decision signal stays structurally unwritable (and, with no SELECT
-- grant at all, unreadable) by the seeder — same posture the SELECT whitelist
-- gives the owner (20260619000000_monitoring_sessions_and_readings.sql).
GRANT INSERT (session_id, user_id, captured_at, scored, band, skip_cause)
  ON public.window_readings TO serenify_seeder;

CREATE POLICY wr_seeder_insert ON public.window_readings
  FOR INSERT TO serenify_seeder WITH CHECK (true);
