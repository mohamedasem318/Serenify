-- Questionnaire feedback storage — three employee-private owner-only tables, one
-- identity-stripped aggregate table, and two restricted SECURITY DEFINER RPCs.
--   Feature:    012-questionnaire-feedback (T014–T023)
--   Decisions:  revised D-1 posture (feature 008/011) — all per-user DB I/O runs AS
--               THE USER via the forwarded JWT + publishable anon key; there is NO
--               service-role key. Weekly aggregate writes/reads go through caller-
--               validating SECURITY DEFINER functions owned by postgres.
--   Data model: specs/012-questionnaire-feedback/data-model.md
--   Contracts:  specs/012-questionnaire-feedback/contracts/questionnaire-storage-rls.md
--               specs/012-questionnaire-feedback/contracts/weekly-aggregate-contract.md
--
-- Privacy is STRUCTURAL (Principle I + the feature-008/011 mechanism):
--
--   Employee-private (owner-only) tables — questionnaire_confirmatory_prompts,
--   questionnaire_session_feedback, weekly_checkin_cadence:
--     * ENABLE + FORCE RLS; owner-self SELECT/INSERT/UPDATE only. NO manager/admin
--       policy — individual questionnaire answers never reach the manager layer.
--     * `(select auth.uid())` (not bare auth.uid()) per current Supabase guidance —
--       the initplan is cached once per statement.
--     * Per-role grants enumerated explicitly: Supabase grants per role, so
--       `REVOKE … FROM PUBLIC` alone is a no-op (DECISIONS 2026-05-25). We REVOKE
--       ALL from anon + authenticated, then GRANT the precise verbs to authenticated.
--
--   Identity-stripped aggregate table — weekly_work_environment_contributions:
--     * Has NO user_id, NO created_at, NO updated_at, and NO precise timestamp;
--       iso_week_start (a date) is the ONLY temporal field. A per-row now() would
--       correlate with weekly_checkin_cadence.completed_at from the same submit
--       transaction and re-identify the otherwise stripped row.
--     * ENABLE + FORCE RLS, ALL direct grants revoked from anon + authenticated, and
--       only a narrow function-owner policy (TO postgres). All access is via the two
--       RPCs below — never a direct client SELECT/INSERT.
--
--   Restricted RPCs — submit_weekly_work_environment_checkin (insert) and
--   get_weekly_work_environment_summary (aggregate-only manager read):
--     * LANGUAGE plpgsql SECURITY DEFINER SET search_path = '', OWNER postgres.
--     * Resolve auth.uid() INTERNALLY; take NO impersonation user-id parameter.
--     * EXECUTE revoked from PUBLIC + anon, granted only to authenticated.
--     * The summary RPC returns ONLY grouped counts (never a contribution id or an
--       individual row), is role-gated (employees rejected; team leads see their own
--       + subordinate buckets via reports_under; admins see all), and excludes
--       null-bucket rows.
--
-- IMMUTABILITY: this migration only READS window_readings through an optional FK on
-- questionnaire_confirmatory_prompts.trigger_window_reading_id. It never alters,
-- updates, deletes, drops, annotates, or triggers on public.window_readings, and it
-- adds no false-alarm column there — Today card and trend rendering stay unchanged.

