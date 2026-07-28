# Contract — the three consent gates

**Feature**: 013-public-surface-and-legal | **Plan**: [../plan.md](../plan.md) §7 | **Evaluator**: [consent-evaluate.md](./consent-evaluate.md) | **Storage**: [../data-model.md](../data-model.md) §6.5

Three enforcement points, two consented texts, and **two deliberately opposite fail directions**. Section numbers are the plan's own; the full map is in `plan.md` §4.1.

| § | Gate |
|---|---|
| §7.1 | Signup gate — server-side |
| §7.2 | Camera / inference gate — **fails CLOSED** |
| §7.3 | App-shell entry gate — **fails OPEN**, highest blast radius |
| §7.4 | Existing users — never backfilled |
| §7.5 | Declining is not withdrawal |

---

## §7.1 Signup gate — server-side

**Enforcement point:** `apps/web/app/(auth)/signup/actions.ts`, inside `signUp()`, at the `signUpSchema.safeParse` step — **before** `supabase.auth.signUp` is reached. Both entry paths already funnel through this one function: `signUp()` (the react-hook-form path) and `signUpFromForm()` (the progressive-enhancement `<form action>` path used when JS has not loaded). One gate therefore covers the JS and no-JS paths, which is exactly why a client-side checkbox is not a gate and this is.

```ts
// lib/auth/schemas.ts
export const signUpSchema = z.object({
  email: z.string().email(),
  password: /* unchanged */,
  full_name: fullNameSchema,
  // FR-033: an active choice. Never pre-checked, never inferred from submission.
  accept_terms: z.literal("on", { message: "Please accept the Terms and Privacy Policy to continue." }),
  // The version the page RENDERED. Compared server-side; never trusted as the value to store.
  terms_privacy_version: z.string().min(1),
});
```

The action then:
1. rejects on a missing/false `accept_terms` with a field-scoped message (`{ status: "validation", field: "accept_terms" }`) — no account is created and the visitor is told why (Acceptance Scenario 1);
2. compares the submitted `terms_privacy_version` against `currentRevision("terms_privacy").versionId`. On mismatch it returns `{ status: "stale_terms" }` and the page re-renders with the **current** documents and an unchecked box. It refuses rather than mis-records;
3. passes **its own** resolved version id — not the form's — into `options.data`.

**Both documents reachable without losing form data (FR-034, Acceptance Scenario 2).** The links open in a **new tab**: `target="_blank" rel="noopener noreferrer"`, with an accessible name that says so ("Read the Privacy Policy (opens in a new tab)"). The signup form is never unmounted, so no field value is lost and no state has to be preserved anywhere — which matters, because `sessionStorage` is forbidden by FR-051 and a URL round-trip would put a password in a query string. `/terms` and `/privacy` are public routes outside `(authed)`, so they render for a signed-out visitor.

**FR-036** is satisfied by phase ordering: the gate ships in **P4**, which depends on **P3** (the real documents). The checkbox never exists in a build where the documents do not.

---

## §7.2 Camera / inference gate

**Where.** Three server components, each gating the *render* of the capturing child so that neither `getUserMedia` nor any capture code is ever mounted first (FR-038):

| Route | Gate placed | Capturing child withheld |
|---|---|---|
| `/onboarding` | `app/(onboarding)/onboarding/page.tsx`, after the auth guard | `<OnboardingForm>`'s anchor step → `<AnchorRecorder>` |
| `/app/calibrate` | `app/(authed)/app/calibrate/page.tsx`, after the role guard and `resolveCalibrateMode` | `<CalibrateRecorder>` |
| `/app/monitor` | `app/(authed)/app/monitor/page.tsx`, after the role guard | `<MonitoringSession>` |

See §0.5 for why `/onboarding` is in this list.

**The condition.** FR-037 fixes the *moment* ("first-ever calibration"); the *condition* is the consent record. `has_anchor(auth.uid())` — the existing scope-guarded status helper, already read on `/app/calibrate` and `/app` — continues to drive mode reconciliation and the ST-17 redirect, **unchanged**. No new "has this user ever calibrated" concept is invented. The gate itself asks one orthogonal question:

```ts
satisfiesConsent("camera_inference", heldVersionIdsFor(user))
```

For a first-ever calibrator this is always false, so the gate is presented before their first capture (FR-037). For a returning calibrator it is true, so it is not shown again (FR-040) — until the binding revision moves (FR-043a), at which point it is shown once more with the current wording and a **new** row is written (FR-043b).

**Fail direction: CLOSED.** If the consent read errors or returns null, the gate is **shown**. Worst case a consenting user answers once more, and the `UNIQUE (user_id, consent_key, document_version)` constraint plus `ON CONFLICT DO NOTHING` makes that a no-op rather than a duplicate. The alternative — capturing and inferring video with no recorded consent because a `SELECT` blipped — is the exact harm the gate exists to prevent.

**Declining blocks that scope and only that scope (FR-043c).** Calibration, anchor/baseline capture, and camera-based monitoring sessions become unavailable; nothing else changes. The **weekly work-environment check-in remains available** — it is text-only, it lives in `QuestionnaireCoordinator` on `/app`, and this feature does not touch `/app/page.tsx`'s render path or any questionnaire module. Proven two ways in §12.

---

## §7.3 App-shell entry gate — the highest blast radius in this feature

