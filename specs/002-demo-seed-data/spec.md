# Feature Specification: Demo Seed Data

**Feature Branch**: `002-demo-seed-data`

**Created**: 2026-05-18

**Status**: Draft

**Input**: User description: Build a deterministic, idempotent seed script
that populates the local (and optionally deployed) Supabase project with
30 realistic demo users — 2 admins, 5 team leads, 23 employees — wired into
a manager hierarchy with at least one skip-level case. The seed exists so
dashboards and manual testing in features 003, 010, 011, and 012 do not
have to operate against an empty database. No new schema, no signal-event
seeding, no Playwright fixture changes, no avatar uploads.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-run seed populates a fresh local project (Priority: P1)

A developer who has just provisioned a local Supabase project (per the
feature-001 quickstart) runs `npm run seed`. The script creates 30 demo
users with realistic full names, a known role distribution, and a manager
hierarchy. The shared password is printed in a banner so the developer
can immediately sign in as any of them.

**Why this priority**: Every other manual-test and demo activity in
features 003, 010, and 011 assumes populated data. Without this seed,
opening the team-lead dashboard against an empty database produces an
empty UI that is indistinguishable from a bug.

**Independent Test**: From a fresh local Supabase project containing only
the bootstrap admin from feature 001, run `npm run seed`. Verify that
Supabase Studio's auth and `public.profiles` tables now contain exactly
30 additional users matching the demo email pattern, distributed
2 admin / 5 team_lead / 23 employee, each with a non-null `manager_id`
(except top-of-chain admins) wired into a coherent hierarchy.

**Acceptance Scenarios**:

1. **Given** a local Supabase project with no demo users present, **When**
   the developer runs `npm run seed`, **Then** the script creates 30
   demo users, prints a summary table listing each user's full name,
   email, role, and manager, and prints the shared password
   `DemoUser123!` in a visible banner.
2. **Given** the seeded project, **When** the developer inspects
   `public.profiles`, **Then** exactly 2 rows have `role = 'admin'`,
   exactly 5 have `role = 'team_lead'`, and exactly 23 have
   `role = 'employee'` — all bearing emails matching
   `*@demo.serenify.local`.
3. **Given** the seeded project, **When** the developer traverses the
   manager hierarchy, **Then** every team lead has between 4 and 5 direct
   reports, at least one team lead has another team lead as their
   `manager_id`, and exactly two employees report directly to admins
   (one to each).
4. **Given** the same seed value (`1729`) on two different machines,
   **When** both developers run `npm run seed` against fresh local
   projects, **Then** both projects contain the same 30 full names paired
   with the same email addresses and the same manager-to-report links.
5. **Given** the seeded project, **When** the developer signs in to the
   web app using any demo email and the shared password, **Then**
   authentication succeeds without an activation step (the admin API
   created the users with email already confirmed).

---

### User Story 2 - Re-running the seed is a safe no-op (Priority: P1)

A developer runs `npm run seed` a second time on a project that already
has the demo users in it. The script does not create duplicates, does not
overwrite manager assignments, and does not touch the bootstrap admin or
any non-demo user.

**Why this priority**: A seed that is unsafe to re-run forces every
developer to memorize "did I already seed today" before running it. The
script is meant to be a casual, low-risk tool.

**Independent Test**: After completing User Story 1, run `npm run seed`
again with no flags. Verify the user count is unchanged, no duplicate
rows appear, and the bootstrap admin from quickstart still exists with
their original `manager_id`.

**Acceptance Scenarios**:

1. **Given** a project already containing the 30 demo users, **When**
   `npm run seed` runs again, **Then** the total count of demo users
   remains 30 and no row is rewritten.
2. **Given** a project that contains both demo users and a bootstrap
   admin whose email does not match the demo pattern, **When**
   `npm run seed` runs, **Then** the bootstrap admin is unaffected — no
   read, no write, no role change.
3. **Given** any non-demo Supabase auth user (e.g., a Playwright fixture
   user or a real maintainer account), **When** `npm run seed` runs,
   **Then** that user is unaffected.

---

### User Story 3 - Reset wipes only the demo cohort (Priority: P2)

A developer runs `npm run seed:reset` after manually mutating some demo
profiles during testing. The script deletes only the users matching the
demo email pattern and recreates them deterministically — same names,
same hierarchy, same shared password.

