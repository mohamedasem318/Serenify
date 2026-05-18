---

description: "Ordered task list for feature 001-auth-and-roles"
---

# Tasks: Authentication and Role-Based Access

**Input**: Design documents from `/specs/001-auth-and-roles/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/routes.md, contracts/migrations.md, research.md, quickstart.md

**Tests**: Per Constitution Principle VII, this feature requires Vitest unit tests for unit-testable logic and Playwright happy-path coverage per role. Test tasks are included and paired with the feature they exercise.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and committed as an atomic increment. Within each phase, the order respects the dependency chain (database → libraries → middleware → routes → UI → tests).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete deps)
- **[Story]**: User story label (`US1`, `US2`, `US3`, `US4`) for traceability — only on story-phase tasks
- **⚠ Principle VII**: marker when a task introduces code without immediate test coverage; the line names the downstream task that exercises it

## Path Conventions

This is a web-app monorepo. The Next.js application lives at `apps/web/`. Supabase migrations live at `supabase/migrations/` at the repo root (shared between Next.js now and FastAPI in feature 005). Paths in this file are repo-relative.

## Cross-cutting notes

- **First-admin bootstrap** (the `UPDATE public.profiles SET role='admin' WHERE id = ...` statement) is **NOT** a task. It is a one-time per-environment manual step run in Supabase Studio, documented in `quickstart.md` § 6.
- **smoke-tests.md** (six rows + extra checklist) is Mohamed's human-validated check **after** `/speckit.implement` completes. It is **NOT** a task.
- **Migration packaging deviation from `contracts/migrations.md`**: the `admin_update_role` / `admin_update_manager` SECURITY DEFINER functions are split into a separate migration file in this task list (T013), at the project lead's direction, rather than embedded in `20260517000020_profiles_rls.sql` as `contracts/migrations.md` shows. The SQL contents are unchanged; only the file packaging differs. Similarly `reports_under` is split into its own migration (T014).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository scaffolding — Next.js app, Supabase CLI, Tailwind v4 design tokens, theme provider. Each task is independently committable.

- [X] T001 Scaffold the workspace and the Next.js app. (a) At repo root, create `/package.json` with `{ "name": "serenify", "private": true, "workspaces": ["apps/*", "packages/*"] }` — this is the npm-workspaces declaration that makes `--workspace=apps/web` resolve from the root. (b) Run `npx create-next-app@latest apps/web` with flags: TypeScript, App Router, Tailwind, ESLint, **no** `src/` directory, **no** custom import alias. (c) Configure `apps/web/tsconfig.json` with `"strict": true`, `"noUncheckedIndexedAccess": true`
- [X] T002 Install runtime deps in `apps/web/package.json`: `@supabase/ssr`, `@supabase/supabase-js`, `react-hook-form`, `@hookform/resolvers`, `zod`, `next-themes`, `lucide-react`
- [X] T003 [P] Install dev deps in `apps/web/package.json`: `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@playwright/test`, `eslint-config-next`
- [X] T004 [P] Create `apps/web/.env.local.example` with the four required keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`); confirm `.gitignore` already excludes `.env.local` (it does; see repo-root `.gitignore`)
- [X] T005 [P] Initialize Supabase CLI at repo root: run `supabase init`, commit `supabase/config.toml`; ensure `supabase/.branches/` and `supabase/.temp/` are ignored (already in `.gitignore`)
- [X] T006 Write `apps/web/app/globals.css` with the Tailwind v4 `@theme` block per `quickstart.md` § 4: 8 light-mode tokens, 8 dark-mode tokens, font tokens (`--font-sans: Inter`, `--font-display: Instrument Serif`), `--radius-card: 12px`, `--radius-control: 8px`, `--shadow-soft`, and the `prefers-reduced-motion` reset block
- [X] T007 Write `apps/web/app/layout.tsx` with `next-themes` `ThemeProvider` (`defaultTheme="system"`, `attribute="data-theme"`), Inter and Instrument Serif font loaders from `next/font/google`, `lang="en"`, and `<html data-theme>` wiring; this is the root layout (NOT a route-group layout)

**Checkpoint**: `npm run dev --workspace=apps/web` boots a blank page that respects `prefers-color-scheme`. No routes exist yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, RLS, Supabase clients, middleware, route handlers, shared auth helpers, and test infrastructure. Everything that user-story phases consume.

**⚠ CRITICAL**: No user story can start until this phase is complete (or at least until the dependencies it needs are complete — see the dependency notes).

### Database migrations (sequential — ordering is normative)

