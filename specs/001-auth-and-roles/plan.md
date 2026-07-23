# Implementation Plan: Authentication and Role-Based Access

**Branch**: `001-auth-and-roles` | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-auth-and-roles/spec.md`

## Summary

This feature builds the authentication and authorisation foundation for
Serenify: Supabase-backed email-and-password auth, a `public.profiles`
table linked 1:1 with `auth.users`, three roles encoded as a Postgres
enum (`employee`, `team_lead`, `admin`), and a direct-manager hierarchy
stored as a self-referential `manager_id` on `profiles`. Self-signup is
limited to the `employee` role; `team_lead` and `admin` accounts are
created exclusively via the Supabase admin API by an existing admin.
Authentication state is propagated to Next.js via `@supabase/ssr`
cookies; route gating happens in middleware; row-level security on
`profiles` (and every future signal table) is the second-line defense.

Frontend surfaces in scope: `/login`, `/signup`, `/forgot-password`,
`/reset-password`, `/auth/callback`, `/onboarding` (captures `full_name`
only), and middleware that bounces unauthenticated requests to `/login`
and authenticated requests off `/login` and `/signup`. No dashboards.

## Technical Context

**Language/Version**: TypeScript 5.x, strict mode (Next.js 15 App Router on Node 20). No backend Python code in this feature.

**Primary Dependencies**:
- Next.js 15 (App Router) on Vercel
- `@supabase/ssr` (cookie-based SSR session handling; supersedes the deprecated `@supabase/auth-helpers-nextjs`)
- `@supabase/supabase-js`
- shadcn/ui components, Tailwind v4, Lucide icons
- `zod` for form validation
- `react-hook-form` for form state

**Storage**: Supabase Postgres in the Frankfurt (`eu-central-1`) region. `auth.users` (managed by Supabase Auth) plus a new `public.profiles` table.

**Testing**: Vitest for unit-testable logic (Zod schemas, helper functions, RLS-policy guard utilities). Playwright for end-to-end happy paths (one per role; `employee` via real self-signup with confirmation token bypass, `team_lead` and `admin` via programmatically-seeded users using the Supabase admin API). Constitution Principle VII's pytest requirement is N/A here — no Python is touched in feature 001.

**Target Platform**: Web (Vercel-hosted Next.js). Browsers: evergreen Chromium / Firefox / Safari; mobile viewport floor 360px.

**Project Type**: Web application (frontend only at this stage; FastAPI backend arrives in feature 005).

**Performance Goals**: No specific latency budget for this feature. Auth pages should achieve LCP ≤ 2.5s on a mid-tier mobile device on 4G (web-vitals baseline).

**Constraints**:
- 360px minimum viewport (Constitution Principle VI).
- Both light and dark mode equal-priority (Principle VI).
- No red anywhere in the UI; calm copy (Principle V).
- No secrets in repo; Supabase URL and anon key live in `.env.local` and Vercel env vars (Principle IX).
- RLS enabled on every table; no service-role key in browser bundles (Principle IX + I).

**Scale/Scope**: Single tenant. Demo seed will be ≤ 30 users. Designed to remain correct up to a few hundred profiles without manager-hierarchy query optimisation.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature touches Principles **I, V, VI, VII, VIII, IX**. Principles
II (ML evaluation), III (modality isolation), IV (LLM abstraction), and
X (dataset stewardship) are not engaged. Mapping:

| Principle | Status | How this plan honours it |
|-----------|--------|---------------------------|
| I. Privacy by Architecture (NON-NEG) | ✅ | RLS is the architectural choke-point. `profiles` RLS denies cross-user reads; admins SELECT all but the role/manager_id update path is restricted to admins. No raw signal data exists yet, but the manager-hierarchy is shaped so future signal tables can reuse the same `is_direct_report_of(uid)` SQL predicate and the same skip-level-aggregate-only rule. Plan §"RLS Sketch" calls this forward-looking constraint out explicitly. |
| V. Calm-First Design Language | ✅ | All auth pages use the locked palette and shadcn/ui primitives. Error states use the amber accent — never red. Lucide icons only. Inter for body, Instrument Serif reserved for one display element on the unauthenticated landing/login hero (optional). Copy review is part of Mohamed's smoke-test sign-off. |
| VI. Responsive & Accessible | ✅ | All five auth pages and onboarding render correctly at 360px. Touch targets ≥ 44×44px. `prefers-color-scheme` and `prefers-reduced-motion` are respected; the dark palette is wired from day one. |
| VII. Mandatory Testing Per PR | ✅ (with caveat) | Vitest unit tests for Zod schemas and the middleware role-gate helper. Playwright happy-path per role (employee via signup; team_lead and admin via seeded Supabase admin API). pytest is N/A — no Python in this feature. Smoke-tests.md is already drafted in this folder. |
| VIII. Spec-Driven Workflow | ✅ | `spec.md` was amended on 2026-05-17 to replace team affiliation with the direct-manager hierarchy and reduce onboarding to `full_name` only. The amendment is logged in `docs/CHANGELOG.md`. Plan and spec are now in agreement. |
| IX. Secrets Discipline (NON-NEG) | ✅ | `.env.local` is gitignored at repo init; `SUPABASE_SERVICE_ROLE_KEY` lives only in server-side code (admin invite route handler) and is never imported into client components. Vercel env vars hold production secrets. `<local secrets file>` is not referenced from any committed file. |

**Gate result**: PASS. The earlier draft of this plan diverged from
`spec.md` on the team-affiliation model; both `spec.md` and
`docs/CHANGELOG.md` were updated on 2026-05-17 so plan and spec now
agree.

## Skip-Level Privacy Forward Note *(Principle I forward-looking)*

A note carried forward for features that will add per-employee signal
data:

- A direct manager (`profiles.manager_id = me.id`) MAY read aggregate
  signal data for those direct reports.
- A skip-level manager — i.e., the manager of a manager — MUST receive
  only org-aggregated views, never per-employee data, even though the
  recursive CTE can compute the transitive report set.
- The transitive report set exists in this feature for two purposes
  only: (a) admin-side org charts (b) future skip-level *aggregates*.
  Per-employee skip-level access MUST be denied by RLS at the signal
  table level, not merely by UI omission.

RLS policy sketches for `profiles` in `data-model.md` already lock down
the direct-manager-only case. The skip-level-aggregate-only constraint
will be re-stated in the RLS policies of signal tables when features 005,
010, 011 land.

## Project Structure

### Documentation (this feature)

```text
specs/001-auth-and-roles/
├── plan.md              # this file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (schema + RLS as SQL)
├── quickstart.md        # Phase 1 output (local dev setup)
├── contracts/           # Phase 1 output (route + migration contracts)
│   ├── routes.md
│   └── migrations.md
├── checklists/
│   └── requirements.md  # pre-existing spec-quality checklist
├── smoke-tests.md       # pre-existing, human-validated
├── spec.md              # pre-existing
└── tasks.md             # written by /speckit.tasks (NOT yet)
```

### Source Code (repository root)

Constitution targets a workspace layout with `apps/web/`, `apps/api/`,
`packages/*`. Feature 001 introduces only `apps/web/` plus a Supabase
migration directory. `apps/api/` and `packages/*` are deferred to later
features.

```text
serenify/
├── apps/
│   └── web/                              # Next.js 15 App Router
│       ├── app/
│       │   ├── (auth)/                   # route group for unauth pages
│       │   │   ├── login/page.tsx
│       │   │   ├── signup/page.tsx
│       │   │   ├── forgot-password/page.tsx
│       │   │   ├── reset-password/page.tsx
│       │   │   └── layout.tsx            # centred auth shell
│       │   ├── (authed)/                 # route group for authed pages
│       │   │   ├── onboarding/page.tsx
│       │   │   ├── app/page.tsx          # placeholder authed landing
│       │   │   └── layout.tsx            # authed shell
│       │   ├── auth/
│       │   │   └── callback/route.ts     # Supabase email confirm handler
│       │   ├── api/
│       │   │   └── admin/
│       │   │       └── invite/route.ts   # admin-only Supabase admin API
│       │   ├── layout.tsx                # root layout, theme provider
│       │   └── globals.css               # Tailwind v4 + design tokens
│       ├── components/
│       │   ├── ui/                       # shadcn primitives
│       │   └── auth/                     # auth-feature components
│       ├── lib/
│       │   ├── supabase/
│       │   │   ├── client.ts             # browser client
│       │   │   ├── server.ts             # RSC + route handler client
│       │   │   └── admin.ts              # service-role client (server-only)
│       │   ├── auth/
│       │   │   ├── schemas.ts            # Zod schemas
│       │   │   └── role-gate.ts          # role-check helper
│       │   └── utils.ts
│       ├── middleware.ts                 # session refresh + route gate
│       ├── tests/
│       │   ├── unit/                     # Vitest
│       │   └── e2e/                      # Playwright
│       │       ├── setup/
│       │       │   └── admin-client.ts   # service-role client, test-only
│       │       ├── employee-signup.spec.ts
│       │       ├── team-lead-seeded.spec.ts
│       │       └── admin-seeded.spec.ts
│       ├── playwright.config.ts
│       ├── vitest.config.ts
│       ├── tsconfig.json                 # strict
│       ├── next.config.ts
│       ├── package.json
│       └── .env.local.example
└── supabase/
    ├── migrations/
    │   ├── 20260517000000_create_role_enum.sql
    │   ├── 20260517000010_create_profiles.sql
    │   ├── 20260517000020_profiles_rls.sql
    │   └── 20260517000030_profile_trigger.sql
    └── config.toml
```

**Structure Decision**: Web-app variant of the constitution's monorepo
target. Only `apps/web/` is created in feature 001. `apps/api/` and
`packages/*` are intentionally deferred — adding them now would create
empty scaffolding with no tests, which Principle VII would flag.

A new `supabase/` directory at repo root holds migrations and local CLI
config. This is the canonical location used by `supabase/cli`. It is
*outside* `apps/web/` because future apps (FastAPI in feature 005) also
need the schema. This decision is noted here; a one-line decision entry
will be added to `docs/DECISIONS.md` during `/speckit.implement`.

**Tailwind v4 note**: `tailwind.config.ts` is intentionally omitted
from the tree. Tailwind v4 is configuration-as-CSS — design tokens
(the locked Mist & Meadow palette, radii, spacing) live in
`apps/web/app/globals.css` inside an `@theme` block. A
`tailwind.config.ts` file is only added later if a plugin requires it.

**Route-group naming**: the authenticated group is `(authed)` rather
than `(app)` to avoid the `(app)/app/page.tsx` visual collision and to
disambiguate Next.js's `app/` directory from a route group of the same
name.

**Invited-but-never-confirmed users**: an admin invite creates an
`auth.users` row with `email_confirmed_at = NULL` until the invitee
clicks the link. The `profiles` row is created by the trigger
immediately, so an unconfirmed invite has a `profiles` row with
`role` already set (assigned by the admin invite handler, see Phase 0
R-5). No cleanup job is introduced in feature 001 for stale invites;
revisit if invite abandonment becomes operationally visible.

## Phase 0: Research Topics

The full discussion is in `research.md`. Headline decisions:

| Topic | Decision | One-line rationale |
|-------|----------|---------------------|
| SSR session library | `@supabase/ssr` | The `auth-helpers-nextjs` package is deprecated; `@supabase/ssr` is the supported successor for App Router cookie handling. |
| Transitive reports query | Recursive CTE (no materialised view) | Org size ≤ a few hundred profiles for the foreseeable future; a recursive CTE on `profiles(manager_id)` with an index is sub-millisecond and avoids refresh logic. Revisit if profile count crosses ~5000. |
| Email transport | Supabase built-in | Resend domain not yet verified; constitution's stack table explicitly allows Supabase email until then. Migrate to Resend in a later feature. |
| Email confirmation in Playwright | Bypass via Supabase admin API in seed step | Real SMTP delivery is too flaky for CI. The employee signup test exercises the full UI flow up to "check your email", then uses the service-role client (server-side only, in test setup) to confirm the user, then continues. |
| Admin invite mechanism | Two-step server-side flow: `inviteUserByEmail` then `admin_update_role` SECURITY DEFINER call | Keeps service-role key out of the browser; never trusts client-controllable `raw_user_meta_data` for the role value. See R-5. |
| Role storage | Postgres enum (`public.user_role`) | Three fixed values, never user-input. Enum gives compile-time safety with type generation and prevents typos in RLS policies. Adding a value later requires a one-line migration. |
| Privileged column updates (`role`, `manager_id`) | SECURITY DEFINER functions `admin_update_role` and `admin_update_manager`; row-owner RLS UPDATE policy refuses any change to `role` or `manager_id` via a `WITH CHECK` predicate | Postgres RLS is row-not-column. The SECURITY DEFINER path is the only legitimate way to mutate these two columns; everything else is funnelled through the row-owner policy. |

## Phase 1: Design & Contracts

The full artifacts are in:

- `data-model.md` — table schemas + the core RLS policies and
  SECURITY DEFINER privilege functions written out as SQL.
- `contracts/routes.md` — every route surface (page or API), with
  expected redirect behaviour and auth-state preconditions.
- `contracts/migrations.md` — the four migration files this feature
  introduces, in order, with the SQL preamble for each.
- `quickstart.md` — local-development setup (clone → run → seed → tests).

## Test Infrastructure

The Playwright suite needs a service-role Supabase client to (a) confirm
the employee-signup email out-of-band, (b) seed `team_lead` and `admin`
fixtures programmatically, and (c) truncate `auth.users`/`profiles`
between runs.

To keep that capability strictly outside the production bundle:

- The service-role client used by tests lives in
  `apps/web/tests/e2e/setup/admin-client.ts`. **No** application code
  imports from `tests/`. Next.js does not include files under
  `tests/` in any route, layout, or server-component graph, so the
  production build cannot reach the test admin client even
  transitively.
- The top of `admin-client.ts` carries a runtime guard:

  ```ts
  if (process.env.NODE_ENV === 'production') {
    throw new Error('admin test client must never run in production');
  }
  ```

  This is belt-and-braces: even if a future refactor imported the file
  from a non-test location, the process would crash on production
  startup rather than silently exposing the service-role key.
- `SUPABASE_SERVICE_ROLE_KEY` is read from the local `.env.local` (dev)
  or from the Playwright runner's environment in CI. It is not exposed
  to the browser; `next.config.ts` does not list it under `env`.

The production-side admin client used by `POST /api/admin/invite` lives
separately at `apps/web/lib/supabase/admin.ts` and is intentionally
server-only (a Server Action / Route Handler boundary, never imported
from a client component).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| `supabase/` directory at repo root (outside `apps/web/`) | The schema is shared between Next.js (now) and FastAPI (feature 005). Co-locating migrations with `apps/web/` would force feature 005 to either move them or reach across the workspace. | Putting migrations under `apps/web/supabase/` makes them feel app-owned; in practice the database is a peer service. The root location matches the Supabase CLI default and matches the long-term polyrepo-style ownership. |
| Two SECURITY DEFINER functions (`admin_update_role`, `admin_update_manager`) bypass RLS instead of a column-only UPDATE policy | Postgres RLS is row-not-column; there is no first-class way to allow an admin to UPDATE only `role`/`manager_id` while denying changes from non-admins on those same columns. SECURITY DEFINER functions are the standard escape valve and keep all privilege escalation auditable in two named SQL definitions. | A blanket admin UPDATE policy on `profiles` would also allow admins to overwrite `full_name` on any row, which is not currently a needed capability and widens the blast radius of an admin-account compromise. |
