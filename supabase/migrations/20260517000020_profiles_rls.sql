-- Feature 001 — auth-and-roles
-- T010: RLS on public.profiles plus the is_admin() helper.
--
-- The two SECURITY DEFINER privileged-write functions
-- (admin_update_role, admin_update_manager) and reports_under()
-- live in their own migrations (T013, T014) per the deviation
-- documented in tasks.md § Cross-cutting notes.

-- Helper: is the current JWT subject an admin?
-- SECURITY DEFINER so policies can call it mid-evaluation; body filters
-- strictly by auth.uid() so it cannot be used to leak data.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Enable + force RLS. FORCE applies policies to the table owner too,
-- preventing accidental "logged in as service role in SQL editor" leaks.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- SELECT: a user sees their own row.
CREATE POLICY profiles_select_self
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- SELECT: admins see all rows.
CREATE POLICY profiles_select_admin
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- SELECT: a team_lead sees rows where manager_id = their own profile.id
-- (i.e., the caller's direct reports).
CREATE POLICY profiles_select_direct_reports
  ON public.profiles FOR SELECT
  USING (manager_id = auth.uid());

-- UPDATE: a row-owner may update their own row, but role and manager_id
-- MUST be unchanged. Postgres RLS is row-not-column, so the WITH CHECK
-- predicate compares the proposed values against the current values and
-- rejects any change. Privileged changes go through admin_update_role /
-- admin_update_manager (SECURITY DEFINER, migration T013).
CREATE POLICY profiles_update_self_safe_fields
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND manager_id IS NOT DISTINCT FROM
        (SELECT manager_id FROM public.profiles WHERE id = auth.uid())
  );

-- No INSERT policy: insertion happens only via the handle_new_user
-- trigger (SECURITY DEFINER, migration T011).
-- No DELETE policy: deletion happens via auth.users ON DELETE CASCADE.