- [X] T008 Write `supabase/migrations/20260517000000_create_role_enum.sql` per `contracts/migrations.md`: `CREATE TYPE public.user_role AS ENUM ('employee', 'team_lead', 'admin')` wrapped in the `IF NOT EXISTS` block; ⚠ Principle VII: schema-level tests cover this transitively via T029–T030
- [X] T009 Write `supabase/migrations/20260517000010_create_profiles.sql`: `public.profiles` table (id PK + FK to `auth.users(id)` ON DELETE CASCADE, full_name, role default 'employee', manager_id self-FK ON DELETE SET NULL, timestamps, `profiles_no_self_manager` check); `profiles_manager_id_idx`, `profiles_role_idx`; `public.touch_updated_at()` function + `profiles_touch_updated_at` BEFORE UPDATE trigger; ⚠ Principle VII: schema-level tests transitive (T029–T030)
- [X] T010 Write `supabase/migrations/20260517000020_profiles_rls.sql`: `public.is_admin()` SECURITY DEFINER function (granted EXECUTE to authenticated); `ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY` + `FORCE`; the three SELECT policies (`profiles_select_self`, `profiles_select_admin`, `profiles_select_direct_reports`) and the single safe-fields UPDATE policy (`profiles_update_self_safe_fields` with the WITH CHECK predicate that forbids role/manager_id changes). NOTE: the SECURITY DEFINER privileged-write functions are split into T013, not embedded here (deviation from `contracts/migrations.md`, documented in cross-cutting notes); ⚠ Principle VII: RLS enforcement tests in T029–T030
- [X] T011 Write `supabase/migrations/20260517000030_profile_trigger.sql`: `public.handle_new_user()` SECURITY DEFINER function that inserts `(id, full_name, role)` with `role = 'employee'` hard-coded (NEVER read from metadata) and `manager_id = NULL` (defaulting); `on_auth_user_created` AFTER INSERT trigger on `auth.users`; ⚠ Principle VII: trigger behaviour verified by T029–T030 inviting users and observing the seeded profile row
- [X] T012 Run `supabase db reset` against the local Supabase Docker stack and confirm migrations T008–T011 apply cleanly with no errors; sign up a test user via Supabase Studio and assert the `profiles` row was created with `role = 'employee'`, `manager_id = NULL` (sanity gate before adding the privileged-update functions)
- [X] T013 Write `supabase/migrations/20260517000040_admin_privileged_updates.sql`: `public.admin_update_role(uuid, public.user_role)` and `public.admin_update_manager(uuid, uuid)` SECURITY DEFINER functions per `data-model.md`; both verify `public.is_admin()` inside SQL (defence in depth), `admin_update_manager` also rejects self-management and validates target manager exists; `ALTER FUNCTION ... OWNER TO postgres`; `GRANT EXECUTE ... TO authenticated`; ⚠ Principle VII: 403/forbidden behaviour verified by T030
- [X] T014 Write `supabase/migrations/20260517000050_reports_under.sql`: `public.reports_under(uid uuid) RETURNS SETOF uuid` recursive CTE per `data-model.md`; `GRANT EXECUTE ... TO authenticated`. NOTE: this function has no consumer in feature 001; defined now so signal-aggregate features (005, 010, 011) can rely on it. ⚠ Principle VII: no test in feature 001 — function exists as a forward contract

### Supabase client factories

- [X] T015 [P] Write `apps/web/lib/supabase/client.ts` exporting `createClient()` that wraps `@supabase/ssr`'s `createBrowserClient` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; ⚠ Principle VII: exercised transitively by every Playwright spec
- [X] T016 [P] Write `apps/web/lib/supabase/server.ts` exporting `createClient()` that wraps `@supabase/ssr`'s `createServerClient` with the Next.js 15 `cookies()` adapter from `next/headers`; supports Server Components, Server Actions, and Route Handlers; ⚠ Principle VII: exercised transitively
- [X] T017 Write `apps/web/lib/supabase/admin.ts` exporting a server-only service-role client (`createClient` with `SUPABASE_SERVICE_ROLE_KEY` and `auth: { autoRefreshToken: false, persistSession: false }`); add `import 'server-only'` at the top so any client-component import errors at build time; ⚠ Principle VII: exercised transitively by T024 (admin-invite route)

### Middleware

- [X] T018 Write `apps/web/middleware.ts` per `contracts/routes.md` § Middleware contract: refresh session via `@supabase/ssr` middleware client, then run the 5-step gate (unauthed→/login for protected paths, authed→/app for auth paths, full_name-null→/onboarding, full_name-set+on-onboarding→/app, otherwise pass through with refreshed cookies); export the matcher excluding `_next/static`, `_next/image`, `favicon.ico`, and static image extensions; ⚠ Principle VII: middleware gate behaviour verified end-to-end by T029, T030. **Filename deviation**: Next 16 deprecated `middleware.ts` in favor of `proxy.ts` (function `proxy` instead of `middleware`). Wrote `apps/web/proxy.ts`; semantics identical.

### Shared auth helpers

