# Deploy Log — P8 Stage 2, `user_consents` migration to hosted

**This file records what actually happened, verbatim.** T136 requires each of T135's
verifications to be run **with its actual output recorded — "not a claim that it passed"**. The
outputs below are pasted as returned, not summarised. Where a value was compared against an
expectation, both are shown.

| | |
|---|---|
| **Date** | 2026-07-28 |
| **Branch** | `013-public-surface-and-legal` @ `c4696b8` (post-#186) |
| **Hosted project** | `excukdzjudslbqmkysrc` (eu-central-1, Free tier) |
| **Server** | PostgreSQL **17.6** on `aarch64-unknown-linux-gnu` |
| **Protocol followed** | `deploy-protocol.md` §5 steps 1–13 |
| **Execution split** | Every hosted-authenticating command run by **Mohamed** in his own terminal; output pasted back. Local restore, comparison and diffing driven by the agent. The database password was never held by the agent session. |
| **Scope** | Stage 2 only — backup + migration. **No code deployed. Nothing merged. Stage 3 not begun.** |

---

## Step 1 — connectivity

```
postgres|PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit
```

**PASS.** Database `postgres`, major version **17**, matching the container's `pg_dump 17.6`.
Architecture is `aarch64`, not the `x86_64` the expectation assumed — irrelevant, as `-Fc` dumps
are architecture-independent and compatibility is a server-version question.

Two credential-free pre-checks were run first, after a machine-wide DNS outage delayed the
window: container→pooler name resolution (`18.196.8.182`, an `eu-central-1` ELB) and TCP reach to
`:5432` (`TCP_OPEN`). Both green before any password was typed.

---

## Step 2 — pre-migration row counts (the step-12 baseline)

```
          t          | count
---------------------+-------
 auth.users          |    20
 profiles            |    20
 window_readings     |   246
 monitoring_sessions |    28
(4 rows)

         window_start
-------------------------------
 2026-07-28 06:48:15.387033+00
```

**`auth.users` = 20 — the operational number.** That is the count of people who meet the
Terms/Privacy re-consent screen the moment Stage 3's code goes live.

`profiles` **equals** `auth.users` exactly, so `handle_new_user()` has fired successfully for
every account that has ever existed on this project — the clean baseline step 12 compares against.
20 against the 14 accounts migrated on 2026-07-04 means **6 genuine signups** in the 24 days since.

`window_start` is the server clock, captured for §6's baseline rather than reconstructed later
from a laptop clock. This query is an addition to T135, not part of it.

---

## Step 3 — the dump

`pg_dump` returned **no output**, which is its success condition.

| | |
|---|---|
| **Path** | `C:\Users\moham\serenify-backups\serenify-pre-013-20260728-0648.dump` |
| **Size** | **447,973 bytes** |
| **Written** | 2026-07-28 09:50:30 local |
| **In-container size** | 447,973 — identical, so the `docker cp` was faithful |

Stored **outside the repository**. The filename carries step 2's window-start stamp so the dump
and the counts it corresponds to cannot drift apart.

---

## Step 4 — ⚠ THE RESTORE (an unrestored dump is not a backup)

Restored into a scratch database `restore_check` on the local instance, `--no-owner --no-acl`.

**Row counts in the restored copy, against step 2:**

| Table | Source | Restored | |
|---|---|---|---|
| `auth.users` | 20 | **20** | ✓ |
| `profiles` | 20 | **20** | ✓ |
| `window_readings` | 246 | **246** | ✓ |
| `monitoring_sessions` | 28 | **28** | ✓ |

**`handle_new_user()` in the restored copy** → md5 `c3a8c7ccd50a6b068a5e1b71142415de`, **identical
to the same query against hosted**. Its body was additionally diffed programmatically against
`20260517000030_profile_trigger.sql` — **identical, zero differences** — and contains no
`terms_privacy_version` guard and no `user_consents` INSERT, i.e. the pre-013 body §3 requires.

**`pg_restore` exited 1 with `errors ignored on restore: 2`.** Both are recorded rather than
waved past:

1. `realtime.list_changes` — `permission denied to set parameter "log_min_messages"`. The
   function's `SET log_min_messages TO 'fatal'` clause needs privileges the local role lacks.
2. `COPY vault.secrets` — `permission denied for table secrets`.

**Neither is a hole in the backup.** Both objects are *present in the dump* — the archive carried
the `COPY vault.secrets` statement with its data; the local restore refused to replay it under
local privileges. This is a limit of the rehearsal, not of the backup file. The gap was then
**closed rather than merely noted**: `SELECT count(*) FROM vault.secrets` on hosted returns **0**,
so there is no unproven data anywhere in the dump.

`restore_check` dropped after verification.

**A1 cleared: the backup is proven, not hoped.**

---

## Step 5 — exactly one migration pending

Read from the open psql session rather than by a second `supabase migration list --linked`
authentication:

```
 applied |     newest     | user_consents_already_applied
---------+----------------+-------------------------------
      15 | 20260703000000 | f
```

**15 applied against 16 local migration files → exactly one pending**, the newest applied is the
pre-013 migration, and `20260726000000` reports **`f`**. **A3 cleared: nothing rides along.**

---

## Step 6 — the migration is additive

```
grep -icE "\bDROP\b|\bTRUNCATE\b|ALTER COLUMN" supabase/migrations/20260726000000_user_consents.sql
→ 0
```

**PASS.** The only existing object whose definition changes is `handle_new_user()`.

---

## Step 7 — the lock, decided on numbers rather than feel

`user_consents.user_id` is `REFERENCES auth.users(id) ON DELETE CASCADE`, so `auth.users` takes a
brief lock at constraint creation. T135 says run at a low-traffic hour; step 2 let that be settled
arithmetically instead of by judgement: **6 signups across 24 days ≈ 0.25/day**, against a
sub-second lock — a collision probability on the order of one in a million. Applied at ~09:50
local. On this project every hour is a low-traffic hour, and waiting bought nothing measurable.

---

## Step 8 — ⚠ no drift, immediately before applying

```
       handle_new_user_md5
----------------------------------
 c3a8c7ccd50a6b068a5e1b71142415de
```

**Unchanged** from the step-4 reading, and tied to the repo by that step's diff. Hosted still
carried the **pre-013** body, so step 9's `CREATE OR REPLACE` overwrote nothing but the function
it was meant to replace. **A2 cleared.** Re-read deliberately in the message immediately preceding
the push, not carried over from recon.

---

## Step 9 — apply

```
npx supabase db push --linked

Initialising login role...
Connecting to remote database...
│
◇  Do you want to push these migrations to the remote database?
│   • 20260726000000_user_consents.sql
│
│  Yes
Applying migration 20260726000000_user_consents.sql...
Finished supabase db push.
```

**Exactly one migration listed and applied. No errors. No seeds. No `db reset`. No other pushes.**

---

## Step 10 — table, constraints, RLS, grants

**7 columns**, all `NOT NULL`:

```
   column_name    |        data_type         | is_nullable |  column_default
------------------+--------------------------+-------------+-------------------
 id               | uuid                     | NO          | gen_random_uuid()
 user_id          | uuid                     | NO          |
 consent_key      | text                     | NO          |
 document_version | text                     | NO          |
 decision         | text                     | NO          | 'granted'::text
 decided_at       | timestamp with time zone | NO          | now()
 created_at       | timestamp with time zone | NO          | now()
(7 rows)
```

**7 constraints** — PK, FK, UNIQUE and **four** CHECKs (T135 said three; see Corrections):

```
user_consents_check                  | CHECK ((document_version ~~ (consent_key || '@%'::text)))
user_consents_consent_key_check      | CHECK ((consent_key = ANY (ARRAY['terms_privacy'::text, 'camera_inference'::text])))
user_consents_decision_check         | CHECK ((decision = 'granted'::text))
user_consents_document_version_check | CHECK ((document_version ~ '^(terms_privacy|camera_inference)@\d{4}-\d{2}-\d{2}\.\d+$'::text))
user_consents_one_per_revision       | UNIQUE (user_id, consent_key, document_version)
user_consents_pkey                   | PRIMARY KEY (id)
user_consents_user_id_fkey           | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
```

**Index**: `user_consents_lookup_idx` (1 row). **Immutability trigger**: `user_consents_no_update`
(1 row).

**RLS — both flags true:**

```
 relrowsecurity | relforcerowsecurity
----------------+---------------------
 t              | t
```

**Both owner-self policies, and only those:**

```
        policyname         |  cmd   |                  qual                   |               with_check
---------------------------+--------+-----------------------------------------+-----------------------------------------
 user_consents_insert_self | INSERT |                                         | (( SELECT auth.uid() AS uid) = user_id)
 user_consents_select_self | SELECT | (( SELECT auth.uid() AS uid) = user_id) |
```

**Grants — exactly two rows, nothing for `anon`:**

```
    grantee    | privilege_type
---------------+----------------
 authenticated | INSERT
 authenticated | SELECT
```

**No UPDATE. No DELETE. Nothing to `anon`.** PASS on every clause.

---

## Step 11 — `handle_new_user()` now matches the 013 definition

```
               md5                | has_guard | has_consent_insert | profiles_insert_preserved
----------------------------------+-----------+--------------------+---------------------------
 0461be291ba1bf759c7dc7c09b477500 | t         | t                  | t
```

The expected hash was derived from the **local** database, which carries the same migration from
the same file; hosted matches it **exactly**, which also rules out any working-copy line-ending
difference. The guard is present, the consent INSERT is present, and the original `profiles`
INSERT is preserved — the edit is additive, as `data-model.md` §6.6 requires.

---

## Step 12 — nothing backfilled, nothing else moved

```
 user_consents_rows
--------------------
                  0
```

**Zero rows. No backfill occurred** (FR-041, §7.4). Every existing user starts with no consent
record, which is the truth: they were never asked.

```
          t          | count
---------------------+-------
 auth.users          |    20
 profiles            |    20
 window_readings     |   246
 monitoring_sessions |    28
```

`profiles`, `window_readings` and `monitoring_sessions` **unchanged** from step 2.

---

## Step 13 — ⚠ THE LIVE SITE STILL ACCEPTS A SIGNUP

A throwaway account created through **`serenify.tech`'s own signup form**, on the currently
deployed **pre-013** code, against the **migrated** database.

```
id           | 0e987b71-607f-4564-bb7c-97544b0b8eb1
email        | mohamedasem318+p8deploy@gmail.com
created_at   | 2026-07-28 07:42:44.748664+00
profile_rows | 1
consent_rows | 0
```

**This is the entire premise of migration-first, demonstrated rather than assumed.** The account
was created normally. `profile_rows = 1` proves the *replaced* function still does its original
job. `consent_rows = 0` proves the `?` key-existence guard **skipped without raising** — pre-013
code sends no `terms_privacy_version`, the branch is false, the INSERT never runs. **Zero is the
pass here, not a miss.**

Throwaway deleted, and the cascade verified:

```
DELETE 1

          t          | count
---------------------+-------
 auth.users          |    20
 profiles            |    20
 user_consents       |     0
 window_readings     |   246
 monitoring_sessions |    28
```

All nine `public` tables carry `ON DELETE CASCADE` from `auth.users`, so the deletion left nothing
behind. State is identical to the pre-migration baseline.

---

## Corrections made to T135 while executing

Recorded here because a protocol is only trustworthy if its edits are visible.

| Where | Correction | Commit |
|---|---|---|
| §1 | Two rows added — **#187** (layout suite's intermittent false negative) and the **FR-053 spent exception** (24×24 chapter markers). Both post-dated T135. | `af2ccb5` |
| §5 steps 1, 3; §7 step 1 | Password was inline in a `postgresql://` URI. PSReadLine persists history to disk. Rewritten to flag form with `-W` prompting. | `af2ccb5` |
| §5 step 3; §7 step 1 | `docker cp` target was `./` — the **repo root** — three lines above its own instruction to store the dump outside the repo. | `af2ccb5` |
| §5 step 5 | Filed as read-only pre-flight; it authenticates and prompts. Folded into the psql session. | `af2ccb5` |
| §0 | Credential-handling rule, the operator/agent split, and which steps are operator steps. | `af2ccb5` |
| §5 step 5 note | Said local carries **8** migration files. It carries **16**. From an `ls \| tail -8` misread as the whole list. | `59fa4fb` |
| §5 step 10 | Said **three** CHECK constraints; the migration defines **four** (`document_version` carries both the format regex and the key-matching `LIKE`). | `ff0b73d` |

Re-verified against `c4696b8` and found **unchanged**: §2 Lever 2 (`git revert afa20d8`) still
applies cleanly, `tasks.md` still its only overlap with #186; §7's rollback file still hashes
`3fdd9056…1db393` at 1,914 bytes; §1's `#176` count still holds (`next` at 16.2.11 on the branch).

---

## State at the end of Stage 2

**Hosted runs the new schema. `serenify.tech` runs pre-013 code.** That is the safe direction, by
construction and now by demonstration.

- The gap in the safe direction has **no hard limit**; recorded expectation **≤ 72 hours**
  (§3). **If it exceeds that, re-run steps 8–11 before deploying code** rather than trusting this
  log's snapshot.
- Both revert levers remain available and were re-verified this window.
- §6's monitoring baseline is `2026-07-28 06:48:15.387033+00`.

**Not done, deliberately**: Stage 3, T138's preview signup, any code deploy, any merge to `main`.
