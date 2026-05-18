---

description: "Ordered task list for feature 002-demo-seed-data"
---

# Tasks: Demo Seed Data

**Input**: Design documents from `/specs/002-demo-seed-data/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli.md, quickstart.md

**Tests**: Per Constitution Principle VII, this feature ships Vitest unit tests (hierarchy generator) AND a Vitest integration test (against a real local Supabase). Both are mandatory; both run under `vitest run`. The integration suite is gated by `SUPABASE_INTEGRATION=1` so the default offline test command stays fast.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and committed as an atomic increment. Within each phase, the order respects the dependency chain (setup → libraries → entrypoint → integration tests → docs).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete deps)
- **[Story]**: User story label (`US1`–`US5`) for traceability — only on story-phase tasks
- **⚠ Principle VII**: marker when a task introduces code without immediate test coverage; the line names the downstream task that exercises it

## Path Conventions

Paths are repo-relative. The seed script lives at `scripts/seed-demo.ts` at the repo root (FR-014) — NOT under `apps/web/` and NOT under `supabase/seeds/`. Test files live under `scripts/__tests__/`. The one Playwright file this feature modifies is `apps/web/tests/e2e/setup/global-setup.ts` (FR-019).

## Cross-cutting notes

- **No schema migration in this feature**. FR-015 / FR-016 forbid it. The seed consumes `auth.users` and `public.profiles` exactly as feature 001 left them.
- **Service-role direct UPDATEs, NOT the SECURITY DEFINER RPCs.** Per DECISIONS 2026-05-17 and FR-018, the seed writes role/manager_id directly via the service-role client. Calling `admin_update_role` / `admin_update_manager` from a service-role context would fail because `auth.uid()` is NULL.
- **`@faker-js/faker` is pinned exactly to `9.2.0`** (no caret, no tilde) per FR-020. If `npm install` cannot resolve `9.2.0` at T001 time, the implementer picks the closest published 9.x patch AND updates the plan's "Pinned versions" table in the same commit (Principle VIII).
- **Root `tsconfig.json` does not exist** in the repo today (verified at `/speckit.tasks` time). T003 creates it as a new file with the contents below — not "extend an existing".
- **smoke-tests.md** (`specs/002-demo-seed-data/smoke-tests.md`) is authored alongside this file. It is Mohamed's human-validated check after `/speckit.implement` completes; it is NOT a code task.
- **Commit cadence**: one task = one commit. Commit message convention: `<scope>(002): <imperative summary>` (e.g. `feat(002):`, `chore(002):`, `test(002):`, `docs(002):`).

---

## Phase 1: Setup (Root Tooling)

**Purpose**: Bring the repo root from "workspaces declaration only" to "has its own dev toolchain". Every task in this phase touches a different concern.

- [ ] T001 [P] Add `devDependencies` block to the root `/package.json` with exact pins from plan.md "Pinned versions" table: `"@faker-js/faker": "9.2.0"`, `"@supabase/supabase-js": "^2.105.4"`, `"tsx": "4.19.2"`, `"dotenv": "^17.4.2"`, `"vitest": "^4.1.6"`, `"cross-env": "^7.0.3"`. Both `@faker-js/faker` and `tsx` MUST be exact (no caret, no tilde) per FR-020 / Decision A. Run `npm install` from repo root to confirm resolution.
- [ ] T002 [P] Add `scripts` block to the root `/package.json` with four entries from `contracts/cli.md`: `"seed": "tsx scripts/seed-demo.ts"`, `"seed:reset": "tsx scripts/seed-demo.ts --reset"`, `"test:seed": "vitest run"`, `"test:seed:integration": "cross-env SUPABASE_INTEGRATION=1 vitest run"`. ⚠ Principle VII: these scripts are consumed by every following task; quickstart.md §2-§5 is the human-validated coverage; the integration test T021 is the automated coverage.
- [ ] T003 [P] Create `/tsconfig.json` (NEW file — verified absent at /speckit.tasks time) with: `"compilerOptions": { "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler", "strict": true, "noUncheckedIndexedAccess": true, "esModuleInterop": true, "skipLibCheck": true, "resolveJsonModule": true, "types": ["node"] }, "include": ["scripts/**/*.ts"], "exclude": ["node_modules", "apps", "supabase"]`. This config covers ONLY repo-root tooling under `scripts/`; `apps/web/tsconfig.json` continues to govern the Next.js app independently. ⚠ Principle VII: TS strictness is enforced by T022's typecheck step.
- [ ] T004 [P] Create `/vitest.config.ts` (NEW file) with: `defineConfig({ test: { include: ["scripts/__tests__/**/*.test.ts"], testTimeout: 60_000 } })`. The 60s timeout is the SC-001 budget for the integration suite; unit tests in T006 complete in milliseconds so the budget never bites them. No React plugin (no UI here); no `setupFiles` (no DOM globals needed). ⚠ Principle VII: T006 (unit) and T021 (integration) consume this config.

**Checkpoint**: `npm run test:seed` returns "No test files found" — green, because no test files exist yet. `npm run seed` fails with "Cannot find module" — expected, because `scripts/seed-demo.ts` does not exist yet.

---

## Phase 2: Foundational (Pure Modules + Unit Test)

**Purpose**: Build the five `scripts/lib/` modules and the hierarchy unit test. Every module here is a pure function or a single-responsibility helper that the entrypoint (Phase 3) imports. Each commits independently.

**⚠ CRITICAL**: T011 (the entrypoint) cannot start until at least T005, T007, T008, T009, T010 are committed.

- [ ] T005 Write `scripts/lib/hierarchy.ts` exporting a single function `buildHierarchy(seed: number): readonly DemoUser[]` that returns the canonical 30-slot shape from `data-model.md`. The shape (slot → role + manager_slot) is hard-coded; only `full_name` and the local-part of `email` are seeded from faker. Email format: `<normalize(first)>.<normalize(last)>.<NN>@demo.serenify.local` per Decision B, with `normalize(s) = s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "")` and `NN = String(slot + 1).padStart(2, "0")`. Implements FR-001 (counts), FR-002 (email pattern), FR-006 (hierarchy shape), FR-007 (determinism), Decision B (email format). Type `DemoUser = { slot: number; full_name: string; email: string; role: 'admin' | 'team_lead' | 'employee'; manager_slot: number | null }`. ⚠ Principle VII: paired with T006 — write T005 and T006 in the same coding session so the snapshot can be pinned correctly on first green run.
- [ ] T006 Write `scripts/__tests__/hierarchy.test.ts` — Vitest unit suite asserting the nine clauses from plan.md "Test Strategy → Unit test":
  1. Count: 30 total; 2 admin / 5 team_lead / 23 employee (FR-001).
  2. Team-lead reports: each team_lead has 4–5 direct reports (FR-006(a)).
  3. Three-level chain: at least one team_lead's `manager_slot` resolves to another team_lead; traversing upward two hops lands on admin (FR-006(b)).
  4. Employee-to-admin edges: exactly 2 employees report directly to admins, one to each admin (FR-006(c)).
  5. Non-null `manager_slot` on every non-admin (FR-006(d)).
  6. `manager_slot === null` on exactly the 2 admins (FR-006(e)).
  7. Determinism: `buildHierarchy(1729)` is deep-equal to itself across calls; pinned against an embedded 30-row snapshot (FR-007 / SC-005).
  8. Email shape: every email matches `/^[a-z0-9]+\.[a-z0-9]+\.\d{2}@demo\.serenify\.local$/`, `NN` ∈ 01..30, 30 distinct (FR-002 + Decision B).
  9. Synthetic-only names: no `full_name` matches `/(fatma.+emad|gehad.+mohamed|hebatullah.+gazoly|mohamed.+assem)/i` (Principle X).

  This task is the verification gate for T005 — both files commit together.
- [ ] T007 [P] Write `scripts/lib/env.ts` exporting `loadConfig(argv: string[]): SeedConfig`. Responsibilities: (a) load `apps/web/.env.local` via `dotenv` (resolve path relative to the file using `import.meta.url` so the script is portable); (b) parse argv for `--reset` and `--remote`, reject any other token (exit 6); (c) build `SeedConfig = { reset: boolean; target: { kind: 'local'; url: string } | { kind: 'remote'; url: string; projectRef: string } }`. Two-key gate (FR-011): if `--remote` is present AND `SUPABASE_PROJECT_REF` is missing, throw a typed error that T011 surfaces as exit 1. If `--remote` is absent, `SUPABASE_PROJECT_REF` is silently ignored — target is `local`. ⚠ Principle VII: covered by T021 assertions 7 + 8.
- [ ] T008 [P] Write `scripts/lib/supabase-admin.ts` exporting `createAdminClient(target: SeedConfig['target']): SupabaseClient`. The first line of the module is `if (process.env.NODE_ENV === 'production') throw new Error('seed admin client must never run in production')` — defense in depth (Principle IX, plan.md Decision A test-infra parallel). The factory builds the URL from `target` (loopback for local, `https://<projectRef>.supabase.co` for remote) and reads `SUPABASE_SERVICE_ROLE_KEY` from `process.env`. Initializes with `auth: { autoRefreshToken: false, persistSession: false }`. ⚠ Principle VII: exercised transitively by T011, asserted indirectly by T021.
- [ ] T009 [P] Write `scripts/lib/confirm.ts` exporting `confirmProceed(): Promise<boolean>`. Reads a single keystroke from `process.stdin`, returns `true` iff the byte is `y` or `Y`, `false` otherwise (including empty Enter). Closes stdin after read. Implements FR-012 (interactive y/N prompt). ⚠ Principle VII: not unit-tested (stdin mocking would test the mock, not the behavior); covered by smoke-test ST-7.
- [ ] T010 [P] Write `scripts/lib/banner.ts` exporting three functions: `environmentBanner(target): string` (FR-013), `summaryTable(users: DemoUser[], idByLot: Map<number, string>): string` (uses CP437 box-drawing characters per contracts/cli.md), and `passwordBanner(): string` (prints `DemoUser123!` per FR-005). MUST NOT accept or reference `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Principle IX. ⚠ Principle VII: covered indirectly via T021 (the integration test asserts the script's stdout matches the expected banner shape).

**Checkpoint**: `npm run test:seed` runs T006 and shows 9/9 passing assertions on the hierarchy generator. The five lib modules exist; the entrypoint does not yet exist.

---

## Phase 3: User Story 1 + User Story 2 — First-run seed and idempotent re-run (Priority: P1) 🎯 MVP

**Goal**: `npm run seed` against a fresh local Supabase creates the 30 demo users, prints the summary table and password banner (FR-005, FR-013). `npm run seed` against an already-seeded project produces zero creates, zero updates, zero deletes (FR-008).

**Independent Test**: From a fresh local Supabase containing only the bootstrap admin, run `npm run seed`. Verify Supabase Studio shows 30 additional users at `*@demo.serenify.local`, distribution 2/5/23, with the hierarchy table from `data-model.md`. Then run `npm run seed` a second time; verify the output is "Demo cohort already present. No changes made." and Supabase Studio shows no diff.

US1 and US2 are combined into one phase because they exercise the same code path — the script's idempotency (US2) is the listUsers+skip prefix of the same orchestrator that the create path (US1) lives in. Splitting them across two phases would mean US1 ships a non-idempotent first version and US2 retrofits it, which contradicts FR-008.

### Implementation for US1 + US2

- [ ] T011 [US1] [US2] Write `scripts/seed-demo.ts` orchestrator. Step-by-step matches `contracts/cli.md` → "Idempotent path" exactly:
  1. Call `loadConfig(process.argv.slice(2))` (T007). Catch the typed `--remote without env var` error and exit 1 with the message from contracts/cli.md; catch the unknown-flag error and exit 6; catch the production-environment refusal and exit 3.
  2. If required env vars (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are missing, exit 2 naming the variable.
  3. Print `environmentBanner(target)` (T010).
  4. If `target.kind === 'remote'`, call `confirmProceed()` (T009); if false, exit 4 with `Aborted by user.`
  5. Build the admin client via `createAdminClient(target)` (T008).
  6. Paginate `admin.auth.admin.listUsers({ page, perPage: 200 })`; collect rows whose `email.endsWith('@demo.serenify.local')`.
  7. If the demo count is exactly 30, print `Demo cohort already present. No changes made.` and exit 0 (FR-008).
  8. If the count is between 1 and 29, print a single-line warning naming the count and suggesting `npm run seed:reset`, exit 5 (spec Edge Cases; partial-state recovery is not in scope).
  9. If the count is 0, run the create path:
     a. Call `buildHierarchy(1729)` (T005).
     b. For each slot 0..29 in order, call `admin.auth.admin.createUser({ email, password: 'DemoUser123!', email_confirm: true, user_metadata: { full_name } })`. Sequential, not parallelized. Record the returned `id` keyed by slot.
     c. Build the slot→uuid map. Resolve `manager_id` per slot using the map.
     d. Issue a single `UPSERT` (or 30 UPDATEs in a transaction-equivalent loop — Supabase doesn't expose explicit transactions over PostgREST, so per-row UPDATEs are acceptable here) writing `role`, `manager_id`, `full_name` to `public.profiles` for each of the 30 ids. Direct UPDATE via service-role client per FR-018 — NOT the SECURITY DEFINER RPCs.
     e. Print `summaryTable(...)` (T010).
     f. Print `passwordBanner()` (T010).
     g. Exit 0.

  Implements FR-001, FR-002, FR-003, FR-004, FR-005, FR-008, FR-010, FR-013, FR-014, FR-017, FR-018. Closes Story 1 and Story 2.

  ⚠ Principle VII: covered by T021 integration test assertions 1, 2, 3, 4, 5, 6.
- [ ] T012 [US1] [US2] Manual quickstart validation: from a fresh local Supabase (only the bootstrap admin present), run `npm run seed`. Verify under 60s wall-clock (SC-001). Verify Supabase Studio shows exactly 30 demo users at `*@demo.serenify.local` distributed 2/5/23 (SC-002). Verify sign-in as the first slot's email + `DemoUser123!` lands on `/app` (SC-008). Re-run `npm run seed`; verify the "already present" message and zero diff (SC-004). NOT a code task — this is the human-validated milestone before moving to Phase 4.

**Checkpoint**: US1 and US2 are functional. The MVP is reachable: a developer can run `npm run seed` and immediately sign in as any of 30 demo users. Phase 4 starts.

---

## Phase 4: User Story 3 — Reset wipes only the demo cohort (Priority: P2)

**Goal**: `npm run seed:reset` deletes every user matching `*@demo.serenify.local` and recreates the cohort deterministically. The bootstrap admin and any non-demo users are not read, modified, or deleted (FR-003, FR-009).

**Independent Test**: After Phase 3, mutate a demo profile row in Supabase Studio (e.g., flip a team_lead to employee). Run `npm run seed:reset`. Confirm all 30 demo users are recreated with the canonical hierarchy and that the bootstrap admin still exists with its original role.

### Implementation for US3

- [ ] T013 [US3] Extend `scripts/seed-demo.ts` to handle `config.reset === true`. Insert the reset branch between steps 5 and 6 of T011's flow: paginate `admin.auth.admin.listUsers`, filter by `email.endsWith('@demo.serenify.local')`, and call `admin.auth.admin.deleteUser(id)` for each match. The FK `profiles.id REFERENCES auth.users(id) ON DELETE CASCADE` removes the corresponding `profiles` rows automatically. After the delete loop completes, fall through to the create path (step 9 in T011) — the listUsers step will now find zero demo users, so the create path runs unconditionally. Implements FR-009. ⚠ Principle VII: covered by T021 assertion 4 (post-reset re-seed produces zero diff against canonical baseline) and assertion 5 (non-demo users untouched).
- [ ] T014 [US3] Manual quickstart validation: mutate a demo profile in Supabase Studio, run `npm run seed:reset`, verify the canonical hierarchy is restored (SC-005) and the bootstrap admin still has its original `role` (SC-006). NOT a code task.

**Checkpoint**: US3 is functional. Reset is the supported recovery path for any partial-state or drift case from Edge Cases.

---

## Phase 5: User Story 4 — Playwright fixtures and demo users coexist (Priority: P1)

**Goal**: `npm run test:e2e --workspace=apps/web` deletes only `@example.com` users and leaves the demo cohort intact. After a full e2e run, the 30 demo users are still present with their roles and manager_id wiring (FR-019, Story 4).

**Independent Test**: Run `npm run seed`, verify 30 demo users. Run `npm run test:e2e --workspace=apps/web`. After the run completes, verify the 30 demo users still exist with their original roles and `manager_id` wiring.

### Implementation for US4

- [ ] T015 [US4] Modify `apps/web/tests/e2e/setup/global-setup.ts` per FR-019 + plan.md Decision C:
  - **Pattern-scope the auth.users delete loop** (current lines 30-45): inside the `for (const u of data.users)` loop, wrap the `deleteUser(u.id)` call in `if (u.email?.endsWith('@example.com'))`. Update the comment on lines 30-31 from "delete every existing auth user (cascades to profiles)" to "delete every `@example.com` fixture user (cascades to profiles via FK; demo cohort users at `@demo.serenify.local` survive)".
  - **Remove the orphan-profile sweep** (current lines 46-52): delete the comment block AND the `await admin.from("profiles").delete().gte(...)` statement entirely. The FK CASCADE guarantees orphan profiles cannot exist; the unscoped sweep would actively destroy demo profile rows after the pattern-scoping above (plan.md Decision C).
  - The localhost guard (lines 21-26), the test-admin seed (lines 54-71), and the env-var exports (lines 72-73) are unchanged.

  Implements FR-019, closes plan.md Decision C. ⚠ Principle VII: covered directly by T016.
- [ ] T016 [US4] Write `apps/web/tests/e2e/demo-coexistence.spec.ts` — a new Playwright spec that asserts the FR-019 contract:
  1. `beforeAll`: connect via the admin client (already exists at `apps/web/tests/e2e/setup/admin-client.ts`), assert that there are at least 30 users with `email LIKE '%@demo.serenify.local'`. If there are fewer, skip the spec with a clear message ("npm run seed has not been run; demo-coexistence is N/A for this run"). This skip-on-empty behavior is deliberate: CI may not have the demo cohort seeded, but the spec must run cleanly in that case.
  2. Snapshot the demo cohort emails + roles + manager_ids.
  3. Run a trivial Playwright interaction (e.g., visit `/login`) so global-setup has actually executed in the current test run context. (global-setup already ran before this spec by Playwright's setup ordering, so the snapshot in step 2 is the post-setup state.)
  4. Re-query the demo cohort; assert byte-equal to the snapshot.
  5. Assert that the count of `@example.com` users is ≤ the count from the test-admin + any per-spec fixtures (this is the dual: we verify global-setup did wipe the fixture cohort, while leaving the demo cohort).

  This is the only Playwright spec this feature adds. Tests FR-003 and FR-019 directly. Closes US4.
- [ ] T017 [US4] Manual quickstart validation: `npm run seed` then `npm run test:e2e --workspace=apps/web`. After the run completes, query `auth.users` for `email LIKE '%@demo.serenify.local'`; assert count is exactly 30. Sign in as the first demo user; assert success. Covers SC-006 from US4's angle. NOT a code task.

**Checkpoint**: US4 closed. The demo cohort survives e2e runs. Running `npm run seed` once is enough — subsequent e2e runs no longer destroy it.

---

## Phase 6: User Story 5 — Remote target is guarded (Priority: P2)

**Goal**: A maintainer who opts in with both `--remote` AND `SUPABASE_PROJECT_REF` reaches the deployed project after an explicit `y` keystroke. Any one-key partial opt-in is rejected; the env var alone (without the flag) is silently ignored.

**Independent Test**: With `SUPABASE_PROJECT_REF` unset, run `npm run seed -- --remote`; confirm exit 1 before any network write. With the env var set but no flag, run `npm run seed`; confirm it targets local (env var ignored). With both opt-ins, confirm the script prints the target project ref and prompts `Proceed? (y/N) `.

### Implementation for US5

US5 introduces no new code paths in `scripts/seed-demo.ts` — T007, T009, T011, and T013 already implement everything. US5 is therefore a verification phase only.

- [ ] T018 [US5] Code review pass: re-read T011's branches 1 + 4 against contracts/cli.md "Two-key remote consent gate" table; confirm all four rows (✗/✗, ✗/✓, ✓/✗, ✓/✓) produce the documented behavior (exit codes 0, 0, 1, 0). If any row diverges, file a follow-up edit task. Implements FR-011, FR-012. ⚠ Principle VII: covered by T021 assertions 7 + 8 and smoke-test ST-7.
- [ ] T019 [US5] Manual quickstart validation: exercise all three negative/positive cases for the `--remote` gate per quickstart.md §7. Specifically: (a) `--remote` without env var → exit 1 (SC-007 first clause); (b) env var alone → targets LOCAL (SC-007 third clause); (c) both opt-ins → REMOTE banner + prompt → answering anything other than `y` exits 4 (SC-007 second clause partial — full positive `y` case is reserved for the maintainer's controlled demo, not the standard developer flow). NOT a code task.

**Checkpoint**: US5 closed. All 5 user stories are functional.

---

## Phase 7: Integration Test

**Purpose**: One automated Vitest suite that exercises the script against a real local Supabase. This is the test gate Principle VII calls for: it verifies FR-006(a)–(e) on actual `auth.users` + `public.profiles` rows, not just on the pure generator's output.

- [ ] T020 Write `scripts/__tests__/seed-demo.integration.test.ts` per plan.md "Test Strategy → Integration test". Structure:
  - File-top: `describe.skipIf(process.env.SUPABASE_INTEGRATION !== '1')(...)` so default `vitest run` skips this suite.
  - `beforeAll` (60s timeout): assert `NEXT_PUBLIC_SUPABASE_URL` is loopback; snapshot non-demo users; invoke the script's reset path programmatically via an exported `main({ reset: true, target: ... })` (refactor T011 minimally to export this entrypoint in addition to the CLI bootstrap).
  - Assertions (each numbered to plan.md "Test Strategy → Integration test"):
    1. After reset+seed, `auth.users` count for `*@demo.serenify.local` is exactly 30 (SC-002).
    2. `public.profiles` distribution is 2/5/23 (SC-002).
    3. FR-006(a)–(e) hold against real `profiles.manager_id` UUIDs (re-asserted via SQL queries through the admin client, not against in-memory data).
    4. Non-demo snapshot from `beforeAll` is byte-identical post-run (FR-003, SC-006).
    5. Running the entrypoint a second time without `reset` produces zero diff (FR-008, SC-004).
    6. Anon-client `signInWithPassword(firstSlotEmail, 'DemoUser123!')` succeeds (FR-004, SC-008).
    7. Calling `main` with `{ remote: true, projectRef: undefined }` throws before any network call (SC-007 first clause).
    8. Calling `main` with `{ remote: false, projectRef: 'anything' }` targets local and proceeds (SC-007 third clause).

  ⚠ Principle VII: this IS the test gate. Combined with T006, it covers every FR / SC in the spec except those reserved for smoke-tests.md (ST-7 interactive prompt, ST-9/ST-10 missing-env-var edge cases).

**Checkpoint**: `npm run test:seed:integration` runs against a developer's local Supabase and goes green. CI integration is deferred to a follow-up (running Supabase in CI is a feature-006-era decision, not a feature-002 deliverable).

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T021 [P] Run `npx tsc -p tsconfig.json --noEmit` from the repo root; resolve any strict-mode error in `scripts/`. Ensure zero `any`, zero `@ts-ignore`. ⚠ Principle VII: enforces the strict-mode contract from T003.
- [ ] T022 [P] Run `npm run test:seed` then `npm run test:seed:integration`. Both green. Record the green-run timing in `docs/PROGRESS.md` (SC-001 evidence). Confirm `npm run test:e2e --workspace=apps/web` is still green after the FR-019 edit lands.
- [ ] T023 [P] Append three entries to `docs/DECISIONS.md` per Constitution Principle VIII (file already exists from feature 001):
  1. **TypeScript runner for repo-root scripts: `tsx` 4.19.2 (exact pin).** Status: accepted 2026-05-18. Rationale: ESM-first, zero config, no separate build step; trade-off vs. `ts-node` is more `node_modules` weight but no loader-flag rituals; trade-off vs. inline `esbuild` is one extra dev dep but no `dist/` artifact in the repo. Exact pin because `tsx` is part of the deterministic toolchain — a major bump could shift ESM path resolution.
  2. **Playwright orphan-profile sweep removed.** Status: accepted 2026-05-18. Rationale: once auth.users deletion in `global-setup.ts` becomes pattern-scoped to `@example.com` (FR-019), the unscoped orphan sweep at the old lines 49-52 would actively destroy demo profile rows whose `auth.users` parents survive. The FK CASCADE constraint already prevents real orphan profiles, so the sweep was a no-op before this feature and is destructive after. Removing is simpler than pattern-scoping the sweep against the same FK contract.
  3. **Demo email format: `<normalize(first)>.<normalize(last)>.<NN>@demo.serenify.local` (slot-suffixed, ASCII-normalized).** Status: accepted 2026-05-18. Convention applies to any future seed work — e.g., the deferred signal-event seeding follow-up that will extend `scripts/seed-demo.ts` immediately before feature 011. `normalize = NFD-decompose + diacritic-strip + lowercase + non-alphanumeric-strip`. `NN = 2-digit slot index 01..30`. The slot suffix makes email uniqueness independent of faker name collisions, satisfying FR-007's determinism guarantee unconditionally. Future seed cohorts (beyond the 30-user demo) should keep the same `<name>.<NN>@<cohort-suffix>.serenify.local` shape and only swap the cohort suffix — never the slot suffix.

  All three entries are append-only; existing decisions are not edited.
- [ ] T024 [P] Append a feature-002 entry to `docs/PROGRESS.md`: branch merged, smoke-test pass status, deviations resolved, gates passed.
- [ ] T025 Mohamed runs through `specs/002-demo-seed-data/smoke-tests.md` manually; all ST-1 through ST-10 rows recorded ✅/❌/⚠ inline. The branch may not merge to `main` until every row is ✅. This is NOT a code task; it is the human-validated gate per Constitution Principle VII.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 Setup**: No dependencies. T001–T004 are all [P] (different files / different concerns).
- **Phase 2 Foundational**: Depends on Phase 1 (needs the package.json scripts, tsconfig, vitest config). Within Phase 2:
  - T005 → T006 (T006 imports T005).
  - T007, T008, T009, T010 are [P] with each other and with T005/T006.
- **Phase 3 (US1+US2)**: Depends on T005, T007, T008, T009, T010. T011 → T012.
- **Phase 4 (US3)**: Depends on Phase 3 (extends `scripts/seed-demo.ts`). T013 → T014.
- **Phase 5 (US4)**: Depends ONLY on Phase 1 (T001–T002) for the npm scripts; specifically does NOT depend on the seed entrypoint. May run in parallel with Phase 3/4 if there is staff capacity. T015 → T016 → T017.
- **Phase 6 (US5)**: Depends on Phase 3 (the gate is in T011/T007).
- **Phase 7 (integration test)**: Depends on Phase 3, 4, and 6 (every code path that the integration test asserts).
- **Phase 8 Polish**: Depends on all preceding phases.

### Within each user story

- For seed-script stories (US1–US3, US5), the dependency is `scripts/lib/*` modules → `scripts/seed-demo.ts` entrypoint → manual validation.
- For US4 (the Playwright retrofit), the dependency is `global-setup.ts` edit → new spec → manual validation.

### Parallel opportunities

- Phase 1: T001 + T002 + T003 + T004 all [P].
- Phase 2: T005/T006 as a pair, then T007 + T008 + T009 + T010 all [P].
- Phase 5 can run in parallel with Phase 3 and Phase 4.
- Phase 8: T021 + T022 + T023 + T024 all [P].

---

## Parallel Example: Phase 2 modules

```bash
# After T005+T006 commit, four module tasks can be picked up by
# different contributors in parallel:

Task: "Write scripts/lib/env.ts"               # T007
Task: "Write scripts/lib/supabase-admin.ts"    # T008
Task: "Write scripts/lib/confirm.ts"           # T009
Task: "Write scripts/lib/banner.ts"            # T010
```

---

## Implementation Strategy

### MVP First (US1 + US2)

Feature 002's MVP is US1 + US2 combined — the same `npm run seed` command must work cleanly on a fresh project AND on an already-seeded project.

1. Phase 1 Setup (T001–T004).
2. Phase 2 Foundational (T005–T010).
3. Phase 3 US1+US2 (T011, T012).
4. **STOP and VALIDATE**: smoke-test ST-1, ST-2, ST-3, ST-4, ST-8 manually.
5. Demo: a developer can `npm run seed` and immediately sign in as any of 30 demo users.

### Incremental Delivery

6. Phase 4 US3 — reset (T013, T014).
7. **VALIDATE**: smoke-test ST-5, ST-6.
8. Phase 5 US4 — Playwright coexistence (T015–T017).
9. **VALIDATE**: smoke-test ST-6 (cross-cohort), confirm e2e suite still green.
10. Phase 6 US5 — remote gate verification (T018, T019).
11. **VALIDATE**: smoke-test ST-7.
12. Phase 7 — integration test (T020).
13. Phase 8 — polish, decisions, smoke-test pass (T021–T025).
14. Merge to `main`.

### Parallel Team Strategy

Two developers:

- Dev A: Phase 1 (T001–T004) → Phase 2 hierarchy pair (T005, T006) → Phase 3 (T011, T012) → Phase 4 (T013, T014).
- Dev B: After T001+T002 commit, can start Phase 5 (T015–T017) immediately — US4 is independent of US1–US3.

Dev A wraps up Phases 6 and 7. Both converge on Phase 8.

---

## Notes

- `[P]` markers indicate file independence — no contributor stomps on the same file.
- `[Story]` labels (US1–US5) map each story-phase task to its primary user story for traceability. Some tasks (T011, T012) cover two stories because the underlying code path is shared (US1's create and US2's skip are branches of the same orchestrator).
- Constitution Principle VII (mandatory testing per PR) is satisfied by: hierarchy unit suite (T006), integration suite (T020), Playwright coexistence spec (T016), and Mohamed's smoke-test pass (T025). Tasks introducing code without immediate test coverage are flagged ⚠ Principle VII and name their downstream coverage task.
- Commit cadence: one task = one commit. Commit messages use `<scope>(002): <imperative summary>` matching the feature-001 convention.
- No task in this list creates a deployed-Supabase demo cohort. The `--remote` path is exercised by maintainers manually, never by `/speckit.implement`.
