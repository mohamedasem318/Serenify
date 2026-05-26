# Changelog

This file records material amendments to feature specs discovered
during planning or implementation, per Constitution Principle VIII.
Entries are append-only.

## 2026-05-17 — spec(001-auth-and-roles) amendment

- Replaced "Team" entity with direct-manager hierarchy
  (`profiles.manager_id` self-FK).
- Onboarding reduced to `full_name` only.
- Skip-level per-employee visibility explicitly forbidden going forward.

Rationale: the privacy model in `PROJECT_SYSTEM_PROMPT.md` requires
direct-manager + skip-level-aggregates-only. Teams as a separate layer
add access-control surface without serving any current privacy
invariant. Teams may return later as a pure grouping concept if
reporting features need them.

## 2026-05-17 — spec(001-auth-and-roles) amendment

- Added FR-020: OTP entry fallback for signup confirmation and
  password reset.
- Added FR-021: Theme toggle on all unauthenticated auth surfaces.

Rationale: Smoke testing revealed (a) Supabase emails ship with both
a magic link and a 6-digit OTP, and the latter currently has no
consumption path in the app — users whose link breaks or arrives
sluggishly are stuck; (b) the existing theme toggle on authed surfaces
makes its absence on the auth surfaces (/login, /signup,
/forgot-password, /reset-password) feel like an oversight rather than
a deliberate design choice, especially since Constitution Principle VI
treats light/dark as equal-priority.

## 2026-05-17 — constitution(V) — display font: Instrument Serif → DM Serif Display
The design token `--font-display` was already swapped on the implementation side (DECISIONS.md entry "Lock display font to DM Serif Display"). The constitution is brought into alignment with the implementation.

## 2026-05-18 — Feature ordering reshuffle

Two reorderings, both because the original ordering put consumers before
their dependencies:

- **005 ↔ 006**: per-user-calibration now precedes stress-inference-service.
  The constitution requires predictions to be deltas from a per-user
  baseline; inference has nothing to subtract from until calibration ships
  first.
- **010/011/012**: privacy-controls-and-transparency moves to 010, ahead of
  the two manager dashboards (now 011 team-lead, 012 admin). The privacy
  slider and visibility-scope rules determine what data the dashboards
  are allowed to query; building them against placeholder defaults would
  force rework when privacy lands.

No code or specs affected — only 001 has shipped; the rest were names in
a list.

## 2026-05-19 — spec(003-employee-dashboard-shell) — Out-of-Scope bullet superseded by hotfix `8dc822b`

`specs/003-employee-dashboard-shell/spec.md` (committed as `f4a1218`,
review-edited through `5de64d2`) contains an Out-of-Scope bullet
naming the `/login?error=expired_link` notice bug as a separate
hotfix branch off `main`, with a recon step before the branch opens.

That hotfix shipped between spec commit and `/speckit.plan`:

- `0acb0e1` — `fix(001): render expired-link notice on /login`
- `8dc822b` — merge of PR #2 onto `main`
- The `003-employee-dashboard-shell` branch's merge-base with
  `main` is `8dc822b`, confirming the branch is rebased onto
  post-hotfix `main`.

The bullet is therefore stale: the bug it points at is fixed, and
the recon step is unnecessary. **The committed spec is NOT
modified.** This entry records the supersession per Principle VIII
(spec amendments live in CHANGELOG, not in retroactive edits to
the spec).

`docs/BACKLOG.md` will be updated during feature 003's
`/speckit.implement` step 13 (smoke tests) to reclassify the
expired-link entry as `merged`.

## 2026-05-20 — feat(003-employee-dashboard-shell) — Tailwind v4 @theme inline contract corrected: `--color-*` prefix required for shadcn utility-class generation

Discovered during T019 verification: shadcn primitives' Tailwind
class names (`bg-destructive`, `text-foreground`, `bg-primary`, etc.)
resolved to no CSS rule, leaving `<Button variant="destructive">`
rendered with transparent background. A computed-style probe on
`<html>` returned empty strings for `--destructive`, `--background`,
`--color-destructive`, and `--color-background`. A stylesheet grep
for `bg-destructive` and related selectors returned zero matches
across all loaded sheets.

Root cause: the original `@theme inline` mapping shape (R-2 /
Decision B) registered shadcn tokens as **unprefixed** names
(`--background`, `--destructive`, etc.). Tailwind v4 generates color
utility classes only from tokens that match the **`--color-*`
prefix** in `@theme` blocks. The unprefixed shape declared the
variables but generated no utility classes, so shadcn primitives
rendered unstyled. The same prefix rule applies to `--radius-*` for
the `rounded-{sm,md,lg,xl,2xl,3xl,4xl}` utility ladder — the single
`--radius: var(--radius-control)` declaration that T017 shipped
left `rounded-md` (used by button.tsx) unstyled too.

Correction (single commit):

