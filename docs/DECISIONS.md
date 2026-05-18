# Serenify — Decisions Log

Append-only per Constitution Principle VIII. Reversals are added as new
entries that reference the original.

---

## 2026-05-17 — Branching pattern: canonical SpecKit long-lived feature branches

**Status**: Accepted.

**Decision**: Each SpecKit feature gets its own long-lived branch
(`001-auth-and-roles`, `002-demo-seed-data`, …). The branch lives from
`/speckit.specify` through `/speckit.implement` and the manual smoke
test, and is merged to `main` only after Mohamed signs off.

**Rationale**: One feature, one branch keeps `main` clean and gives a
natural review boundary. The provisional feature ordering in the
constitution (§ Spec-Driven Workflow) becomes the merge ordering.

**One-time exception**: Feature 001's `spec.md` was merged to `main`
early during Session 1 before this decision was made. Continuing work
on 001 happens on a re-cut branch from `main`.

---

## 2026-05-17 — Package manager: npm with workspaces

**Status**: Accepted.

**Decision**: `npm` with workspaces. The repo-root `package.json`
declares `workspaces: ["apps/*", "packages/*"]`; per-app commands run
via `npm run <script> --workspace=apps/web`.

**Rationale**: Team familiarity. npm workspaces are adequate for the
monorepo scope and avoid pnpm's strict dependency resolution surprises
during early development.

**Revisit if**: install time or disk usage becomes painful, or if a
phantom-dependency issue bites us.

---

## 2026-05-17 — Repo layout: supabase/ at repo root (outside apps/web/)

**Status**: Accepted.

**Decision**: The Supabase CLI's `migrations/`, `config.toml`, and
`snippets/` live at `serenify/supabase/`, not under `apps/web/supabase/`.

**Rationale**: The schema will be shared between Next.js (feature 001)
and the FastAPI backend (feature 005). Co-locating with `apps/web/`
would force feature 005 to either move the directory or reach across
the workspace. The root location is also the Supabase CLI default.

---

## 2026-05-17 — Privileged column updates via SECURITY DEFINER functions

**Status**: Accepted.

**Decision**: `profiles.role` and `profiles.manager_id` are NEVER
updateable through the row-owner RLS policy. The only legitimate write
paths are the two SECURITY DEFINER functions `public.admin_update_role`
and `public.admin_update_manager`, each of which re-verifies
`is_admin()` inside Postgres.

**Rationale**: Postgres RLS is row-not-column. There is no first-class
way to allow admins to UPDATE only those two columns while letting
row-owners UPDATE other fields. SECURITY DEFINER functions are the
standard escape valve and concentrate every privileged change in two
named SQL definitions — easier to audit than a blanket admin UPDATE
policy that would also let admins overwrite any user's `full_name`.

**Implementation note**: The route handler `POST /api/admin/invite`
calls the SECURITY DEFINER RPCs via the CALLER's session client (not
the service-role client) so `auth.uid()` inside `is_admin()` resolves
to the verified admin user. Calling via the service-role client would
return NULL `auth.uid()` and be rejected.

---

## 2026-05-17 — Next.js 16 (not 15) for apps/web

**Status**: Accepted (deviation from plan).

**Decision**: `apps/web/` runs on Next.js 16.2.6 (whatever
`create-next-app@latest` installs), not the Next.js 15 the plan
referenced.

**Rationale**: `tasks.md` T001 literally specifies
`npx create-next-app@latest`, which currently produces a Next 16
project. The two notable Next 16 deltas this feature touches:

- `cookies()` from `next/headers` is async — already async in Next 15,
  no real change.
- `middleware.ts` is deprecated and renamed to `proxy.ts` (function
  export `proxy` instead of `middleware`). We use `proxy.ts`.

Both are documented in
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.

**Revisit if**: Vercel deploy or any downstream feature has a Next-16
incompatibility we cannot work around.

---

## 2026-05-17 — Vitest env is happy-dom, config is .mts

**Status**: Accepted (deviation from plan).

**Decision**: `apps/web/vitest.config.mts` (note `.mts`, not `.ts`)
uses `environment: "happy-dom"`, not `jsdom` as the plan and task list
suggested.

