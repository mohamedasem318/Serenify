# Deploy Protocol — feature 013, `user_consents` (T135)

**Read §0 to §4 before touching anything. Then work §5 top to bottom.**

This is written to be **followed**, not read. Every step has a verification and an abort
condition. If a verification does not produce its expected result, **stop at that step** —
do not improvise forward. "It seemed fine" is not a valid outcome anywhere in this file.

`serenify.tech` is **live and taking real signups** throughout this window. Every command
below runs against real people's accounts.

---

## §0. Before you start

**You need, in hand, before step 1:**

| | |
|---|---|
| Hosted project ref | `excukdzjudslbqmkysrc` (eu-central-1, **Free tier**) |
| Hosted DB password | Mohamed supplies it. Not in the repo, not in `.env.local`. |
| Connection host | `aws-1-eu-central-1.pooler.supabase.com:5432`, user `postgres.excukdzjudslbqmkysrc`, db `postgres` |
| Local Supabase | **running** (`supabase_db_Serenify` healthy) — the dump is restored into it |
| Branch | `013-public-surface-and-legal`, clean tree |

**`pg_dump` note, because it will otherwise waste twenty minutes at 2am.** There is **no
`pg_dump` on the Windows host.** The local Supabase container has **pg_dump 17.6**, which
matches the hosted server (**17.6.1.121**) — a lower-versioned `pg_dump` will refuse. So every
dump and restore command below runs **inside the container**:

```
docker exec supabase_db_Serenify pg_dump ...
```

Confirm the container can reach the internet before relying on it (step 1).

**Free tier means there is no safety net but the dump.** No PITR, no automated backups, no
branching. That is why §5 will not let you past step 4 without a **restored** dump.

---

## §1. What is shipping — including what is knowingly broken

Ship this list knowing it, or do not ship.

