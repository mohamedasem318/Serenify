# Security Slice 1 — RLS + SECURITY DEFINER Audit Findings

> **Audit-only.** This document records findings; it applies no fixes. Mohamed
> reviews these with claude.ai, decides which to apply, and a follow-up Claude
> Code session lands the approved fixes on this same branch
> (`security/01-rls-and-security-definer`). No migration or application code is
> changed by the commit that introduces this doc.

## Summary

This slice audited the entire Supabase migrations tree
(`supabase/migrations/`, six files), the Postgres-side authorization model on
`public.profiles` (RLS policies, the new-user trigger, the two privileged
SECURITY DEFINER update functions, the `is_admin()` and `reports_under()`
helpers, the generic `touch_updated_at()` trigger), the role-grant posture for
`anon` / `authenticated` / `service_role`, and PostgREST RPC exposure. It also
swept `apps/web/`, `scripts/`, and `packages/` for every caller of the SQL
objects and for service-role client construction.

**Headline posture: solid.** The privilege-escalation-relevant controls are all
correct. A row-owner cannot escalate their own `role` or re-parent themselves
via the self-update RLS policy — the `WITH CHECK` predicate holds against every
bypass vector tested (multi-row UPDATE, writable CTE, NULL `auth.uid()`,
`NEW.id` rewrite). `is_admin()`, `admin_update_role()`, and
`admin_update_manager()` are all SECURITY DEFINER with pinned `search_path` and
re-verify admin status inside Postgres. `handle_new_user()` hard-codes
`role='employee'` and never reads a privileged field from client-controllable
`raw_user_meta_data`. The `/api/admin/invite` caller-session-client pattern
(Decision 2026-05-17) is intact, and service-role usage is confined to the
expected files.

**No critical or high findings.** The findings that exist are two `med`
authorization-logic gaps that **require an already-authenticated admin to
trigger** (no external exploitation path) plus five `low` defense-in-depth /
hardening items.

**Finding counts by severity:** `critical` 0 · `high` 0 · `med` 2 · `low` 5
(7 total).

| # | Title | Severity |
|---|-------|----------|
| 1 | Missing multi-node manager-cycle detection in `admin_update_manager` | med |
| 2 | Last-admin / self-demotion → zero-admin lockout in `admin_update_role` | med |
| 3 | SECURITY DEFINER functions retain default `PUBLIC` EXECUTE | low |
| 4 | Supabase default table grants not tightened (`role`/`manager_id`, `anon`) | low |
| 5 | Inconsistent function `OWNER` pinning across SECURITY DEFINER objects | low |
| 6 | `reports_under()` — INVOKER + unpinned `search_path` + PostgREST-exposed, zero consumers | low |
| 7 | `handle_new_user()` persists unvalidated user-controlled `full_name` | low |

---

## Fix-pass summary

- **Date**: 2026-05-25
- **Migration**: `supabase/migrations/20260525000000_security_hardening_slice_1.sql` (commit `b4e5e70`)
- **Decisions**: `docs/DECISIONS.md` 2026-05-25 — "Security slice 1: RLS + SECURITY DEFINER hardening decisions" (6 policy choices)
- **Findings landed**: 1, 2, 3, 4, 5, 6 → `fixed in b4e5e70`; 7 → routed to slice 3.
- **Two deviations from the approved SQL**, both rooted in the same systemic cause: Supabase grants EXECUTE/UPDATE *explicitly per role* (`anon`/`authenticated`/`service_role`) via `ALTER DEFAULT PRIVILEGES`, not only via PUBLIC / table-level. So the literal approved REVOKEs were no-ops, caught only by empirical `has_column_privilege` / `pg_proc.proacl` checks — not derivable from the migration source. F4(a) corrected to a column whitelist; F3/F6 corrected to enumerate the explicit per-role revokes. See the annotations on those findings and DECISIONS.md choices 4–6.
- **Tests**:
  - Vitest unit (`apps/web`): **176 passed**.
  - Vitest scripts (non-integration): **20 passed, 8 skipped** (the env-gated integration block).
  - Vitest integration (`SUPABASE_INTEGRATION=1`, full suite): **32 passed across 4 files** — includes 4 new behavioral tests in `scripts/__tests__/security-hardening.integration.test.ts` (multi-node cycle rejection + cycle-free re-parent; last-admin rejection + self-demotion with a second admin).
  - Playwright e2e (chromium + firefox + webkit): **57 passed**. (The trailing `npm` exit-1 is the known worker force-kill after teardown, not a test failure.) The `employee-dashboard-shell` account-edit spec exercises the row-owner `full_name` UPDATE and passed on all three browsers — confirming the F4 column-grant change did not break profile edits.

