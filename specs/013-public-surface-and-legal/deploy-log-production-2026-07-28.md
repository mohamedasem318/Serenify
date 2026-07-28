# Deploy Log — P8 Stage 4, production

**Feature 013 is live on `serenify.tech`.** This file is the **evidence**; `deploy-protocol.md` is
the procedure. Every check below was **exercised**, and where something was inferred rather than
observed, it says so.

| | |
|---|---|
| Merge | PR **#194**, squash-merged **2026-07-28T12:56:13Z** → `main` `124192a` |
| Production deployment | `dpl_AiMeacUNLYknQwkNvQ1yoS9MDWFR`, `source: git`, `main`, `124192a`, **READY** |
| Rollback armed throughout | Lever 0 → `npx vercel rollback dpl_Gi3noVxtWWXwwW7FzwVaP5RYxkQM` (= `cbb7f81`) |
| Execution split | Agent drove the browser and all read-only probes; **Mohamed performed every credential operation** (sign-in, signup, clicking the emailed link) and every hosted-database query. An agent may not create accounts or enter passwords. |

---

## §1. The order actually used, and why it is not the order P8 was written for

**Production builds from `main`, so merging IS the deploy.** Established from the Vercel API before
anything was done: `productionBranch: "main"`, no deploy hooks, and the last 13 production
deployments all `source: git` from `main`.

P8's phrasing implied *deploy → verify → merge*. **That order is not achievable here**, and the CLI
escape hatch does not buy it either: `vercel --prod` from the branch would produce a genuine
production deployment without merging, but the merge then rebuilds production from `main`, so the
artefact verified is not the artefact served. **Merging first is the only order in which they are
the same object.** Reasoning recorded in `deploy-protocol.md` §3 and `docs/DECISIONS.md`.

So the order used was: **merge → production builds → verify immediately, unbroken, with Lever 0
armed.** Mohamed's go covered both actions.

---

## §2. Public surface

**HTTP, from outside:**

```
200  1540ms  https://serenify.tech/          title="Serenify"           bytes=88015
200   463ms  https://serenify.tech/terms     title="Terms of Service"   bytes=76207
200   342ms  https://serenify.tech/privacy   title="Privacy Policy"     bytes=110113
200   253ms  https://serenify.tech/login     title="Sign in to Serenify" bytes=19558
```

**Signed-out routing** — every authenticated route refuses:

```
307  /app             -> /login
307  /app/calibrate   -> /login
307  /app/monitor     -> /login
307  /onboarding      -> /login
307  /app/account     -> /login
```

**The approved §10.3 copy, on the live site**, accumulated over a full ~50 s story cycle in a real
browser:

| String | Result |
|---|---|
| Hero lede | **PRESENT** verbatim |
| "Never" card heading | **PRESENT** verbatim |
| "Never" card body | **PRESENT** verbatim |
| Closing story beat | **PRESENT** verbatim |
| Footer `© 2026 Serenify` | **PRESENT** verbatim |

**The mock's three forbidden lines (`:442`, `:550`, `:772`): ALL ABSENT.**

> **Worth recording, because it would mislead the next person.** The **closing story beat is absent
> from the server HTML** — a `fetch` of `/` does not contain it, and a grep-based check would call
> it missing. It is rendered client-side as the story advances. It only appears once a real browser
> runs the story. **Verify that string with a browser, never with `curl`.**

**Console errors on `/`: NONE**, across the full story cycle.

**Responsive walk — 5 widths × 2 themes × 3 routes = 30 combinations, 0 failures.** Zero horizontal
overflow (`scrollWidth - clientWidth = 0`) at **320 / 375 / 414 / 768 / 1280** on `/`, `/terms` and
`/privacy`, in both themes, with the `dark` class correctly present or absent and real content
rendered (3,978–19,408 characters). Light `bg=rgb(234,235,236)`, dark `bg=rgb(16,18,20)`.

---

## §3. The Terms/Privacy gate — blocked state, verified BEFORE anything was accepted

An existing user (`omar.nabil@serenify.tech`, one of the 20 with no consent row) signed in.

**It renders in place. It does not redirect.**