**Where.** `apps/web/app/(authed)/layout.tsx` — the single shell every authenticated route renders through. It already calls `getUser()` and reads `profiles`; the gate adds one owner-scoped `user_consents` read.

**How it blocks.** It **renders a different tree**, it does not redirect:

```tsx
if (gateEnabled && blocked) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <TermsReconsentScreen versionId={currentRevision("terms_privacy").versionId} />
    </div>
  );
}
return /* the normal Header + main + ChatPill shell */;
```

**Failure mode, stated explicitly.** A bug here locks out every user of the product. There are exactly two ways that happens:

1. **A redirect loop.** A gate implemented as `redirect("/consent")` can bounce forever if the destination is itself inside the gated group, or if the proxy and the layout disagree. **Eliminated structurally**: this gate never redirects and never touches `proxy.ts`. Rendering in place cannot loop.
2. **A read failure blocking everyone.** A transient Supabase error making `blocked` true for every request is a total outage. **Eliminated by failing OPEN**: `null`, an error, or an unreadable result ⇒ **not blocked**. This mirrors the repo's existing convention for `has_anchor` (banner shows only on an explicit `false`; a transient RPC failure never strands a user).

**Failing open must not fail silently.** A *transient* read failure is what fail-open is for. A *persistent* one — an RLS policy wrong after a migration, a grant dropped, a renamed column — silently disables the Terms gate for **every user**, with nothing on any surface to say so: the app looks perfectly healthy while a legal gate is off. The fail-open branch therefore emits a server-side log before returning the unblocked shell, identifying the gate by name and carrying the underlying error:

```ts
console.error("[consent-gate] FAIL-OPEN: terms_privacy gate disabled for this request", {
  userId: user.id, error,
});
```

`console.error` matches the repo's existing server-side error convention (`[signUp] supabase error:` in `app/(auth)/signup/actions.ts:55`) and surfaces in Vercel's function logs and in Sentry. The line is deliberately loud and greppable: one occurrence is noise, a steady stream is an outage of the gate. **Smoke test ST-10 induces the failure and confirms the log fires** — an unobservable failure mode is one nobody will notice, so it is verified, not assumed. Recorded in the risk table under **R2**.

**Why this gate fails open while the camera gate fails closed.** The question is what a failure costs. Failing open on Terms costs a user briefly reaching the app before acknowledging — and they meet the gate on their next navigation. Failing open on camera consent costs a video being captured and inferred with no recorded consent. Those are not comparable, so they get opposite defaults. Both directions are asserted by unit tests over the pure evaluator so neither can drift.

**FR-043d — a blocked user can still read both documents in full and sign out.** Guaranteed by construction, not by care:
- `/terms` and `/privacy` live in the **`(public)` route group**, outside `(authed)`. The gate is in `(authed)/layout.tsx` and therefore cannot run for them, at all.
- The blocked screen renders the existing `<SignOutButton>`; `signOut` is a server action in `app/(authed)/actions.ts`, invoked by POST, not gated by a layout render.
- The document links on the blocked screen open in a new tab, so the accept control is still there when the user returns.

**Revert and disable — two independent levers:**
1. **Revert.** The gate is confined to **one file** (`(authed)/layout.tsx`) plus pure modules with no other caller. It ships in **its own PR, last among the consent phases**, so `git revert <sha>` is clean and conflict-free and unwinds nothing else — not the schema, not the signup gate, not the camera gate.
2. **Disable.** `CONSENT_ENTRY_GATE_ENABLED` — a server-only boolean in `lib/env/schema.ts`, defaulting to `true`, read once in the layout. Flipping it to `false` in the Vercel environment panel and redeploying turns the gate off in about a minute without a code change. *(Honest caveat: a Vercel environment change requires a redeploy to take effect on a running deployment, so this is "fast", not "instant".)*

Both levers are exercised in **smoke test ST-10** before the feature merges to `main` — an untested kill switch is not a kill switch.

---

## §7.4 Existing users — never backfilled

No migration backfills a `user_consents` row for anyone (asserted by the static-parse gate: the migration contains no `INSERT INTO public.user_consents` **outside the `handle_new_user()` function body**, and no `INSERT … SELECT` sourcing `auth.users` or `public.profiles`). The one INSERT that does appear — inside `handle_new_user()` ([`data-model.md`](../data-model.md) §6.6) — fires only on auth-user creation and is therefore structurally incapable of writing a row for a user who already exists, so it satisfies FR-041 rather than violating it. The migration stays one file. Every existing user starts with **zero** consent records for both texts, which is the truth: they were never asked.

- **Terms/Privacy**: the shell gate presents once, on their next session. Accepting writes one row. Nothing existing is touched.
- **Camera/inference**: presented once, at their next arrival at a capture route. Existing readings, monitoring sessions, and accounts are untouched — this is a gate, not a deletion.

The same prohibition governs re-consent: an existing row is never rolled forward, re-stamped, or treated as covering a revision the user was never shown. Structurally enforced — the immutability trigger makes "re-stamping" impossible, and `document_version` is part of the uniqueness key so a later acceptance is always a **new** row.

---

## §7.5 Declining is not withdrawal

Nothing is deleted. No revocation or withdrawal state is written — none exists to write (`decision` admits only `'granted'`). No copy anywhere in this feature describes, promises, or implies an automated purge (FR-003, FR-043e): the 90-day reading retention is stated as a **policy**, it is time-based, it applies to every user regardless of consent status, and its purge job is BACKLOG **#86** — unslotted and explicitly not owned here.