| Known-broken | Status |
|---|---|
| **ST-9 — no-JavaScript signup refusal is silent** (**#184**) | **FAILED and knowingly accepted.** Fails *closed* — no account, no consent row — so the harm is confusion, not data. `signup/actions.ts` is **not** touched during this window. |
| **WebKit / Safari has no automated coverage** (**#177**) | Dropped from the sign-off bar. P8 signed off on **Chromium and Firefox only**. Nobody may read the green tick as "all three browsers passed". |
| **360 px card alignment misses by 8 px** (**#178**) | Pre-existing, proven against the pre-gate commit. Fails on both browsers. |
| **Self-serve signup is open** (**#62**) | **Deliberate. Do not gate signup during this deploy.** |

Also open and deliberately unfixed: **#185** (blocked team photo leaves an empty reserved
box), **#86**, **#155**, **#174**, **#179**. **#176** is *updated*, not closed — 3 advisories
remain (`sharp`, and both `postcss`, which no `next` bump can clear because 16.2.11 pins
`postcss@8.4.31`).

---

## §2. The two revert levers — verbatim, and their caveats

**Both have been exercised** (ST-10a, 2026-07-28) against a *universal silent lockout* — a
harder state than anything this deploy is likely to produce. Both recovered a fully usable app.

### Lever 1 — the kill switch (fast, but not instant)

```
CONSENT_ENTRY_GATE_ENABLED=false
```

Set it in the Vercel project's environment variables, then **redeploy** — Vercel env changes
do **not** take effect on running deployments. Budget the redeploy, do not assume it is
immediate.

**Four caveats, all of which have bitten someone somewhere:**

1. **ABSENT MEANS ENABLED.** The schema defaults to `"true"`. Deleting the variable does not
   disable the gate — it enables it. To switch the gate **off** you must set the literal
   string `false`.
2. **Case-sensitive.** `"False"`, `"FALSE"`, `"0"`, `"no"` are all **invalid**.
3. **A typo throws at boot.** The value is a two-member enum, not a truthiness coercion — an
   invalid value fails the parse and the app **fails to start**. That is deliberate (a lever
   that silently does the opposite of what it says is worse than one that refuses), but it
   means a fat-fingered value at 2am takes the site down rather than half-working. **Type it
   carefully, and watch the deploy come up.**
4. **A disabled gate is SILENT.** The kill switch is checked *before* the consent read, so
   `[consent-gate] FAIL-OPEN` will **not** appear once it is off. Absence of that line after
   flipping this is correct, not evidence the gate is still running.

### Lever 2 — revert the gate commit

```
git revert afa20d8
```

`afa20d8` is the **P5 merge commit** — *"The app-shell entry gate: it renders a different tree,
it fails open out loud, and it ships alone so one command unwinds it"* (PR #172). It ships
alone precisely so this works. Verified 2026-07-28: it applies **cleanly, no conflicts**
(`tasks.md` auto-merges), and removes the gate entirely.

Then push and let Vercel deploy. **This reverts only the gate**, not the migration, not the
landing page, not the legal documents.

**Prefer Lever 1.** It is a config change, not a code change, and it is reversible by flipping
the value back. Reach for Lever 2 when the problem is the gate *code* rather than the gate
*decision*.

---

## §3. The ordering rule — the one thing that must not be got wrong

> ### **MIGRATION FIRST. ALWAYS. NEVER DEPLOY CODE AHEAD OF THIS MIGRATION.**

**Why migration-first is safe.** Old code + new schema works. Pre-013 code on `main` does not
send `terms_privacy_version`, so the guard at `20260726000000_user_consents.sql:108` —

```sql
IF NEW.raw_user_meta_data ? 'terms_privacy_version' THEN
```

— is false (`?` is the jsonb key-existence operator), the consent INSERT is **skipped**, no
error is raised, and live signups are unaffected. **Re-verify this by reading the deployed
function body (step 9), not by trusting this document.**

**Why code-first is dangerous.** New code + old schema is the bad order, and it fails in two
ways at once:

- The pre-013 trigger is still live, so **no consent row is ever written** for anyone signing
  up in the gap.
- The P5 shell gate reads `public.user_consents`, which **does not exist**, so the read errors,
  the gate **fails OPEN for every user**, and `[consent-gate] FAIL-OPEN` fires continuously.
  The app looks perfectly healthy while the legal gate is silently off.

That is exactly the R2 failure ST-10b exists to make visible. Do not create it deliberately.

### The gap between the migration and the code deploy

**Maximum gap in the dangerous direction (code before migration): ZERO. It is forbidden.**

**Maximum gap in the safe direction (migration before code): no hard safety limit — recorded
expectation ≤ 72 hours.**

This is a **deliberate divergence from T135's literal wording**, and the reason is structural:
P8's own phases put **STOP 2, all of Stage 3, and STOP 3** between applying the migration and
deploying production code, each requiring a human decision. A 60-minute window cannot survive
that, and inventing one would mean writing a number nobody could honour. The safe direction is
safe *by construction* — the `?` guard skips, indefinitely — so the gap costs nothing but a
half-finished deploy sitting there. **If it exceeds 72 hours, re-run steps 8–11 before
deploying code rather than trusting this document's snapshot of hosted state.**

---

## §4. Abort conditions — decide these now, not at 3am

**If any of these happens, you abort. You do not debug it in place on a live database.**

| # | Condition | Action |
|---|---|---|
| **A1** | The dump fails, or the restore into local fails, or **row counts do not match** | **STOP.** Do not migrate. No proven backup, no migration. |
| **A2** | `handle_new_user()` on hosted has **drifted** from `20260517000030_profile_trigger.sql` | **STOP and report.** Do **not** reconcile it yourself — `CREATE OR REPLACE` would silently overwrite whatever the drift was. |
| **A3** | More than one migration is pending, or `db push` wants to apply anything else | **STOP.** Nothing rides along. |
| **A4** | **Live signups begin failing at any point after the migration is applied** | **IMMEDIATE ROLLBACK** (§7). Not a thing to debug while real people cannot create accounts. |
| **A5** | A **sustained stream** of `[consent-gate] FAIL-OPEN` after the code deploy | **IMMEDIATE ROLLBACK** (§7) — or Lever 1 if the app is otherwise healthy. One occurrence is noise; a steady stream is an outage with the legal gate silently off. |
| **A6** | The T138 throwaway signup misbehaves **in any way** | **ABORT the deploy.** Do not proceed, do not merge. |

---

## §5. The steps

### Backup

**1. Confirm the container can reach the hosted database.**

```
docker exec supabase_db_Serenify psql "postgresql://postgres.excukdzjudslbqmkysrc:<PW>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres" -Atc "select current_database(), version();"
```

**Expect**: `postgres|PostgreSQL 17.6…`. **Abort if**: connection refused or auth failure — fix
credentials/network before anything else.

---

**2. Record the pre-migration row counts. Write these down — step 12 compares against them.**

```sql
SELECT 'auth.users'           AS t, count(*) FROM auth.users
UNION ALL SELECT 'profiles',            count(*) FROM public.profiles
UNION ALL SELECT 'window_readings',     count(*) FROM public.window_readings
UNION ALL SELECT 'monitoring_sessions', count(*) FROM public.monitoring_sessions;
```

**Expect**: four numbers. **Record them.** The `auth.users` count is also **the number of
people who will meet the re-consent screen on deploy day** — that is an operational fact worth
knowing before you deploy, not after.

---

**3. Take the dump.**

```
docker exec supabase_db_Serenify pg_dump "postgresql://postgres.excukdzjudslbqmkysrc:<PW>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres" -Fc -f /tmp/serenify-pre-013.dump
docker cp supabase_db_Serenify:/tmp/serenify-pre-013.dump ./serenify-pre-013-<YYYYMMDD-HHMM>.dump
```

**Record**: full file path, **byte size**, timestamp. **Abort if**: `pg_dump` errors, or the
file is implausibly small.

> Store it **outside the repo**. It contains real user data and must never be committed.

---

**4. ⚠ RESTORE IT. An unrestored dump is not a backup — it is a file you hope is a backup.**

Restore into a scratch database on the local instance (**not** into the local `postgres`
database — that is your working dev data):

```
docker exec supabase_db_Serenify psql -U postgres -d postgres -c "CREATE DATABASE restore_check;"
docker exec supabase_db_Serenify pg_restore -U postgres -d restore_check --no-owner --no-acl /tmp/serenify-pre-013.dump
```

Then verify — **per-table row counts matching the source**, and the function present and
byte-identical:

```sql
-- run against restore_check, compare against step 2
SELECT 'auth.users' AS t, count(*) FROM auth.users
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'window_readings', count(*) FROM public.window_readings
UNION ALL SELECT 'monitoring_sessions', count(*) FROM public.monitoring_sessions;

-- and the function, byte-for-byte
SELECT md5(prosrc) FROM pg_proc WHERE proname = 'handle_new_user';
```

**Expect**: counts **identical** to step 2, and the `md5` **identical** to the same query run
against hosted. **Abort if** either differs → **A1**.

Drop `restore_check` when done.

---

### Pre-flight on hosted — read-only

**5. Confirm exactly ONE migration is pending.**

```
npx supabase migration list --linked
```

**Expect**: `20260726000000_user_consents` is the **only** row present locally and absent
remotely. **Abort if** anything else is pending → **A3**.

---

**6. Confirm the migration is additive.** (Verified 2026-07-28; re-check, it costs seconds.)

```
grep -icE "\bDROP\b|\bTRUNCATE\b|ALTER COLUMN" supabase/migrations/20260726000000_user_consents.sql
```

**Expect**: `0`. The only existing object whose *definition* changes is `handle_new_user()`.

---

**7. Know what the lock will be.** `user_consents.user_id` is
`REFERENCES auth.users(id) ON DELETE CASCADE`, so **`auth.users` gains an inbound FK
constraint**. It is **not strictly untouched** — expect a **brief lock on `auth.users` at
constraint creation**.

**Therefore: run step 8 at a low-traffic hour.** The lock is short, but it is on the table every
signup and every sign-in writes through.

---

**8. ⚠ Re-confirm `handle_new_user()` has NOT drifted on hosted.** Do this **immediately
before** applying, not from the recon — a drift introduced since would be silently overwritten
by `CREATE OR REPLACE`.

```sql
SELECT md5(prosrc), prosrc FROM pg_proc WHERE proname = 'handle_new_user';
```

Compare `prosrc` against the body in `supabase/migrations/20260517000030_profile_trigger.sql`
(normalise whitespace before diffing). **Expect**: identical — the pre-013 body, with **no**
`user_consents` INSERT in it. **Abort if** it differs → **A2. STOP AND REPORT. Do not
reconcile it yourself.**

---

### Apply

**9. Apply the migration — and nothing else.**

```
npx supabase db push --linked
```

> **`supabase db reset` MUST NOT be run against the hosted project, ever.** It re-seeds, and
> those 14 accounts were **migrated**, not seeded. There is no seed that reproduces them.
>
> **No seeds. No other pushes. This migration, and nothing else.**

**Expect**: one migration applied, no errors.

---

### Confirm — do not assume

**10. The table, its constraints, its RLS, its grants.**

```sql
-- table + columns
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='user_consents' ORDER BY ordinal_position;

-- constraints (expect: PK, FK→auth.users ON DELETE CASCADE, UNIQUE one_per_revision,
-- and the three CHECKs: consent_key, document_version format, decision='granted')
SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint WHERE conrelid='public.user_consents'::regclass ORDER BY conname;

-- index
SELECT indexname FROM pg_indexes
 WHERE tablename='user_consents' AND indexname='user_consents_lookup_idx';

-- immutability trigger
SELECT tgname FROM pg_trigger
 WHERE tgrelid='public.user_consents'::regclass AND tgname='user_consents_no_update';

-- RLS: BOTH must be true
SELECT relrowsecurity, relforcerowsecurity
  FROM pg_class WHERE oid='public.user_consents'::regclass;

-- both owner-self policies
SELECT policyname, cmd, qual, with_check FROM pg_policies
 WHERE tablename='user_consents' ORDER BY policyname;

-- grants: SELECT and INSERT to authenticated ONLY. No UPDATE. No DELETE. Nothing to anon.
SELECT grantee, privilege_type FROM information_schema.role_table_grants
 WHERE table_name='user_consents' AND grantee IN ('anon','authenticated') ORDER BY 1,2;
```

**Expect**: 7 columns; the FK, UNIQUE and three CHECKs present; the index present; the trigger
present; **both** `relrowsecurity` and `relforcerowsecurity` `true`; `user_consents_select_self`
(SELECT) and `user_consents_insert_self` (INSERT), each scoped `(SELECT auth.uid()) = user_id`;
grants **exactly** `authenticated: INSERT` and `authenticated: SELECT` — **and nothing for
`anon`**.

**Abort if**: any grant beyond SELECT/INSERT to `authenticated`, or anything at all to `anon`,
or either RLS flag false.

---

**11. `handle_new_user()` now matches the 013 definition — byte-for-byte.**

```sql
SELECT prosrc FROM pg_proc WHERE proname='handle_new_user';
```

**Expect**: it now contains the `IF NEW.raw_user_meta_data ? 'terms_privacy_version' THEN`
branch, identical to the body at `20260726000000_user_consents.sql:94-116`.

---

**12. Nothing was backfilled, and nothing else moved.**

```sql
SELECT count(*) FROM public.user_consents;   -- MUST be 0
```

**Expect**: **zero rows.** No backfill, ever (FR-041, §7.4). A non-zero count here means
something wrote consent rows that should not have — **stop and investigate**.

Then re-run **step 2's** counts. **Expect**: `profiles`, `window_readings` and
`monitoring_sessions` **unchanged**. (`auth.users` may have grown — the site is live and taking
signups. That is expected and is the point of step 13.)

---

**13. ⚠ THE LIVE SITE STILL ACCEPTS A SIGNUP.** This is the whole reason migration-first is
safe, so **prove it, do not assume it.**

Create a throwaway account through **`serenify.tech`'s own signup form**, on the currently
deployed pre-013 code.

**Expect**: the account is created normally, a `profiles` row appears, and **no**
`user_consents` row is written (pre-013 code sends no `terms_privacy_version`, so the guard
skips — that is correct, not a failure).

**Abort if** the signup fails → **A4, immediate rollback.**

Delete the throwaway afterwards and record the deletion output.

---

## §6. Watching live signup health during the window

**Record actual numbers at the start, middle and end of the window.** "It seemed fine" is not
evidence.

**1. Supabase auth logs** — Dashboard → project `excukdzjudslbqmkysrc` → Logs → **Auth**. Watch
for signup errors, especially SQLSTATE **23514** and **23502** (see §8).

**2. Signup rate, compared against the same interval yesterday:**

```sql
SELECT count(*) FROM auth.users WHERE created_at > '<window start>';
-- and the comparison baseline
SELECT count(*) FROM auth.users
 WHERE created_at > '<window start>'::timestamptz - interval '1 day'
   AND created_at < '<now>'::timestamptz    - interval '1 day';
```

A drop to zero while the previous day shows activity is **A4**.

**3. The `profiles` half of the trigger still fires** — if `handle_new_user()` were broken,
new auth users would exist with no profile:

```sql
SELECT count(*) FROM auth.users u
 WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);
```

**Expect**: `0`. Anything else means the trigger is failing → **A4**.

**4. After the code deploy — `[consent-gate] FAIL-OPEN`** in Vercel function logs. One
occurrence is noise. **A sustained stream is an outage with the legal gate silently off** →
**A5**.

---

## §7. Rollback

> # ⚠ THE ROLLBACK DESTROYS CONSENT HISTORY.
> `public.user_consents` is **append-only by design** (FR-043b) and is **the only record of
> which wording each person accepted and when**. Once dropped, it is gone.
>
> ## DUMP IT FIRST. THIS IS NOT OPTIONAL.

**1. Dump the consent table — mandatory precondition:**

```
docker exec supabase_db_Serenify pg_dump "postgresql://postgres.excukdzjudslbqmkysrc:<PW>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres" --data-only --table=public.user_consents -f /tmp/user_consents_backup.sql
docker cp supabase_db_Serenify:/tmp/user_consents_backup.sql ./user_consents_backup-<YYYYMMDD-HHMM>.sql
```

Confirm the file exists and is non-empty **before** step 2.

**2. Run the committed rollback:**

`specs/013-public-surface-and-legal/rollback-user-consents.sql` — SHA-256 `3fdd9056…1db393`,
1,914 bytes. **Verified 2026-07-28**: it restores `handle_new_user()` **first** (byte-identical
to `20260517000030_profile_trigger.sql`), *then* `DROP TABLE … CASCADE`, *then* drops the
orphaned `user_consents_immutable()`. It applies cleanly inside a transaction.

**The order is deliberate and must not be changed**: the 013 function inserts into
`user_consents`, so dropping the table first would make every new signup raise between the two
statements.

**Do not re-derive, re-format, or "improve" this file.**

**3. If code is already deployed**, revert it too (§2, Lever 2) — otherwise the deployed shell
gate reads a table that no longer exists and fails open for everyone.

---

## §8. Facts this protocol relies on

Recorded so they can be checked rather than believed.

**The guard, verbatim** (`20260726000000_user_consents.sql:108`):

```sql
IF NEW.raw_user_meta_data ? 'terms_privacy_version' THEN
```

`?` is the jsonb **key-existence** operator. An **absent** key makes the branch false, the
consent INSERT is skipped, and **no error is raised**. That is what makes old code safe against
the new schema.

**The two intolerant cases — these bound how much the seam can take:**

| Metadata shape | What happens |
|---|---|
| key **absent** | branch false → INSERT skipped → **no error**. The safe path. |
| key present but **malformed/empty** | passes `?`, reaches the INSERT, violates the `document_version` format CHECK (`:28`) → **SQLSTATE 23514 → RAISES** |
| key present as **JSON null** | yields SQL NULL → violates NOT NULL (`:27`) → **SQLSTATE 23502 → RAISES** |

**`ON CONFLICT DO NOTHING` (`:111`) does NOT swallow either** — it handles unique/exclusion
violations only.

**And a raise there aborts the whole signup.** `on_auth_user_created` is
`AFTER INSERT ON auth.users FOR EACH ROW`
(`20260517000030_profile_trigger.sql:27–29`), so an exception in the trigger takes the account
creation down with it. That is why A4 is an immediate-rollback condition rather than something
to investigate calmly.

---

## §9. Task map

| Task | Steps here |
|---|---|
| T136 — apply the migration | §5 steps 1–9 |
| T137 — post-migration verification | §5 steps 10–12 |
| T138 — abort point, throwaway signup on **preview** | Stage 3; **A6** |
| Rollback (T134's file) | §7 |
