# Data Model: Authentication and Role-Based Access

**Feature**: `001-auth-and-roles`
**Phase**: 1
**Date**: 2026-05-17

This document is the authoritative schema reference for feature 001.
All SQL here is normative — `contracts/migrations.md` holds the migration
files that realise it.

## Entities

### `auth.users` (Supabase-managed)

Owned by the Supabase Auth schema. Not modified by this feature. The
relevant columns for downstream use:

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key. Also serves as the PK of `public.profiles` (one column, FK + PK). |
| `email` | `text` | Confirmed only when `email_confirmed_at IS NOT NULL`. |
| `email_confirmed_at` | `timestamptz` | Sign-in is blocked while NULL. Invited-but-not-yet-confirmed users sit here indefinitely. |
| `raw_user_meta_data` | `jsonb` | Carries `full_name` on self-signup (client-controllable; NEVER read for privileged values like `role`). |
| `raw_app_meta_data` | `jsonb` | Admin-only metadata; not read by the trigger in this feature (see research R-5). |

### `public.user_role` (enum)

```sql
CREATE TYPE public.user_role AS ENUM ('employee', 'team_lead', 'admin');
```

Three fixed values. Adding a value is a schema-migration ceremony; the
fixed set is the point.

### `public.profiles`

The application-side identity record. One row per `auth.users` row,
created by trigger on insert into `auth.users`. The primary key is the
same `uuid` as `auth.users.id` (canonical Supabase pattern).

```sql
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,                          -- NULL until onboarding
  role        public.user_role NOT NULL DEFAULT 'employee',
  manager_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_no_self_manager CHECK (id <> manager_id)
);

CREATE INDEX profiles_manager_id_idx ON public.profiles(manager_id);
CREATE INDEX profiles_role_idx       ON public.profiles(role);
```

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Profile primary key AND foreign key to `auth.users(id)`. Cascade-deletes when the auth user is deleted. |
| `full_name` | `text` | Nullable. The middleware uses `full_name IS NULL` as the "needs onboarding" signal. |
| `role` | `public.user_role` | Default `'employee'`. NEVER updateable through the row-owner RLS policy. The only legitimate write path is `public.admin_update_role(...)`. |
| `manager_id` | `uuid` | Self-FK to `profiles(id)`. NULL for users at the top of the chain. `ON DELETE SET NULL` preserves orphaned reports rather than cascading. NEVER updateable through the row-owner RLS policy; the only legitimate write path is `public.admin_update_manager(...)`. |
| `created_at` / `updated_at` | `timestamptz` | `updated_at` is bumped by a `BEFORE UPDATE` trigger. |
| `profiles_no_self_manager` | check | A profile may not be its own manager. Cycles further up the chain are guarded against in `admin_update_manager` at write time. |

### Removed in this plan

`spec.md` previously referenced a `Team` entity. The amendment landed
on 2026-05-17 removes it. If teams reappear later, they will be a
separate feature with their own data-model document.

## Relationships

```
auth.users(id)  ───PK/FK on profiles.id───  public.profiles
                                                │
                                                │ self-FK (nullable)
                                                ▼
                                             public.profiles  (manager_id)
```

The manager hierarchy is a DAG-shaped chain of profiles. The check
constraint disallows direct self-reference; longer cycles are guarded
against in `public.admin_update_manager` at write time.

## Helper functions

### `public.handle_new_user()` — trigger function on `auth.users`

Runs on every `INSERT INTO auth.users`. Hard-codes `role = 'employee'`
and `manager_id = NULL`. Reads only `full_name` from
`raw_user_meta_data` — a client-controllable field; safe because
`full_name` is not a privilege.

