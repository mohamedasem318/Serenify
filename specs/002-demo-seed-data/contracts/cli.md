# CLI Contract: Demo Seed Data

**Feature**: `002-demo-seed-data`
**Phase**: 1
**Date**: 2026-05-18

This document is the authoritative contract for every command-line
surface the seed introduces. It is the source of truth that the
integration test and `smoke-tests.md` assert against.

## npm scripts (root `package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run seed` | `tsx scripts/seed-demo.ts` | Idempotent create-or-skip. (FR-008) |
| `npm run seed:reset` | `tsx scripts/seed-demo.ts --reset` | Delete-then-create across the demo cohort only. (FR-009) |
| `npm run test:seed` | `vitest run` (root config) | Offline unit tests for the hierarchy generator. |
| `npm run test:seed:integration` | `cross-env SUPABASE_INTEGRATION=1 vitest run` | Online integration test against the local Supabase. |

The four scripts live on the **root** `package.json`. They do not live on `apps/web/package.json` (FR-014).

`cross-env` is the standard cross-platform env-var setter; it goes in as a root devDependency with a caret pin (not determinism-load-bearing).

## Command-line flags (consumed by `seed-demo.ts`)

| Flag | Effect |
|------|--------|
| (no flag) | Idempotent create-or-skip path. Targets local. (Story 1, Story 2) |
| `--reset` | Delete-then-create path. Still subject to the demo email pattern filter. (Story 3) |
| `--remote` | Consent signal for the remote project. MUST be paired with `SUPABASE_PROJECT_REF`. (Story 5, FR-011) |

`--reset` and `--remote` can both be present (a maintainer resetting the deployed demo cohort behind the two-key gate). All other CLI tokens are rejected with a non-zero exit and a usage message.

## Environment variables

Read from `apps/web/.env.local` via `dotenv` at script startup. The lookup path is fixed; the seed does not search alternative locations.

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Always | Address of the Supabase project. For LOCAL runs MUST start with `http://127.0.0.1` or `http://localhost`. For REMOTE runs MUST start with `https://`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Always | Used for the SC-008 sign-in probe in the integration test only. The seed itself never makes anon-client calls. |
| `SUPABASE_SERVICE_ROLE_KEY` | Always | Service-role key used by the admin API. Never logged. Never echoed. |
| `SUPABASE_PROJECT_REF` | Only with `--remote` | Project ref of the deployed Supabase project (the `xxxxxxxxxxxxxxxx` portion of the `*.supabase.co` URL). Without `--remote`, this variable is silently ignored. |

Any other process-level env vars are ignored.

## Two-key remote consent gate (FR-011, FR-012, SC-007)

State machine, evaluated in order at script start:

| `--remote` | `SUPABASE_PROJECT_REF` set? | Behavior |
|-------------|-----------------------------|----------|
| ✗ | ✗ | Targets LOCAL. Prints `Targeting LOCAL Supabase`. Proceeds without prompting. |
| ✗ | ✓ | Targets LOCAL. The env var is silently ignored — the flag is the consent signal. (FR-011) |
| ✓ | ✗ | Exits non-zero **before any network call** with: `--remote requires SUPABASE_PROJECT_REF to be set. Refusing to run.` |
| ✓ | ✓ | Targets REMOTE. Prints `Targeting REMOTE Supabase (project ref: <ref>)`. Prompts `Proceed? (y/N) `. Continues ONLY on a single `y` keystroke (case-insensitive). Any other input (including empty line) exits non-zero with `Aborted by user.` (FR-012) |

The prompt reads from `process.stdin` directly (not from argv); it is a real interactive prompt, not a `--yes` flag. The integration test does not exercise the prompt branch.

## Exit codes

