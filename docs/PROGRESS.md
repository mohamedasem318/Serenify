# Serenify — Progress Log

Per-feature implementation log. Append-only, newest first.

---

## Feature 003 — Employee Dashboard Shell (implementation complete)

**Branch**: `003-employee-dashboard-shell`
**Status**: implementation complete, awaiting smoke-test + merge approval.
**Date**: 2026-05-25 (Phase 13 close; implementation work spanned 2026-05-19 → 2026-05-25)

**Scope shipped** (13 phases / 71 tasks):

- **Auth-primitive extraction** (Phase 2): `PasswordInput`,
  `PasswordRequirements`, `OtpPanel`, and a new `Field` wrapper
  moved to `apps/web/components/ui/auth/`. (auth) page forms
  reimport by path; pages render byte-equivalent to `main` per
  FR-040.
- **`next-themes` migration** (Phase 3): `attribute` flipped from
  `data-theme` to `class`; localStorage namespaced from `theme` to
  `serenify-theme`. Inline migration shim in root layout populates
  the new key from legacy storage on first load (T014 resolution
  at `a5d89b3` + `073bdaf` after the initial guard was too strict).
- **shadcn/ui on Tailwind v4** (Phase 4): manual init (per
  CHANGELOG 2026-05-20 amendment), `components.json` per
  Decision E, 7 primitives installed (button, card, dropdown-menu,
  sheet, dialog, avatar, separator). Mist & Meadow tokens drive
  every shadcn CSS variable via the 19-row `@theme inline` mapping
  in `globals.css`. `--color-*` prefix correction (CHANGELOG
  2026-05-20) unblocked Tailwind v4's utility-class generation;
  7-step radius ladder added in the same correction commit.
- **Header + center nav + profile dropdown** (Phase 5): Server-
  Component `<Header>` reads `profiles.full_name` and `profiles.role`
  once; passes props down to client sub-components (`<CenterNav>`,
  `<ProfileDropdown>`, `<MobileMenu>`). Shared
  `<SignOutButton>` used by the dropdown, account-page Sign out
  section, and role placeholder.
- **`/app/account` page** (Phase 6): five vertical sections —
  Profile (edits `full_name` via Server Action with optimistic
  in-section avatar + `router.refresh()` to flush the header on the
  same render cycle); Security (inline change-password form per
  FR-020 CHANGELOG 2026-05-21 amendment; throwaway anon client for
  current-password verification); Privacy + Notifications
  placeholders; SignOutSection.