```sql
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

`SECURITY DEFINER` is required because the trigger runs in the context
of the Supabase Auth service role but inserts into a table covered by
RLS. The locked `search_path` prevents search-path attacks. The trigger
NEVER reads `role` or `manager_id` from any user-controllable metadata
field — those values are set later via the SECURITY DEFINER functions
below.

### `public.touch_updated_at()` — generic BEFORE UPDATE trigger

```sql
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
```

### `public.is_admin()` — convenience predicate for policies

```sql
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
```

`SECURITY DEFINER` so the function can read `profiles` even when the
calling policy is mid-evaluation; the body filters strictly by
`auth.uid()` so it cannot be used to leak data.

### `public.admin_update_role(target_user_id, new_role)`

The only legitimate write path for `profiles.role`. Verifies the caller
is an admin (in SQL — not just in the route handler) and updates the
row. Owned by `postgres`; `EXECUTE` granted to `authenticated`.

```sql
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
```

### `public.admin_update_manager(target_user_id, new_manager_id)`

The only legitimate write path for `profiles.manager_id`. Verifies the
caller is an admin, validates the target manager exists (or is NULL),
and refuses self-management. Owned by `postgres`; `EXECUTE` granted to
`authenticated`.

```sql
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
```

Longer-chain cycle detection (A→B→C→A) is not enforced in this
function; admins are trusted not to construct cycles. A future feature
can add a recursive cycle check if needed.

### `public.reports_under(uid uuid)` — transitive reports

A SQL function for future signal-aggregate views. Defined in this
feature so the contract exists; not yet consumed by any UI.

```sql
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
```

## Row-Level Security

### Enable RLS

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
```

`FORCE` ensures the policies also apply to the table owner, preventing
an "I logged in as service role in the SQL editor and forgot" leak.
SECURITY DEFINER functions still bypass RLS because they execute as
their owner (`postgres`), which is the intended privilege escalation.

### Policies on `public.profiles`

```sql
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

-- INSERT: never via app. Insertion happens only through the
-- handle_new_user trigger (SECURITY DEFINER, executes as postgres).
-- No INSERT policy is defined, so RLS denies INSERT for every client.

-- UPDATE: a row-owner may update their own row, but role and manager_id
-- MUST be unchanged. Postgres RLS is row-not-column, so the WITH CHECK
-- predicate compares the proposed values against the current values
-- and rejects any change.
CREATE POLICY profiles_update_self_safe_fields
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND manager_id IS NOT DISTINCT FROM
        (SELECT manager_id FROM public.profiles WHERE id = auth.uid())
  );

-- No profiles_update_admin policy is defined: admins MUST go through
-- public.admin_update_role and public.admin_update_manager, both of
-- which run as SECURITY DEFINER and bypass RLS. Concentrating the
-- privilege escalation in two named SQL functions makes every legitimate
-- role/manager change auditable in one place.

-- DELETE: never via app. No DELETE policy = no DELETE allowed.
-- (Profile deletion happens via auth.users ON DELETE CASCADE only.)
```

The combined effect:

| Caller | SELECT own row | SELECT others | UPDATE full_name (own row) | UPDATE role / manager_id | DELETE |
|--------|----------------|----------------|------------------------------|-----------------------------|---------|
| `employee`  | ✅ | ❌ | ✅ | ❌ (even on own row) | ❌ |
| `team_lead` | ✅ | ✅ (only direct reports — rows where `manager_id = auth.uid()`) | ✅ (own row only) | ❌ | ❌ |
| `admin`     | ✅ | ✅ (all rows) | ✅ (own row only via RLS; for other rows, see note) | ✅ via SECURITY DEFINER functions only | ❌ |

Note on admin row-owner reach: the row-owner UPDATE policy only matches
when `auth.uid() = id`, so even an admin cannot UPDATE another user's
`full_name` via RLS. If that capability becomes necessary (typo
correction by maintainer, etc.), it lands as a third SECURITY DEFINER
function in a follow-up feature.

### Forward note: signal tables

When signal-data tables arrive (features 005, 010, 011), their RLS
policies MUST follow the same pattern:

- A user sees their own raw rows.
- A direct manager (rows where the report's `profiles.manager_id`
  equals the caller's `auth.uid()`) sees aggregates of their direct
  reports, but **never** raw rows for those reports.
- A skip-level manager — anyone in `reports_under(...)` but not a
  direct manager — sees **only** org-aggregate views, never per-employee
  data. (Spec amendment 2026-05-17 makes this a hard rule, not a soft
  preference.)
- An admin sees aggregates only — never raw individual signal rows.

Feature 001 cannot enforce this on tables that don't exist yet, but the
data model (`reports_under()`, `is_admin()`, and the SECURITY DEFINER
escalation pattern) is deliberately shaped so the same predicates apply
when those tables land.

## State Transitions

### Profile lifecycle

```
                      ┌───────────────────┐
                      │ auth.users INSERT │
                      └─────────┬─────────┘
                                │ trigger (SECURITY DEFINER)
                                ▼
                ┌──────────────────────────────┐
                │ profiles row created         │
                │  id = auth.users.id          │
                │  full_name = (from metadata, │
                │               may be NULL)   │
                │  role = 'employee' (hard-    │
                │         coded — NEVER read   │
                │         from metadata)       │
                │  manager_id = NULL           │
                └──────────────┬───────────────┘
                               │
       ┌───────────────────────┴──────────────────────┐
       │                                              │
   self-signup                                  admin invite
   raw_user_meta_data.full_name passed          POST /api/admin/invite handler
       │                                              │
       ▼                                              ▼
   onboarding flow sets full_name              admin_update_role(invited_id, $newRole)
       │                                       admin_update_manager(invited_id, $managerId?)
       ▼                                              │
   reach /app (placeholder authed landing)           ▼
                                              invitee clicks email link,
                                              sets password, reaches /app
```

### Email confirmation

`auth.users.email_confirmed_at` is the gate. Until confirmed, Supabase
Auth itself refuses `signInWithPassword`. No application-level check
is required for this — defence in depth, but the primary enforcer is
Supabase. An invited user whose `email_confirmed_at` is NULL has a
`profiles` row already (because the trigger fires on the initial
`auth.users` INSERT), with whatever role the invite handler set.

## Validation Rules (mapped to spec Functional Requirements)

| Source | Rule | Enforcement layer |
|--------|------|--------------------|
| FR-001 | Signup requires email + password + full_name | Zod schema (client + Route Handler) — full_name lands in `raw_user_meta_data` |
| FR-002 | Default role is `employee` | Trigger hard-codes `'employee'`; DB column default is a backstop |
| FR-003 | Email confirmation required before login | Supabase Auth built-in |
| FR-004 | Returning users sign in with email + password | Supabase Auth built-in |
| FR-005 | Explicit sign-out ends the session | `supabase.auth.signOut()` |
| FR-006 | Password reset by single-use email link | Supabase `resetPasswordForEmail` |
| FR-007 | Reset response is identical for known/unknown emails | Supabase Auth built-in behaviour |
| FR-008 | Onboarding step confirms full_name only; manager assignment is admin-only | Middleware redirect when `full_name IS NULL`, `/onboarding` form; manager assignment via `admin_update_manager` only |
| FR-009 | Each signed-in user is routed by role | `lib/auth/role-gate.ts` + per-role placeholder routes (no real dashboards in this feature) |
| FR-010 | Unauthed visitors redirected to /login | `middleware.ts` |
| FR-011 | Authed users redirected away from /login, /signup | `middleware.ts` |
| FR-012 | `employee` blocked from team-lead/admin sections | Role gate (no real such sections exist yet — placeholder denial path is implemented) |
| FR-013 | `team_lead` blocked from admin sections | Role gate |
| FR-014 | User reads/updates only own profile (and only safe fields) | RLS `profiles_select_self` + `profiles_update_self_safe_fields` (the WITH CHECK refuses role/manager_id changes) |
| FR-015 | No one (incl. admin) reads raw signal data | Forward-looking; encoded as RLS conventions for future tables |
| FR-016 | `team_lead` limited to aggregates of direct reports | Forward-looking; `profiles_select_direct_reports` is the identity portion of this rule |
| FR-017 | `admin` limited to org-wide aggregates, never raw | Forward-looking |
| FR-018 | Auth surfaces operable at 360px with 44px touch targets | Tailwind v4 + design tokens; Playwright responsive assertion in employee spec |
| FR-019 | Calm, non-alarmist voice; no red | Copy reviewed during smoke test; palette enforced via locked CSS variables in `@theme` |