**Why this priority**: Manual UI testing inevitably leaves the demo
cohort in an unexpected state (a role flipped, a manager unset, an extra
test user). Reset returns the cohort to a known baseline without
disturbing anything else in the project.

**Independent Test**: After User Story 1, mutate a demo profile row
directly in Supabase Studio (e.g., change a team_lead's role to
employee, or null out a manager_id). Then run `npm run seed:reset`.
Confirm all 30 demo users are recreated with the original deterministic
state and that the bootstrap admin still exists.

**Acceptance Scenarios**:

1. **Given** a project with the 30 demo users in a modified state,
   **When** `npm run seed:reset` runs, **Then** the script deletes only
   users matching `*@demo.serenify.local` and recreates the same 30
   demo users with the original names, roles, and manager assignments.
2. **Given** the bootstrap admin and any non-demo users in the project,
   **When** `npm run seed:reset` runs, **Then** those users are not
   read, modified, or deleted.
3. **Given** a project with no demo users yet, **When**
   `npm run seed:reset` runs, **Then** the delete phase finds nothing to
   remove and the create phase proceeds normally — the end state matches
   User Story 1.

---

### User Story 4 - Playwright fixtures and demo users coexist (Priority: P1)

A developer who has run `npm run seed` then runs `npm run test:e2e`
from `apps/web`. The e2e setup wipes its own fixture cohort
(`@example.com` users) but leaves the demo cohort
(`@demo.serenify.local` users) untouched. After the test run completes,
the demo users are still present and the developer can immediately
continue manual testing.

**Why this priority**: Without this, the seed is destroyed by any e2e
run, violating the spec's core idempotency promise (FR-008). The seed
becomes functionally broken for anyone who also runs the e2e suite,
which is everyone on the team.

**Independent Test**: Run `npm run seed`, verify 30 demo users exist.
Run `npm run test:e2e` from `apps/web`. After the test run completes,
verify the 30 demo users still exist with their original roles and
`manager_id` wiring.

**Acceptance Scenarios**:

1. **Given** a project containing both Playwright fixture users
   (`*@example.com`) and demo users (`*@demo.serenify.local`),
   **When** Playwright global-setup runs, **Then** only `@example.com`
   users are deleted and demo users are not touched.
2. **Given** the same project, **When** the e2e suite finishes,
   **Then** sign-in as any demo user still succeeds with
   `DemoUser123!`.

---

### User Story 5 - Remote target is guarded against accidents (Priority: P2)

A maintainer who has explicitly opted in by passing `--remote` and
setting `SUPABASE_PROJECT_REF` runs the seed against the deployed
Supabase project. The script logs the target environment, prompts for
confirmation, and only proceeds on explicit `y`. Running with just one
of the two opt-ins (only the flag, or only the env var) fails fast with
a clear error and writes nothing.

**Why this priority**: An accidental
`npm run seed:reset` against the deployed project would wipe demo data
in front of stakeholders during a live review. The two-key guard makes
the destructive remote path impossible to hit by muscle memory.

**Independent Test**: With `SUPABASE_PROJECT_REF` unset, run
`npm run seed -- --remote` and confirm it exits non-zero before any
write. With the env var set but the flag omitted, run `npm run seed`
and confirm it targets local. With both opt-ins present, confirm the
script prints the target project ref and waits for a `y` keystroke
before proceeding.

**Acceptance Scenarios**:

1. **Given** a developer running `npm run seed` with no flags and no
   `SUPABASE_PROJECT_REF` set, **When** the script starts, **Then** it
   prints "Targeting LOCAL Supabase" and proceeds without prompting.
2. **Given** a maintainer running `npm run seed -- --remote` without
   `SUPABASE_PROJECT_REF`, **When** the script starts, **Then** it
   exits non-zero with a message naming the missing env var and
   performs no writes.
3. **Given** a maintainer running `npm run seed` with
   `SUPABASE_PROJECT_REF` set but no `--remote` flag, **When** the
   script starts, **Then** it targets local and the env var is ignored
   (the flag, not the env var, is the consent signal).
