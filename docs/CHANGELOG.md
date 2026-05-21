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
