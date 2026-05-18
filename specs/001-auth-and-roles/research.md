# Research: Authentication and Role-Based Access

**Feature**: `001-auth-and-roles`
**Phase**: 0
**Date**: 2026-05-17

This document records the technical decisions made before design.
The Technical Context in `plan.md` carries no `NEEDS CLARIFICATION`
markers — they have all been resolved here.

## R-1. SSR cookie/session library

**Decision**: Use `@supabase/ssr` for all server-side and middleware
Supabase clients in Next.js 15 App Router.

**Rationale**:
- `@supabase/auth-helpers-nextjs` is in maintenance mode and the
  Supabase team explicitly redirects new App Router projects to
  `@supabase/ssr` (released for App Router cookie handling). All current
  Supabase docs assume `ssr`.
- The cookie-based session model matches Next.js 15's expectation that
  Server Components and Route Handlers read auth from request cookies.
- It provides matched factories for browser (`createBrowserClient`),
  server (`createServerClient` with cookie adapter), and middleware
  (cookie pass-through) — keeping the three contexts symmetric.

**Alternatives considered**:
- `@supabase/auth-helpers-nextjs` — rejected; deprecated for App Router.
- Hand-rolled JWT verification — rejected; reinvents what `ssr` already
  handles, including refresh-token rotation in middleware.
- Iron-session or NextAuth wrapping Supabase — rejected; introduces a
  second session layer and breaks Supabase's RLS-via-JWT model.

## R-2. Manager hierarchy: recursive CTE vs materialised view

**Decision**: Recursive CTE against `profiles(id, manager_id)`. No
materialised view in feature 001.

**Rationale**:
- Expected scale: 30 profiles for the demo seed, growing to perhaps a
  few hundred. A recursive CTE on an indexed `manager_id` column returns
  in well under a millisecond at that scale.
- The two queries the model must answer cheaply are:
  1. "Is user A a direct report of user B?" — answered by a single
     equality check on `manager_id`, no CTE needed.
  2. "What is the set of all (direct + transitive) reports under user
     B?" — answered by a recursive CTE wrapped in a SQL function
     `public.reports_under(uid uuid) returns setof uuid`.
- A materialised view introduces a refresh policy (trigger? cron?) and
  a staleness window — adding correctness risk for a problem the
  workload size does not require.
- Re-evaluation trigger: revisit if profile count crosses ~5,000 or if
  per-request recursive-CTE latency on hot paths exceeds 5 ms.

**Alternatives considered**:
- Materialised view refreshed on every `INSERT/UPDATE` of `profiles` —
  rejected as premature optimisation given current scale.
- LTREE column maintained on writes — rejected; non-trivial to keep
  consistent when a profile's manager changes, and Postgres `ltree`
  extension is not enabled by default on Supabase.
- Closure table — rejected; same maintenance cost as materialised view
  with more schema surface area.

## R-3. Email transport

**Decision**: Use Supabase's built-in email for sign-up confirmation
and password reset throughout feature 001.

**Rationale**:
- The Resend domain `serenify.tech` is not yet verified; the
  constitution's stack table explicitly allows Supabase email "until
  Resend domain verified".
- Deferring Resend keeps feature 001 self-contained — no external
  email-provider account setup is required for `pnpm dev` or CI.
- Branded transactional email is a follow-on feature once the domain
  is verified; the swap is template-level, not code-level.

**Alternatives considered**:
- Resend now — rejected pending domain verification; would block local
  development.
- A no-op email path for dev — rejected because we need to manually
  validate the magic-link reset flow during the smoke test, and
  Supabase's built-in email already supports a dev inbox via the
  Supabase Studio "Logs → Auth" view.

## R-4. Email confirmation in Playwright

**Decision**: Bypass real email delivery in Playwright tests. The
employee-signup test fills the signup form, then a test helper uses the
service-role admin client (server-side, in the test runner only) to
mark `auth.users.email_confirmed_at`. The test then proceeds to login.

