# Smoke Tests: Demo Seed Data

**Feature**: `002-demo-seed-data`
**Owner of human-validated pass**: Mohamed
**When run**: After `/speckit.implement` completes, before the branch merges to `main`.

This document is the Constitution Principle VII human-validated gate.
Every row MUST be ✅ before merge. Record ✅ / ❌ / ⚠ inline in the
Status column AND a one-line note in the Result column (date,
observation, any deviation).

ST-1 through ST-8 mirror SC-001 through SC-008 from `spec.md`. ST-9 and
ST-10 cover spec Edge Cases that have no SC counterpart but still need
human-validated coverage. ST-7 is split into two sub-rows because the
maintainer-only positive path is exercised separately from the negative
rejection paths.

## Pre-conditions for every row

- Local Supabase is running (`supabase start`).
- `apps/web/.env.local` has the three required keys.
- Feature 001 quickstart has been completed (bootstrap admin exists at a real maintainer email, NOT `*@demo.serenify.local`).
- `npm install` has been run from the repo root (devDependencies from T001 are present).
- `npm run typecheck` and `npm run lint` are green on the feature branch.
- The Vitest unit suite (`npm run test:seed`) is green.

## Smoke-test table

| ID | Mirrors | Description | How to run | Pass criterion | Status | Result |
|----|---------|-------------|------------|----------------|:------:|--------|
| ST-1 | SC-001 | Fresh-seed end-to-end under 60s. | From a fresh local Supabase containing only the bootstrap admin, run `time npm run seed`. | Wall-clock under 60s (excluding `npm install`). Process exits 0. Summary table and password banner both printed. | ✅ |"3.68s on Windows, table printed, exit 0" |
| ST-2 | SC-002 | Cohort count and role distribution. | After ST-1, open Supabase Studio → SQL editor and run `SELECT p.role, count(*) FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE u.email LIKE '%@demo.serenify.local' GROUP BY p.role ORDER BY p.role;`. | Result is exactly: `admin: 2`, `team_lead: 5`, `employee: 23`. Total = 30. Every email matches `*@demo.serenify.local`. | ✅ |"admin:2, team_lead:5, employee:23 — all @demo.serenify.local" |
| ST-3 | SC-003 | Hierarchy invariants hold against real rows. | Run the SQL block in Appendix A. | All five FR-006 invariant rows return `true`. | ✅ |"all 5 hierarchy invariants returned true" |
| ST-4 | SC-004 | Re-run is a zero-diff no-op. | After ST-1, snapshot via `SELECT id, email FROM auth.users WHERE email LIKE '%@demo.serenify.local' ORDER BY email;` (save to a file). Run `npm run seed` a second time. Repeat the snapshot. | The two snapshots are byte-identical. The script's stdout was `Demo cohort already present. No changes made.` | ✅ |"second run printed 'Demo cohort already present. No changes made.' — no diff in users table" |
| ST-5 | SC-005 | Reset + seed produces byte-identical names and emails. | Mutate a demo profile in Studio (e.g., flip a team_lead to employee, OR null out a `manager_id`). Snapshot `(full_name, email)` ORDER BY email. Run `npm run seed:reset`. Re-snapshot. | The two `(full_name, email)` lists are byte-identical (the UUIDs differ — `id` and `manager_id` are new — that is the documented determinism boundary per SC-005). The manually mutated row is restored to the canonical value. | ✅ |"reset deleted 30 and recreated 30 — full_name/email lists identical before and after, mutated row restored" |
| ST-6 | SC-006 | Zero non-demo users touched, across all paths. | Snapshot the bootstrap admin's `(id, email, role, manager_id, created_at)`. Run `npm run seed`, then `npm run seed`, then `npm run seed:reset`. Re-snapshot. | All five fields byte-identical. Also confirm any Playwright fixture users that existed pre-run (if a prior `npm run test:e2e` left some) are still present and unmodified. |✅  |"all 34 non-demo users untouched across seed × 2 + reset — IDs, roles, timestamps identical" |
| ST-7a | SC-007 (negative) | `--remote` without `SUPABASE_PROJECT_REF` fails fast. | With the env var explicitly unset (`unset SUPABASE_PROJECT_REF` in bash; `Remove-Item Env:SUPABASE_PROJECT_REF` in PowerShell), run `npm run seed -- --remote`. | Process exits 1 in under 2 seconds. stderr contains `--remote requires SUPABASE_PROJECT_REF to be set. Refusing to run.`. No network call was made to `*.supabase.co` (confirm by network inspector or by the absence of any auth.users mutation on the deployed project — which by definition we cannot reach, satisfying the criterion). | ✅ |"exits immediately with correct stderr message when SUPABASE_PROJECT_REF is missing" |
| ST-7b | SC-007 (positive negative) | Env var without `--remote` is silently ignored. | Set `SUPABASE_PROJECT_REF=some-fake-ref` and run `npm run seed` (no flag). | stdout's first line is `Targeting LOCAL Supabase ...`. The script targets local. Any state changes occur on `127.0.0.1:54321`, not on `some-fake-ref.supabase.co`. | ✅ |"env var set without --remote flag — script targeted LOCAL, no remote activity" |
| ST-7c | SC-007 (positive) | Two-key opt-in shows the prompt; declining aborts cleanly. | With BOTH `SUPABASE_PROJECT_REF=<your-real-test-ref>` AND `--remote`, run `npm run seed -- --remote`. At the `Proceed? (y/N) ` prompt, press `n` then Enter (or just Enter). | Process exits 4 with `Aborted by user.` No network write was performed against the deployed project. (Confirm by checking the deployed Supabase Studio's auth log shows no admin-API activity in the run window.) Maintainer-only: this row is run by Mohamed, not by other contributors. | ⚠ |"skipped — no deployed Supabase project yet" |
| ST-8 | SC-008 | A demo user can sign in on the first attempt. | After ST-1, open the dev server (`npm run dev --workspace=apps/web`) at `http://localhost:3000`. Pick any of the 30 demo emails from the summary table; sign in via `/login` with password `DemoUser123!`. | The sign-in succeeds on the first attempt — no email-confirmation step, no "those details didn't match" error. The user lands on `/app`. | ✅ |"signed in as courtney.kassulke.01 on first attempt, landed on /app with correct admin role" |
| ST-9 | spec Edge Cases | Missing service-role key surfaces a clean error before any network call. | Temporarily remove `SUPABASE_SERVICE_ROLE_KEY` from `apps/web/.env.local` (e.g., comment the line). Run `npm run seed`. Restore the line afterward. | Process exits 2 in under 2 seconds. stderr names the missing variable explicitly. No call to Supabase was made (no entry in Studio → Logs → Auth). | ✅ |"missing SUPABASE_SERVICE_ROLE_KEY caught immediately with explicit error message, exit before any DB call, restored and confirmed working" |
| ST-10 | spec Edge Cases | Local Supabase down → connection error, no partial writes. | Run `supabase stop` (or pause Docker Desktop). Run `npm run seed`. Run `supabase start` again afterward. | Process exits 5 with a connection-refused or ECONNREFUSED error in stderr. No `auth.users` rows were written. (Re-running after `supabase start` succeeds normally — no leftover state to clean up.) | ✅ |"fetch failed / ECONNREFUSED on downed Supabase, no partial writes, recovered cleanly after supabase start" |

---

## Appendix A — Hierarchy invariants SQL

Paste this into Supabase Studio's SQL editor and run as one statement. Every
returned row should have `ok = true`. (Comments are SQL `--` line
comments; they do not affect the result.)

```sql
WITH demo AS (
  SELECT p.id, p.role, p.manager_id, u.email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
   WHERE u.email LIKE '%@demo.serenify.local'
), team_lead_counts AS (
  SELECT m.id AS team_lead_id, count(*) AS direct_reports
    FROM demo m
    JOIN demo r ON r.manager_id = m.id
   WHERE m.role = 'team_lead'
   GROUP BY m.id
)
SELECT 'FR-006(a) — every team_lead has 4–5 direct reports' AS invariant,
       (
         SELECT bool_and(direct_reports BETWEEN 4 AND 5)
           FROM team_lead_counts
       ) AS ok
UNION ALL
SELECT 'FR-006(b) — at least one team_lead reports to another team_lead',
       (
         SELECT count(*) > 0
           FROM demo child
           JOIN demo parent ON parent.id = child.manager_id
          WHERE child.role = 'team_lead'
            AND parent.role = 'team_lead'
       )
UNION ALL
SELECT 'FR-006(c) — exactly 2 employees report directly to admins, one to each',
       (
         SELECT count(*) = 2
            AND count(DISTINCT parent.id) = 2
           FROM demo child
           JOIN demo parent ON parent.id = child.manager_id
          WHERE child.role = 'employee'
            AND parent.role = 'admin'
       )
UNION ALL
SELECT 'FR-006(d) — every non-admin has a non-null manager_id',
       (
         SELECT bool_and(manager_id IS NOT NULL)
           FROM demo
          WHERE role <> 'admin'
       )
UNION ALL
SELECT 'FR-006(e) — both admins have NULL manager_id',
       (
         SELECT bool_and(manager_id IS NULL)
            AND count(*) = 2
           FROM demo
          WHERE role = 'admin'
       );
```

Expected result: 5 rows, all with `ok = true`.

---

## Notes for the validator

- ST-7c requires access to a deployed Supabase project; it is reserved for Mohamed. Other contributors record ⚠ on this row with the note "skipped — not maintainer".
- ST-1's 60s budget excludes `npm install`. If Docker Desktop is slow to acknowledge the local Supabase, ST-1 may legitimately fail on a cold start; re-run after `supabase status` reports green.
- ST-5's "byte-identical" comparison applies only to `(full_name, email)`. The hierarchy structure (the name-to-manager-name graph) is also byte-identical; the UUIDs are not — that is the documented determinism boundary per SC-005.
- ST-6's snapshot of the bootstrap admin is the canonical witness for "the script touched nothing outside the demo pattern". Any non-zero diff here is a hard fail.
- ST-9 is the only smoke-test row that intentionally damages `apps/web/.env.local`. RESTORE the file before continuing to ST-10.
- ST-10's `supabase stop` will also disconnect the dev server if `npm run dev` is running; this is expected. The smoke test is verifying the seed script's error handling, not the dev server's.

## Sign-off

| Field | Value |
|-------|-------|
| Run date |2026-05-18 |
| Validator | Mohamed |
| All rows ✅ ? |No — ST-7c ⚠ (skipped, no deployed Supabase project yet) |
| Notes / deviations |ST-2 SQL query had ambiguous column ref, fixed inline. ST-6 pre-condition (real maintainer bootstrap admin) not strictly met — auto-generated test accounts used instead, test validity unaffected. ST-7a initially ❌, fixed by Claude Code (Windows/PowerShell npm.ps1 strips post--- argv; parseArgs now reads npm_config_remote as fallback), re-ran and passed. ST-10 error is a full stack trace rather than a clean one-liner — functionally correct. ST-7c to be re-run by Mohamed once a deployed Supabase project is available. |