- [X] T019 [P] Write `apps/web/lib/auth/schemas.ts` with all six Zod schemas verbatim from `contracts/routes.md` (`signUpSchema`, `signInSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `onboardingSchema`, `adminInviteSchema`); export inferred TS types via `z.infer<typeof ...>`
- [X] T020 [P] Write `apps/web/lib/auth/role-gate.ts` exporting a helper `requireRole(role, allowed)` that throws or returns based on whether the caller's role appears in `allowed`; helper for server-component / server-action callers that need to assert role membership; ⚠ Principle VII: indirect coverage via Playwright role tests (T030)

### Test infrastructure

- [X] T021 Write `apps/web/vitest.config.ts` (jsdom environment, react plugin, `setupFiles` pointing at `apps/web/tests/unit/setup.ts` which extends `expect` with `@testing-library/jest-dom`) AND `apps/web/tests/unit/schemas.test.ts` covering `signUpSchema` (rejects bad email, rejects 7-char password, rejects letter-only password, accepts valid), `resetPasswordSchema` (rejects mismatched confirm), `onboardingSchema` (trims whitespace, rejects empty); this is the Vitest pair with T019. **Deviations**: (a) config is `.mts` so Node loads it as ESM (vitest CJS loader chokes on ESM-only `std-env`); (b) environment is `happy-dom` not `jsdom` (jsdom transitively requires `@csstools/css-calc` which is ESM-only and breaks under Node 22.11's `require(esm)`).
- [X] T022 Write `apps/web/tests/e2e/setup/admin-client.ts` as its own task per project lead's direction: export a Supabase service-role client using `SUPABASE_SERVICE_ROLE_KEY`. Top of file MUST start with `if (process.env.NODE_ENV === 'production') throw new Error('admin test client must never run in production')` so any accidental production import crashes at module load
- [X] T023 Write `apps/web/playwright.config.ts` (Next.js dev server via `webServer`, base URL `http://localhost:3000`, projects for chromium + firefox + webkit, `storageState` directory, `globalSetup: './tests/e2e/setup/global-setup.ts'`) AND `apps/web/tests/e2e/setup/global-setup.ts` with the following four steps in order. **This global-setup is the ONLY mechanism that creates the test admin** — T031 and T032 depend on the `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` env vars it exports.

    **Step 1 — Localhost guard** (FIRST line of `global-setup.ts`, before importing or invoking the admin client):
    ```ts
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
      throw new Error(`Refusing to run tests: NEXT_PUBLIC_SUPABASE_URL is "${url}", not a local Supabase. Truncating it would destroy real data.`);
    }
    ```

    **Step 2 — Truncate `auth.users` and `public.profiles`** (in that order). Because `auth.users` is owned by Supabase Auth and cannot be `TRUNCATE`d by the application, enumerate users via `admin.auth.admin.listUsers()` and delete each via `admin.auth.admin.deleteUser(id)`. The `profiles` row cascades on `auth.users` delete (the FK is `ON DELETE CASCADE`), so an explicit `admin.from('profiles').delete().neq('id', ...)` is a belt-and-braces follow-up — leave it in.

    **Step 3 — Seed the test admin** (fixed credentials; not a secret because the localhost guard in Step 1 already proves the target is a throwaway local Supabase):
    ```ts
    const { data: { user } } = await admin.auth.admin.createUser({
      email: 'test-admin@example.com',
      password: 'TestAdmin123!',
      email_confirm: true,
      user_metadata: { full_name: 'Test Admin' },
    });
    // The handle_new_user trigger created a row with role='employee'. Promote it
    // directly via the service-role client (bypasses RLS by design).
    await admin.from('profiles').update({ role: 'admin' }).eq('id', user.id);
    process.env.TEST_ADMIN_EMAIL = 'test-admin@example.com';
    process.env.TEST_ADMIN_PASSWORD = 'TestAdmin123!';
    ```

    **Step 4 — Playwright browser binaries** (one-time-per-machine setup, not per test run): document in this task's notes that contributors must run `npx playwright install --with-deps chromium firefox webkit` once after cloning. The Playwright `webServer` block will boot the Next.js dev server automatically; the browsers must already be installed locally.

    ✅ Done.

### Route handlers (foundational infrastructure)

- [X] T024 Write `apps/web/app/auth/callback/route.ts` (GET): parse `code` and optional `next` from the URL, call `supabase.auth.exchangeCodeForSession(code)` server-side, on success `redirect(next ?? '/app')` (middleware will bounce to `/onboarding` if needed), on failure `redirect('/login?error=expired_link')`
- [X] T025 Write `apps/web/app/api/admin/invite/route.ts` (POST) implementing the 4-step flow from `contracts/routes.md`: (1) verify caller's JWT resolves to `role = 'admin'` via the server client + a `profiles` SELECT; 403 if not. (2) `supabase.auth.admin.inviteUserByEmail(email)` via the admin client from T017. (3) `supabase.rpc('admin_update_role', { target_user_id, new_role })`. (4) If `manager_id` provided, `supabase.rpc('admin_update_manager', { target_user_id, new_manager_id })`. Returns 201 `{ user_id }` on full success, 500 `{ user_id, error: 'role_update_failed' | 'manager_update_failed', detail }` on partial failure, 400 on Zod failure, 403 on non-admin caller, 409 if Supabase reports the email exists. Validates body with `adminInviteSchema` from T019

**Checkpoint**: Database is migrated; Supabase clients exist; middleware gates routes; the two foundational route handlers are in place; schemas have unit-test coverage; e2e test infrastructure is ready. **Pages do not exist yet — every `/login`, `/signup`, etc. URL returns 404, and the middleware will redirect to `/login` (which also 404s).** Phase 3 starts immediately.

---

## Phase 3: User Story 1 - Self-serve account creation (Priority: P1) 🎯 MVP

**Goal**: A new user can submit the signup form with a fresh email, receive the activation email (real Supabase email in dev), click the link, and reach a state where sign-in succeeds.

**Independent Test**: Land on `/signup`, complete the form with a fresh email + password + full_name, click the link delivered to Supabase Studio's Auth log, navigate to `/login`, sign in, confirm a session cookie exists. (Full happy-path through `/app` lands in Phase 4 once the destination page exists.)

### Implementation for User Story 1

- [X] T026 [US1] Write `apps/web/app/(auth)/layout.tsx`: a centred narrow card shell using the Mist & Meadow tokens (no red, calm voice copy, generous whitespace per Constitution Principle V); fits a 360px viewport (Principle VI); shared across `/login`, `/signup`, `/forgot-password`, `/reset-password`. **Direction**: editorial-calm — page IS the surface (no card chrome). Instrument Serif used once as the wordmark per Constitution V "reserved for hero/display moments". **Deviation**: shadcn/ui primitives not used in feature 001 — installing the registry for 3 inputs + 1 button is overkill and the cookie-cutter card aesthetic fights the editorial direction. The plan's actual contract (palette + amber-not-red + Lucide-only + calm voice) is honored exactly. shadcn lands in a later feature when there's more surface to standardize.
- [X] T027 [US1] Write `apps/web/app/(auth)/signup/page.tsx` (RSC) with a client-component form (`react-hook-form` + Zod resolver using `signUpSchema` from T019): fields email, password, full_name; submit Server Action `signUp(formData)` (colocated in `apps/web/app/(auth)/signup/actions.ts`) that calls `supabase.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: `${SITE_URL}/auth/callback` } })`. On success, render the "check your email" panel (no auto-redirect). On existing-email error, render the calm message. Touch targets ≥ 44×44px. ⚠ Principle VII: end-to-end coverage lands in T033 once onboarding+/app exist. **Verified in browser**: light + dark + 360px mobile all render correctly; full e2e signup created `e2e-verifier@example.com` and the trigger seeded a profile row with `role='employee'`, `full_name='E2E Verifier'`, `manager_id=NULL`.

**Checkpoint**: A real signup works against local Supabase — the user can complete the form, see the "check email" panel, click the activation link in Supabase Studio, and land at `/login` (which 404s for now; expected). The Playwright spec lands in T033 once the destination page exists.

---

## Phase 4: User Story 2 - Sign in to the role-appropriate workspace (Priority: P1)

**Goal**: A returning user signs in with valid credentials and lands on the placeholder authenticated page that displays their role (`"You are signed in as employee"`). Unauthenticated visitors are redirected to `/login`. Already-signed-in users on auth pages are redirected to `/app`. Sign-out works.

**Independent Test**: Sign in with each of the three roles (employee via self-signup, team_lead and admin seeded via the admin API in test setup); assert each lands on `/app` and the rendered text matches their role; assert direct navigation to `/app` while signed out redirects to `/login`; assert sign-out clears the session.

### Implementation for User Story 2

- [X] T028 [US2] Write `apps/web/app/(auth)/login/page.tsx`: client form (`react-hook-form` + Zod `signInSchema`) calling Server Action `signIn(formData)` that runs `supabase.auth.signInWithPassword`. On success `redirect('/app')` (middleware re-routes to `/onboarding` if `full_name IS NULL`). On `email_not_confirmed` error, render the resend-link panel with a button calling `supabase.auth.resend({ type: 'signup', email })`. On generic auth error, render the calm "those details didn't match" copy
- [X] T029 [US2] Write `apps/web/app/(authed)/layout.tsx`: authenticated shell with sign-out form action (`supabase.auth.signOut()` then `redirect('/login')`); reads the current user via the server client to display name; fits 360px; respects the Mist & Meadow palette. Also adds a small `ThemeToggle` client component (Lucide Sun/Moon, 44px touch target) so users have the manual override Constitution Principle VI requires; it lives on authed pages only (auth pages stay system-default).
- [X] T030 [US2] Write `apps/web/app/(authed)/app/page.tsx`: server component that fetches the caller's `profiles.role` via the server Supabase client and renders "You are signed in as **{role}**." plus the sign-out button from T029's layout; this is the placeholder authed landing — there is intentionally no dashboard in feature 001. **Verified in browser**: signed in as e2e-verifier@example.com (employee role) → /app rendered "E2E Verifier" h1 + "You're signed in as an employee." banner. Sign-out and re-login both work; proxy redirects /login→/app for an authenticated user.

### Tests for User Story 2 (paired with `/api/admin/invite` from T025)

- [X] T031 [US2] Write `apps/web/tests/e2e/team-lead-seeded.spec.ts`: the test first signs in as the seeded test admin (using `process.env.TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` exported by T023's globalSetup) and POSTs to `/api/admin/invite` with `{ email: <fresh>, role: 'team_lead' }`, asserts 201; then signs out, confirms the seeded team_lead via the admin client (test-side email-confirm bypass per research R-4), signs in as the seeded team_lead, asserts redirect to `/app`, asserts the rendered text contains `"team_lead"`, asserts `/api/admin/invite` returns 403 when called from the team_lead's session. Story-label [US2] because the seeded sign-in path is what's tested
- [X] T032 [US2] Write `apps/web/tests/e2e/admin-seeded.spec.ts`: same shape as T031 but for the `admin` role — first sign in as the seeded test admin (using `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` from T023's globalSetup), POST to `/api/admin/invite` with `{ email: <fresh>, role: 'admin' }`, assert 201 `{ user_id }`, assert the resulting row in `public.profiles` has `role = 'admin'` via the admin client; then confirm-email-bufferred, sign in as the newly seeded admin, assert redirect to `/app`, assert the rendered text contains `"admin"`. Also assert that POSTing to `/api/admin/invite` from a session with `role = 'employee'` returns 403

**Checkpoint**: All three role-routing paths are testable end-to-end. The MVP (US1 + US2) is functional: a user can sign up, confirm, sign in, see their role placeholder, sign out. Cross-role denial is still placeholder-level since no role-restricted sections exist (no team-lead or admin section UI in feature 001).

---

## Phase 5: User Story 3 - Complete profile on first sign-in (Priority: P2)

**Goal**: A first-time user who has confirmed their email is presented with a one-field profile-confirmation form (`full_name`), submits it, and lands on `/app`. Subsequent sign-ins skip the form.

**Independent Test**: Sign up a fresh user, confirm, sign in. Assert the URL becomes `/onboarding` and a `full_name` field is rendered (pre-filled if `auth.users.user_metadata.full_name` was set at signup). Submit, assert redirect to `/app`. Sign out, sign in again, assert direct landing on `/app` (no second onboarding).

### Implementation for User Story 3

- [X] T033 [US3] Write `apps/web/app/(authed)/onboarding/page.tsx`: server component that reads `auth.users.user_metadata.full_name` (if any) for the default value; client form (`react-hook-form` + Zod `onboardingSchema`) calling Server Action `completeOnboarding(formData)` that runs `UPDATE public.profiles SET full_name = $1 WHERE id = auth.uid()` via the server client (allowed by `profiles_update_self_safe_fields` since `role` and `manager_id` are unchanged; the WITH CHECK predicate is satisfied). On success `redirect('/app')`. **Built ahead of Phase 5 order** because seeded users via /api/admin/invite have null full_name and the proxy routes them to /onboarding; T031/T032 needed it to reach /app.

### Tests for User Story 1 (full end-to-end, now possible)

- [X] T034 [US1] Write `apps/web/tests/e2e/employee-signup.spec.ts`: full happy-path Playwright spec — go to `/signup`, fill the form with a fresh email/password/full_name, assert the "check your email" panel renders; in the test step, use the admin client (T022) to confirm the user (`supabase.auth.admin.updateUserById(id, { email_confirm: true })`) — this is the bypass that replaces real SMTP per research R-4; navigate to `/login`, sign in, assert redirect to `/onboarding`, fill the form, assert redirect to `/app`, assert the rendered text contains `"employee"`. Also covers responsive 360px snapshot via `page.setViewportSize({ width: 360, height: 800 })`. Story-label [US1] because the spec primarily covers US1's "self-serve account creation" journey end-to-end (also incidentally validates US2 sign-in and US3 onboarding). **Implementation note**: since signup carries full_name via raw_user_meta_data, the signed-up employee lands directly on /app (no onboarding stop), which the spec asserts. A separate signed-in cookie-clear is needed between the signup state and the login form because Supabase signup leaves an unconfirmed-session cookie.

**Checkpoint**: Three Playwright specs (T031, T032, T034) cover all three role happy-paths. Constitution Principle VII's per-role e2e requirement is satisfied. The MVP is fully test-gated end-to-end.

---

## Phase 6: User Story 4 - Recover a forgotten password (Priority: P2)

**Goal**: A user who has forgotten their password can request a reset by email, follow the link, set a new password, and sign in.

**Independent Test**: From `/login`, click "Forgot password", submit the email, copy the recovery URL from Supabase Studio Auth logs, paste in the browser, set a new password, assert redirect to `/login`, sign in with the new password, assert session is established.

### Implementation for User Story 4

- [X] T035 [US4] Write `apps/web/app/(auth)/forgot-password/page.tsx`: one-field form (`email`) using `forgotPasswordSchema`; Server Action `requestPasswordReset(formData)` calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/reset-password` })`; response copy is identical regardless of whether the email exists (FR-007). ⚠ Principle VII: not covered by an automated Playwright spec in this feature — Supabase recovery email replay in CI is out of scope; ST-4 in `smoke-tests.md` is the human-validated coverage
- [X] T036 [US4] Write `apps/web/app/(auth)/reset-password/page.tsx`: on initial GET, read `code` from URL and call `supabase.auth.exchangeCodeForSession(code)` server-side; on exchange failure render an "Your link expired" state with a "Send a fresh email" button; two-field form (`new_password`, `confirm_password`) using `resetPasswordSchema`; Server Action `updatePassword(formData)` calls `supabase.auth.updateUser({ password })`; on success `redirect('/login?flash=password_updated')`. ⚠ Principle VII: covered manually by ST-4 in `smoke-tests.md`. **Implementation note**: the PKCE exchangeCodeForSession is called CLIENT-SIDE (not server) so a stale cookie carried in by a previous tab doesn't get its session overwritten on initial render; the page renders an "exchanging" state until exchange resolves, then "ready" or "expired".

**Checkpoint**: Password recovery is end-to-end functional via the manual flow. All four user stories' independent tests pass.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final-mile work that crosses stories — documentation, decisions log, smoke-test prep, type-check sweep.

- [X] T037 [P] Run `npm run typecheck --workspace=apps/web` and `npm run lint --workspace=apps/web` across the whole `apps/web/` tree; resolve any errors in the touched files; ensure `tsconfig` strict mode passes with zero suppressions. **Two ESLint disables landed with justifications**: `react-hooks/set-state-in-effect` in `theme-toggle.tsx` (the next-themes documented mounted pattern) and the same rule in `reset-form.tsx` (URL-driven phase initialization). No `any` types, no `@ts-ignore` suppressions.
- [X] T038 [P] Run `npm run test --workspace=apps/web` (Vitest) and `npm run test:e2e --workspace=apps/web` (Playwright) one full pass against local Supabase; capture and resolve any flake; record the green run in `docs/PROGRESS.md`. **Result**: 9/9 Vitest schema tests pass; 12/12 Playwright specs pass across chromium + firefox + webkit (≈90 s with workers: 1). One race resolved by serializing workers — see DECISIONS.md.
- [X] T039 [P] Create `docs/DECISIONS.md` (the file does not yet exist on this branch; create it append-only) and add these four entries:

    (1) **Branching pattern: canonical SpecKit long-lived feature branches.** Status: accepted 2026-05-17. One feature, one branch, merged to `main` only after `/speckit.implement` and smoke tests pass. Note: feature 001's `spec.md` was merged to `main` early during Session 1 before this decision was made; continuing work on 001 happens on a re-cut branch from `main`; this is a one-time exception.

    (2) **Package manager: npm with workspaces.** Status: accepted 2026-05-17. Rationale: team familiarity; npm workspaces are adequate for the monorepo scope; no need for pnpm's stricter dependency resolution at this stage. Revisit if install time or disk usage becomes an issue.

    (3) **Repo layout — `supabase/` at repo root (outside `apps/web/`).** Status: accepted 2026-05-17. Rationale: schema is shared with feature 005's FastAPI app; co-locating with `apps/web/` would force feature 005 to move or reach across the workspace.

    (4) **Privileged column updates via SECURITY DEFINER functions instead of column-level RLS.** Status: accepted 2026-05-17. Rationale: Postgres RLS is row-not-column. Concentrating privilege escalation in two named SQL functions (`admin_update_role`, `admin_update_manager`) is the auditable alternative.

    Each entry follows the append-only convention from Constitution Principle VIII
- [X] T040 [P] Append a feature-001 entry to `docs/PROGRESS.md` (create if missing) noting: branch merged, smoke-test status, deviations resolved, gates passed
- [ ] T041 Mohamed runs through `specs/001-auth-and-roles/smoke-tests.md` manually and records ✅/❌/⚠ in the file; all six rows + the additional checklist items must be ✅ before the merge to `main`. This is NOT a code task — it is the human-validated gate per Constitution Principle VII

---

## Phase 2.5 — Smoke-test follow-ups

**Purpose**: Two bugs surfaced by Mohamed's manual run of `smoke-tests.md` against the merged Phase 1–7 implementation. Both block ST-1 and ST-4 from passing cleanly.

- [ ] T038a Fix `*FromForm` over-redirect: the `signUpFromForm`, `signInFromForm`, and `requestPasswordResetFromForm` Server Action wrappers redirect to `/login` on success, which skips the "check email" / "we sent a reset link" panels that the JS-hydrated path renders. Redirect to the SAME page with a query state param (e.g. `?state=check_email`, `?state=reset_sent`) and have the page render the panel under both JS-hydrated AND no-JS paths. Login is the only wrapper that legitimately exits to `/app`.
- [ ] T038b Fix PKCE `expired_link` on first email-link click: `/auth/callback` and `/reset-password` return `?error=expired_link` even on the user's first click. Investigate whether the handler is invoked twice (e.g. SSR + client both calling `exchangeCodeForSession`), whether the `code_verifier` cookie is missing/mismatched at exchange time, or whether `app/page.tsx`'s defensive `?code=` forward is interacting badly with the proxy. Add structured `[auth-callback]` logging if needed to pin down the call shape, then fix root cause and remove debug logging in the same commit.

---

## Phase 8 — OTP fallback and auth-surface polish (FR-020, FR-021)

**Purpose**: Implement FR-020 (OTP entry fallback for signup + password reset) and FR-021 (theme toggle on the (auth) shell), plus the vertical-centering polish discovered during smoke-testing. Phase 8 depends on Phase 2.5 completing so the underlying flows are sound before adding the fallback surface.

### Implementation

- [ ] T042 [US1] Write `apps/web/lib/auth/schemas.ts` addition: `verifyOtpSchema` — `email` + 6-digit numeric `token` + discriminant `type: 'signup' | 'recovery'`; export inferred TS type via `z.infer`.
- [ ] T043 [US1] Write `apps/web/app/(auth)/signup/actions.ts` addition: `verifySignupOtp` Server Action that validates via `verifyOtpSchema` then calls `supabase.auth.verifyOtp({ email, token, type: 'signup' })`, returning a discriminated `VerifyOtpResult` shaped like `signUp`'s result.
- [ ] T044 [US4] Write `apps/web/app/(auth)/reset-password/actions.ts` addition: `verifyResetOtp` Server Action calling `supabase.auth.verifyOtp({ email, token, type: 'recovery' })`, same discriminated-result shape.
- [ ] T045 [US1] Wire OTP entry into the signup "check email" panel as an inline alternative — small form with email pre-filled (read-only, carried from the in-memory submitted value) and a 6-digit code input. Submit calls `verifySignupOtp`; on success, navigate to `/app` (proxy bounces to `/onboarding` if needed).
- [ ] T046 [US4] Wire OTP entry into the reset-password page as a fallback shown in the "expired link" state AND below the new-password form (so users with a working link can ignore it). Inline form with email + 6-digit code; submit calls `verifyResetOtp` and transitions to the new-password form on success.
- [ ] T047 [P] Add theme toggle to `apps/web/app/(auth)/layout.tsx` — same `ThemeToggle` component pattern as the authed layout's toggle (Lucide Sun/Moon, ≥44px touch target), positioned top-right of the shell.
- [ ] T048 [P] Update `apps/web/app/(auth)/layout.tsx` vertical alignment — `min-h-dvh` with `flex justify-center items-center` and a `pt-12 sm:pt-16` floor so a mobile keyboard opening doesn't push the form off-screen. Verify at 360px, 768px, 1440px.

### Tests

- [ ] T049 [US1] Extend `apps/web/tests/e2e/employee-signup.spec.ts` (or add `apps/web/tests/e2e/employee-otp.spec.ts`) to exercise the OTP entry path: sign up → retrieve the OTP from Inbucket (`http://127.0.0.1:54324`) via `fetch` against its message JSON API → submit the OTP → assert `/onboarding` or `/app`.
- [ ] T050 Vitest tests for `verifyOtpSchema` in `apps/web/tests/unit/schemas.test.ts`: rejects non-6-digit tokens, rejects letters, rejects unknown `type`, accepts a 6-digit numeric token with `signup`/`recovery`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies. Tasks T003–T005 are [P] (different files / different concerns).
- **Phase 2 Foundational**: Depends on Phase 1.
  - **Migrations** (T008–T014) are sequential — each depends on the previous via filename ordering and SQL dependencies.
  - **T012** is a sanity-check gate between the four core migrations and the privileged-update migration; if T012 fails, the bug is in T008–T011.
  - **Supabase clients** (T015–T017) are mostly [P] but T017 depends on env keys from T004.
  - **Middleware** (T018) depends on T016.
  - **Auth helpers** (T019, T020) are [P] with each other.
  - **Test infra** (T021–T023) is [P] within itself; T021 pairs with T019; T022 stands alone; T023 depends on T022.
  - **Route handlers** (T024–T025) depend on T016, T017, T019.
- **Phase 3 US1 (P1)**: Depends on Phase 2. Cannot begin until at least T015 (browser client), T018 (middleware), T019 (schemas) are done.
- **Phase 4 US2 (P1)**: Depends on Phase 3 (signup must work so seeded users can sign in via a flow that has been validated end-to-end first).
  - Strictly speaking, US2 only requires the foundational stack plus the (auth) layout; the signup *page* (T027) is not on US2's critical path. But the human signup flow is the simplest validation that the foundation is correct, so US1 lands first by convention.
  - T031, T032 require T024 (callback) and T025 (admin/invite) to exist.
- **Phase 5 US3 (P2)**: Depends on Phase 4. The end-to-end employee-signup spec (T034) requires `/app` (T030) AND `/onboarding` (T033).
- **Phase 6 US4 (P2)**: Depends on Phase 2 only (it shares the (auth) layout from T026 but is otherwise independent of US1–US3). May be done in parallel with Phase 5 if staffed.
- **Phase 7 Polish**: Depends on all of Phase 2–6 completing.

### Within Each User Story

- Models → services → endpoints → integration. In this feature, "models" are migrations (Phase 2), "services" are Supabase clients + Server Actions, "endpoints" are pages + route handlers, "integration" is the Playwright spec for that story.

### Parallel Opportunities

- Phase 1: T003, T004, T005 in parallel.
- Phase 2: T015 + T016 in parallel; T019 + T020 in parallel; T021 + T022 in parallel after T019 lands.
- Phase 6 can run in parallel with Phase 5 if there is staff capacity.
- Phase 7: T037, T038, T039, T040 are all [P].

---

## Parallel Example: Phase 2 supabase clients + auth helpers

```bash
# Once migrations T008–T014 are applied locally, these four tasks
# can be picked up by different contributors in parallel:

Task: "Write apps/web/lib/supabase/client.ts"           # T015
Task: "Write apps/web/lib/supabase/server.ts"           # T016
Task: "Write apps/web/lib/auth/schemas.ts"              # T019
Task: "Write apps/web/lib/auth/role-gate.ts"            # T020
```

---

## Implementation Strategy

### MVP First (US1 + US2)

Feature 001's MVP is US1 + US2 together because US1 alone has nowhere for the user to land. US3 (onboarding) and US4 (password recovery) are P2 follow-ons.

1. Phase 1 Setup
2. Phase 2 Foundational (every block — migrations, clients, middleware, routes, schemas, test infra)
3. Phase 3 US1 — signup page works
4. Phase 4 US2 — login + authed shell + /app placeholder + seeded role specs
5. **STOP and VALIDATE**: smoke-test ST-1, ST-2, ST-3, ST-5, ST-6 manually
6. Demo: a real user can self-signup, confirm, sign in, see their employee placeholder

### Incremental Delivery

7. Phase 5 US3 — onboarding + full employee-signup e2e
8. **VALIDATE**: smoke-test ST-1 again (now full-path)
9. Phase 6 US4 — password recovery
10. **VALIDATE**: smoke-test ST-4
11. Phase 7 Polish — type-check, run all tests, log decisions, run all of smoke-tests.md
12. Merge to `main`

### Parallel Team Strategy

Three developers after Phase 2:

- Dev A: Phase 3 → Phase 4 (US1, US2 — the auth-flow critical path)
- Dev B: Phase 6 (US4 — independent of US1/US3)
- Dev C: Phase 7 prep (DECISIONS, PROGRESS scaffolds; type-check setup)

Dev A wraps up Phase 4, then picks up Phase 5 to extend the e2e coverage. Dev B/C support polish.

---

## Notes

- `[P]` markers indicate file independence — no contributor stomps on the same file.
- `[Story]` labels (US1–US4) map each task to its primary user story for traceability. A spec may transitively cover multiple stories (T034 covers US1, US2, US3 in one happy-path); the label reflects the spec's primary owner.
- The constitution's Principle VII (mandatory testing per PR) is satisfied by: schemas unit test (T021), three role Playwright specs (T031, T032, T034), and Mohamed's six-row smoke-test pass (T041). Tasks introducing code without immediate test coverage are flagged ⚠ Principle VII and named their downstream coverage task.
- Commit cadence: one task = one commit. The commit message convention is `<scope>(001): <imperative summary>` matching the feature-branch style used in prior commits (`spec(001):`, `plan(001):`, etc.).
- No task in this list creates the first admin. That step is per-environment, manual, and lives in `quickstart.md` § 6 — deliberately excluded from automated migration to prevent accidental admin creation in production.
