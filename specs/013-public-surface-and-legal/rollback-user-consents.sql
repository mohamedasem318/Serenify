-- Rollback for supabase/migrations/20260726000000_user_consents.sql
--
-- ⚠ DESTROYS CONSENT HISTORY. `user_consents` is append-only by design (FR-043b) and is
-- the only record of which wording each person accepted and when. Dump it before running
-- this, or that record is gone:
--     pg_dump --data-only --table=public.user_consents <conn> > user_consents_backup.sql
--
-- Order is deliberate. handle_new_user() is restored FIRST: the 013 version of it inserts
-- into user_consents, so if the table were dropped first, every new signup would raise
-- between the two statements.

BEGIN;

-- 1 ── Restore handle_new_user() to its pre-013 definition.
--      Verbatim from 20260517000030_profile_trigger.sql, which is byte-identical to what
--      is live on the hosted project today (verified by normalised diff, 2026-07-26).
--      The `on_auth_user_created` trigger is NOT dropped or recreated — it binds by name
--      and keeps pointing at this function, exactly as the forward migration left it.
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
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- 2 ── Drop the table. CASCADE removes, in one step: user_consents_lookup_idx, both
--      policies (select_self, insert_self), the user_consents_no_update trigger, and the
--      FK from user_consents → auth.users. It touches no other table: nothing else in the
--      schema references user_consents.
DROP TABLE IF EXISTS public.user_consents CASCADE;

-- 3 ── Drop the immutability trigger function, now orphaned by step 2.
DROP FUNCTION IF EXISTS public.user_consents_immutable();

COMMIT;