-- ════════════════════════════════════════════════════════════════════════════
-- T014 — questionnaire_confirmatory_prompts
-- One row per shown prompt, created visible then updated exactly once to answered
-- (with an outcome) or expired (with a reason). One prompt per monitoring session.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.questionnaire_confirmatory_prompts (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monitoring_session_id        uuid        NOT NULL REFERENCES public.monitoring_sessions(id) ON DELETE CASCADE,
  -- Optional read-only link to the owner-visible trend row; resolved by the client
  -- from its OWN window_readings under RLS. SET NULL on delete (never mutates the reading).
  trigger_window_reading_id    uuid        REFERENCES public.window_readings(id) ON DELETE SET NULL,
  -- Required trigger time linkage from the live WindowOutcome.capturedAt.
  triggered_window_captured_at timestamptz NOT NULL,
  trigger_band                 text        NOT NULL CHECK (trigger_band = 'tense'),
  shown_at                     timestamptz NOT NULL DEFAULT now(),
  lifecycle                    text        NOT NULL CHECK (lifecycle IN ('visible', 'answered', 'expired')),
  outcome                      text        CHECK (outcome IN ('confirmed', 'false_alarm', 'opened_chat')),
  answered_at                  timestamptz,
  expiry_reason                text        CHECK (expiry_reason IN ('signal_drop', 'session_end')),
  aggregate_treatment          text        NOT NULL DEFAULT 'none'
                                 CHECK (aggregate_treatment IN ('none', 'exclude_or_down_weight')),
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  -- One prompt per monitoring session.
  CONSTRAINT qcp_one_per_session UNIQUE (monitoring_session_id),
  -- Lifecycle constraints: an outcome exists IFF answered; an expiry_reason exists IFF expired.
  CONSTRAINT qcp_outcome_iff_answered CHECK ((lifecycle = 'answered') = (outcome IS NOT NULL)),
  CONSTRAINT qcp_expiry_iff_expired   CHECK ((lifecycle = 'expired')  = (expiry_reason IS NOT NULL)),
  -- False-alarm aggregate rule: exclude_or_down_weight IFF the answered outcome is false_alarm.
  CONSTRAINT qcp_false_alarm_treatment CHECK ((aggregate_treatment = 'exclude_or_down_weight') = (outcome IS NOT NULL AND outcome = 'false_alarm'))
);

-- Owner history (per user, recent first); monitoring_session_id is already uniquely indexed.
CREATE INDEX questionnaire_confirmatory_prompts_user_idx
  ON public.questionnaire_confirmatory_prompts (user_id, shown_at DESC);

CREATE TRIGGER qcp_touch_updated_at
  BEFORE UPDATE ON public.questionnaire_confirmatory_prompts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- T015 — questionnaire_session_feedback
-- Employee-private product feedback for one ended monitoring session. ren_too_robotic
-- and something_else free text are stored ONLY here — never routed to Ren or managers.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.questionnaire_session_feedback (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monitoring_session_id uuid        NOT NULL REFERENCES public.monitoring_sessions(id) ON DELETE CASCADE,
  status                text        NOT NULL CHECK (status IN ('submitted', 'skipped')),
  sentiment             text        CHECK (sentiment IN ('good', 'off')),
  reason                text        CHECK (reason IN ('suggestion_didnt_help', 'needed_quiet', 'ren_too_robotic', 'something_else')),
  free_text             text,
  action_target         text        CHECK (action_target IN ('preferences', 'notifications', 'ack_only')),
  sampling_policy       text        NOT NULL DEFAULT 'every_session' CHECK (sampling_policy = 'every_session'),
  created_at            timestamptz NOT NULL DEFAULT now(),
  -- One feedback row per monitoring session.
  CONSTRAINT qsf_one_per_session UNIQUE (monitoring_session_id),
  -- Skip stores nothing: no sentiment, reason, free text, or action target.
  CONSTRAINT qsf_skip_is_empty CHECK (status <> 'skipped' OR (sentiment IS NULL AND reason IS NULL AND free_text IS NULL AND action_target IS NULL)),
  -- A submitted row must carry a sentiment.
  CONSTRAINT qsf_submitted_has_sentiment CHECK (status <> 'submitted' OR sentiment IS NOT NULL),
  -- good sentiment carries no reason/free text; off sentiment requires a reason.
  CONSTRAINT qsf_good_no_reason CHECK (sentiment <> 'good' OR (reason IS NULL AND free_text IS NULL)),
  CONSTRAINT qsf_off_requires_reason CHECK (sentiment <> 'off' OR reason IS NOT NULL),
  -- Free text is allowed ONLY for something_else, and empty/whitespace text is rejected.
  CONSTRAINT qsf_free_text_scope CHECK (free_text IS NULL OR (reason = 'something_else' AND btrim(free_text) <> ''))
);