**Rationale**:

- The Vitest CommonJS config loader chokes on `std-env` (ESM-only).
  `.mts` forces Node to load the config as ESM.
- `jsdom` transitively requires `@csstools/css-calc` which is ESM-only.
  Node 22.11 cannot `require()` ESM modules (native `require(esm)`
  landed in 22.12). `happy-dom` has a cleaner dep tree and is the
  canonical workaround.

**Revisit if**: a test ever needs a behaviour `happy-dom` doesn't
support (none in feature 001).

---

## 2026-05-17 — shadcn/ui not pulled in feature 001

**Status**: Accepted (deviation from plan).

**Decision**: Feature 001 ships the auth surface without installing
`shadcn/ui` primitives. Form inputs and buttons are bespoke React
components styled with Tailwind utilities against the locked
Mist & Meadow tokens.

**Rationale**: Installing the shadcn registry for three text inputs
and one button is overkill, and the default shadcn card aesthetic
fights the editorial-calm direction chosen for the auth shell (page IS
the surface — no card chrome). The plan's actual contract — calm
voice, locked palette, amber-not-red error accent, Lucide icons — is
honored without shadcn.

**Revisit when**: feature 003 (employee dashboard shell) or later lands
and we have enough UI to standardize a primitives layer.

---

## 2026-05-17 — Playwright workers serialized (workers: 1)

**Status**: Accepted.

**Decision**: `playwright.config.ts` sets `workers: 1` so all e2e specs
across all browser projects run serially against the local Supabase.

**Rationale**: Specs share a single Supabase instance and a seeded
test admin. Parallel runs raced on user-creation, login state, and the
admin role bit. Sequencing eliminates the races without needing
per-spec database isolation. 12 specs across chromium/firefox/webkit
complete in ~90 s — fast enough.

**Revisit if**: the suite grows past ~30 specs, at which point
per-spec database namespacing (e.g., schema-per-worker) becomes worth
the complexity.

---

## 2026-05-17 — npm audit: postcss XSS advisory ignored

**Status**: Accepted (no action).

**Decision**: GHSA-qx2v-qp2m-jg93 (PostCSS XSS via CSS Stringify with </style>) is a transitive dependency of Next.js. The recommended `npm audit fix --force` downgrades Next to 9.3.3, which is not viable. The vulnerability requires stringifying untrusted CSS input, which is not a code path the Serenify app exercises — PostCSS runs only at build time on first-party CSS files in this project.

**Revisit when**: a new Next.js major version is adopted (re-run `npm audit` and re-triage); or if the app ever processes user-supplied CSS at runtime (which is not on any roadmap).

---

## 2026-05-18 — TypeScript runner for repo-root scripts: `tsx` 4.19.2 (exact pin)

**Status**: Accepted.

**Decision**: `scripts/seed-demo.ts` and any future repo-root TypeScript
tooling are executed via `tsx`, pinned exactly to `4.19.2` in
`package.json`.

**Rationale**:

- `tsx` is ESM-first, zero-config, and uses esbuild internally — no
  separate build step, no `dist/` artifact to remember to rebuild.
- Trade-off vs. `ts-node`: more `node_modules` weight, but no
  ESM-loader-flag rituals (`--loader ts-node/esm`) that have been a
  recurring source of toolchain confusion.
- Trade-off vs. a dedicated esbuild build step: one extra dev
  dependency, but no "did you rebuild?" footgun for a casual fixture
  script developers run rarely.
- Exact pin (no caret/tilde) because `tsx` is part of the deterministic
  toolchain — a major bump could shift ESM path resolution and break
  reproducibility across machines.

**Revisit if**: Node ships a native TS loader that subsumes this niche,
or if a CI environment introduces an `tsx`-incompatible Node flag.

---

## 2026-05-18 — Playwright orphan-profile sweep removed

**Status**: Accepted.

**Decision**: `apps/web/tests/e2e/setup/global-setup.ts` no longer
deletes orphan `public.profiles` rows. The "belt-and-braces" sweep that
ran `admin.from("profiles").delete().gte("created_at", "1970-01-01")`
is removed entirely.