| Route visited | URL after | What rendered |
|---|---|---|
| `/app` | **`/app`** — unchanged | the re-consent screen |
| `/app/account` | **`/app/account`** — unchanged | the re-consent screen |
| `/app/calibrate` | **`/app/calibrate`** — unchanged | the re-consent screen |
| `/app/monitor` | **`/app/monitor`** — unchanged | the re-consent screen |

**A different tree, not a hidden one.** On the deep route `/app/account` the accessibility tree
contained **exactly four interactive elements** — the two document links, *Agree and continue*, and
*Sign out*. **No account UI existed at all.** Same on all three capture routes: **no camera UI, so
`getUserMedia` is unreachable** — the camera gate failing closed, demonstrated per route rather than
inferred from one.

**The screen names the binding revision to the user**: *"Acknowledging records revision
`terms_privacy@2026-07-26.1` against your account."*

**Both documents are readable while blocked** — the check that matters most, since a gate that hides
what you are agreeing to is worse than no gate. `/terms` and `/privacy` both render fully for a
signed-in, un-consented user, each showing `terms_privacy@2026-07-26.1 · Published 26 July 2026`
and the *"An informed draft, not reviewed by a lawyer"* notice in a callout near the top. Visible
copy uses **monitoring session**, **calibration** and **weekly work-environment check-in** correctly.

---

## §4. Acceptance, and the row it wrote