CREATE INDEX questionnaire_session_feedback_user_idx
  ON public.questionnaire_session_feedback (user_id, created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- T016 — weekly_checkin_cadence
-- Employee-private weekly prompt cadence. Tracks first-visit / one-re-prompt / skip /
-- completion state and carries NO work-environment answer values.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.weekly_checkin_cadence (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  iso_week_start   date        NOT NULL,
  prompt_count     smallint    NOT NULL DEFAULT 0 CHECK (prompt_count BETWEEN 0 AND 2),
  skipped_count    smallint    NOT NULL DEFAULT 0 CHECK (skipped_count BETWEEN 0 AND 2),
  last_prompted_at timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- One cadence row per (user, ISO week). Also serves the eligibility lookup index.
  CONSTRAINT weekly_checkin_cadence_user_week_key UNIQUE (user_id, iso_week_start)
);

CREATE TRIGGER wcc_touch_updated_at
  BEFORE UPDATE ON public.weekly_checkin_cadence
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- T017 — weekly_work_environment_contributions
-- Identity-stripped aggregate contribution row. INTENTIONALLY has no user_id, no
-- created_at, no updated_at, and no precise timestamp — iso_week_start is the only
-- temporal field (re-identification guard). Written/read only via the RPCs below.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.weekly_work_environment_contributions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Aggregate bucket derived at submit time from the employee's profiles.manager_id.
  -- Identifies the manager/team bucket, NOT the employee. Null rows are excluded from
  -- manager summaries.
  team_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  iso_week_start  date NOT NULL,
  sentiment       text NOT NULL CHECK (sentiment IN ('good', 'could_be_better')),
  roadblock       text CHECK (roadblock IN ('unclear_instructions_or_goals', 'waiting_on_other_team_members', 'software_or_tools_crashing')),
  support         text CHECK (support IN ('deadline_flexibility', 'better_team_alignment_or_communication', 'quieter_workspace', 'better_technical_equipment')),
  -- good carries no roadblock/support; could_be_better requires both.
  CONSTRAINT wwec_answers_match_sentiment CHECK ((sentiment = 'good' AND roadblock IS NULL AND support IS NULL) OR (sentiment = 'could_be_better' AND roadblock IS NOT NULL AND support IS NOT NULL))
);

-- Aggregate grouping path (per team bucket, per ISO week).
CREATE INDEX weekly_work_environment_contributions_bucket_idx
  ON public.weekly_work_environment_contributions (team_manager_id, iso_week_start);

-- ════════════════════════════════════════════════════════════════════════════
-- T018 — owner-only RLS on the three employee-private tables
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.questionnaire_confirmatory_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_confirmatory_prompts FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_session_feedback     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_session_feedback     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.weekly_checkin_cadence             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_checkin_cadence             FORCE  ROW LEVEL SECURITY;

-- ── questionnaire_confirmatory_prompts — owner select/insert/update ──
CREATE POLICY qcp_select_self ON public.questionnaire_confirmatory_prompts
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
-- Insert must be owned AND target an OWNED monitoring session.
CREATE POLICY qcp_insert_self ON public.questionnaire_confirmatory_prompts
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.monitoring_sessions s
      WHERE s.id = monitoring_session_id AND s.user_id = (select auth.uid())
    )
  );
CREATE POLICY qcp_update_self ON public.questionnaire_confirmatory_prompts
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ── questionnaire_session_feedback — owner select/insert/update ──
CREATE POLICY qsf_select_self ON public.questionnaire_session_feedback
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY qsf_insert_self ON public.questionnaire_session_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.monitoring_sessions s
      WHERE s.id = monitoring_session_id AND s.user_id = (select auth.uid())
    )
  );