| Code | Condition |
|------|-----------|
| 0 | Successful seed, successful reset+seed, or successful idempotent no-op. |
| 1 | `--remote` without `SUPABASE_PROJECT_REF`. |
| 2 | Required env var missing from `apps/web/.env.local` (`NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`). Message names the missing variable. |
| 3 | `NODE_ENV === "production"` at script start (defense-in-depth; the seed is never legitimately run in production). |
| 4 | User declined the `Proceed? (y/N)` prompt for the remote path. |
| 5 | Supabase admin API call failed (network error, 4xx, 5xx). Error is forwarded to stderr; no partial-write recovery is attempted (interrupted-run recovery is via `npm run seed:reset`, per the spec's Edge Cases). |
| 6 | Unrecognized CLI flag. |

## Banner formats

### Environment banner (printed at the start of every run, FR-013)

```
Targeting LOCAL Supabase (http://127.0.0.1:54321)
```

or:

```
Targeting REMOTE Supabase (project ref: abcdefghijklmnop)
Proceed? (y/N)
```

### Summary table (printed before the password banner on success)

```
┌──────┬───────────────────────┬──────────────────────────────────────────┬────────────┬───────────────────────┐
│ Slot │ Full name             │ Email                                    │ Role       │ Manager               │
├──────┼───────────────────────┼──────────────────────────────────────────┼────────────┼───────────────────────┤
│  01  │ Alice Cooper          │ alice.cooper.01@demo.serenify.local      │ admin      │ —                     │
│  02  │ Brian Davis           │ brian.davis.02@demo.serenify.local       │ admin      │ —                     │
│  03  │ Carol Evans           │ carol.evans.03@demo.serenify.local       │ employee   │ Alice Cooper          │
...
│  30  │ Zoe Young             │ zoe.young.30@demo.serenify.local         │ employee   │ Jamie Lee             │
└──────┴───────────────────────┴──────────────────────────────────────────┴────────────┴───────────────────────┘
```

The "Manager" column shows the manager's `full_name`, not the UUID. For the two admins it shows `—`.

The names above are placeholders. The actual content is whatever `buildHierarchy(1729)` produces; the integration test pins the actual list.

### Password banner (printed last, on success only, FR-005)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Shared password for all 30 demo users:  DemoUser123!          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

The banner uses no color codes (terminal might pipe to a log file; ANSI sequences are not parsed by all readers). The framing characters are CP437 box drawing, valid in Windows Terminal, iTerm2, and modern Linux terminals; if a future CI environment renders them as `?`, the visual is degraded but the value of the password is still readable.

### What banners NEVER contain (Principle IX)

- The service-role key.
- The anon key.
- The Supabase project URL beyond what is shown in the environment banner (e.g., the summary table does not append URLs to each row).
- Any UUID from `auth.users` or `profiles`. (UUIDs are useless for human triage and they confuse the table layout.)

## Idempotent path (`npm run seed`)

Step-by-step (FR-008):

1. Print environment banner.
2. Load `.env.local`; refuse if required vars are missing.
3. (`--remote` only) prompt and confirm.
4. `admin.auth.admin.listUsers({ page, perPage: 200 })` — paginate to capture all.
5. Filter by `email.endsWith("@demo.serenify.local")`.
6. If 30 demo users exist, print "Demo cohort already present. No changes made." and exit 0.
7. If 0 demo users exist, run the create path.
8. If between 1 and 29 demo users exist (partial state from an interrupted prior run), print a single-line warning naming the count, suggest `npm run seed:reset`, and exit 5. The seed does NOT attempt reconciliation. (Spec Edge Cases.)

## Reset path (`npm run seed:reset`)

Step-by-step (FR-009):

1. Print environment banner.
2. Load `.env.local`; refuse if required vars are missing.
3. (`--remote` only) prompt and confirm.
4. Paginate `admin.auth.admin.listUsers`, filter by demo suffix, call `admin.auth.admin.deleteUser(id)` for each. The FK CASCADE wipes corresponding `profiles` rows.
5. Run the create path (identical to step 7 above).

## Create path

Step-by-step (FR-001, FR-004, FR-005, FR-018):

1. Generate the 30-slot hierarchy via `buildHierarchy(1729)`.
2. For each slot in order 0..29:
   - `admin.auth.admin.createUser({ email, password: "DemoUser123!", email_confirm: true, user_metadata: { full_name } })`
   - Record the returned `id` keyed by slot.
3. Once all 30 ids are known, build a single bulk UPDATE on `public.profiles`:
   - `role` and `manager_id` per slot (managers resolved from the slot → uuid map).
   - `full_name` is also set in the same UPDATE for safety, in case the trigger raced with the `user_metadata` write.
4. Print the summary table.
5. Print the password banner.
6. Exit 0.

The 30 createUser calls are sequential (not parallelized). The `auth.admin.createUser` admin API is not subject to the public sign-in/sign-up rate limit per spec Assumptions, but sequential calls give clean error messages if any one fails. If a 429 IS observed during implementation, the implementer adds retry-with-jittered-backoff at this exact location, per spec Assumptions.
