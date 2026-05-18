# Implementation Plan: Demo Seed Data

**Branch**: `002-demo-seed-data` | **Date**: 2026-05-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-demo-seed-data/spec.md`

## Summary

This feature delivers a deterministic, idempotent TypeScript seed script at
`scripts/seed-demo.ts` that populates a Supabase project (local by default,
deployed only behind a two-key opt-in) with exactly 30 demo users —
2 admin, 5 team_lead, 23 employee — wired into a fixed manager hierarchy
that satisfies the five FR-006 invariants (including a three-level
team-lead-to-team-lead chain and two distinct employee-to-admin edges).
Identity is established solely by the `@demo.serenify.local` email
suffix; no other user is read, mutated, or deleted under any path.

The script is implemented as a single CLI entrypoint runnable via
`npm run seed` (idempotent create-or-skip) and `npm run seed:reset`
(pattern-scoped delete + recreate). It uses the service-role Supabase
admin API (not the SECURITY DEFINER RPCs — those re-verify `auth.uid()`
which is NULL under service-role context, per DECISIONS 2026-05-17).

In addition to the new script, this feature retrofits the Playwright
`global-setup.ts` from feature 001 so its destructive cleanup is
pattern-scoped to `@example.com` and therefore cannot wipe the demo
cohort during an e2e run (FR-019). That retrofit is in scope.

## Technical Context

**Language/Version**: TypeScript 5.x (matches `apps/web`'s `^5` pin), executed directly via `tsx` on Node 20. No compile step; no emitted JS in the repo.

**Primary Dependencies** (all dev-only, added to the root `package.json`):

- `@supabase/supabase-js` — admin API for user create / list / delete and the direct profile writes.
- `@faker-js/faker` — deterministic name generation, seeded with `1729`.
- `tsx` — TypeScript runner for the script. See Phase 0 R-1.
- `dotenv` — loads `apps/web/.env.local` into `process.env` before the script touches any client. Matches the version already pinned in `apps/web`.
- `vitest` — unit + integration test framework, version-matched to `apps/web` to avoid two parallel runners in `node_modules`.

**Storage**: Reuses `auth.users` (Supabase Auth) and `public.profiles` exactly as feature 001 shipped them. **No new migrations, no new columns, no new tables, no new RLS policies** (FR-015, FR-016).

**Testing**: Vitest, with a new root-level `vitest.config.ts` covering `scripts/__tests__/`. Two suites:

- A pure unit test against the hierarchy generator (no Supabase).
- An integration test against the running local Supabase, gated by an environment guard and run with an extended per-test timeout.

  Both run under `vitest run` — no separate runner. Detail in Phase 1.

**Target Platform**: Node 20 CLI executed on the developer's workstation (or a maintainer's workstation, for the remote-opt-in path). The script never runs in the browser, in Next.js server components, in a Vercel runtime, or in CI as part of the application build — it is a fixture tool only.

**Project Type**: CLI seed script at repo root, sitting alongside the workspace apps (`apps/web/`) without being owned by any of them. The repo root holds the shared toolchain (Supabase admin API, faker), so the script lives where it can be invoked once for the whole monorepo.

**Performance Goals**: SC-001 — under 60s end-to-end on a fresh local project. With 30 sequential `auth.admin.createUser` calls at ~200-400ms each plus a single bulk profile update statement, real wall-clock will be in the 10-25s range; the 60s budget includes the worst-case admin-API tail latency observed locally.

**Constraints**:

- Service-role key must never leave the developer's machine (Principle IX). The script reads it from `apps/web/.env.local`; it is never logged, never echoed, never written to a child-process arg, never embedded in the summary table.
- Demo email pattern is the sole authority for identity (FR-002, FR-003). Every read, write, and delete is filtered through the pattern; the script may not reason about identity in any other way (e.g., by name, by created_at, by metadata).
- Determinism (FR-007): the same faker seed must produce byte-identical `full_name` and email values across machines. The exact `@faker-js/faker` version is pinned without caret/tilde (FR-020).
- The script cannot call the `admin_update_role` or `admin_update_manager` SECURITY DEFINER functions: under a service-role client, `auth.uid()` is NULL and the `is_admin()` guard inside those functions evaluates false, so the calls would fail. Role and manager assignment go via direct UPDATE on `public.profiles` using the service-role client, which bypasses RLS (FR-018).

**Scale/Scope**: Fixed at 30 demo users. No pagination concerns. The hierarchy is a fixed graph computed once per run, not a parameter the script exposes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature touches Principles **VII, VIII, IX, X**. Principles I, II, III, IV, V, VI are not engaged by this CLI fixture tool (no UI surface, no signal data, no ML, no LLM, no responsive layout).

| Principle | Status | How this plan honours it |
|-----------|--------|--------------------------|
| VII. Mandatory Testing Per PR | ✅ | A Vitest unit test asserts the hierarchy generator's pure output against the five FR-006 invariants AND the byte-identical determinism contract for seed `1729`. A Vitest integration test runs the script against a real local Supabase and asserts the same invariants on the row sets it leaves behind. Both run under `vitest run` from the root. `smoke-tests.md` will be authored during `/speckit.tasks`. No frontend or Python code is touched, so the FE and pytest gates remain N/A — but the Vitest gate is large enough to cover FR-006(a)–(e) explicitly, not as smoke checks. |
| VIII. Spec-Driven Workflow | ✅ | This plan is the second formal artifact of the feature (spec → plan → tasks → implement). Decisions are logged in `docs/DECISIONS.md` during `/speckit.implement` (entries enumerated in Phase 0 below). The feature folder will contain `spec.md`, `plan.md` (this file), `research.md`, `data-model.md` (short — no schema change), `contracts/cli.md`, `quickstart.md`, and (during `/speckit.tasks`) `tasks.md` + `smoke-tests.md`. |
| IX. Secrets Discipline (NON-NEG) | ✅ | `SUPABASE_SERVICE_ROLE_KEY` is read from `apps/web/.env.local` (already gitignored) via `dotenv`. It is held only in `process.env` inside the seed process; it is never logged, never printed in any banner or summary table, never written to a temp file, and never passed via CLI argv to a subprocess. The summary banner prints the **shared user password** `DemoUser123!` — never the service-role key. For the `--remote` path, the script prints only the project ref (a non-secret), not the service-role key. The runtime guard from feature 001's test admin client (`throw if NODE_ENV === 'production'`) is replicated in the seed entrypoint as a defense-in-depth measure. |
| X. Dataset Stewardship (NON-NEG) | ✅ | All 30 demo full names are generated by `@faker-js/faker` (synthetic). The four real teammate names (Fatma Al-Zahraa Emad, Gehad Mohamed, Hebatullah El Gazoly, Mohamed Assem) are NOT used — they are reserved for the public "About / Team" page per Principle X. The faker seed `1729` does not produce any of those four names; if a future faker upgrade ever does, the unit test will detect the change via the byte-identical determinism assertion. The 12 image-withheld StressID subject IDs are not relevant to this feature (no images, no signals). |

**Gate result**: PASS. No complexity-tracking entries needed.

## Plan-Level Decisions (resolved here, not deferred)

These four items were flagged in the spec as decisions the plan must close:

### Decision A — TypeScript runner: `tsx` 4.19.2

`tsx` runs `.ts` files directly via esbuild without an emit step, is ESM-first by default (matching Node 20 + Next.js 16's ESM posture), and requires zero config. **Trade-off**: it slightly inflates `node_modules` vs. an in-line `esbuild` step, but it removes a build artifact in the repo and a "did you re-build before re-running?" footgun, which is the more expensive failure mode for a fixture script developers run rarely.

`ts-node` was considered and rejected: getting it to handle ESM + path aliases + modern Node cleanly requires `ESM`/`CJS` loader-flag juggling that has been a recurring source of toolchain confusion in 2025–2026. A separate `esbuild` build step was also considered and rejected: it adds a `dist/` folder under `scripts/` that the team would have to remember to rebuild before each run, which is the exact ergonomic failure that "this is a casual, low-risk tool" (Story 2) is meant to avoid.

**Pin**: `"tsx": "4.19.2"` in `package.json` (exact, no caret) — the runner itself is part of the deterministic toolchain.

### Decision B — Email format: `<first>.<last>.<NN>@demo.serenify.local`

The plan **confirms** the user's recommended format with one tightening:

```
{normalize(first)}.{normalize(last)}.{NN}@demo.serenify.local
```

where:

- `normalize(s)` = `s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "")`
- `NN` = the 2-digit slot index, `01` through `30`, `String(slot + 1).padStart(2, "0")`

The trailing `.NN` makes collision impossible **by construction**, even if `@faker-js/faker` produces two identical (first, last) pairs across the 30 slots — which is unlikely but not formally guaranteed by any version of faker. This satisfies FR-007 (determinism — `NN` is purely a function of slot position) without depending on faker's name-uniqueness behavior. The local part stays human-readable (`alice.cooper.07@demo.serenify.local`) for the summary banner.

Diacritic stripping prevents non-ASCII characters in the local part. Faker's default `en` locale rarely produces them, but the `en_GB`/`en_IE` corpora occasionally do, and SMTP-style local-part rules forbid raw Unicode. NFD-decompose + diacritic-strip is the standard fix.

The `.local` TLD is RFC 6762 reserved (Multicast DNS / Bonjour) and is not deliverable on the public internet — by design, no demo account can receive mail.

### Decision C — Orphan-profile defensive sweep: **REMOVE**

Lines 49-52 of `apps/web/tests/e2e/setup/global-setup.ts` currently delete every row of `public.profiles` unconditionally (`gte("created_at", "1970-01-01")` matches everything). The comment marks it "belt-and-braces" against orphans that the FK `profiles.id REFERENCES auth.users(id) ON DELETE CASCADE` already prevents.

Under FR-019, the `auth.users` deletion above it becomes pattern-scoped to `@example.com`. The orphan sweep, however, stays unscoped — and **becomes actively destructive**: it will delete demo profile rows whose `auth.users` parents survive the pattern-scoped wipe, breaking FR-008's idempotency promise on the very first `npm run test:e2e` after a `npm run seed`.

**The sweep is removed entirely.** The FK CASCADE constraint guarantees orphan profile rows cannot exist:

- An `auth.users` delete cascades to `profiles` — no orphan.
- A direct `INSERT INTO profiles` without a matching `auth.users` row fails the FK constraint — no orphan.
- The only way to create an orphan would be to drop the FK constraint and manually delete an `auth.users` row, which is not a code path the test suite exercises.

Option (a) — leave the sweep unchanged — was rejected because, after FR-019, it actively breaks Story 4 (Playwright fixtures and demo users coexist) on the first e2e run. Option (c) — pattern-scope the sweep — was rejected because it adds a redundant safety net behind a constraint the database already enforces; it would be code written to be safe, not code written to be correct. Removing is simpler and correctly trusts the FK contract.

The accompanying comment block (lines 46-48) is removed in the same edit so the file does not retain a comment without code.

### Decision D — Test framework and location

**Hierarchy unit test** runs under Vitest. Location: `scripts/__tests__/hierarchy.test.ts`, paired with the pure module under test at `scripts/lib/hierarchy.ts`. Co-locating under `scripts/__tests__/` keeps the test next to its subject without polluting the `scripts/` directory at the entrypoint level (where the only file should be `seed-demo.ts`).

The pure module exports a `buildHierarchy(seed: number): DemoUser[]` function that returns the 30 deterministic users with their `slot`, `full_name`, `email`, `role`, and `manager_slot` (resolved to UUIDs only after auth.users rows exist). This separation is what makes the unit test possible: hierarchy generation has no dependency on Supabase or on the network, so it can be asserted in isolation.

**Integration test** also runs under Vitest, in a separate file `scripts/__tests__/seed-demo.integration.test.ts`, gated by `process.env.SUPABASE_INTEGRATION === "1"` (default off in `vitest run`; required-on in `npm run test:seed:integration`). This keeps the default `npm test` fast and offline while making the integration suite a single explicit npm command. Vitest is the right runner for both because (a) it already has the Vitest assertion API in muscle memory across the team from `apps/web`, and (b) it gives `expect`, `describe`, `beforeAll` for free — writing a hand-rolled `node --test` integration would re-implement those.

The integration test uses a per-test timeout of `60_000` ms (the SC-001 budget). It isolates itself from the developer's existing local seed state by calling the script's reset path at the start of `beforeAll` — which by FR-002/FR-003 is guaranteed to touch only `@demo.serenify.local` users. The developer's bootstrap admin, Playwright fixture users, and any other non-demo state in the local Supabase are by construction unaffected. The integration test does NOT need to (and explicitly does not) call any out-of-band cleanup like truncating `auth.users` — that would violate FR-003 and is exactly what feature 001's global-setup did wrong before FR-019.

### Pinned versions (literal strings for `package.json`)

| Package | Version pin | Why this string |
|---------|-------------|-----------------|
| `@faker-js/faker` | `"9.2.0"` (exact, no caret/tilde) | FR-020. Locking the patch level too because faker's name generators ARE part of its public corpora and have changed across patch releases. |
| `tsx` | `"4.19.2"` (exact) | Decision A. The runner is part of the deterministic toolchain — a major bump can change how the script resolves ESM paths. |
| `@supabase/supabase-js` | `"^2.105.4"` (matches `apps/web`) | Caret is OK here because supabase-js does not generate names or any other determinism-load-bearing output; only its admin-API surface matters, and that surface is stable across minor versions. Matching `apps/web`'s pin lets npm hoist a single copy. |
| `dotenv` | `"^17.4.2"` (matches `apps/web`) | Same hoisting argument. Not determinism-load-bearing. |
| `vitest` | `"^4.1.6"` (matches `apps/web`) | Same hoisting argument. Matching `apps/web` prevents two parallel vitest installs in `node_modules`. |

`@faker-js/faker` 9.2.0 is the literal version this feature plans to install. If `/speckit.implement` discovers npm has yanked or never published this exact patch, the implementer MUST select the closest published 9.x patch and update this row in `package.json` AND in this plan — a silent substitution to a different patch is a plan-amendment failure (Principle VIII).

## Project Structure

### Documentation (this feature)

```text
specs/002-demo-seed-data/
├── plan.md              # this file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output — short, references feature 001's schema
├── contracts/
│   └── cli.md           # Phase 1 output — npm scripts, flags, env vars, exit codes, banner format
├── quickstart.md        # Phase 1 output — how to run the seed locally
├── spec.md              # pre-existing
├── tasks.md             # written by /speckit.tasks (NOT yet)
└── smoke-tests.md       # written during /speckit.tasks or /speckit.implement (NOT yet)
```

### Source Code (repository root)

```text
serenify/
├── scripts/
│   ├── seed-demo.ts                              # CLI entrypoint — runnable via tsx
│   ├── lib/
│   │   ├── hierarchy.ts                          # pure: buildHierarchy(seed: number) -> DemoUser[]
│   │   ├── env.ts                                # loads apps/web/.env.local + parses CLI flags
│   │   ├── supabase-admin.ts                     # service-role client factory (CLI-only)
│   │   ├── confirm.ts                            # interactive "Proceed? (y/N)" prompt for --remote
│   │   └── banner.ts                             # final summary banner + password banner formatter
│   └── __tests__/
│       ├── hierarchy.test.ts                     # Vitest unit (offline)
│       └── seed-demo.integration.test.ts         # Vitest integration (needs running local Supabase)
├── apps/
│   └── web/
│       └── tests/
│           └── e2e/
│               └── setup/
│                   └── global-setup.ts            # MODIFIED — pattern-scope to @example.com (FR-019)
├── vitest.config.ts                              # NEW — root-level Vitest config covering scripts/__tests__/
├── package.json                                  # MODIFIED — devDeps + seed/seed:reset/test:seed scripts
└── tsconfig.json                                 # NEW IF MISSING — root TS config so tsx can find types
```

**Structure Decision**: Single-file CLI entrypoint at `scripts/seed-demo.ts` with a `scripts/lib/` directory holding the pure modules. The `scripts/` directory has historically been the conventional home for repo-level tooling that is not part of any workspace app's source graph; FR-014 mandates this exact location.

The new root-level `vitest.config.ts` is independent of `apps/web/vitest.config.mts` — different `include` glob, different setup, no React plugin. Two configs is fine because vitest happily runs each on its own `npm run` invocation; trying to share a config across two ownership domains (web app vs. repo tooling) would couple them in ways the team would have to undo later.

A root `tsconfig.json` is added if missing. Its `compilerOptions.types` includes `["node"]` so `scripts/seed-demo.ts` can reference `process.env` and the Node 20 standard library without a TS error. It is NOT extended by `apps/web/tsconfig.json` — the web app's `tsconfig` has its own strict-mode settings tuned for React; merging would create a config that means subtly different things in each workspace.

## Phase 0: Research

The full discussion lives in [`research.md`](./research.md). Headline outputs:

| Topic | Decision | One-line rationale |
|-------|----------|---------------------|
| TS runner | `tsx` 4.19.2 (exact pin) | ESM-first, zero config, no separate build step; closes the "did you rebuild?" failure mode for a casual fixture script. |
| Email format | `<first>.<last>.<NN>@demo.serenify.local`, normalized + diacritic-stripped, `NN` = slot 01..30 | Decouples email uniqueness from name uniqueness; faker name collisions become harmless. |
| Orphan-profile sweep | Removed from `global-setup.ts`. | FK CASCADE already prevents orphans; the unscoped sweep would actively delete demo profile rows after FR-019. |
| Test framework | Vitest for both unit (hierarchy) and integration (against real local Supabase); single root config; integration test gated by `SUPABASE_INTEGRATION=1`. | Matches `apps/web`'s runner; gating keeps default `npm test` fast and offline. |
| Faker pin | `@faker-js/faker` `"9.2.0"` (exact, no caret/tilde) | FR-020; patch-level changes to faker can shift generated name corpora and break determinism across machines. |
| Why direct profile writes, not RPCs | `admin_update_role` and `admin_update_manager` re-verify `is_admin()` via `auth.uid()`, which is NULL under a service-role client; calls would fail. Direct UPDATE on `profiles` via service-role bypasses RLS, which is semantically equivalent for this privileged write path. (Confirms DECISIONS 2026-05-17, FR-018.) | Architectural: SECURITY DEFINER RPCs are for the admin web UI, not for the seed. |
| Two-key remote consent gate | `--remote` flag is the consent signal; `SUPABASE_PROJECT_REF` is the address. Both required; `--remote` alone fails fast before any network call; the env var alone is silently ignored (targets local). | Defense in depth against the muscle-memory `npm run seed:reset` against the deployed project. |
| Banner content | Print: target environment (LOCAL or REMOTE + project ref), summary table (slot, full_name, email, role, manager full_name), shared password `DemoUser123!`. NEVER the service-role key. | Principle IX. |
| Faker seed value | `1729` (Ramanujan's number) | Stable, memorable, already named in FR-007 / SC-005. |

## Phase 1: Design & Contracts

The full artifacts are in:

- [`data-model.md`](./data-model.md) — no schema change; documents the canonical 30-slot hierarchy table and the FK relationships consumed unchanged from feature 001.
- [`contracts/cli.md`](./contracts/cli.md) — every command-line surface (`npm run seed`, `npm run seed:reset`, `--remote`, `SUPABASE_PROJECT_REF`), exit codes, and the exact banner format.
- [`quickstart.md`](./quickstart.md) — local-development setup (assumes feature 001 quickstart is already done) → `npm install` → `npm run seed` → sign in.

## Test Strategy

This section satisfies the testing-as-a-gate scoping requirement of Principle VII: the tests below verify FR-006(a)–(e) by construction, not as smoke checks.

### Unit test — `scripts/__tests__/hierarchy.test.ts`

The pure `buildHierarchy(seed: number)` function returns the canonical 30-user shape without touching Supabase. The test asserts:

1. **Count**: exactly 30 users; exactly 2 with `role === "admin"`, exactly 5 with `role === "team_lead"`, exactly 23 with `role === "employee"`. (FR-001, FR-006(d), FR-006(e))
2. **Team-lead reports — FR-006(a)**: For each of the 5 team_lead users, the count of demo users whose `manager_slot` equals that team_lead's `slot` is between 4 and 5 inclusive.
3. **Three-level chain — FR-006(b)**: At least one team_lead has a `manager_slot` that points to another team_lead (not to an admin and not to null). Traversing from that team_lead's reports up two `manager_slot` hops MUST land on an admin (employee → team_lead → team_lead → admin).
4. **Employee-to-admin edges — FR-006(c)**: Exactly 2 employees have a `manager_slot` whose role is `admin`. The two admins each appear exactly once in this set (one to each, never both reports on one admin and zero on the other).
5. **Roots — FR-006(e)**: The 2 admins have `manager_slot === null`.
6. **Non-root closure — FR-006(d)**: Every non-admin has a non-null `manager_slot` that resolves to another slot in the same 30-user set (no dangling references).
7. **Determinism — FR-007 / SC-005**: `buildHierarchy(1729)` called twice in the same test process produces deep-equal output. The first call's output (slot → full_name + email + role + manager_slot) is also pinned against a 30-row snapshot embedded in the test file, so a `@faker-js/faker` patch-level change that quietly shifts the name corpora fails the snapshot.
8. **Email shape**: Every email matches `/^[a-z0-9]+\.[a-z0-9]+\.\d{2}@demo\.serenify\.local$/`, the `NN` portion is in `01..30`, and the 30 emails are pairwise distinct (FR-002 + the email-collision strategy from Decision B).
9. **Synthetic-only names — Principle X**: No `full_name` matches `/(fatma.+emad|gehad.+mohamed|hebatullah.+gazoly|mohamed.+assem)/i`.

These nine assertions are not smoke checks: each one binds to a specific FR-006 sub-clause or another spec-listed invariant, and together they exercise the entire FR-006 surface plus the determinism and synthetic-name guarantees.

### Integration test — `scripts/__tests__/seed-demo.integration.test.ts`

Runs against the developer's local Supabase. Gated by `SUPABASE_INTEGRATION === "1"` so `vitest run` defaults to offline-only. The npm script `test:seed:integration` sets the gate.

Setup (`beforeAll`, 60s timeout):

1. Assert `NEXT_PUBLIC_SUPABASE_URL` points at `127.0.0.1` or `localhost`. Refuse otherwise.
2. Invoke the seed entrypoint's reset path programmatically (via an exported `main({ reset: true })` rather than spawning npm — keeps the test in-process and lets the test fail loudly instead of swallowing exit codes).
3. Snapshot the bootstrap admin (if present): emails not matching the demo pattern. The post-condition asserts this set is byte-identical after the run.

Assertions:

1. After reset+seed, `auth.users` contains exactly 30 rows matching `*@demo.serenify.local`. (SC-002)
2. The `public.profiles` rows for those 30 users distribute 2/5/23 admin/team_lead/employee. (SC-002)
3. The hierarchy invariants FR-006(a)–(e) hold against the actual `profiles` rows (re-asserted with real UUIDs instead of slot indices, to confirm the script wrote the same shape the pure function produced).
4. The pre-existing non-demo users (the snapshot from `beforeAll`) are unchanged: same row count, same emails, same `manager_id` values. (FR-003, SC-006)
5. Running the entrypoint a second time without `reset` produces zero net diff against `auth.users` and `profiles` (compared row-by-row). (FR-008, SC-004)
6. Sign-in flow: using the anon client, `signInWithPassword` for the first slot's email + `DemoUser123!` succeeds. (FR-004, SC-008)

The `--remote` two-key gate is asserted **without ever touching the deployed project**:

7. Calling the entrypoint with `{ remote: true, projectRef: undefined }` throws before any network call. (SC-007 first clause)
8. Calling with `{ remote: false, projectRef: "any-string" }` targets local and proceeds. (SC-007 third clause)

The interactive `y` prompt (FR-012) is not exercised by the integration test — it would require stdin mocking and a real `SUPABASE_PROJECT_REF` that points somewhere live, neither of which belongs in CI. The prompt is covered in the manual `smoke-tests.md` (drafted during `/speckit.tasks`).

## Edits to Feature 001

Three edits land on feature 001's artifacts as part of this feature:

1. **`apps/web/tests/e2e/setup/global-setup.ts`** — Lines 30-45 (the wholesale `auth.users` truncation loop) become pattern-scoped: only delete users whose `email.endsWith("@example.com")`. The comment on lines 30-31 is updated. Lines 46-52 (the orphan-profile sweep and its comment block) are removed entirely per Decision C. (FR-019, Decision C.)
2. **Root `package.json`** — Promoted from the 8-line file it is today to one that holds dev deps (`@faker-js/faker`, `@supabase/supabase-js`, `tsx`, `vitest`, `dotenv`) and three scripts (`seed`, `seed:reset`, `test:seed`, `test:seed:integration`).
3. **`docs/DECISIONS.md`** — Two append-only entries written during `/speckit.implement`: one for the runner choice (`tsx` 4.19.2), one for the orphan-sweep removal. (Principle VIII.)

No other files in `apps/web/` are touched. `supabase/migrations/` is untouched (FR-015).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| (none) | — | — |

The plan passes the Constitution Check without any waivers.