CREATE POLICY qsf_update_self ON public.questionnaire_session_feedback
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ── weekly_checkin_cadence — owner select/insert/update ──
CREATE POLICY wcc_select_self ON public.weekly_checkin_cadence
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY wcc_insert_self ON public.weekly_checkin_cadence
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY wcc_update_self ON public.weekly_checkin_cadence
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ── Per-role grants (explicit; PUBLIC/table-level revoke alone is a no-op) ──
-- No server-only columns on these tables, so SELECT is a plain table grant. No DELETE.
REVOKE ALL ON public.questionnaire_confirmatory_prompts FROM anon, authenticated;
REVOKE ALL ON public.questionnaire_session_feedback     FROM anon, authenticated;
REVOKE ALL ON public.weekly_checkin_cadence             FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.questionnaire_confirmatory_prompts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.questionnaire_session_feedback     TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.weekly_checkin_cadence             TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- T019 — forced RLS + revoked grants + narrow function-owner policy on the
-- identity-stripped contributions table (RPC-only access)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.weekly_work_environment_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_work_environment_contributions FORCE  ROW LEVEL SECURITY;

-- No direct client access: all privileges revoked from anon + authenticated and never
-- re-granted. Reads/writes flow only through the SECURITY DEFINER RPCs (owner postgres).
REVOKE ALL ON public.weekly_work_environment_contributions FROM anon, authenticated;

-- The ONLY policy: the narrow function-owner exemption needed by the DEFINER RPCs
-- under FORCE RLS. It is TO postgres (the RPC owner / current_user inside the DEFINER
-- functions) — NOT a manager/admin policy, and no client role ever connects as postgres.
CREATE POLICY wwec_rpc_owner_all ON public.weekly_work_environment_contributions
  FOR ALL TO postgres USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════════