Mohamed clicked *Agree and continue* (an agent may not accept legal terms on someone's behalf).

```
email                     | consent_key   | document_version           | decision | decided_at
--------------------------+---------------+----------------------------+----------+-------------------------------
omar.nabil@serenify.tech  | terms_privacy | terms_privacy@2026-07-26.1 | granted  | 2026-07-28 13:10:27.635575+00
(1 row)
```

**Exactly one row. A registry member** — `terms_privacy@2026-07-26.1`, matching
`lib/consent/registry.ts` character for character. `decision = 'granted'`. The app rendered
immediately afterwards.

That closes the chain end to end: **blocked → both documents readable → accepted → one row at the
registry-resolved version → app reached.**

---

## §5. Signup, ST-8, and the email subject

A throwaway (`mohamedasem318+p8prod@gmail.com`, `+` alias so the later `DELETE` binds exactly) was
created by Mohamed through **production's own `/signup`**.

**The signup consent gate, verified unauthenticated on production**: `accept_terms` input present,
`type="checkbox"` present, links to **`/terms`** and **`/privacy`** both present, copy reads
*"I have read and agree to the Terms of Service and the Privacy Policy."*

**Email subject: `Confirm your Serenify email`** — the repo wording. This **closes the outstanding
half of #189** (it previously read `Confirm your Serenify account`).

**The throwaway reached `/app` WITHOUT meeting the re-consent screen** — the signup-writes-a-consent-
row path confirmed at the UI level, since the gate was satisfied on first load.

**ST-8, both halves:**

- **Half 1** — a signed-in visitor at `/` reaches the app without re-authenticating. Navigated to
  `https://serenify.tech/`; landed on `/app`, still authenticated. Observed twice.
- **Half 2** — a real Supabase email link completed the sign-in. It did: the account went from
  unconfirmed to signed in at `/app` **by clicking the emailed link**.

> **Stated honestly: the intermediate `/?code=<real>` URL was NOT captured** — the screenshot was
> taken after the redirect settled. The routing was therefore proven **separately**, with a
> deliberately invalid code: `https://serenify.tech/?code=p8-invalid-probe` produced a final URL of
> `/app`, i.e. the `?code=` was **consumed and forwarded, not ignored** (the landing page did not
> render), and the existing session **survived the failed exchange**.

---

## §6. §6.4 baseline — the A5 detector's starting numbers

Window start = the merge, `2026-07-28T12:56:13Z`.

| §6.4 | Value |
|---|---|
| **(a)** signed in since deploy | **1** |
| **(b)** holding `terms_privacy@2026-07-26.1` | **1** |
| **(c)** **THE ALARM** — signed in, no consent row | **0 rows** |

**(b) equals (a); (c) is empty.** Everyone who has come back has consented. **A5 is not firing.**

**How to read this as people return**: (b) should climb toward (a). **(c) growing while (a) grows is
A5** — users reaching the app and writing nothing. One row in (c) is noise: a person sitting on the
re-consent screen without clicking *Agree*, or who signed out from it, looks identical to one who
slipped past a broken gate. **The signal is the trend, not any single row.** And it is **lagging** —
zero sign-ins means zero information, not good news.

---

## §7. The FAIL-OPEN log check — NO SIGNAL, not a pass

`npx vercel logs dpl_AiMeacUNLYknQwkNvQ1yoS9MDWFR` ran a **full 5-minute window** (ending in the
CLI's own `Command automatically interrupted after 5 minutes`) and returned **zero runtime log
lines**, despite four gated requests through the re-consent screen during it.

**This is a third consecutive empty window**, after the two Stage 3 recorded. **Record it as
no-signal, never as "no FAIL-OPEN occurred"** — absence of a channel is not absence of an event. It
independently confirms why §6.4 replaced the log-based A5 detector with the SQL one, and why **#192**
stays open.

---

## §8. Found during this verification

- **#198** — the signed-in dashboard says **"Start check-in" / "Today's check-in" / "No check-ins yet
  today"**, while the Terms 013 just shipped carefully distinguish a **monitoring session** (webcam)
  from a **weekly work-environment check-in** (questionnaire). **39 bare uses** in shipped copy.
  **Pre-existing** — `todays-checkin-card.tsx` last touched 2026-06-22 by feature 008 (`6ae3b1e`) —
  but 013 is what turns it into a visible contradiction between the product and its own legal text.
- **A session-refresh race, not logged as an issue on two observations.** Twice, a navigation
  transiently bounced to `/login` and rendered an empty state, then recovered on the next
  navigation. **Not 013**: `proxy.ts` is byte-identical to `main` (`git diff` empty), and the shell
  gate **fails open**, so it can never produce a sign-in page. Shape fits cookie propagation lagging
  the first server render. Recorded here rather than filed, because two sightings is thin.
- **The public navbar shows "Sign in / Sign up" to a signed-in user** on `/terms` and `/privacy`.
  From the re-consent screen those open in a new tab, so a user mid-acceptance may think they have
  been signed out. Cosmetic.

---

## §9. Throwaway cleanup — bounded, evidenced, cascade demonstrated

Bounded by an explicit email `IN`-list rather than a `LIKE` pattern, so **no other `+` address
could be caught** — the same discipline Stage 3b used.

```sql
-- 1. before
SELECT count(*) AS consents_before FROM public.user_consents;
 consents_before
-----------------
               2

-- 2. the row the SIGNUP wrote — captured BEFORE the delete, because it is gone afterwards
SELECT u.email, c.consent_key, c.document_version, c.decision
  FROM public.user_consents c JOIN auth.users u ON u.id = c.user_id
 WHERE u.email IN ('mohamedasem318+p8prod@gmail.com');

 email                            | consent_key   | document_version           | decision
----------------------------------+---------------+----------------------------+----------
 mohamedasem318+p8prod@gmail.com  | terms_privacy | terms_privacy@2026-07-26.1 | granted
(1 row)

-- 3. delete
DELETE FROM auth.users WHERE email IN ('mohamedasem318+p8prod@gmail.com');

-- 4. the account is gone
SELECT count(*) AS users_remaining FROM auth.users
 WHERE email IN ('mohamedasem318+p8prod@gmail.com');
 users_remaining
-----------------
               0

-- 5. and so is its consent row — 2 became 1, not 2
SELECT count(*) AS consents_after FROM public.user_consents;
 consents_after
----------------
              1
```

**Two things this proves, neither assumed:**

1. **The signup path writes a consent row**, at a **registry member** version
   (`terms_privacy@2026-07-26.1`), `granted`, exactly one — captured at the database before the
   delete, not inferred from the UI.
2. **`ON DELETE CASCADE` works.** `user_consents` went **2 → 1** when the `auth.users` row was
   deleted. The consent row was removed *as a consequence*, never targeted directly — which matters,
   because the immutability trigger covers UPDATE only and there is **no DELETE policy or grant for
   `authenticated`**. This is a privileged operation by design.

**The remaining row is `omar.nabil@serenify.tech`'s, and it stays.** It is a real acceptance by a
real person. **No real user's account was touched at any point** — the only deletion was the
throwaway, bounded to one address.