- **`/app` body** (Phase 7): employee role sees `<WelcomeBanner>`
  (adaptive greeting + locked Decision M subtitle "A space to
  check in with yourself.") + three skeleton cards in the
  documented 60/40 layout (Today's check-in / Things that might
  help / Recent chats). Stacks single-column at 360px.
- **Chat pill** (Phase 8): visual-only `<ChatPill>` anchored
  bottom-right on employee pages only (FR-035). Writes
  `--chat-pill-offset: 48px` on `<html>` for the notification
  stacking convention.
- **Notification component** (Phase 9): Radix Dialog + Framer
  Motion composition (not Sonner). Desktop slide-in / mobile
  bottom-sheet bifurcation via `useMediaQuery`; `useReducedMotion`
  collapses to opacity-only. Built but not mounted by production
  code per FR-033 — features 007/008/010 consume.
- **Role placeholders** (Phase 10): `<RolePlaceholder>` for
  team_lead and admin; locked Decision L copy with the
  CHANGELOG 2026-05-22 admin-subtitle amendment ("available below"
  → "available from the header dropdown"). FR-035: no chat pill
  for managers.
- **Cross-tab auth listener** (Phase 11): `<CrossTabAuth>` at root
  layout per DECISION-8. Decision N amendment (commit 0e4637f /
  CHANGELOG 2026-05-22) replaced supabase-js storage propagation
  with an explicit broadcast helper at
  `apps/web/lib/auth-broadcast.ts` because `@supabase/ssr` stores
  the session in cookies, not localStorage.
- **Verification + polish** (Phase 12): `employee-dashboard-shell.spec.ts`
  Playwright happy-path covers US 1 + US 2; clean stale-import sweep;
  full test pass green across all gates.
- **Phase 13**: DECISIONS.md collected (12 entries — 11 planned +
  FR-020 amendment); BACKLOG follow-ups appended (4 new entries
  including the T066 pipe-buffering note); cross-tab + auth-
  primitive extraction backlog items marked resolved against
  feature 003's resolutions.

**Test results**:

- Vitest: **154/154 in 20 files** (10.6s).
- Playwright: **54/54** total — chromium 18/18 (37.8s), firefox
  18/18 (1.4m), webkit 18/18 (7.3m). Includes 2 new feature 003
  specs (`employee-dashboard-shell.spec.ts`,
  `cross-tab-auth-sync.spec.ts`) plus the 7 preserved feature 001 /
  hotfix specs (admin-seeded, team-lead-seeded, employee-otp,
  employee-signup, reset-password, demo-coexistence,
  login-expired-link). Only permitted change to feature 001 specs:
  role-placeholder copy assertions in `admin-seeded.spec.ts` /
  `team-lead-seeded.spec.ts` per T057 / FR-036 + admin-subtitle
  refinement per Decision L amendment.
- Typecheck: 0 errors. Lint: 0 warnings.

**Gates passed**:

- ✅ Spec gate — all `specs/003-employee-dashboard-shell/`
  artifacts populated.
- ✅ Constitution Check — Principles V (calm voice, no red on
  affective surfaces with FR-042 destructive-surface clarification
  in constitution 1.1.0), VI (light + dark equal-priority), VII
  (Vitest + Playwright coverage), VIII (DECISIONS.md, CHANGELOG,
  PROGRESS.md), IX (no new secrets, no new env vars) addressed in
  `plan.md`.
- ✅ Test gate — typecheck, lint, Vitest, Playwright all green
  across the three browser projects (T066).
- ✅ Auth regression — feature 001's seven auth Playwright specs
  preserved unchanged save the T057 role-placeholder copy update
  per FR-036.
- ⏳ Smoke-test gate — pending Mohamed's run of
  `specs/003-employee-dashboard-shell/smoke-tests.md` (T071,
  manual; ST-1 through ST-10 including the three cross-tab +
  email/reset scenarios added in T063.1).
- ⏳ Mohamed's final review and merge to `main`.

**Decisions logged in DECISIONS.md (2026-05-25, T067)**:

- DECISION-1: shadcn on Tailwind v4 path + manual init
  substituted.
- DECISION-2: 19-row variable mapping + 3 load-bearing choices
  + `--color-*` prefix convention + 7-step radius ladder.
- DECISION-3: `data-theme` → `class` + `serenify-theme` storage key.
- DECISION-4: three-tier component folder convention.
- DECISION-5: notification on Radix Dialog + Framer Motion (not
  Sonner).
- DECISION-6: notification explicit-dismiss only.
- DECISION-7: welcome banner subtitle locked to "A space to check
  in with yourself."
- DECISION-8: cross-tab listener mounts at root layout.
- DECISION-9: Playwright cross-tab spec pattern (single context,
  two pages) + Decision N amendment (explicit broadcast helper).
- DECISION-10: `framer-motion` + `tw-animate-css` dep deltas.
- DECISION-11: chat-pill / notification stacking via
  `--chat-pill-offset`.
- FR-020 amendment: inline change-password form on `/app/account`.

Plus the existing 2026-05-20 entry: FR-042 scope clarification
(red permitted on destructive action surfaces only via the
`--color-crimson` token).

**Deferred to BACKLOG.md (2026-05-25, T068)**:

- Dynamic welcome banner subtitle variants (deferred-feature)
- Notifications-section live controls (deferred-feature)
- Welcome banner timezone awareness (deferred-bug)
- Playwright local matrix run pipe-buffering note (deferred-tooling)

**Resolved against BACKLOG.md (2026-05-25, T069)** — feature 001
entries closed by feature 003 work:

- "Cross-tab auth state sync" — Phase 11.
- "Auth form components inlined in page files" — Phase 2.
- ("/login does not render ?error=expired_link" — was already
  resolved on the earlier hotfix; verified, not re-touched.)

**Deviations resolved during implementation** (full context in
CHANGELOG.md):

- 2026-05-19: spec Out-of-Scope bullet referencing the expired-link
  hotfix recon — superseded by `8dc822b` (PR #2 merge).
- 2026-05-20: Tailwind v4 `@theme inline` prefix correction.
- 2026-05-20: FR-042 scope clarification (red on destructive only,
  constitution V1.1.0 bump).
- 2026-05-20: shadcn manual init substituted for `shadcn@latest init`.
- 2026-05-21: FR-020 inline change-password form replaces link-to-
  /forgot-password (T034 design failed the proxy redirect contract).
- 2026-05-22: Decision N amendment — explicit broadcast helper.
- 2026-05-22: Decision L admin subtitle copy refinement.

**Commit count**: **112 commits** on the `003-employee-dashboard-shell`
branch (from `65dac2d` "feat(003): add employee dashboard shell spec"
through `f037b4a` "docs(003): T069 — sweep BACKLOG").

---

## Feature 002 — Demo Seed Data (implementation complete)

**Branch**: `002-demo-seed-data`
**Status**: implementation complete, awaiting smoke-test + merge approval.
**Date**: 2026-05-18

**Scope shipped**:

- `scripts/seed-demo.ts` CLI entrypoint with three code paths:
  idempotent create-or-skip (default), `--reset` (pattern-scoped delete
  + recreate), `--remote` (two-key opt-in to the deployed project).
- Five pure helper modules in `scripts/lib/`: `hierarchy.ts` (the
  canonical 30-slot generator), `env.ts` (`apps/web/.env.local` loader
  + CLI arg parser + target resolution), `supabase-admin.ts` (service-
  role client factory with production-load guard), `confirm.ts`
  (interactive y/N prompt for the remote path), `banner.ts`
  (environment / summary-table / password banner formatters).
- Root tooling: `package.json` devDeps (`@faker-js/faker` 9.2.0 exact,
  `tsx` 4.19.2 exact, `@supabase/supabase-js`, `dotenv`, `vitest`,
  `cross-env`), four npm scripts (`seed`, `seed:reset`, `test:seed`,
  `test:seed:integration`), new root `tsconfig.json` scoped to
  `scripts/`, new root `vitest.config.mts`.
- Playwright retrofit (FR-019): `apps/web/tests/e2e/setup/global-setup.ts`
  pattern-scopes the auth.users wipe to `@example.com` and removes the
  unscoped orphan-profile sweep (which would otherwise have destroyed
  demo profile rows).
- New Playwright spec `apps/web/tests/e2e/demo-coexistence.spec.ts`
  asserts the demo cohort is byte-identical before and after a full
  e2e run.

**Test results**:

- 9/9 Vitest unit assertions on `buildHierarchy(1729)` green (FR-001,
  FR-002, FR-006(a)-(e), FR-007/SC-005, Principle X).
- 8/8 Vitest integration assertions green against local Supabase
  (8.65s wall-clock for the full integration suite, well under the
  60s SC-001 budget).
- 33/33 Playwright e2e specs green across chromium + firefox + webkit
  (94s wall-clock). The new `demo-coexistence.spec.ts` ran in all three
  browsers and confirmed the demo cohort survives global-setup
  untouched.
- Root typecheck (`npx tsc -p tsconfig.json --noEmit`) green; apps/web
  typecheck (`npm run typecheck --workspace=apps/web`) also green
  after the FR-019 edit.

**Gates passed**:

- ✅ Spec gate — all `specs/002-demo-seed-data/` artifacts populated.
- ✅ Constitution Check — Principles VII, VIII, IX, X addressed.
- ✅ Test gate — unit + integration + e2e all green locally.
- ✅ Secrets scan — no new `.env*` files, no key in any banner/summary
  output, service-role key flows only through `process.env`.
- ⏳ Smoke-test gate — pending Mohamed's run of
  `specs/002-demo-seed-data/smoke-tests.md` (T025, manual).
- ⏳ Mohamed's final review and merge to `main`.

**Decisions logged in DECISIONS.md (2026-05-18)**:

- TS runner: `tsx` 4.19.2 (exact pin)
- Playwright orphan-profile sweep removed
- Demo email format `<first>.<last>.<NN>@demo.serenify.local`

**Deferred to BACKLOG.md**:

- CI integration for `npm run test:seed:integration` (deferred-feature)

---

## Feature 001 — Authentication and Role-Based Access (in review)

**Branch**: `001-auth-and-roles`
**Status**: implementation complete, awaiting smoke-test + merge approval.
**Date**: 2026-05-17

**Scope shipped**:

- Database: `public.user_role` enum, `public.profiles` table with RLS
  (self-select, admin-select, direct-reports-select, safe-fields self-
  update), `handle_new_user()` trigger seeding `role='employee'`,
  `is_admin()` helper, `admin_update_role` / `admin_update_manager`
  SECURITY DEFINER functions, `reports_under()` recursive-CTE helper
  for future signal-aggregate features.
- Web: `/signup`, `/login`, `/forgot-password`, `/reset-password`,
  `/onboarding`, `/app`, and `/auth/callback` + `POST /api/admin/invite`
  route handlers. Editorial-calm direction across all auth surfaces;
  Mist & Meadow palette with light + dark variants honored from day one.
- Middleware (proxy.ts on Next 16): 5-step gate — unauth→/login,
  auth→/app, full_name-null→/onboarding, full_name-set+on-onboarding→
  /app, otherwise pass through.
- Testing: 9/9 Vitest schema unit tests pass; 12/12 Playwright e2e
  specs pass across chromium + firefox + webkit (4 specs × 3 browsers).

**Gates passed**:

- ✅ Spec gate — all `specs/001-auth-and-roles/` artifacts populated.
- ✅ Constitution Check — Principles I, V, VI, VII, VIII, IX addressed
  in `plan.md`; deviations logged in `docs/DECISIONS.md`.
- ✅ Test gate — typecheck, lint, Vitest, Playwright all green locally.
- ✅ Secrets scan — no `.env*` files committed, no hardcoded keys.
- ⏳ Smoke-test gate — pending Mohamed's run of
  `specs/001-auth-and-roles/smoke-tests.md` (T041, manual).
- ⏳ Privacy review — note in `plan.md`'s Constitution Check.
- ⏳ Mohamed's final review and merge to `main`.

**Deviations logged in DECISIONS.md**:

- Next.js 16 (not 15)
- Vitest config is `.mts`, environment is `happy-dom`
- shadcn/ui not pulled
- Playwright `workers: 1`
- Migration packaging split: T013 (`admin_update_role` / `admin_update_manager`)
  and T014 (`reports_under`) are separate migration files rather than
  embedded in `20260517000020_profiles_rls.sql` per `contracts/migrations.md`.
  Documented in `tasks.md` § Cross-cutting notes.
- `middleware.ts` written as `proxy.ts` (Next 16 file convention).

**Bug discovered and fixed during implementation**:

- `POST /api/admin/invite` initially called the SECURITY DEFINER RPCs
  via the service-role client. `is_admin()` evaluates `auth.uid()`,
  which is NULL for service-role calls, so every invite returned 500
  with `role_update_failed: forbidden`. Fixed by routing the RPCs
  through the caller's session client (the admin client is now used
  only for `auth.admin.inviteUserByEmail`).
