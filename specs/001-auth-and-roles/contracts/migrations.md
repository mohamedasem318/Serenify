# Migration Contracts: Authentication and Role-Based Access

**Feature**: `001-auth-and-roles`
**Phase**: 1
**Date**: 2026-05-17

This document lists the four Supabase migrations that this feature
introduces. Each migration is idempotent within its own file (uses
`IF NOT EXISTS` / `OR REPLACE` where Postgres permits) and is checked
into `supabase/migrations/` with the canonical Supabase CLI timestamp
prefix.

The order is significant — the migrations MUST be applied in the
order listed.

The first-admin bootstrap is NOT a migration. It is a one-time per-environment
SQL statement run manually in Supabase Studio. See `quickstart.md` §
"First Admin Bootstrap" for the exact statement.

## 20260517000000_create_role_enum.sql

**Purpose**: introduce the closed `user_role` enum used by `profiles.role`.

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_role'
  ) THEN
    CREATE TYPE public.user_role AS ENUM ('employee', 'team_lead', 'admin');
  END IF;
END
$$;
```

## 20260517000010_create_profiles.sql

**Purpose**: create the `public.profiles` table and its supporting
indexes. `profiles.id` IS `auth.users.id` (PK and FK on the same
column). Does NOT yet enable RLS — the policies in the next migration
attach RLS at the same time as the rules to enforce.

```sql
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  role        public.user_role NOT NULL DEFAULT 'employee',
  manager_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_no_self_manager CHECK (id <> manager_id)
);

CREATE INDEX IF NOT EXISTS profiles_manager_id_idx ON public.profiles(manager_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx       ON public.profiles(role);
```

## 20260517000020_profiles_rls.sql

**Purpose**: enable RLS on `profiles` and install the row-level
policies plus the SECURITY DEFINER privilege functions
(`is_admin`, `admin_update_role`, `admin_update_manager`,
`reports_under`).

```sql
-- Helper: is the current JWT subject an admin?
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

-- The only legitimate write path for profiles.role.
CREATE OR REPLACE FUNCTION public.admin_update_role(
  target_user_id uuid,
  new_role       public.user_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin role required'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET role = new_role
   WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found: %', target_user_id
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

ALTER FUNCTION public.admin_update_role(uuid, public.user_role) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_update_role(uuid, public.user_role) TO authenticated;

-- The only legitimate write path for profiles.manager_id.
CREATE OR REPLACE FUNCTION public.admin_update_manager(
  target_user_id   uuid,
  new_manager_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin role required'
      USING ERRCODE = '42501';
  END IF;

  IF new_manager_id IS NOT NULL AND new_manager_id = target_user_id THEN
    RAISE EXCEPTION 'a profile may not be its own manager'
      USING ERRCODE = '23514';
  END IF;

  IF new_manager_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = new_manager_id
  ) THEN
    RAISE EXCEPTION 'manager profile not found: %', new_manager_id
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
     SET manager_id = new_manager_id
   WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found: %', target_user_id
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

ALTER FUNCTION public.admin_update_manager(uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.admin_update_manager(uuid, uuid) TO authenticated;

-- Transitive reports helper (used by future features; defined now).
CREATE OR REPLACE FUNCTION public.reports_under(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE chain AS (
    SELECT id FROM public.profiles WHERE manager_id = uid
    UNION
    SELECT p.id FROM public.profiles p
      JOIN chain c ON p.manager_id = c.id
  )
  SELECT id FROM chain;
$$;

GRANT EXECUTE ON FUNCTION public.reports_under(uuid) TO authenticated;

-- Enable + force RLS.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- SELECT policies
CREATE POLICY profiles_select_self
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY profiles_select_admin
  ON public.profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY profiles_select_direct_reports
  ON public.profiles FOR SELECT
  USING (manager_id = auth.uid());

-- UPDATE: row-owner may update only fields other than role/manager_id.
-- The WITH CHECK predicate rejects any change to those two columns.
CREATE POLICY profiles_update_self_safe_fields
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND manager_id IS NOT DISTINCT FROM
        (SELECT manager_id FROM public.profiles WHERE id = auth.uid())
  );

-- No admin UPDATE policy: privileged changes go through
-- admin_update_role / admin_update_manager (SECURITY DEFINER).
-- No INSERT, no DELETE policies = those operations are denied for
-- every client; insertion happens via the handle_new_user trigger,
-- and deletion via auth.users ON DELETE CASCADE.
```

## 20260517000030_profile_trigger.sql

**Purpose**: install the trigger that creates a `profiles` row whenever
a new `auth.users` row appears, plus the generic `updated_at` trigger.
The trigger hard-codes `role = 'employee'`; it never reads `role` or
`manager_id` from client-controllable metadata (see research R-5).

```sql
-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Insert-into-auth.users → seed profiles row (role hard-coded).
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Application order in CI

The Supabase CLI (`supabase db push` or `supabase migration up`) applies
files in lexicographic order. The four timestamped filenames ensure the
correct sequence.

Local development: `supabase db reset` drops and re-applies all
migrations against the local Supabase Docker stack, giving deterministic
test fixtures. After reset, the first admin must be bootstrapped manually
per `quickstart.md` § "First Admin Bootstrap" — that step is intentionally
NOT a migration so it cannot accidentally run in staging or production.
