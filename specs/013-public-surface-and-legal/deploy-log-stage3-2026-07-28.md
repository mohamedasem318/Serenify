# Deploy Log — P8 Stage 3, the preview exercise (T138)

**This file records what actually happened, verbatim.** It is the sibling of
`deploy-log-2026-07-28.md`, which covers Stage 2 (backup + migration). That file is the
evidence for T136/T137; this one is the evidence for **T138**, the abort point.

| | |
|---|---|
| **Date** | 2026-07-28 |
| **Branch** | `013-public-surface-and-legal` @ `4084373` |
| **Deployment under test** | `dpl_4EgXCQTAwL5hFTZftB184GPEa1uV` — the Vercel status attached to `4084373` |
| **Preview URL** | `serenify-ga3mr9q7z-mohamed-asems-projects-7436e57f.vercel.app` |
| **Branch alias** | `serenify-git-013-public-6afce8-mohamed-asems-projects-7436e57f.vercel.app` |
| **Database** | hosted `excukdzjudslbqmkysrc` — **production**, confirmed from the preview's own env |
| **Execution split** | Every hosted-authenticating command run by **Mohamed**, output pasted back. Browser exercise driven by the agent through Chrome (the preview sits behind Vercel Deployment Protection; Mohamed's Chrome carries the SSO session). |
| **Scope** | Stage 3 only. **No production deploy. Nothing merged. No issues closed.** |

---

## §0. The preview is the right target — established before anything was created

Read-only, all of it.

| Fact | Value | Why it matters |
|---|---|---|
| Deployment ↔ commit | `dpl_4EgXCQTAwL5hFTZftB184GPEa1uV` is the Vercel commit status on `4084373` | "the preview" is not ambiguous |
| Supabase target | `NEXT_PUBLIC_SUPABASE_URL=https://excukdzjudslbqmkysrc.supabase.co` (Preview scope) | real code against the real production store, as T138 requires |
| `CONSENT_ENTRY_GATE_ENABLED` | **absent from Preview *and* Production** | absent means **enabled** (`lib/env/schema.ts`) — the gate was genuinely on |
| `SITE_URL` | **set in Preview scope**, `https://serenify.tech` | see §5 |
| `mailer_autoconfirm` | `false` | confirmation is required; a session needs the email |

The agent held **no** hosted credential. `apps/web/.env.local` points at local Supabase
(`http://127.0.0.1:54321`) with the `supabase-demo` service-role key, so the Stage 2
operator-runs-hosted-commands split continued unchanged.

---

## §1. The negative case — run FIRST, because it creates nothing

Submitted the preview's own `/signup` with a valid name/email/password and the
acknowledgement box **unchecked**.

**Result**: refused inline — *"Please accept the Terms and Privacy Policy to continue."* —
still on `/signup`, no check-email panel.

```
 must_be_zero
--------------
            0
(1 row)
```

Zero rows for `mohamedasem318+p8stage3neg@gmail.com`. **The unchecked box created no account.**

---

## §2. T138 — the throwaway signup on the preview

Created through the **preview deployment's own `/signup` page**, not the API and not the
dashboard. Before submitting, the form's own state was read back:

```
terms_privacy_version = "terms_privacy@2026-07-26.1"
accept_terms          = "on"
```

— i.e. the page rendered the **registry** value into the hidden field, and the checkbox was
genuinely present in `FormData` (not merely visually ticked).

**Hosted verification, verbatim:**

```
-[ RECORD 1 ]------+-------------------------------------
id                 | ece56852-fb8d-40ed-92c7-e613039c4ed7
email              | mohamedasem318+p8stage3@gmail.com
created_at         | 2026-07-28 08:14:14.563199+00
email_confirmed_at |
profile_rows       | 1
consent_rows       | 1

  consent_key  |      document_version      | decision |          decided_at
---------------+----------------------------+----------+-------------------------------
 terms_privacy | terms_privacy@2026-07-26.1 | granted  | 2026-07-28 08:14:14.562855+00
(1 row)

          t          | count
---------------------+-------
 auth.users          |    21
 profiles            |    21
 user_consents       |     1
 window_readings     |   246
 monitoring_sessions |    28
```

- **Exactly one** consent row, `consent_key = 'terms_privacy'`.
- `document_version` is `terms_privacy@2026-07-26.1` — a **registry member**, matching
  `lib/consent/registry.ts` character-for-character.
- `decided_at` precedes `created_at` by ~344µs: same transaction, the trigger firing inline.
- `auth.users` 20→21 and `profiles` 20→21; `window_readings` and `monitoring_sessions`
  **unchanged** from the Stage 2 baseline.

---

## §3. The session, and the app

The emailed **6-digit OTP was entered on the preview's own form** — deliberately, rather than
clicking the link, because the link lands on production (§5) and would not put a session on
the preview.

**`990020` → "✓ Verified".** Session established on the preview.

**`/app` rendered the full application shell** — header with wordmark, Home/Chat navigation,
avatar, the calibration prompt, the weekly work-environment check-in card. **The app-shell
gate did not block the consented user.**

---

## §4. The camera gate still fails closed

Same user — holds `terms_privacy` consent, holds **no** `camera_inference` consent.

Navigating to `/app/calibrate` rendered **"Before the camera turns on"** — the
camera-and-inference consent screen — instead of the capture UI, with *"Allow camera and
inference"* / *"Not now"* and the line *"Declining records nothing and deletes nothing."*

**The camera never turned on.** This is the opposite default from the shell gate, which is
the point: failing open on Terms costs a user briefly reaching the app; failing open on
camera costs a video captured with no recorded consent.

**"Allow camera and inference" was deliberately not clicked** — it would have written a
second consent row to production, and it is outside T138's scope.

---

## §5. The confirmation link points at serenify.tech — proven from the email

```
https://excukdzjudslbqmkysrc.supabase.co/auth/v1/verify
  ?token=pkce_…&type=signup&redirect_to=https://serenify.tech/auth/callback
```

`redirect_to=https://serenify.tech/auth/callback`. **Not `localhost`.** `SITE_URL` is scoped
to Preview and holds the production origin, and `signUp` builds
`emailRedirectTo: ${siteUrl}/auth/callback`.

**Carry this into Stage 4.** A preview confirmation link lands on **production**, which runs
pre-013 code. It confirms the account but cannot exercise the gate — which is exactly why the
OTP path, not the link, is the one that tests a preview.

### The OTP question, open for two days: the code works

Two of three codes were accepted on the preview form (`990020`, and `914706` for the second
throwaway). One code (`817733`) was rejected with *"That code didn't match."* The rejection is
**consistent with** the token having been superseded by a regenerated confirmation for the same
address, but that was **not proven** and is recorded here as unexplained rather than diagnosed.

The load-bearing finding stands: **the emailed code works against hosted**, unlike local.

---

## §6. The re-consent path — the one 20 real people will take

The second throwaway was created through **`serenify.tech`'s own signup form**. Production
runs pre-013 code, whose `/signup` has **no acknowledgement checkbox and no Terms/Privacy
links** — so it sends no `terms_privacy_version`, the `?` guard skips, and the account lands
with **no consent row** by construction. That is precisely the state all 20 existing accounts
are in. No real user's account was used.

Signing that user in on the preview:

```json
{
 "url": "https://serenify-ga3mr9q7z-…vercel.app/app",
 "pathname": "/app",
 "appShellPresent": false,
 "headerAvatarPresent": false,
 "hasSignOut": true,
 "revisionLine": "Acknowledging records revision terms_privacy@2026-07-26.1",
 "links": [
  {"t":"Terms of Service","href":"/terms","target":"_blank","rel":"noopener noreferrer"},
  {"t":"Privacy Policy","href":"/privacy","target":"_blank","rel":"noopener noreferrer"}
 ]
}
```

- **Rendered in place.** `pathname` is still `/app` — the URL does not change.
- **No redirect.** The app shell is *absent* (`appShellPresent:false`), so this is a different
  tree, not a bounce to another route. §7.3's failure mode 1 cannot occur.
- The screen names the exact revision it will record: `terms_privacy@2026-07-26.1`.

**Both documents readable in full, fetched with the *blocked* user's own session:**

```json
[{"p":"/terms","status":200,"redirected":false,"finalUrl":"/terms",
  "title":"Terms of Service","headings":14,"chars":55918,"gateLeaked":false},
 {"p":"/privacy","status":200,"redirected":false,"finalUrl":"/privacy",
  "title":"Privacy Policy","headings":20,"chars":84058,"gateLeaked":false}]
```

`gateLeaked:false` confirms FR-043d **empirically** — `/terms` and `/privacy` live in the
`(public)` route group, so the gate cannot run for them — rather than by reading the route map.

**Sign out from the gate works**: → `/login`, unauthenticated.

> **Not exercised: "Agree and continue".** It is outside the clauses T138 lists and would have
> written another production consent row. It is nonetheless the single action every one of the
> 20 users will take on deploy day, and **Stage 4 should decide whether it is covered.**

---

## §7. The responsive walk, on the preview

**Method, recorded because it is not the project's usual harness.** The preview sits behind
Vercel Deployment Protection, so Playwright cannot reach it, and this Chrome's window resize is
a no-op (viewport stayed 1920 regardless). The walk was therefore driven through
**script-opened popup windows**, which Chrome sizes exactly at open time (`resizeTo` afterwards
is unreliable and its readings were discarded). Widths were opened at *target + 15px* so the
**layout viewport** — what media queries match — lands exactly on target, matching Playwright's
convention. Every row below reports its measured `clientWidth`, so the calibration is auditable.

`hOverflow = scrollWidth − clientWidth`. **0 means no horizontal overflow.**

| Route | Theme | clientWidth | scrollWidth | hOverflow | `dark` class | renders |
|---|---|---|---|---|---|---|
| `/` | dark | 320 | 320 | **0** | true | ✓ |
| `/` | light | 320 | 320 | **0** | false | ✓ |
| `/` | dark | 375 | 375 | **0** | true | ✓ |
| `/` | light | 375 | 375 | **0** | false | ✓ |
| `/` | dark | 414 | 414 | **0** | true | ✓ |
| `/` | light | 414 | 414 | **0** | false | ✓ |
| `/` | dark | 768 | 768 | **0** | true | ✓ |
| `/` | light | 768 | 768 | **0** | false | ✓ |
| `/` | dark | 1280 | 1280 | **0** | true | ✓ |
| `/` | light | 1280 | 1280 | **0** | false | ✓ |
| `/terms` | dark | 320 | 320 | **0** | true | ✓ |
| `/terms` | light | 320 | 320 | **0** | false | ✓ |
| `/privacy` | dark | 320 | 320 | **0** | true | ✓ |
| `/privacy` | light | 320 | 320 | **0** | false | ✓ |

The `dark` column flips true→false per pair, so the theme genuinely changed rather than the
page being sampled twice in one theme. `renders` = the expected `<h1>` / `<title>` was present.

---

## §8. ⚠ THE ONE CHECK THAT COULD NOT BE MADE — `[consent-gate] FAIL-OPEN`

**`vercel logs` returned zero runtime log lines across two full 5-minute windows**, covering
the signup POST, the `/app` renders and a deliberate 404 probe.

That silence was **not** accepted as a pass. A **positive control** was run: a deliberate
failed sign-in, which reaches
`console.error("[signIn] supabase error:", …)` (`app/(auth)/login/actions.ts:39`) and
demonstrably executed server-side — the UI returned *"Those details didn't match an account."*
**The control line never appeared either.**

**The channel is dead, not quiet.** Absence of `FAIL-OPEN` from a stream that also drops a
known-emitted line is not evidence of anything.

> **T138's clause "the server log shows no `[consent-gate] FAIL-OPEN` line" is therefore
> UNMET, and T138 has NOT been marked `[X]`.**

**To close it**: Vercel dashboard → deployment `dpl_4EgXCQTAwL5hFTZftB184GPEa1uV` → Logs,
window ≈ **08:12–08:40 UTC 2026-07-28**. Search `FAIL-OPEN` (expect none) **and** `[signIn]`
(expect ≥1 — the control). If `[signIn]` is absent there too, the dashboard is equally blind
and a **log drain is needed before production**, because A5 ("a sustained stream of FAIL-OPEN")
is otherwise an unobservable abort condition.

---

## §9. Cleanup — mandatory and evidenced

Both throwaway accounts deleted from production via a privileged path. Bounded by an explicit
email `IN`-list rather than a `LIKE` pattern, so no other `+` address could be caught.

```
postgres=> SELECT count(*) AS user_consents_before FROM public.user_consents;
 user_consents_before
----------------------
                    1
(1 row)

postgres=> DELETE FROM auth.users
 WHERE email IN ('mohamedasem318+p8stage3@gmail.com',
                 'mohamedasem318+p8reconsent@gmail.com');
DELETE 2

postgres=> SELECT count(*) AS users_remaining FROM auth.users
 WHERE email IN ('mohamedasem318+p8stage3@gmail.com',
                 'mohamedasem318+p8reconsent@gmail.com');
 users_remaining
-----------------
               0
(1 row)

postgres=> SELECT count(*) AS user_consents_after FROM public.user_consents;
 user_consents_after
---------------------
                   0
(1 row)

postgres=> SELECT 'auth.users' AS t, count(*) FROM auth.users
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'user_consents', count(*) FROM public.user_consents
UNION ALL SELECT 'window_readings', count(*) FROM public.window_readings
UNION ALL SELECT 'monitoring_sessions', count(*) FROM public.monitoring_sessions;
          t          | count
---------------------+-------
 auth.users          |    20
 profiles            |    20
 user_consents       |     0
 window_readings     |   246
 monitoring_sessions |    28
(5 rows)
```

**`DELETE 2`, and `user_consents` went 1 → 0 as a consequence of deleting the auth users.**
The `ON DELETE CASCADE` on `user_consents.user_id`
(`20260726000000_user_consents.sql:25`) is therefore **verified, not assumed** — which matters
because the immutability trigger covers UPDATE only and `authenticated` has no DELETE grant, so
this is a privileged operation by design.

**State is identical to the Stage 2 baseline: 20 / 20 / 0 / 246 / 28.**

---

## §10. State at the end of Stage 3

**Hosted runs the new schema and holds ZERO consent rows. `serenify.tech` still runs pre-013
code.** Unchanged from the end of Stage 2.

- **No abort signal was encountered.** The T138 signup behaved correctly on every clause that
  could be verified; the single unmet clause is an *observability* gap (§8), not a defect in
  the signup.
- **Rollback remains unusually cheap** — `user_consents` is empty again, so the rollback
  script's destructive clause has nothing to destroy. That stops being true the moment a real
  user accepts.
- Both revert levers unchanged and still available (`deploy-protocol.md` §2). Lever 1 is the
  kill switch (`CONSENT_ENTRY_GATE_ENABLED=false` **plus a redeploy**; absent means *enabled*;
  a typo fails the boot). Lever 2 is `git revert afa20d8`.
- The Stage-2 gap expectation still applies: **if migration→code exceeds 72 hours, re-run
  `deploy-protocol.md` §5 steps 8–11** before deploying code.

**Open at the end of Stage 3:**

1. **§8** — the `FAIL-OPEN` observability gap. Blocks marking T138 done.
2. **§6** — "Agree and continue" unexercised; Stage 4 to decide.
3. **T132** remains open deliberately — ST-2, ST-3 and ST-13 are the human owner's and gate
   Stage 4, not Stage 3.

**Not done, deliberately**: any production deploy, any merge to `main`, T139/T140 issue
closures.
