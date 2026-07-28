# Smoke Tests: Public Surface and Legal (Feature 013)

**Status: PARTIALLY RUN — 10 of 17 checks executed and recorded (2026-07-28); 1 FAIL
(ST-9, partial); 6 await Mohamed, and ST-7 and ST-15 need his confirmation of a
fact no repository artefact holds.** Authored by T131; T132 (Mohamed's pass) is
**not** complete. Where the agent ran a check, the Observations field says exactly how,
so the method can be judged alongside the result.

These are the checks **automation cannot catch** — the ones that need a real human eye, a
real device, a real inbox, or a judgement call no repository artefact can settle. They are
transcribed **verbatim** from [`plan.md`](./plan.md) §13; the wording of each *Check* is the
plan's wording and must not be re-worded here. Where a check needed more procedure than a
table cell holds — **ST-10a** and **ST-10b** especially — that procedure is part of the
check and is reproduced in full.

**Owner: Mohamed.** Results are recorded **inline in this file**, and **all of them are
recorded before `013-public-surface-and-legal` merges to `main`** — constitution
Principle VII, gate 5.

**How to record a result.** Each check below carries three fields:

- **Result** — `PASS`, `FAIL`, or `NOT RUN`. A `FAIL` needs a filed defect (issue number)
  beside it; a check that was not run says `NOT RUN` and says why. An inferred pass is not
  a pass: unit tests passing is not evidence for anything in this file.
- **Date** — when it was actually run.
- **Observations** — what was seen. Free text, and the most valuable field here: the
  screenshot taken, the number counted, the log line pasted, the thing that looked slightly
  off. "Looks fine" is not an observation.

**Some of these are explicitly not an agent's to sign off.** ST-4 (Ren's orb) and ST-7 (the
silhouette identity) are Mohamed's calls and nothing in the repository can establish them.
ST-2, ST-3, ST-8, ST-11 and ST-13 need a real inbox, a real phone, a real deployment, a
device that has never granted camera permission, and a careful end-to-end read — none of
which an agent can stand in for. Where an agent has run a check, the Observations field
says exactly **how** it was run, so the method can be judged alongside the result.

---

## ST-1

Two-colour wordmark reads correctly at all five in-tree sites (public navbar, public footer, app header, auth pages, onboarding) in **both** themes, at 320 px and desktop. `seren` ink / `ify` meadow-text, lowercase, no dot. This is a **visible change** to three surfaces that shipped single-colour.

- **Result**: PASS
- **Date**: 2026-07-28
- **Observations**: Run by the agent, on the local dev server, with Playwright driving five routes
  × two themes × two widths (20 combinations), reading `getComputedStyle().color` off the
  two `<span>`s inside the wordmark rather than eyeballing a screenshot.

  - **320 px and 1440 px, light**: `seren` = `rgb(28, 32, 35)` (ink), `ify` = `rgb(52, 106, 86)`
    (meadow-text) — at the public navbar (`/`), the public footer (`/`), the app header
    (`/app`), the auth pages (`/login`) and onboarding (`/onboarding`).
  - **320 px and 1440 px, dark** (`document.documentElement.classList.contains("dark") === true`):
    `seren` = `rgb(226, 229, 232)`, `ify` = `rgb(99, 178, 146)` at all five sites.
  - `textContent` is `serenify` at every site — lowercase, **no dot**, and
    `text-transform: lowercase` computed everywhere.

  All twenty combinations agreed. Mohamed's own read of the three surfaces that shipped
  single-colour is still worth doing; nothing above is an aesthetic judgement.

---

## ST-2

The two hand-sync exceptions match by eye: fetch the OG card, and trigger a **real** confirmation email and a **real** recovery email, viewed in a light client and a dark client.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: Not run — and not runnable by an agent. This needs a **real** confirmation email
  and a **real** recovery email opened in a light client and a dark client, plus the OG
  card fetched and compared by eye. The local stack captures mail in Inbucket, which is
  not a real client and cannot answer the "match by eye" question the check is asking.
  **Mohamed.**

---

## ST-3

