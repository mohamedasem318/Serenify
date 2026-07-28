# Deploy Protocol — feature 013, `user_consents` (T135)

**Read §0 to §4 before touching anything. Then work §5 top to bottom.**

> **RE-VALIDATED 2026-07-28 against `c4696b8`** (the post-#186 tip of
> `013-public-surface-and-legal`), before P8 Stage 2 executed. This document was authored
> *before* #186 merged, so every claim in it was re-checked rather than trusted. What changed:
> **§1** gained two rows (**#187**, and the FR-053 spent exception) — it was incomplete, not
> wrong; **§5 steps 1 and 3** and **§7 step 1** had the database password inline in a
> connection URI and now prompt for it instead (and stopped writing the dump into the repo
> root, which contradicted their own warning); **§0** states the credential-handling
> shape the deploy actually runs under. Re-verified and **unchanged**: §2 Lever 2 still applies
> cleanly, §7's rollback file still hashes as recorded, §5 step 6 still returns 0, and §1's
> `#176` count still holds. Details are recorded at each site.

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
| Hosted DB password | Mohamed supplies it. Not in the repo, not in `.env.local`. **Never inline in a command — see "Credential handling" below.** |
| Connection host | `aws-1-eu-central-1.pooler.supabase.com:5432`, user `postgres.excukdzjudslbqmkysrc`, db `postgres` |
| Supabase CLI login | **already logged in** — the access token lives in **Windows Credential Manager** (`LegacyGeneric:target=Supabase CLI:supabase`), not in `~/.supabase/access-token`. An absent token *file* is therefore not evidence of being logged out. |
| Local Supabase | **running** (`supabase_db_Serenify` healthy) — the dump is restored into it |
| Branch | `013-public-surface-and-legal`, **no uncommitted tracked changes**. Untracked paths unrelated to the feature (e.g. local scratch notes) are acceptable and need not be removed; what must be clean is anything git would carry into a commit or a revert. |

**Credential handling — added 2026-07-28, and it constrains how every command below is written.**

The password must not reach a process's **argv**. On this host that is not a theoretical
concern: PowerShell's PSReadLine persists command history to disk, so a connection URI with the
password in it survives in a file neither operator would think to clean up, and argv is also
visible to `ps` and to any agent transcript that echoes the command.

**Therefore every hosted command in this document passes the password by environment or by
prompt — never inline in a `postgresql://…` URI.** Where a URI appeared, it has been rewritten
to the flag form (`-h/-p/-U/-d`) with the secret supplied out of band. This is a **correction to
the original T135 text**, applied at §5 steps 1 and 3 and at §7 step 1.

**P8 Stage 2 executed under an operator-runs-hosted-commands split** (Mohamed's ruling,
2026-07-28): every command that authenticates to the hosted database is run by the operator in
their own terminal and its output pasted back, so the password is never held by the agent
session at all. Everything that does not authenticate to hosted — the local restore, the
comparisons, the diffing, the verification arithmetic — is driven by the agent.

**Which steps are operator steps under that split**: §5 steps **1**, **2**, **3**, **5**, **8**,
**9**, **10**, **11**, **12**, all of §6's queries, and §7 step 1 — i.e. **every** step that
opens a connection to hosted, not merely the three that write. Steps **2, 8, 10, 11, 12** and
§6 are pure `SELECT`s and can all be pasted into **one** already-authenticated `psql` session,
so the credential is typed **once**, not once per step. Steps 3 and 9 authenticate separately
because `pg_dump` and `supabase db push` cannot run inside a psql session.

If a later deploy is run single-handed, the fallback is an environment variable sourced from a
file **outside the repo** (`PGPASSWORD` for psql/`pg_dump`, `SUPABASE_DB_PASSWORD` for the CLI),
passed to the container by name — `docker exec -e PGPASSWORD …` — so the value is still absent
from argv, from history and from any transcript.

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
| **The layout suite has an intermittent false negative** (**#187**) — *added 2026-07-28* | **OPEN, and it makes the suite's green tick conditional.** The two **dark** variants of `cold-start-readiness.spec.tsx` race `next-themes` for the `dark` class and fail under load; the failure presents as a contrast assertion (`Expected >= 4.5, Received 4.336…`) measuring a **torn palette**, not a colour regression — no token value changed. Pre-existing in the 009 spec; #186's fifth viewport (1280px) only makes the race lose more often. Measured: **3/3 clean** full-suite runs on this branch vs **3 failures across ~8 runs** on the PR branch, **6/6 clean** once the machine was idle. **A red layout suite in this window is not automatically your deploy** — re-run the spec in isolation before treating it as signal. It is a false *negative* only: it never passes when it should fail, so it cannot hide a real regression. |
| **One deliberate sub-44px target on the public surface** (FR-053, **amended 2026-07-28**) — *added 2026-07-28* | **Shipping by amendment — not broken, but not what the original bar said.** The hero's six chapter markers use a **24×24px** minimum target, because 44×44 forces the cluster to **264px** against the mock's ~66px. **24×24 satisfies WCAG 2.5.8 (AA)** — a step from AAA to AA on one control, not a drop below conformance. Scope: `components/landing/chapter-markers.tsx` **only**; every other public interactive element stays at **44px** and the responsive walk still asserts it. The markers are a **convenience, not a path** — the story auto-advances and every beat is reachable by waiting. **The exception is spent.** Do not read the green responsive walk as "everything is 44px". |

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

> **RE-VERIFIED 2026-07-28 against `c4696b8`**, i.e. *after* #186 merged — the original
> verification predated it and could not have covered it. Still **clean, no conflicts**;
> `tasks.md` still auto-merges. This holds for a structural reason worth recording rather than
> re-testing blindly: `afa20d8` touches the app-shell gate, its env schema and its tests, and
> the **only** path it shares with #186 is `specs/…/tasks.md`. #186's landing work and the gate
> commit are disjoint in code. Re-run the check (`git revert --no-commit afa20d8`, inspect,
> `git reset --hard HEAD`) if anything further merges before the lever is needed.

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
docker exec -it supabase_db_Serenify psql \
  -h aws-1-eu-central-1.pooler.supabase.com -p 5432 \
  -U postgres.excukdzjudslbqmkysrc -d postgres -W \
  -Atc "select current_database(), version();"
```

**Expect**: `postgres|PostgreSQL 17.6…`. **Abort if**: connection refused or auth failure — fix
credentials/network before anything else.

> **Corrected 2026-07-28** from an inline `postgresql://…:<PW>@…` URI (§0, Credential handling).
> `-W` makes psql **prompt** for the password and it is never echoed, never in argv, never in
> shell history. `-it` is required for the prompt to be interactive — without a TTY, `-W` reads
> EOF and the connection fails with an auth error that looks like a wrong password.

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
docker exec -it supabase_db_Serenify pg_dump \
  -h aws-1-eu-central-1.pooler.supabase.com -p 5432 \
  -U postgres.excukdzjudslbqmkysrc -d postgres -W \
  -Fc -f /tmp/serenify-pre-013.dump
docker cp supabase_db_Serenify:/tmp/serenify-pre-013.dump <path-outside-the-repo>/serenify-pre-013-<YYYYMMDD-HHMM>.dump
```

> **Corrected 2026-07-28**, twice. (1) The URI form is replaced by `-W` prompting, as in step 1.
> (2) The original `docker cp` target was `./`, i.e. **the repository root** — which contradicts
> the note immediately below it. The dump contains real user data; write it somewhere outside
> the working tree so it cannot be staged by an absent-minded `git add -A`.

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

> **Note added 2026-07-28.** This command **authenticates to hosted** and will prompt for the
> database password — T135 listed it under "pre-flight, read-only", which is true of its effect
> but obscured that it needs the credential. Under the operator-runs-hosted-commands split (§0)
> it is an operator command. The same answer can be read from an already-open psql session
> without a second authentication:
>
> ```sql
> SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;
> ```
>
> Compare against `ls supabase/migrations/` — local has **16** migration files, the newest being
> `20260726000000_user_consents.sql` (counted 2026-07-28). Hosted must therefore show **15**
> applied versions, the newest being `20260703000000`, and must **not** show `20260726000000`.

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
-- and FOUR CHECKs: consent_key, document_version format, document_version-matches-key,
-- decision='granted' — see the correction note under this step)
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

> **CORRECTED 2026-07-28, mid-execution.** T135 said "the **three** CHECKs". The migration
> defines **four**: `document_version` carries **two** — the format regex at
> `20260726000000_user_consents.sql:28` **and** `CHECK (document_version LIKE consent_key || '@%')`
> at `:29`, which is what stops a `camera_inference@…` string being recorded under
> `consent_key = 'terms_privacy'`. Counting three would make a verifier either accept a table
> missing that constraint, or abort on a correct one. Expect **7 constraint rows** in total:
> PK + FK + UNIQUE + 4 CHECKs. (`NOT NULL` does not appear here — PostgreSQL 17 still records it
> on the attribute, not in `pg_constraint`.)

**Expect**: 7 columns; the FK, UNIQUE and **four** CHECKs present; the index present; the trigger
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
docker exec -it supabase_db_Serenify pg_dump \
  -h aws-1-eu-central-1.pooler.supabase.com -p 5432 \
  -U postgres.excukdzjudslbqmkysrc -d postgres -W \
  --data-only --table=public.user_consents -f /tmp/user_consents_backup.sql
docker cp supabase_db_Serenify:/tmp/user_consents_backup.sql <path-outside-the-repo>/user_consents_backup-<YYYYMMDD-HHMM>.sql
```

> **Corrected 2026-07-28**: URI → `-W` prompt, and `./` → outside the repo (§0, §5 step 3). This
> file is consent history for real people; it must not land in the working tree.

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
| T137 — post-migration verification | §5 steps **10–13** |
| T138 — abort point, throwaway signup on **preview** | Stage 3; **A6** |
| Rollback (T134's file) | §7 |

> **CORRECTED 2026-07-28.** This map left **step 13 unmapped**: T137 was written as steps 10–12
> and T138 is the *preview* signup in Stage 3, so the **live-site** signup at step 13 belonged to
> no task at all. A step owned by no task is a step that gets skipped — and this is the one that
> demonstrates the entire premise of migration-first. Step 13 is T137's, and was run: see
> `deploy-log-2026-07-28.md`.
>
> **Execution record.** T136 requires each verification's *actual output* recorded rather than a
> claim that it passed. That record is **`deploy-log-2026-07-28.md`**, a sibling of this file —
> verbatim outputs for steps 1–13 of the 2026-07-28 run, plus the corrections made to this
> protocol while executing it. This file is the **procedure**; that file is the **evidence**.