4. **Given** a maintainer running `npm run seed -- --remote` with
   `SUPABASE_PROJECT_REF` set, **When** the script starts, **Then** it
   prints the target project ref, prompts "Proceed? (y/N)", and only
   continues on explicit `y`.
5. **Given** the same combination as scenario 4 but the maintainer
   answers anything other than `y`, **When** the prompt is dismissed,
   **Then** the script exits without writing anything.

---

### Edge Cases

- A developer runs `npm run seed` but `.env.local` is missing the
  service-role key — the script exits with a message naming the missing
  variable, before any network call.
- A developer runs the seed against a local Supabase that is not
  running — the first auth admin call surfaces a connection error and
  the script exits without partial writes.
- If the script is interrupted mid-run (e.g. Ctrl-C between auth user
  creation and profile updates), the cohort may be left in a partial
  state: some users with complete profile rows, others with auth rows
  only. The supported recovery is `npm run seed:reset` — the same
  path as the drift case below. The skip-if-exists logic in
  `npm run seed` only checks auth user existence and will not heal
  incomplete profiles from a prior interrupted run.
- A non-demo user happens to share a full name with a generated demo
  user — this is harmless because uniqueness is established by the
  email pattern, not by name.
- If `public.profiles` and `auth.users` ever drift out of sync (e.g. a
  maintainer manually deletes one row but not the other via Supabase
  Studio), `npm run seed:reset` is the supported recovery path. The
  seed does not attempt reconciliation logic for an unsupported drift
  state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The seed script MUST create exactly 30 demo users on a
  fresh project — 2 with role `admin`, 5 with role `team_lead`, and
  23 with role `employee`.
- **FR-002**: Every demo user's email MUST match the pattern
  `*@demo.serenify.local`. This pattern is the sole boundary the
  script uses to distinguish demo users from any other user in the
  project.
- **FR-003**: The script MUST NEVER read, modify, or delete any user
  whose email does not match the demo pattern, including the bootstrap
  admin from the feature-001 quickstart and any Playwright fixture
  users.
- **FR-004**: Every demo user MUST be created with `email_confirm: true`
  via the Supabase admin API so the user can sign in immediately
  without an activation step.
- **FR-005**: All demo users MUST share the password `DemoUser123!`.
  The script MUST print this password in a visible banner at the end
  of a successful run.
- **FR-006**: The manager hierarchy MUST satisfy all of:
  (a) Each team lead has between 4 and 5 direct reports. Direct
  reports are demo users whose `manager_id` equals the team lead's
  `id`.
  (b) At least one team lead reports to another team lead (creating a
  three-level chain Employee → TeamLead → TeamLead → Admin so the
  product's skip-level views can be exercised by features 010, 011,
  and 012).
  (c) Exactly two employees report directly to an admin (one to each
  admin), so both admins have at least one direct report and the
  employee-to-admin edge case is covered.
  (d) Every demo user except the two admins has a non-null
  `manager_id`.
  (e) The two admins have no `manager_id` (they are the roots of the
  hierarchy).
- **FR-007**: The script MUST be deterministic. Given the same fixed
  faker seed (`1729`), repeated runs against fresh projects MUST
  produce the same 30 full names, the same email addresses, and the
  same manager-to-report links.
- **FR-008**: `npm run seed` MUST be idempotent — running it on a
  project that already contains the 30 demo users MUST result in zero
  creates, zero updates, and zero deletes. Existence is detected by
  listing users via the Supabase admin API and filtering on the demo
  email pattern.
- **FR-009**: `npm run seed:reset` MUST delete every user matching the
  demo email pattern, then recreate the cohort as if from a fresh
  project. Reset MUST NOT touch any user outside the demo pattern.
- **FR-010**: The script MUST default to the local Supabase project,
  reading URL and keys from `.env.local`. The local target MUST be the
  ONLY target reachable without explicit opt-in.
- **FR-011**: When the `--remote` CLI flag is present, the
  `SUPABASE_PROJECT_REF` environment variable MUST also be present. If
  `--remote` is present without `SUPABASE_PROJECT_REF`, the script MUST
  exit non-zero with a message naming the missing variable, before any
  write. `SUPABASE_PROJECT_REF` without `--remote` MUST be silently
  ignored — the flag, not the env var, is the consent signal. The
  default behavior (neither set) targets local.
