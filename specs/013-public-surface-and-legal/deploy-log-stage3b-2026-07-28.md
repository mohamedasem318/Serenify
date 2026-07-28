# Deploy Log — P8 Stage 3b, the "Agree and continue" exercise

**Sibling of `deploy-log-stage3-2026-07-28.md`.** That file recorded the T138 signup and closed
with an explicit gap: *"Not exercised: Agree and continue … Stage 4 should decide whether it is
covered."* This file covers it, on Mohamed's instruction to do it **now** rather than in Stage 4 —
while `user_consents` is empty and the rollback script's destructive clause has nothing to destroy.
That property disappears the instant a real user accepts.

| | |
|---|---|
| **Date** | 2026-07-28 |
| **Branch** | `fix-reconsent-and-nav` @ `06797dd` (PR #188 into `013-public-surface-and-legal`) |
| **Preview** | `serenify-git-fix-reconse-0341ed-mohamed-asems-projects-7436e57f.vercel.app` |
| **Database** | hosted `excukdzjudslbqmkysrc` — **production** |
| **Execution split** | Browser driven by the agent through Mohamed's Chrome. Hosted SQL run by the agent via containerised `psql`, using a database password Mohamed supplied explicitly for this exercise **and stated he would rotate afterwards**. This is a deliberate change from Stage 2/3, where the agent held no hosted credential. |
| **Scope** | Stage 3b only. **No production deploy. Nothing merged.** |

---

## §0. The backup — taken FIRST, and proven

Mohamed's condition: *"make sure you make a backup … i don't want to lose ANYTHING from my
production supabase data."* Taken **before** the throwaway was created, so restoring it removes the
account cleanly.

No local Postgres exists on the machine; `pg_dump` was run from the `postgres:17` container, the
same shape Stage 2 used.

| Fact | Value |
|---|---|
| Path | `C:\Users\moham\serenify-backups\serenify-pre-t138b-20260728.dump` |
| `pg_dump` | 17.10 (server is PG 17) |
| Size / TOC | 446 KB, 677 entries |
| Connection | session pooler (`aws-1-eu-central-1.pooler.supabase.com:5432`) — the IPv4 add-on is **not** enabled, so the direct `db.*.supabase.co` host is IPv6-only |

**⚠ AN UNRESTORED DUMP IS NOT A BACKUP** — Stage 2's rule, applied again. Restored into a
`restore_check` database on a **throwaway `postgres:17` container** (not the local Supabase
instance, so nothing local could be disturbed), `--no-owner --no-acl`.

| Table | Production | Restored |
|---|---|---|
| `auth.users` | 20 | **20** |
| `profiles` | 20 | **20** |
| `user_consents` | 0 | **0** |
| `window_readings` | 246 | **246** |
| `monitoring_sessions` | 28 | **28** |

- `user_consents` restored with **RLS enabled**, its **immutability trigger**, and **4 CHECK
  constraints** — matching `plan.md` §5 step 10.
- `handle_new_user()` md5 `0461be291ba1bf759c7dc7c09b477500` in the restored copy, **identical to
  production**.
- `pg_restore` reported **21 errors, all `role "…" does not exist`** (`authenticated` et al).
  **Not a hole in the backup**: the archive contains **28 POLICY entries**, including both
  `user_consents_select_self` and `user_consents_insert_self` — vanilla Postgres simply has no
  Supabase roles to replay them against. Same distinction Stage 2 drew for `vault.secrets`.

Scratch container removed afterwards; the dump copy inside it went with it.

**The backup is proven, not hoped.**

---

## §1. The throwaway — created on production, so it lands un-consented by construction

Created through **`serenify.tech`'s own signup form**. Production runs pre-013 code, whose
`/signup` has **no acknowledgement checkbox and no Terms/Privacy links** — confirmed visually on
the form — so it sends no `terms_privacy_version`, the trigger's guard skips, and the account lands
with **no consent row**. That is exactly the state all 20 existing accounts are in. **No real
user's account was touched.**

Confirmed with the emailed 6-digit OTP (pasted back by Mohamed).

```
id                 | 90685018-13dd-4361-ab98-270999b90c43
email              | mohamedasem318+p8agree@gmail.com
created_at         | 2026-07-28 10:29:34.36535+00
email_confirmed_at | 2026-07-28 10:31:19.108001+00
profile_rows       | 1
consent_rows       | 0        ← the precondition
```

Totals before the exercise: `auth.users` **21**, `profiles` **21**, `user_consents` **0**.

**On production the user reached `/app` with no gate at all** — pre-013 code — which is both
expected and a useful confirmation that the account really is in the un-consented state.

---

## §2. The gate fires on the preview

Signing the same account in on the preview:

- **The re-consent screen rendered**, at **`/app`** — the URL did not change, so it renders in
  place rather than redirecting (§7.3 failure mode 1 cannot occur).
- It named the exact revision it would record: **`terms_privacy@2026-07-26.1`**.
- The spacing fix from this branch is visibly live: the wordmark clears the heading.

---

## §3. "Agree and continue" — the last untested path

Clicked once.

**Result: the full application shell rendered on the preview** — header with the two-colour
wordmark, Home/Chat navigation, avatar, the calibration prompt, Today's check-in, Recent chats,
the Talk-to-Ren pill. **Silent success**: no toast, no confirmation banner. The app itself is the
confirmation, which is what the component's own docstring says it should be.

**The row it wrote:**

```
  consent_key  |      document_version      | decision |          decided_at
---------------+----------------------------+----------+-------------------------------
 terms_privacy | terms_privacy@2026-07-26.1 | granted  | 2026-07-28 10:32:36.057398+00
(1 row)

 rows_for_this_user
--------------------
                  1
```

- **Exactly one** row, `consent_key = 'terms_privacy'`, `decision = 'granted'`.
- `document_version` is **`terms_privacy@2026-07-26.1`** — a registry member, matching
  `apps/web/lib/consent/registry.ts:46` character-for-character (one occurrence in the file).
- `user_consents` went **0 → 1**; `window_readings` and `monitoring_sessions` unchanged.

**A second visit does not re-prompt.** A fresh load of `/app` rendered the shell, and so did the
**deep route `/app/account`** — the deep route matters because the gate lives in the layout every
authenticated route renders through.

---

## §4. Cleanup — mandatory and evidenced

Bounded by an explicit email `IN`-list rather than a `LIKE` pattern, so no other `+` address could
be caught.

```
SELECT count(*) AS user_consents_before FROM public.user_consents;
 user_consents_before
----------------------
                    1

DELETE FROM auth.users WHERE email IN ('mohamedasem318+p8agree@gmail.com');
DELETE 1

SELECT count(*) AS users_remaining FROM auth.users WHERE email IN ('mohamedasem318+p8agree@gmail.com');
 users_remaining
-----------------
               0

SELECT count(*) AS user_consents_after FROM public.user_consents;
 user_consents_after
---------------------
                   0

SELECT count(*) AS profiles_for_deleted_user FROM public.profiles WHERE id='90685018-13dd-4361-ab98-270999b90c43';
 profiles_for_deleted_user
---------------------------
                         0

          t          | count
---------------------+-------
 auth.users          |    20
 profiles            |    20
 user_consents       |     0
 window_readings     |   246
 monitoring_sessions |    28
```

**`DELETE 1`, and `user_consents` went 1 → 0 as a consequence**, as did the profile row. The
`ON DELETE CASCADE` on `user_consents.user_id` (`20260726000000_user_consents.sql:25`) is therefore
**verified, not assumed** — which matters because the immutability trigger covers UPDATE only and
`authenticated` has no DELETE grant, so this is a privileged operation by design.

**State is identical to the Stage 2/3 baseline: 20 / 20 / 0 / 246 / 28.**

---

## §5. State at the end of Stage 3b

- **The last untested path is now tested.** "Agree and continue" writes exactly one row, at the
  registry-resolved version, and the user reaches the app and is not re-prompted.
- **`user_consents` is empty again**, so the rollback script's destructive clause still has nothing
  to destroy. That remains true until a real user accepts.
- **T138 is still NOT closable**, and for the same clause as before — but the reasoning has
  changed materially. See `deploy-log-stage3-2026-07-28.md` §8 and the correction below.
- The database password used here **must be rotated** (Mohamed's stated intention when supplying
  it).

### ⚠ Correction to Stage 3 §8 — the positive control was invalid

Stage 3 concluded *"the channel is dead, not quiet"* from a deliberate failed sign-in that was
supposed to reach `console.error("[signIn] supabase error:", …)`.

**It never reached it.** `app/(auth)/login/actions.ts` returns at the invalid-credentials branch
(line 33) **before** the `console.error` at line 39. A wrong-password sign-in therefore logs
nothing at all, and the UI string Stage 3 cited — *"Those details didn't match an account."* — is
that early-return branch. The control emitted no line, so its absence proved nothing.

Mohamed's later dashboard check hit the same wall from the other side: the `POST /login` he
inspected **succeeded**, and a successful sign-in also logs nothing.

**Neither observation is evidence about the log channel.** What is now known:

- Request logging **works** — a `POST 200 /login` driven during this exercise appears in the Vercel
  dashboard with an empty `Messages` column, exactly as a request that emitted nothing should.
- Console capture **is plumbed** — the Logs UI carries a `Contains Console Level` facet with
  Warning / Error / Fatal counters and a per-request `Messages` column, which exist only because
  console output is captured and indexed by level.
- **Nothing has ever been emitted to confirm it end to end.** All three of `[signIn]`, `[signUp]`
  and `[completeOnboarding]` log **only** on their fallback branch, which needs a genuine backend
  fault to reach. An attempt to force it with a >72-character password (`signInSchema` is
  `min(1)` with no maximum) still returned invalid-credentials for a nonexistent user, so it
  returned early too.

**So the status is *unproven*, not *unreadable*.** Two follow-ups, and only the first is about
readability:

1. **Prove it** — one temporary `console.error("[probe] …")` on a reachable preview route, deploy,
   hit it, look, remove. Preview only, no production impact.
2. **A5 is not alertable regardless.** The Vercel account is **Hobby**: Log Drains are Pro+ and
   retention is short, so *"a sustained stream of FAIL-OPEN"* is something someone would have to
   happen to be watching. The smallest durable fix is for `failOpen()` to also write a row or bump
   a counter in Postgres, making "sustained stream" a SQL query that survives retention and needs
   no plan upgrade. Caveat: FAIL-OPEN fires *because* a consent read failed, so a total database
   outage would block that write too — but the modes the code comments name (RLS wrong after a
   migration, dropped grant, renamed column) are specific to the `user_consents` select under RLS,
   and a separate insert survives all three.

**(2) is the real pre-production item. It was never a logging problem.**