## Findings

## Finding 1: Missing multi-node manager-cycle detection in `admin_update_manager`

- **Severity**: `med`
- **Surface**: `supabase/migrations/20260517000040_admin_privileged_updates.sql:57-67` (guard block in `admin_update_manager`); interacts with `supabase/migrations/20260517000050_reports_under.sql:17-23` and the table CHECK at `supabase/migrations/20260517000010_create_profiles.sql:12`.
- **What**: `admin_update_manager` blocks only the trivial **self**-cycle (`new_manager_id = target_user_id`, line 57) and verifies the prospective manager exists (line 62). It does **not** detect a multi-node cycle. An admin can call the RPC twice to form `A → B → A` (set A's manager to B, then B's manager to A), or any longer chain `A → B → C → A`. The `profiles_no_self_manager` CHECK constraint also only covers the single-row self-reference, so it does not catch these.
- **Why it's a risk**: Realistic exploitability is **low** — it requires an authenticated admin (or a compromised admin session) and corrupts the org graph rather than leaking data or escalating privilege. But the impact is real and *latent*:
  - **Data integrity**: the reporting hierarchy becomes a graph with a cycle — a nonsensical org chart where, e.g., `reports_under(A)` returns `A` itself.
  - **Future access-control confusion**: `reports_under()` exists specifically for the signal-aggregate features (005/010/011). Once a manager appears in their own transitive-reports set, a future signal-table RLS policy of the shape "a manager may see signals for anyone in `reports_under(me)`" would grant that admin access to their *own* signal rows through a manager-path policy — a privilege-confusion defect introduced before those features are even built.
  - **Latent DoS for future consumers**: `reports_under()` itself terminates today (see Finding 6 / Audited-clean #12 — `UNION` dedup guarantees termination on any finite cycle), but a *future* recursive consumer that uses `UNION ALL`, or that walks the chain **upward** (`manager_id` of `manager_id` …) without a guard, would loop indefinitely on a cycle this gap permits.
- **Suggested fix** (fix pass, not this slice): add a cycle check inside `admin_update_manager` *before* the UPDATE. A cycle forms iff the prospective manager is already a transitive **report** of the target (i.e. the target is an ancestor of `new_manager_id`), so the correct membership test is `new_manager_id ∈ reports_under(target_user_id)`:

  ```sql
  IF new_manager_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.reports_under(target_user_id) r(id)
    WHERE r.id = new_manager_id
  ) THEN
    RAISE EXCEPTION 'cycle detected: % is already a transitive report of %',
      new_manager_id, target_user_id
      USING ERRCODE = '23514';
  END IF;
  ```

  > Note: this check direction is the reverse of what one reviewing subagent
  > first proposed (`reports_under(new_manager_id)` containing `target`); that
  > variant tests "target is already below new_manager", which is *not* the
  > cycle condition. Validate the direction in the fix pass. Because
  > `admin_update_manager` is SECURITY DEFINER running as `postgres`, the
  > INVOKER function `reports_under` invoked from inside it runs with
  > RLS bypassed and so traverses the full graph (correct for this check).

  As defense-in-depth, also add an explicit `CYCLE id SET is_cycle USING path`
  clause (Postgres 14+) or a depth cap to `reports_under` so a stray cycle
  surfaces as a clear error rather than silently wrong data. Migration file
  pattern: `supabase/migrations/<N>_<slug>.sql`.
- **Status**: `fixed in b4e5e70`. Cycle guard added to `admin_update_manager` *before* the UPDATE, using the audit's `new_manager_id ∈ reports_under(target_user_id)` direction. The deliberately-rejected `CYCLE` clause on `reports_under` stays out (its `UNION` already guarantees termination; the guard is the right layer). Behavioral test: A→B then B→A rejected with `23514`; cycle-free re-parent (B→C) succeeds.

## Finding 2: Last-admin / self-demotion → zero-admin lockout in `admin_update_role`

- **Severity**: `med`
- **Surface**: `supabase/migrations/20260517000040_admin_privileged_updates.sql:13-37` (`admin_update_role`).
- **What**: `admin_update_role` has no guard against an admin demoting **themselves**, and no guard against demoting the **last remaining** admin. Both are silently permitted and committed. After `admin_update_role(self_id, 'employee')`, the caller's JWT no longer satisfies `is_admin()`; every admin-gated path (`/api/admin/invite`, both privileged RPCs) returns forbidden on their next request. If they were the only admin, the deployment reaches a **zero-admin** state in which no authenticated user can perform any admin action in-app.
- **Why it's a risk**: Exploitability is **low–moderate**: it requires an existing admin (accidental operator error, or a briefly-compromised admin session used destructively). It is an **availability / lockout** issue, not a data breach or escalation. Recovery is possible but only **out-of-band** — direct SQL via the Supabase dashboard, exactly the documented first-admin bootstrap step (`specs/001-auth-and-roles/quickstart.md` §6: `UPDATE public.profiles SET role='admin' WHERE id = …`). There is no in-app recovery because every in-app admin gate now evaluates false.
- **Suggested fix** (fix pass, not this slice): inside `admin_update_role`, after the `is_admin()` check, reject self-demotion and any demotion that would empty the admin set:

  ```sql
  -- after the is_admin() guard, before the UPDATE:
  IF target_user_id = auth.uid() AND new_role <> 'admin'::public.user_role THEN
    RAISE EXCEPTION 'an admin may not demote themselves'
      USING ERRCODE = '42501';
  END IF;

  -- after the UPDATE (single-statement transaction makes this atomic):
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'operation would leave zero admins'
      USING ERRCODE = '23514';  -- raises => rolls back the UPDATE
  END IF;
  ```

  Decide in review whether to block self-demotion outright or only the
  last-admin case (the two checks are independent; the last-admin check alone
  prevents the lockout while still allowing one admin to demote another when a
  second admin exists).
- **Status**: `fixed in b4e5e70`. Implemented as **last-admin-only** (not a blanket self-demotion block) per DECISIONS.md 2026-05-25 choice 1: the check runs *after* the UPDATE and rolls back only when zero admins would remain. Behavioral test: sole-admin self-demotion rejected with `23514`; self-demotion succeeds when a second admin remains.

## Finding 3: SECURITY DEFINER functions retain default `PUBLIC` EXECUTE

- **Severity**: `low`
- **Surface**: `is_admin()` at `supabase/migrations/20260517000020_profiles_rls.sql:12-24`; `admin_update_role` / `admin_update_manager` at `supabase/migrations/20260517000040_admin_privileged_updates.sql:40,81`; `reports_under` at `supabase/migrations/20260517000050_reports_under.sql:26`.
- **What**: Newly created Postgres functions are granted `EXECUTE` to `PUBLIC` by default. The migrations add explicit `GRANT EXECUTE … TO authenticated` but never `REVOKE … FROM PUBLIC`. So `PUBLIC` (including the `anon` role used by unauthenticated PostgREST callers) retains EXECUTE on all of these.
- **Why it's a risk**: **Not exploitable today** — every privileged function self-gates: `is_admin()` returns `false` when `auth.uid()` is NULL (anon), and both `admin_update_*` functions `RAISE` `42501` on the `NOT is_admin()` branch *before* any data access, so there is no UUID-existence oracle. `reports_under` is INVOKER and RLS-filtered (anon satisfies no SELECT policy → empty result). The risk is purely **defense-in-depth / attack-surface**: a future refactor that reorders a guard, or changes a function from DEFINER to INVOKER, would silently inherit a broader audience than intended. Leaving privileged SECURITY DEFINER entry points executable by `PUBLIC` is the textbook thing to lock down.
- **Suggested fix** (fix pass, not this slice): for each function, `REVOKE EXECUTE … FROM PUBLIC;` immediately before the targeted `GRANT … TO authenticated;` e.g.

  ```sql
  REVOKE EXECUTE ON FUNCTION public.admin_update_role(uuid, public.user_role) FROM PUBLIC;
  GRANT  EXECUTE ON FUNCTION public.admin_update_role(uuid, public.user_role) TO authenticated;
  ```

  > **⚠ `REVOKE … FROM PUBLIC` is PARTIAL on Supabase — preserved as a lesson.** Supabase grants EXECUTE *explicitly* to `anon`/`authenticated`/`service_role` via `ALTER DEFAULT PRIVILEGES`, in addition to the PUBLIC pseudo-grant. Revoking PUBLIC leaves the explicit `anon` grant intact (verified via `pg_proc.proacl`), so `admin_update_*` would stay anon-executable. **Strengthened form applied in `b4e5e70`:**
  >
  > ```sql
  > -- admin_update_*: not referenced by any RLS policy — strip PUBLIC and the explicit anon grant.
  > REVOKE EXECUTE ON FUNCTION public.admin_update_role(uuid, public.user_role)  FROM PUBLIC, anon;
  > REVOKE EXECUTE ON FUNCTION public.admin_update_manager(uuid, uuid)           FROM PUBLIC, anon;
  > -- is_admin: revoke PUBLIC ONLY — the anon grant is load-bearing for the
  > --   profiles_select_admin RLS policy (revoking it → permission_denied on
  > --   unauthenticated profile queries, not empty result sets).
  > REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
  > ```
  >
  > Verified post-migration `pg_proc.proacl`: `admin_update_*` = `{postgres, authenticated, service_role}` (no `anon`); `is_admin` = `{postgres, anon, authenticated, service_role}`. See DECISIONS.md 2026-05-25 choices 5 ("Supabase grant semantics") and 6 ("is_admin anon-grant invariant").
- **Status**: `fixed in b4e5e70`

## Finding 4: Supabase default table grants not tightened (`role`/`manager_id`, `anon`)

- **Severity**: `low`
- **Surface**: absent from all six migration files; the live grants come from Supabase's baseline `GRANT … ON ALL TABLES IN SCHEMA public TO anon, authenticated`. Relevant policy: `supabase/migrations/20260517000020_profiles_rls.sql:52-60`.
- **What**: Two related defense-in-depth gaps in the grant layer:
  - **(a) No column-level backstop on the privileged columns.** Supabase grants `authenticated` table-level `UPDATE` on `public.profiles`; the *only* thing stopping a row-owner from writing `role`/`manager_id` is the `WITH CHECK` on `profiles_update_self_safe_fields`. That predicate is correct today (see Audited-clean #3), but it is a **single layer** — if a future feature ever adds a broader (e.g. `FOR ALL`) policy, or RLS is toggled off in a mis-scoped session, the columns become writable.
  - **(b) `anon` retains latent DML grants.** `anon` holds baseline `INSERT`/`UPDATE`/`DELETE` on `profiles`, blocked only by RLS default-deny (no anon-satisfying policy). `anon` never legitimately writes `profiles`.
- **Why it's a risk**: **Not an active hole.** Both are belt-and-suspenders. Documented because `role` is the privilege bit and "one RLS predicate is the sole guard on the privilege bit" is worth a second, privilege-layer lock that holds regardless of RLS state. (Note: this does **not** constrain `service_role`, which bypasses RLS *and* column grants by design — see Audited-clean #14 / Out-of-scope.)
- **Suggested fix** (fix pass, not this slice):

  ```sql
  REVOKE UPDATE (role, manager_id) ON public.profiles FROM authenticated;
  REVOKE INSERT, UPDATE, DELETE   ON public.profiles FROM anon;
  ```

  The SECURITY DEFINER functions (owned by `postgres`) still write `role`/`manager_id`; the trigger still inserts; only the `authenticated`/`anon` roles lose the latent capability.

  > **⚠ The `authenticated` line above is a NO-OP — preserved deliberately as a lesson** (documenting that empirical testing catches what a static SQL audit misses). A column-level `REVOKE UPDATE (role, manager_id)` has no effect while the role holds *table-level* `UPDATE` (Supabase's baseline grant); the table grant covers all columns. Empirically verified: after the revoke, `has_column_privilege('authenticated','public.profiles','role','UPDATE')` still returned `true`. **Corrected form applied in `b4e5e70`** — whitelist the row-owner-editable columns instead of blacklisting the privileged ones:
  >
  > ```sql
  > REVOKE UPDATE             ON public.profiles FROM authenticated;
  > GRANT  UPDATE (full_name) ON public.profiles TO   authenticated;
  > REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon;  -- whole-privilege, effective as-is
  > ```
  >
  > Verified post-migration: `has_column_privilege('authenticated', …, 'role'/'manager_id', 'UPDATE')` = `false`, `'full_name'` = `true`. The `touch_updated_at` BEFORE trigger still sets `updated_at` (a BEFORE trigger's `NEW` assignment is not column-privilege-checked against the invoking role — verified with a role holding only `UPDATE(full_name)`; the e2e account-edit spec confirms it end-to-end). See DECISIONS.md 2026-05-25 choices 4 ("column-grant whitelist") and 5 ("Supabase grant semantics").
- **Status**: `fixed in b4e5e70`

## Finding 5: Inconsistent function `OWNER` pinning across SECURITY DEFINER objects

- **Severity**: `low`
- **Surface**: `is_admin()` — `supabase/migrations/20260517000020_profiles_rls.sql:12-24` (no `ALTER FUNCTION … OWNER`); `handle_new_user()` — `supabase/migrations/20260517000030_profile_trigger.sql:9-24` (no `OWNER`). Contrast with `admin_update_role`/`admin_update_manager`, which **do** pin `OWNER TO postgres` (`…_040_…:39,80`).
- **What**: Both `admin_update_*` functions explicitly `ALTER FUNCTION … OWNER TO postgres`. The two other SECURITY DEFINER objects — `is_admin()` and `handle_new_user()` — do not, so they inherit ownership from whichever role runs the migration.
- **Why it's a risk**: **Low / latent operational hazard.** In every real Serenify environment (local `supabase start`, Supabase Cloud) the migration runner is `postgres`, so the effective owner matches the pinned functions and the behavior is correct. The risk is that a SECURITY DEFINER function's privilege level *is* its owner's; an unpinned owner makes that privilege implicit and environment-dependent, and the inconsistency with the explicitly-pinned siblings is itself a review smell suggesting it was unintentional. `is_admin()` in particular is called from inside RLS policies, where getting the execution identity wrong would be high-impact.
- **Suggested fix** (fix pass, not this slice): add `ALTER FUNCTION public.is_admin() OWNER TO postgres;` and `ALTER FUNCTION public.handle_new_user() OWNER TO postgres;` for parity. (`reports_under` and `touch_updated_at` are INVOKER, so owner matters far less; pin for consistency only.)
- **Status**: `fixed in b4e5e70`. `ALTER FUNCTION … OWNER TO postgres` added for `is_admin`, `handle_new_user`, `reports_under`, `touch_updated_at` (the `admin_update_*` pair was already pinned and is re-affirmed). Verified post-migration: all six functions report `owner = postgres`.

## Finding 6: `reports_under()` — INVOKER + unpinned `search_path` + PostgREST-exposed, zero consumers

- **Severity**: `low`
- **Surface**: `supabase/migrations/20260517000050_reports_under.sql:14-26`.
- **What**: `reports_under(uid uuid)` is `LANGUAGE sql STABLE` with **no** `SECURITY DEFINER` (so INVOKER by default), **no** `SET search_path`, and `GRANT EXECUTE … TO authenticated` (plus the implicit `PUBLIC` grant of Finding 3). It is callable today via `POST /rest/v1/rpc/reports_under` and has **zero** in-code callers (confirmed by grep; it exists as a forward contract for features 005/010/011).
- **Why it's a risk**: **No leak** — and this is worth stating plainly because it is easy to misread. Because the function is INVOKER, its internal `SELECT`s against `public.profiles` run with the *caller's* RLS policies. An authenticated employee who calls `reports_under('<any-uuid>')` gets back only rows already visible to them under `profiles_select_*` (their own row / their own direct reports) — **not** an arbitrary manager's subtree. So passing an arbitrary `uid` is not an org-tree enumeration vector. The residual concerns are:
  - **Needless attack surface**: a PostgREST-callable, `PUBLIC`-executable function with no consumer yet.
  - **Future-correctness footgun**: the INVOKER + RLS interaction means `reports_under(me)` returns an **empty** set for a `team_lead` whose own SELECT visibility is self + direct-reports — the recursive self-join is RLS-filtered. A future developer writing a signal-aggregate RLS policy on top of this will get surprising empties unless the function is deliberately made SECURITY DEFINER (with a `search_path` pin and an internal `auth.uid()`/`is_admin()` scope guard) at that time.
  - `search_path` is unpinned; immaterial for an INVOKER function under PostgREST (which resets `search_path` per request) and because the body schema-qualifies `public.profiles`, but it should be pinned if/when the function becomes DEFINER.
- **Suggested fix** (fix pass, not this slice): minimally `REVOKE EXECUTE … FROM PUBLIC` (Finding 3) and consider `REVOKE … FROM authenticated` until a real consumer lands (re-grant when 005/010/011 adopt it). When adopted, make the DEFINER-vs-INVOKER decision deliberately, pin `search_path = ''` (or `public, pg_temp`), and add a scope guard so a caller can only traverse their own subtree (or require `is_admin()`). Document the chosen posture in `docs/DECISIONS.md`.

  > **⚠ "Exposure zero" requires revoking all four grantees, not just PUBLIC + `authenticated`.** As with Finding 3, Supabase's explicit `anon`/`service_role` grants survive `REVOKE … FROM PUBLIC`; revoking only PUBLIC + `authenticated` would leave `reports_under` anon- and service_role-executable — *not* zero. **Strengthened form applied in `b4e5e70`:**
  >
  > ```sql
  > REVOKE EXECUTE ON FUNCTION public.reports_under(uuid)
  >   FROM PUBLIC, anon, authenticated, service_role;
  > ```
  >
  > Verified post-migration `pg_proc.proacl` = `{postgres}` — exposure is now *genuinely* zero. Only the owner (`postgres`, pinned in Finding 5) retains EXECUTE, which is exactly why the Finding 1 cycle check still works: `admin_update_manager` runs as `postgres` and calls `reports_under` internally. See DECISIONS.md 2026-05-25 choices 2 ("reports_under deferred design") and 5.
- **Status**: `fixed in b4e5e70`

## Finding 7: `handle_new_user()` persists unvalidated user-controlled `full_name`

- **Severity**: `low`
- **Surface**: `supabase/migrations/20260517000030_profile_trigger.sql:16-21`.
- **What**: The trigger inserts `NEW.raw_user_meta_data->>'full_name'` into `profiles.full_name`. On self-signup, `raw_user_meta_data` is client-controllable, so `full_name` is attacker-controlled text with no DB-level length/content constraint.
- **Why it's a risk**: The two dangerous answers are **negative**, and that is the important affirmative result of the audit:
  - **No privilege escalation**: `role` is hard-coded `'employee'::public.user_role` (line 20) and is never read from metadata. A crafted signup payload cannot set `role='admin'`.
  - **No SQL injection**: `full_name` is a *bound value* in an `INSERT … VALUES (…)`, not interpolated into dynamic SQL. A `full_name` containing quotes or `; DROP …` is stored verbatim as text.

  The only residual is **stored XSS at render time** — an unsanitized `full_name` (e.g. `<img src=x onerror=…>`) surfaced later in a manager/admin view. That is a render-layer concern and is **routed out of this slice** (see Out of scope). It is recorded here as the explicit answer to the audit's "does the trigger trust metadata for any field?" question.
- **Suggested fix**: none at the trigger. Enforce `full_name` validation at the signup Server Action / form (slice 3) and rely on framework auto-escaping at render (React escapes by default; flag any `dangerouslySetInnerHTML`). Optionally add a light DB-level `CHECK (char_length(full_name) <= 200)` as defense-in-depth if the fix pass wants a backstop.
- **Status**: `routed to slice 3 — full_name validation at signup Server Action`. No DB `CHECK` added in this migration (deliberately, per the fix-pass scope); the DB layer is clean (no escalation, no SQLi). Validation + stored-XSS mitigation land in slice 3 / the app layer.

---

## Audited and clean

Affirmative record — each surface below was examined and returned no finding.

1. **RLS enabled + forced** — `ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` (`…_020_…:28-29`). FORCE subjects even the table owner to policies.
2. **`profiles_select_self` / `profiles_select_admin`** (`…_020_…:32-39`) — self sees own row via `auth.uid() = id`; admin-all gated by `is_admin()` (SECURITY DEFINER, pins `auth.uid()` internally, cannot be spoofed by the caller).
3. **`profiles_select_direct_reports`** (`…_020_…:43-45`) — `manager_id = auth.uid()` is a **single-hop** predicate; it does not recurse, so a skip-level manager does **not** gain visibility of indirect reports. Constitution Principle I (direct manager sees only direct reports; skip-level sees only aggregates) is upheld at the table level. Visibility is correctly driven by the manager graph, not by the role label.
4. **`profiles_update_self_safe_fields` WITH CHECK** (`…_020_…:52-60`) — **the load-bearing escalation control, and it holds.** The `WITH CHECK` re-reads `role` / `manager_id` via a subquery on the same table; under Postgres MVCC the subquery sees the **pre-UPDATE** snapshot (the OLD value), so a row-owner setting `role='admin'` fails `'admin' = 'employee'` and is rejected. Bypass vectors tested and closed: multi-row UPDATE (USING `auth.uid() = id` restricts candidates to the caller's own row), writable CTE (same policy applies, same snapshot), NULL `auth.uid()` (USING is NULL → zero rows), `NEW.id` rewrite (WITH CHECK requires `auth.uid() = id` on the new row; also FK to `auth.users`).
5. **INSERT posture** — no INSERT policy ⇒ default-deny for `authenticated`/`anon`. The only insert path is `handle_new_user` (SECURITY DEFINER); `role` hard-coded `'employee'`.
6. **DELETE posture** — no DELETE policy ⇒ default-deny. Deletion flows only via `auth.users … ON DELETE CASCADE` (FK at `…_010_…:6`), executed at the DB layer, not through RLS. Admins cannot directly DELETE rows (no admin DELETE policy — intentional).
7. **`is_admin()` unauthenticated behavior** — `auth.uid()` NULL ⇒ `WHERE id = NULL` matches nothing ⇒ `EXISTS` false. Returns `false` for anon.
8. **`is_admin()` `search_path` + marking** — `SET search_path = public, pg_temp` with `public` first and the body fully-qualifying `public.profiles`; no `pg_temp` shadow vector. `STABLE` is the correct volatility (not `IMMUTABLE`, which would cache a stale admin bit; not `VOLATILE`).
9. **`admin_update_role` guards** — `is_admin()` check raises `42501` *before* any data access (no silent noop); `IF NOT FOUND` after the UPDATE raises `P0002` for a nonexistent target; `search_path` pinned; `OWNER TO postgres` pinned. (Self/last-admin gap is Finding 2.)
10. **`admin_update_manager` guards** — `is_admin()` check; self-as-manager blocked at line 57 *and* by the `profiles_no_self_manager` CHECK; prospective-manager existence verified (line 62); `search_path` pinned; `OWNER TO postgres` pinned. (Multi-node cycle gap is Finding 1.)
11. **`admin_update_*` `auth.uid() IS NOT NULL`** — not written explicitly, but fully subsumed: `is_admin()` is `false` when `auth.uid()` is NULL, so the guard fires first.
12. **`reports_under()` termination** — `WITH RECURSIVE … UNION` (not `UNION ALL`) deduplicates against the accumulated result each iteration; on any finite graph, including cycles of any length, the working set eventually produces no new rows and the recursion terminates. No infinite-loop / hang today. (Defense-in-depth `CYCLE` clause recommended under Finding 1.)
13. **`touch_updated_at()`** — SECURITY INVOKER; body is `NEW.updated_at := now(); RETURN NEW;`. `now()` resolves from `pg_catalog` regardless of `search_path`; no dynamic SQL, no user input, no injection or search_path concern.
14. **`/api/admin/invite` privileged-write pattern** (`apps/web/app/api/admin/invite/route.ts`) — **Decision 2026-05-17 verified intact.** The service-role `admin` client is used **only** for `auth.admin.inviteUserByEmail` (step 2, line 62); both privileged RPCs (`admin_update_role`, `admin_update_manager`, steps 3-4, lines 90/107) go through the **caller's session client** so `auth.uid()` inside `is_admin()` resolves to the verified admin. Step 1 independently verifies the caller's `role` via the session client before any privileged action.
15. **Service-role client construction sweep** — confined to expected files: `apps/web/lib/supabase/admin.ts` (`server-only`-guarded, used only by the invite handler), `scripts/lib/supabase-admin.ts` (seed), and the e2e/test helpers (`apps/web/tests/e2e/setup/admin-client.ts`, `scripts/__tests__/seed-demo.integration.test.ts`). No rogue production caller.
16. **`auth.*` custom layering** — the only object layered onto Supabase-managed `auth.*` is the `on_auth_user_created` AFTER INSERT trigger on `auth.users` (`…_030_…:26-29`). No custom policies or grants on `auth` tables.
17. **Schema inventory** — `public.profiles` is the **only** table in the `public` schema (verified: a single `CREATE TABLE` across the whole migrations tree). No other table needed auditing this slice.
18. **Role-string equality drift** — the only security-authoritative admin gate is `is_admin()` (DB-side). The `role === "employee"` checks in `apps/web/app/(authed)/app/page.tsx:33` and `…/layout.tsx:36` are pure **presentation** gates (which body / whether to show the chat pill), not authorization. The handler-side `callerProfile?.role !== "admin"` check (`route.ts:53`) is non-authoritative defense-in-depth atop the DB `is_admin()` guard. (Minor: if the `'admin'` enum literal is ever renamed, the handler string and the `is_admin()` body both need updating — tracked as a slice-3 note, not a finding.)

---

## Out of scope this slice

Routed elsewhere; recorded so nothing is silently dropped.

- **`/api/admin/invite` HTTP-handler robustness (→ slice 3).** Steps 2-4 are three non-transactional operations; if step 3/4 fails after a successful invite, the invited user lands at `role='employee'` with manual recovery and no idempotency key. The 500 body returns the invited `user_id` (a UUID, surfaced only to the admin who issued the invite — not a breach, but the handler's error-shape and partial-success semantics belong to the handler review). The **SQL** these steps call is audited above; the **handler** is slice 3.
- **`full_name` input validation + stored-XSS sanitization (→ slice 3 / frontend).** See Finding 7 — DB layer is clean (no escalation, no SQLi); render-time escaping and signup-form validation are the mitigations and live in the app layer.
- **e2e `global-setup.ts` writing `role` via the service-role client (by design, not a finding).** Per Decision 2026-05-17 / feature 002 FR-018, the seed and test infra write `role`/`manager_id` directly via the service-role client, which bypasses RLS *by design* (`auth.uid()` is NULL under service-role, so the SECURITY DEFINER RPCs cannot be used). This is the intended privileged-write path for non-interactive tooling, not a gap. A reviewing subagent flagged it as "High"; rejected on this basis.
- **RLS performance (not security).** `auth.uid()` and `is_admin()` are re-evaluated per row in the SELECT policies; the Supabase-recommended `(SELECT auth.uid())` / `(SELECT public.is_admin())` wrapping is a performance optimization, out of scope for a security audit.
- **Auth flows / cookie attributes (→ slice 2)** and **open redirect on `?next=` / secrets handling (→ slices 3/4)** per the slice plan.

---

## Verification approach

Queries and greps a future Claude can re-run to confirm this audit. Run SQL
against the project DB (`supabase db` shell, Studio SQL editor, or `psql`).

**RLS enabled + forced on profiles:**
```sql
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE oid = 'public.profiles'::regclass;
-- expect: profiles | t | t
```

**Full policy list + predicates:**
```sql
SELECT polname, cmd, qual, with_check
FROM pg_policies WHERE schemaname='public' AND tablename='profiles';
-- expect 4 policies; profiles_update_self_safe_fields shows the role/manager_id subqueries in with_check
```

**Function security posture (DEFINER?, search_path, owner):**
```sql
SELECT p.proname,
       p.prosecdef                              AS security_definer,
       p.proconfig                              AS settings,        -- search_path pin shows here
       pg_get_userbyid(p.proowner)              AS owner,
       p.provolatile                            AS volatility
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('is_admin','admin_update_role','admin_update_manager',
                    'handle_new_user','reports_under','touch_updated_at');
-- Finding 5: is_admin / handle_new_user owner should match admin_update_* (postgres)
-- search_path should be {search_path=public,\ pg_temp} for the 4 DEFINER/pinned fns
```

**EXECUTE grants (Finding 3 — look for `=X/` PUBLIC entries):**
```sql
SELECT p.proname, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('is_admin','admin_update_role','admin_update_manager','reports_under');
-- A NULL proacl means default (PUBLIC has EXECUTE). An entry like "=X/postgres" is an explicit PUBLIC EXECUTE.
```

**Table DML grants for anon/authenticated (Finding 4):**
```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='profiles'
  AND grantee IN ('anon','authenticated')
ORDER BY grantee, privilege_type;
```

**Behavioral proofs (run as a non-admin authenticated user, e.g. via PostgREST with that user's JWT):**
```sql
-- Escalation must be REJECTED (0 rows updated / policy violation):
UPDATE public.profiles SET role='admin' WHERE id = auth.uid();
-- Re-parent self must be REJECTED:
UPDATE public.profiles SET manager_id = '<some-uuid>' WHERE id = auth.uid();
```

**Cycle reproduction (Finding 1 — run as admin; demonstrates the gap):**
```sql
SELECT public.admin_update_manager('<A>','<B>');  -- A reports to B
SELECT public.admin_update_manager('<B>','<A>');  -- B reports to A  -> currently SUCCEEDS (bug)
SELECT * FROM public.reports_under('<A>');         -- includes A itself; terminates (no hang)
```

**Last-admin reproduction (Finding 2 — run as the only admin):**
```sql
SELECT public.admin_update_role(auth.uid(), 'employee');  -- currently SUCCEEDS -> zero admins
SELECT public.is_admin();                                  -- now false for everyone
```

**Code sweeps (grep / ripgrep from repo root):**
```text
service-role callers:   SERVICE_ROLE|service_role|createAdminClient
role-string drift:      role\s*===?\s*['"]admin['"]|role\s*=\s*'admin'
RPC / function callers:  reports_under|admin_update_role|admin_update_manager|is_admin
other public tables:    CREATE TABLE        (expect only public.profiles)
```
