-- Onboarding video anchor — columns, column-grant whitelist, has_anchor()
--   Feature:   004-onboarding-video-anchor
--   Decisions: docs/DECISIONS.md (2026-05-27 — anchor privacy: block all
--              anchor metadata from managers, add has_anchor() helper)
--   Contract:  specs/004-onboarding-video-anchor/contracts/migration.md
--
-- Adds the per-user anchor storage to public.profiles and makes its privacy
-- STRUCTURAL (Principle I, the amended/stricter DECISION-12):
--   * three nullable anchor columns (no CHECK; the app validates the encoding)
--   * SELECT column whitelist that EXCLUDES all three anchor columns, so no
--     client role can read them — not even the owner, and not managers via the
--     existing row-level select policies
--   * calibration status is exposed only through has_anchor(), a scope-guarded
--     SECURITY DEFINER function (owner-only; raises 42501 for any other user)
--
-- RLS POLICIES ARE LEFT UNCHANGED. Postgres RLS is row-scoped, so the existing
-- profiles_select_admin / profiles_select_direct_reports policies would expose a
-- new column on every row they already admit; the column-level GRANT is the only
-- mechanism that withholds anchor data from those readers.

-- ── columns ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN anchor_vector        bytea,
  ADD COLUMN anchor_captured_at   timestamptz,
  ADD COLUMN anchor_model_version text;

-- ── SELECT column whitelist (the Principle-I mechanism) ──────────────────
-- authenticated currently holds Supabase's table-level SELECT grant. A
-- column-level REVOKE SELECT (anchor_vector) would be a NO-OP under that table
-- grant (the slice-1 finding, verified with has_column_privilege). So drop the
-- table SELECT and re-grant an explicit whitelist that OMITS all three anchor
-- columns. The whitelist enumerates every column any existing query reads
-- (blast-radius audit T023: proxy.ts, (authed) layout/page, account page,
-- admin/invite — all select explicit columns; no select("*")).
-- service_role is untouched by this REVOKE/GRANT — but note that "untouched"
-- means it holds NO table privileges here: this project's default ACLs never
-- granted it DML on any public table (#208). Seeding writes the anchor
-- columns as the purpose-made serenify_seeder identity instead
-- (20260814000000_seeding_identity.sql), whose SELECT whitelist also
-- excludes anchor_vector — the anchor bytes stay unreadable to every
-- client role.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT  SELECT (id, full_name, role, manager_id, created_at, updated_at)
  ON public.profiles TO authenticated;

-- ── UPDATE column whitelist (widen slice-1's full_name-only grant) ───────
-- The owner writes their three anchor columns on their own row via the existing
-- profiles_update_self_safe_fields policy (its WITH CHECK already allows any
-- column except role/manager_id). Re-stating full_name keeps the grant complete.
GRANT UPDATE (full_name, anchor_vector, anchor_captured_at, anchor_model_version)
  ON public.profiles TO authenticated;

-- ── has_anchor() — calibration status without exposing the columns ───────
-- Because the owner can no longer SELECT anchor_captured_at, banner visibility
-- is derived from this scope-guarded SECURITY DEFINER function (slice-1
-- hardening pattern: STABLE, search_path = '', OWNER TO postgres, EXECUTE
-- scoped to authenticated; PUBLIC + anon revoked). The scope guard means a
-- manager cannot call has_anchor(<a report's id>) — it raises 42501. The web
-- app calls has_anchor(auth.uid()) to decide the banner.
CREATE OR REPLACE FUNCTION public.has_anchor(target_user uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF target_user <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden: may only query own anchor state'
      USING ERRCODE = '42501';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_user AND anchor_vector IS NOT NULL
  );
END;
$$;

ALTER FUNCTION public.has_anchor(uuid) OWNER TO postgres;
-- Newly created functions grant EXECUTE to PUBLIC by default and Supabase also
-- grants it explicitly to anon; enumerate both so neither path remains.
REVOKE EXECUTE ON FUNCTION public.has_anchor(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_anchor(uuid) TO authenticated;
