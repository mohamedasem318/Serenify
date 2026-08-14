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

## 2026-06-16 — fix(ml-video, PR #18) — VFR-webm decode mis-sampling fix

Branch `fix/webm-vfr-decode-sampling` (off `main`). Browser `getUserMedia`/`MediaRecorder`
uploads are variable-frame-rate VP9 webm whose OpenCV `CAP_PROP_FPS` / `CAP_PROP_FRAME_COUNT`
are unreliable — a real capture read `fps=1000.0`, `frame_count=11452` for a 269-frame clip,
and two same-format captures read 8.4 vs 1000 fps. The legacy `skip_ratio =
round(reported_fps/5)` downsample then collapsed the kept-frame count **nondeterministically**
(126 frames one run, 4 the next for equivalent input), silently degrading feature fidelity on
every live capture and intermittently false-rejecting good baselines.

- **Fix.** Frame selection is now driven by actual frame timestamps (`CAP_PROP_POS_MSEC`).
  Hybrid + container-agnostic: CFR inputs (regular intervals + fps matching the timestamps)
  keep the legacy index selection **bit-for-bit** (mp4/avi unchanged at any frame rate); VFR
  inputs sample on a 2.5 fps timestamp grid → ≈150 frames per 60 s regardless of garbage
  metadata; unusable timestamps fall back to legacy. Two-pass decode (`grab` for timestamps,
  then retrieve only the kept frames). **No new dependency** — `POS_MSEC` was reliable and
  monotonic, so the FFmpeg transcode-to-CFR fallback was not needed.
- **Validation.** Real webm captures now yield kept ≈ 150 consistently across reported_fps
  8.4 / 1000 / mismatch; `usable ≈ kept`; CFR mp4 (30 fps) and avi (24 fps) select identical
  frames to before. New `packages/ml-video/tests/test_vfr_sampling.py`; ml-video 15/15 +
  apps/api 11/11 green; ruff clean.
- **Scope.** Decode sampling only — the usable-face-coverage gate, the `DecodedClip` contract,
  feature dimensions, and all HTTP responses are untouched. A quiet `logger.debug` decode line
  and a DEV-only webm recorder (`packages/ml-video/tools/dev_webm_recorder.html`, for the
  fidelity re-check) were added. Full rationale + residual caveat in **📌 DECISION-29**.

Awaiting the operator's merge of PR #18. This entry is documentation only — the code landed
earlier on the branch.

## 2026-06-16 — feature-ordering drift: slot 006 realised as `006-calibration-capture-quality`

The constitution's **provisional** feature ordering (§ Spec-Driven Workflow) listed slot 006
as `006-stress-inference-service`. The feature actually built in slot 006 is
**`006-calibration-capture-quality`** — a backend correctness fix (the usable-face-coverage
gate) that 005 smoke testing made urgent: a 60 s baseline with the face in frame for only ~2 s
was being silently accepted, poisoning every later delta-from-baseline reading (Principle II).
Fixing the calibration *input* gate must precede building the inference *read path* that
consumes those baselines, so the stress-inference-service work moves to a later slot.

Principle VIII permits provisional reordering **when recorded** — this is that record. (005
DECISION-23 already anticipated "feature 006's inference read path"; that reference now points
to the later slot.) No spec content changed; this is an ordering/naming note only.

## 2026-06-16 — recalibration(006) — coverage gate `MIN_COVERAGE_FRACTION` 0.40 → 0.65 on real webm

The usable-face-coverage gate was **recalibrated against real browser-webm clips** after the
VFR-timestamp decode fix (DECISION-29) landed. The original `0.40` was set from three clips
measured through the *pre-fix* decode, in a "wide empty gap" with no intermediate sample.

- **What changed.** `MIN_COVERAGE_FRACTION` raised **0.40 → 0.65** (`MIN_USABLE_FRAMES = 50`
  unchanged), in `packages/ml-video/src/ml_video/coverage.py`. 📌 **DECISION-32** rewritten with
  the real-webm figures and rationale; the stale mp4 figures (`thin 4/172/0.023`, good clips
  `154`/`129`) are superseded.
- **Fixtures.** The committed `.npy` landmark arrays were **regenerated from the four `.webm`
  clips** through the fixed pipeline, and a new **`half.npy`** (the ~30 s-present / ~30 s-absent
  boundary clip) was added. Raw clips remain uncommitted (gitignored — Principle I/X); only the
  derived `.npy` are tracked (≈1.1 MB each, four total ≈ 4.4 MB).
- **Measurements (pinned env, Python 3.12.13 / mediapipe 0.10.13; all on the VFR decode path).**
  `thin 11/150/0.073` (reject), `good-ideal 150/150/1.000` (accept), `good-realistic
  151/151/1.000` (accept), `half 77/150/0.513` (**now reject** — coverage lever, 0.137 margin).
- **Rationale.** good-realistic held at 1.000 despite natural look-aways (FaceMesh tracks
  through seated glances → honest captures cluster at ~1.0, so 0.65 does not clip them); `half`
  at 0.513 validates coverage ≈ fraction-of-minute-present, so `0.65 ≈ "face present ≥ ~40 s of
  60 s"`. The anchor is the reference every later delta is measured against, so a half-absent
  baseline is rejected (a redo is cheap; a poisoned baseline corrupts every downstream reading).
- **Tests/docs.** Added `test_real_half_fixture_is_rejected` and updated the real-fixture
  expectations in `test_usable_face_coverage_gate.py`; smoke-tests gain a documented half-reject
  case (§1b). Provisional — one intermediate datapoint; the reject rate is observable via the
  server reject log (counts log-only, never on the wire — FR-016), so the threshold is tunable
  from real-user data later.

Measurement + threshold decision made by the operator from the real clips; this entry records
the implementation on the `006-calibration-capture-quality` branch.

## 2026-06-17 — Feature ordering correction (Constitution Amendment 4)

Provisional feature ordering updated: 006 realized as
`006-calibration-capture-quality` (was provisionally `006-stress-inference-
service`); `007-visual-redesign` inserted ahead of the remaining product
features, shifting them +1. Cross-references updated: Principle III fusion
015→017, Principle IV audio 013→015. Recorded per Principle VIII (ordering is
provisional; changes logged here).

## 2026-06-18 — impl(007-visual-redesign): Graphite re-skin + two bespoke components

The Graphite visual redesign shipped as a pure re-skin + re-type + the listed
targeted changes — no application logic, routing, data-model, Supabase, ML,
API-contract, or auth-logic change (FR-001 / FR-004). What landed:

- **Tokens.** The nine `@theme` role tokens swapped to the Graphite light/dark
  values (names unchanged); three new real tokens added — `--color-on-accent`,
  `--color-meadow-text`, `--color-scrim`. `@theme inline` (the shadcn alias
  layer) untouched; `--color-muted` kept outside it.
- **Type + fonts.** Type scale via overriding Tailwind v4's `--text-*`
  (17px base body); `Outfit` display + `Inter` body wired in the layout, `DM
  Serif Display` retired everywhere; wordmark now lowercase `serenify` (no dot)
  in all three locations.
- **Contrast fixes.** Filled meadow/foggy CTA foreground fixed at the button
  primitive (`on-accent` light / `bg` dark); small meadow text → `meadow-text`;
  errors are foggy soft-tints everywhere (the OTP amber error box retired); the
  account-menu dropdown hover → a foggy/15 soft-tint with ink text. All
  documented pairings verified at WCAG AA in both modes.
- **Finish.** Zero glassmorphism — the breathing-orb `backdrop-blur` frost
  removed in favour of a layered meadow bloom; all scrims re-tokenised to
  `bg-scrim`; dark `--shadow-soft` deepened so the single soft shadow still
  reads.