**Rationale**:

- Once the upstream `auth.users` deletion in the same file became
  pattern-scoped to `@example.com` (FR-019 of feature 002), the
  unscoped orphan sweep would actively destroy demo profile rows whose
  `auth.users` parents survive — breaking FR-008 idempotency on the
  first e2e run after `npm run seed`.
- The FK constraint `profiles.id REFERENCES auth.users(id) ON DELETE
  CASCADE` already guarantees orphan profile rows cannot exist:
  `auth.users` delete cascades to `profiles`; an `INSERT INTO profiles`
  without a matching `auth.users` row fails the FK constraint.
- The sweep was a no-op when working as intended (no orphans to
  delete) and is destructive after FR-019. Removing is simpler than
  pattern-scoping the sweep against the same FK contract.

**Revisit when**: the FK is ever dropped (it should not be); the
canonical orphan-prevention contract is the FK itself.

---

## 2026-05-18 — Demo email format: `<first>.<last>.<NN>@demo.serenify.local`

**Status**: Accepted.

**Decision**: All seeded demo users in `scripts/seed-demo.ts` (and any
future seed work that extends this script — e.g., the deferred
signal-event seeding immediately before feature 011) follow the email
format:

```
<normalize(first)>.<normalize(last)>.<NN>@demo.serenify.local
```

- `normalize(s)` = `s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "")`
- `NN` = the 2-digit slot index, `01..30` (in this cohort).

**Rationale**:

- The trailing slot suffix makes email uniqueness independent of
  faker name collisions. The cohort's determinism guarantee (FR-007 /
  SC-005) is unconditional — 30 distinct emails for 30 slots,
  regardless of whether faker happens to emit two identical
  `(first, last)` pairs at the current pin.
- Diacritic stripping prevents non-ASCII characters in the local part
  (faker's `en_GB`/`en_IE` corpora occasionally produce them).
- The `.local` TLD is RFC 6762 reserved (Multicast DNS) and is not
  deliverable on the public internet — by design, no demo account can
  receive mail.

**Future cohorts** (beyond the 30-user demo) MUST keep the same
`<name>.<NN>@<cohort-suffix>.serenify.local` shape and swap only the
cohort suffix (never the slot suffix). The pattern is the single
authority used to detect cohort membership across the seed's idempotent,
reset, and Playwright-coexistence paths.

**Revisit if**: a cohort needs more than 99 members (slot index width
would need to grow from 2 digits to 3); or if a real domain ever
collides with `demo.serenify.local` (currently impossible per RFC 6762).

---

## 2026-05-18 — Windows npm CLI flag passthrough fallback

**Status**: Accepted.

**Context**: On Windows PowerShell, `npm.ps1` strips flags passed after
the `--` separator (e.g. `npm run seed -- --remote`) before reaching
the underlying script. This is a long-standing npm-on-Windows behaviour,
not a bug in our code. Bash/zsh on macOS/Linux do not have this issue.
Smoke test ST-7a (feature 002) caught the divergence — the script
silently targeted LOCAL with exit 0 instead of failing fast with exit 1.

**Decision**: `scripts/lib/env.ts`'s argv parser also reads
`process.env.npm_config_<flagname>` as a fallback. npm sets these
env vars for any unrecognised flag, so `npm run seed -- --remote`
on Windows leaves `npm_config_remote=true` in the env even after
stripping the flag. The parser treats either signal (argv or env)
as equivalent. Defensive check: only the literal string `"true"`
triggers the fallback, so `npm_config_remote=1` or stale shell
exports of other values cannot accidentally arm the remote path.

**Consequence**: The `--remote` flag works identically across
platforms via `npm run seed -- --remote`. Direct invocation
(`npx tsx scripts/seed-demo.ts --remote`) bypasses npm entirely and
relies on argv parsing alone — also works on all platforms. The same
fallback is wired for `--reset` so the cross-platform behaviour is
consistent across both flags.

**Revisit if**: npm ever ships a Windows release that stops stripping
`--`-separated flags, OR a future contributor adds a new CLI flag to
`scripts/seed-demo.ts` — the same env-var fallback must be wired for
that flag.