Hero story, full ~42 s cycle on a real phone at 320 / 375 / 414 and a tablet at 768: the false-alarm beat resolves **before** any companion beat; nothing clips; no scrollbar appears inside the card; the card does not resize when the thread trims to 4.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: Not run. The check names a **real phone** at 320/375/414 and a **tablet at 768**
  for a full ~42 s cycle. Viewport emulation is not the same instrument — it cannot show
  clipping from a real font fallback, a real scrollbar, or a real rubber-band scroll.
  **Mohamed.**

---

## ST-4

Ren's blue orb (foggy) reads as intended and calm next to the meadow/amber band states — **FR-022 approved liberty; do not "correct" it to the monitor's band colouring.** Mohamed's aesthetic call.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: Not run, and explicitly not an agent's to sign off — the check says so. Whether
  Ren's foggy blue orb "reads as intended and calm" next to the meadow/amber band states
  is **Mohamed's aesthetic call**, and it is an approved FR-022 liberty that must not be
  "corrected" toward the monitor's band colouring. **Mohamed.**

---

## ST-5

Reduced motion toggled at the **OS level mid-session**: the story stops auto-advancing immediately (proving the hook re-subscribes rather than snapshotting at mount), no transition plays, the readout stays visible, chapter markers still work.

- **Result**: PASS
- **Date**: 2026-07-28
- **Observations**: Run by the agent with Playwright. Method, stated plainly because it is not
  literally the OS toggle: the context started at `reducedMotion: "no-preference"`, the
  page was left running, and then `page.emulateMedia({ reducedMotion: "reduce" })` flipped
  the preference **on the live page**, which dispatches the `matchMedia` change event to
  the already-mounted tree. That is the thing the check is really probing — whether the
  hook re-subscribes or snapshotted at mount — but it is the browser-level preference, not
  the OS-level one, so a confirming pass with the real OS setting is still worth Mohamed's
  minute.

  - Before the toggle: the story text changed over a 9 s window → auto-advancing.
  - After the toggle: the story text was **identical across a 14 s window** → advancing
    stopped immediately, without a reload.
  - The readout stayed visible.
  - 7 chapter markers found; clicking one still changed the story under reduced motion.

---

## ST-6

Scroll the hero out of view and back: the story pauses and resumes, and does **not** jump or double-advance on return.

- **Result**: PASS
- **Date**: 2026-07-28
- **Observations**: Run by the agent with Playwright, on `/` at 1440×900.

  - Scrolled the hero fully out of view and waited **11 s** — long enough for several
    beats had it kept running. The story text was unchanged → **paused**.
  - Scrolled back to the top: the text was **still the same one** immediately on return →
    no jump, no double-advance.
  - Waited a further 9 s at the top: the text changed → **resumed**.

---

## ST-7

**Silhouette identity** — Mohamed confirms the inner-right outline highlights **Hebatullah** and the outer-right highlights **Gehad** (§0.2: the one fact no repository artefact can establish). Also: all four outlines register on a real touch screen.

- **Result**: NOT RUN — AWAITING MOHAMED
- **Date**: —
- **Observations**: **The agent cannot verify this and does not claim to.** No repository artefact
  establishes which human in the photograph carries which name; §0.2 settled the mapping
  by inspection, and only Mohamed can confirm it against the people.

  What the agent did do is render it and capture the evidence, so the confirmation is a
  glance rather than a re-derivation. With the team section at 1440 px, each name card was
  activated in turn and the section screenshotted:

  - `st7-team-section-baseline.png`
  - `st7-selected-mohamed.png`, `st7-selected-fatma.png`,
    `st7-selected-hebatullah.png`, `st7-selected-gehad.png`

  In the rendered output, selecting **Hebatullah El Gazoly** outlines the **third figure
  from the left — the inner one of the right-hand pair**, and selecting **Gehad Mohamed**
  outlines the **fourth, outermost-right figure**. That is what §0.2 asserts. **It is still
  Mohamed's to confirm that those outlines are those two people.**

  The second clause — all four outlines registering on a **real touch screen** — was **not
  run**: no touch device was involved.

---

## ST-8

