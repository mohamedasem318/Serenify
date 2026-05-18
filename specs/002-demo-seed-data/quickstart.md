# Quickstart: Demo Seed Data (Local Dev)

**Feature**: `002-demo-seed-data`
**Phase**: 1
**Date**: 2026-05-18

This document tells a developer how to bring up the demo cohort
locally after they have already completed feature 001's quickstart. It
is the target state after `/speckit.implement` completes.

## Prerequisites

Inherited from feature 001's quickstart — all are assumed already done:

- Node.js 20.x, npm 10.x.
- A working `supabase start` against Docker, with feature 001's migrations applied via `supabase db reset`.
- `apps/web/.env.local` populated with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- The bootstrap admin exists (its email is a real maintainer address — NOT `*@demo.serenify.local`).

If any of the above is missing, follow `specs/001-auth-and-roles/quickstart.md` first.

## 1. Install the new dependencies

From the repo root:

```bash
npm install
```

This picks up the five new dev dependencies on the root `package.json`:
`@faker-js/faker` (`9.2.0`, exact), `@supabase/supabase-js`, `tsx` (`4.19.2`, exact), `dotenv`, `vitest`, and `cross-env`.

## 2. Seed the demo cohort

```bash
npm run seed
```

Expected output on a fresh local Supabase (with only the bootstrap admin
present):

```
Targeting LOCAL Supabase (http://127.0.0.1:54321)
Creating 30 demo users…
┌──────┬───────────────────────┬──────────────────────────────────────────┬────────────┬───────────────────────┐
│ Slot │ Full name             │ Email                                    │ Role       │ Manager               │
…
└──────┴───────────────────────┴──────────────────────────────────────────┴────────────┴───────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│   Shared password for all 30 demo users:  DemoUser123!          │
└─────────────────────────────────────────────────────────────────┘
```

If the cohort is already present:

```
Targeting LOCAL Supabase (http://127.0.0.1:54321)
Demo cohort already present. No changes made.
```

## 3. Sign in as a demo user

Open the dev server (`npm run dev --workspace=apps/web`), navigate to
`/login`, and sign in with:

- Email: any of the 30 from the summary table.
- Password: `DemoUser123!`

You will land directly on `/app` — the `email_confirm: true` flag means
no confirmation step is required (FR-004).

## 4. Reset (after manual mutations during testing)

If you have flipped roles, nulled out manager_ids, or otherwise mutated
demo profile rows during manual testing:

```bash
npm run seed:reset
```

This wipes only the demo cohort (`*@demo.serenify.local`) and recreates
the same 30 users with the same names, emails, roles, and manager
relationships. The bootstrap admin and any other non-demo users are
untouched.

## 5. Run the seed tests

```bash
npm run test:seed                  # Vitest unit tests (offline, fast)
npm run test:seed:integration      # Vitest integration test (needs running local Supabase)
```

The unit suite asserts the five FR-006 hierarchy invariants and the
byte-identical-name pin against `buildHierarchy(1729)`. The integration
suite re-asserts the same invariants against the row sets the script
leaves in your local Supabase, plus the idempotency contract (zero diff
on a no-op re-run) and the sign-in probe (a demo user can authenticate
with the shared password).

The integration suite is destructive to the demo cohort (it calls reset
at the start of `beforeAll`). It is NOT destructive to anything outside
the demo cohort — your bootstrap admin survives unchanged.

## 6. Coexistence with Playwright e2e

After this feature ships, `npm run test:e2e --workspace=apps/web`
filters its destructive cleanup to `@example.com` users. The demo
cohort survives an e2e run untouched (FR-019, Story 4). You can keep
the demo cohort around indefinitely; it will not be wiped by routine
testing.

## 7. Remote target (maintainers only)

Seeding the deployed Supabase project is gated behind a two-key opt-in:

```bash
SUPABASE_PROJECT_REF=<your-project-ref> npm run seed -- --remote
```

The script prints the target project ref and prompts `Proceed? (y/N) `.
Press `y` to continue. Any other answer (including pressing Enter on an
empty line) exits without writing.

The flag alone, without the env var, fails fast:

```bash
$ npm run seed -- --remote
--remote requires SUPABASE_PROJECT_REF to be set. Refusing to run.
```

The env var alone, without the flag, is silently ignored — local is the
default and a stale shell export does not cause an accident.

## 8. Common gotchas

| Symptom | Cause | Fix |
|--------|------|-----|
| `Error: missing SUPABASE_SERVICE_ROLE_KEY` | `apps/web/.env.local` is missing the key (or was created from an older `.env.local.example` predating feature 001). | Copy from `apps/web/.env.local.example` and refill the value from `supabase start` output. |
| `connect ECONNREFUSED 127.0.0.1:54321` | Local Supabase is not running. | `supabase start`. |
| `Demo cohort already present. No changes made.` but the dashboard is empty | The 30 demo `auth.users` rows exist but their `profiles` rows are in a partial state from a prior interrupted run. | `npm run seed:reset` — the supported recovery path. |
| Playwright wipes the demo cohort | You are on a branch where the FR-019 fix to `global-setup.ts` has not yet landed. | Confirm the file's auth-user-deletion loop filters by `@example.com`. Re-run `npm run seed` to recreate. |
| `Refusing to run tests: NEXT_PUBLIC_SUPABASE_URL is "<remote-url>", not a local Supabase.` (from the integration test) | Your local `.env.local` is pointing at the deployed project. | Restore `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` for local dev. The integration test refuses to run against a non-localhost URL. |