- **FR-012**: When `--remote` and `SUPABASE_PROJECT_REF` are both
  present, the script MUST print the target project ref and require an
  explicit `y` keystroke at an interactive prompt before performing any
  write.
- **FR-013**: The script MUST print which environment it is operating
  against (LOCAL or REMOTE with the project ref) at the start of every
  run, regardless of opt-in state.
- **FR-014**: The script MUST be located at `scripts/seed-demo.ts` at
  the repository root, with `npm run seed` and `npm run seed:reset`
  defined on the root `package.json`. It MUST NOT live under
  `apps/web/` and MUST NOT live under `supabase/seeds/`.
- **FR-015**: The script MUST NOT introduce any schema migration. The
  `public.profiles` table is consumed as defined by feature 001 — `id`
  (FK to `auth.users.id`), `full_name`, `role`, `manager_id`,
  `created_at`, `updated_at`. Email lives only on `auth.users`, not on
  `profiles`. No new column is introduced by this feature.
- **FR-016**: The script MUST NOT seed any signal-event data. The
  signal-event tables do not exist until feature 006; this seed will
  be extended at that point.
- **FR-017**: The script MUST NOT create, modify, or delete any
  Playwright fixture user. The demo email pattern and the Playwright
  fixture email pattern MUST remain disjoint and have separate
  lifecycles.
- **FR-018**: Role and manager assignments MUST be applied by writing
  directly to `public.profiles` using the service-role client. The
  SECURITY DEFINER RPCs `admin_update_role` and `admin_update_manager`
  (per DECISIONS 2026-05-17) MUST NOT be called from this script
  because they re-verify `is_admin()` via `auth.uid()`, which is NULL
  under a service-role context — invoking them from the seed would
  fail. The service-role client bypasses RLS, which is semantically
  equivalent for this privileged write path.
- **FR-019**: Playwright global-setup MUST filter user deletion by the
  `@example.com` email pattern. The wholesale truncation of
  `auth.users` in `apps/web/tests/e2e/setup/global-setup.ts` (lines
  30-45 as of feature 001) MUST be replaced with a pattern-scoped
  deletion so demo users created by `npm run seed` survive an e2e
  run. This change is part of this feature's scope.
- **FR-020**: The `@faker-js/faker` dependency MUST be pinned to an
  exact version in the root `package.json` (no caret, no tilde). A
  minor-version bump that changes faker's name-generation algorithm
  would silently break the determinism guarantee (FR-007) across
  machines and CI. The exact version is to be selected during
  `/speckit.plan`.

### Key Entities

- **Demo User**: A Supabase Auth user paired one-to-one with a
  `public.profiles` row. Identified by an email matching
  `*@demo.serenify.local`. Carries a deterministic full name, a role
  drawn from `{admin, team_lead, employee}`, and a `manager_id`
  pointing into the demo cohort.
- **Manager Hierarchy**: The transitive graph formed by all demo
  users' `manager_id` references. Wired so that exactly two roots
  (the two admins) anchor chains containing 5 team leads and 23
  employees, with at least one team-lead-to-team-lead link and
  exactly two employee-to-admin links (one to each admin).
- **Demo Email Pattern**: The string suffix `@demo.serenify.local`.
  This is the boundary that separates the demo cohort from every
  other user in the project. The script never reasons about identity
  in any other way.

## Out of Scope *(explicit exclusions)*

The following items are explicitly excluded from this feature:

- New schema migrations. `profiles` keeps the columns feature 001
  shipped. No `department`, `job_title`, `avatar_url`, or similar
  fields are added.
- Signal-event seeding. The signal-event tables ship with feature 006
  (stress-inference-service). Seeding against an unfinished schema
  would force rework. Signal-event seeding will be added as an
  extension to `scripts/seed-demo.ts` immediately before or during
  feature 011 (team-lead-dashboard), which is the first consumer that
  visually needs populated data.
- Avatar uploads to Supabase Storage.
- Per-user calibration baselines (feature 005).
- Privacy-slider state per demo user (feature 010).
- Questionnaire history per demo user (feature 008).
- Changes to Playwright fixture EMAIL patterns or user counts. Only
  the deletion filter in Playwright global-setup is adjusted (see
  FR-019); the fixture roster itself — the persistent
  `test-admin@example.com` user and the per-test ephemeral
  `<role>-<stamp>@example.com` users created by individual specs —
  stays as feature 001 left it.
