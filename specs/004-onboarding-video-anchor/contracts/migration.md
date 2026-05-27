# Contract: Supabase migration

`supabase/migrations/20260527000000_anchor_columns.sql` — timestamp after the
latest existing migration (`20260525000100_full_name_length_cap.sql`) and
**before any seed run** (the seed needs the columns). See 📌 DECISION-12.

This migration **does not touch RLS policies**. The `anchor_vector` privacy
guarantee comes from a column-level GRANT change, because Postgres RLS is
row-scoped and the existing `profiles_select_admin` /
`profiles_select_direct_reports` policies would otherwise expose a new column on
the rows they admit.

## DDL

```sql
ALTER TABLE public.profiles
  ADD COLUMN anchor_vector        bytea,
  ADD COLUMN anchor_captured_at   timestamptz,
  ADD COLUMN anchor_model_version text;
```

All nullable, no defaults, no CHECK (app-layer validates the 11832-byte encoding).

## SELECT column whitelist (the Principle-I mechanism)

`authenticated` currently holds Supabase's table-level SELECT grant. A
column-level `REVOKE SELECT (anchor_vector)` would be a **no-op** under that
table grant (the slice-1 finding, verified there with `has_column_privilege`).
So drop the table SELECT and re-grant an explicit whitelist that **omits
`anchor_vector`**:

```sql
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT  SELECT (id, full_name, role, manager_id, created_at, updated_at,
               anchor_captured_at, anchor_model_version)
  ON public.profiles TO authenticated;
```

After this, **no client role can SELECT `anchor_vector`** — the manager/admin
row-level SELECT policies remain but cannot reach the column. `service_role`
(seed, future 005 server-side read) is untouched and retains full access.

> The whitelist MUST list **every** column any existing query reads. Blast-radius
> audit (in `/speckit.tasks`): `proxy.ts`, header, account page, `role-gate.ts`
> all select explicit columns (no `select("*")`). Any `*` found is pinned to
> explicit columns before this migration lands.

## UPDATE column whitelist (widen slice-1's `full_name`-only grant)

```sql
GRANT UPDATE (full_name, anchor_vector, anchor_captured_at, anchor_model_version)
  ON public.profiles TO authenticated;
```

The owner writes their three anchor columns on their own row via the existing
`profiles_update_self_safe_fields` policy (its `WITH CHECK` already allows any
column except `role`/`manager_id`). `role`/`manager_id` stay writable only by the
SECURITY DEFINER RPCs.

## Verification (run in `/speckit.tasks` / smoke)

```sql
-- vector unreadable by authenticated; metadata readable
select has_column_privilege('authenticated','public.profiles','anchor_vector','SELECT');        -- false
select has_column_privilege('authenticated','public.profiles','anchor_captured_at','SELECT');   -- true
select has_column_privilege('authenticated','public.profiles','full_name','SELECT');             -- true (unchanged)
-- owner can write the three anchor columns
select has_column_privilege('authenticated','public.profiles','anchor_vector','UPDATE');         -- true
```

Behavioral check: a `team_lead`/`admin` selecting a report's row gets the row but
a `select=anchor_vector` is denied/empty (0 cross-user vector reads — SC-005).

## Rollback note

Dropping the three columns also requires restoring the prior table-level SELECT
grant (`GRANT SELECT ON public.profiles TO authenticated;`) if this migration is
ever reverted, so existing reads keep working. Documented here for the reverter.