**Rationale**:
- Real SMTP delivery in CI is flaky and slow, and exposes test runs to
  third-party rate limits.
- Bypassing confirmation through the admin API mirrors what a real
  admin invite does — it's a known-good code path, not test-only magic.
- Keeping the bypass server-side (in the Playwright test fixture, not
  in the app code) prevents an "in test mode, skip confirmation"
  escape hatch from existing in production code.

**Alternatives considered**:
- Mailpit / Mailhog in CI — rejected; adds an infra dependency to CI
  for marginal extra coverage of the SMTP layer that isn't part of
  feature 001's scope.
- Recording a real Supabase email and replaying — rejected; brittle.

## R-5. Admin-invite path for team_lead and admin roles

**Decision**: Two-step server-side flow in `POST /api/admin/invite`
(`apps/web/app/api/admin/invite/route.ts`):

1. Reads the caller's session via `@supabase/ssr` server client.
2. Looks up the caller's row in `public.profiles` and requires
   `role = 'admin'`. Non-admins receive HTTP 403.
3. Calls `supabase.auth.admin.inviteUserByEmail(email)` using the
   server-only admin client (created with `SUPABASE_SERVICE_ROLE_KEY`).
   The trigger `handle_new_user` immediately seeds a `profiles` row
   with the hard-coded default `role = 'employee'` and `manager_id = NULL`.
4. Immediately after a successful invite, the handler calls the
   SECURITY DEFINER function `public.admin_update_role(invited_id, $newRole)`
   (and, if a manager was supplied, `public.admin_update_manager(invited_id, $managerId)`)
   using the same admin client. These functions re-check the caller's
   admin status inside Postgres.
5. Returns `201 { user_id }` on full success. If step 3 succeeds but
   step 4 fails, the handler returns a structured `500` body
   `{ user_id, error: 'role_update_failed', detail: <message> }` so the
   caller knows the invite went out but the role is still
   `'employee'` — recoverable manually in Supabase Studio.

**Rationale (why two-step, not metadata-pre-seed)**:
- **Why not `raw_user_meta_data`?** Self-signup also writes to
  `raw_user_meta_data` (via `signUp.options.data.full_name`). A trigger
  that reads `role` from `raw_user_meta_data` would let an attacker
  pass `{ full_name: 'x', role: 'admin' }` through the public signup
  form and self-elevate. The trigger therefore *never* reads `role`
  from this field — `role` is hard-coded to `'employee'`. The trigger
  reading `manager_id` from this field would have the same problem.
- **Why not `raw_app_meta_data`?** `raw_app_meta_data` is admin-only
  (untrusted clients cannot write to it), so it would be safe to read
  in the trigger. But populating it requires either
  `supabase.auth.admin.createUser({ app_metadata: { role } })` —
  which does not send the invite email, forcing a second admin call
  to `generateLink({ type: 'invite' })` — or `inviteUserByEmail`
  followed by `updateUserById({ app_metadata: { role } })`. Either
  shape is itself two steps; choosing the explicit
  `admin_update_role` function over `updateUserById` keeps the trust
  boundary in SQL where every privileged operation is auditable in
  one place (Postgres function definitions), instead of split between
  Postgres and the Supabase Auth admin SDK.
- The chosen approach keeps the trigger trivially safe (it never
  reads privileged values from any metadata) and concentrates the
  privilege escalation in two SECURITY DEFINER SQL functions that
  re-verify `is_admin()` inside the database.

**Alternatives considered**:
- A Supabase Edge Function instead of a Next.js Route Handler —
  rejected; adds a second runtime to operate without near-term benefit.
- Manually inserting `auth.users` rows — rejected; bypasses Supabase's
  password-hashing and confirmation-token logic.

## R-6. Role storage: enum vs text vs lookup table

**Decision**: Postgres enum `public.user_role` with values
`('employee', 'team_lead', 'admin')`. Stored as the `role` column on
`public.profiles`.