- Production-style emails to demo accounts. Demo users use the
  `.local` TLD precisely to prevent real mail delivery.
- Self-serve role management via this script. The seed is a privileged
  fixture tool, not a feature surface; ad-hoc role flipping is
  performed manually by maintainers (as in feature 001).
- Seeding against a deployed Supabase project without the two-key
  opt-in (`--remote` flag plus `SUPABASE_PROJECT_REF`). The default
  surface area of `npm run seed` is local-only by design.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can run `npm run seed` against a fresh local
  Supabase project and reach a fully populated demo cohort in under
  60 seconds end-to-end (excluding the time to download dependencies).
- **SC-002**: After a successful seed, the count of users matching
  `*@demo.serenify.local` equals 30, with role distribution exactly
  2 admin / 5 team_lead / 23 employee, in 100% of runs.
- **SC-003**: The manager-hierarchy invariants from FR-006 (4–5 reports
  per team lead, at least one team-lead-to-team-lead link, exactly two
  employee-to-admin links with one to each admin, both admins with no
  `manager_id`) hold in 100% of runs.
- **SC-004**: Re-running `npm run seed` on an already-seeded project
  produces zero creates, zero updates, and zero deletes — verified by
  diffing the `auth.users` and `public.profiles` row sets before and
  after.
- **SC-005**: `npm run seed:reset` followed by `npm run seed` produces
  byte-identical `full_name` and email values across the cohort, in
  100% of runs. The hierarchy structure (the name-to-manager-name
  mapping) is also byte-identical, though the underlying `id` and
  `manager_id` UUID values will differ between resets (new
  `auth.users` rows imply new UUIDs). This is the determinism
  guarantee.
- **SC-006**: Across all paths through the script — first-run, no-op
  re-run, reset, and local-vs-remote target selection — zero
  non-demo-pattern users are ever read, modified, or deleted.
- **SC-007**: Attempting to target the deployed Supabase project by
  passing `--remote` without `SUPABASE_PROJECT_REF` fails before any
  network write, in 100% of attempts. Passing `--remote` with
  `SUPABASE_PROJECT_REF` surfaces an interactive confirmation that
  requires an explicit `y` to proceed. Passing `SUPABASE_PROJECT_REF`
  alone (without `--remote`) silently targets local in 100% of
  attempts.
- **SC-008**: Signing in to the running web app as any demo user with
  the password `DemoUser123!` succeeds on the first attempt 100% of
  the time (the admin-API pre-confirmation guarantee).

## Assumptions

- A local Supabase project is already provisioned per the feature-001
  quickstart, and `.env.local` already contains a working
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY`. The seed reads these values; it does
  not provision the project.
- The `public.profiles` schema is exactly as feature 001 left it.
  Future schema changes to `profiles` will require a corresponding
  update to this script.
- The bootstrap admin created per the feature-001 quickstart does NOT
  use the `@demo.serenify.local` email pattern. (Per quickstart guidance,
  the bootstrap admin uses a real maintainer email; the demo pattern is
  reserved for this seed exclusively.)
- The shared password `DemoUser123!` is acceptable for demo users
  because demo users only exist in local and the explicitly-targeted
  deployed Supabase project — both of which are non-production
  environments per the project's research-only scope (Principle X).
- The dependency budget for this feature is two added packages on the
  root `package.json`: `@supabase/supabase-js` for the admin API and
  `@faker-js/faker` for deterministic name generation. Both are dev
  dependencies — the seed never runs in the browser or in a deployed
  Next.js runtime.
- Determinism is established by the faker seed (`1729`) combined with
  a fixed iteration order over the 30 user slots. Re-seeding requires
  no external state.
- The Supabase admin API (`auth.admin.createUser`) is not subject to
  the public `sign_in_sign_ups` rate limit (30 per 5 minutes, per
  `supabase/config.toml` line 210). Local re-runs of
  `npm run seed:reset` in rapid succession are expected to succeed
  without 429 errors. If a 429 is nonetheless observed during
  implementation, the plan must add retry/backoff handling rather
  than relaxing this assumption silently.