-- T020 — submit_weekly_work_environment_checkin
-- Caller-validated, identity-stripped weekly contribution insert + private cadence
-- completion, in one transaction. No impersonation parameter; auth.uid() internal.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.submit_weekly_work_environment_checkin(
  p_iso_week_start date,
  p_sentiment      text,
  p_roadblock      text DEFAULT NULL,
  p_support        text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_role       public.user_role;
  v_manager_id uuid;
  v_completed  timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  -- Caller must be an existing employee (role gate).
  SELECT p.role, p.manager_id INTO v_role, v_manager_id
  FROM public.profiles p
  WHERE p.id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_role <> 'employee' THEN
    RAISE EXCEPTION 'only employees submit weekly check-ins' USING ERRCODE = '42501';
  END IF;

  -- ISO-week bucket must be a Monday (matches the web client's week start).
  IF extract(isodow from p_iso_week_start) <> 1 THEN
    RAISE EXCEPTION 'p_iso_week_start must be an ISO-week Monday' USING ERRCODE = '22007';
  END IF;

  -- Validate sentiment and its conditional options.
  IF p_sentiment NOT IN ('good', 'could_be_better') THEN
    RAISE EXCEPTION 'invalid sentiment' USING ERRCODE = '22023';
  END IF;
  IF p_sentiment = 'good' THEN
    IF p_roadblock IS NOT NULL OR p_support IS NOT NULL THEN
      RAISE EXCEPTION 'good sentiment takes no roadblock/support' USING ERRCODE = '22023';
    END IF;
  ELSE  -- could_be_better requires a valid roadblock AND support
    IF p_roadblock NOT IN ('unclear_instructions_or_goals', 'waiting_on_other_team_members', 'software_or_tools_crashing') THEN
      RAISE EXCEPTION 'invalid roadblock' USING ERRCODE = '22023';
    END IF;
    IF p_support NOT IN ('deadline_flexibility', 'better_team_alignment_or_communication', 'quieter_workspace', 'better_technical_equipment') THEN
      RAISE EXCEPTION 'invalid support' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Lock or create the caller's private cadence row for the week.
  INSERT INTO public.weekly_checkin_cadence (user_id, iso_week_start)
  VALUES (v_uid, p_iso_week_start)
  ON CONFLICT (user_id, iso_week_start) DO NOTHING;

  SELECT c.completed_at INTO v_completed
  FROM public.weekly_checkin_cadence c
  WHERE c.user_id = v_uid AND c.iso_week_start = p_iso_week_start
  FOR UPDATE;

  IF v_completed IS NOT NULL THEN
    RAISE EXCEPTION 'weekly check-in already completed for this week' USING ERRCODE = '23505';
  END IF;

  -- Insert the IDENTITY-STRIPPED aggregate contribution (no user_id, no timestamp).
  INSERT INTO public.weekly_work_environment_contributions
    (team_manager_id, iso_week_start, sentiment, roadblock, support)
  VALUES (v_manager_id, p_iso_week_start, p_sentiment, p_roadblock, p_support);

  -- Complete the private cadence in the same transaction.
  UPDATE public.weekly_checkin_cadence
  SET completed_at = now()
  WHERE user_id = v_uid AND iso_week_start = p_iso_week_start;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- T021 + T022 — get_weekly_work_environment_summary
-- Aggregate-only manager read. Returns ONLY grouped counts (never a contribution id
-- or individual row). Role-gated: employees rejected; team leads see their own +
-- subordinate buckets (via reports_under); admins see all. Null buckets excluded.
-- No impersonation parameter; auth.uid() internal.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_weekly_work_environment_summary(
  p_iso_week_start date
)
RETURNS TABLE (
  iso_week_start date,
  sample_size    integer,
  sentiment      text,
  roadblock      text,
  support        text,
  response_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_role        public.user_role;
  v_sample_size integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  -- Employees never read the team aggregate.
  IF v_role = 'employee' THEN
    RAISE EXCEPTION 'forbidden: employees cannot read the team aggregate' USING ERRCODE = '42501';
  END IF;
  -- Only team leads and admins past this gate.
  IF v_role NOT IN ('team_lead', 'admin') THEN
    RAISE EXCEPTION 'forbidden: aggregate is manager-only' USING ERRCODE = '42501';
  END IF;

  -- Total VISIBLE contribution count for the caller/week (pre-grouping) so BACKLOG
  -- #123 can later suppress low-headcount buckets without changing the data model.
  -- Visibility: admins see all non-null buckets; team leads see their own bucket plus
  -- subordinate team-lead buckets through the existing reporting hierarchy.
  SELECT count(*) INTO v_sample_size
  FROM public.weekly_work_environment_contributions c
  WHERE c.iso_week_start = p_iso_week_start
    AND c.team_manager_id IS NOT NULL
    AND (
      v_role = 'admin'
      OR c.team_manager_id = v_uid
      OR c.team_manager_id IN (SELECT public.reports_under(v_uid))
    );

  RETURN QUERY
  SELECT
    p_iso_week_start,
    v_sample_size,
    c.sentiment,
    c.roadblock,
    c.support,
    count(*)::integer
  FROM public.weekly_work_environment_contributions c
  WHERE c.iso_week_start = p_iso_week_start
    AND c.team_manager_id IS NOT NULL
    AND (
      v_role = 'admin'
      OR c.team_manager_id = v_uid
      OR c.team_manager_id IN (SELECT public.reports_under(v_uid))
    )
  GROUP BY c.sentiment, c.roadblock, c.support;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- T023 — function owners + restricted EXECUTE grants on both weekly RPCs
-- Newly created functions grant EXECUTE to PUBLIC by default and Supabase also grants
-- it explicitly to anon; enumerate both so neither path remains. Owner postgres pins
-- the DEFINER privilege level.
-- ════════════════════════════════════════════════════════════════════════════
ALTER FUNCTION public.submit_weekly_work_environment_checkin(date, text, text, text) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.submit_weekly_work_environment_checkin(date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_weekly_work_environment_checkin(date, text, text, text) TO authenticated;

ALTER FUNCTION public.get_weekly_work_environment_summary(date) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.get_weekly_work_environment_summary(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_weekly_work_environment_summary(date) TO authenticated;