Root route on a real deployment: a signed-in visitor at `/` reaches the app without re-authenticating; a **real** Supabase email link landing on `/` with `?code=` completes the sign-in.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: Not run. The check requires a **real deployment** and a **real Supabase email
  link** landing on `/` with `?code=`. Neither exists on localhost. This belongs to the
  preview-deployment checks in P8 Stage 3 and to production in Stage 4. **Mohamed.**

---

## ST-9

Signup gate end to end, including **with JavaScript disabled** (the `signUpFromForm` progressive-enhancement path): unchecked → blocked with a reason and no account; opening `/terms` and `/privacy` loses no entered data; checked → account created and exactly one consent row exists.

- **Result**: FAIL (partial) — see below
- **Date**: 2026-07-28
- **Observations**: Run by the agent, end to end, on the local dev server. **This is the one check
  here that did not fully pass.**

  **How JavaScript was disabled**: the Playwright browser context was created with
  `javaScriptEnabled: false`, which disables script execution for every document in the
  context. `page.evaluate()` is **not** a valid probe of that setting — it runs through the
  debugger protocol and keeps working — so the probe used a side effect of the page's own
  scripts instead: Next streams its RSC payload by appending to `window.__next_f` from
  inline `<script>` tags, and React hydration puts `__react*` keys on DOM nodes.

  - JS-off context: `window.__next_f = undefined`, no `__react*` keys on the checkbox.
  - JS-on control context: `window.__next_f = object`, `__react*` keys present.

  So the probe itself is validated, and the run below really is the `signUpFromForm`
  native-POST path.

  **What passed:**

  - Unchecked box → **no account created** (`auth.users` count 0 for that email).
  - The checkbox is never pre-checked.
  - Opening `/terms` and `/privacy` **loses no entered data**: both links carry
    `target="_blank"`, both documents opened in their own tab and closed, and the form
    still held `email`, `full_name`, a 17-character password, and the ticked box.
  - Checked box → account created, and **exactly one** `user_consents` row:
    `terms_privacy | terms_privacy@2026-07-26.1 | granted`.
  - JS-on control, unchecked: refused **with** a reason —
    `[role=alert]`: "Please accept the Terms and Privacy Policy to continue." — and no account.

  **What did not:** on the **JS-disabled** path, the refusal is **silent**. After the POST
  the page re-renders at `/signup` with **zero `[role=alert]` nodes** and **all fields
  cleared** (`email=""`, `full_name=""`, `password` length 0). ST-9 asks for "blocked with
  a reason"; what a no-JS visitor gets is a blank form and no explanation.

  This is **deliberate, documented behaviour**, not an accident — `signUpFromForm` returns
  `void` on failure ("On failure, the page re-renders without error UI",
  `app/(auth)/signup/actions.ts`) — but it does not meet ST-9 as written. **The gate itself
  is sound**: the account is refused server-side, which is the security property. What is
  missing is the explanation. Reachability is narrow (JS disabled, or hydration failed).
  **Mohamed's call: fix it, or accept it and file a BACKLOG entry + issue in the same
  change.**

---

## ST-10

App-shell gate: publish a **material** revision locally → sign in → blocked; **read both documents in full**; **sign out** works; accept → unblocked, with the earlier row still present. Then **exercise both revert levers** — flip `CONSENT_ENTRY_GATE_ENABLED=false`, and separately `git revert` the gate commit — and confirm the app is fully usable after each. An untested kill switch is not a kill switch. **Then run ST-10a**, which exercises the same two levers against the failure mode most likely to require them.