- `apps/web/app/globals.css` — all 19 entries in `@theme inline`
  renamed to use `--color-*` prefix on the shadcn side. RHS stays
  `var(--color-bg)`, `var(--color-crimson)`, etc. — preserving the
  var-chain to Mist & Meadow tokens. 7-step radius ladder added
  in the same block: `--radius-sm` (6px), `--radius-md`
  (`var(--radius-control)` = 8px), `--radius-lg`
  (`var(--radius-card)` = 12px), `--radius-xl` (16px),
  `--radius-2xl` (20px), `--radius-3xl` (24px), `--radius-4xl`
  (28px). T017's header comment block updated to document the
  prefix convention and the load-bearing role.
- `specs/003-employee-dashboard-shell/contracts/shadcn-mapping.md`
  — all 19 mapping rows renamed; radius-ladder rows added; three-
  load-bearing-choices annotation updated; canonical
  implementation block updated; verification checklist gets two
  new computed-style probes (`background-color` on destructive
  button; `border-radius` on default button). The load-bearing
  prefix convention is called out explicitly so future
  contributors don't strip it.
- `specs/003-employee-dashboard-shell/plan.md` Decision B — same
  row updates; radius ladder added below the color table; load-
  bearing prefix note inserted; destructive/primary-foreground/muted
  prose paragraphs updated to use `--color-*` token names.
- `specs/003-employee-dashboard-shell/research.md` — new R-2.1
  section appended documenting the discovery sequence, the
  symptom evidence (transparent button, empty getPropertyValue,
  zero stylesheet matches), the prefix correction, and the
  authoritative reference (shadcn 4.7.0's own init emission used
  the same `--color-*` shape). R-2's original analysis preserved
  verbatim as historical context.
- `specs/003-employee-dashboard-shell/tasks.md` — T017 description
  amended with a one-line addendum about the prefix convention;
  T020 description amended with computed-style verification probes.

Authoritative reference: shadcn 4.7.0's own `init` emission
(observed before the rollback in commit `89995aa`) followed the
same `--color-*` prefix pattern — confirming the convention is part
of the shadcn-on-Tailwind-v4 contract.

Post-commit verification: re-running the same probes that surfaced
this bug — destructive button MUST render with crimson background
and bg-colored text; `--color-destructive` and `--color-background`
MUST resolve to real values on `:root` computed style; `rounded-md`
MUST resolve to a real border-radius (not 0).

This is a contract amendment, not a decision change. Decisions A/B/E
intent is unchanged — shadcn primitives consume Mist & Meadow tokens
through the var() chain, with no parallel oklch palette. The
amendment corrects the contract's mapping shape to match Tailwind v4
/ shadcn 4.x's prefix convention.

## 2026-05-20 — feat(003-employee-dashboard-shell) — FR-042 scope clarification: red permitted on destructive action surfaces only

FR-042 originally banned red anywhere in the UI. This amendment
narrows the ban to **in-product affective and ambient surfaces** —
stress detection states, physiological indicators, charts, status
badges, notifications, and any in-product affective copy or imagery.
Red IS permitted on **destructive action surfaces** — delete-account,
leave-team confirmations, revoke-session, and inline destructive text
links — using the Mist & Meadow `crimson` token, because hiding
visual urgency on irreversible user actions is hostile design.

Introduces a new Mist & Meadow token, `--color-crimson` — a washed
red in the same low-saturation tonal family as `--color-amber`.
Values: light `#7B4244`, dark `#C17F81`.

Maps shadcn `--destructive` → `--color-crimson` (was `--color-amber`),
and `--destructive-foreground` → `--color-bg` (symmetric across modes,
same WCAG-AA pattern as `--primary-foreground`).

Affected artifacts, all updated in this commit:

- `.specify/memory/constitution.md` Principle V — palette amended,
  red-rule clarified, version bumped `1.0.0 → 1.1.0` (MINOR per
  Governance: palette addition + scope clarification of an existing
  rule). Sync Impact Report appended with amendment record.
- `docs/DECISIONS.md` — formal architectural decision entry.
- `specs/003-employee-dashboard-shell/plan.md` Decision B — mapping
  table updated; `--destructive` row remapped; `--destructive-foreground`
  row added; load-bearing-choices reference at line 1139 updated.
- `specs/003-employee-dashboard-shell/contracts/shadcn-mapping.md` —
  table updated; `--destructive-foreground` moved out of notes into
  the table proper; canonical implementation block updated to
  crimson + destructive-foreground pair.
- `specs/003-employee-dashboard-shell/tasks.md` — DECISION-2 source
  descriptions at lines 112 and 322 updated to crimson-not-amber.

Rationale: amber + dark-mode ink fails WCAG AA at `1.4:1` (`#DCB587`
amber + `#DCDED5` dark-ink ≈ 1.4:1, well below the 4.5:1 AA floor for
normal text). Symmetric amber → bg mapping fails light mode at
`1.6:1`. Hardcoded dark-text fixes contrast but loses theme
adaptation. A crimson-family color whose luminance positions allow a
symmetric bg-foreground pair to clear AA in both modes (6.08:1 light,
5.02:1 dark) is the cleanest resolution that preserves the
theme-adaptation pattern shared with `--primary-foreground`.