**Rationale**:
- Three fixed values, never user-input. Enum is the canonical Postgres
  type for a closed set.
- Compile-time safety: Supabase generates TypeScript types from the
  enum, eliminating typos like `'team-lead'` vs `'team_lead'`.
- RLS policies referencing the enum are checked at policy-creation time
  for typos — text comparison policies are not.

**Alternatives considered**:
- `text CHECK (role IN (...))` — rejected; check constraint is enforced
  but doesn't give type-level safety in generated client types.
- Lookup table `public.roles` — rejected as over-engineered for a fixed
  3-value set; would also complicate every RLS policy with a join.

## R-7. Middleware route gating

**Decision**: Implement gating in `apps/web/middleware.ts` using
`@supabase/ssr`'s middleware client to refresh the session cookie and
read the user's role from `public.profiles` (via an indexed lookup).
Rules:

- If unauthenticated and path matches `(authed)/` group → redirect to
  `/login`.
- If authenticated and path matches `(auth)/` group → redirect to
  `/app`.
- If authenticated but `profiles.full_name IS NULL` and path is not
  `/onboarding` → redirect to `/onboarding`.
- If authenticated, onboarded, and path is `/onboarding` → redirect
  to `/app`.

**Rationale**:
- Middleware is the right layer for redirects that depend on auth
  state — it short-circuits before the page render.
- A single DB lookup per gated request is acceptable for current scale.
  If middleware latency becomes a concern, the role can be encoded into
  the JWT custom claims (Supabase Auth Hooks) in a later feature.

**Alternatives considered**:
- Per-page server-component checks — rejected; redirects bounce after
  RSC begins streaming, which is wasteful and harder to test.
- Encoding role into JWT claims now — deferred; adds Supabase Auth
  Hooks config to feature 001 without immediate benefit.

## R-8. Form validation

**Decision**: `zod` for schemas, `react-hook-form` for state. Schemas
live in `apps/web/lib/auth/schemas.ts` and are reused on both client
and server (Route Handler) sides.

**Rationale**:
- Type inference from Zod gives a single source of truth for the
  shapes of signup, login, forgot-password, reset-password, and
  onboarding form payloads.
- `react-hook-form` with the Zod resolver minimises re-renders and
  matches the shadcn/ui form recipe out of the box.

**Alternatives considered**:
- `valibot` — rejected; smaller ecosystem and shadcn examples assume
  Zod.
- Hand-rolled validators — rejected; duplicates work and fragments
  error-message copy.

## R-9. Password policy

**Decision**: Minimum 8 characters, at least one letter and one
number. Enforced both client-side (Zod) and server-side (Supabase
Auth has its own minimum, configured via Supabase project settings).

**Rationale**:
- Aligns with Supabase's default minimum while adding a basic
  composition rule to prevent trivially weak passwords.
- Stricter rules (special characters, NIST 800-63B compliance) can be
  layered in later without breaking existing users.
- Per Principle V, the validation copy is calm: "Use at least 8
  characters with a letter and a number" — not "Weak password!" or
  warning iconography.

**Alternatives considered**:
- Length-only — rejected; allows 8-character all-letter passwords with
  no entropy floor.
- zxcvbn strength meter — rejected for feature 001; adds bundle size
  and UX surface area beyond scope. Revisit if a security review
  requests it.

## R-10. Light/dark theme handling

**Decision**: CSS variables driven by `data-theme="light|dark"` on
`<html>`. `next-themes` manages persistence and `prefers-color-scheme`
honoring. Tailwind v4's `@variant` directive selects per-theme styles.

**Rationale**:
- Both palettes are defined in the constitution. CSS variables map
  cleanly to the locked tokens.
- `next-themes` is the de-facto pattern shadcn/ui ships with; it
  respects `prefers-color-scheme` by default with `defaultTheme="system"`.

**Alternatives considered**:
- Hand-rolled `useTheme` hook — rejected; reinvents `next-themes`.
- Tailwind v3 `dark:` variant — rejected because the project is on v4.