- **Bespoke components.** The OTP six-box → "Verified" pill merge and the
  breathing-orb bloom, both gated for reduced motion via the repo's
  `useMediaQuery` hook (zero use of framer's `useReducedMotion`).

Full as-built decision records are in `docs/DECISIONS.md` (2026-06-18 entries).

**Deviation (Principle VIII)**: FR-024 specifies the verified OTP pill "lifts
toward the next step." As implemented, the pill **fades out** (`opacity → 0`)
before the handoff instead of lifting — a vertical lift overlapped the incoming
next view during the calm ~3s pacing. Behaviour is otherwise unchanged
(`router.replace(successHref)` + `refresh`, copy, validation, and the
reduced-motion fallback). Recorded in DECISIONS 2026-06-18.

Documentation note (no spec change): the planning-time DECISIONS entries of
2026-06-17 sketched a 16px base and an orb "progress ring"; the as-shipped values
are a 17px base (FR-011) and a preview-hugging progress **bar** (FR-030). The
2026-06-18 DECISIONS entries record the as-built mechanism; no FR changed.

## 2026-06-18 — copy(007): trim redundant retry CTA from calibration failure/access notices

Smoke-test finding: the small foggy reason-banner on the calibration **failure**
screen repeated the call to action the screen already gives (the heading + the
"Try again" button), so it now states the **reason only**. The same trim is
applied to the other failure causes and to the camera-access / backend-down
notices for consistency — reason/fix only, with the retry CTA carried solely by
the on-screen button.

This is a deliberate **deviation from the verbatim-copy stance**: FR-001/FR-002
preserve the *meaning* of copy, and these edits remove only the duplicated retry
CTA — the reason's meaning, each notice's fix instruction, and the reassurance
are all unchanged. The foggy soft-tint treatment and icons are untouched.

Trimmed (before → after):

- failure `insufficient-face`: "…enough of that recording — let’s try again." →
  "…enough of that recording."
- failure `our-side`: "This one was on our side — give it a moment and try
  again." → "This one was on our side."
- camera-access `blocked`: "…in your address bar, then try again." → "…in your
  address bar."
- camera-access `busy`: "…Closing it frees it up, then try again." → "…Closing
  it frees it up."
- camera-access `no-device`: "…pick it from the selector and try again." → "…pick
  it from the selector."
- backend-down body: "We can’t set your baseline just now. Give it a moment and
  try again — nothing’s lost." → "We can’t set your baseline just now — nothing’s
  lost."

Untouched: the `low-light` / `out-of-frame` chips (advisory tips, no retry CTA);
every heading, subtext, and the "Try again" / "Not now" buttons.
`failure-state.test.tsx` was updated to pin the trimmed `our-side` copy.

## 2026-06-18 — fix(007): OTP boxes stay on one line (SC-004 "may wrap" fallback superseded)

Smoke-test finding (~640px): the sixth OTP box wrapped to a second line. Root
cause: the boxes were sized off the **viewport** (`w-[clamp(44px,12vw,52px)]`)
inside the fixed-width (`max-w-md`) auth card — as the viewport widened the boxes
ballooned to their 52px max while the card stayed narrow, so the row overflowed
and `flex-wrap` dropped the sixth box.

`components/ui/auth/otp-boxes.tsx` now sizes the boxes to the **container**, not
the viewport: a non-wrapping row (`flex w-full flex-nowrap`, 8px gap) of
`flex-1 min-w-0 max-w-[52px]` boxes at a fixed 52px height. Verified on the real
auth card — **six boxes on one line with no overflow at 360 / 640 / desktop**:
42px-wide × 52px-tall at 360px (height keeps the ≥44px touch target; width is
above the ~40px floor), 52×52 from ~600px up. The success merge still lines up
(boxes slide edge-to-edge, meadow-filled, centred on the card — verified live).

This is a deliberate **deviation that supersedes the SC-004 "the boxes … may
wrap" fallback**: at 360px they now shrink to one line rather than wrapping (a
strict improvement on SC-004's intent). No unit/e2e test asserted the wrap
behaviour, so none needed changing; the `otp-panel` behaviour tests stay green.
The spec/smoke-tests text still says "may wrap" — reconcile there if desired.

## 2026-06-18 — feat(007): calibration-intro accents foggy → meadow soft-tint

Design refinement (smoke-test): on the calibration intro ("Set your calm
baseline") the three setup-hint icon tiles and the privacy-note shield used
**foggy**, which competed with the meadow CTA on what is a calm, affirmative
setup screen. Recoloured these **informational/affirmative accents foggy →
meadow soft-tint** (kept soft-tint, never solid — the meadow CTA remains the
single solid focal point), in `components/anchor/intro.tsx`:

- setup-hint icon tiles: `bg-foggy/15 text-foggy` → `bg-meadow/10 text-meadow-text`
  (icon clears the ≥3.0 non-text bar: 4.69:1 light / 6.45:1 dark)
- privacy-note shield icon: inherited `text-muted` → `text-meadow` (4.22:1 light /
  7.43:1 dark); heading/body text unchanged.

Deliberate **Principle-V refinement** — calm informational/reassurance accents =
meadow soft-tint; foggy reserved for attention/error (see DECISIONS 2026-06-18).
This is **not** a blanket foggy→meadow swap: every attention/error surface stays
foggy (OTP wrong-code, calibration failure banners, the off-center nudge,
camera-access-denied, backend-down, auth error `role="alert"` notices, and the
home calibration attention banner). No unit test pinned these classes, so none
needed changing.

## 2026-06-19 — spec(008-stress-inference-service) — mock-gap resolutions + one missed state (folded into the plan)

Seven decisions handed down by the mock owner after spec review, folded into
`specs/008-stress-inference-service/plan.md` (and `research.md`). They resolve the
spec's three Mock-Gap open questions (MG-1/2/3) and add one operational state the
spec missed. Per Constitution Principle VIII, the committed `spec.md` is **not**
retroactively edited; the deltas are recorded here and the updated mock
`serenify-008-monitoring-mock.html` is the visual contract.

1. **Warming-up is a 7th operational state.** Before the first window completes
   there is no reading. A calm, neutral-bloom **warming-up** state ("getting a read
   on things") shows until the smoothing buffer holds enough readings (plan D-3
   cold-start). **FR-004 delta** — the operational-state list becomes: permission,
   **warming-up**, active, out-of-frame, paused, blocked, ended (plus the transient
   skipped-read note and the calibrate-first surface).
2. **First displayed reading at ~90 s, not ~60 s.** The first state the user sees
   must already be smoothed, so the display holds warming-up until the cold-start
   gate clears. **SC-001 delta** — first smoothed reading within **~90–105 s** (was
   ~60–75 s), then ~every 10 s.
3. **"Couldn't read this window" gets its own affordance** — a quiet **foggy
   "skipped a read" note**, NOT the out-of-frame surface (a coverage failure can
   occur while the user is plainly in frame — glare/low light — so "move back into
   frame" would be wrong). It names the likely cause + a gentle fix, reusing the
   feature 005/006 cause vocabulary (`dominantCause`); the bloom keeps the last
   smoothed state underneath and capture continues. **FR-013 clarified** (it no
   longer reuses the out-of-frame surface verbatim). Resolves **MG-2**.
4. **Calibrate-first surface (no-anchor, US3)** — a **foggy** attention panel (not
   stress) with a short line and a **"Start calibration"** action routing to the
   calibration flow (forward button is **meadow** per Principle V). Resolves
   **MG-1** (FR-011 / SC-004 visual).
5. **Mobile (≥ 360 px) monitoring stage stacks** — bloom shrinks, controls go
   full-width and stack, pill/viewfinder reposition (Principle VI). Resolves
   **MG-3** (FR-025).
6. **"Ended" is not a monitoring-page screen.** Ending returns the user to the
   **dashboard with an updated recap**; no standalone ended screen is built.
   **SC-010 delta** — "ended" is verified as the return-to-dashboard-with-recap
   transition, not a distinct visual.
7. **Idle recap empty state.** A calibrated user who has never run a session has no
   "last session"; the idle check-in card shows a graceful empty state ("Start your
   first check-in") rather than a blank/broken recap. (FR-019 refinement.)

Also recorded in the plan (not a spec gap, but a contract clarification):
`metadata.json` carries a stale `window_eval_config` (30 s) alongside the
authoritative 60 s `loso_metrics_60s_calibrated` block — the production window is
**60 s** per Constitution Principle II + `docs/MODELS.md`; the 30 s block is not
used (research R-0 flags it for cleanup).

## 2026-06-19 — plan(008-stress-inference-service) — D-1 + D-2 reopened after review (amendment)

Two plan decisions were changed by the maintainer after review (full reasoning in
`docs/DECISIONS.md` 2026-06-19 amendment). Plan artifacts updated on the
`008-stress-inference-service` branch: `plan.md`, `research.md`, `data-model.md`,
`contracts/inference-api.md`, `quickstart.md`. No spec FR/SC wording changes; this
is a plan-level amendment.

- **D-1 (revised) — no service-role; self-scoped `SECURITY DEFINER` read.**
  `apps/api` gains **no** broad DB credential (DECISION-9 posture preserved). The
  anchor is read by `public.get_my_anchor()` (filters on `auth.uid()`, EXECUTE to
  `authenticated` only), called by the API **as the user** via the forwarded access
  token + the **publishable anon key**. Sessions/readings are written **under RLS as
  the user** (insert-own/select-own/update-own); raw `stress_probability`/`label`
  stay server-only via the SELECT column whitelist (so the API, not the browser,
  writes the row). **Constitution Check delta**: Principle IX now has **no new
  secret** (publishable anon key only) — stronger than the original; the service-role
  Complexity-Tracking row is removed. **Write-integrity deferred** (a user could
  fabricate their *own* readings; managers see nothing; upgrade path = a dedicated
  INSERT-only role, not built now). *Superseded*: original service-role read.
- **D-2 + R-5 (revised) — single-recorder ~10 s segments + server-side 60 s
  assembly.** The client streams ~10 s segments from a **single** `MediaRecorder`
  (timeslice); the **server** buffers the last 6 and assembles the rolling 60 s
  window (transient, in-memory, cleared on pause/end, deleted in `finally`). One
  encoder instead of ~6 → lighter on mobile, ~6× less bandwidth, defensible for
  fragile Safari `MediaRecorder`. **⚠ Flagged**: the preferred frame-level
  concatenation is **not directly feasible** (timeslice chunks aren't independently
  decodable; the shared extraction is single-file/path-based), so **container-level
  reassembly** is required — recommended path B1, with the R-7 Safari spike de-risking
  decodability (Chrome webm + Safari fMP4) and a B2 fallback (standalone segments + a
  new multi-clip extraction entry, a package change) if it fails. *Superseded*:
  client-assembled windows / staggered recorder pool.
- **Safari/WebKit early validation (R-7)** is front-loaded as one of the first
  `/speckit-tasks` items (real Safari/iOS, not Playwright-only).
- **`metadata.json` hygiene** confirmed as metadata/doc-only — **no `model_version`
  bump, no anchor invalidation**, model artifact not edited (backlog/task note,
  flagged for the model owner).

### 008 windowing amendment (2026-06-19) — B1 NO-GO → B2 (supersedes the D-2/R-5 bullet above)

- **B1 (single timeslice recorder + server-side container reassembly) is REJECTED —
  R-7 structural NO-GO.** Reasons: `[chunk0 + recent tail]` isn't a clean trailing
  60 s without container surgery; the splice's time discontinuity **silently corrupts
  `motion_features`** (spurious diff inflates max/std across the 2868 motion dims — a
  decode can "succeed" yet be wrong); webm timeslice boundaries aren't guaranteed
  cluster-aligned. Verdict accepted as-is; a B1 harness at `_scratch-008-b1-spike/`
  allows optional confirmation but the decision doesn't wait on it.
- **B2 is ADOPTED — standalone clips + server-side frame concatenation.** The client
  **stops/restarts** the recorder every ~10–12 s so each clip is standalone and
  independently decodable; the server buffers the last ~6 clips, **decodes each and
  concatenates the sampled frames** into one ~150-frame / ~60 s set for LBP-TOP +
  motion. Privacy unchanged (transient, in-memory, cleared on pause/end, deleted in
  `finally`). Adds **one new public `ml-video` entry** `compute_anchor_multiclip`
  (reuses the per-clip internals — not a second copy; Principle III).
- **R-7 is now two front-loaded, gating checks**: (1) B2 capture validation on real
  Chrome + Safari/iOS (not Playwright); (2) a multi-clip extraction **fidelity HARD
  GATE** (continuous clip vs ~6 stop/restart clips within tolerance). The R-6
  webm/VFR **codec** check stays scheduled hardening. *Superseded*: the B1 path in the
  bullet above.

### 008 spec back-ported to the resolved decisions (2026-06-19)

- **`spec.md` reconciled** (it had been left stale while the plan amended decisions
  late; `/speckit-analyze` flagged the drift). The spec now matches — never reverts —
  the authoritative plan resolutions: **SC-001/US1 timing 60–75 s → ~90–105 s**;
  **`warming-up` added as the 7th operational state** (FR-004, SC-010); **FR-013 / the
  thin-window edge case → a distinct foggy "skipped a read" note** (not the out-of-frame
  surface); **FR-014 → D-3 resolved** (trailing mean of 4, bands 0.53/0.70, 4-reading
  cold-start, server-side); **FR-019 → recap empty state**; **Deferred Decisions D-1…D-4
  and Mock Gaps MG-1/2/3 annotated RESOLVED** (D-1 = self-scoped `get_my_anchor()`, no
  service-role; D-2 = session-aware + B2 windowing; ended→dashboard; idle empty state);
  Test Plan Notes + Principle VII note the **B2 multi-clip fidelity HARD GATE**. A
  reconciliation note at the top of the spec records this.

## 2026-06-19 — plan(008-stress-inference-service) — windowing D-2 REVERSED: B2 rejected → continuous single-stream upload

Reverses the **D-2 + B2** windowing decision (the "B1 NO-GO → B2" amendment above). Full
reasoning + numbers in `docs/DECISIONS.md` (2026-06-19 — *feature 008 windowing DECISION*).
Plan artifacts updated on the `008-stress-inference-service` branch: `research.md` (D-2,
R-5/R-6/R-7), `plan.md`, `contracts/inference-api.md`, `quickstart.md`, `spec.md`, `tasks.md`
re-issued; `data-model.md` unchanged (no assembly). **Everything else stands**: D-1, D-3, D-4,
the 60 s lock, the 0.53 re-threshold, the transport deviation, the seven mock-gap resolutions.

- **B2 is REJECTED.** The single-source re-fixture (identical source content, losslessly
  re-segmented — no new recording) showed B2's multi-clip frame-concat assembly reaching only
  **cosine 0.991 (< 0.999)**, with a **~14% motion-magnitude shortfall** and **only 31.5% of
  sampled frames coinciding** with continuous sampling — a **per-clip sampling-phase reset**
  (each standalone clip re-applies the 2.5 fps grid from its own `t≈0`; `POS_MSEC` resets per
  clip). The earlier **cross-take fixture was a real flaw** (it conflated assembly fidelity with
  recording reproducibility) and is corrected — the single-source fixture is the right test —
  but **even corrected, B2 cannot hit fidelity**, and the residual is **not patchable** for real
  clips (a real stop/restart clip has no global clock; the variable restart gaps are lost).
- **Continuous single-stream upload is ADOPTED.** *Client*: **one continuous `MediaRecorder`**
  (timeslice for incremental capture only — no stop/restart); each stride uploads the
  **contiguous recording-so-far** (init + all chunks in order — always decodable, the proven
  reliable case), no clip stitching. *Server*: decode the uploaded continuous clip and extract
  the **last 60 s** with the **existing validated single-clip path** (`compute_anchor` + the
  VFR `POS_MSEC` sampler) bounded to the trailing window (frames with timestamp ≥
  `duration − 60 s`); **no multi-clip assembly**. The only ml-video change is a thin
  **tail-window option** on the existing extraction.
- **Faithful by construction → no new fidelity gate.** The scored window is a genuine
  continuous 60 s segment sampled by one continuous grid — exactly the single-clip input the
  extraction is already validated on. **`compute_anchor_multiclip`, `test_multiclip_fidelity.py`,
  the seam-aware motion helper, and the multi-clip HARD GATE are retired** (kept in git history;
  the single-source diagnostic + finding stay recorded).
- **Windowing validation is now much lighter.** No fidelity gate. The remaining real-device
  check (reusing the proven `/anchor` upload+extract path): continuous capture + growing upload
  + last-60 s tail-extract **works** on real Chrome + real Safari/iOS and **keeps up** (per-stride
  server time within the 10 s stride across a 5-min session). **Real Safari/iOS stays the
  pre-production gate** but as a *works-and-keeps-up* check, not a fidelity gate.
- **⚠ Known cost (flagged)**: upload size + the server's decode-to-tail work **grow over the
  session** (bounded by the 5-min cap; negligible on localhost). VFR seek is unreliable, so
  reaching the tail means sequential decode of the growing file — at the 5-min cap ~300 s/stride,
  needing ≥ ~30× realtime decode to stay inside the 10 s stride; **plausible at low res, not
  guaranteed for 720p VP9 on the droplet**, so late-session strides may exceed 10 s. Bounded,
  not fatal (FR-016 non-blocking; cadence degrades, 5-min cap bounds it). Mitigation = the
  already-deferred **server-side rolling decoded-frame buffer** (decode only the newest
  increment) — kept deferred, built before long droplet sessions in production.

## 2026-06-19 — docs(008-stress-inference-service) — corrective docs/tasks pass before `/speckit-analyze` (no code, no decision reversal)

Closes three gaps found in the re-issued `tasks.md` + `research.md` after the continuous
single-stream windowing decision. Windowing is **not** reopened; D-1 / D-2 (continuous) / D-3 /
D-4, the seven mock-gap resolutions, the 0.53 re-threshold, and Principles I/V/VI/VII stand.
Docs/tasks only — no feature/test/fixture code, no model artifact, no `model_version` bump. Full
entry: `docs/DECISIONS.md` 2026-06-19 (*corrective docs/tasks pass*).

- **Faithful-by-construction is now enforced, not assumed.** T005 mandates sampling on the
  **file-global grid (anchored at t=0)** then *filtering* to the trailing 60 s — with an explicit
  prohibition on the trim/seek-and-resample that re-zeroes `POS_MSEC` (the B2 failure mode). T006
  adds a deterministic, **CI-runnable integer-index suffix-equality invariant** on synthetic VFR
  timestamps (no video, no tolerance) that the deferred rolling decoded-frame buffer must keep
  passing. R-5 ties faithfulness to the preserved grid + this guard.
- **Keep-up reasoning corrected + completed.** Budget bar tightened to decode within
  `(10 s − extract)` ≈ 5–7 s / ~43–60× realtime (not the full 10 s / ~30×). Keep-up split into
  *growing decode-to-tail* (rolling buffer fixes) vs *constant extract* (~10–15 s/window on the
  droplet — buffer does **not** fix; lever is slower cadence or GPU). T008 now records
  decode-to-tail and extract times **separately**; T009 diagnoses which component breached.
  Droplet figures flagged indicative-only (droplet being phased out for Azure / HuggingFace).
- **B2 retirement made complete + non-breaking (locked to resolution (a) — inline).** T004 now
  **deletes `compute_anchor_multiclip` + `motion_features_seamaware` from the package source
  entirely** (active source carries zero retired B2 code) and **inlines** their assembly logic
  into the kept single-source diagnostic so it stays runnable; plus a repo-wide reference sweep,
  deletes `_scratch-008-b2-spike/`, and removes the orphaned cross-take fixtures
  (`multiclip/chrome/`, `multiclip/safari/`) while keeping the single-source fixture
  (`multiclip/chrome-singlesource/`).

## 2026-06-21 — impl(008-stress-inference-service) — keep-up: the flagged O(elapsed) decode breach RESOLVED via surgical O(stride) tail-decode (ffmpeg-CLI)

Implements the "known cost" the continuous single-stream windowing decision flagged
(the 2026-06-19 windowing-reversal entry above): under continuous upload + server
tail-extract, the server re-decoded the **whole growing recording-so-far** every window
just to read its last 60 s — per-window decode **O(elapsed)**. The 2026-06-20 supervised
live smoke confirmed the breach: live reading lag *grew* ~9 s/window to ~3 min behind
(SC-001 missed). Full reasoning + numbers in `docs/DECISIONS.md` (2026-06-21 — *feature
008 keep-up: SURGICAL O(stride) tail-decode*); shipped in commit `1ef0c0c`. **No spec
FR/SC, plan-decision, contract, or model-artifact change** — the windowing decision
(continuous single-stream), D-1/D-3/D-4, the 60 s lock, the upload contract,
`score_window`, the M=4 cold-start, the `(2958,)` shape check, RLS, the SELECT whitelist,
and JWT all stand. This is an implementation amendment to *how the trailing window is
decoded*.

- **The prescribed primitive does not exist; a faithful one does.** "Seek to a keyframe
  then decode forward" assumed OpenCV can seek — it **cannot** on an un-finalized
  `MediaRecorder` webm (no Cues index): `cap.set(POS_MSEC/POS_FRAMES)` returns `True` but
  is a **silent no-op that rewinds to t=0**. The realizable primitive: a cheap ffprobe
  **packet** read (demux only) for the file-global 2.5 fps grid + duration, then decode
  **only the bounded trailing 60 s** — OpenCV native `cap.set` for mp4 (seekable), an
  **`ffmpeg -c copy` lossless tail remux → OpenCV decode** for webm. Frames are matched
  back to the file-global grid, so the kept set is the **identical suffix** the whole-file
  path keeps. (A direct ffmpeg `bgr24` decode is NOT bit-identical to OpenCV — a YUV→BGR
  shift, Chrome cosine 0.999055; the `-c copy` remux keeps OpenCV as the decoder.)
- **Surgical, `packages/ml-video` only.** `pipeline._extract_landmarks_tail` +
  `probe_global_timestamps_fast`, dispatched from `extract_landmarks(tail_seconds=…)` and
  `anchor.probe_recorded_seconds`. Stateless (no cross-window frame cache, no reused
  FaceMesh), so it carries no continuity-fidelity risk and needs no new fidelity proof.
- **Gated build (both proven before commit).** **GATE 1 (fidelity)**: bit-identical to the
  whole-file path — max|Δ|=0, cosine=1.0 — on the real chrome+safari continuous fixtures
  (`tests/test_tail_seek_keepup.py`, local-only/ffmpeg-gated; the CI suffix-invariant
  stays T006). **GATE 2 (keep-up)**: per-window total **O(elapsed) 18→55 s (grows 3.1×) →
  O(stride) flat ~9–13 s**; the `<60 s` gate alone 3.2→15.3 s → 0.1–0.8 s.
- **New host dependency: the ffmpeg/ffprobe CLI** (Dockerfile + `apps/api/README.md`).
  **Absent → graceful fallback** to the whole-file OpenCV decode (correct, O(elapsed)) so
  CI / degraded deploys keep working; **runs-but-fails on a clip → skipped window** (200),
  never a 500. Five CI-runnable robustness tests lock this. (Re-run
  `test_tail_seek_keepup.py` on the deploy image so an ffmpeg version difference can't
  silently shift fidelity.)
- **Re-validated on a representative deploy target.** Re-measured on an **Azure VM
  (Standard_D2s_v4, 2 vCPU)**: **~7–8 s/window**, comfortably under the 10 s stride, and
  fidelity stayed bit-identical on the VM's older apt ffmpeg — confirming the surgical fix
  is sufficient on a realistic CPU target without the heavier rolling buffer.
- **Option 2 stays deferred.** The full per-session **rolling decoded-frame buffer**
  (decode only the newest ~10 s increment → true O(stride) ~1.5 s decode) is the upgrade
  to build **only if** keep-up re-measured on the chosen deploy target breaches the stride
  there (logged in `docs/BACKLOG.md`, feature-008 keep-up entry). The read loop also still
  needs back-pressure (no new stride while one is in flight) — same deferral.

No Cloud-dashboard parity items — all changes are in-repo (`packages/ml-video`, Dockerfile,
`apps/api/README.md`).

## 2026-06-22 — feat(008-stress-inference-service) — feature complete; two pre-merge silent breaks fixed (PATCH-CORS + stale-token-401)

Feature 008 reaches **feature-complete, merge-pending**. What ships is the live video
stress-inference read path: **continuous single-stream capture → server tail-extract of the last
60 s → per-user-calibrated RandomForest on LBP-TOP + motion → a smoothed three-band read
(At ease / A little tense / Tense), with no probability ever on the wire** — plus the session
lifecycle (pause/resume/out-of-frame/end, one-active-session-per-user, auto-pause after 90 s
no-face / auto-end after 5 min absence), the calibrate-first gate (no anchor → a foggy
calibrate-first surface, never a fabricated reading), the retrospective **today** recap that
expands in place from the **same** persisted rows (SC-008), and the FR-020 009 seam (the persisted
`window_readings` shape supports 009's sustained-tense query; **no** questionnaire built in 008).
Privacy posture: **no service-role key** anywhere in `apps/api` (all DB I/O is RLS-as-the-user via
the forwarded JWT + the publishable anon key), the SELECT column whitelist holds `label` +
`stress_probability` server-only, **no manager policy** on either table, and the uploaded clip +
temp file are deleted in a `finally`. US1–US4 + Phase 8 polish complete; the Phase 8 smoke matrix
(T054) ran on real Chrome / Firefox / iPhone Safari. **No spec FR/SC, plan-decision, contract, or
model-artifact change** in this entry — it records completion + the two pre-merge fixes; full
decisions in `docs/DECISIONS.md` 2026-06-22.

The smoke surfaced two **silent** breaks (a wrong result with no error shown to the user); both
were fixed **in-branch before merge** and **verified server-side**. Visible/cosmetic smoke findings
are routed to `008-followups`.

- **PATCH-CORS — lifecycle transitions silently never persisted** (commit `7c1c1f4` fix +
  `241b296` preflight regression test). The API CORS config did not allow `PATCH`, so the browser
  preflight for the monitoring lifecycle PATCH (pause/resume/out_of_frame) failed and the status
  transition never reached the DB — with no surfaced error. Fixed by allowing `PATCH` in the CORS
  method list (`apps/api/app/main.py`); **server-side-verified** by walking the DB status
  `active → paused → active → out_of_frame → ended`, with the `409`-on-ended terminal and the
  one-active-session finalize intact.
- **Stale-token 401 — long sessions silently stopped scoring** (commits `c434942`, `5b2d6ff`,
  `62d387f`, `40771fc`). A window upload that reused a cached, expired access token received a
  `401` the client swallowed, so the ambient bloom silently froze on its last band for the rest of
  the session. Fixed via **approach A**: the client fetches a **fresh token per window upload**
  through the `deps.getSession()` seam (the Supabase browser client auto-refreshes the JWT near
  expiry — confirmed in the installed SDK source), removing the expiry case entirely; and any
  **un-refreshable** session now drops to an **honest signed-out surface** (re-authenticate — never
  a frozen band) carried by a new `SESSION_EXPIRED` signed-out op. RLS-as-the-user posture unchanged
  — still the user's own token, just current.

Tests green at close: **apps/api 90, apps/web 575 (Vitest), packages/ml-video 55**. Security posture
untouched (no service-role key, RLS-as-user, SELECT whitelist hides `label`/`stress_probability`, no
probability on the wire, explicit non-wildcard CORS). No Cloud-dashboard parity items — all changes
are in-repo (`apps/api` CORS config, `apps/web` monitoring client + session surfaces, tests).

## 2026-06-22 — constitution 1.4.0 → 1.5.0 (MINOR): amber sub-tokens + amber-text value

Principle V (Calm-First Design) palette: registered four amber sub-tokens for the
stress-signal role and updated the light amber-text value. Triggered by feature 009
(today-card trend redesign), research R-3 / DECISIONS.md Decision 2.

- New tokens (light / dark): `--color-amber-text` `#8A580F` / `#E6C386`; `--amber-tint`
  `#F4E3C6` / `#3B2F19`; `--amber-soft-line` `#D49A4A` / `#E8BC7A`; `--amber-head`
  `#BC7A2A` / `#E4AE5C`.
- Light amber-text value updated `#7E5310` → `#8A580F` (approved-mock warmth, ~4.78:1 on
  the tint — passes AA). Dark amber-text `#E6C386` unchanged.
- Bright graphic amber (`--color-amber`) reaffirmed as lines/markers only.

Cross-references: `.specify/memory/constitution.md` Amendment 5; `docs/DECISIONS.md` 2026-06-22.

## 2026-06-22 — constitution 1.5.0 → 1.5.1 (PATCH): card-radius range includes 20px

Principle V (Calm-First Design) visual finish: corner-radius range widened 8–16px → 8–20px
to match the 20px (`rounded-2xl`) cards shipped since the 007 visual redesign and used by
the 009 today card. Documentation catch-up to existing practice; no new rule. Triggered by
feature 009, DECISIONS.md Decision 3.

Cross-references: `.specify/memory/constitution.md` Amendment 6; `docs/DECISIONS.md` 2026-06-22.

## 2026-06-23 — constitution 1.5.1 → 1.5.2 (PATCH): inline-SVG carve-out for bespoke affective micro-viz

Technology Stack (Locked), Charts row: ratifies a narrow carve-out — bespoke affective
micro-visualizations (feature 009's today-card stress trend) MAY use hand-authored inline
SVG. The load-bearing reason is bespoke lane-geometry (run-collapsed lanes, custom
stress-band-to-Y encoding, no-read markers, step-line) that is not a standard Recharts
chart type; pixel-exact, non-stretched rendering (DC-001: 1 SVG unit = 1 screen pixel) is
secondary. Recharts stays the locked default for standard dashboard data charts; this does
not authorize a general charting-library substitution. Documentation catch-up formalizing
an existing decision; no new rule. Triggered by feature 009, DECISIONS.md Decision 4.

Cross-references: `.specify/memory/constitution.md` Amendment 7; `docs/DECISIONS.md` 2026-06-22.

## 2026-06-23 — constitution 1.5.2 → 1.6.0 (MINOR): Principle VIII roadmap reorder + renumber (Amendment 8)

Principle VIII's provisional ordering is reconciled to built reality and reordered, and two
new planned features are added. `009` is realized as `009-today-card-trend-redesign` (the
slot formerly reserved for the questionnaire) and `008-followups` was an unslotted follow-up
branch; `010-llm-client-and-chatbot` moves ahead of `011-questionnaire` / `012-recommendations`
because the LLM client is a shared dependency for both the chatbot and recommendations. Two new
slots added — `013-personalization-onboarding` (personal de-stress preferences feeding
recommendations, which ship generic-first behind a defined preferences seam) and
`015-preferences-hub` (language, theme, default camera, timezone). Cross-references renumbered:
Principle IV audio `015 → 018`, Principle III fusion `017 → 020`. MINOR bump: two new planned
features plus a reorder materially change the guidance; no new/removed principle, no structural
change.

Cross-references: `.specify/memory/constitution.md` Amendment 8; `docs/DECISIONS.md` 2026-06-23.

## 2026-06-24 — constitution 1.6.0 → 1.7.0 (MINOR): Principle VIII — BACKLOG↔Issues mirror discipline (Amendment 9)

Principle VIII gains a backlog-governance bullet (grouped with the existing
DECISIONS/PROGRESS/CHANGELOG logging bullets): follow-up items deferred from features live in
`docs/BACKLOG.md` (the source of truth) and are mirrored 1:1 to GitHub Issues — opened when a
follow-up is logged, closed when it is fixed, both in the same change; Issues never diverge from
BACKLOG, and BACKLOG wins on conflict. Label taxonomy and operational detail live in
`docs/DECISIONS.md`. Triggered by the BACKLOG.md → GitHub Issues migration prep. MINOR bump: new
guidance added to an existing principle; no new/removed principle, no structural change. Template
audit: none (templates reference principles by number, not by these logging-doc rules).

Accompanying `docs/BACKLOG.md` cleanup (no constitution impact): the five stale `## From feature …
— in progress` headers (003 / 004 / 005 / 008 / 009) flipped to `— merged <date>` (2026-05-25 /
2026-05-29 / 2026-06-08 / 2026-06-22 / 2026-06-23); three status normalizations (welcome-banner
timezone `deferred-bug → bug`; onboarding-name-step `deferred-bug → bug`; "Before the 005 detector
ships" launch gate `deferred → resolved`); the two manager-visibility items merged into one entry
numbered to feature 016 (team-lead dashboard); and a feature-number remap correcting stale roadmap
references (team-lead `→ 016`, admin `→ 017`, stress-inference `006 → 008`, chatbot `→ 010`,
privacy-controls `→ 014`).

Cross-references: `.specify/memory/constitution.md` Amendment 9; `docs/DECISIONS.md` 2026-06-24;
`CLAUDE.md` "Backlog ↔ Issues".

## 2026-06-25 — constitution 1.7.0 → 1.8.0 (MINOR): Principle VIII — `009b-monitoring-graph-redesign` roadmap slot (Amendment 10)

Principle VIII's provisional ordering gains one new planned slot, `009b-monitoring-graph-redesign` —
the live "This session" within-session monitoring graph
(`apps/web/components/monitor/session-trend.tsx`), scoped out of feature 009, design-locked (a
signed-off HTML reference exists) and pending spec. The slot is inserted immediately after the
shipped `009-today-card-trend-redesign` and before `010-llm-client-and-chatbot`; slots `010`–`020`
are **not** renumbered and the shipped `009` is **not** renamed (its branch / PR #25 / CHANGELOG
history is fixed — relabeling would create constitution↔git drift; the `b` suffix already implies
`009` is the original). The `009b` roadmap label is decoupled from the real branch number, which
SpecKit auto-assigns at `/speckit-specify` time. MINOR bump: a new planned feature added to the
provisional ordering materially extends the guidance (consistent with Amendment 8); no new/removed
principle, no structural change. Template audit: none (templates reference Principle VIII by number,
not by slug). Authored by editing the constitution file directly, not via `/speckit-constitution`,
to preserve the hand-curated amendment history.

Cross-references: `.specify/memory/constitution.md` Amendment 10; `docs/DECISIONS.md` 2026-06-25.

## 2026-06-26 — fix(monitor) — inference concurrency bound + drop-stale, client back-pressure, service-unavailable surface

A debug/fix to the live-monitor inference path (not a SpecKit feature). PR #113; BACKLOG #110
(formalizes #78 note (b)) + #111 (camera-down mislabel) closed, #112 (warm-up latency) opened &
parked. Three independently-revertible changes:

- **Server concurrency bound + drop-stale** (`61b224b`): new `SessionScoringGate`
  (`apps/api/app/services/scoring_gate.py`) — a per-session `asyncio.Lock` held across
  `run_in_threadpool` (concurrency 1 per session, vs the anyio default `CapacityLimiter` of 40) +
  a monotonic per-session sequence; a window superseded by a newer one before its turn is shed as
  a clean `superseded` outcome (no scoring, no `window_readings` row). The freshest window always
  scores, so warm-up still latches on schedule.
- **Client in-flight back-pressure** (`558f60c`): `monitoring-session.tsx` never runs two uploads
  at once and coalesces to the latest window (the contiguous recording-so-far), dropping ~6× of
  wasted upload bytes. Window geometry unchanged (60 s / 10 s).
- **Service-unavailable surface** (`64d98e0`): create-session failures no longer mislabel a backend
  outage as "camera blocked" — `network` / `5xx` / stray `403` → a distinct service-unavailable
  surface; `401` / null-token → the existing signed-out surface; `no_anchor` and the real
  `getUserMedia` denial (Path A) unchanged.

Verification: API pytest 97 / Web Vitest 649 / `tsc` 0 / ESLint 0. Live Stage 1 (API on, no
`--reload`, single worker): steady-state per-window processing bounded (~18–22 s flat, slope ≈ 0)
vs the pre-fix O(elapsed) climb to 40–110 s. Stage 2 (API off): the new surface and the camera-denial
surface are correctly separated.

Rationale + design decisions (concurrency 1 preserves the `_SessionBuffers` single-writer invariant
#79; the `superseded` no-op; auth-failure routing): `docs/DECISIONS.md` 2026-06-26. No model artifact
or metric changed, so `docs/MODELS.md` is untouched.

## 2026-06-27 — feat(010-monitoring-graph-redesign) — feature complete

The live "This session" within-session monitoring graph redesign (roadmap label `009b`) is **merged
to `main`** via **PR #118** (squash `6b8653e`, 2026-06-27); feature branch deleted (local + remote).
Frontend-only inside `apps/web`: it replaces the internals of
`apps/web/components/monitor/session-trend.tsx` and adds one new pure module
`apps/web/lib/session-trend-geometry.ts`, consuming the existing read layer (`getSessionTrend` /
`monitoring-reads.ts`) unchanged — no data-layer / RLS / SELECT-whitelist / API / page-layout /
`globals.css` change, and no probability reaches the client. The technical core is the same
**fixed-pixel SVG rendering** as feature 009 (DC-001: 1 SVG unit = 1 screen pixel, intrinsic
`width == viewBox` width, no stretched viewBox — the totem/oval bug it exists to kill), but the
geometry differs: a single continuous **band-coloured step line** across one session's capture
windows on a **uniform slot per capture window** x-axis with a **rolling ~2-min window**
(`N_target = 12`), plus a single live **"now" marker** that recolours to the current band and parks
muted/static during a no-read. Shipped US1 (live trend) + US2 (the three honest no-read treatments —
warming dashed line · out-of-frame foggy gap **gated OFF at launch** per FR-015 · no-clear-read muted
gap — plus the ramp-up fill-to-width geometry and the 1-warming-point stub suppression) + US3 (the
"you are here" / "last clear read" popup, parked marker, and full a11y: Esc / outside-tap / ≥44px
touch targets / reduced-motion).

**Governance / spec-amendment status (Principle VIII):** the spec was **clarified mid-flight** and
the clarifications are already folded into `specs/010-monitoring-graph-redesign/spec.md` and dated
there (Clarifications **Session 2026-06-27**): the **ramp-up fill-to-width** x-axis (FR-002a ramp-up
clause + new **SC-012a**), the **1-warming-point** carve-out (FR-010 ≥2-point threshold / FR-018),
**event-driven now-marker freshness** (FR-004 freshness clause + task T011a), and the popup
**tap-toggle + outside-dismiss + live-copy** rule (FR-007). These are in-spec dated clarifications,
not retroactive FR/SC rewrites. The **#117** out-of-frame staleness re-tune (**20 s → 60 s**) is an
**implementation constant** — the freshness horizon is derived from named constants
(`STRIDE_MS + PROCESSING_CEILING_MS + POLL_MS + FRESHNESS_MARGIN_MS` = 10+30+12+8) and is **not a
value documented in any FR/SC**; FR-004a's parked-marker behaviour is unchanged in wording. **No FR
or SC was renumbered or had its normative meaning changed at merge beyond the dated in-spec
clarifications** — this entry records completion. The constitution roadmap renumber that created the
`009b` slot was logged separately (the 2026-06-25 Amendment 10 entry above) and is **not** repeated
here.

Merge-time verification (`apps/web`, 2026-06-27): Vitest **726 passed / 70 files**, 0 failed;
`npm run lint` **clean (0 errors)** — the prior 2-error `monitoring-session.tsx` lint baseline was
cleared in PR #94 (2026-06-25), so this branch is fully green, not riding a baseline; `tsc --noEmit`
**green**. Mohamed's hand-run smoke gate **PASSED** (ST-1…ST-7; ST-7 re-run after the #117 fix). The
dev harness route used for real-CSS width measurement was deleted before merge. BACKLOG↔Issues
(Amendment 9): **#117** opened-on-discovery / closed-on-fix in the same change (now CLOSED). No model
artifact or metric changed, so `docs/MODELS.md` is untouched.

Cross-references: `specs/010-monitoring-graph-redesign/` (spec / plan / tasks / research / smoke-tests
/ checklists); `docs/DECISIONS.md` 2026-06-27; `docs/PROGRESS.md` 2026-06-27; `docs/BACKLOG.md` "From
feature 010".

## 2026-06-27 — constitution 1.8.0 → 1.8.1 (PATCH): Principle VIII roadmap renumber `009b → 010` (Amendment 11)

Documentation catch-up reconciling Principle VIII's provisional ordering with shipped reality: the
monitoring-graph redesign merged (PR #118, squash `6b8653e`, with `specs/010-…`, US1–US3, 726 unit
tests), so the `009b-monitoring-graph-redesign` interstitial label becomes the canonical
`010-monitoring-graph-redesign` (and the "scoped out of 009 … pending spec" parenthetical is dropped —
it has a spec and shipped), cascading the unstarted tail up by one (`010-llm-client-and-chatbot → 011`
… `020-fusion → 021`). Cross-references renumbered: Principle IV audio `018 → 019`, Principle III
fusion `020 → 021`. PATCH bump (not Amendment 8's MINOR): this adds no new slot, removes no principle,
and changes no rule — it only relabels existing provisional slots to match the shipped feature number,
a non-semantic reconcile; every renumbered slot is unstarted, so no branch / PR / spec folder is
affected and the shipped `001`–`010` keep their numbers. The Amendment 10 narrative is left as written
(historical record of the `009b` interstitial decision).

Cross-references: `.specify/memory/constitution.md` Amendment 11; `docs/DECISIONS.md` 2026-06-27.

## 2026-06-28 — constitution(I, IV, Tech Stack) — Amendment 12 (1.8.1 → 1.9.0)

- Primary LLM: Groq Llama-3.3-70B → `openai/gpt-oss-120b` (reasoning_effort=low).
- Fallback LLM: LM Studio Gemma-3-4B → `openai/gpt-oss-20b`.
- Principle I: companion chat content is employee-private (never reaches
  manager/admin); a crisis disclosure never triggers manager/admin/employer
  notification and is never persisted (crisis routes to external resources only).

Rationale: Groq is shutting down Llama-3.3-70B on 2026-08-16; gpt-oss is the
deprecation-resilient consolidation target with structured-output support. The
Principle I invariants encode the feature-011 safety locks as durable rules.

## 2026-06-29 — feat(011-llm-client-chatbot) — feature complete (merged to main, PR #121)

Feature 011 — the shared LLM client package plus the first chatbot surface (Ren) riding on
it — is **merged to `main`** via **PR #121** (squash `8979ee2`, 2026-06-29); feature branch
deleted (local + remote). Implemented and human-validated
(`specs/011-llm-client-chatbot/smoke-tests.md` ALL GREEN, 2026-06-28/29). This entry records
completion + the as-built notes. The LLM
provider switch and the crisis / scorer / rollup design decisions were logged separately
(constitution **Amendment 12** + `docs/DECISIONS.md` 2026-06-28) and are **not** repeated
here. No spec FR/SC was renumbered or had its normative meaning changed at completion; the
in-spec clarifications (Session 2026-06-28) were folded into `spec.md` during planning.

What shipped:

- **Shared LLM client (`packages/llm-client`)** — one provider boundary for all app LLM calls
  (FR-001), so app code imports no vendor SDK directly: config-driven primary Groq
  `openai/gpt-oss-120b` (reasoning_effort=low) + LM Studio `openai/gpt-oss-20b` fallback
  presented through the *same* boundary (FR-002 / FR-057), fail-clean default with silent
  fallback behind an explicit flag (FR-003), defensive `{...}` extraction so reasoning-model
  leakage never corrupts scorer JSON or reaches users (FR-004), JSON-object scorer responses
  validated to `{band, crisis}` (FR-005), and the bot display name from one config string
  (FR-006). Versioned prompt seams loaded from `packages/llm-client/prompts/` for the five
  011 call sites — `ren`, `ren_preference_block` (injected only when preferences exist; empty
  in 011), `scorer_per_message`, `scorer_rollup`, `auto_title` — with wording treated as fixed
  (FR-007…FR-010).
- **Chat orchestration (`apps/api`)** — listen-first Ren reply + per-message scorer run in
  parallel, the scorer never steering Ren's wording (FR-023 / FR-024); the per-message scorer
  reads the current message + previous two turns and is discarded after use, never persisted
  (FR-025 / FR-026); a fresh whole-conversation rollup every fifth user message and on `[END]`,
  band-only persisted (rollup crisis discarded), never averaging per-message bands (FR-027…
  FR-029); `[END]` auto-title without banned distress words (FR-031); per-conversation send
  serialization (FR-032a), keep-open-on-end-failure retry (FR-032b), retry-with-backoff and
  never-lose-the-typed-message reliability (FR-051…FR-054), a sliding-window context guard with
  no summarization (FR-055 / FR-056), a per-employee send rate limit (FR-059), and privacy-safe
  operational telemetry only (FR-058).
- **Crisis path (live-only)** — the resource panel fires on scorer `crisis:true` OR Ren's
  silent `[CRISIS]` token (FR-033 / FR-034); resources render only from the human-verified app
  table (Egypt 16328 / US 988, last-checked 2026-06-28) plus the universal immediate-danger
  line, never blank (FR-035…FR-040); crisis is never persisted, never routed to manager /
  admin / employer, and uses calm foggy treatment, never crimson (FR-041…FR-044).
- **Chat surfaces (`apps/web`)** — `/app/chat` full page (history sidebar, switch / rename /
  delete, empty states), the employee-only bottom-right "Talk to Ren" pill (desktop label +
  ✦ / mobile icon-only with `aria-label="Talk to Ren"`), the home Recent-chats card
  (client-side relative timestamps avoiding the server-tz issue #53, per-row rename / delete,
  browser-local collapse toggle, + New chat), the employee Chat nav item, the persistent
  companion disclaimer on every surface, Graphite language, 360px / light+dark / WCAG-AA /
  ≥44px (FR-011…FR-019).
- **Persistence + privacy** — conversations and messages stored RLS-as-the-employee, **no
  service-role key on any chat path**, hard delete on conversation delete (FR-020…FR-022);
  resume from persisted text only (FR-032).
- **Signal separation + dual-mode reconcile** — chat-derived bands appear on recent-chat
  surfaces only and never touch the video today-card / live monitor / video-trend (FR-045 /
  FR-046); opportunistic video reconcile as Ren-opener / rollup-agreement context with the 70 s
  staleness rule and no fused band (FR-047…FR-050).

As-built notes (not spec FR/SC changes):

- **Crisis country = universal line in 011.** `profiles` has no `country` column yet and the
  country picker is out of scope (spec Out-of-Scope), so the live panel renders the universal
  immediate-danger line; the verified Egypt/US rows exist in the resource table and are covered
  by automated tests (FR-040 never-blank confirmed in smoke).
- **Four Playwright e2e tasks deferred** — T034 (role entry-point visibility), T052 (crisis
  privacy), T064 (end/resume), T073 (signal separation) need the live FastAPI+Supabase stack
  and the repo's e2e auth fixtures (the same fixture-stack gap that keeps phase-2 CI e2e out of
  scope, BACKLOG #41). The behaviour is covered meanwhile by the automated Vitest + pytest
  role/access/crisis/separation suites and the manual smoke pass; **not claimed as done.**
  Recorded in `docs/PROGRESS.md` + `docs/BACKLOG.md`.
- **Ren name personalization deferred.** No `preferred_name` was implemented; the
  `ren_preference_block` seam ships empty (FR-009) and `profiles` stores `full_name` only.
  Addressing the employee by name belongs to a future first/last-name split — no column was
  added. Recorded in `docs/PROGRESS.md` + `docs/BACKLOG.md`.

Test results (2026-06-29): `packages/llm-client` **28 passed** / `apps/api` **155 passed**
(incl. the 57 chat tests across `test_chat_storage_rls`, `test_chat_store`,
`test_chat_prompt_boundaries`, `test_crisis_resources`, `test_chat_orchestration`,
`test_chat_context_window`, `test_chat_crisis_flow`, `test_chat_rollup_title`,
`test_chat_privacy`, `test_chat_video_reconcile`, `test_ren_behavior_rubric`) / `apps/web`
Vitest **775 passed / 79 files**; lint + `tsc --noEmit` + ruff (both Python workspaces) all
clean. Guardrail greps PASS (no inline prompt strings in API call sites; no service-role path
for chat content). Manual smoke `specs/011-llm-client-chatbot/smoke-tests.md` PASS.

**#75 (ToS / Privacy Policy / signup consent gate) stays OPEN** — 011 ships the in-app
companion disclaimer only; the full pre-production consent gate is unchanged and remains a
pre-real-data blocker.

Cross-references: `specs/011-llm-client-chatbot/` (spec / plan / tasks / smoke-tests);
`docs/DECISIONS.md` 2026-06-28; `docs/PROGRESS.md` 2026-06-29; `docs/BACKLOG.md` "From feature
011"; `.specify/memory/constitution.md` Amendment 12.

## 2026-06-30 — constitution 1.9.0 → 1.10.0 (MINOR): Principle I — work-environment feedback as anonymized-aggregate-only manager-visible class (Amendment 13)

(Full Amendment 13 rationale: `docs/DECISIONS.md` 2026-06-30 and `.specify/memory/constitution.md`.)

## 2026-06-30 — feat(012-questionnaire-feedback): implementation (Phases 3–8, T024–T068)

Built the three Feature 012 questionnaire instruments on the Phase-1/2 privacy foundation
(migration `20260630000000_questionnaire_feedback.sql`, already merged): a mid-session
**confirmatory prompt**, a session-end **product-feedback card**, and a weekly
**work-environment check-in** — all RLS-as-the-employee, no service-role.

- **Authenticated client (Phase 3).** `apps/web/lib/api/questionnaire-client.ts` (direct
  `@supabase/ssr` browser writes; typed table payloads + the two weekly RPCs) and shared
  enums/guards in `lib/questionnaire/types.ts`, mirrored 1:1 to `data-model.md`. No admin
  import, no manager individual-row read.
- **US1 confirmatory prompt.** `useConfirmatoryTrigger` — pure reducers over the existing
  `WindowOutcome`/`Band` stream (`CONFIRMATORY_TENSE_SUSTAINED_MS=20_000`,
  `CONFIRMATORY_PROMPT_MIN_DWELL_MS=4_500`, one prompt/session, single-resolution guard,
  next-session false-alarm suppression; browser-local, no cross-worker state). `Notification`
  gained backward-compatible `dismissible`/`nonModal` (answer-only: Escape/outside/blur cannot
  dismiss, no focus trap). Ren handoff via `/app/chat?handoff=confirmatory_yes|confirmatory_maybe`
  (soft opener, no recommendation cards). Wired into `monitoring-session.tsx` (latest outcome
  fed in; prompt expiry resolved before session-end navigation). `aggregate_treatment` set only
  on `false_alarm`; `window_readings` never mutated.
- **US2 session-end feedback.** `SessionEndFeedbackCard` — Good→smiley / off→reason picker /
  Skip→muted; free text + `ren_too_robotic` stored employee-private ONLY (never to Ren or a
  manager); negative routes go to `/app/account` (plain) and `/app/account#notifications`
  (placeholder now anchored `id="notifications"`). Every-session sampling seam.
- **US3 weekly check-in.** `WeeklyCheckInCard` — Good→smiley / could-be-better→two-step stepper
  (Q1 auto-advance + focus to Q2, `role="progressbar"`, Back, Done) → submits one
  identity-stripped contribution via the DEFINER RPC; Skip is cadence-only; abandoned Q2 writes
  nothing.
- **US4 coordinator + polish.** `QuestionnaireCoordinator` centralizes surface priority
  (confirmatory ↔ session-end never co-occur; weekly separate from active monitoring), mounted
  on the dashboard ADDITIVELY (Today card/trend rendering untouched — T064). Shared
  `QuestionnaireResultIcon`; all four animations honor `prefers-reduced-motion` via
  `useMediaQuery`.

No model artifact touched (no `packages/ml-video`, no `docs/MODELS.md`, no thresholds) — T065.

Test results (2026-06-30): `apps/api` privacy gate `test_questionnaire_privacy.py` **12 passed**
(T003–T013 + T065); a **live RLS/DEFINER probe on local Postgres** (clean `supabase db reset`)
confirmed every boundary (contributions identity-stripped + RPC-only; employees rejected on the
aggregate read; team-lead sees own bucket only, admin all; owner-only cross-user reads blocked).
`apps/web` Vitest **906 passed / 98 files**; `tsc --noEmit` clean; ESLint clean on all
new/changed files. Playwright `questionnaire.spec.ts` + `questionnaire-layout.spec.ts` authored
(run in the e2e gate; require the seeded running stack).

**BACKLOG #123 (minimum-headcount aggregate suppression) stays OPEN** — the demo build ships
the `sample_size` hook but not the suppression; it remains a pre-real-data blocker.

Cross-references: `specs/012-questionnaire-feedback/` (spec / plan / tasks / contracts /
checklists / smoke-tests); `docs/DECISIONS.md` 2026-06-30; `docs/PROGRESS.md` 2026-06-30;
`docs/BACKLOG.md` #123.

## 2026-07-02 — feat(012-questionnaire-feedback) — feature complete (merged to main, PR #125)

Feature 012 is **merged to `main`** via **PR #125** (squash `636a7fc`, 2026-07-02). This entry
records completion + the as-built fixes found during the live e2e / pre-merge polish pass, on
top of the Phases 3–8 implementation logged 2026-06-30 above (not repeated here).

As-built fixes since the 2026-06-30 implementation entry:

- **Coordinator dwell fix (T067 follow-up).** `SessionEndFeedbackCard` and `WeeklyCheckInCard`
  were calling `onResolved()` synchronously in the same handler that set their own local
  "ending" state, so `QuestionnaireCoordinator` swapped surfaces in the same React commit
  before the end-state ever painted — a real SC-007 violation (a routed reason's action button
  could vanish before its own 3rd click landed). Both cards now defer `onResolved()` behind the
  same `QUESTIONNAIRE_RESULT_DWELL_MS` the weekly card already used (timer cleared on unmount),
  so the end-state message actually paints before the coordinator swaps surfaces. The two routed
  reasons (`suggestion_didnt_help` / `needed_quiet`) are unchanged — they still resolve only from
  `route()`, on the action-button click.
- **Session feedback insert → upsert.** `questionnaire-client.ts` `saveSessionFeedback` switched
  from `.insert` to `.upsert(payload, { onConflict: "monitoring_session_id" })`, with every
  nullable column set explicitly rather than omitted. Switching reasons before acting used to
  insert a second row and hit `qsf_one_per_session` `UNIQUE(monitoring_session_id)`, silently
  discarding the second write; the upsert now overwrites cleanly. `route()` now also halts
  (logs, doesn't navigate/resolve) on a failed save instead of proceeding as if it succeeded.
- **Ack-only reasons share the centered end-state.** `ren_too_robotic` and the free-text
  `something_else` reason now resolve into the same centered `QuestionnaireResultIcon` end-state
  as Good/Skip, on the same dwell timer, instead of the old inline banner / bounce-back-to-
  reason-list.
- **Skip repositioned to a top-right corner chip** on both `SessionEndFeedbackCard` and
  `WeeklyCheckInCard` (own row, not baseline-aligned with the heading). A follow-up fix restored
  the mock's flex header (heading + Skip, `justify-between`) with Skip as a ghost link
  (text-color-only hover, no filled chip) and an invisible vertical hit-slop so it still clears
  the 44px touch target without the hit/hover box bleeding over the heading — the initial
  absolute-positioned corner chip had regressed both the hover fill and the header layout.
- **360px chat-pill overlap fixed.** The coordinator's mobile (base) classes used a plain
  `bottom-0 + pb-3` while the `sm:` breakpoint reserved `--chat-pill-offset` via `bottom`; at
  360px the session-end/weekly card sat under the floating chat pill (same z-40, padding alone
  doesn't separate two fixed siblings). The same bottom-offset formula now applies
  unconditionally (smaller 0.75rem gap on mobile, `sm:` keeps its 1rem gap), matching
  `Notification`'s own convention.
- **BACKLOG #127 / #128 filed** during this pass (expired confirmatory prompts consuming the
  one-per-session budget with no re-arm path; the uncalibrated `STRESS_TENSE_BAND=0.70`
  default) — see `docs/BACKLOG.md`.
- **Manual smoke (Section 5) completed** — all 7 scenarios PASS against a real local Supabase +
  live camera, each cross-checked directly in Postgres; `specs/012-questionnaire-feedback/smoke-tests.md`
  signed off complete.

Test results (2026-07-02, post-fix): `apps/api` `test_questionnaire_privacy.py` **12 passed**;
`apps/web` Vitest **909 passed / 98 files**; `questionnaire.spec.ts` + `questionnaire-layout.spec.ts`
**4/4 each**; full chromium e2e project **42 passed** (4 pre-existing unrelated skips, 1
pre-existing unrelated failure in `employee-dashboard-shell.spec.ts`, confirmed via git-stash to
reproduce without this change); `tsc --noEmit` clean.

Cross-references: `specs/012-questionnaire-feedback/` (smoke-tests.md); `docs/DECISIONS.md`
2026-07-02; `docs/PROGRESS.md` 2026-07-02; `docs/BACKLOG.md` #123 / #127 / #128.

## 2026-07-02 — fix(012): confirmatory prompt one-per-session budget only spent by an explicit answer (partial, #127) — merged to main, PR #130

`useConfirmatoryTrigger`'s trigger reducer used a single `resolved` flag for two different
concerns: the per-prompt single-resolution guard, and the session's one-time prompt budget.
That meant an auto-resolution — a `signal_drop` expiry, whether detected immediately when a
non-tense outcome arrived past the dwell floor, or via the dwell-timer callback — permanently
blocked all further prompt processing for the session, exactly like an explicit user answer.
A genuine stress spike later in the same session could never be re-prompted.

Split the flag: `resolved` now guards only the currently-(or most-recently-)shown prompt; a
new `budgetConsumed` field is set ONLY by an explicit `type: "answered"` resolution
(confirmed / false_alarm / opened_chat) via `markResolvedConsumingBudget`. A new
`markResolvedRearm` resets the trigger to a fresh un-shown state on any auto-resolution, and
the hook now resets its own `resolvedRef`/`promptIdRef` on that path too, so a fresh 20 s
sustained-tense episode can fire a new `show` effect in the same session. Next-session
false-alarm suppression is unchanged (already correctly scoped to the explicit `false_alarm`
path only).

**Partial fix — issue stays OPEN.** `questionnaire_confirmatory_prompts` still has
`qcp_one_per_session UNIQUE (monitoring_session_id)` (full-table, unchanged by this PR);
`createConfirmatoryPrompt` still does a plain `.insert`. A second prompt row for the same
session hits that constraint, the insert fails, and `handleShow` silently no-ops — so in
production a user still cannot be re-prompted after an auto-expiry, even though the
client-side state machine now wants to try. The remaining DB-constraint + re-arm/cooldown/cap
policy work (originally scoped in the BACKLOG #127 entry) is unaddressed by this PR and needs
its own spec-fix pass. Discovered during the post-merge doc reconcile, after merge — the unit
suite mocks `createPrompt` and so did not catch the gap.

Test results (2026-07-02): `apps/web` Vitest `confirmatory-trigger.test.ts` **20/20** (new:
both signal-drop paths rearm without spending the budget; single-resolution guard holds);
full suite **916/916 passed / 98 files**; `tsc --noEmit` clean; ESLint clean.

Cross-references: `docs/PROGRESS.md` 2026-07-02; `docs/DECISIONS.md` 2026-07-02;
`docs/BACKLOG.md` #127.

## 2026-07-02 — fix(012): confirmatory prompt budget — DB partial index completes #127, PR #132

Completes BACKLOG #127 / GitHub #127, alongside the client-side half above (PR #130).
`questionnaire_confirmatory_prompts` dropped the full-table `qcp_one_per_session UNIQUE
(monitoring_session_id)` constraint and replaced it with a partial unique index,
`qcp_one_answered_per_session ON questionnaire_confirmatory_prompts (monitoring_session_id)
WHERE lifecycle = 'answered'`
(`supabase/migrations/20260702000000_qcp_one_answered_per_session.sql`). A session can now hold
several `visible`/`expired` rows — one per re-arm episode — while only one `answered` row is
still capped, matching PR #130's client-side `budgetConsumed` predicate. Chose insert +
partial-unique-index over upsert-in-place (see `docs/DECISIONS.md` D-10): it preserves a
permanent row per prompt episode and needed no change to `createConfirmatoryPrompt`'s existing
plain `.insert`.

Also fixed the previously-silent insert-failure path: `createConfirmatoryPrompt` now logs
`console.error("[questionnaire] confirmatory prompt create failed:", …)` instead of swallowing
the error, matching the existing `[questionnaire]`-tagged convention in
`session-end-feedback-card.tsx`.

Live-verified against the local Supabase Postgres instance inside a rolled-back transaction (no
data persisted): two non-answered rows in one session both inserted successfully; a second
`answered` row in the same session was correctly rejected by the new partial index. The static
migration-text gate (`apps/api/tests/test_questionnaire_privacy.py`, T003) now also parses this
migration and asserts the old constraint is dropped and the new partial index is shaped
correctly.

Test results (2026-07-02): `apps/web` Vitest **917/917 passed / 98 files** (new: the
insert-failure logging test); `apps/api` pytest full suite passed
(`test_questionnaire_privacy.py` **12/12**); `tsc --noEmit` clean; ESLint 0 errors (2
pre-existing unrelated warnings).

Cross-references: `docs/PROGRESS.md` 2026-07-02; `docs/DECISIONS.md` 2026-07-02 (D-10);
`docs/BACKLOG.md` #127 (resolved).

## 2026-07-03 — feat(012): second, milder confirmatory trigger — sustained `a_little_tense`, PR #135

Closes BACKLOG #134 / GitHub #134. Adds a second, milder confirmatory trigger — ~60 s sustained
`a_little_tense` (a slow simmer that never spikes) — beside the existing ~20 s sustained-`tense`
acute trigger, reusing the existing prompt / dwell / expiry / single-resolution machinery; only
the pre-show timer logic and the budget gain a second path (PR #135, squash `ad58777`).

**Reducer** (`apps/web/lib/questionnaire/confirmatory-trigger.ts`): a second sustained clock
(`littleRunStartMs`) driven by an exact-band `isLittleTenseReading` predicate (no band-ordering),
under a per-band reset matrix — `tense` feeds the acute run and zeroes the mild run,
`a_little_tense` feeds the mild run and zeroes the acute run, anything else / inactive zeroes both
(so climbing `a_little_tense` → `tense` hands off to the acute timer). Arbitration is explicit:
the acute condition is evaluated FIRST (tense wins). The mild dwell constant
`CONFIRMATORY_LITTLE_TENSE_SUSTAINED_MS = 60_000` is a designed default, NOT empirically
calibrated — StressID's 60 s stressor clips can't validate a sustained-mild threshold under the
4×60 s smoothing buffer (same limitation as the 0.70 tense band, #128); recover from live data.

**Tense-senior budget**: `shownKind` plus two flags replace the single one-per-session budget. A
mild answer spends only the mild budget (a later sustained-tense keeps its shot); a tense answer
spends both (no down-tier nag after an acute answer). Auto-resolutions (signal-drop / session-end)
spend neither and re-arm, exactly as #127/#130. Net: ≤1 mild + ≤1 tense per session.

**DB** (`supabase/migrations/20260703000000_qcp_kind_column.sql`): adds a `kind` ('mild' | 'tense')
discriminator (existing rows backfilled to 'tense'), drops the #132 `qcp_one_answered_per_session`
index and replaces it with `qcp_one_answered_per_session_per_kind ON
questionnaire_confirmatory_prompts (monitoring_session_id, kind) WHERE lifecycle = 'answered'` —
one answered row per (session, kind). `createConfirmatoryPrompt`
(`apps/web/lib/api/questionnaire-client.ts`) now writes `kind`; `trigger_band` is unchanged (still
the constrained 'tense'-only column), and the #132 `[questionnaire]` insert-failure `console.error`
is kept. The #127 / #130 / #132 guarantees are preserved — the six named reducer/hook guarantee
tests are byte-for-byte unchanged and green.

Test results (2026-07-03): `apps/web` Vitest — questionnaire dir 88/88, full suite **935/935
passed / 98 files** (58 confirmatory reducer/hook/client tests); `apps/api` pytest
`test_questionnaire_privacy.py` **12/12**; `tsc --noEmit` clean; ESLint 0 errors (1 pre-existing
unrelated warning). Live-verified against the local Supabase Postgres inside a rolled-back
transaction (no data persisted): the old single-column index rejected a second `answered` row in
one session (RED), and after the migration a mild-answered + tense-answered pair both persist while
a second same-kind `answered` row is rejected by the new per-kind index (GREEN).

Cross-references: `docs/PROGRESS.md` 2026-07-03; `docs/DECISIONS.md` 2026-07-03 (D-11);
`docs/BACKLOG.md` #134 (resolved).

## 2026-07-12 — chore(deploy): production cutover — Azure Container Apps, GHCR image, branded auth emails, service-role removal (PR #142)

**Backfilled 2026-07-22.** This entry and the two below were written after the fact: PRs #142,
#143, and #144 shipped the entire deployment milestone between 2026-07-12 and 2026-07-13 without a
CHANGELOG or PROGRESS entry, the first break in the per-feature convention held since feature 001.
The gap was found by a 2026-07-21 recon. Content is reconstructed from the commits, the SpecKit
artifacts, and the platform state — not from memory.

**Hosting.** The backend moved to **Azure Container Apps** (`serenify-api` in resource group
`serenify-prod-rg`, France Central), replacing the planned DigitalOcean Droplet. Ratified as
**Constitution Amendment 14** (1.10.0 → 1.11.0, MINOR — a locked-stack substitution). Sizing is
**4 vCPU / 8 GiB, `minReplicas=0`, `maxReplicas=1`** — scale-to-zero to control Azure for Students
credit. Managed HTTPS ingress and custom-domain support give `api.serenify.tech` a production TLS
path without operating a separate reverse proxy. Container port 8000; uvicorn single worker, no
`--reload`.

**No IaC.** Provisioning was performed manually via `az` CLI and is deliberately **not tracked in
git** — no Bicep, ARM, Container Apps YAML, compose file, systemd unit, or nginx/caddy config
exists. The live resource configuration is reconstructable from
`docs/superpowers/plans/2026-07-12-production-cutover.md`, not from committed state. Consequence
worth naming: the deployment is not reproducible from this repository alone.

**Image pipeline.** New `.github/workflows/publish-api-image.yml` — manual `workflow_dispatch`,
builds `linux/amd64`, pushes to `ghcr.io/mohamedasem318/serenify-api:production` using the
repo-scoped `GITHUB_TOKEN`, deliberately avoiding a paid Azure Container Registry. No Azure
credentials exist in CI; the deploy step itself is manual.

**Container build fixes.** The Dockerfile never copied `packages/llm-client` (added in feature
011), so a clean `uv sync --frozen` failed on three editable path deps — a build that had never
succeeded from a clean context. Adds the missing COPY, an `ffmpeg -version` build-layer check (a
silent video-decode break otherwise), deterministic uv env vars, and `uv run --no-sync` at boot so
container start never re-checks the lock or touches the network. New `apps/api/.dockerignore`: with
no ignore file, a root-context build baked `apps/api/.env` — **real dev secrets** — into the image
and copied both Windows `.venv` trees. Build context dropped from gigabytes to a few MB.

**Security posture.** Removed the runtime admin/service-role path entirely — deleted
`apps/web/lib/supabase/admin.ts` and `apps/web/app/api/admin/invite/route.ts`. Production access is
now **RLS-as-user throughout**, and inference replay runs as the authenticated user. Locked by a
new `apps/web/tests/unit/runtime-secret-posture.test.ts`; deploy no longer requires a service-role
key at all.

**Branded auth email.** Authored `supabase/templates/confirmation.html` and `recovery.html`
(Graphite-branded, 520px card, meadow-green top rule, text wordmark, OTP fallback), wired via
`supabase/config.toml`, with `scripts/preview-auth-emails.mjs` for visual QA and 95 lines of
template-invariant tests pinning subjects, GoTrue variables, the absence of `<img>` and of
amber/crimson, and both dark-mode mechanisms.

**Backlog reconciliation.** Retro-closed **#74** (usable-face-coverage gate had shipped in feature
006 / PR #19) and **#48** (card-heading serif resolved by the DM Serif Display → Outfit swap in
feature 007 / PR #22). Both were already fixed in code and never reconciled.

**Deviation from Principle VIII, recorded not excused**: this PR produced **no `specs/0NN-…`
folder** — `specs/` jumps `012 → 022`. It shipped against ad-hoc `docs/superpowers/` plan and
design documents instead of the standard SpecKit artifact set. #143 and #144 immediately below both
got proper spec/plan/tasks/smoke-tests folders. *[2026-08-14: those two folders (022, 023) were
themselves removed — the numbers were hand-picked by an unprompted Codex session, not assigned by
the SpecKit workflow. The deviation record above stands as written; see the 2026-08-14 entry and
`docs/DECISIONS.md` 2026-08-14.]*

25 files changed, 930 insertions, 331 deletions. Co-authored by all three teammates.

Cross-references: `docs/PROGRESS.md` 2026-07-12; `docs/DECISIONS.md` 2026-07-12 and 2026-07-22
(ACI-rollback correction); `.specify/memory/constitution.md` Amendment 14; `docs/BACKLOG.md` #74,
#48, #139.

## 2026-07-13 — fix(web): cold-start readiness for a scale-to-zero backend + speckit CI guard (PR #143)

**Backfilled 2026-07-22.** See the note on the 2026-07-12 entry.

**The problem `minReplicas=0` created.** Scale-to-zero controls credit consumption but means the
first request after idle pays a full container cold start. Measured on production: a request from
zero replicas took **46.68 seconds**; a warm request took **0.34 seconds**. The pre-existing client
timeouts were far below that, so the honest backend behaviour read to the user as a hard failure.

**Fix.** A bounded **75-second** wake allowance on the two entry paths that can hit a cold backend —
health readiness (FR-001) and monitoring-session creation (FR-002) — with the timer released after
settlement and abort/fetch failure mapped onto the existing `network` result rather than a new error
class. Wake requests begin only on an explicit calibration or check-in action (FR-003); they are
never speculative.

**Ordering fix that matters for trust**: check-in now creates the authenticated backend session
**before** requesting camera access (FR-004). Previously a user could be prompted for their camera
and watch the indicator light up while the backend was still asleep — the camera opening before
there is anything to send it to is exactly the kind of thing this product cannot afford to do.

**Copy and a11y.** Pending states are explicit rather than silent: check-in disables its action,
shows `Waking Serenify…`, and exposes a polite live status (FR-005); calibration explains that wake
can take about a minute after idle time (FR-006). No new animation and no new reduced-motion path
(FR-009) — a spinner would have been the easy answer and was rejected. The pending control stays
≥44px and fits at 360px in light and dark (FR-008).

**CI guard (closes BACKLOG/issue #50).** `scripts/check-speckit-skills.mjs` + a
`check-speckit-skills.test.mjs` fixture suite + a `speckit-guard` job verify the required
`.claude/skills/speckit-*/SKILL.md` files are present and reject a broad `.claude/` ignore rule
(FR-010) — ending the recurring silent disappearance of the SpecKit skills that had cost a diagnosis
plus a context reset each time it recurred.

Also adds a non-production `/cold-start-harness` route with a committed Playwright layout contract
(the harness returns 404 from a production build).

**Production smoke test — PASS, 2026-07-13** (sign-off recorded at merge; the spec folder that
held it was removed 2026-08-14 — its evidence is stated in full here and in `docs/PROGRESS.md`):
*"calibration woke the production Azure API in under one minute; check-in completed normally; the
first reading arrived at approximately 1:36 and updated again within about 10 seconds."* Run against
the **production** Azure API and Supabase project from a protected branch preview; the temporary
preview CORS origin was removed afterwards. Approval recorded: *"it worked flawlessly"*, no
remaining UX concerns. Pre-merge evidence: 952 Vitest tests, ESLint 0 errors, TypeScript + Turbopack
production build, 8 guard fixtures, 4 Playwright checks at 360px/desktop in light/dark.

25 files changed, 1068 insertions, 42 deletions. **No co-author trailers** — a break from the
blanket rule, noted here since the omission is now permanent in history.

Cross-references: `docs/PROGRESS.md` 2026-07-13;
`docs/superpowers/specs/2026-07-13-cold-start-readiness-design.md`; `docs/BACKLOG.md` #50
(resolved). *(The 022 SpecKit folder formerly listed here was removed 2026-08-14.)*

## 2026-07-13 — fix(brand): auth email polish, social share preview, password-reset sign-out lock (PR #144)

**Backfilled 2026-07-22.** See the note on the 2026-07-12 entry.

**Email.** Wordmarks stay **text, never an image** — `Outfit, Inter, Arial, sans-serif` at 400/24px
(FR-001), mirroring the app header. CTA cells use both `align="center"` and inline centered
alignment (FR-002), redundant on purpose for older email engines. GoTrue placeholders and the
dark-mode styles are preserved (FR-003).

**Social preview.** New `apps/web/app/opengraph-image.tsx` — a `next/og` `ImageResponse` at exactly
**1200×630** (FR-005), fixed dark composition because link unfurlers do not receive a viewer theme.
Headline **"Workplace stress, gently noticed."** over a meadow rule and "Private check-ins for
calmer workdays". Root metadata in `layout.tsx` sets `metadataBase: https://serenify.tech`, canonical
`/`, full OpenGraph and `twitter: summary_large_image` (FR-004). One deliberate brand deviation: the
OG image uses Arial, not Inter/Outfit, since Satori does not fetch Google Fonts the same way.

**Password reset (closes BACKLOG/issue #38).** A successful password update ends the recovery
session and routes to login; a failed one does **not** (FR-006). This was already the behaviour —
the change is that it is now locked by `apps/web/tests/unit/reset-password-actions.test.ts` so it
cannot silently regress.

Both new test files pin their invariants tightly (OG dimensions, content type, icon source,
wordmark, tagline, `#101214` background; email subjects, fonts, wordmark style string, top rule).
**Any future restyle of the templates or the OG card must update these expectations in the same
commit** — they will fail otherwise, by design.

13 files changed, 429 insertions, 12 deletions. **No co-author trailers** — same omission as #143.

Cross-references: `docs/PROGRESS.md` 2026-07-13; `docs/BACKLOG.md` #38 (resolved). *(The 023
SpecKit folder formerly listed here was removed 2026-08-14.)*

## 2026-07-13 — Serenify is live in production at https://serenify.tech (verified)

**Backfilled 2026-07-22.** Recorded because the only evidence that production exists and works
lived inside a SpecKit smoke-test file, in no canonical document.

**Topology as deployed:**

| Component | Runtime | Location |
|---|---|---|
| Web (Next.js 16) | Vercel | `https://serenify.tech` |
| API (FastAPI + uvicorn, single worker) | Azure Container Apps, France Central | `https://api.serenify.tech`, port 8000 |
| Database / Auth | Supabase Cloud (EU / Frankfurt) | project `excukdzjudslbqmkysrc` |
| API image | GHCR | `ghcr.io/mohamedasem318/serenify-api:production` |
| Transactional email | **Resend**, as Supabase Auth's custom SMTP provider | dashboard-configured |
| Fallback LLM | Local LM Studio via Cloudflare Tunnel | self-hosted by design |

**Verified 2026-07-13** by the production smoke test quoted in the PR #143 entry: PASS against the
real Azure API and cloud Supabase, cold wake under one minute, first reading ≈1:36.

**Resend is live** as Supabase's custom SMTP provider and production email is sending. It has **zero
repository footprint by design** — no API key, no SDK, no calling code — because it sits beneath
Supabase Auth as an SMTP relay rather than being called by application code. A 2026-07-21 recon read
that absence as "Resend is not integrated"; that inference was wrong. Ratified as **Constitution
Amendment 15** (1.11.0 → 1.11.1, PATCH), which drops the now-satisfied "until Resend domain
verified" caveat from the locked stack table. See `docs/DECISIONS.md` 2026-07-22.

**There is no rollback target.** `docs/DECISIONS.md` (2026-07-12) claimed the prior Azure Container
Instance remained running as one; the cutover design doc in the same PR said the resource groups had
been deleted to stop credit consumption. Settled on 2026-07-22 by querying the subscription:
`az group list` returns exactly one group (`serenify-prod-rg`) holding only the Container Apps
environment, the `serenify-api` app, and its managed certificate. **No ACI exists.** Recovery is a
re-provision from the GHCR image tag or a Container Apps revision rollback — not a traffic flip to a
warm standby, and not instantaneous. Corrected in `docs/DECISIONS.md` 2026-07-22.

Cross-references: `docs/PROGRESS.md` 2026-07-13; `docs/DECISIONS.md` 2026-07-22 (both entries);
`.specify/memory/constitution.md` Amendments 14 and 15. *(The 022 smoke-tests file formerly listed
here was removed 2026-08-14; its evidence is quoted in the PR #143 entry above.)*

## 2026-07-24 — Constitution Amendment 16 (MINOR, 1.11.1 → 1.12.0): feature-ordering reorder + Privacy-Policy/ToS-per-PR rule

Principle VIII provisional ordering: a new slot `013-public-surface-and-legal` (public landing page,
`/terms`, `/privacy`, footer, signup consent gate) is inserted, and `privacy-controls-and-transparency`
is moved to sit **after** `team-lead-dashboard` to fix a dependency inversion (it governs what an
employee lets their team lead see, so it cannot ship before the dashboard it constrains). Resulting
013–022 tail: `013-public-surface-and-legal`, `014-recommendations`, `015-personalization-onboarding`,
`016-preferences-hub`, `017-team-lead-dashboard`, `018-privacy-controls-and-transparency`,
`019-admin-dashboard`, `020-audio-modality`, `021-physio-modality`, `022-fusion`. By-slug:
recommendations 013→014, personalization-onboarding 014→015, preferences-hub/team-lead-dashboard keep
016/017, privacy-controls 015→018, admin 018→019, audio 019→020, physio 020→021, fusion 021→022. Two
constitution body cross-refs moved with the tail (Principle IV audio 019→020, Principle III fusion
021→022).

Accepted consequence: `017-team-lead-dashboard` ships with hardcoded default visibility scopes and
`018-privacy-controls-and-transparency` retrofits employee-facing controls onto it — tracked as GitHub
issue #152 + a `docs/BACKLOG.md` entry, not left only in the constitution rationale.

New standing rule (Principle VIII, mirrored into `CLAUDE.md`): whenever a feature changes what data is
collected, where it goes, who can see it, or how long it is retained, the Privacy Policy and Terms of
Service MUST be reviewed and updated in the same PR.

Template audit: none (the only grep hit is a generic `retention period` placeholder FR in
`spec-template.md`, unrelated). `docs/BACKLOG.md` was reconciled in place (admin 018→019, privacy
015→018, keeping slugs; #86 clarified as unslotted); shipped `specs/*/` were deliberately NOT
retro-edited (point-in-time records; constitution ordering is the source of truth), consistent with
Amendments 8/11. MINOR bump: new slot + reorder + new guidance on an existing principle; no principle
added/removed/restructured. Hand-edited to preserve the Sync Impact Report history (Amendment 10
precedent).

Cross-references: `.specify/memory/constitution.md` Amendment 16; `docs/DECISIONS.md` 2026-07-24;
`CLAUDE.md`; `docs/BACKLOG.md` (#152, #86, #75); GitHub issue #152.

## 2026-07-24 — Constitution Amendment 17 (MINOR, 1.12.0 → 1.13.0): two-colour wordmark canonized + manager-visibility copy discipline

Two changes on two existing principles, landed as **one** amendment because both answer blocking open
questions in the same feature spec (`013-public-surface-and-legal`: OQ-3 and OQ-1) and land in one PR.
Amendment 12 is the precedent — it likewise paired an unrelated Principle IV / locked-stack change with
Principle I disclosure invariants on a single feature trigger. Amendment atomicity here tracks the
landing event, not the topic.

**Principle V — new `Wordmark` block.** `serenify` is canonized as a **two-colour** wordmark: `seren` in
the `ink` token, `ify` in the `meadow-text` token, always lowercase, never carrying a dot or other
terminal punctuation, and **defined once as a single shared component** reused at every site that renders
it inside the web app's React tree. Two classes of render site sit outside that tree and cannot consume
the component — the `next/og` social card (Satori cannot load the app's self-hosted fonts) and the
Supabase transactional email templates (inline-styled HTML) — so they are an explicit **hand-sync
carve-out**, updated in the same PR as any wordmark change. Without that carve-out the rule would be
violated on day one by `opengraph-image.tsx:52` and `supabase/templates/{confirmation,recovery}.html:38`,
and a rule the codebase already breaks is worse than no rule.

The lowercase sentence **moves** out of the Typography block into Wordmark rather than being duplicated,
and Wordmark deliberately does not restate that the wordmark is set in Outfit — Typography, two sentences
above, already assigns it. Two places stating one rule is two places to drift.

**No new token, no value change** — but `--color-meadow-text` (light `#346A56` / dark `#63B292`) is
registered in Principle V for the first time. It shipped in feature 007 (`globals.css:40,157`,
`docs/DECISIONS.md` 2026-06-18) yet was never named in the constitution, even though the palette is
declared "locked, no additions without amendment". Two sibling 007 tokens in the same unregistered
position, `--color-on-accent` and `--color-scrim`, were deliberately left out of scope and logged to
`docs/BACKLOG.md` + GitHub issue **#155** to ride along with the next Principle V amendment.

**Principle I — new public-communication rule.** Principle I's **substance is unchanged**: per-individual
manager visibility with the employee-controlled granularity slider remains the intended end-state, and no
existing invariant is edited. The new rule governs only how that end-state may be *described* in
public-facing or user-facing text — honestly, with not-yet-live controls marked not-yet-live (the slider
and the transparency view arrive with feature 018), and without flattening in the other direction: chat
content and crisis disclosures genuinely never reach a manager, admin, or employer, while stress-trend
summaries **are** manager-visible by default at the `summary only` granularity. That granularity default
is quoted from the existing Principle I slider bullet, which has carried "(DEFAULT)" since the 1.0.0
ratification — a copy-discipline rule must not be where a new substantive default first appears.

This resolves the 013 spec's blocking **OQ-1** by choosing its Option B and constraining how B is
written — not by amending Principle I, which was Option A and was not taken. It also resolves **OQ-3**:
yes, the wordmark canonization requires an amendment.

Principle I now names feature 018 (`privacy-controls-and-transparency`) — the **third** live
feature-number cross-reference in the principle bodies, alongside Principle IV's audio 020 and
Principle III's fusion 022. Future ordering amendments must move all three.

**Template audit: none.** All five templates grepped for `wordmark`, `two-colour`/`two-color`,
`lowercase`, `Principle V`, `Principle I`, `manager visibility`, `Graphite`, `meadow`, `meadow-text`,
`ink`, `serenify` — the only hits are coincidental substrings of `ink` inside "link"/"Link" in ordinary
markdown boilerplate (`checklist-template.md:5,39`, `plan-template.md:3`, `spec-template.md:19`),
recorded so they are not re-flagged.

**Cross-reference sweep: reported, not bulk-edited.** Four `README.md` lines (11, 15, 16, 18) state
manager visibility or the privacy slider as present-tense product fact without a not-yet-live marker —
`:18` most clearly, since the slider does not exist. Three lines in the signed-off landing mock
(`:442`, `:550`, `:772`) carry exactly the flattened "nothing reaches a manager" claim the new rule
forbids; that file is **gitignored and untracked**, so it cannot be edited by a PR and the rule instead
binds at transcription time when 013's landing copy is written from it. Four live user-facing strings
were verified already compliant and must not be "corrected". Full detail, including a sweep-methodology
caveat (ripgrep silently skips the mock because it honours `.gitignore`), in `docs/DECISIONS.md`
2026-07-24 (Amendment 17).

MINOR bump: materially expanded guidance on two existing principles; no principle added, removed, or
restructured, and no numbered section changed. Hand-edited to preserve the curated Sync Impact Report
history (Amendment 10 precedent). Not mirrored into `CLAUDE.md` — unlike Amendment 16's per-PR
procedural gate, these are design and copy rules, and the constitution is already read on every SpecKit
feature.

Cross-references: `.specify/memory/constitution.md` Amendment 17; `docs/DECISIONS.md` 2026-07-24
(Amendment 17); `docs/BACKLOG.md` "From constitution Amendment 17"; GitHub issue #155;
`specs/013-public-surface-and-legal/spec.md` OQ-1 and OQ-3.

## 2026-07-28 — feat(013-public-surface-and-legal) — feature complete (merged to main, PR #194)

Serenify gets a front door. Until now `serenify.tech` opened straight onto an auth screen and the
product made promises — about privacy, about what a manager can see — that existed only in a README
and a constitution. This feature puts the public surface and the legal surface in front of users,
and puts a gate between users and the app that those documents can actually bind.

**The public surface**

- **A landing page at `/`**, taking the root route over from the redirect that lived there. A hero
  story card that plays a ~42-second narrative in 17 beats, chapter markers to step through it, and
  a team section.
- **`/terms` and `/privacy`** — two real documents, written against FR-048a: manager visibility
  stated plainly and never softened or buried, its not-yet-live marker in the *same* passage, an
  unmissable "informed draft, not reviewed by a lawyer" notice, and zero performance figures.
- **A public navbar and footer** across the public routes, footer reading "© 2026 Serenify".
- **The two-colour wordmark** — `seren` in ink, `ify` in meadow — now rendered from one shared
  component. This is a **visible change to three surfaces that previously shipped single-colour**
  (the app header, the auth pages, and onboarding), not only a new-page addition. The two hand-sync
  exceptions that cannot consume the component remain exactly two.

**The legal gates — and neither is one-time**

- **Terms/Privacy**, gating the **whole application** rather than just signup. A user whose recorded
  consent predates a revision judged **material** meets a re-consent screen rendered **in place** —
  no redirect — with both documents readable from it and sign-out available.
- **Camera-and-inference**, gating all three capture routes: `/onboarding`, `/app/calibrate` and
  `/app/monitor`.
- **The two fail in opposite directions on purpose.** The app-shell gate **fails OPEN** and says so
  in the logs; the camera gate **fails CLOSED**. A shell gate failing closed would be a
  self-inflicted outage over a database blip; a camera gate failing open would turn a camera on for
  someone who never agreed.
- **A kill switch**, `CONSENT_ENTRY_GATE_ENABLED=false`, with the app-shell gate shipped **alone**
  in its own PR (#172) so a single `git revert` unwinds it.

**Consent is a history, not a flag.** `public.user_consents` records one append-only row per
accepted revision and never overwrites: owner-only RLS, an immutability trigger, and no UPDATE or
DELETE grant to `authenticated`. Which revision binds is decided by **version identity against an
in-repo registry**, never by comparing timestamps — materiality is a human judgement recorded at
publish time, never derived from a text diff or a date. **Declining writes nothing**: no row, no
deletion, no withdrawal state. Feature **018** owns withdrawal, and will add a new row rather than
change an old one.

**No backfill.** Every pre-existing account has zero consent records, by design (FR-041), so all 20
existing users meet the re-consent screen when this ships and clear it themselves.

**Shipped knowingly imperfect, and said out loud rather than buried:** the no-JavaScript signup
refusal is silent (**ST-9 FAILED, knowingly accepted, #184** — it fails *closed*, so the harm is
confusion rather than data); sign-off covers **Chromium and Firefox only** (#177); and `/signup`
stays **open self-serve** for the demo window (#62, deliberate), which keeps the SC-006 bypass live
and accepted — one forged consent row, for the forger's own account, RLS-scoped, no escalation.

Closes **#75**, **#157**, **#158**. Implements constitution 1.13.0 Amendment 17; **the constitution
is not amended by this feature**.

**Live and verified in production the same day.** Because Vercel builds production from `main`,
merging PR #194 *was* the release — deployment `dpl_AiMeacUNLYknQwkNvQ1yoS9MDWFR` (`124192a`),
verified immediately afterwards with a rollback lever armed. Two things are recorded as **not**
proven rather than glossed: the `[consent-gate] FAIL-OPEN` log check returned zero lines over a full
five-minute window (a third consecutive empty one) and is logged as **no-signal, not a pass**; and
the intermediate `/?code=` URL was never captured, so that routing was proven with a separate
invalid-code probe instead. Evidence: `deploy-log-production-2026-07-28.md`, record PR **#199**.

Cross-references: `docs/DECISIONS.md` 2026-07-28 (third pass); `docs/PROGRESS.md` "Feature 013";
`specs/013-public-surface-and-legal/` (`plan.md`, `deploy-protocol.md`, `smoke-tests.md`, and the
four deploy logs — Stage 2, Stage 3, Stage 3b and production).

## 2026-07-29 — constitution Amendment 18 (1.13.0 → 1.14.0, MINOR) + Ren's drawn mark

Ren gets a real avatar. The framed "R" that stood in for it since feature 011 is replaced
by the signed-off drawn mark — one shared SVG component, four states (`idle`, `attentive`,
`thinking`, `warm`), and a slow blink that is silent under `prefers-reduced-motion`.

Principle V gains two bullets, deliberately written as two rather than one because their
scopes differ and must not be read together:

1. **Identity marks and the band scale.** A mark identifying a persistent non-human entity
   MUST NOT use a band- or outcome-carrying accent (`meadow`, `amber`, `crimson`). Ren's
   mark specifically MUST be `foggy`. This ratifies what already shipped — the landing
   page's Ren has been foggy since feature 013, as an approved FR-022 liberty flagged for
   review in ST-4. The flag is resolved by making the practice a rule.
2. **One named exception.** Inside Ren's chat surface only, the primary forward action may
   be filled `foggy` rather than `meadow`. Scoped narrowly and stated as non-generalizing:
   `meadow` remains required for primary actions everywhere else, and nothing about its
   calm/affirmative role changes.

Also registered in Principle V's palette for the first time: `--color-on-accent`
(`#F8F9FA` light; dark uses the `bg` token) and `--color-scrim`
(`rgba(28, 32, 35, 0.60)`, fixed in both modes). Both shipped in feature 007 and were
logged by Amendment 17 as a ride-along for the next Principle V amendment — this is it.
**Neither value changed**; this is documentation closing a gap in a palette declared
"locked, no additions without amendment". Closes GitHub issue #155.

The `color` prop is removed from `RenAvatar`. It was how one component came to render two
different colours — meadow in the app, foggy on the landing page — so the fix is
structural rather than a corrected default. The chat send control moves meadow → foggy
under the exception above; **no other control anywhere in the product was recoloured.**

Contrast measured, not assumed: filled foggy with `--color-on-accent` is 5.33:1 light and
8.34:1 dark, both AA and both better than the meadow the send control replaced (4.78:1).

Cross-references: `.specify/memory/constitution.md` Amendment 18; `docs/DECISIONS.md`
2026-07-29; `docs/BACKLOG.md` "From constitution Amendment 17" (#155, resolved).

## 2026-07-30 — constitution Amendment 19 (1.14.0 → 1.15.0, MINOR): the chat surface goes foggy

Amendment 18's second bullet is replaced, one day after it landed. It scoped the foggy
exception to a single control — "the primary forward action (the composer's send control)"
— and applying it showed that was the wrong unit. Recolouring the send button alone left
eight other meadow elements on the same screen, each reading as the defect the exception
exists to prevent.

Two changes:

1. **Stated at surface level, and made a consistency requirement.** Ren's chat surface MAY
   take `foggy` for accent-carrying elements — primary actions, sent-message bubbles,
   accent text links, focus indicators — and where it does, it MUST take it across all of
   them. A surface with some accent controls meadow and others foggy is worse than either.
2. **Extended to Ren's entry points.** Controls whose sole purpose is to open Ren — today
   the floating chat pill — are covered. Written to reach the control and NOT its host: a
   dashboard carrying a foggy Ren pill keeps meadow for its own actions.

Still one named surface. `meadow` remains required for primary and forward actions
everywhere else, and nothing about its calm/affirmative role changes.

Migrated: the user message bubbles, "Say hello", the composer focus ring, "Open full
history", "Try again", the end-chat link, the rename input's focus border, the pill panel's
two header controls, and the pill itself.

**No new token.** `--color-foggy` serves every site directly — and unlike meadow, which
needed a deepened `--color-meadow-text` for small text (raw meadow is a marginal 4.61:1 on
surface), raw foggy reads 5.15:1 light / 7.68:1 dark and needs no sibling. Every ratio in
the migration improved on the meadow it replaced: focus rings 4.22 → 4.71 light and
7.43 → 8.34 dark, accent text links 5.76 → 5.15 light and 7.68 dark, the pill's dark
outlined chip 6.8 → 7.68, filled surfaces 4.78 → 5.33 light and 8.34 dark. No AA regression
at any site.

Cross-references: `.specify/memory/constitution.md` Amendment 19; `docs/DECISIONS.md`
2026-07-30; `docs/DECISIONS.md` 2026-07-29 (Amendment 18, superseded bullet).

## 2026-08-05 — constitution Amendment 20 (1.15.0 → 1.16.0, MINOR): the boundary splits in two, and controls step forward

The #209 fix, landed as the two-token split the 2026-07-29 scope correction prescribed
rather than the one-line deletion the issue first looked like.

**The defect.** `@theme inline` re-declared `--color-border` in terms of itself. A cyclic
custom property is invalid at computed-value time, so every light-mode `border-border`
fell back to `currentColor` — ink hairlines wherever `#D7D9DC` was designed. Dark mode was
masked by `:root.dark`'s literal. Deleting the line was necessary but not sufficient:
`#D7D9DC` lands at 1.2–1.3:1 on control boundaries, and the consent checkbox and OTP
digit boxes are empty controls whose border is the whole affordance — WCAG 1.4.11 failures
the ink accident had been hiding. Dark failed the same way independently (`#23272B` at
1.12–1.18:1 doing control duty).

**The split.** `--color-border` (values unchanged) is now the decorative seam — dividers,
card outlines, chrome. New Graphite token `--color-control` is the control boundary.
Light `#7D8083` (the value settled at the 2026-07-29 review) clears 3:1: 3.39:1/3.67:1
against bg/surface. Dark is DELIBERATELY the seam value `#23272B`: the review's 3:1 dark
candidate (`#6C7074`) and the mathematical floor (`#64686B`, 3.07:1) were built and shown
side-by-side against the quiet dark form at ratification, and Mohamed rejected both on
looks — the grey rims broke the dark surface's calm. Dark labeled inputs are identified
by label + fill under 1.4.11's component-identification reading; the residual (empty OTP
digit boxes at ~1.15:1 in dark) is a recorded, accepted cost, re-adjudicable by changing
one token value. shadcn's `--color-input` re-points to the control token, so the outline
Button variant follows in both modes.

**Receiving controls**: the auth/account `Field` inputs, `PasswordInput`, the OTP digit
boxes and the OTP fallback input, the consent checkbox, the chat composer textarea, and
the recent-chats rename input. The questionnaire option tiles stay seams — they are
filled, text-bearing button-tiles, not empty boxes. `Card` states `border-border`
explicitly (Tailwind v4's bare `border` defaults to `currentColor`, which left card
outlines ink-heavy once the seams around them lightened).

**Empirical**: computed-style probes on a live build confirm field + OTP at the control
values and seams at the seam values; the dark login form renders pixel-identical to its
pre-split appearance by construction (same value, same sites). One honest finding
recorded: Chromium renders the native-appearance consent checkbox (author borders compute
to 0px on it), so its visible box is UA-drawn — the token on it is correct where engines
paint author borders, and the Chromium-native box is itself clearly visible in both
schemes.

Ordered after #211 (focus-indicator consistency, closed 2026-07-29) exactly as the
BACKLOG entry required, so the split regresses no focus signal.

Cross-references: `.specify/memory/constitution.md` Amendment 20; `docs/DECISIONS.md`
2026-08-05 (#209); `docs/BACKLOG.md` #209; GitHub #209, #211.

## 2026-08-05 — constitution Amendment 21 (1.16.0 → 1.17.0, MINOR): the checkbox leaves the browser's hands, and empty boxes stay findable in the dark

Follow-on to Amendment 20, same date, from looking at the real dark surfaces.

**The consent checkbox becomes custom-rendered** (`appearance-none` + an inline lucide
check glyph). The UA-drawn box had ignored author borders entirely — computed border-width
0 in Chromium — so every token ever put on it was inert and the browser painted its own
rim outside the palette. The glyph is an inline SVG element following `peer-checked`, not
a CSS background-image (the CSP's `img-src 'self'` would block a data: URI), so the no-JS
path renders identically. Checked state: meadow fill + the filled-accent foreground pair.

**New token `--color-control-strong`** (light `#7D8083`, dark `#6C7074`): the
empty-affordance control boundary, 3:1 in BOTH modes. This refines Amendment 20's
quiet-dark adjudication rather than reversing it — that permission rests on label + fill
identifying a control, which an empty box does not have. Adjudicated by Mohamed from a
three-way side-by-side (browser-drawn / quiet `#23272B` / 3:1 `#6C7074`); the 3:1 box won
for dark. The OTP digit boxes remain on the recorded quiet-dark residual pending their own
adjudication — they are the natural next consumer.

Cross-references: `.specify/memory/constitution.md` Amendment 21; `docs/DECISIONS.md`
2026-08-05 (Amendment 21); `apps/web/components/consent/terms-acknowledgement-field.tsx`.

## 2026-08-12 — spec(013-public-surface-and-legal) amendment: the binding terminology is reversed (#198)

`plan.md` §11's terminology header read: **weekly work-environment check-in** = the text
questionnaire; *bare "check-in" is never used*. It now reads the opposite way — **"check-in" is
the friendly name for the monitoring session**, and the questionnaire is the **weekly
work-environment survey**, never a check-in.

Rationale: the rule was binding on 013's copy but not on the code 013 was written against. The
signed-in dashboard has said **Start check-in** on the button that starts a camera capture since
feature 008 (`6ae3b1e`, 2026-06-22), so the Terms and Privacy Policy 013 shipped described a
product whose primary action used their word for the *other* surface — the one that is text-only.
013 did not introduce the contradiction; it made it visible by writing the two names down
carefully and publishing them. The app's wording is what users read daily and the legal text is
what they read once, so the documents moved.

Consequence, and the reason this is an amendment rather than a copy tweak: two new consent
revisions, `terms_privacy@2026-08-12.1` and `camera_inference@2026-08-12.1`, both classified
**material**, so everyone whose recorded acceptance predates them is asked again. That cost was
accepted when the change was decided.

`plan.md`'s ST-12 still reads "check-in" and is left alone — smoke-test text records what was
run and is not rewritten after the fact; the amendment note says so in place.

**Not a constitution amendment.** Principle I (`.specify/memory/constitution.md:762`, `:774`)
still calls the survey "the weekly employee check-in" and uses "check-in flag" for the *"I'd like
to talk"* button, and both now contradict the shipped copy. The exact diff is proposed in PR
**#258** and awaits explicit approval; nothing in `.specify/memory/` was touched.

Cross-references: `docs/DECISIONS.md` 2026-08-12; `docs/BACKLOG.md` #198; GitHub #198; PR #258;
`specs/013-public-surface-and-legal/plan.md` §11.

## 2026-08-12 — constitution Amendment 22 (1.17.0 → 1.17.1, PATCH): Principle I stops calling two other things a "check-in"

Same date and same PR (**#258**) as the #198 terminology change above. Principle I was the **last**
place in the project still using the old vocabulary — the app, both legal documents, the consent
gates, Ren's system prompt and `specs/013` §11 had all moved, leaving the rulebook contradicting the
surfaces it governs.

**(a) "the weekly employee check-in" → "the weekly work-environment survey"** (`:762`). The renamed
concept, matching the shipped copy. The invariant the bullet carries is unchanged: still a distinct
employee-submitted class, still reaching the manager-facing layer ONLY as an anonymized team-level
aggregate, with minimum-headcount suppression still required before real employee data.

**(b) "a discreet check-in flag" → "a discreet talk request"** (`:774`), plus one disambiguating
sentence. **Not a find-and-replace.** "Check-in flag" named a *third* thing — neither the camera
session nor the survey, but an employee-initiated, content-free signal to a manager — so it needed a
real name rather than a substitution.

**"Talk request"** was chosen because it mirrors the control's own label, *"I'd like to talk"*: the
thing and the button that produces it now share a vocabulary, which is the tightest mapping
available. **"Conversation request" was rejected** — "conversation" is already the companion's word
in the Privacy Policy ("Companion conversation"), and a manager-directed request must not read as a
request to talk to Ren. **"Flag" was rejected outright**: it reads as something recorded *about* an
employee, when this is something the employee *asked for*, and that inversion is the surveillance
framing Principle I exists to refuse. The added sentence — "A talk request is neither a check-in nor
a survey response: it carries no reading, no answer, and no reason — only that the employee asked" —
makes the distinction normative rather than leaving it to a reader.

**Nothing to rename in code.** `check-in flag` appears nowhere outside the constitution, and the
*"I'd like to talk"* button is unbuilt — a reserved layout slot (`specs/003` FR-006) and explicitly
out of scope in `specs/011`. Prose only; no identifier, column, component, or route.

**PATCH, not MINOR**: terminology clarification. No principle added, removed, or restructured, and
no requirement changed in force or scope (Amendment 6 / 7 / 11 precedent). Amendment 13's historical
rationale text (`:337`, `:348`) is deliberately **not** edited — amendment history records what was
decided at the time. Templates re-audited for the touched literals: zero matches, consistent with the
Amendment 8–13 and 21 audits.

**Approved explicitly by Mohamed on 2026-08-12**, who asked for it folded into the open PR rather
than a second one. Recorded because the standing rule is that no agent amends the constitution
unasked, and the approval is the thing that makes this entry legitimate.

Cross-references: `.specify/memory/constitution.md` Amendment 22; `docs/DECISIONS.md` 2026-08-12;
`docs/BACKLOG.md` #198; GitHub #198, #259; PR #258.

## 2026-08-12 — no spec amended; two spec-record citations corrected

The backlog-hygiene pass (14 issues closed, nine BACKLOG drifts corrected) **amends no spec and
changes no code**. It is recorded here only because two documents were pointing at the wrong place
for a spec-recorded ML gate, and a reader following either would have found nothing.

- `docs/BACKLOG.md` **#72** asserted the extraction-vs-notebook fidelity chain **"has NEVER run"**.
  It ran on 2026-06-20 and passed bit-for-bit (`max|Δ| = 0` across all 2958 dims). The record is
  `specs/008-stress-inference-service/spec.md:200`, relied on at that feature's `research.md:507`.
  The entry now cites it; the false sentence is kept beneath, unedited, so the drift stays legible.
- `docs/DECISIONS.md` (2026-06-25, protobuf-CVE accept-and-document) cited the same gate as
  *"PROGRESS 2026-06-20, MODEL_HANDOFF"*. **Neither record exists.** That citation carries a live
  obligation — any deliberate ML-stack upgrade must re-run the gate — so a dangling pointer there
  is a backstop nobody could act on. Repointed to the 008 spec line; the obligation is unchanged.

Both were found by the 2026-08-10 issue-catalogue recon, not by anything automated.

## 2026-08-12 — no spec amended; the Dependabot record in BACKLOG #176 rewritten

Dependabot batches 1 and 3 (10 alerts closed) **amend no spec**. Recorded here only because
`docs/BACKLOG.md` **#176** was rewritten rather than updated: its count, package list, fix path and
its "do not upgrade while 013 is unmerged" caveat were all overtaken, and a reader following the
entry as written would have acted on a state that no longer existed.

- The 2026-07-28 note said clearing the `postcss` pair needed "a `next` release that itself moves
  its vendored `postcss`, or a deliberate lockfile override". **The first happened**: `next@16.3.0`
  pins `postcss@8.5.23`, replacing the hard `8.4.31` pin carried through all of 16.2.x. No override.
- The superseded 2026-07-27/07-28 text is **kept in place beneath a rule**, unedited, so the drift
  and the reasoning that was overtaken both stay legible.
- Two alerts stay open **deliberately**, with reasoning in the entry — `h2` (deferred to the next
  API deploy, on cost not risk) and `cryptography` 48 → 50 (two majors under JWT verification,
  vulnerable function never called).

No constitution amendment. Cross-references: `docs/BACKLOG.md` #176; GitHub #176.

## 2026-08-13 — constitution Amendment 23 (1.17.1 → 1.17.2, PATCH); band display rename

The display bands renamed **At ease / A little tense / Tense → Calm / Uneasy / Tense**
across the app, Ren's opener context, the Privacy Policy, and the pitch-video sources of
truth. No feature spec is amended: specs 008–013 keep the old labels as historical record
(same rationale as the signed-off mocks). The constitution's one live use — the
`--amber-soft-line` gloss, "the mid 'a little tense' graph line" — is Amendment 23, a
PATCH bump; full log entry in `.specify/memory/constitution.md`. The Privacy Policy's one
band-bearing line was judged **non-material** (a value renamed inside a category, not the
category itself), so no consent revision and no re-prompt. Enum keys and CHECK constraints
unchanged; no migration. Supersedes #92. The submitted pitch render keeps the old labels —
recorded in `docs/video/serenify-pitch-video-beat-sheet.md`, which itself moves to the new
vocabulary. Reasoning: `docs/DECISIONS.md` 2026-08-13.

## 2026-08-14 — two BACKLOG entries rewritten, not updated: #218's diagnosis and #208's status

The test-suite fix **amends no spec**. Recorded here for the same reason as the Dependabot
entry above: two `docs/BACKLOG.md` entries were **rewritten rather than updated**, because
following either as written would have led a reader somewhere false.

- **#218** — the filed diagnosis (Vitest failing on an outside-root import, from a repo path
  containing a space) was **refuted** by isolated repro: a trivial `.mjs` imported the same way
  from a path with a space passes. The cause is **shebang + CRLF** — Vite's shebang strip is
  `\n`-only, so on a Windows CRLF checkout the surviving `\r` reaches the parser. The entry now
  carries the repro table and the real cause; the GitHub issue body was rewritten **before**
  closing, so the wrong read is not left as the record. Fixed by `.gitattributes`.
- **#208** — the 2026-08-14 recon read it as no longer reproducing and inferred an upstream
  Supabase CLI fix, while flagging that it had **not** run `supabase db reset`. That caveat was
  the answer: against a fresh `supabase db reset --local` on CLI 2.114.0 it reproduces
  **byte-for-byte**. The measurement had come from a stale local volume granted out-of-band.
  The entry now records the re-verification, the manual local grant that unblocks e2e, and the
  fact that the grant is **not** a fix. **#208 stays open**; the CLI is pinned so the next
  measurement is against a known stack.

No constitution amendment. Reasoning: `docs/DECISIONS.md` 2026-08-14. Cross-references:
`docs/BACKLOG.md` #208, #218, #263, #264; GitHub #218 (closes with this PR), #208 (open).

## 2026-08-14 — Three unauthorized SpecKit directories removed (022, 023, 024)

`specs/022-cold-start-readiness/` and `specs/023-brand-email-social-preview/` (created unprompted
by a Codex session during the July deployment work, numbers hand-picked — the origin of the
013 → 022 jump) and `specs/024-test-data-seeding/` (a bounded task that should never have been a
spec) are removed, along with the never-pushed local `024-test-data-seeding` branch. SpecKit is
reserved for explicitly approved features — the rule is now in `CLAUDE.md`/`AGENTS.md`; the next
feature is `014-recommendations`, and the 014–021 gap carries no meaning.

Records were absorbed before deletion: the 2026-07-13 production smoke sign-off (the only evidence
that lived solely in the 022 folder) is now stated in full in the 2026-07-13 entries above, in
`docs/PROGRESS.md`, and self-contained in open issue #139; the 024 seeding-identity decision
(Option B, a purpose-made seeding identity) is recorded in `docs/DECISIONS.md` 2026-08-14. The
cross-reference lists in this file's 2026-07-12/13 entries were edited to note the removal, and
the two Principle VIII deviation records stand as written with a dated bracketed note. BACKLOG
#187 was recategorised (its test file shipped with PR #143, not feature 009) and its GitHub issue
resynced. Shipped code from PRs #143 and #144 is untouched.

## 2026-08-14 — spec(002-demo-seed-data · 004-onboarding-video-anchor) — seeding writes as the purpose-made identity (#208)

Both seed scripts and the e2e harness now perform table writes as `serenify_seeder`
(DECISIONS 2026-08-14, both entries) instead of `service_role`, which never held table
DML on this project. Three observable amendments to spec-002/004 behaviour:

- `npm run seed -- --remote` REFUSES outright (exit 1) instead of prompting y/N: the
  seeding identity is only assumable on local stacks, so no remote target can be
  seeded. The FR-012 prompt and its exit 4 are retired; `scripts/lib/confirm.ts` is
  deleted with them. `seed:accounts` refuses a deployed SUPABASE_URL the same way,
  at startup, before any auth user is created.
- FR-018's "single bulk profile update statement" becomes upsert (identity columns)
  + ONE bulk anchor UPDATE for the whole cohort: a PostgREST upsert reads every
  payload column back via EXCLUDED (requiring SELECT on it), and anchor_vector is
  deliberately SELECTable by no client role. The DECISION-17 synthetic-anchor write
  itself is preserved verbatim — only the statement shape changed.
- The seed-demo integration suite asserts anchor presence via anchor_captured_at +
  anchor_model_version, no longer by reading anchor_vector.