Calm-first compatibility: the chosen crimson values are washed (not
saturated/vibrant). The dark-mode value (`#C17F81`) is closer to a
dusty rose than a red. Both modes feel earthy/muted, consistent with
the Mist & Meadow tonal language. The dark-mode value's lower
saturation + higher lightness counteract the visual weight of dark
backgrounds.

## 2026-05-21 — spec(003-employee-dashboard-shell) — FR-020 amendment: inline change-password form on /app/account

Phase 6 manual smoke (T039) surfaced a UX issue: the Security
section's "Change password" affordance was a `<Link
href="/forgot-password">` styled as a button. Clicking it bounced
the user back to /app — because feature 001's (auth) route guard
in `proxy.ts` correctly redirects already-signed-in users off
the /forgot-password page (signed-in users can't request a reset
they don't need). The contract collision was inevitable: routing
an authenticated user through a signed-out reset flow is
self-contradictory by design.

**Amendment**: replace the "route to /forgot-password" pattern
with an inline change-password form rendered directly on
/app/account. The Security section becomes a client component
with three fields (current password, new password, confirm
new password), submitting to a new `changePassword` server
action.

  - Current password verified by calling
    `supabase.auth.signInWithPassword({ email: user.email,
    password: current })` against the user's own session — returns
    an error on mismatch without disturbing the current session.
  - New password updated via `supabase.auth.updateUser({
    password: newPassword })`.
  - Validation: Zod schema mirrors feature 001's signUpSchema
    rules (min 8, contains a letter, contains a number) on the
    new password field, plus a refine() asserting `confirm ===
    new_password`. Calm-voice messages, no regex sources
    surfaced to the UI.
  - Live <PasswordRequirements> checklist reused from
    @/components/ui/auth — same rule semantics as signup and
    reset-password.
  - <PasswordInput> reused from the same module — show/hide
    toggle behaviour is consistent across all four password
    surfaces.

The /forgot-password flow stays intact for signed-out password
recovery; this amendment narrows the AUTHENTICATED change-
password path to its own surface.

**FR-020 final wording** (effective on this commit):
> The Security section on /app/account renders an inline change-
> password form. The user supplies their current password, a new
> password, and a confirmation. Validation matches signup rules
> (min 8 characters, a letter, a number). On success the form
> resets and renders a brief calm confirmation. Signed-out
> password recovery continues to live at /forgot-password as
> shipped in feature 001.

**Affected artifacts**, all updated in the implementing commit
that follows this CHANGELOG entry:

  - apps/web/app/(authed)/app/account/actions.ts — adds
    `changePassword` server action alongside the existing
    `updateProfile`.
  - apps/web/components/account/security-section.tsx —
    rewritten from server component (Link) to client component
    (inline form with react-hook-form + zodResolver +
    useTransition, matching ProfileSection's pattern from
    61828a4).
  - apps/web/components/account/security-section.test.tsx —
    test shape rewritten; coverage added for the changePassword
    failure modes (wrong current password, weak new password,
    mismatch on confirm).

The Phase 6 commit 42f121e (page composition) and 3f84d1d
(SignOutSection) do not change shape. The five-section order on
/app/account is preserved; only the Security section's
implementation changes.

## 2026-05-20 — plan(003-employee-dashboard-shell) — manual shadcn install substituted for `shadcn init`

Feature 003: shadcn CLI 4.7.0's `--preset=base-nova` default
introduces Inter→Geist font swap, red `--destructive`, and a generic
oklch palette that conflict with Constitution Principle V, FR-042,
and Decision B respectively. Manual init (hand-authored
`components.json` + `lib/utils.ts` + direct dep installs) substituted
for `shadcn init`. `shadcn add` retained for primitive scaffolding
only. Decisions A, B, E unchanged; their target outputs match the
manual-init result.

This is a plan AMENDMENT recorded via CHANGELOG, not a re-decision.
Any future re-init must use the manual path until shadcn's defaults
realign with the Decision A/B/E target shape.

## 2026-05-22 — plan(003-employee-dashboard-shell) — Decision N amendment: explicit broadcast helper replaces supabase-js storage propagation

Phase 11 implementation surfaced a mismatch between Decision N's
mechanism and feature 001's session model. Decision N (research.md
R-15) assumed `supabase.auth.onAuthStateChange`'s built-in
cross-tab firing — which relies on the session living in
localStorage so the `storage` event fires in sibling same-origin
tabs.

The actual implementation uses `@supabase/ssr`'s
`createBrowserClient`, which stores the session in **cookies**, not
localStorage. supabase-js's cross-tab BroadcastChannel is keyed
on the localStorage `storageKey`; with a cookie-based session,
no localStorage write happens on sign-in / sign-out, so no
`storage` event fires cross-tab, so onAuthStateChange never sees
the transition in sibling tabs.

A Playwright probe captured the symptom directly: after Tab A
signs in via the `/login` form (Server Action path that sets
cookies server-side), Tab B's `localStorage.keys()` was `[]`. The
listener subscription was healthy; the underlying event simply
never reached it.

**Amendment**: bridge the cross-tab path with a tiny explicit
broadcast helper. Sign-in / sign-out callers write a marker
value to `localStorage` under the key
`serenify-auth-broadcast`. Sibling tabs receive the `storage`
event on that key and navigate per FR-046's pathname rules. The
listener subscription target shifts from
`supabase.auth.onAuthStateChange` to
`window.addEventListener("storage", ...)`.

**Affected artifacts**, all updated in the implementing commit:

  - `apps/web/lib/auth-broadcast.ts` (new) — exports
    `AUTH_BROADCAST_KEY`, `broadcastSignIn`,
    `broadcastSignOut`, `parseAuthBroadcast`. Single source of
    truth for the key + value format.
  - `apps/web/components/cross-tab-auth.tsx` — subscribes to
    `window` storage events on the broadcast key; pathname-gated
    navigation per FR-046 stays unchanged. Same mount point
    (root layout per Decision 8) and same return-null contract.
  - `apps/web/components/cross-tab-auth.test.tsx` — Vitest
    suite rewritten to fire synthetic StorageEvents instead of
    mocking supabase callbacks. 22 cases cover every
    pathname × event combination plus the storage-event
    negative space (wrong key, unrecognised value, null
    newValue, unmount, pathname re-subscribe).
  - `apps/web/app/(auth)/login/login-form.tsx` — calls
    `broadcastSignIn()` immediately before `router.replace
    ("/app")` on a successful sign-in. Writing to localStorage
    before the navigation ensures sibling tabs see the storage
    event while their listeners are still at the
    pre-navigation pathname.
  - `apps/web/components/sign-out-button.tsx` — form's onSubmit
    calls `broadcastSignOut()`. Fires synchronously before the
    Server Action runs.
  - `apps/web/components/header/profile-dropdown.tsx` — hidden
    form's onSubmit also calls `broadcastSignOut()`. Both
    sign-out paths converge on the same broadcast.

Original Decision N's intent — single-context, two-page
Playwright spec; storage-event mechanics; UI-driven sign-in and
sign-out — is preserved. Only the underlying event source
changes.

The shared-localStorage requirement that Decision N called out
for the Playwright spec still holds: `browser.newContext()` +
two `context.newPage()` instances share localStorage, so the
storage event fires in pageB when pageA writes via the
broadcast helper. Two contexts would not share localStorage and
the cross-tab path would never fire.

Bonus contract clarification: same-context cross-tab password
changes propagate as `USER_UPDATED` events (not `SIGNED_OUT`)
because both tabs share the rotated session via cookies. The
cross-tab listener correctly ignores `USER_UPDATED`. The Phase 6
"cross-tab session invalidation on password change" flag was
based on a misread of supabase-js's behavior in
cookie-session mode; no propagation is needed and none should
happen. (Other-device session invalidation is a separate
concern handled by Supabase's refresh-token rotation, not by
this listener.)

## 2026-05-22 — plan(003-employee-dashboard-shell) — Decision L admin subtitle: "available below" → "available from the header dropdown"

Phase 10 manual smoke (T058) surfaced a copy-vs-layout disconnect
in the admin role-placeholder subtitle. The locked Decision L
copy ended in "Account settings are available below." but the
placeholder body has only the Sign out button below the subtitle
— Account lives in the header dropdown, not "below." The phrasing
sent admins looking for an affordance the layout never showed.

**Amendment**: the admin subtitle becomes:

  "Org-wide tools land in a later release. Account settings are
  available from the header dropdown."

Previous wording (superseded): "Org-wide tools land in a later
release. Account settings are available below."

The team_lead subtitle is unchanged.

The replacement keeps the constraints Decision L's original copy
satisfied: informational, no exclamation marks, no clinical or
alarmist phrasing, calm voice. "From the header dropdown" is a
concrete locator — admins reading it know exactly where to look.

**Affected artifacts**, all updated in the implementing commit:

  - `specs/003-employee-dashboard-shell/plan.md` Decision L —
    amended subtitle named; previous subtitle preserved
    alongside as superseded.
  - `apps/web/components/role-placeholder/role-placeholder.tsx`
    — COPY.admin.subtitle string updated; inline comment notes
    the amendment date and points at this CHANGELOG entry.
  - `apps/web/components/role-placeholder/role-placeholder.test.tsx`
    — admin subtitle assertion swapped to the amended wording;
    a new assertion locks the negative space ("available below"
    is NOT present) to catch a future revert.
  - `apps/web/tests/e2e/admin-seeded.spec.ts` — adds the
    subtitle assertion alongside the existing heading
    assertion. Permitted by FR-036's copy-only-change scope
    (the spec already updated for the role-banner removal in
    6420799; this commit refines the same assertion block).

No layout change. No new tokens. No new components. The
amendment is one sentence of copy + the test coverage that
locks it.

## 2026-05-25 — impl(003-employee-dashboard-shell) — cross-tab signin broadcast on the auth-callback path (smoke ST-8)

Smoke ST-8 (cross-tab propagation on **email verification**) failed:
clicking a sign-up confirmation link signed the landing tab in, but
sibling tabs on `/login` / `/signup` did not follow. The form path
broadcasts cross-tab because `login-form.tsx` writes the
`serenify-auth-broadcast` localStorage marker client-side after the
sign-in Server Action returns; the email-verification path establishes
the session inside the **server-only** `GET /auth/callback` Route
Handler, which has no client context and so never wrote the marker.
The Phase-11 `cross-tab-auth-sync.spec.ts` covers the form path only,
so the gap shipped unnoticed.

**Fix**: the callback sets a short-lived, client-readable
`serenify-auth-signin` cookie on its redirect response — but only when
the post-exchange destination is an authed surface (`/app` /
`/onboarding`), gated by `destinationBroadcastsSignIn(next)`. The new
mount-once effect in `CrossTabAuth` (`consumePendingSignIn`) reads the
cookie on whichever authed surface the user lands on, emits the
existing `broadcastSignIn()`, and clears the cookie. Sibling tabs then
propagate through the unchanged storage-event → navigation path.

**Why a cookie, not a redirect query param**: `proxy.ts` strips
`url.search` (`url.search = ""`) on its `/app` → `/onboarding` bounce —
the exact path a fresh null-profile sign-up or admin invite takes — so
a query param would be destroyed before any client could read it.
Cookies survive that redirect untouched.

**Why not `onAuthStateChange`**: `@supabase/ssr` reads the session
from cookies on load and emits `INITIAL_SESSION`, not `SIGNED_IN`,
after a server-side code exchange — so a `SIGNED_IN`-gated broadcast
would not fire reliably in the post-redirect tab, and broadcasting on
`INITIAL_SESSION` would fire on every authed page load.

The recovery flow (`next=/reset-password`) is intentionally excluded
so it does not broadcast a spurious sign-in (preserves smoke ST-9).

**Affected artifacts**:

  - `apps/web/app/auth/callback/route.ts` — sets the marker cookie on
    authed-destination redirects after a successful exchange.
  - `apps/web/lib/auth-broadcast.ts` — adds `AUTH_SIGNIN_COOKIE`, the
    pure `destinationBroadcastsSignIn(next)` gate, and the client-side
    `consumePendingSignIn()`.
  - `apps/web/components/cross-tab-auth.tsx` — mount-once effect
    consuming the cookie.
  - `apps/web/lib/auth-broadcast.test.ts` (new) +
    `apps/web/components/cross-tab-auth.test.tsx` — Vitest covering the
    gate and both sides of the cookie seam.

**Test coverage note**: a full email-verification Playwright spec is
deferred — the real path needs a PKCE `?code=` link whose
`code_verifier` is set client-side during `signUp`, which the e2e
suite already sidesteps by bypassing confirmation
(`admin.auth.admin.updateUserById(..., { email_confirm: true })` +
form sign-in). The Vitest pair tests both sides of the cookie seam and
the existing `cross-tab-auth-sync.spec.ts` proves the
storage-event → navigation half; the seam between them is the cookie,
verified on both sides. Mohamed re-runs ST-8 manually to validate the
end-to-end email path.

## 2026-05-25 — impl(003-employee-dashboard-shell) — cross-tab signin broadcast on the OTP-verify path (+ full auth-path audit)

Follow-up to the ST-8 fix. Manual smoke found the **6-digit OTP
fallback** (FR-020 — user types the code into `OtpPanel` instead of
clicking the email link) did not propagate cross-tab. Third instance of
the "auth completes but the broadcast doesn't fire" class (1: Phase-11
form-only; 2: `/auth/callback`; 3: this).

Rather than patch one path, audited every auth-completing path:

| Path | Mechanism | Status |
|------|-----------|--------|
| Form sign-in (`login-form.tsx` → `signInWithPassword`) | client `broadcastSignIn()` | already correct |
| Email link / invite (`/auth/callback` → `exchangeCodeForSession`) | server `AUTH_SIGNIN_COOKIE` bridge | fixed in c8c182c |
| **Sign-up OTP** (`OtpPanel` → `verifySignupOtp`, `successHref=/app`) | client `broadcastSignIn()` | **fixed here** |
| Recovery OTP (`OtpPanel` → `verifyResetOtp`, `successHref=/reset-password`) | gate excludes | correct (no change) |
| Recovery email link (`/auth/callback?next=/reset-password`) | gate excludes | correct (c8c182c) |
| Account re-auth (`account/actions.ts`) | throwaway anon client, no cookie writes, no navigation | not a sign-in path |
| `signInWithOtp` / magic-link / passwordless | none exist in the repo | — |

**Fix**: `OtpPanel` (the shared client component behind both the
sign-up and recovery code panels) calls `broadcastSignIn()` in its
`status === "ok"` branch, gated by
`destinationBroadcastsSignIn(successHref)`. Because `OtpPanel` is
client-driven (it does `router.replace(successHref)` itself, exactly
like `login-form.tsx`), it writes the localStorage marker **directly** —
the `AUTH_SIGNIN_COOKIE` bridge is reserved for the genuinely
server-only `/auth/callback` Route Handler, which has no client context.
A single change in the shared component covers both callers, and the
`successHref` gate makes the sign-up panel (`/app`) broadcast while the
recovery panel (`/reset-password`) stays silent — preserving ST-9.

**Affected artifacts**:

  - `apps/web/components/ui/auth/otp-panel.tsx` — gated
    `broadcastSignIn()` in the success branch (the only runtime change).
  - `apps/web/components/ui/auth/otp-panel.test.tsx` (new) — Vitest:
    broadcasts to `/app`, silent to `/reset-password`, silent on a
    failed verify.
  - `apps/web/tests/e2e/cross-tab-auth-sync.spec.ts` — new spec driving
    the real OTP flow (fresh sign-up → Mailpit code → `OtpPanel` verify)
    and asserting a sibling `/login` tab follows. Unlike the
    email-verification path, the OTP path is fully Playwright-testable —
    no PKCE `code_verifier` blocker, the code comes from Mailpit via the
    existing `fetchLatestOtp` helper. E2E count: 54 → 57 (one test × 3
    browsers).

## 2026-05-25 — feat(003-employee-dashboard-shell) — feature complete (smoke pass 10/10)

Feature 003 reaches its human-validated gate (Constitution Principle
VII): all ten smoke rows in
`specs/003-employee-dashboard-shell/smoke-tests.md` are ✅. What
shipped:

- **Dashboard shell** — persistent header (wordmark, theme toggle,
  profile avatar), centered nav, and a profile dropdown; mobile sheet
  menu at narrow widths.
- **Account page** (`/app/account`) — Profile section (full-name edit
  that updates header initials + dropdown name on the same render
  cycle, FR-017) and an inline change-password form (FR-020 amendment),
  plus Privacy/Notifications placeholder cards and Sign out.
- **Three role-specific home bodies** — employee welcome banner + 60/40
  skeleton cards + chat pill; team_lead and admin centered placeholders
  (no banner/cards/pill).
- **Notification surface** — built but not mounted by production code
  (FR-033); consumer features 007/008/010 will mount it.
- **Cross-tab auth sync** — `broadcastSignIn`/`broadcastSignOut` over a
  shared-localStorage marker, plus the `AUTH_SIGNIN_COOKIE` bridge for
  the server-only `/auth/callback` path; every auth-completing path
  audited (form, email link, sign-up OTP) so sibling tabs propagate
  within 2s, recovery paths excluded.
- **Reduced-motion respect** — Framer Motion `useReducedMotion` primary
  + a `globals.css` OS backstop; instant (no slide/translate) appearance
  under `prefers-reduced-motion`, the WCAG SC 2.3.3-correct behavior.

Amendments folded in during implementation (all recorded above):
Decisions I–N (notably **Decision N** → explicit broadcast helper +
cookie bridge replacing supabase-js storage propagation, and **Decision
L** admin-subtitle copy), **FR-020** → inline change-password form on
`/app/account`, and **FR-042** → crimson scoped to destructive surfaces.
Known follow-ups deferred to `docs/BACKLOG.md` (non-dismissible
confirmation-notification API, auth-broadcast forward-looking guard,
sign-in confirmation-link contrast, card-heading typography read, and
the dev-server resource leak from `642fa09`).

## 2026-05-25 — security: slice 1 — RLS + SECURITY DEFINER hardening

Fix pass for the slice-1 audit
(`docs/security/01-rls-and-security-definer.md`), landed in migration
`20260525000000_security_hardening_slice_1.sql` (commit `b4e5e70`) and merged
via PR #6. Observable behavior changes on the `public.profiles` authorization
model:

- `admin_update_manager` now rejects manager-cycle assignments — setting a
  user's manager to a transitive report of that same user raises `23514`
  (check_violation) and rolls the change back.
- `admin_update_role` now rejects any role change that would leave zero admins
  globally, raising `23514` (last-admin lockout guard). Self-demotion is still
  permitted while at least one other admin remains.
- SECURITY DEFINER functions no longer carry the default `PUBLIC` EXECUTE
  grant; EXECUTE is tightened to the specific roles that need it. `is_admin()`
  retains its `anon`/`authenticated` grant because it is evaluated inside an
  RLS policy.
- Column-level UPDATE on `public.profiles` is whitelisted to `full_name` for
  the `authenticated` role; `role` and `manager_id` are writable only through
  the SECURITY DEFINER admin functions (which run as `postgres`).
- The `anon` role's write access on `public.profiles` is revoked.
- `reports_under()` EXECUTE is revoked from every role (callable only by its
  owner) until the first real consumer lands and explicitly picks its
  DEFINER/scope posture.

Finding 7 (`handle_new_user` persists an unvalidated `full_name`) was routed to
slice 3. Decisions recorded in `docs/DECISIONS.md` (2026-05-25 — Security
slice 1). Cloud-dashboard parity: n/a — all changes are in-repo migration SQL.

## 2026-05-25 — security: slice 2 — auth hardening (cookies, open redirect, config)

Fix pass for the slice-2 audit
(`docs/security/02-auth-cookies-broadcast.md`), landed across commits
`68c41d3` / `188de88` / `ede11d2` and merged via PR #7. Observable behavior
changes on the application-layer auth surfaces:

- The open redirect on `/auth/callback` (a `?next=` userinfo / subdomain
  break-out in the `${origin}${next}` concatenation — e.g. `next=@evil.com`
  resolving to `evil.com`) is fixed. `next` is validated through a single
  `isSafeNextPath()` helper and falls back to `/app` on anything that is not a
  safe same-origin relative path.
- Supabase session cookies (`sb-*`) and the `serenify-auth-signin` cross-tab
  bridge cookie now carry the `Secure` flag in production. `httpOnly` is
  intentionally left `false` — the browser client reads `document.cookie` to
  hydrate the session, so `httpOnly:true` would break auth.
- The Supabase-layer password floor is raised to 8 characters with a letter +
  digit requirement (was min 6, no requirements), matching the app's existing
  Zod policy so the server floor can no longer accept a weaker password than
  the UI enforces.
- `secure_password_change` is enabled: a stale, non-recently-authenticated
  session can no longer change the password at `/reset-password` without
  re-authenticating. Recovery flows are unaffected — a recovery session counts
  as recent authentication, so the legitimate reset path still completes.
- The auth email rate limit (`max_frequency`) is raised from 1s to 60s to blunt
  inbox-flooding via resend / password-reset loops.
- The `resendConfirmation` Server Action now validates the email format before
  dispatching and returns silently on bad input (no enumeration oracle).
- Auth fallback error branches (`signIn`, `signUp`, `updatePassword`) no longer
  forward raw Supabase error text to the client — they log the error
  server-side and return a fixed generic message.

Decisions recorded in `docs/DECISIONS.md` (2026-05-25 — Security slice 2).
Cloud-dashboard parity **required**: the `config.toml` changes
(`max_frequency`, password requirements, secure password change, allowed
redirect URLs) must be applied separately in the production Supabase Cloud
dashboard — Mohamed applies these manually (checklist in PR #7). From this
slice forward, every security slice gets a CHANGELOG entry; slice 1's was
backfilled here because it ships alongside slice 2 in the same PR.

## 2026-05-25 — security: slice 3 — privileged endpoints + input validation

Fix pass for the slice-3 audit
(`docs/security/03-privileged-endpoints-and-input-validation.md`), landed across
commits `0ce67d4` (invite handler) / `cbf26bd` (completeOnboarding) / `0f0bdc2`
(shared `fullNameSchema` + DB CHECK) and merged via PR #8. Observable behavior
changes:

- `POST /api/admin/invite` now checks authentication and authorization **before**
  parsing the request body. An unauthenticated caller receives `401` with no
  schema details regardless of body shape (previously a bad/empty body returned
  `400` with the full Zod `issues`, including the email regex source); a
  non-admin receives `403`; only a verified admin reaches body validation.
- `POST /api/admin/invite` now validates the request `Origin` against `SITE_URL`.
  A cross-site, browser-issued request carrying a session cookie with a
  mismatched `Origin` is rejected with `403` — defense-in-depth on top of the
  `SameSite=Lax` session cookie (Route Handlers, unlike Next.js Server Actions,
  get no automatic same-origin check). An absent `Origin` (server-to-server /
  non-CORS) is allowed.
- `POST /api/admin/invite` error responses no longer forward raw Supabase / RPC
  error text or Zod `issues` to the client. Validation failures return a fixed
  `{"error":"validation_failed","message":"Invalid invite payload."}`; the `500`
  branches (`invite_failed`, `role_update_failed`, `manager_update_failed`) carry
  an error code only, with full detail logged server-side.
- `completeOnboarding` Server Action now returns a fixed generic message
  (`"We couldn't save that — try again."`) on a database failure instead of the
  raw Supabase `error.message`, logging the error server-side — matching the
  existing `updateProfile` behavior on the same `full_name` column.
- `full_name` validation is centralized in a single authoritative
  `fullNameSchema`. The character cap is a consistent **120** across signup,
  onboarding, account update, and the client form (the account path previously
  diverged at `60`, locking out users whose existing name ran 61–120 chars). A
  new database `CHECK (full_name IS NULL OR char_length(full_name) <= 120)`
  (migration `20260525000100_full_name_length_cap.sql`) backstops the cap for any
  non-form writer that bypasses the Zod gate.
- `full_name` now rejects control and format characters (`\p{Cc}\p{Cf}`,
  including the RTL override `U+202E`) at write time with a friendly message
  (reject, not silent-sanitize). The validator stays permissive across all
  scripts — non-Latin names, diacritics, and unusual-but-valid punctuation are
  accepted. React render-escaping remains the primary XSS control; this is
  defense-in-depth + display integrity (closes slice-1 Finding 7).

Decisions recorded in `docs/DECISIONS.md` (2026-05-25 — Security slice 3).
Cloud-dashboard parity: **n/a this slice** — all changes are in-repo (handler
code, Server Action, Zod schema, and migration SQL); no `config.toml` `[auth]` or
other Cloud-dashboard-effective setting changed (the slice-2 dashboard-parity
requirement still stands for any future config-touching slice).

## 2026-05-25 — Security slice 4: secrets handling

Fix pass for the slice-4 audit (`docs/security/04-secrets-handling.md`);
decisions recorded in `docs/DECISIONS.md` (2026-05-25 — Security slice 4).

- Environment variables for the Supabase connection (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and `SITE_URL` now
  route through a single Zod-validated module
  (`apps/web/lib/env/{schema,client,server}.ts`). A missing or malformed value
  fails fast with a clear, field-listed error at boot instead of failing deep
  inside the Supabase client at first use (previously eight `process.env.X!`
  non-null assertions). The service-role key is read only through the
  `server-only` `serverEnv`, which keeps it structurally out of the client bundle.
- `.env.local.example` now documents every env var the codebase reads, including
  test-only and infrastructure vars (`PLAYWRIGHT_PORT`, `CI`, `MAILPIT_URL`,
  `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `SUPABASE_PROJECT_REF`) under a
  commented "Test-only / infrastructure (defaults shown)" block.
