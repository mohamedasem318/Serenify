-- service_role: revoke every privilege on the ten PRE-EXISTING public tables.
-- Step 2 of 2 for #269 (docs/BACKLOG.md, DECISIONS 2026-09-13). Step 1
-- (20260913000000) stopped NEW public tables from inheriting the grant; this
-- migration closes the ten tables created before it. The 014 table is not
-- listed: its own migration (20260815090000) already carries this exact
-- revoke, pinned by its own gate test, and nothing here may duplicate it.
--
-- WHY. On the hosted project every one of these tables carries
-- `service_role=arwdDxtm` (read live 2026-08-15, re-read 2026-09-13) and
-- `service_role` has `rolbypassrls = true`. BYPASSRLS defeats RLS but NOT
-- grants, so the owner-only policies that 011 (chat), 012 (questionnaire) and
-- 013 (consents) describe as "no service-role path" only hold on cloud once
-- the grant is gone. Locally the same tables carry only `Dxtm`
-- (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN); `REVOKE ALL` is a no-op for anything
-- not granted, so both stacks end identical: no service_role item at all.
--
-- WHAT DEPENDS ON THESE GRANTS: nothing. Read-only recon on the linked project
-- (2026-09-13): no runtime code path uses the service key for table DML (the
-- API and web app run on the anon key plus the user JWT; the two service-key
-- clients are prod-guarded and Auth-Admin only); the Realtime publication is
-- empty; zero Storage buckets; zero Edge Functions; no webhooks, cron or
-- pg_net jobs; `service_role` cannot log in (rolcanlogin = false), so its only
-- reach is PostgREST with a service-key JWT; the Dashboard runs as `postgres`,
-- Realtime/Storage/Auth connect as their own admin roles.
--
-- SCOPE. Tables in `public` only: nothing in auth, storage, realtime or any
-- other managed schema. No role is altered; BYPASSRLS is untouched; the
-- `supabase_admin`-grantor default-privilege entry is untouched (out of reach:
-- postgres is not a member). RLS, policies and every other role's grants on
-- these tables are exactly as before.
--
-- ROLLBACK (exact inverse of the cloud state; catalog-only, seconds):
--   GRANT ALL ON public.<table> TO service_role;   -- one per table below
-- (Locally the pre-change item was `Dxtm`, so the local-faithful inverse is
--  GRANT TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.<table> TO service_role;)

-- 001 (20260517000010)
REVOKE ALL ON public.profiles FROM service_role;
-- 008 (20260619000000)
REVOKE ALL ON public.monitoring_sessions FROM service_role;
REVOKE ALL ON public.window_readings FROM service_role;
-- 011 (20260628000000)
REVOKE ALL ON public.chat_conversations FROM service_role;
REVOKE ALL ON public.chat_messages FROM service_role;
-- 012 (20260630000000)
REVOKE ALL ON public.questionnaire_confirmatory_prompts FROM service_role;
REVOKE ALL ON public.questionnaire_session_feedback FROM service_role;
REVOKE ALL ON public.weekly_checkin_cadence FROM service_role;
REVOKE ALL ON public.weekly_work_environment_contributions FROM service_role;
-- 013 (20260726000000)
REVOKE ALL ON public.user_consents FROM service_role;