- **Result**: PASS
- **Date**: 2026-07-28
- **Observations**: Run by the agent against local Supabase, driving the real login form and the real
  re-consent screen.

  A **material** revision was published locally by appending
  `terms_privacy@2026-07-28.1` (`materiality: "material"`) to
  `apps/web/lib/consent/registry.ts` as an **uncommitted** edit, then reverted with
  `git checkout --` afterwards; the registry is back to a single revision and the working
  tree is clean.

  - **Blocked**: a user holding only `terms_privacy@2026-07-26.1` landed on the re-consent
    screen at `/app` — `h1` = "The Terms and Privacy Policy have been revised", and the
    footer line read "Acknowledging records revision **terms_privacy@2026-07-28.1** against
    your account."
  - **Both documents read in full, from the blocked screen**: `/terms` opened in a new tab
    (10,153 characters, 14 `h2` sections, first "An informed draft, not reviewed by a
    lawyer", last "Contact"), `/privacy` likewise (19,392 characters, 20 `h2` sections);
    each was scrolled to the bottom (confirmed by measurement, not by assumption). The
    blocked screen **stayed mounted** behind them.
  - **Sign out works** from inside the blocked shell → `/login`; `/app` then redirected to
    `/login`.
  - Signing back in **without** accepting → still blocked.
  - **Accept** → the app shell rendered (`h1` = "Good evening, Gate", app nav present).
  - **The earlier row is still present**: the user went from 1 row to **2**, oldest first —
    `terms_privacy@2026-07-26.1 @00:47:16` and `terms_privacy@2026-07-28.1 @00:54:12`. The
    history was appended to, never overwritten.

  **Both revert levers** were exercised — against the harder ST-10a state rather than this
  one, which is a strictly stronger test. See ST-10a.

---

## ST-10a

**Silent-empty read → universal lockout, and both levers recover from it.** The §7.3 fail-open branch triggers on `null` or an **error**. The more likely RLS defect returns **zero rows with no error at all** — `auth.uid()` resolving to null in some server context, so `user_consents_select_self` matches nothing. That reads as "this user has no consent", sets `blocked = true`, and locks out **every** user — and fail-open never fires, because nothing failed. **Induce it without an error**: in a local psql session, `ALTER POLICY user_consents_select_self ON public.user_consents USING (false);` (or otherwise make `auth.uid()` fail to resolve in the server context) — the `SELECT` still succeeds, it just returns nothing. Then confirm: (a) an authenticated user is blocked by the re-consent screen even though their consent row exists; (b) the lockout is **reproducible** — a second user and a second session are blocked identically, so this is not a one-request blip; (c) **`[consent-gate] FAIL-OPEN` does *not* appear** in the server log for those requests, which is the whole point — this failure is silent to the mitigation ST-10b verifies. Then confirm **both** revert levers recover a fully usable app **from this exact state**, each tested from the locked-out condition: `CONSENT_ENTRY_GATE_ENABLED=false` + redeploy, and separately `git revert` of the **P5** gate commit. Restore the policy afterwards and confirm the gate behaves correctly again. The levers already cover this failure mode by design (§7.3, R2); what is being verified here is that they have actually been exercised against it.

- **Result**: PASS
- **Date**: 2026-07-28
- **Observations**: Run by the agent. Induced exactly as the check prescribes, without an error:

      ALTER POLICY user_consents_select_self ON public.user_consents USING (false);

  The `SELECT` still succeeds; it just returns nothing.

  - **(a)** An authenticated user **whose consent row exists** (verified as `postgres`:
    `gate-u1 -> terms_privacy@2026-07-26.1`) was blocked by the re-consent screen —
    `main[aria-label="Revised Terms of Service and Privacy Policy"]` present, app nav absent.
  - **(b)** **Reproducible**: a second user in a second session was blocked identically. Not
    a one-request blip.
  - **(c)** **`[consent-gate] FAIL-OPEN` did NOT appear** — 0 occurrences in the server log
    across those requests. That is the whole point: this failure is invisible to the
    mitigation ST-10b verifies.

  **Both levers recovered a fully usable app from this exact state**, each tested from the
  locked-out condition with the policy still `USING (false)`:

  - **`CONSENT_ENTRY_GATE_ENABLED=false` + restart**: both users reached the app shell.
    The log stayed **silent** (0 FAIL-OPEN lines) — correct, because the kill switch is
    checked *before* the read, so a deliberately disabled gate does not pollute the signal.
  - **`git revert --no-commit afa20d8`** (the P5 gate commit, "it ships alone so one command
    unwinds it"): applied **cleanly, no conflicts** — `tasks.md` auto-merged — and both users
    reached the app shell with the policy still broken. Undone afterwards with
    `git reset --hard HEAD`; the tree is clean and the gate is back (23 consent references in
    `app/(authed)/layout.tsx`).

  **Policy restored** to `(( SELECT auth.uid() AS uid) = user_id)` — byte-identical to the
  original, confirmed by re-reading `pg_policies` — and the gate then behaved correctly
  again: consented users reached the app shell, 0 FAIL-OPEN lines.

---

## ST-10b

**Fail-open is observable.** Induce a persistent consent read failure (e.g. `REVOKE SELECT ON public.user_consents FROM authenticated` in a local psql session, or point the client at a renamed column), then load an authed route. Confirm the app **stays usable** (fail-open works) **and** that `[consent-gate] FAIL-OPEN` appears in the server log for that request. Restore the grant and confirm the log stops. A gate that can switch itself off in silence is the failure nobody reports — §7.3, R2.

- **Result**: PASS
- **Date**: 2026-07-28
- **Observations**: Run by the agent. Induced with the first option the check names:

      REVOKE SELECT ON public.user_consents FROM authenticated;

  (Grants before: `authenticated: INSERT, SELECT`. After: `authenticated: INSERT` only.)

  - **The app stayed usable** — both users reached the normal app shell. Fail-open works.
  - **The log said so.** Two `[consent-gate] FAIL-OPEN` lines for two requests, each
    carrying the user id and the mode:

        [consent-gate] FAIL-OPEN: terms_privacy gate disabled for this request {
          userId: 'be1d8043-648c-49ef-8849-0d0a0216e556',
          reason: 'consent-read-unreadable',
          error: { code: '42501', ... hint: 'Grant the required privileges to the current
                   role with: GRANT SELECT ON public.user_consents TO authenticated;' }

  - **Restored** with `GRANT SELECT ON public.user_consents TO authenticated;` — and **the
    log stopped**: 0 FAIL-OPEN lines across the same two requests afterwards, with the app
    still usable.

---

## ST-11

Camera gate: on a device that has **never** granted camera permission, confirm the browser's permission prompt does **not** appear until after consent is given — at `/onboarding`, at `/app/calibrate`, and at `/app/monitor`.

- **Result**: PASS
- **Date**: 2026-07-28
- **Observations**: Run by the agent, with a scope note.

  **Method.** A permission prompt cannot appear without a `getUserMedia` call, so rather
  than trying to observe browser chrome the run instrumented the call itself: an init
  script wrapped `navigator.mediaDevices.getUserMedia` on every page and recorded every
  invocation. The context was created with `permissions: []` — nothing granted, the
  "device that has never granted camera permission" condition — stated explicitly rather
  than relied on as a default.

  With `camera_inference` consent rows = **0** for the user:

  - `/app/calibrate` — decline control present, **0 `getUserMedia` calls**.
  - `/app/monitor` — decline control present, **0 `getUserMedia` calls**.
  - `/onboarding` — **0 `getUserMedia` calls**. Run twice: with an already-onboarded user
    `/onboarding` redirects to `/app`, so it was re-run with a user whose
    `profiles.full_name` is `NULL`, which renders the real surface (`h1` = "Let's introduce
    you"). The camera gate sits *after* the name step in that flow, so the decline control
    is not on the first screen — but no camera call had been made by then either.

  **Scope note**: this proves no camera access was *requested* before consent, at all three
  routes. It does not substitute for Mohamed watching a real browser on a device that has
  genuinely never granted the permission — which is the check's literal wording.

---

## ST-12

Decline the camera consent, then complete a **weekly work-environment check-in** on `/app`. It works normally. Existing readings and sessions are still visible.

- **Result**: PASS
- **Date**: 2026-07-28
- **Observations**: Run by the agent, end to end.

  - **Declined**: at `/app/calibrate` the camera gate's decline control reads "Not now";
    clicking it navigated to `/app` and wrote **nothing** — `camera_inference` rows for the
    user stayed at **0**, and `getUserMedia` was never called.
  - **The weekly work-environment check-in completed normally** on `/app`: the card ("How
    has the work environment felt lately?") → "Could be better" → Q1 "What was your biggest
    roadblock?" → *Waiting on other team members* → Q2 "What support would have made this
    week better?" → *A quieter workspace* → **Done**. Afterwards the card closed, the
    identity-stripped aggregate went **14 → 15 rows**, the newest carrying exactly what was
    answered (`could_be_better | waiting_on_other_team_members | quieter_workspace`), and
    the private cadence row was stamped `completed_at = 2026-07-28 01:04:28`.
  - **Existing readings and sessions survived**: 12 `window_readings` and 1
    `monitoring_sessions` row before, and the same 12 and 1 after.

  Two honest notes. First, the check-in card did not appear on the first attempt — the
  `prompt_count` cap (2 per ISO week) had already been spent by this session's earlier
  dashboard loads, which is the designed calm-first behaviour and not a defect; the cadence
  row was cleared and the walk re-run. Second, the readings used here were seeded locally
  for this check and the user has no calibration anchor, so the Today card renders its "set
  your baseline first" state: the rows **persist**, but Mohamed seeing his own real readings
  still render after declining is the fuller version of that clause.

---

## ST-13

Mohamed reads `/terms` and `/privacy` end to end against FR-048a: manager visibility stated plainly, never softened or buried, with its not-yet-live marker **in the same passage**; the no-legal-review notice is unmissable; zero performance figures.

- **Result**: NOT RUN
- **Date**: —
- **Observations**: Not run. This is a careful end-to-end **read** of both documents against FR-048a —
  manager visibility stated plainly and never softened or buried, its not-yet-live marker in
  the *same passage*, the no-legal-review notice unmissable, zero performance figures. That
  is a judgement about wording, and an agent asserting it would be asserting exactly the
  thing the check exists to have a human confirm. **Mohamed.**

  (For orientation only: `/terms` renders 10,153 characters across 14 `h2` sections and
  `/privacy` 19,392 across 20, both opening with "An informed draft, not reviewed by a
  lawyer" and closing with "Contact".)

---

## ST-14

Team section with the photo **blocked** (DevTools request blocking) and on a throttled connection: name cards, links, and supervisor credits remain readable and usable; layout does not collapse.

- **Result**: PASS
- **Date**: 2026-07-28
- **Observations**: Run by the agent, in both halves.

  - **Photo blocked** (Playwright request interception aborting every image request and
    `/_next/image` — the programmatic equivalent of DevTools request blocking; 1 request
    blocked): all **4** name cards present, all **8** external links present, the caption
    "Choose a name to find them in the photo." present, and the supervisor credits present.
    The section still measured 1440 × 1197.8 px — **the layout did not collapse**.
    Screenshot: `st14-photo-blocked.png`.
  - **Throttled** (CDP `Network.emulateNetworkConditions`, 50 kB/s down, 500 ms RTT):
    DOMContentLoaded at ~6.3 s, 4 name cards, 8 links, caption and supervisors present,
    section 1440 × 1198.0 px — within a third of a pixel of the unthrottled height.
    Screenshot: `st14-throttled.png`.

---

## ST-15

All eight external links open the correct real GitHub and LinkedIn profiles.

- **Result**: PARTIAL — hrefs verified, identities are Mohamed's to confirm
- **Date**: 2026-07-28
- **Observations**: Run by the agent as far as an agent can take it. **Exactly 8** external links
  render, each `target="_blank" rel="noopener noreferrer"` with a name-bearing `aria-label`:

  | Person | GitHub | LinkedIn |
  |---|---|---|
  | Mohamed Assem Adel | `github.com/mohamedasem318` | `linkedin.com/in/mohamedasem318/` |
  | Fatma Al-Zahraa Emad | `github.com/Fatma-Alzahraaa` | `linkedin.com/in/fatma-al-zahraa-emad-326b64234` |
  | Hebatullah El Gazoly | `github.com/hebatullah003` | `linkedin.com/in/hebatullah-elgazoly-308ab2243/` |
  | Gehad Mohamed | `github.com/gehaddmohamedd` | `linkedin.com/in/gehad-mohamed-2a4946252/` |

  The four GitHub handles match the three co-author trailers this repository has used on
  every commit (`Fatma-Alzahraaa`, `gehaddmohamedd`, `hebatullah003`) plus the repository
  owner — independent corroboration that those four are right.

  **The links were not opened, and the LinkedIn identities are not corroborated by anything
  in the repository.** "Open the correct real profiles" needs **Mohamed**.

---