- The local seed CLI (`npm run seed`) only prints the shared demo-account
  password when stdout is an interactive TTY — non-interactive runs (CI,
  redirected/piped output) skip the credential banner. Diagnostic errors still
  always print.

No Cloud-dashboard parity items this slice — env values still live in the
platform dashboards; this slice changes how the app *reads* them locally and adds
boot-time validation, not what they are in prod.

## 2026-05-26 — security: slice 5 — Content Security Policy + auxiliary security headers

Fix pass for the slice-5 audit (`docs/security/05-csp-header.md`); decisions
recorded in `docs/DECISIONS.md` (2026-05-26 — Security slice 5). The policy was
rolled out Report-Only → empirical capture (Playwright, production build, all 8
routes + Radix overlay interactions) → enforcing, then re-verified across the
full chromium/firefox/webkit e2e matrix.

- A **nonce-based Content-Security-Policy** is now enforced on every HTML
  response, emitted per-request from `apps/web/proxy.ts`. `script-src` is
  `'self' 'nonce-<128-bit>' 'strict-dynamic'` (dev adds `'unsafe-eval'` for
  Turbopack's React dev build); Next.js auto-stamps the nonce onto its framework
  inline scripts, and the two app-authored inline scripts (the `layout.tsx`
  theme-migration IIFE and the next-themes FOUC script) carry it manually.
  Cross-origin script execution — including any future XSS attempting to read the
  `httpOnly:false` session cookie (slice-2 Finding 2) — is blocked. `style-src`
  is `'self' 'unsafe-inline'` (Radix scroll-lock injects an un-nonced runtime
  `<style>`; a nonce there would disable `'unsafe-inline'`). `connect-src` is
  restricted to the app origin + the configured Supabase project; `img-src`,
  `font-src` are `'self'`; `object-src`/`frame-src`/`frame-ancestors` lock down
  plugins, embedding, and clickjacking.
- **Auxiliary security headers** are now set on every response (static set via
  `next.config.ts` `headers()`, so `/_next/static` assets are covered too):
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy:
  strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`
  (camera/microphone/geolocation/payment/usb/FLoC all denied),
  `X-XSS-Protection: 0`, `Cross-Origin-Opener-Policy`/`Cross-Origin-Resource-Policy:
  same-origin`, and **production-only** HSTS (`max-age=63072000;
  includeSubDomains`, no `preload`). COEP is intentionally not set (would break
  Supabase cross-origin).
- Zod 4's JIT validator compiler is disabled app-wide via a `@/lib/zod` jitless
  barrel — empirically it used `new Function(...)` in the browser, which would
  have forced `'unsafe-eval'` into `script-src`; `jitless: true` keeps the policy
  strong with no functional change (interpreted validation, identical results).
- `upgrade-insecure-requests` is **production-only**: in dev (`http://localhost`)
  WebKit upgrades even loopback subresource requests to https and breaks every
  chunk; Chromium/Firefox exempt localhost. (camera/microphone in
  `Permissions-Policy` will be relaxed, scoped to their routes, when features 004
  (webcam) and 013 (audio) land.)

One forward-looking note recorded in DECISIONS: when Sentry/PostHog telemetry is
adopted, the `connect-src` ingest origins and a PII-scrubbing review are required
before it ships. No Cloud-dashboard parity items this slice — all changes are
in-repo (`next.config.ts`, `proxy.ts`, `layout.tsx`, `providers.tsx`,
`lib/zod.ts`).
