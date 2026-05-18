# Serenify — Progress Log

Per-feature implementation log. Append-only, newest first.

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
