-- Feature 013 — public-surface-and-legal
-- T012: the consent history table, its owner-only RLS, its immutability trigger,
-- and one additive edit to handle_new_user() that records the signup acknowledgement.
--
-- Consent is a HISTORY, not a flag: one append-only row per accepted revision, never
-- overwritten. A revision judged MATERIAL re-prompts everyone whose recorded consent
-- predates it, and version identity — not timestamp comparison — decides that
-- (research.md §6.2). The registry of published revisions is an in-repo TypeScript
-- module (apps/web/lib/consent/registry.ts), NOT a table, so this is the only consent
-- migration this feature ever ships (research.md §6.3).
--
-- NO BACKFILL, EVER (FR-041, contracts/consent-gates.md §7.4). Every existing user
-- starts with ZERO consent records for both texts, which is the truth: they were never
-- asked. The one INSERT INTO public.user_consents below lives INSIDE the
-- handle_new_user() function body and fires only on auth-user creation, so it is
-- structurally incapable of writing a row for a user who already exists. There is no
-- backfill DML anywhere in this file: no INSERT outside that function body, and no
-- INSERT … SELECT sourcing auth.users or public.profiles.
--
-- Declining writes NOTHING (FR-042): no row, no deletion, no withdrawal state. That is
-- why `decision` admits only 'granted' — see the column comment below.

CREATE TABLE public.user_consents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_key      text        NOT NULL CHECK (consent_key IN ('terms_privacy','camera_inference')),
  document_version text        NOT NULL
                     CHECK (document_version ~ '^(terms_privacy|camera_inference)@\d{4}-\d{2}-\d{2}\.\d+$')
                     CHECK (document_version LIKE consent_key || '@%'),
  -- The withdrawal seam (FR-043). Only 'granted' is admissible today; feature 018
  -- widens this CHECK and inserts a NEW row. DECLINING WRITES NO ROW AT ALL, so
  -- 'declined' is deliberately absent — admitting it would invite writing one.
  decision         text        NOT NULL DEFAULT 'granted' CHECK (decision IN ('granted')),
  decided_at       timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- Re-accepting the same revision is a no-op, not a duplicate (ON CONFLICT DO NOTHING).
  CONSTRAINT user_consents_one_per_revision UNIQUE (user_id, consent_key, document_version)
);

CREATE INDEX user_consents_lookup_idx
  ON public.user_consents (user_id, consent_key, decided_at DESC);

-- Immutability: nothing may ever edit a consent record (FR-043b, SC-013).
CREATE OR REPLACE FUNCTION public.user_consents_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'user_consents rows are immutable' USING ERRCODE = '42501';
END; $$;
ALTER FUNCTION public.user_consents_immutable() OWNER TO postgres;

CREATE TRIGGER user_consents_no_update
  BEFORE UPDATE ON public.user_consents
  FOR EACH ROW EXECUTE FUNCTION public.user_consents_immutable();

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_consents FORCE  ROW LEVEL SECURITY;

CREATE POLICY user_consents_select_self ON public.user_consents
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY user_consents_insert_self ON public.user_consents
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
-- No UPDATE policy. No DELETE policy. No manager policy. No admin policy.

REVOKE ALL ON public.user_consents FROM anon, authenticated;
GRANT SELECT, INSERT ON public.user_consents TO authenticated;

-- ── The additive handle_new_user() edit (data-model.md §6.6) ──────────────────
--
-- With email confirmation ON, supabase.auth.signUp() returns a user but NO session, so
-- the signup request is unauthenticated and cannot satisfy the TO authenticated INSERT
-- policy above. The acknowledgement must nonetheless be recorded (FR-035), so it reuses
-- the seam full_name already uses: the server action passes the acknowledged version id
-- in options.data, and this trigger writes the row at auth-user creation
-- (research.md §6.6).
--
-- ADDITIVE. The profiles INSERT, SECURITY DEFINER, and SET search_path are preserved
-- verbatim from 20260517000030_profile_trigger.sql:9-24. CREATE OR REPLACE keeps the
-- function's owner (postgres, pinned in 20260525000000_security_hardening_slice_1.sql)
-- and its ACL, and the on_auth_user_created trigger is NOT dropped or recreated — it
-- already points at this function by name.
--
-- role is hard-coded to 'employee'. NEVER read role or manager_id from
-- raw_user_meta_data — that field is client-controllable on self-signup
-- (see research R-5). Privileged values are set later via the SECURITY
-- DEFINER functions admin_update_role / admin_update_manager (T013).
--
-- The same client-controllability applies to terms_privacy_version, and it is stated
-- plainly in research.md §6.6: the version id is not a secret, so a caller who bypasses
-- the product's signup surface entirely can forge a satisfying row FOR THEIR OWN
-- ACCOUNT. RLS scopes the blast radius to that one account, nothing else is unlocked,
-- and the root cause is /signup being open self-serve — issue #62, a pre-production
-- deploy blocker this feature does not close. Recorded as risk R8.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    'employee'::public.user_role
  );

  IF NEW.raw_user_meta_data ? 'terms_privacy_version' THEN
    INSERT INTO public.user_consents (user_id, consent_key, document_version)
    VALUES (NEW.id, 'terms_privacy', NEW.raw_user_meta_data->>'terms_privacy_version')
    ON CONFLICT DO NOTHING;   -- the CHECKs above reject a malformed value outright
  END IF;

  RETURN NEW;
END;
$$;
