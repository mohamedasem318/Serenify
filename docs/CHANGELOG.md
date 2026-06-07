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

## 2026-05-26 — security: slice 6 — dependency hygiene (classification, pins, audit baseline)

Fix pass for the slice-6 audit (`docs/security/06-dependency-audit.md`); decisions
recorded in `docs/DECISIONS.md` (2026-05-26 — Security slice 6). This is a
dependency-posture slice — no application-code or runtime-behavior change.

- The runtime-shipped utilities `clsx`, `tailwind-merge`, `class-variance-authority`,
  and `server-only` are reclassified from `devDependencies` to `dependencies` in
  `apps/web/package.json` (versions unchanged). Their code ships into the served
  bundle (the `cn()` helper, `cva` variants, the RSC `server-only` guard), so a
  production-mode `npm ci --omit=dev` install now resolves them and
  `npm audit --omit=dev` no longer has a blind spot on them. No runtime behavior
  change — a packaging-correctness fix. (The build-only Tailwind/PostCSS toolchain
  — `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css` — correctly stays in
  `devDependencies`: its output ships, not its code, and the production build runs
  a full install, not `--omit=dev`.)
- `tsx` is upgraded from 4.19.2 to 4.22.3 (exact pin preserved, moved forward with
  intent) to clear the bundled-esbuild dev-server advisory (`GHSA-67mh-4wv8-2f99`):
  tsx 4.22.3 bundles esbuild 0.28.0 (was 0.23.1). Not a runtime-reachable issue
  (`tsx` transforms TypeScript for the local seed CLI; it never runs esbuild's dev
  server) — the bump keeps the `npm audit` baseline clean.
- Routine range-satisfiable updates (lockfile-only, no manifest change), none
  security-driven, no behavior change: `@supabase/supabase-js` 2.106.2 (opt-in
  OTel + OAuth/RN fixes; no cookie/session/SSR-auth change), `@hookform/resolvers`
  5.4.0, `react-hook-form` 7.76.1, `@types/react` 19.2.15, `vitest` 4.1.7.
- The `npm audit` baseline is now **0 critical / 0 high / 0 low**, with the only
  remaining advisory being the postcss-inside-Next `</style>` XSS line
  (`GHSA-qx2v-qp2m-jg93`, npm-counted as 2 moderate on the `next` + bundled-postcss
  nodes), which is **accepted** (reachable only at build time on first-party CSS;
  no untrusted-CSS precondition; the only offered fix is a non-viable Next
  downgrade) and carried forward from DECISIONS 2026-05-17. Re-evaluate when Next
  ships a bundled postcss ≥ 8.5.10.

No Cloud-dashboard parity items this slice — all changes are in-repo
(`apps/web/package.json`, root `package.json`, `package-lock.json`, docs).

## 2026-05-26 — security: slice 7 — rate-limit verification + Cloud-dashboard parity consolidation

Fix pass for the slice-7 audit (`docs/security/07-rate-limits-and-parity.md`,
adjudicated 2026-05-26); decisions recorded in `docs/DECISIONS.md` (2026-05-26 —
Security slice 7). This is an audit-consolidation slice — **no application-code,
config-value, or runtime-behavior change**. The only edits are two inline
reminder comments and documentation.

- The rate-limit posture was audited end-to-end. All six `[auth.rate_limit]`
  numeric buckets match GoTrue defaults (sane for the current threat model —
  e.g. a 6-digit OTP under `token_verifications=30/5min/IP` + `otp_expiry=3600`
  is infeasible to brute-force online), and `max_frequency=60s` (slice 2)
  continues to gate the per-account email cooldown. No exploitable,
  unauthenticated rate-limit hole was found.
- The `/signup` posture is documented as **open self-serve**: any anonymous
  visitor can mint an email-confirmed `employee` account. The blast radius is
  bounded — a self-signup **cannot** escalate to `admin`/`team_lead` via
  metadata, because `handle_new_user` hard-codes `role='employee'` and ignores
  client-supplied `role`/`manager_id`. Closing `/signup` to invite-only is
  non-trivial feature work, routed to BACKLOG (security slice 7); a production
  deploy is **blocked** until it is gated, per the binding invariant in the new
  DECISIONS entry.
- The Cloud-dashboard parity checklist is **consolidated across slices 1–7** in
  the audit doc. The one new flag this consolidation adds is the
  **Auth → Rate Limits** block (six values), because `[auth.rate_limit]` is
  local-only and was never affirmatively confirmed against the hosted project.
  Mohamed applies + verifies the full checklist (rate limits, email cooldown,
  password floor + requirements, secure password change, redirect allowlist)
  manually before any production deploy — it cannot be read from the repo.
- Two deferrals are codified with inline pointers so they are not lost: the
  per-admin throttle on `/api/admin/invite` is **held for feature 011** (reminder
  comment at `apps/web/app/api/admin/invite/route.ts:37`), and the `email_sent`
  value re-tune is **deferred to SMTP-wiring time** (reminder comment at
  `supabase/config.toml:204`). The `email_sent` limit is inert locally (SMTP
  disabled) and stays at the default `2` until the production provider quota is
  known. CAPTCHA stays deferred (trigger: sustained credential-stuffing OR
  production-launch review); the `[auth.captcha]` template stays commented out so
  the future enable is one line.

No Cloud-dashboard parity items are *introduced* this slice — it consolidates the
existing checklist rather than adding any new in-repo config change. All edits
are in-repo (two inline comments + `docs/`).

## 2026-05-27 — constitution(II) — video pipeline window + baseline + drop rPPG

The video modality switched from rPPG to LBP-TOP + Motion features with
per-user delta calibration. The rPPG notebook was retired after a
subject-leakage bug surfaced late in feature 004 prep; the replacement is the
LBP-TOP + Motion pipeline, served as model
`serenify-video-lbptop-motion-rf-calibrated` v2.0.0. The new model's contract
specifies timing parameters that contradicted Principle II
(Subject-Disjoint ML Evaluation), so Principle II is amended to match it.

Two sentences in Principle II change, and the rPPG naming is dropped from the
principle body:

- **Inference window**: rolling **30s → 60s** (10s stride unchanged). The old
  rPPG-specific justification ("30s is the physiological minimum for meaningful
  HRV from rPPG") is removed; the window is now set by the model contract in
  `docs/MODELS.md`. Empirically, the 30s window collapsed stress-class recall
  from **0.83 (at 60s) to 0.61 (at 30s)** on subject-disjoint LOSO — 60s is the
  locked production mode.
- **Calibration baseline**: per-user calm baseline on first login changed from
  **~90s → ~60s**.
- **Terminology**: "video (rPPG) pipeline" / "from rPPG" become modality-agnostic
  "video pipeline" wording. The principle generalizes cleanly without naming a
  specific feature family. rPPG is intentionally retained as historical context
  in Principle I (`rPPG-derived` raw-signal clause) and Principle III
  (`webcam + rPPG pipeline` package description) — out of scope for this
  amendment.

All other Principle II clauses (subject-disjoint LOSO/GroupKFold splits,
per-subject baseline normalization on physiological features, the
`docs/MODELS.md` requirement for model artifacts) are unchanged.

Constitution version bumped `1.1.0 → 1.2.0` (MINOR per Governance: refinement
of an existing rule — timing parameters + terminology; no new principles, no
removed principles, no structural change). Sync Impact Report Amendment 2 entry
appended.

Affected artifacts, all updated in this commit:

- `.specify/memory/constitution.md` Principle II — two amended sentences, rPPG
  dropped from the body, version line `1.2.0`, Last Amended `2026-05-27`, Sync
  Impact Report Amendment 2 + template-audit note.
- `docs/DECISIONS.md` — formal architectural decision entry (2026-05-27),
  including the "may amend again if a currently-running trial surfaces a better
  model" note.

Template audit: `.specify/templates/{plan,spec,tasks}-template.md` reference
Principle II by number, not by literal timing text — zero matches for the
touched values; no template edit required. No Cloud-dashboard parity items —
all edits are in-repo (constitution + `docs/`).

## 2026-05-27 — constitution(III, VIII) — video pipeline description + 004 slot rename

Ride-along amendment with the first commit of feature 004 (onboarding video
anchor flow), landing before any feature code so the rest of 004 builds against
a clean constitution. Two surgical edits:

- **Principle III (Modality Isolation)** — the `packages/ml-video/` package
  description changed from `webcam + rPPG pipeline` to `video stress pipeline
  (LBP-TOP + motion features, per-user delta calibration)`. This retires the
  rPPG language that Amendment 2 had explicitly left in place in Principle III
  (Amendment 2 scoped its rPPG removal to Principle II's body only). The real
  pipeline now exists as of feature 004, served as model
  `serenify-video-lbptop-motion-rf-calibrated@2.0.0`.
- **Principle VIII (Spec-Driven Workflow)** — the provisional feature-ordering
  slot `004-webcam-and-rppg` is renamed to `004-onboarding-video-anchor` to
  match the actual spec slug. Slots 005 (`005-per-user-calibration`), 006
  (`006-stress-inference-service`), and all others are unchanged.

Constitution version bumped `1.2.0 → 1.3.0` (MINOR per Governance: refinement
of an existing rule — a package description plus a provisional ordering-slug
rename; no new principles, no removed principles, no structural change). Sync
Impact Report Amendment 3 entry appended. `Last Amended` stays `2026-05-27`
(Amendment 2 set it earlier today).

Affected artifacts, all in this commit:

- `.specify/memory/constitution.md` — Principle III bullet, Principle VIII slot,
  version line `1.3.0`, Sync Impact Report Amendment 3 entry.
- `docs/MODELS.md` — created with the
  `serenify-video-lbptop-motion-rf-calibrated@2.0.0` registry entry.
- `docs/MODEL_HANDOFF.md` — model integration contract, included in this commit.
- `docs/models/serenify-video-lbptop-motion-rf-calibrated-v2.0.0-results.png` —
  LOSO results figure (confusion matrix / ROC / score distribution).
- `docs/DECISIONS.md` — formal architectural decision entry (2026-05-27).

Template audit: `.specify/templates/{plan,spec,tasks}-template.md` reference
principles by number, not by the literal strings `rPPG`, `webcam`,
`004-webcam-and-rppg`, or `ml-video` — zero matches; no template edit required.

## 2026-05-27 — plan(004-onboarding-video-anchor) — tighten DECISION-12: block all anchor metadata from managers

The original plan.md DECISION-12 left anchor_captured_at and
anchor_model_version readable by managers and admins through the existing
row-level SELECT policies (profiles_select_admin,
profiles_select_direct_reports). Mohamed elected the stricter alternative
DECISION-12 originally flagged for review:

- anchor_captured_at and anchor_model_version are ALSO excluded from the
  `authenticated` SELECT column whitelist. None of the three anchor columns
  are readable by any client role via table grants.
- A new SECURITY DEFINER function `has_anchor(target_user uuid) returns
  boolean` is added (search_path pinned, scope-guarded so callers can only
  query themselves; EXECUTE grant scoped to `authenticated`, slice-1 default
  posture for SECURITY DEFINER functions).
- The web app uses `has_anchor(auth.uid())` to drive banner visibility,
  replacing the prior plan-time read of `anchor_captured_at IS NULL` on the
  owner's profile row.

Rationale: a manager seeing whether or when a direct report calibrated
could be used to pressure them ("why haven't you set up your wellness
app yet?"), undercutting the Principle I trust story (managers see
aggregates, not individuals). The function adds one SECURITY DEFINER
construct; privacy gain is real and bounded.

Affected artifacts (this commit): `specs/004-onboarding-video-anchor/plan.md`
(DECISION-12 rewritten as the chosen posture; DECISION-13/14/15 banner-read
references updated to `has_anchor()`), `contracts/migration.md` (tighter
whitelist + `has_anchor()` function + verification queries),
`data-model.md` (column readability + calibration-status derivation),
`research.md` (R-5 rationale + headline table), and `docs/DECISIONS.md`
(architectural decision entry 2026-05-27).

## 2026-05-28 — fix(004-onboarding-video-anchor) — anchor service auth-mode amendment: verify Supabase ES256 via JWKS (HS256 fallback)

DECISION-9 / FR-046 specified the anchor service verify the Supabase access
token "HS256 with the shared secret". Smoke testing surfaced that the current
Supabase CLI (and Supabase cloud) sign user access tokens with ASYMMETRIC
ES256 signing keys by default — a `kid` header + a JWKS at
`<supabase_url>/auth/v1/.well-known/jwks.json` — not the legacy HS256 shared
secret. The HS256-only verifier rejected every real token (`401`), which the
recorder surfaced as the generic "calibration temporarily unavailable" copy
after a full 60s recording; `/healthz` (no auth) still passed, so the failure
only appeared at upload time.

- `verify_jwt` now verifies asymmetric tokens (ES256/RS256/EdDSA) against
  Supabase's published JWKS public keys (a cached `PyJWKClient`), matched by the
  token `kid`. The HS256 shared-secret path is retained as a fallback for legacy
  projects and the unit tests. The algorithm allow-list is pinned per branch
  (never read from the token) to avoid algorithm confusion.
- New optional setting `SUPABASE_URL` (the JWKS source). When unset the verifier
  is HS256-only. Verifying public keys needs no secret, so DECISION-9's
  no-DB-credentials posture is preserved.
- Dependency: `pyjwt` -> `pyjwt[crypto]` (PyJWT needs `cryptography` for EC
  verification).

Rationale: production reality (Supabase's asymmetric signing-key default)
overrides DECISION-9's original HS256-only spec. JWKS verification is the
prod-correct approach for both local and cloud; the HS256 fallback keeps
backward compatibility and the existing test suite. Verified end-to-end: a real
local ES256 access token verifies through the actual `verify_jwt` against the
live JWKS, and a forged/garbage token still 401s.

Affected artifacts (this commit): `apps/api/app/auth.py` (JWKS + HS256
fallback), `apps/api/app/config.py` (`supabase_url`), `apps/api/.env.example`
(`SUPABASE_URL`), `apps/api/pyproject.toml` + `uv.lock` (`pyjwt[crypto]` ->
`cryptography`), and `apps/api/tests/` (ES256 accept + wrong-key reject tests).
The separate black-preview fix shipped in `e43f33f`.

## 2026-05-28 — fix(004-onboarding-video-anchor) — calibration banner must hard-navigate to /app/calibrate for the per-route Permissions-Policy to apply

DECISION-16 grants `camera=(self)` only on `/onboarding` and `/app/calibrate`
via `next.config.ts` `headers()`. That works for `/onboarding` (always reached
via a full document navigation post-confirm) and for a direct URL hit to
`/app/calibrate`, but smoke testing showed `getUserMedia` rejected with
`[Violation] Permissions policy violation: camera is not allowed in this
document` when the user reached `/app/calibrate` by clicking the calibration
banner on `/app`.

Root cause (real, not the earlier dev-only-transient misdiagnosis): Next App
Router's client-side `<Link>` navigation never reloads the document — it only
fetches the RSC payload and updates the React tree. `Permissions-Policy` is a
per-document HTTP header set at document-load time; a client-side route change
cannot re-evaluate it. So after a Link click from `/app` (whose document PP is
`camera=()`) to `/app/calibrate` (whose page response carries `camera=(self)`),
the **active document** is still `/app`'s, with `camera=()` enforced. `curl`
on `/app/calibrate` correctly returned `camera=(self)` because that endpoint's
*page response* is correct — but the browser never made that response the
active document. A dev-server restart only "fixed" it when the user happened to
follow with a URL-bar / hard navigation; that was the false positive that led
to the earlier `e1971d0` "dev-only workaround" docs note, which is removed in
this commit.

- `components/anchor/calibration-banner.tsx`: the CTA is a plain `<a href="/app/
  calibrate">` (not `next/link`), forcing a full document navigation so the
  fresh `/app/calibrate` HTML response loads with its `camera=(self)` PP.
  Identical idiom to the Router Cache hard-nav fix on the onboarding/calibrate
  success path (DECISIONS 2026-05-27).
- `specs/004-onboarding-video-anchor/smoke-tests.md`: the prior dev-only
  "restart the dev server" note (e1971d0) is removed; the bug is a product
  issue, not a local-dev transient.
- DECISION-16 unchanged in spirit (camera tightly scoped to the two capture
  routes); only the entry pattern is corrected — any code that links INTO a
  capture route from a non-capture route MUST use a hard navigation, not a
  client-side `<Link>`.

Affected artifacts (this commit): `apps/web/components/anchor/calibration-banner.tsx`,
`specs/004-onboarding-video-anchor/smoke-tests.md`.

## 2026-05-29 — feat(004-onboarding-video-anchor) — feature complete (smoke pass; merged to main, PR #14)

Feature 004 reaches its human-validated gate (Constitution Principle VII): the
smoke matrix in `specs/004-onboarding-video-anchor/smoke-tests.md` is signed off
2026-05-29 (ST-01…ST-20 PASS; ST-21/ST-24 and the mobile *camera* portions of
ST-22/ST-23 DEFERRED — see below). What shipped:

- **Per-user baseline anchor capture.** An in-browser recorder
  (`apps/web/components/anchor/`) captures a 60s clip and uploads it to a local
  FastAPI extraction service (`apps/api`), which runs the `ml-video` LBP-TOP +
  motion pipeline (`packages/ml-video`, model
  `serenify-video-lbptop-motion-rf-calibrated@2.0.0`) and returns a 2958-dim
  vector; the **web app** writes the vector to `profiles` with the user's own
  session client. Raw upload bytes are deleted server-side in a `finally`
  (Principle I) — the service holds no DB credentials.
- **Recorder UX.** Explicit state machine (idle → permission → 60s countdown →
  extracting → success/failure), post-grant device picker, codec probe
  (VP9 → VP8 → MP4 → default), calm failure copy with a three-failure escape, and a
  reduced-motion countdown. Backend availability is health-pre-checked before any
  capture UI is shown.
- **Column-level anchor privacy (DECISION-12).** All three anchor columns
  (`anchor_vector`, `anchor_captured_at`, `anchor_model_version`) are excluded from
  the `authenticated` SELECT whitelist — no client role can read them. Calibration
  status is exposed only through the scope-guarded SECURITY DEFINER
  `has_anchor(auth.uid())`, so a manager cannot observe whether or when a report
  calibrated.
- **JWT verification via JWKS (DECISION-9 amendment).** The extraction service
  verifies Supabase's asymmetric ES256 access tokens against the published JWKS
  (HS256 retained as a fallback), the algorithm allow-list pinned per branch.
- **Calibration banner.** Amber (never red), session-only dismissal, reappears next
  session until calibrated, cleared on sign-out; its CTA hard-navigates to
  `/app/calibrate` so the per-route `camera=(self)` Permissions-Policy applies.
- **Cross-tab sync.** Completing calibration drops the banner / redirects sibling
  tabs within ~2s over the feature-003 `storage`-event channel; dismissal mirrors
  into sibling tabs.
- **Demo-cohort synthetic anchor (DECISION-17).** The seed writes one deterministic
  synthetic anchor (seed 42) via the service-role client so demo employees land on
  a calibrated, banner-free `/app`.

Smoke-driven fixes folded in during the gate are recorded at summary level in
DECISIONS.md 2026-05-29 (with commit refs): JWKS auth, banner hard-navigation,
cross-tab anchor/dismissal sync + banner-bearing-route refresh scoping,
dismissal-reset-on-sign-out, skip-reveal observer semantics, recorder health
pre-check, retry permission re-probe, user-dismissible terminal states +
no-anchor-on-abort, and ghost-button dark-mode hover contrast.

**Deferred** (tracked in `docs/BACKLOG.md`): the full mobile camera → upload →
anchor flow over real-device HTTPS (including whether mobile-browser video codecs
decode server-side) — the ST-22/ST-23 camera portions; Safari desktop (ST-21) +
iOS Safari (ST-24) pending Apple hardware; the `localStorage` device write-back bug
(ST-05); and an e2e test-hardening pass (several 004 smoke bugs slipped through
green, mock-driven e2e). The non-camera mobile UI (layout/nav/banner/360px
hamburger) was verified over a LAN-IP HTTP origin after adding `allowedDevOrigins`
(`48cce3f`, dev-server only, zero production effect).

**Pre-production blocker carried forward** (unchanged by 004): the invite-only
`/signup` gate (security slice 7) must be resolved before any real-tenant launch.

The video model is unchanged by 004 (`docs/MODELS.md` / `docs/MODEL_HANDOFF.md`
were authored at the start of 004 and need no edit). The anchor read path for
inference is feature 005's decision, not 004's.

## 2026-05-29 — fix(ml-video) — ROI resize interpolation aligned to training (LBP-TOP feature-space fidelity)

- `features._roi_crop` now resizes each ROI with cv2's default `INTER_LINEAR`,
  matching the training notebook; the prior `cv2.INTER_AREA` override is removed.
- **Observable change**: the LBP-TOP feature values (`f0..f89`) change for every
  vector the extractor produces. The 2868 motion dims are unchanged.
- **Pre-fix anchors invalidated**: anchors captured before this fix were computed
  under `INTER_AREA` and sit outside the model's trained feature space — affected
  users must re-capture. `model_version` is unchanged (`2.0.0`), so stored anchors
  are NOT auto-invalidated; re-calibration is manual until an extraction-version
  field exists. (The demo seed's synthetic seed-42 anchor is not extraction-derived
  and is unaffected.)
- Added `tests/test_lbp_interpolation_fidelity.py`, pinning the 90-d LBP-TOP block to
  a notebook-derived golden; it fails if `INTER_AREA` is reintroduced. The existing
  sum-to-9.0 invariant in `test_pipeline_fixtures.py` did not catch the drift.

Rationale: see DECISIONS.md 2026-05-29 (LBP-TOP ROI resize interpolation).

## 2026-05-31 — polish(004-onboarding-video-anchor) — recording-overlay visibility pass

Post-ship polish on the onboarding capture overlay (the redesigned 005 surfaces
mounted at the onboarding first-time capture), surfaced during smoke review. No
state-machine, gate, or detector logic changed — visual/copy only.

- **Breathing orb seating**: the orb was composited onto the bare webcam feed, so
  its visibility depended on what the camera saw (invisible on dark/busy frames).
  It now sits on its own soft, feathered dark radial vignette (a local seating, not
  a hard opaque disc) with a luminous pale-meadow glow. Measured orb-vs-seating
  contrast ≈ 4:1 over a worst-case bright feed and ≈ 10:1 over a dark feed (WCAG
  non-text bar is 3:1). Pale sage is an intentional calmer choice over a pure-white
  core that would measure higher but read clinical.
- **Preview blur** reduced 6px → 3px. It was never doing contrast work (the orb now
  carries its own backing); kept only as a gentle softening of self-consciousness.
- **Breathing pacer copy**: "Breathe with the light — in for four, out for six."
  → plain stepped "Breathe in" (4s) / "Breathe out" (6s). The animated path now
  uses the same stepped swap the reduced-motion path already used; the orb carries
  the "with the light" idea visually.
- **Framing brackets** made legible: centred shows STEADY meadow brackets (was
  faint white); off-centre BLINKS in foggy (was a too-faint foggy). Two colours
  only — no third alarm hue (red is constitution-forbidden on affective surfaces;
  amber is wrong for a calming screen). Each bracket carries a soft dark edge halo
  so the stroke survives on bright and dark feeds. No checkmark on the recording
  screen — it stays exclusive to the green-room affirmative. Reduced motion drops
  the blink, keeping the foggy hue (the card text below still carries the words).

Live-feed appearance (orb seating over a real feed, bracket visibility, blur level)
is a manual smoke check — it can't be asserted headless without a camera.

Not in this entry (investigation/preview only, no behaviour change): a dark-mode
button-contrast investigation (root cause is the shared `outline` variant's hover,
not the `foggy` variant — see report) and a temporary `/dev/button-contrast`
preview route for the pending meadow ink-vs-white decision (a DECISIONS.md entry +
constitution check, not yet made).

## 2026-05-31 — fix(005-calibration-capture-flow) — outline button dark-mode hover contrast

Applies the fix the investigation above scoped. Behaviour change, dark mode only.

- **Root cause (confirmed, not the `foggy` variant):** the shared shadcn `outline`
  variant set `hover:text-accent-foreground` (= `ink`) on `hover:bg-accent`
  (= `foggy`, which is light-toned in BOTH modes). In dark mode `ink` is light
  (`#DCDED5`), so hover rendered light-on-light foggy — measured **~1.5:1**, far
  below AA. The `foggy` variant itself was never affected (its hover is opacity-only
  with dark text in both modes; measured 6.26:1 light / 8.73:1 dark).
- **Scope:** the only production surface using `variant="outline"` is the
  stop-confirm "Start over" button; the rest are the temporary dev route.
- **Fix:** `outline` →
  `border border-input bg-background hover:bg-accent dark:hover:text-bg`. Light mode
  never needed a hover text override (the inherited `ink` is already dark there), so
  the prior `hover:text-accent-foreground` is dropped and dark text is forced only on
  the dark-mode hover (`dark:hover:text-bg`). No competing `hover:text-*` rule remains,
  so it applies regardless of variant ordering.
- **Measured (live, getComputedStyle incl. real `:hover`):** dark-mode hover
  **1.5:1 → 8.73:1** (`#161917` on foggy `#9cbbc7`); light-mode hover 6.3:1; resting
  unchanged (~13:1 in both modes). AA is met in every state.

Deferred (no behaviour change, reported only): the §5 meadow-foreground question.
Light-mode meadow CTA measures **ink 4.6:1** (passes AA for normal text, marginally)
vs **white 3.39:1** (fails AA for normal text; large-text only). `meadow` is shared
(Turn on camera / I'm ready / Back to home / Keep going) and its foreground is fixed
by Constitution Principle V (amendment 1.1.0), so any global flip needs a DECISIONS.md
entry + constitution check — not made here. The temporary `/dev/button-contrast`
route is retained for that decision and MUST be deleted once it lands.

## 2026-05-31 — change(005-calibration-capture-flow) — breath pacer moved onto the orb

Visual/copy relocation, no state-machine/gate/detector logic touched.

- The stepped "Breathe in" (4s) / "Breathe out" (6s) label moved from the controls
  card BELOW the preview ONTO the breathing orb, centred over its core, so attention
  stays in one place. The duplicate label is removed from the card (which keeps the
  timer, drift nudge, reassurance, and Stop).
- The label is a FIXED-size text layer above the orb graphic: the breath glow scales
  behind it while the words never scale. The orb gains a STATIC luminous core (opaque
  pale-meadow through the centre, feathered at the rim — not a hard disc) that fully
  backs the words even at the breath's smallest (exhale) point, so the words never
  spill onto raw camera content.
- Reduced motion unchanged in spirit: static orb, the label still swaps on the 4s/6s
  cadence (instant content swap).
- Text-vs-core contrast (ink/bg over the opaque core centre, a known backing):
  ≈ 7.3:1 light / ≈ 10.3:1 dark. Over a real feed the seating + glow soften it; final
  legibility is a manual smoke check.

## 2026-05-31 — fix(005-calibration-capture-flow) — green-room camera switch re-acquires the preview (Bug 1)

- **Root cause:** the device picker's `onChange` only stored the chosen `deviceId` in
  a ref that was consumed on the NEXT `getUserMedia` (e.g. "Try again"). Switching the
  camera in the green room never re-acquired the live stream, so the preview kept the
  old device — and the camera-busy / no-camera states were unreachable by picking a
  bad device.
- **Fix:** on a device change while a preview is live, acquire the new stream first,
  stop the old tracks, and re-point the SAME persistent `<video>` at it (the framing
  guide/gate key on the node, not the stream, so they re-bind to the new feed on the
  next frame — no remount). The picker's initial echo of the already-active camera is
  a no-op (guarded by comparing the selection to the live track's `deviceId`, so no
  flicker). A busy/disconnected/blocked pick is routed to the matching camera-failure
  state, making those cases reachable for manual testing.
- **Honest test (seam = `getUserMedia` + `enumerateDevices`):** switching to a second
  enumerated camera re-calls `getUserMedia` with `{ deviceId: { exact } }` for the new
  device; a newly-picked busy device surfaces the camera-in-use state. The real
  re-acquire/guard logic runs.
- Live-feed outcomes (the preview actually showing the new camera, the busy/no-camera
  states over a real device) remain manual smoke checks.

## 2026-05-31 — fix(005-calibration-capture-flow) — busy/dead camera no longer locks the user out (Task 1)

- **Root cause (three compounding):** (1) the device picker wrote the chosen
  `deviceId` to localStorage on *selection*, before it was known to acquire — so a
  busy/unplugged pick got remembered; (2) entry acquired the remembered device with
  `{ deviceId: { exact } }` and **no fallback**, dead-ending on the camera-busy state;
  (3) "Try again" re-acquired the same remembered device. Net effect: once a camera
  was busy, every subsequent entry landed on (and was trapped on) the camera-in-use
  screen.
- **Fix — device memory now means "last camera that SUCCESSFULLY started":**
  - Persistence moved out of the picker (`device-memory.ts`); the picker only reports
    the selection. A device is remembered **only after `getUserMedia` succeeds**, so a
    failed pick is never stored.
  - Entry/"Try again" prefer the remembered device but **fall back to the system
    default** when it's unavailable (busy/unplugged), then persist whatever actually
    started — which **repairs a remembered-but-dead key**. A working camera is always
    reachable; from the green room the picker lets the user switch.
  - Only when *every* available camera (incl. the default) fails does it show the
    genuine busy/no-device state, where "Try again" still recovers once the camera is
    freed.
- **Honest tests (seam = `getUserMedia` + `enumerateDevices`; real recovery logic):**
  remembered-busy-on-entry recovers to the green room (no dead-end) and repairs the
  key; a busy pick is never remembered (the prior good camera stays); "Try again"
  after a busy state reaches a working camera once freed.
- Live-camera recovery (busy device freed, hot-unplug, all-cameras-busy) remains a
  manual smoke check.

## 2026-05-31 — change(005-calibration-capture-flow) — breathing orb redesign (lighter, calmer)

The orb read as a large, bright, hard opaque disc (too heavy). Redesigned so the
readable backing is separated from the breath and the heavy/opaque part is small:

- The opaque, readable **text backing** shrinks to a small fixed area sized to back
  the longest label ("Breathe out") with padding, **feathered edges (no hard circle)**,
  dimmed to a calm pale sage. It does NOT scale, so the words always sit fully on it,
  never on raw camera content.
- The **breath** is now a separate soft, dim, translucent, fully-feathered pool of
  light (no coin edge) — the only animated layer, gently expanding on the 4s inhale /
  contracting on the 6s exhale (eased to 0.7↔1, gentler than before).
- **Footprint reduced** (orb container 144/176px, glow 128/160px vs the old
  176/208px) so the glow leaves clear space to the framing brackets (no crowding).
  The dark seating vignette is dropped — the small opaque backing carries text
  legibility on its own.
- Reduced motion: glow held at a fixed mid-size; the label still swaps "Breathe in" /
  "Breathe out" on the 4s/6s cadence (instant content swap).
- **Text-vs-backing contrast** (ink/bg over the opaque backing centre, a known fixed
  surface): **7.04:1 light / 9.88:1 dark** — past AA (≥ AAA). Orb appearance over a
  real feed is a manual smoke check.

## 2026-05-31 — change(005-calibration-capture-flow) — preview blur 3px → 2px

The get-ready / recording preview softening is reduced from 3px to 2px — still
softened (not fully sharp), just a lighter veil over the self-view.

## 2026-05-31 — fix(005-calibration-capture-flow) — calibration banner reveals after browser Back (bfcache restore)

- **Cause:** `/app` is restored from the back-forward cache (bfcache) after a browser
  Back out of the full-document calibration flow. On a bfcache restore the page is
  frozen — Server Components don't re-run and the client tree isn't re-evaluated — so
  the banner's `useSyncExternalStore` reveal never re-fires (a manual refresh fixes
  it), and the header/theme toggle can look stale.
- **Fix (targeted, no full reload):** a `<BfcacheRefresh>` client component on the
  authed layout adds a `pageshow` listener that, **only when `event.persisted`** (a
  real bfcache restore), calls `router.refresh()`. That re-runs the route's Server
  Components — re-reading `has_anchor` so the banner conditional re-evaluates — and
  re-renders the client tree (the banner store snapshot + the header/theme toggle),
  preserving scroll and client state. It reuses the same `router.refresh()` mechanism
  the cross-tab anchor listener already uses on `/app`. Normal/fresh loads
  (`persisted` false) are untouched. The anti-flash banner behaviour (server snapshot
  → client reveal) and 004's cross-tab sync are preserved.
- **Hydration:** no hydration error found on the restore path — the banner uses the
  hydration-safe `useSyncExternalStore` + server-snapshot pattern and the theme toggle
  uses next-themes' documented `mounted` guard. (Runtime hydration cannot be observed
  headless.)
- Honest test at the I/O seam (inject the router): `pageshow` + `persisted` refreshes;
  a fresh load does not; the listener is removed on unmount. Real-browser Back-restore
  behaviour (and whether the toggle needs a scoped `location.reload()` escalation if
  it proves genuinely de-hydrated rather than stale) is a manual smoke check.

## 2026-05-31 — change(005-calibration-capture-flow) — breathing-pool contrast: light frost seat

The prior orb redesign dropped the orb's seating, leaving the animated breathing
**pool** (a dim, translucent pale-meadow fill) with nothing to contrast against — over
real webcam content it washed out and the breath motion was barely visible. The fixed
text backing was unaffected (it's opaque); only the animated pool was invisible.

- **Re-introduced a backing for the pool as a localized "light frost"** behind the orb
  — NOT the old dark-vignette seating (which read heavy/clinical), and not a hard
  opaque disc. A `backdrop-filter` (stronger LOCAL `blur(8px)` on top of the preview's
  2px, plus `saturate(0.85)` + `brightness(1.04)`) flattens whatever the camera sees
  into a smooth, low-detail, gently-lit surface, so the dim pool reads on ANY feed
  (bright / dark / busy). A faint flat white veil (`rgba(255,255,255,0.1)`) is a
  guaranteed light floor over a dark feed — and the graceful fallback if
  `backdrop-filter` is unavailable on the live `<video>`. A radial `mask`
  (`#000 0%→42%`, fading to `transparent 84%`) feathers blur + veil **together to
  nothing at the rim — no disc edge anywhere** — and keeps the frost LOCAL to the orb;
  the rest of the preview stays at 2px.
- **Footprint kept modest** (frost matches the pool box, 128/160px) so it doesn't crowd
  the framing brackets. The frost is **static** — only the pool still breathes (4s
  inhale / 6s exhale).
- **Reduced motion** (repo `useMediaQuery`, not framer): unchanged — pool held at a
  fixed mid-size, the label still swaps "Breathe in" / "Breathe out" on the 4s/6s
  cadence (instant content swap). The frost is static in both paths.
- Text-vs-backing contrast is unchanged (the opaque text backing was untouched):
  ≈ 7.04:1 light / 9.88:1 dark.
- **De-risked headless** via a static harness reproducing the exact layers over busy /
  colour / dark-room / flat-bright synthetic feeds (Chromium screenshot): confirmed the
  rim feathers with no hard edge, the frost flattens busy detail, and the pool reads
  over varied backgrounds. The orb's appearance and tuning **over a real camera feed**
  (lighting, skin tones, motion perceptibility) remains a **manual smoke check**.

## 2026-05-31 — change(005-calibration-capture-flow) — breathing pool: clearer green + opacity pulse

The frost backing (above) was the right mechanism, but the animated **pool itself**
was still too dilute to read on it: a `meadow ~26% → transparent` wash has almost no
contrast over a light frost, and its size change alone was imperceptible.

- The pool is now a **clearly green but still dim** meadow (`55% → 38% → 12% →
  transparent`) so a soft green pool reads against the light frost. Still **fully
  feathered** (no hard edge) and dim-toned — and the opaque text backing covers its
  flat centre, so the *visible* pool is the feathered ring around the words (a soft
  pool/lung, never a hard or bright coin). Footprint unchanged; text backing untouched.
- The breath now modulates **opacity in addition to scale**: scale + opacity peak
  together at the 4s-inhale (fuller / slightly brighter) and ebb through the 6s exhale
  (softer / smaller) — the lung filling and emptying — so the motion stays legible even
  when the absolute contrast over a real feed is modest. Both are transform/opacity
  only (compositor-friendly).
- **Reduced motion** (repo `useMediaQuery`, not framer): the pool is held at a fixed
  mid-size AND fixed mid-opacity (no pulse, true zero-motion); the label still swaps
  "Breathe in" / "Breathe out" on the 4s/6s cadence (instant content swap).
- De-risked the static look headless (peak vs trough over bright / dark feeds, both
  modes): clearly a soft green pool, feathered, not glaring, with a visible
  inhale/exhale delta. The **live-feed appearance and the pulse tuning remain a manual
  smoke check** (saturation/dimness judged by eye over a real camera).

## 2026-05-31 — fix(005-calibration-capture-flow) — stale banner after browser Back is a Next DEV-ONLY artifact (not a prod bug)

Supersedes the bfcache handler from `563441d`. A real-browser trace showed `/app`
served from the **disk cache** on a browser Back (`200 / (disk cache)`) — frozen at the
server-rendered state, so the calibration banner reflected a stale `has_anchor` until a
manual refresh. Investigated the actual cause and the proposed `no-store` fix:

- **`no-store` cannot be set in `next dev`.** `next/dist/server/base-server.js` hardcodes
  `Cache-Control: no-cache, must-revalidate` on every page document in dev and discards
  any computed value ("In dev, we should not cache pages for any reason"), set last —
  so the value is **not overridable** by the proxy, `next.config.ts headers()`, or a
  route segment config. Verified empirically: setting `no-store` in both the proxy and
  next.config still produced `no-cache, must-revalidate` on the wire after a restart.
- **Production is already correct and unaffected.** That dev branch never runs in a
  prod build, where `/app` is `force-dynamic` (revalidate 0) and Next emits
  `private, no-cache, no-store, max-age=0, must-revalidate` (`lib/cache-control.js`).
  `no-store` keeps it out of the disk cache, so Back revalidates on its own.
- **Conclusion: this is a Next DEV-ONLY artifact, NOT a production bug — do not
  re-investigate it as one.** `no-cache, must-revalidate` lets browsers reuse the disk
  copy on history navigation without revalidating; only `no-store` (prod) prevents it.

Fix (dev-only quality-of-life), replacing the removed `BfcacheRefresh`:

- **`BfcacheRefresh` removed** (component + test): a disk-cache Back is a FRESH document
  load (JS re-executes), so `pageshow.persisted` is `false` and the bfcache handler
  never fired — it targeted the wrong mechanism.
- **New `DevHistoryRefresh`** on the authed layout: reads the Navigation Timing entry
  and, when `type === "back_forward"`, calls `router.refresh()` to re-run the route's
  Server Components (re-reading `has_anchor`), preserving scroll + client state — the
  same mechanism the cross-tab anchor listener uses. **Gated to `NODE_ENV ===
  "development"`**; the guard is a Next-inlined literal so the effect body is
  **dead-code-eliminated from the prod bundle** (a true no-op there — no navigation
  read, no refresh, no redundant refetch on a prod back-navigation). Verified against an
  actual `next build`: `back_forward` appears **0 times** in the production client
  chunks. The anti-flash banner behaviour and 004 cross-tab sync are untouched.
- Honest test at the seams (inject the Next router + the Navigation Timing entry): dev
  back/forward refreshes, dev normal-nav does not, **prod is a no-op even on
  back/forward**. The live Back-in-dev re-sync remains a manual smoke check.

## 2026-05-31 — revert(005-calibration-capture-flow) — remove the DevHistoryRefresh dev-only banner-refresh shim

The `DevHistoryRefresh` client component (added in the entry above) is removed: it only
papered over a cosmetic DEV-ONLY issue and correlated with new dev breakage. The authed
layout returns to its pre-shim state (no import, no render, no leftover dev-gate wiring);
the component and its test are deleted.

The **explanation above STAYS** and is unchanged: the stale-banner-after-Back is a Next
**DEV-ONLY** artifact — `next dev` hardcodes `Cache-Control: no-cache, must-revalidate`
and discards `no-store`, whereas a production build's `force-dynamic` `/app` emits
`private, no-cache, no-store, max-age=0, must-revalidate` and revalidates on Back on its
own. **Production is unaffected; this is not a prod bug and should not be re-investigated
as one.** We are removing only the code workaround, not that finding.

## 2026-05-31 - spec(005-calibration-capture-flow) amendment: banner CTA meadow → foggy

- FR-043 amended: the home calibration banner's primary CTA is now the
  **foggy-filled** button treatment (dark/ink text), **not meadow**. The banner
  surface was already specified foggy; only the button colour changed.

Rationale: the banner is an **attention prompt** ("needs your attention, not
stress"), not an **affirmative confirmation** — so the CTA takes foggy (the
attention role), reusing the same `variant="foggy"` already shipped on the
failure-state and camera-access screens, rather than meadow (reserved for "you did
it" moments like the success state). This is an application of Constitution
Principle V's existing palette roles, not an amendment to them — recorded in full at
DECISIONS.md 2026-05-31 (banner CTA meadow → foggy). The T028 task line and the
Phase 9 goal/independent-test are aligned to match. Lifecycle, cross-tab mirror, and
the full-document `<a href>` navigation are unchanged.

## 2026-06-01 - test(005-calibration-capture-flow): strengthen the FR-050 egress proof

- `apps/web/tests/e2e/anchor-egress.spec.ts` now asserts, in addition to the existing
  video-signature checks (multipart `.webm`/`.mp4` clip part or `video/*` Content-Type),
  that **no outbound body of ANY kind** reaches a non-allowlisted destination across the
  green-room / mid-recording / post-success checkpoints. This closes the gap where a
  frame leak encoded as JSON / base64 / image bytes to any URL would have passed the
  video-only check undetected.
- Benign allowlist (the only destinations permitted to carry an outbound body): the
  single final `/anchor` clip POST; the Supabase host (auth/token refresh + the
  derived-hex anchor-vector REST write); and same-origin Next **server actions** matched
  by the `Next-Action` request header (the sign-in auth RPC — a bespoke frame leak would
  be a headerless fetch/beacon and stay flagged, so this is header-scoped, not a blanket
  same-origin pass).

Rationale: the prior assertion proved no *video-looking* payload egressed, but the
guarantee FR-050/SC-014 makes is that **nothing** derived from the camera frames leaves
the device for framing. The strengthened accumulator makes that the literal assertion.
The existing video checks are kept intact (added to, not replaced). Verified passing on
chromium; the DECISION-26 / FR-050 note in `docs/DECISIONS.md` is updated to describe the
two-layer check. No production code change.

## 2026-06-01 - fix(005-calibration-capture-flow): green-room gate-clear sync (helper text no longer leads)

- `apps/web/components/anchor/green-room.tsx`: the affirmative status line ("You're all
  set — start when you're ready.", with its bold treatment + inline check) now keys off
  the **confirmed, debounced** gate signal (`ready`, held for `SET_DEBOUNCE_MS`) — the
  SAME signal that already enables "I'm ready" and lights the meadow brackets/check —
  instead of the **raw per-frame verdict** (`gate === "ready"`), which flipped a render
  early. A momentarily-good frame that hasn't yet held the debounce now reads a calm
  "Almost there — hold steady." rather than a premature "all set". The gate **nudges**
  (no-face / off-centre / too-dark) still come straight off the raw verdict, so they
  surface instantly.
- `apps/web/components/anchor/green-room-gate-sync.test.tsx` (new): drives synthetic
  detector frames through the REAL `toFramingSignal` + `evaluateGate` debounce (not
  mocked green) and asserts the invariant — the affirmative line, the enabled button, and
  the meadow check all flip together at the one confirmed boundary, never a frame apart.
  Also pins the preserved detector-unavailable bypass (`ready = true` with its own "No
  live guide" copy and NO "all set" affirmative).

Rationale: alignment of the implementation with already-intended behaviour (FR-008's
single gate-cleared moment), **not** a design-principle change — so no DECISIONS entry.
`SET_DEBOUNCE_MS` is unchanged (it still prevents the affirmative from flickering on a
momentary detection); the fix makes the text respect that same debounce rather than
firing on the raw signal. The inset-glow coexistence (affirmative brackets ⟷ enabled
"I'm ready"), the detector-unavailable bypass, and the reduced-motion static affirmative
are all untouched and verified by the existing suite (161 anchor tests green).

## 2026-06-08 — docs(005-calibration-capture-flow) — T033 finalisation + the remaining 005 deltas

Closes feature 005's implementation record (Principle VIII). `docs/DECISIONS.md` gains the
collected, finalised **📌 DECISION-19 through DECISION-28** block (folding the 2026-05-31
DECISION-22/23/25 drafts and the two dated-but-unnumbered notes — banner CTA meadow→foggy →
DECISION-28, e2e-seam / FR-050 egress → DECISION-26 — into the numbered scheme);
`docs/PROGRESS.md` gains the running feature-005 entry. The 005 deltas not yet individually
logged are recorded here so the changelog set is complete:

- **Home calibration banner amber → foggy (+ foggy CTA).** 004's amber `/app` calibration
  banner is restyled **foggy** (surface border + bg) with a **foggy-filled** "Set baseline"
  CTA — attention, not affirmative (the CTA-colour finalisation was logged 2026-05-31; this
  records the full amber→foggy surface change as a 004→005 delta). Amber stays reserved for
  stress signals (Constitution Principle V); the banner is calm-attention.
- **Old feature-004 calibration UI fully removed; redesigned recorder remounted.** No 004
  calibration stragglers remain referenced; `<AnchorRecorder>` mounts at both the onboarding
  first-time capture and the standalone `/app/calibrate` route (clarification #1).
- **Scoped CSP `'wasm-unsafe-eval'` on the capture routes — REPORT-ONLY.** `proxy.ts`
  appends the allowance (+ provisional `worker-src 'self' blob:`) only on `/onboarding` and
  `/app/calibrate` so the self-hosted detector WASM compiles; no `connect-src` host added,
  COEP unset. **It ships report-only. Flipping it to ENFORCE (T004) is a hard pre-ship
  deploy blocker** — see `docs/BACKLOG.md` "Before the 005 detector ships"; the detector must
  not reach production under report-only.
- **No migration / no backend / no contract / no seed change.** The whole feature is UI /
  read-path only — it reuses 004's extraction service, the `/healthz` gate,
  `has_anchor(auth.uid())`, and the owner-side anchor write verbatim
  (`contracts/backend-unchanged.md`). The recalibrate overwrite is the same single in-place
  `profiles` `UPDATE` (no baseline-history table).
- **Device-memory fix (T029 / DECISION-25).** `device-picker.tsx` re-persists the resolved
  default camera when the store is cleared, without clobbering a stored-but-temporarily-
  absent device; an honest Vitest fails against the pre-fix code.
- **Static guardrail scan (T030).** A source scan over the 005 surfaces asserts zero
  `amber`/`crimson` tokens and zero exclamation marks / blocklist terms ("detected",
  "REQUIRED", "MANDATORY", "alert", "abnormal", "elevated risk") on any calibration or error
  surface.

Already logged this cycle and unchanged: the green-room gate-clear sync (2026-06-01), the
two-layer FR-050 egress proof (2026-06-01), and the busy/dead-camera lockout fix
(2026-05-31). No Cloud-dashboard parity items — all edits are in-repo. No code change in this
entry (docs only).
