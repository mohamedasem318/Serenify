# Phase 0 Research: Demo Seed Data

**Feature**: `002-demo-seed-data`
**Phase**: 0
**Date**: 2026-05-18

This document captures the closed decisions feeding `plan.md`. Each section
ends with a one-line **Outcome** and the spec / functional-requirement
reference it closes.

## R-1. TypeScript runner choice

**Question**: How does `scripts/seed-demo.ts` get executed by Node?

**Options considered**:

- `tsx` — esbuild-backed loader, ESM-first, single dev dependency, zero config.
- `ts-node` — older, requires explicit ESM loader flags on modern Node and stumbles on path-aliased imports in the workspace.
- A separate `esbuild` build step that emits to `scripts/dist/` before each run.

**Discussion**: The script is a fixture tool a developer runs perhaps a handful of times per week. Any toolchain overhead is amortized over very few invocations, so the dominant cost is the friction of "did you remember to rebuild?". A separate build step adds that friction; `tsx` removes it. `ts-node` adds the friction of "did you remember to pass `--loader ts-node/esm`?" — different friction, same cost.

`tsx` is also already in many adjacent toolchains (it's what Next.js itself uses for some internal scripts), so the team is unlikely to bounce off unfamiliar errors. Its esbuild backend means a startup overhead in the low-double-digit milliseconds, which is irrelevant for a script that then makes 30 network calls.

**Outcome**: Use `tsx` at the exact pin `"4.19.2"`. The pin is exact (no caret) because `tsx` is part of the deterministic toolchain — a future major bump could subtly change how it resolves ESM paths. Closes the implicit "TS runner" gap in the spec.

## R-2. Email-format collision strategy

**Question**: If `@faker-js/faker` produces two identical (first, last) pairs across the 30 slots, how does the script still produce 30 unique deterministic emails?

**Options considered**:

- Bare `<first>.<last>@demo.serenify.local` — fails on faker collisions, even if rare.
- Append a hash of the slot index — non-human-readable in the summary banner.
- Append the slot index `01..30` as a third dotted component.

**Discussion**: Faker's name generators do not promise uniqueness across small sample sizes. A 30-person draw from the default `en` locale almost never collides, but "almost never" violates FR-007's determinism guarantee (which must hold in 100% of runs, not 99.9%). Decoupling email uniqueness from name uniqueness via a slot suffix makes the guarantee unconditional.

Human readability matters for the summary banner: a maintainer reading the table should be able to mentally pair `alice.cooper.07@demo.serenify.local` with "Alice Cooper". A 4-character hash suffix loses that.

ASCII normalization is also part of the format: faker locales occasionally produce diacritics (e.g., `Renée`, `François`), which violate SMTP-style local-part rules even though `.local` mail is never actually delivered. NFD-decompose + diacritic strip + lowercase + non-alphanumeric strip is the standard fix.

**Outcome**: `<normalize(first)>.<normalize(last)>.<NN>@demo.serenify.local`, where `normalize(s) = s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "")` and `NN = String(slot + 1).padStart(2, "0")`. Closes FR-002 + FR-007's collision question.

## R-3. Hierarchy shape that satisfies FR-006(a)–(e)

**Question**: What concrete 30-slot graph satisfies all five FR-006 invariants?

**Constraints (FR-006)**:

- (a) Each team_lead has 4–5 direct reports.
- (b) At least one team_lead reports to another team_lead.
- (c) Exactly two employees report directly to admins, one to each admin.
- (d) Every non-admin has a non-null `manager_id`.
- (e) The two admins have `manager_id = NULL`.

**Counting check**: 5 team_leads × 4–5 reports = 20–25 reports go to team_leads. Two employees go to admins. So the team-lead population (employees + team_leads who report into team_leads) is 21–25. The actual population is 21 employees + at least 1 team_lead = 22. So 5 team_leads must absorb 22 reports total — that's an average of 4.4, comfortably in the 4–5 band, with one team_lead getting 5 reports if the others get 4, or two getting 5 if all four-report leads are themselves only at 4. Many shapes satisfy the constraint.

**Selected shape** (slot indices are 0-based for code; ranks shown for clarity):

| Slot | Role | manager_slot | Reports (slots) | Report count |
|------|------|--------------|-----------------|--------------|
| 0 | admin | `null` | 2 (E1), 5 (TL1), 6 (TL2) | 3 |
| 1 | admin | `null` | 3 (E2), 7 (TL3), 8 (TL4) | 3 |
| 5 | team_lead (TL1) | 0 | 9 (TL5), 10, 11, 12 | 4 |
| 6 | team_lead (TL2) | 0 | 13, 14, 15, 16, 17 | 5 |
| 7 | team_lead (TL3) | 1 | 18, 19, 20, 21 | 4 |
| 8 | team_lead (TL4) | 1 | 22, 23, 24, 25, 26 | 5 |
| 9 | team_lead (TL5) | 5 | 27, 28, 29 | 3 ❌ |

The naïve allocation puts TL5 at 3 reports, below the 4-report floor. Rebalanced:

| Slot | Role | manager_slot | Reports (slots) | Report count |
|------|------|--------------|-----------------|--------------|
| 0 | admin | `null` | 2 (employee), 5 (TL1), 6 (TL2) | 3 |
| 1 | admin | `null` | 3 (employee), 7 (TL3), 8 (TL4) | 3 |
| 5 | TL1 | 0 | 9 (TL5), 10, 11, 12 | 4 ✓ |
| 6 | TL2 | 0 | 13, 14, 15, 16, 17 | 5 ✓ |
| 7 | TL3 | 1 | 18, 19, 20, 21 | 4 ✓ |
| 8 | TL4 | 1 | 22, 23, 24, 25 | 4 ✓ |
| 9 | TL5 | 5 | 26, 27, 28, 29 | 4 ✓ |

Total slot-employee reports placed: 1 (slot 2) + 1 (slot 3) + 3 (10-12) + 5 (13-17) + 4 (18-21) + 4 (22-25) + 4 (26-29) = 22.

Wait — 23 employees, and only 22 placed. Slots 2 and 3 are the admin direct reports. Slots 4..29 = 26 slots, of which 5 are team_leads (5, 6, 7, 8, 9). The remaining 21 slots are employees: 2, 3, 4, 10..29. That's 1 + 1 + 1 + 20 = 23. So slot 4 is an employee that hasn't been placed in the table above.

**Re-rebalanced** (final):

| Slot | Role | manager_slot | Reports (slots) | Direct-report count |
|------|------|--------------|------------------|----------------------|
| 0 | admin | `null` | 2, 5 (TL1), 6 (TL2) | 3 |
| 1 | admin | `null` | 3, 7 (TL3), 8 (TL4) | 3 |
| 2 | employee | 0 | — | (admin direct report #1) |
| 3 | employee | 1 | — | (admin direct report #2) |
| 4 | employee | 6 | — | (assigned to TL2) |
| 5 | TL1 | 0 | 9 (TL5), 10, 11, 12 | 4 ✓ |
| 6 | TL2 | 0 | 4, 13, 14, 15, 16 | 5 ✓ |
| 7 | TL3 | 1 | 17, 18, 19, 20 | 4 ✓ |
| 8 | TL4 | 1 | 21, 22, 23, 24, 25 | 5 ✓ |
| 9 | TL5 | 5 | 26, 27, 28, 29 | 4 ✓ |
| 10–29 | employee | (per above) | — | — |

Check:

- Admins: 2 (slots 0, 1), both with `manager_slot = null`. ✓ (e)
- Team_leads: 5 (slots 5, 6, 7, 8, 9). ✓
- Employees: 23 (slots 2, 3, 4, 10..29). ✓
- Each team_lead direct-report count: TL1 = 4, TL2 = 5, TL3 = 4, TL4 = 5, TL5 = 4. All in [4, 5]. ✓ (a)
- Team-lead → team-lead chain: TL5 (slot 9) reports to TL1 (slot 5). TL1 reports to Admin 0. So slot 10 (employee under TL5) chains: 10 → 9 (TL5) → 5 (TL1) → 0 (admin). That is the three-level skip-level chain. ✓ (b)
- Employees direct-to-admin: slot 2 → admin 0, slot 3 → admin 1. Exactly 2, one to each admin. ✓ (c)
- Non-admin non-null `manager_slot`: every slot 2..29 has a non-null `manager_slot`. ✓ (d)

**Outcome**: This concrete shape is the canonical hierarchy returned by `buildHierarchy(seed)` regardless of seed value. The faker seed only determines names; the slot-to-role-to-manager_slot map is hard-coded. Closes FR-006.

## R-4. Orphan-profile sweep in `global-setup.ts`

**Question**: When the upstream `auth.users` wipe becomes pattern-scoped (FR-019), what happens to the orphan-profile defensive sweep on lines 49-52?

**Three options considered** (see plan.md Decision C for the full write-up):

- (a) Leave it alone — broken after FR-019: the sweep deletes ALL profile rows, including demo profiles whose `auth.users` parents survive the pattern-scoped wipe.
- (b) Remove it — safe because the FK CASCADE constraint prevents orphans by construction.
- (c) Pattern-scope it — redundant safety behind a constraint the database already enforces.

**Outcome**: Option (b). Removed in this feature; comment block removed alongside the code. Closes FR-019's secondary question.

## R-5. Test framework choice

**Question**: What runs the hierarchy unit test, and what runs the integration test against a real local Supabase?

**Options considered**:

- Vitest for both, single root config, integration gated by an env var.
- Vitest for the unit test, a bespoke `node --test` script for the integration test.
- A standalone `npm run check:seed` shell script that invokes the entrypoint and `psql`-queries the result.

**Discussion**: The team already maintains Vitest patterns in `apps/web` (assertion library, `expect` API, fixture conventions). Splitting the integration test into a different runner forces a context switch every time someone touches it. A standalone `psql` script loses the assertion API entirely and pushes failure-message authoring back onto the developer.

Vitest's `vi.setConfig({ testTimeout })` and per-test `testTimeout` overrides make the 60s budget trivial; offline-by-default behavior is just a `process.env.SUPABASE_INTEGRATION === "1"` guard at the top of the integration file plus a separate npm script.

**Outcome**: Vitest for both, with a root-level `vitest.config.ts` whose `include` glob is `scripts/__tests__/**/*.test.ts`. The integration file uses `describe.skipIf(process.env.SUPABASE_INTEGRATION !== "1")` so it does not run under plain `vitest run`. Two npm scripts: `test:seed` (offline, fast) and `test:seed:integration` (gated, hits local Supabase). Closes the test-framework gap in the spec.

## R-6. Why direct profile UPDATEs, not the SECURITY DEFINER RPCs

**Question**: Feature 001 introduced `admin_update_role` and `admin_update_manager` for privileged column writes. Why is the seed allowed (required?) to bypass them?

**Discussion**: Both RPCs include an `is_admin()` guard that resolves via `auth.uid()`. Under a service-role client, no JWT is present and `auth.uid()` returns NULL, so `is_admin()` returns false, and the RPC raises before doing any work. This is documented in `docs/DECISIONS.md` (2026-05-17 entry on the role/manager update path).

The service-role client bypasses RLS entirely, which is semantically equivalent to the RPC's effect for this privileged write: the RPC exists to gate the admin web UI, not to be a bottleneck for fixture tooling. Using the service-role client here keeps the seed out of an ill-fitting API surface and avoids needing a third, service-role-aware RPC variant.

**Outcome**: Direct UPDATE on `public.profiles` via the service-role client, as in FR-018. Closes FR-018.

## R-7. Two-key remote consent gate semantics

**Question**: How does the script distinguish "consent to write to remote" from "address of the remote project"?

**Discussion**: A single env var (`SUPABASE_PROJECT_REF`) doubling as both consent and address is a footgun — a developer who exports the env var in their shell for unrelated work would, on the next `npm run seed:reset`, accidentally wipe the demo cohort in the deployed project. Two independent signals close that gap:

- `SUPABASE_PROJECT_REF` is the **address** — required to know where to point.
- `--remote` (CLI flag, no default) is the **consent** — proves the operator made an active typing choice.

Both are required. `--remote` without the env var fails fast before any write — non-zero exit, message names the missing variable. The env var without `--remote` is silently ignored: local is the default, and a stale shell export does not become a destructive surprise.

The interactive `y` prompt is the third layer (FR-012). It runs only when both keys are present, prints the target project ref, and demands a single keystroke before any write.

**Outcome**: Three-layer gate (flag + env var + prompt). Closes FR-011, FR-012, SC-007.

## R-8. Banner content and password disclosure

**Question**: What does the success banner print, and what must it NOT print?

**Discussion**: The shared password `DemoUser123!` is intentionally printed at the end of a successful run (FR-005). Demo users only exist in non-production environments (Principle X), and the password's whole purpose is to be remembered or skim-readable; printing it in the banner closes the "wait, what was that password again?" loop.

What the banner MUST NOT contain:

- The service-role key. Ever. In any form. Not in the banner, not in the per-row summary, not in a debug-mode dump (debug mode is not a feature of this script).
- Any value read from `apps/web/.env.local` other than `NEXT_PUBLIC_SUPABASE_URL` (which is non-secret by convention — it embeds the project subdomain on remote, the loopback address on local). Specifically, the anon key is also not printed.
- For the `--remote` path, the script prints the project ref (a non-secret), not the service-role key or any other credential.

The summary table prints (slot, full_name, email, role, manager_full_name) — no IDs, no secrets, no timestamps.

**Outcome**: Banner spec frozen in `contracts/cli.md`. Closes FR-005 + FR-013 + Principle IX.

## R-9. `@faker-js/faker` pin version

**Question**: What is the literal version string that goes in `package.json`?

**Discussion**: FR-020 forbids caret/tilde. The chosen value is `"9.2.0"`. Patch releases of faker have historically shifted name corpora (e.g., the 9.0.x → 9.1.0 jump quietly added entries to `firstName()`'s dataset for the default locale). Pinning at the patch level is the only way to guarantee FR-007's byte-identical-name promise across machines.

If `npm install` cannot resolve `"9.2.0"` at implementation time (yanked, never published), the implementer MUST select the closest published 9.x patch and update both `package.json` AND the plan's "Pinned versions" table in the same commit. A silent substitution is a Principle VIII plan-amendment failure.

**Outcome**: `"@faker-js/faker": "9.2.0"`. Closes FR-020.
