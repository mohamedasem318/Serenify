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

## 2026-05-20 — FR-042 scope clarification: red permitted on destructive action surfaces only

**Status**: Accepted (constitutional amendment, MINOR bump `1.0.0 → 1.1.0`).

**Decision**: Added `crimson` token to Mist & Meadow (`#7B4244` light,
`#C17F81` dark). Replaces the earlier amber mapping for
`--destructive` that originated from a contract pre-authorized fix
later proven WCAG-noncompliant in dark mode (`#DCB587` amber +
`#DCDED5` dark-ink = 1.4:1, fails AA). Crimson + bg-as-foreground
passes AA in both modes (6.08:1 light, 5.02:1 dark). Constitution
Principle V amended in same commit; CHANGELOG records the
amendment.

**Source tasks**: T017 (mapping), T019 (button emission triggered the
contrast discovery).

**Revisit if**: a future palette overhaul re-tones amber such that
amber + ink achieves AA in both modes — at which point the crimson
token may be folded back if destructive-action urgency can be
adequately signalled by amber without ambiguity against stress
indicators.

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

---

## 2026-05-21 — `.claude/` tooling tracked in git; per-user files ignored individually

**Status**: Accepted (rule correction from earlier `d4621fe`).

**Context**: spec-kit v0.8.12's Claude integration installs the
`/speckit.<command>` surface as **Claude Code Skills**, not as slash-
command files. Specifically, its `SkillsIntegration` writer uses
`commands_subdir="skills"` and emits 14 files at
`.claude/skills/speckit-<command>/SKILL.md` (one per command:
`speckit-analyze`, `speckit-checklist`, `speckit-clarify`,
`speckit-constitution`, `speckit-git-commit`,
`speckit-git-feature`, `speckit-git-initialize`,
`speckit-git-remote`, `speckit-git-validate`, `speckit-implement`,
`speckit-plan`, `speckit-specify`, `speckit-tasks`,
`speckit-taskstoissues`). These files MUST be tracked in git —
without them, none of the `/speckit.<command>` invocations dispatch
through the Skill tool inside a Claude Code session and the
spec-driven workflow silently degrades to plain LLM responses.

**How it broke**: `d4621fe` (feat 001 auth) added `.claude/` to
`.gitignore` under the heuristic "Claude Code local settings — per-
user, never commit". That broad rule retroactively swept the 14
`SKILL.md` files installed by `f2102c8` (chore: initialize
spec-kit) into being untracked, then they were never recommitted.
For multiple weeks across features 001, 002, and the early phases of
003, the four spec-kit slash commands appeared to "work" inside a
single session (the model has the speckit prompts in its head and
can fake the output) but no skill machinery actually ran — no
Skill-tool dispatch, no skill-specific permissioning, no
checkpointed sub-invocation. The degradation surfaced during
feature 003 Phase 5 when `/speckit.implement` did not produce the
expected skill announcement and skill-tool call in the transcript.

**Fix**: chore branch `chore/speckit-command-registration` (commit
`7a7beff`, merged to `main` via PR #3 at commit `68b7d47`).

- Restored the 14 `.claude/skills/speckit-*/SKILL.md` files from
  `f2102c8` byte-for-byte (the spec-kit installer had not changed
  the file contents in the v0.8.12 → v0.8.12 timeframe, so the
  restoration was a clean revert of the unintended sweep, not a
  re-install).
- Narrowed `.gitignore`: removed the broad `.claude/` entry,
  replaced with `.claude/settings.local.json` (the one file
  legitimately classified as per-user — it holds permission
  decisions that vary by developer).

Verification: post-merge, a fresh Claude Code session in this repo
sees all 14 speckit Skills in the user-invocable list; typing
`/speckit.implement` triggers the Skill tool and dispatches the
`speckit-implement` skill body. Confirmed during the Phase 5
resume that produced commits `c51ee67` through `309e78d`.

**Rule going forward**:

- `.claude/` is **not** broadly gitignored. The default state for
  any file under `.claude/` is **tracked**.
- Per-user files inside `.claude/` are ignored **individually** by
  full path. Today that list is one entry:
  `.claude/settings.local.json`. Future additions (if Claude Code
  ever ships a second per-user file under that tree) are added by
  their exact path, not by a folder wildcard.
- Tooling installed under `.claude/` by integrations (skills today;
  potentially commands/agents in future spec-kit or Claude Code
  releases) is treated as **repo-shared infrastructure** and stays
  tracked. The "this is local-only" instinct is wrong for anything
  that affects how teammates interact with the codebase.
- Any future PR that proposes broadening `.claude/` exclusion in
  `.gitignore` MUST first enumerate which tracked files would be
  swept and justify each exclusion individually.

**Revisit when**: spec-kit (or any other Claude Code integration)
adds a file under `.claude/` that genuinely IS per-user and
shouldn't be shared. Add that file by its exact path to
`.gitignore`; don't reach for a broader pattern. If the
per-user files start to outnumber the tracked ones, revisit
whether the integration should be writing to a `.claude/local/`
sub-directory by convention instead.

---

## 2026-05-25 — feature 003 architecture decisions (collected; 📌 DECISION-1 through DECISION-11 + FR-020 amendment)

This block collects the architectural decisions that shaped feature
003 (employee-dashboard-shell). Source tasks are named per entry;
each is traceable to a 📌 marker in
`specs/003-employee-dashboard-shell/tasks.md`. Where the as-built
state diverges from the plan-time intent, an **Amendment** subhead
records the divergence and points at the relevant CHANGELOG entry.

---

## 2026-05-25 — shadcn/ui on Tailwind v4 path; manual init substituted (📌 DECISION-1)

**Status**: Accepted (plan amendment recorded in CHANGELOG
2026-05-20).

**Decision**: `apps/web/` adopts shadcn/ui on the Tailwind v4 path:
CSS-vars mode, baseColor `neutral` (overridden by the Decision B
mapping), shadcn primitives vendor-pasted into
`apps/web/components/ui/`. Seven primitives in scope: `button`,
`card`, `dropdown-menu`, `sheet`, `dialog`, `avatar`, `separator`.

**Amendment — manual init substituted for `shadcn@latest init`**:
shadcn CLI 4.7.0's `--preset=base-nova` default bundles changes
that violate Constitution V (Inter→Geist font swap), FR-042 (red
`--destructive`), and Decision B's mapping intent (an oklch
palette overriding Mist & Meadow). For this feature and any future
re-init, the workflow is **manual**: hand-author `components.json`
(Decision E shape) + `lib/utils.ts`, `npm i -D` the dep list
(`class-variance-authority`, `clsx`, `tailwind-merge`,
`tw-animate-css`, `@radix-ui/react-slot`), then use
`npx shadcn@latest add <primitive>` per primitive. `shadcn add`
reads `components.json` for paths and writes to `components/ui/`
without touching `layout.tsx` or palette CSS.

**Rationale**: shadcn primitives give the dashboard a standardized
control library while preserving Mist & Meadow tokens, calm-voice
copy, and FR-042 scope. The manual init bypass keeps the calm
direction protected from upstream preset drift without sacrificing
the per-primitive `shadcn add` workflow.

**Source tasks**: T015 (init), T016 (components.json), T019 (add
primitives).

**Revisit when**: shadcn defaults realign with Decision A/B/E
target shape — at which point the `init` step can be restored.
Until then, manual init binds.

---

## 2026-05-25 — shadcn variable names mapped to Mist & Meadow tokens (📌 DECISION-2)

**Status**: Accepted (with two CHANGELOG amendments —
2026-05-20 prefix correction and 2026-05-20 FR-042 scope
clarification).

**Decision**: shadcn primitives consume Mist & Meadow tokens via
an `@theme inline` mapping block in `apps/web/app/globals.css`.
19-row mapping table from
`specs/003-employee-dashboard-shell/contracts/shadcn-mapping.md`
is the contract. The `--color-*` and `--radius-*` prefixes are
**load-bearing** — Tailwind v4 generates utility classes (e.g.
`bg-primary`, `rounded-md`) only from tokens with these prefixes.

| shadcn variable | Mist & Meadow token (light) | (dark) |
|---|---|---|
| `--color-background` | `--color-bg` (`#ECEEE9`) | `--color-bg` (`#161917`) |
| `--color-foreground` | `--color-ink` (`#1F2522`) | `--color-ink` (`#DCDED5`) |
| `--color-card` | `--color-surface` (`#F5F6F2`) | `--color-surface` (`#20231F`) |
| `--color-card-foreground` | `--color-ink` | `--color-ink` |
| `--color-popover` | `--color-surface` | `--color-surface` |
| `--color-popover-foreground` | `--color-ink` | `--color-ink` |
| `--color-primary` | `--color-meadow` (`#7A9275`) | `--color-meadow` (`#97AE91`) |
| `--color-primary-foreground` | `--color-bg` | `--color-bg` |
| `--color-secondary` | `--color-foggy` (`#8AA9B6`) | `--color-foggy` (`#9CBBC7`) |
| `--color-secondary-foreground` | `--color-ink` | `--color-ink` |
| `--color-muted` | *(not remapped — inherits M&M `#6E7572`)* | *(inherits `#8B928F`)* |
| `--color-muted-foreground` | `--color-muted` | `--color-muted` |
| `--color-accent` | `--color-foggy` | `--color-foggy` |
| `--color-accent-foreground` | `--color-ink` | `--color-ink` |
| `--color-destructive` | `--color-crimson` (`#7B4244`) | `--color-crimson` (`#C17F81`) |
| `--color-destructive-foreground` | `--color-bg` | `--color-bg` |
| `--color-border` | `--color-border` | `--color-border` |
| `--color-input` | `--color-border` | `--color-border` |
| `--color-ring` | `--color-meadow` | `--color-meadow` |

Plus the 7-step radius ladder (per CHANGELOG 2026-05-20 prefix
correction): `--radius-sm` 6px, `--radius-md`
`var(--radius-control)` 8px, `--radius-lg` `var(--radius-card)`
12px, `--radius-xl` 16px, `--radius-2xl` 20px, `--radius-3xl`
24px, `--radius-4xl` 28px. The single `--radius` line
declared in T017 had to grow to a 7-step ladder because Tailwind
v4 generates `rounded-{sm,md,lg,xl,2xl,3xl,4xl}` only from
`--radius-*`-prefixed tokens.

**Three load-bearing choices**:

- `--color-destructive → --color-crimson` + `--color-destructive-foreground → --color-bg`. FR-042 scope-clarified
  per CHANGELOG 2026-05-20 and DECISIONS 2026-05-20 (crimson
  permitted on destructive action surfaces only). The earlier
  amber mapping failed dark-mode WCAG AA at 1.4:1.
- `--color-muted` intentionally NOT remapped. The original draft
  `--muted → --color-surface` collided with M&M's own
  `--color-muted` (the gray-text token consumed by `text-muted`)
  and washed out every auth-page muted-text site because Tailwind
  v4's `@theme inline` inlines the resolved value into the
  `.text-muted` utility at compile time.
- `--color-primary-foreground → --color-bg` symmetric across both
  modes. The originally-asymmetric `--color-ink` in dark mode
  failed WCAG AA at ~3.1:1 against meadow; the symmetric mapping
  is the only AA-compliant choice. Same WCAG-AA pattern as
  `--color-destructive-foreground`.

**Amendment — `--color-*` prefix correction (CHANGELOG
2026-05-20)**: an earlier unprefixed shape (`--background`,
`--destructive`, …) registered the variables to `:root` but
produced NO utility classes, leaving shadcn primitives unstyled.
All 19 mapping rows renamed to `--color-*`; 7-step radius ladder
added in the same commit. Authoritative reference: shadcn
4.7.0's own `init` emission used the same `--color-*` shape
before the rollback in 89995aa.

**Source tasks**: T017 (mapping block), T020 (computed-style
verification probes).

**Revisit if**: a future palette overhaul re-tones amber such
that amber + ink achieves AA in both modes (folding crimson
back becomes possible), OR shadcn ships a primitive that
references a CSS variable not in the 19-row table.

---

## 2026-05-25 — Dark-mode attribute: `data-theme` → `class` + `serenify-theme` storage key (📌 DECISION-3)

**Status**: Accepted.

**Decision**: `next-themes` is reconfigured from
`attribute="data-theme"` to `attribute="class"` so the
`.dark` selector matches shadcn primitives' contract. The
localStorage key is namespaced from `theme` to
`serenify-theme` so origin-shared localStorage with unrelated
apps doesn't collide.

  - `apps/web/app/providers.tsx`: `attribute="class"`,
    `storageKey="serenify-theme"`. Other props
    (`defaultTheme="system"`, `enableSystem`,
    `disableTransitionOnChange`) unchanged.
  - `apps/web/app/globals.css`: dark-mode override block selector
    changed from `:root[data-theme="dark"]` to `:root.dark`.
    Block contents (color overrides) unchanged. Mist & Meadow
    tokens stay verbatim.

A migration shim runs at `<head>` of the root layout to
populate `serenify-theme` from a legacy `theme` key on first
load (see T014 entry in
`specs/003-employee-dashboard-shell/smoke-tests.md` for the
discovery + four-scenario verification matrix). Without the
shim, users with a stored `theme: "dark"` preference flashed to
light on first load after the migration.

**Source tasks**: T011 (providers.tsx), T012 (globals.css),
T014 (manual verification + migration shim resolution at
`a5d89b3` + `073bdaf`).

**Revisit if**: next-themes ever exposes a single API for
namespaced storage that supplants the manual shim.

---

## 2026-05-25 — Component folder convention: bespoke under `components/ui/auth/`, shadcn flat in `components/ui/`, composite outside `ui/` (📌 DECISION-4)

**Status**: Accepted.

**Decision**: Three tiers of component organization:

  - `apps/web/components/ui/` — shadcn primitives only. shadcn's
    `add` command writes here. Files: button.tsx, card.tsx,
    dropdown-menu.tsx, sheet.tsx, dialog.tsx, avatar.tsx,
    separator.tsx.
  - `apps/web/components/ui/auth/` — bespoke auth primitives
    (`Field`, `PasswordInput`, `PasswordRequirements`,
    `OtpPanel`). shadcn does NOT touch this subfolder. FR-040
    contract: the (auth) page files render byte-equivalent to
    `main` after the extraction sweep.
  - `apps/web/components/<feature>/` — composite/feature-scoped
    components (header/, account/, home/, role-placeholder/).
    Not under `ui/` because they consume primitives rather
    than being primitives themselves.

Cross-tab listener at `apps/web/components/cross-tab-auth.tsx`
sits under `components/` (not `app/`) so `app/` stays
route-only (medium-fix-14 from plan-review).

**Source tasks**: T004–T009 (extraction sweep), T019 (shadcn
add primitives flat into `components/ui/`).

**Revisit if**: a future feature blurs the
primitive-vs-composite line in a way the three-tier
convention can't accommodate.

---

## 2026-05-25 — Notification component built on Radix Dialog + Framer Motion (NOT Sonner) (📌 DECISION-5)

**Status**: Accepted.

**Decision**: `apps/web/components/notification.tsx` composes
Radix Dialog (already added via `shadcn add dialog`) + Framer
Motion + `useMediaQuery`. Two layout variants driven by
viewport:

  - Desktop (≥768px): bottom-right slide-in card positioned at
    `bottom: calc(1rem + var(--chat-pill-offset, 0px) + 1rem); right: 1rem;`
    per Decision H stacking convention.
  - Mobile (≤768px): full-width bottom sheet.

Framer Motion's `useReducedMotion()` hook is the **React-state
gate** that collapses both variants to opacity-only on OS-level
`prefers-reduced-motion: reduce`. The CSS rule in `globals.css`
lines 49-54 (`animation-duration: 0.01ms`) is the OS-backstop;
both paths must agree.

**Rationale for rejecting Sonner**: Sonner's toast paradigm
doesn't fit the desktop-slide-in / mobile-bottom-sheet
bifurcation FR-029 mandates. Radix Dialog + Framer gives both
variants from a shared composition without forcing a toast-style
overlay queue. The `useReducedMotion` hook is the canonical
reduced-motion gate for Framer because CSS-only animation
suppression doesn't reach Framer's React-state-driven variants.

**Source tasks**: T051 (component), T052 (three-config Vitest
suite), T053 (verify no production mount).

**Revisit if**: a future feature needs a toast-queue paradigm
(multiple stackable notifications) — Sonner becomes worth
revisiting at that point.

---

## 2026-05-25 — Notification component: explicit-dismiss only; no auto-dismiss (📌 DECISION-6)

**Status**: Accepted.

**Decision**: The notification component renders an explicit
dismiss control (close icon button) as its only close path. No
`autoHideDuration`, no `delay`, no timer-driven close. Consuming
features (007/008/010) MAY layer auto-dismiss on top by setting
their own `setTimeout` around the `open` state — the
notification component itself stays explicit-only.

**Rationale**: Affective surfaces should not vanish under a user
who is reading them. Calm-voice (Constitution Principle V) and
no-alarmism (FR-013, FR-052) imply notifications convey
information the user might dwell on. Auto-dismiss optimizes for
"clear the chrome" — which is the opposite UX value here. Future
consumers that need transient acknowledgement (e.g., "Saved.")
can opt into auto-dismiss explicitly; the default stays manual.

**Source tasks**: T051.

**Revisit if**: a consuming feature accumulates so many manual
dismissals that auto-dismiss becomes the de-facto pattern at the
call sites — at which point auto-dismiss may belong in the
component rather than per-caller.

---

## 2026-05-25 — Welcome banner subtitle: "A space to check in with yourself." (📌 DECISION-7)

**Status**: Accepted.

**Decision**: The static subtitle beneath the adaptive greeting
on `/app` for employees is locked to:

> A space to check in with yourself.

Mohamed-chosen from three candidates in the plan-review pass.
The single `<p>` slot beneath the greeting is the binding
surface; dynamic per-context subtitles are deferred to BACKLOG
(re-logged here against feature 003).

**Rationale**: Reflective framing pairs with every adaptive
greeting (morning/afternoon/evening) without context-switching
the user. Primes the eventual passive-detection + questionnaire
loop (features 005/007) — "checking in with yourself" is the
through-line the rest of the product builds on. Constitution
Principle V calm-voice: no exclamation marks, no clinical or
alarmist phrasing, supportive.

**Source tasks**: T040 (welcome-banner.tsx), T045 (test
coverage).

**Revisit if**: signal data (post-feature 005/006) supports
context-aware subtitle variants. The markup already
accommodates a future swap.

---

## 2026-05-25 — Cross-tab auth listener mount point: root layout, not (authed) layout (📌 DECISION-8)

**Status**: Accepted.

**Decision**: `CrossTabAuth` listener is mounted at
`apps/web/app/layout.tsx` (root layout) as a sibling of
`<Providers>`, NOT at `apps/web/app/(authed)/layout.tsx`. The
listener file itself lives at
`apps/web/components/cross-tab-auth.tsx` so `app/` stays
route-only (medium-fix-14).

**Rationale**: US 6 AS-1 contract — propagation must fire when
both tabs sit at `/login` (sign-in propagation) or `/signup`
(post-confirmation propagation). Both pathnames are OUTSIDE the
(authed) tree. Mounting under (authed) would only fire when at
least one tab is already inside the protected surface, breaking
the contract by half.

**Source tasks**: T059 (component), T060 (root-layout mount),
T061 (Vitest event×pathname matrix).

**Revisit if**: the root layout becomes a hot path for
something that conflicts with always-on subscription mounting
— at which point a pathname-conditional mount might be worth
the complexity.

---

## 2026-05-25 — Playwright cross-tab spec pattern: single context, two pages — driven by explicit broadcast helper (📌 DECISION-9, amended)

**Status**: Accepted (with CHANGELOG 2026-05-22 amendment — see
"Decision N amendment" below).

**Decision**: `apps/web/tests/e2e/cross-tab-auth-sync.spec.ts`
uses `browser.newContext()` + two `context.newPage()` instances
so localStorage is shared between the tabs. Sign-in driven via
the real `/login` form in pageA; sign-out driven via the
profile dropdown UI in pageA. NOT
`page.evaluate(client.auth.signOut())` — that would bypass the
broadcast call and the spec would silently miss the cross-tab
path.

`browser.newContext()` × 2 would NOT share localStorage and
the cross-tab path would never fire — locking the
single-context pattern as a contract.

**Amendment — explicit broadcast helper (CHANGELOG
2026-05-22)**: Decision N's plan-time mechanism assumed
`supabase.auth.onAuthStateChange`'s built-in cross-tab firing,
which relies on the session living in localStorage so the
`storage` event fires in sibling same-origin tabs. The actual
implementation uses `@supabase/ssr`'s `createBrowserClient`,
which stores the session in **cookies**, not localStorage —
no localStorage write happens on sign-in/sign-out, so no
`storage` event fires cross-tab.

Resolution: a tiny explicit broadcast helper at
`apps/web/lib/auth-broadcast.ts` (exports `broadcastSignIn`,
`broadcastSignOut`, `parseAuthBroadcast`, `AUTH_BROADCAST_KEY
= "serenify-auth-broadcast"`). Sign-in / sign-out callers
write a marker value to localStorage; sibling tabs receive
the `storage` event on that key and the `CrossTabAuth` listener
navigates per FR-046's pathname rules. The listener subscription
target shifts from `supabase.auth.onAuthStateChange` to
`window.addEventListener("storage", ...)`. Original Decision N
intent (single-context, real-UI-driven) is preserved; only the
underlying event source changes.

**Source tasks**: T062 (Playwright spec), 0e4637f
(refactor: Decision N amendment — explicit broadcast helper).

**Revisit if**: `@supabase/ssr` ever changes storage mode (or
ships a same-origin BroadcastChannel as a first-class API) —
at which point the explicit helper may collapse back to
listening on supabase-js events.

---

## 2026-05-25 — `framer-motion` added; `tw-animate-css` replaces `tailwindcss-animate` on Tailwind v4 (📌 DECISION-10)

**Status**: Accepted.

**Decision**: Two dependency deltas land with the shadcn install:

  - `framer-motion` added as a runtime dependency (caret pin) —
    drives the notification component's entrance/exit motion
    and respects `prefers-reduced-motion` via Framer's
    `useReducedMotion` hook (Decision G / DECISION-5 above).
  - `tw-animate-css` replaces `tailwindcss-animate` on the v4
    path. The shadcn Tailwind v4 doc names this swap explicitly:
    the older animation lib is deprecated on the v4 path.

**Source tasks**: T015 (shadcn init — adds
`tw-animate-css` + `class-variance-authority` + `clsx` +
`tailwind-merge`), T049 (`framer-motion` install).

**Revisit if**: an upstream Framer change breaks the
`useReducedMotion` contract, OR `tw-animate-css` gains a
deprecation notice in a future Tailwind release.

---

## 2026-05-25 — Chat-pill / notification stacking via `--chat-pill-offset` CSS variable (📌 DECISION-11)

**Status**: Accepted.

**Decision**: The chat pill writes its rendered height to
`<html>` on mount:

```js
document.documentElement.style.setProperty("--chat-pill-offset", "48px");
// on unmount: removeProperty("--chat-pill-offset")
```

The notification component reads it:

```css
bottom: calc(1rem + var(--chat-pill-offset, 0px) + 1rem);
```

On employee pages with the pill mounted, the math resolves to
`1rem + 48px + 1rem = 80px` — a 16px gap above the pill. On
manager pages (FR-035: no pill for team_lead/admin) the variable
is unset, the fallback `0px` kicks in, and the math collapses
to `2rem` — a 16px-from-edge fallback.

`apps/web/components/chat-pill.tsx` exports
`CHAT_PILL_HEIGHT = 48` so future surfaces auditing the math
can reference the canonical value. The runtime contract is
the CSS variable on `<html>` — consumers MUST read
`var(--chat-pill-offset, 0px)`, not import the constant.

**Source tasks**: T046 (chat-pill writes), T051 (notification
reads).

**Revisit if**: a future feature needs to stack a third
floating surface (e.g., recording indicator, screen-share
banner). At that point the single offset variable may want
to grow into a stacking convention with multiple named offsets
(e.g., `--surface-offset-bottom-1`, `--surface-offset-bottom-2`)
so consumers can compose more than two stacked items
deterministically.

---

## 2026-05-25 — FR-020 amendment: inline change-password form on /app/account (CHANGELOG 2026-05-21)

**Status**: Accepted (spec amendment via CHANGELOG; supersedes
T034's original link-to-/forgot-password design).

**Decision**: The Security section of `/app/account` is an
**inline change-password form**, not a link out to
`/forgot-password`. Three fields (current password, new
password, confirm new password) submit to a new
`changePassword` Server Action that:

  1. Verifies current password by calling
     `supabase.auth.signInWithPassword({ email, password })`
     against a **throwaway anon client** (no session rotation
     for the user's existing cookies).
  2. Updates new password via
     `supabase.auth.updateUser({ password: newPassword })` on
     the SSR client.
  3. Returns `{ status: "ok" } | { status: "invalid"; message: string }`.

Validation: Zod schema mirrors feature 001's
`signUpSchema` rules (min 8, contains a letter, contains a
number) on the new password field plus a `refine()` asserting
`confirm === new_password`. Calm-voice messages, no Zod regex
sources surfaced to the UI. Live `<PasswordRequirements>`
checklist reused from `@/components/ui/auth`.

**Why the original design failed**: T034's "Change password →
/forgot-password" link bounced the user back to `/app` —
feature 001's (auth) route guard in `proxy.ts` correctly
redirects already-signed-in users off the /forgot-password
page (signed-in users can't request a reset they don't need).
Routing an authenticated user through a signed-out reset flow
is self-contradictory by design. Phase 6 manual smoke (T039)
surfaced this; the amendment narrows the **authenticated**
change-password path to its own surface, leaving
/forgot-password intact for signed-out password recovery.

**Affected artifacts** (per CHANGELOG 2026-05-21 + commit
3121721):

  - `apps/web/app/(authed)/app/account/actions.ts` — adds
    `changePassword` Server Action alongside `updateProfile`.
  - `apps/web/components/account/security-section.tsx` —
    rewritten from server component (Link) to client component
    (inline form with react-hook-form + zodResolver +
    useTransition, matching ProfileSection's pattern).
  - `apps/web/components/account/security-section.test.tsx`
    — test shape rewritten; coverage added for changePassword
    failure modes.
  - `apps/web/lib/auth/schemas.ts` — `changePasswordSchema`
    added.

**Source task**: T034 original; 3121721 amendment commit. The
T034 description in `tasks.md` is preserved in its original
form (per Constitution Principle VIII: spec amendments live in
CHANGELOG, not in retroactive edits to the spec/task file).

**Revisit if**: Supabase ever exposes a session-preserving
`verifyPassword(currentPassword)` RPC — at which point the
throwaway-anon-client verification step can collapse into a
direct check.

---

## 2026-05-25 — Security slice 1: RLS + SECURITY DEFINER hardening decisions

**Status**: Accepted.

**Context**: The slice-1 audit
(`docs/security/01-rls-and-security-definer.md`) surfaced 2 med + 5 low
findings on the `public.profiles` authorization model. The fix pass landed
them in one migration
(`supabase/migrations/20260525000000_security_hardening_slice_1.sql`, commit
`b4e5e70`). These are the policy choices that fix pass codifies.

**Decision**:

1. **Last-admin guard scope — last-admin-only, not a blanket
   self-demotion block.** `admin_update_role` rejects a role change only
   when it would leave *zero* admins globally (checked after the UPDATE; the
   RAISE rolls it back). An admin demoting *themselves* is allowed as long as
   another admin remains.
   *Rationale*: a multi-admin org legitimately may have admin A step down
   while B continues. Only the zero-admin lockout is the actual hazard
   (no in-app recovery path — every admin gate evaluates false), so that is
   the only case worth blocking. Blocking all self-demotion would forbid a
   legitimate, recoverable operation.

2. **`reports_under()` deferred design — EXECUTE revoked from every role
   until the first consumer lands.** The function stays defined (forward
   contract for features 005/010/011) but is callable only by its owner
   (`postgres`). The migration that introduces the first consumer MUST,
   deliberately and in that migration: (a) choose SECURITY DEFINER vs
   INVOKER, (b) pin `search_path`, (c) add a scope guard (`is_admin()` or an
   own-subtree check), and (d) re-grant EXECUTE to the intended role(s), and
   document the chosen posture.
   *Rationale*: today's INVOKER + RLS-filtered behavior is a future-correctness
   footgun (`reports_under(me)` returns empty for a team_lead under RLS).
   Forcing the adopting feature to make the DEFINER/scope decision explicitly,
   at the point a real consumer exists, is safer than shipping a
   PostgREST-callable function with no consumer and an ambiguous posture.

3. **REVOKE the unauthenticated audience as the default posture for
   SECURITY DEFINER functions in `public`.** Privileged DEFINER entry points
   should not be executable by anonymous callers. Future privileged RPCs
   inherit this: revoke PUBLIC *and* the explicit `anon` grant unless the
   function is referenced by an RLS policy (see 6).
   *Rationale*: defense-in-depth / attack-surface reduction — a future
   refactor that reorders a guard or flips DEFINER↔INVOKER should not silently
   inherit a broader audience than intended.

4. **Column-grant whitelist on `public.profiles` — whitelist, not
   blacklist.** Row-owner UPDATE is granted to specific columns
   (`full_name` today) via `REVOKE UPDATE … FROM authenticated; GRANT UPDATE
   (full_name) … TO authenticated`. Future migrations adding a
   row-owner-editable column MUST explicitly `GRANT UPDATE (col) ON
   public.profiles TO authenticated`. Trigger-managed columns (`updated_at`)
   need no grant — a BEFORE-UPDATE trigger's assignment to `NEW` is not
   column-privilege-checked against the invoking role (empirically verified
   with a role holding only `UPDATE(full_name)`). Admin-managed columns
   (`role`, `manager_id`) need no grant — they are written only by the
   SECURITY DEFINER RPCs running as `postgres`.
   *Rationale*: explicit > implicit. The whitelist failure mode (forgot to
   grant → a user can't edit their own field → fix forward) is far safer than
   the symmetric blacklist failure mode (forgot to revoke → security gap).
   This replaces the audit's first-proposed `REVOKE UPDATE (role,
   manager_id) … FROM authenticated`, which is a no-op while the role holds
   table-level UPDATE.

5. **Supabase grant semantics — `REVOKE … FROM PUBLIC` alone is
   insufficient.** Supabase grants EXECUTE (and table DML) explicitly per
   role (`anon`, `authenticated`, `service_role`) via `ALTER DEFAULT
   PRIVILEGES`, in addition to the built-in PUBLIC grant. A bare `REVOKE …
   FROM PUBLIC` removes only the pseudo-grant and leaves the explicit `anon`
   grant intact. Future grant-tightening migrations MUST enumerate the
   explicit per-role revokes and verify the post-state with `pg_proc.proacl`
   (functions) / `has_column_privilege` (columns) rather than reasoning from
   the migration source.
   *Rationale*: this slice surfaced a systemic gap — static SQL audits that
   reason from migration text miss Supabase-specific grant semantics. Both
   F3/F6 (function EXECUTE) and F4 (column UPDATE) approved SQL were no-ops
   for this reason; only empirical verification caught it.

6. **`is_admin()` anon-grant invariant.** Functions referenced by an RLS
   policy expression MUST remain executable by the role that evaluates the
   query — `anon` for unauthenticated requests, `authenticated` for
   signed-in. `is_admin()` is called from the `profiles_select_admin` policy,
   so its `anon`/`authenticated` EXECUTE grants are RETAINED; only PUBLIC is
   revoked.
   *Rationale*: revoking either grant on `is_admin()` would surface as
   `permission_denied` *during RLS evaluation* (a hard error on every
   affected query) rather than as empty result sets. Treat as load-bearing
   for any future migration that touches `is_admin` grants.

**Revisit if**: a future feature needs an admin-set floor other than ≥1
(choice 1); a consumer adopts `reports_under()` and must record its chosen
posture here (choice 2); or Supabase changes its default-privilege grant
model such that `REVOKE … FROM PUBLIC` becomes sufficient on its own
(choices 5/6).

---

## 2026-05-25 — Security slice 2: auth flows + cookies + open-redirect + config hardening

**Status**: Accepted.

**Context**: The slice-2 audit
(`docs/security/02-auth-cookies-broadcast.md`) surfaced 1 med + 7 low findings
across the application-layer auth surfaces (auth-completing Server Actions and
Route Handlers, the cross-tab broadcast plumbing, every app-set cookie, the
`?next=` open-redirect surface, and the `[auth]` sections of `config.toml`).
The fix pass landed them across three commits (`68c41d3` open-redirect,
`188de88` cookies + config, `ede11d2` action hardening). These are the policy
choices that fix pass codifies.

**Decision**:

1. **`isSafeNextPath()` is the sole `next`-validator.** Any new auth-flow
   `next` consumer — additional `/auth/callback` variants, a future
   non-PKCE `token_hash` callback, magic-link paths, or any
   redirect-after-action pattern — MUST route the untrusted value through
   `apps/web/lib/auth/safe-next.ts` before constructing the redirect URL.
   *Rationale*: `NextResponse.redirect(`${origin}${next}`)` string
   concatenation is provably NOT same-origin-safe (slice-2 Finding 1: a
   bare `origin` with no trailing slash lets `next=@evil.com` break out via
   userinfo and `next=.evil.com` via subdomain extension). The current
   near-miss safety is *accidental* — the idiomatic refactor
   `new URL(next, origin)` would silently turn it into an
   immediately-exploitable open redirect. A single audited helper removes
   the per-entry-point regression surface that ad-hoc checks create.

2. **Cookie `Secure` policy — `secure: NODE_ENV === "production"` on all
   app-set cookies; `httpOnly: true` intentionally NOT applied.** The three
   `createServerClient` sites (`server.ts`, `proxy.ts`, `callback/route.ts`)
   pass `cookieOptions: { secure }`, and `AUTH_SIGNIN_COOKIE` carries the same
   flag. `httpOnly` is left at the `@supabase/ssr` default (`false`) on the
   `sb-*` session cookies and the signin marker because the browser client is
   constructed without a cookie adapter and reads `document.cookie` directly
   to hydrate the session — `httpOnly: true` would BREAK the browser client
   and all client-side auth calls. The XSS-token-theft exposure this leaves is
   mitigated by React auto-escaping (in force), short access-token TTL
   (`jwt_expiry=3600`), refresh-token rotation (on), and a future CSP (slice 5
   scope). A future reader MUST NOT "harden" these cookies to `httpOnly:true`.
   *Rationale*: empirically verified — the `@supabase/ssr` merge is
   `{ ...DEFAULT_COOKIE_OPTIONS, ...cookieOptions }`, so adding `secure` keeps
   `httpOnly:false`/`sameSite:lax`/`path:/`; and the full e2e matrix (which
   runs over `http://localhost` in dev, where the conditional yields
   `secure:false`) stays green, confirming the dev path is unaffected.

3. **Supabase `config.toml` posture aligned to production-grade defaults.**
   `max_frequency=60s` (Finding 4), `minimum_password_length=8` +
   `password_requirements=letters_digits` (Finding 6, matches the app Zod
   floor), and `secure_password_change=true` (Finding 7). Finding 7 was
   e2e-gated: it shipped as the **config change** (not an app-layer guard)
   because an empirical check proved a recovery-scoped session can
   `updateUser({password})` with no reauth nonce under
   `GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION=true` (recovery
   counts as recent authentication), and the account-page change-password e2e
   passes on all three browsers. So `secure_password_change=true` closes the
   stale-normal-session `/reset-password` bypass at the Supabase layer without
   breaking the recovery UX or the account-page flow.
   *Rationale*: `config.toml` is the reference operators copy from; leaving it
   lax creates intent drift even though the local dev environment alone is
   low-risk. **Applying `config.toml` `[auth]` changes requires
   `supabase stop && supabase start`** — `supabase db reset` re-runs
   migrations/seed but does NOT regenerate the auth container's env from
   `config.toml` (verified by `docker inspect` of the gotrue container env
   before/after). Future config-change verification must restart, not just
   reset.

4. **Cloud-dashboard parity for `config.toml` security changes (process
   note).** Production-effective Supabase config lives in the Cloud dashboard,
   not in the repo. Any security-relevant change to `supabase/config.toml`
   therefore requires a matching change applied manually in the dashboard. The
   slice-2 PR description carries the dashboard checklist (`max_frequency`,
   password requirements, secure password change, allowed redirect URLs);
   Mohamed applies it. Future security-relevant config changes MUST include the
   equivalent checklist in their PR.

**Revisit if**: a non-PKCE / unauthenticated `next` consumer is added (re-audit
choice 1 — it would escalate Finding 1 from med to high if it bypassed the
PKCE precondition); a CSP lands (slice 5) and changes the `httpOnly:false`
risk calculus (choice 2); Supabase changes gotrue's reauthentication-window
semantics such that recovery sessions stop counting as recent auth (choice 3);
or the Cloud project's config is ever moved into the repo (choice 4 becomes
moot).

---

## 2026-05-25 — Security slice 3: privileged endpoints + input validation

**Status**: Accepted.

**Context**: The slice-3 audit
(`docs/security/03-privileged-endpoints-and-input-validation.md`) surfaced 6 low
defense-in-depth / hygiene / consistency findings across the
`POST /api/admin/invite` Route Handler, the non-auth Server Actions, the
form-surface XSS sweep, and `full_name` end-to-end. No exploitable hole was
found; the privilege-relevant controls were verified empirically. The fix pass
landed the six approved fixes across three commits (`0ce67d4` invite handler,
`cbf26bd` completeOnboarding, `0f0bdc2` shared `fullNameSchema` + DB CHECK).
These are the policy choices that fix pass codifies.

**Decision**:

1. **Origin allowlist on privileged Route Handlers.** Next.js Server Actions get
   an automatic same-origin check from the framework (slice-2 relied on this for
   every auth mutation); **Route Handlers do not**. Every privileged Route
   Handler (`POST /api/admin/invite` today; any future admin-only API) MUST read
   `request.headers.get("origin")`, compare it against `process.env.SITE_URL`
   (falling back to `http://localhost:3000`), and reject a *present, mismatched*
   Origin with 403. An absent/`null` Origin is allowed so legitimate
   server-to-server / non-CORS callers are not broken. This is
   defense-in-depth on top of the `SameSite=Lax` session-cookie behavior — **not**
   a primary CSRF control. Slice-3 Finding 1 has the empirical analysis: a forged
   `Origin: https://evil.com` returned 201 via Playwright's `APIRequestContext`
   (which is not a browser and ignores `SameSite`), which proves only that the
   handler did no Origin validation — a real cross-site browser `fetch` would not
   attach the `SameSite=Lax` cookie to a cross-site POST, so `SameSite=Lax`
   already blocks the browser path. The allowlist is cheap insurance for the
   feature-011 admin UI and against a future dev relaxing `SameSite`.

2. **Auth-first ordering on privileged endpoints.** Authentication and
   authorization MUST run BEFORE body parsing. Unauthenticated callers get 401
   with no schema disclosure; non-admins get 403; only a verified admin reaches
   Zod validation and ever sees a 400 with validation detail. The reverse order
   (validate-then-auth) leaks the endpoint shape — field names, the email regex
   source, the `role` enum — to anonymous reconnaissance via 400-vs-401 toggling,
   and does parsing work for unauthenticated callers. The Origin check (choice 1)
   sits alongside the authN gate, before the body parse.

3. **Single-source-of-truth schemas for cross-cutting fields.** A field written
   from more than one path (today: `full_name` from signup, onboarding, and
   account update; future: any column written by 2+ Server Actions) MUST export a
   single schema from `apps/web/lib/auth/schemas.ts` and be consumed everywhere —
   server parses, the client-side react-hook-form resolver, and (where it maps to
   a UI control) the `maxLength` attribute all derive from that one declaration.
   This prevents the slice-3 Finding 5 drift pattern, where the account path had
   diverged to `max(60)` while signup/onboarding allowed 120, locking a user with
   a 61–120-char name out of editing their own profile.

4. **Reject, don't sanitize, for user-input character-class restrictions.** When
   a validator rejects categories of input (control chars, format chars), it
   returns a clear error rather than silently stripping. Silent transformation is
   surprising and harder to debug; explicit rejection is the user-friendlier
   policy. `fullNameSchema` rejects only `\p{Cc}\p{Cf}` (control + format chars,
   including the RTL override `U+202E`) — a **minimal-reject**, NOT a positive
   whitelist like `[\p{L}\p{M}\p{N} '\-.,]`, which would break legitimate
   non-Latin names and unusual-but-valid punctuation (e.g. the Catalan middle
   dot). Future cross-cutting field restrictions inherit this pattern. This pairs
   with a **layer-independent DB backstop** on *length only* (migration
   `20260525000100_full_name_length_cap.sql`: `CHECK (full_name IS NULL OR
   char_length(full_name) <= 120)`): length and character class are different
   calculus — the CHECK guards length even for a non-form writer that bypasses the
   Zod gate, while the character-class restriction stays at the app layer per
   slice-1 Finding 7's routing (render-escaping is the primary XSS control; this
   is defense-in-depth + integrity).

**Revisit if**: a future privileged Route Handler needs CORS for a legitimate
cross-origin browser client (choice 1 would need an allowlist of origins, not a
single `SITE_URL`); a CSP lands (slice 5) adding a second XSS layer that changes
the character-class calculus (choice 4); or a future field needs a stricter
positive grammar than minimal-reject can express (choice 4 — at which point the
whitelist's non-Latin breakage must be weighed explicitly).

---

## 2026-05-25 — Security slice 4: secrets handling

**Status**: Accepted.

**Context**: The slice-4 audit (`docs/security/04-secrets-handling.md`) found a
clean secrets posture — the service-role key is read in three places, all
env-sourced, none client-reachable; a production build carried 0 service-role
matches in `.next/static`; git history was clean. The residual was three `low`
hygiene / documentation / ops-resilience findings, all approved for fix. The fix
pass landed them across three commits (`94a14d6` validated env module, `f61a26c`
`.env.local.example` docs, `9dcb70a` seed TTY gate). These are the policy choices
it codifies.

**Decision**:

1. **Validated env module as the single boot-time gate for Supabase credentials.**
   `NEXT_PUBLIC_*` env vars and server-secret env vars route through
   `apps/web/lib/env/*`. Framework-managed vars (`NODE_ENV`) stay inline — they're
   never missing, are type-safe via TypeScript's narrowing, and don't benefit from
   the module's fail-fast goal. Future env vars added in either category extend the
   corresponding schema; ad-hoc `process.env.X!` reads in app code are disallowed
   for the routed categories. Mechanically: a Zod schema (`lib/env/schema.ts`),
   bound by `client.ts` (public) and the `server-only` `server.ts` (server-secret
   + the `SITE_URL` server config), is parsed once at module load and throws a
   clear, field-listed error if a value is missing/malformed — replacing 8
   scattered `process.env.X!` non-null assertions that failed late (an opaque
   deep-stack error at the first Supabase call) with fail-fast at boot. The prefix-discipline invariant — the service-role key never
   reaches the client bundle — is enforced **structurally**: `serverEnv` lives in
   a `server-only` module, so any client-component import path fails the build,
   and the secret is only ever read through `serverEnv`. (Verified: post-refactor
   production build still shows 0 service-role-key matches in `.next/static`, anon
   key = 1.)
   - **Schema split, not one module.** `clientEnvSchema` (URL + anon key) is
     side-effect-free with NO `server-only` import; `serverEnvSchema` extends it
     with the service-role key + `SITE_URL`. The pure schema file is unit-tested
     directly; the `server-only` binding (`server.ts`) is never imported by a test
     because the `server-only` package's default export THROWS outside Next's
     `react-server` condition (i.e. in Vitest) — a test importing it would fail at
     import. This separation is deliberate. Unit tests seed schema-valid
     placeholder env in `tests/unit/setup.ts` so the eager parse succeeds without
     a real `.env`.
   - **Scope.** `NODE_ENV` checks (`=== "production"` for the cookie `Secure`
     flag) stay inline — `NODE_ENV` is framework-managed, type-safe via
     `@types/node`, always present, and not a fail-late `!` read; routing it would
     couple `server.ts`/`proxy.ts` to the server-only module for no safety gain.
     The audit's Finding 1 surface (the Supabase credential reads) is fully
     covered; `SITE_URL` was folded in because it shares the fail-late pattern and
     its `?? "http://localhost:3000"` default was duplicated at four sites (now
     the schema's single `.default(...)`).

2. **Complete `.env.local.example`.** Every env var read by repo code is listed in
   `.env.local.example`, even when commented and even when it has a runtime
   fallback. Test-only / infrastructure vars (`PLAYWRIGHT_PORT`, `CI`,
   `MAILPIT_URL`, `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `SUPABASE_PROJECT_REF`)
   live under a clearly-labelled "Test-only / infrastructure (defaults shown)"
   block so they are discoverable without being mistaken for required production
   vars. Rationale: contributors find the example file before they find the code
   that reads a var.

3. **TTY gating for sensitive CLI output.** Local-only dev tooling that prints a
   credential (today: `scripts/seed-demo.ts`'s shared demo password) gates the
   print behind `process.stdout.isTTY`, so a non-interactive run (CI, redirected
   output) skips it and the value cannot land in a build log. The demo password is
   a non-prod constant, so this is defense-in-depth. It does NOT apply to
   diagnostic `stderr` / `console.error` writes — those must always print so
   failures aren't silently swallowed.

**Cloud-dashboard parity**: n/a — env *values* still live in the Vercel /
DigitalOcean / Supabase panels (Principle IX); this slice changes how the app
*reads* them locally and adds boot-time validation, not what they are in prod.

**Revisit if**: a server-secret env var is ever legitimately needed in a Client
Component (it cannot be — that is exactly the bug the `server-only` boundary would
catch at build time); a future env var needs cross-environment defaults beyond
`SITE_URL`'s localhost default (choice 1); or the seed tooling moves into CI where
even the summary table's synthetic emails warrant suppression (choice 3).

---

## 2026-05-26 — Security slice 5: Content Security Policy + auxiliary security headers

**Status**: Accepted.

**Context**: The slice-5 audit (`docs/security/05-csp-header.md`) designed a
nonce-based CSP + auxiliary security headers; Mohamed adjudicated the five design
decisions (recorded in that doc's Adjudication section). The fix pass implemented
the policy, drove the Report-Only → empirical-capture → enforcing rollout against
a **production build** (Playwright capturing `securitypolicyviolation` events on
all 8 routes + Radix overlay interactions), and flipped to enforcing once the
violation list was empty. CSP is the planned second layer under React
auto-escaping and the mitigation for the slice-2 `httpOnly:false` cookie exposure.
These are the policy choices it codifies.

**Decision**:

1. **CSP `script-src` is nonce-based, not hash-based.** Next.js 16 emits
   per-request, streamed inline scripts (the `__next_f` RSC flight payload and the
   `__next_r` router marker) that are content-dependent and therefore cannot be
   hashed. Next auto-stamps the nonce onto all of its own inline scripts when the
   `Content-Security-Policy` header carrying `'nonce-…'` is present on the
   **inbound request** (verified against `next/dist/.../get-script-nonce-from-header.js`
   — it parses the nonce from `script-src`/`default-src` on the request). So the
   middleware sets the CSP on both the forwarded request headers (for stamping)
   and the response (for enforcement). The two app-authored inline scripts — the
   `layout.tsx` theme-migration IIFE and the next-themes FOUC script — carry the
   nonce manually (`<script nonce>` and `<ThemeProvider nonce>` respectively).
   `'strict-dynamic'` propagates trust to the chunk scripts the nonced bootstrap
   loads. The 128-bit nonce is generated with the Edge-runtime-safe global Web
   Crypto `getRandomValues(new Uint8Array(16))` (the Node `crypto.randomBytes`
   import is unavailable in the Edge runtime the middleware runs in).

2. **Zod 4's JIT compiler is disabled app-wide (`jitless: true`) instead of
   allowing `'unsafe-eval'` in production.** *Empirical finding from the
   Report-Only capture*: a production build emitted ~2 `script-src`
   `blocked=eval` `securitypolicyviolation`s per page. The source is Zod 4.4.3's
   JIT validator compiler, which builds parsers with `new Function(...)` (and runs
   a `new Function("")` capability probe). Zod swallows the CSP-blocked throw and
   falls back to the interpreted validator (functionally identical), but the
   blocked call still fires a violation report. The fix routes every app schema
   module through a `@/lib/zod` barrel that calls `z.config({ jitless: true })` as
   an import side effect — which skips both the compile and the probe (Zod
   `v4/core/util.js` `allowsEval`). Critically, the `jitless` flag is read at
   schema **build** time, so the barrel (imported before any `z.object(...)`
   evaluates) is the reliable place to set it; a later `z.config` call (e.g. in
   `env/client.ts` after the schema import) is too late. This keeps `script-src`
   free of `'unsafe-eval'` in production — a real XSS-control win over the
   alternative of allowlisting `eval`. (Dev still adds `'unsafe-eval'`: Turbopack's
   React dev build genuinely uses `eval` for debug stacks; prod does not.)

3. **CSP `style-src` uses `'self' 'unsafe-inline'`, NOT a nonce.** Radix UI
   (Dialog/Dropdown, via the transitive `react-remove-scroll` →
   `react-style-singleton`) injects a runtime `<style>` element on overlay open
   for scroll-lock; under Next 16's Turbopack/SWC bundler that element is
   un-nonced (`__webpack_nonce__` is not populated). Per CSP3, a nonce on
   `style-src` makes the browser **ignore** `'unsafe-inline'`, so adding a nonce
   would break the Radix scroll-lock. `'unsafe-inline'` on `style-src` is
   materially lower-risk than on `script-src` (CSS cannot execute JS). The
   Report-Only capture confirmed empirically: opening the profile dropdown under
   the enforcing policy produced **zero** `style-src` violations. Future hardening
   to a nonce'd `style-src` (wire `setNonce()` from `get-nonce` before any Radix
   overlay mounts, then drop `'unsafe-inline'`) is deferred.

4. **HSTS ships with `includeSubDomains` but WITHOUT `preload`.** `preload` is a
   near-irreversible commitment (removal takes 6–12 months to wash out of
   browser-baked lists); combined with `includeSubDomains`, any future
   non-HTTPS-ready `serenify.tech` subdomain would become permanently unreachable
   for users who received the preload entry. `includeSubDomains` alone still
   qualifies the domain for preload when that decision is consciously made after
   every planned subdomain is audited HTTPS-ready. HSTS is **production-only**
   (`NODE_ENV === "production"`) — on `localhost` it would force `http→https` and
   break dev.

5. **Cross-Origin-Embedder-Policy (COEP) skipped.** `require-corp` would break
   Supabase cross-origin fetch/WebSocket (Supabase sends no CORP header) for no
   current benefit (no `SharedArrayBuffer`/WASM-thread need today). COOP and CORP
   (`same-origin`) ARE set. Revisit when feature 004's WASM inference path lands
   (it will need `'wasm-unsafe-eval'` in `script-src`, and COEP may become
   relevant then).

6. **Forward-looking telemetry PII policy (no telemetry code investigated — none
   is installed; slice-4 Audited-clean #10).** When Sentry / PostHog are adopted
   (per the locked Technology Stack table): (a) add the ingest origins to
   `connect-src` (`https://*.ingest.sentry.io`, `https://*.posthog.com`); (b)
   configure PII scrubbing — Sentry `beforeSend` to redact session tokens, user
   PII, and full URLs; PostHog session-recording input/text masking; (c) keep the
   Sentry DSN exposure minimal. A slice-5-style CSP + PII revisit happens at
   adoption time, before the telemetry ships.

**Header placement**: per-request nonce CSP + prod-only HSTS-class logic is
emitted in `proxy.ts` (middleware); the static aux headers (nosniff,
X-Frame-Options, Referrer-Policy, Permissions-Policy, X-XSS-Protection:0, COOP,
CORP — and HSTS via a `NODE_ENV` branch) live in `next.config.ts` `headers()` so
they also cover the `/_next/static` asset responses the middleware matcher
excludes. The middleware matcher additionally skips RSC prefetch requests
(`next-router-prefetch` / `purpose: prefetch`) so the CSP is set only on HTML
document responses.

**Permissions-Policy camera/microphone**: denied now
(`camera=(), microphone=(), …`); features 004 (webcam+rPPG) and 013 (audio) MUST
relax them scoped to their capture routes when they land — not pre-enabled.

**Cloud-dashboard parity**: n/a — all changes are in-repo (`next.config.ts`,
`proxy.ts`, `layout.tsx`, `providers.tsx`, `lib/zod.ts`). No Supabase or platform
config changed. (Vercel may also inject HSTS at the edge; that is platform config,
not repo config, and does not conflict.)

**Revisit if**: a future inline script needs a hash rather than the nonce (choice
1); Zod ships a release that removes the JIT or changes the `jitless` API (choice
2); a future need to drop `'unsafe-inline'` from `style-src` justifies wiring
`setNonce()` (choice 3); all `serenify.tech` subdomains become HTTPS-ready and
`preload` is wanted (choice 4); feature 004's WASM path lands (choices 5 + the
`'wasm-unsafe-eval'` note); or Sentry/PostHog are adopted (choice 6).

---

## 2026-05-26 — Security slice 6: dependency hygiene (classification, exact pins, audit triage)

**Status**: Accepted.

**Context**: The slice-6 audit (`docs/security/06-dependency-audit.md`,
adjudicated 2026-05-26) found a clean runtime posture — zero runtime-reachable
advisories — with two `low` hygiene findings (F1 dependency-classification, F2
pin-documentation) and two non-reachable dev/build-only npm advisories (A1
esbuild-via-`tsx`, A2 postcss-in-Next). The fix pass landed A1 (`tsx`
4.19.2 → 4.22.3), F1 (reclassify four utils), a batch of five range-satisfiable
routine bumps, and these decisions. No migration / no Cloud-dashboard parity item
this slice — all changes are in `package.json` / `package-lock.json` / docs.

**Decision**:

1. **devDependency classification — the test is "does its code execute at
   runtime", and the shadcn-CLI `-D` default is overridden for four packages.**
   `clsx`, `tailwind-merge`, `class-variance-authority`, and `server-only` move
   from `devDependencies` to `dependencies` in `apps/web/package.json` (versions
   unchanged). The shadcn manual-init workflow (DECISIONS 2026-05-25 DECISION-1)
   installed them with `npm i -D`; that is wrong for these four.

   The classification test is: **a dependency is a runtime dependency if its own
   code executes when the deployed app serves a request — i.e. its code ships into
   the runtime bundle.** The test is NOT "is it imported from `apps/web/` source."
   These four ship their actual code into the bundle: `clsx` + `tailwind-merge`
   back the `cn()` helper (`lib/utils.ts`) called by every UI primitive,
   `class-variance-authority` backs `button`/`sheet` variants, and `server-only`
   is the RSC build-guard side-effect import in `lib/env/server.ts` and
   `lib/supabase/admin.ts`. (`@radix-ui/react-slot`, from the same shadcn `-D`
   install list, was already correctly in `dependencies` — no change.)

   **Corollary — build-time tooling stays in `devDependencies`, even though it is
   imported from build configs.** TypeScript, the Tailwind compiler
   (`tailwindcss`), PostCSS plugins (`@tailwindcss/postcss`), `tw-animate-css`,
   and lint tooling are referenced from `postcss.config.mjs` / `next.config.ts` /
   `globals.css` `@import`s, but their **output** ships, not their **code** — so
   they are correctly `devDependencies`. This corrects the looser rule the audit
   first proposed ("any dep referenced from a non-`*.test.*` `apps/web/` source
   file is a runtime dep"): being imported from source/config does not make a dep
   a runtime dep; *shipping its code into the served bundle* does.

   **`--omit=dev` is a runtime install profile, not a build profile.** You do not
   build with `--omit=dev` — the production build runs a full install (Vercel runs
   a full `npm install`, then `next build`); only the runtime serving layer needs
   the prod-only set. Empirically, `npm ci --omit=dev` resolves all four
   reclassified utils (the load-bearing F1 proof), while `npm ci --omit=dev &&
   next build` fails compiling `globals.css` on the build-only `@tailwindcss/postcss`
   — which is **expected and correct**, not a misclassification. The full-install
   `next build` is green. The F1 fix closes the real risks: the
   `npm audit --omit=dev` blind spot on these four, and bundle-correctness.

2. **Exact-pin rationale catalog (F2 backfill).** The following exact pins are
   deliberate and load-bearing; a future maintainer MUST NOT loosen them to carets
   without a paired DECISIONS revision:
   - **`next` + `react` + `react-dom` (`apps/web`)** — framework core triple. The
     React pair moves atomically with `next` per `create-next-app` convention;
     the React versions Next ships against are the tested ones. Bump only when
     Next bumps.
   - **`tsx` (root)** — already recorded (DECISIONS 2026-05-18); the pin is moved
     forward to `4.22.3` in this slice (security-driven, clears the esbuild
     advisory; see choice 3 / A1). The exact pin guards against *silent* updates,
     not against deliberate forward moves.
   - **`@faker-js/faker` (root)** — **demo-seed cohort determinism.** A faker
     version change can shift generated names and silently break the DECISIONS
     2026-05-18 demo-email-format reproducibility guarantee. An un-pin would be a
     regression, not a tidy-up.

3. **`npm audit` triage policy — categorize by runtime reachability, not severity
   alone.**
   - **Runtime-reachable + fix available** → apply.
   - **Runtime-reachable + no clean fix** → escalate to a feature-level decision
     (block / accept / replace).
   - **Build-/dev-only + clean fix** → apply (a clean audit baseline is
     operationally valuable — nobody should have to remember "ignore that line").
     Slice-6 A1 is the model: `tsx` 4.19.2 → 4.22.3 cleared the dev-only esbuild
     advisory (GHSA-67mh-4wv8-2f99) even though it was never runtime-reachable.
   - **Build-/dev-only + no clean fix** → accept with documented rationale, and
     identify the specific re-evaluation trigger. Slice-6 A2 is the model: the
     postcss-`</style>` advisory (GHSA-qx2v-qp2m-jg93) is reachable only at build
     time on first-party CSS (no untrusted-CSS precondition), and the only offered
     fix is a non-viable Next downgrade — so it is **accepted, carried forward**
     from DECISIONS 2026-05-17, with the trigger being "Next ships a bundled
     postcss ≥ 8.5.10." Any new accept MUST reference this policy and name its
     re-evaluation trigger.

**Revisit if**: a future `apps/web/` dependency's code ships into the runtime
bundle but sits in `devDependencies` (apply the choice-1 test); Next bumps and the
`react`/`react-dom` pins must move with it, or a faker version is genuinely needed
(choice 2); or a new audit advisory needs triage / the accepted postcss line clears
on a Next bundled-postcss bump (choice 3).

---

## 2026-05-26 — Security slice 7: rate-limit posture + Cloud-dashboard parity

**Status**: Accepted.

**Context**: The slice-7 audit
(`docs/security/07-rate-limits-and-parity.md`, adjudicated 2026-05-26) verified
the rate-limit surface end-to-end and consolidated the Cloud-dashboard parity
checklist carried across slices 1–6. Headline posture: the GoTrue
`[auth.rate_limit]` configuration is sound and matches defaults; there is **no
exploitable unauthenticated rate-limit hole**. The findings were 1 med (the
`/signup` open posture), 3 low (`/api/admin/invite` app-layer throttle,
`email_sent` production re-tune, unthrottled self-scoped DB-write Server
Actions), and 1 informational (no CAPTCHA / per-IP-only buckets). **No finding
produced an immediate functional code or config change** — every outcome is a
deferral, a deploy-blocker invariant, or a policy codification. The fix pass
landed inline reminder comments (`route.ts`, `config.toml`), the BACKLOG entries,
and these decisions. This is the lightest slice of the phase: docs + comments
only, no behavior or config-value change.

**Decision**:

1. **`/signup` open self-serve posture is conditionally accepted as a binding
   Pre-Production Deploy Blocker.** Open self-serve signup is acceptable through
   the thesis/demo lifecycle stage. It becomes a **hard production-deploy
   blocker**: a production launch with real user signals **MUST NOT** proceed
   while `/signup` is open. The deploy-blocker is satisfied only when **both**
   hold: **(a)** `/signup` returns 404 OR requires a valid invite token, **AND
   (b)** the invite-token flow is gated by a server-side check against an
   `invites` table (or equivalent server-side allowlist) matching the token to
   the email. The BACKLOG entry (security slice 7, ⛔-tagged) tracks the feature
   work; this entry establishes the **binding gate**. Severity stays `med` today
   via the dual-lens framing (choice 2); it rises to `high` immediately on the
   day a production deploy is contemplated. This deploy gate is the mechanism
   that holds the thesis-lens Low–Med rating in place — the lower rating is
   honest only *because* the gate guarantees the posture cannot reach a
   real-tenant launch unaddressed. The slices-0–7 `PROJECT_SYSTEM_PROMPT.md`
   wrap-up surfaces this as a Pre-Production Deploy Blocker, not merely deferred
   work.

2. **Dual-lens severity for lifecycle-dependent findings (general pattern).**
   When a finding's severity legitimately differs between the current lifecycle
   stage and a later one (typically pre-prod vs prod), the audit documents **both
   ratings + the trigger event** for re-evaluation, and tables the finding at the
   **bridge value** — the lower lifecycle's rating plus a "rises to `<higher>` at
   `<trigger>`" note. This signals "a product decision is owed before X" without
   crying wolf at the current stage. The `/signup` finding (F1: Low–Med thesis /
   High production, trigger = real-tenant launch) is the model. This pairs with
   the "severity is informational" principle already in the log — the rating
   drives *prioritization*, and a deferred-to-feature-work fix is rated by its
   reachable risk *today*, with the future re-rating recorded so the deferral
   does not bury the production-blocker nature. Future audits inherit this
   pattern.

3. **`/api/admin/invite` per-admin throttle is deferred to feature 011.**
   Calibrating a throttle without a real admin UI is arbitrary, and today's
   exposure requires a valid admin session cookie (no anonymous attack path).
   Feature 011 (admin-dashboard) will define the legitimate invite-usage patterns
   the limit should be sized against; the throttle implementation lands then,
   using a **durable Supabase-table-backed limiter** (per the slice-7 audit's
   production recommendation — service-role admin calls bypass GoTrue's per-IP
   buckets, so the endpoint has zero coverage from them and an in-memory `Map`
   would not survive across serverless instances). An inline reminder comment is
   added at `apps/web/app/api/admin/invite/route.ts:37` so a future maintainer
   touching the handler sees the deferral.

4. **Self-scoped Server Actions inherit RLS as their throttle ceiling — no
   app-layer limiter is owed.** For a Server Action whose only side effect is a
   self-scoped DB write under RLS (`updateProfile`, `completeOnboarding`, and the
   effective row reads behind `signOut`), no application-layer rate limit is
   added. RLS narrows the blast radius of any spray attack to the attacker's
   **own** row (`.eq("id", user.id)`), and database write-rate is the
   platform-level ceiling; the impact is self-directed write spam, not a
   cross-tenant hazard. Add throttling only when a Server Action's side effect is
   **not** RLS-narrowed — e.g. outbound notifications, cross-row writes, or
   expensive computations. This is recorded to prevent future "should we add
   throttling here?" cycles on the self-scoped write paths.

5. **CAPTCHA / bot mitigation is deferred, trigger-gated.** Today's per-IP GoTrue
   buckets are appropriate for the current threat model (single-tenant pre-prod).
   They do **not** bound distributed credential-stuffing per-account (a
   rotating-IP attacker gets a fresh per-IP budget each source) — that is the
   limit, and the trigger to revisit. CAPTCHA is deferred to whichever fires
   first: **(a)** sustained credential-stuffing patterns observed in production
   logs, or **(b)** the production-launch readiness review. The `[auth.captcha]`
   template stays commented out in `config.toml` so the future enable is one
   line.

**Parity-mirroring policy (process note).** When `supabase/config.toml`
documents a security-relevant setting — **even for a feature that is currently
disabled** — the Cloud-dashboard parity checklist mirrors that setting too, as
cheap defense-in-depth: if the feature is later enabled (anon sign-ins, SMS,
web3), the rate limit is already in place rather than landing on an unset or
over-permissive value. Slice 7 surfaces `anonymous_users` and `sms_sent` as the
concrete examples (both inert today — `enable_anonymous_sign_ins=false`, SMS
disabled — but mirrored anyway). The `email_sent` value is the one exception that
needs a *value* re-evaluation before mirroring (choice-3-adjacent: re-tune at
SMTP-wiring time per F3); the rest are confirm-not-change. The full
`[auth.rate_limit]` block, including the inert settings, is mirrored. This
extends the slice-2 "Cloud-dashboard parity for `config.toml` security changes"
process note to cover inert/disabled-feature settings, not just active ones.

**`email_sent` re-tune deferral.** Locking a value without the production
provider's quota is arbitrary, and the setting is inert locally (SMTP disabled).
The value stays `2` until custom SMTP is configured, at which point it is
re-tuned against the chosen provider's quota and mirrored to the dashboard. An
inline reminder comment is added at `supabase/config.toml:204`.

**Cloud-dashboard parity**: this slice **consolidates** the parity checklist
across slices 1–7 (it adds no new in-repo config change of its own). The one new
flag this consolidation adds is the **Auth → Rate Limits** block (six values),
because `[auth.rate_limit]` is local-only and was never affirmatively confirmed
against the hosted project. Mohamed applies + verifies the full checklist
manually before any production deploy; it cannot be read from the repo.

**Revisit if**: a product/auth decision closes `/signup` to invite-only or
removes it (choice 1 — the deploy blocker clears at that point); feature 011
lands and sizes the invite throttle (choice 3); a Server Action gains a
non-RLS-narrowed side effect (choice 4); sustained credential-stuffing is
observed or the production-launch review opens (choice 5 — CAPTCHA trigger); or
production SMTP is wired (the `email_sent` re-tune trigger).

---

## 2026-05-27 — constitution(II) amendment: video pipeline window + baseline + drop rPPG language

**Status**: Accepted (constitutional amendment, MINOR bump `1.1.0 → 1.2.0`).

**Context**: The video modality switched from rPPG to LBP-TOP + Motion
features with per-user delta calibration. The rPPG notebook was retired
after a subject-leakage bug was discovered late in feature 004 prep; the
replacement is the LBP-TOP + Motion pipeline served as model
`serenify-video-lbptop-motion-rf-calibrated` v2.0.0. The new model's
contract specifies timing parameters that contradicted what Principle II
(Subject-Disjoint ML Evaluation) stated.

**Decision**: Principle II is amended to match the model contract:

- Deployment-time inference window changed from rolling **30s** to rolling
  **60s** (10s stride unchanged). The "30s is the physiological minimum for
  meaningful HRV from rPPG" justification — which was rPPG-specific — is
  removed; the window duration is now set by the model contract documented in
  `docs/MODELS.md`.
- Per-user calibration baseline changed from **~90s** to **~60s** on first
  login.
- The "rPPG" naming is dropped from Principle II in favor of modality-agnostic
  "video pipeline" wording. (rPPG is intentionally retained as historical /
  architectural context in Principle I and Principle III — out of scope here.)

All other Principle II clauses (subject-disjoint LOSO/GroupKFold splits,
per-subject baseline normalization on physiological features, the
`docs/MODELS.md` requirement for model artifacts) are unchanged.

**Empirical justification**: On subject-disjoint LOSO evaluation, the 30s
window configuration collapsed **stress-class recall from 0.83 (at 60s) to
0.61 (at 30s)**. 60s is therefore the locked production mode for the current
model; shorter windows degrade recall on the class the product exists to
detect.

**Affected artifacts** (all in the same commit as this entry):

- `.specify/memory/constitution.md` Principle II — two sentences amended
  (inference window + calibration baseline), rPPG dropped from the principle
  body, version bumped `1.1.0 → 1.2.0` (MINOR per Governance: refinement of an
  existing rule — timing parameters + terminology; no new/removed principles,
  no structural change). Sync Impact Report appended with the Amendment 2
  record and the template-audit note.
- `docs/CHANGELOG.md` — `constitution(II)` amendment entry dated 2026-05-27.

Template audit: `.specify/templates/{plan,spec,tasks}-template.md` reference
Principle II by number, not by literal timing text — zero matches for the
touched values, so no template edit is required.

**Revisit if**: a currently-running model trial surfaces a better video model
whose contract specifies a different window or baseline — the constitution MAY
be amended again to match the winning model's contract (the timing parameters
are bound to the production model contract in `docs/MODELS.md`, not to a fixed
physiological constant). Any such change follows the same Governance amendment
path and is logged here and in `docs/CHANGELOG.md`.

---

## 2026-05-27 — constitution(III, VIII) amendment — video pipeline description + 004 slot rename

**Status**: Accepted (constitutional amendment, MINOR bump `1.2.0 → 1.3.0`).

**Context**: Feature 004 (onboarding video anchor flow) is the first feature to
create `packages/ml-video/`, and it does so around the post-rPPG model
`serenify-video-lbptop-motion-rf-calibrated@2.0.0` — LBP-TOP + motion features
with per-user delta calibration. Two pieces of constitution text still
described the abandoned rPPG approach and the pre-rename feature slug. This
amendment brings the constitution into alignment with what 004 actually builds,
landing as a ride-along in the first commit of the feature (before any feature
code), so the rest of 004 builds against a clean constitution.

**Decision**: Two surgical edits to `.specify/memory/constitution.md`:

1. **Principle III (Modality Isolation) package description.** The
   `packages/ml-video/` bullet changed from
   `webcam + rPPG pipeline` to
   `video stress pipeline (LBP-TOP + motion features, per-user delta calibration)`.
   The earlier rPPG language survived Amendment 2 (which scoped its rPPG removal
   to Principle II's body only and explicitly retained the Principle III
   `webcam + rPPG pipeline` description as out-of-scope at the time); this
   amendment now retires it from Principle III as well, since the real pipeline
   exists as of feature 004.

2. **Principle VIII (Spec-Driven Workflow) provisional feature ordering.** The
   slot `004-webcam-and-rppg` is renamed to `004-onboarding-video-anchor` to
   match the actual feature spec slug. Slots 005 (`005-per-user-calibration`),
   006 (`006-stress-inference-service`), and all others are unchanged — they are
   reconsidered when their own planning starts.

**Why MINOR (not MAJOR/PATCH)**: Per Governance, MINOR covers materially
expanded or refined guidance on an existing rule. This is a refinement of an
existing principle's wording (a package description) plus a provisional
ordering-slug rename — no new principles, no removed principles, no structural
change, no backward-incompatible redefinition.

**Affected artifacts** (all in the same commit as this entry):

- `.specify/memory/constitution.md` — Principle III bullet, Principle VIII slot,
  version line `1.2.0 → 1.3.0`, Sync Impact Report Amendment 3 entry. `Last
  Amended` stays `2026-05-27` (Amendment 2 already set it earlier today).
- `docs/MODELS.md` — created in this commit with the
  `serenify-video-lbptop-motion-rf-calibrated@2.0.0` registry entry (the model
  referenced by the new Principle III description).
- `docs/MODEL_HANDOFF.md` — the model's full integration contract, included in
  this commit.
- `docs/models/serenify-video-lbptop-motion-rf-calibrated-v2.0.0-results.png` —
  the LOSO results figure (confusion matrix / ROC / score distribution).
- `docs/CHANGELOG.md` — `constitution(III, VIII)` amendment entry dated
  2026-05-27.

**Template audit**: `.specify/templates/{plan,spec,tasks}-template.md` reference
principles by number, not by the literal strings `rPPG`, `webcam`,
`004-webcam-and-rppg`, or `ml-video` — zero matches for the touched text, so no
template edit is required.

**Revisit if**: a future video-model bump changes the pipeline family again
(the Principle III description is bound to the production pipeline, not a fixed
technique), or the provisional 005/006 slots are renamed when their planning
starts — each follows the same Governance amendment path and is logged here and
in `docs/CHANGELOG.md`.

---

## 2026-05-27 — feature 004 DECISION-12 amended: all anchor columns private; `has_anchor()` helper

**Status**: Accepted (plan amendment; recorded in `docs/CHANGELOG.md`
2026-05-27 per Principle VIII).

**Context**: Feature 004 adds `anchor_vector`, `anchor_captured_at`, and
`anchor_model_version` to `public.profiles`. Postgres RLS is row-scoped, so the
existing `profiles_select_admin` (admins see all rows) and
`profiles_select_direct_reports` (a team_lead sees reports' rows) policies expose
every column of an admitted row. The plan's original DECISION-12 blocked only
`anchor_vector` (via a SELECT column whitelist) and left the two metadata columns
readable by managers/admins, on the reasoning that FR-019 scopes the privacy
invariant to the *vector*.

**Decision**: Adopt the stricter posture. **All three** anchor columns are
excluded from the `authenticated` SELECT column whitelist — none is readable by
any client role through table grants. Calibration status is exposed only via a
new scope-guarded SECURITY DEFINER function:

```sql
CREATE OR REPLACE FUNCTION public.has_anchor(target_user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF target_user <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden: may only query own anchor state'
      USING ERRCODE = '42501';
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.profiles
                 WHERE id = target_user AND anchor_vector IS NOT NULL);
END;
$$;
ALTER FUNCTION public.has_anchor(uuid) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.has_anchor(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_anchor(uuid) TO authenticated;
```

- `SECURITY DEFINER` + `search_path = ''` (fully-qualified names) + `OWNER TO
  postgres`, matching the slice-1 hardening posture for DEFINER helpers.
- **Scope guard**: raises `42501` when `target_user <> auth.uid()`, so a caller
  can only ask about themselves — a manager cannot probe a report's calibration
  state.
- `EXECUTE` revoked from `PUBLIC`/`anon`, granted only to `authenticated` (not
  referenced by any RLS policy, so no anon grant needed — slice-1 default).
- The web app calls `has_anchor(auth.uid())` to drive the `/app` calibration
  banner, replacing the prior plan-time read of `anchor_captured_at IS NULL`.

**Rationale**: A manager knowing whether — or when — a direct report calibrated
is a lever for pressure ("why haven't you set up your wellness app yet?"), which
undercuts the Principle I trust story that managers see aggregates, not
individuals. The cost is one SECURITY DEFINER construct; the privacy gain is real
and bounded. The owner losing direct read of `anchor_captured_at` is acceptable
because 004's only consumer of that fact is banner visibility, which the boolean
serves exactly.

**Scope note**: feature 005's inference read path for `anchor_vector`
(server-side service-role read, or a self-scoped SECURITY DEFINER function) is
still 005's decision and is **unaffected** by this change.

**Affected artifacts** (plan-amendment commit): `specs/004-onboarding-video-anchor/`
`plan.md` (DECISION-12 + DECISION-13/14/15 banner-read refs), `contracts/migration.md`,
`data-model.md`, `research.md`; `docs/CHANGELOG.md` 2026-05-27. The migration that
implements `has_anchor()` + the tightened grants lands during `/speckit.implement`.

**Revisit if**: a later manager-facing feature (011/012) needs an
aggregate "team calibration coverage" metric — that would be served by a
separate admin-scoped aggregate function, never by relaxing per-individual
`has_anchor` scope.

---

## 2026-05-27 — feature 004 architecture decisions (collected; 📌 DECISION-1 through DECISION-18)

**Status**: Accepted.

**Context**: Feature 004 (onboarding video anchor flow) adds a Python ML video
pipeline (`packages/ml-video/`), a FastAPI extraction service (`apps/api/`), the
three anchor columns + `has_anchor()` on `public.profiles`, the in-browser
recorder + calibration banner, a cross-tab broadcast, and a deterministic demo
anchor. The architectural choices were made during `/speckit.plan` and
`/speckit.tasks`; each is tagged in `tasks.md` with a 📌 DECISION-n marker naming
its source task so the entry can be audited against the diff. Recorded here on
completion of `/speckit.implement`. **DECISION-12** (all anchor columns private +
scope-guarded `has_anchor()`) already landed in the plan-amendment commit — see
the `2026-05-27 — feature 004 DECISION-12 amended` entry above — and is **not**
duplicated here. Entries 12–13 below record two findings surfaced *during*
implementation that were not in the original plan.

**Decision**:

1. **FastAPI service + Python 3.12 + exact ML pins** (📌 DECISION-1/2/3/4).
   `apps/api/` is a `uv`-managed FastAPI app; `requires-python = ">=3.10,<3.13"`
   because `mediapipe==0.10.13` has no 3.13 wheel. ML deps are pinned exactly from
   `models/metadata.json` — `scikit-learn==1.6.1` is load-bearing (a joblib
   unpickle under a different sklearn silently yields a wrong model);
   `opencv-python` is `4.13.0.92` (the 4-part PyPI package for the `4.13.0` cv2
   library version the metadata records).
   *Rationale*: the model artifact was trained against a frozen dependency set;
   reproducing it faithfully is a correctness requirement, not a preference.

2. **`packages/ml-video/` as a real editable package** (📌 DECISION-5), not a
   PYTHONPATH directory; `apps/api` consumes it via `[tool.uv.sources] … editable
   = true`. The predict/loader path is present and unit-tested but exposed by no
   004 endpoint (it is feature 005's inference read path).
   *Rationale*: a packaged `src/ml_video` gives a clean import contract and lets
   the loader resolve committed artifacts source-relative; PYTHONPATH hacks do not
   survive into the Docker image.

3. **Model artifacts at `packages/ml-video/models/`; `tmp/` gitignored**
   (📌 DECISION-6). Committed artifacts live at the package-root `models/` per
   Constitution Principle II; the staging drop dir `tmp/` is ignored.
   *Rationale*: Principle II mandates `packages/ml-*/models/` as the artifact
   home; keeping the import package free of large binaries keeps the wheel clean.

4. **Backend is local-only in 004; production deploy deferred** (📌 DECISION-7).
   A `Dockerfile` (`python:3.12-slim`) is committed as a forward artifact, but
   there is no hosted deployment and T020's production origin is left
   `[TBD by deployment]`.
   *Rationale*: 004 delivers the onboarding flow against a locally-run service;
   standing up hosting is a separate operational decision, out of feature scope.

5. **`POST /anchor` is JWT-only; the backend holds no DB credentials**
   (📌 DECISION-8/9). The service verifies the Supabase JWT (HS256,
   `aud=authenticated`), extracts the vector, and returns it; the **web app**
   writes the vector to `profiles` with the user's own session client. Raw upload
   bytes are deleted in a `finally` block (Principle I).
   *Rationale*: keeping the DB write on the authenticated browser session means
   the extraction service never needs a service-role key — smaller blast radius —
   and the privacy-sensitive bytes never persist server-side. (📌 DECISION-12,
   anchor-column privacy + `has_anchor()`, is recorded separately above and not
   repeated.)

6. **Web recorder state machine + post-grant device labels + codec probe +
   multipart upload + typed client** (📌 DECISION-13). The recorder is an explicit
   state machine (idle → permission → countdown → recording → extracting →
   done/error); device labels are read only *after* the `getUserMedia` grant
   (browsers withhold them beforehand); the codec probe tries
   `vp9 → vp8 → mp4 → default`; the vector is sent as multipart and surfaced as a
   typed `AnchorResult` union.
   *Rationale*: the extraction round-trip is ~10–15s, so a distinct `extracting`
   state with calm copy (R-1) avoids a frozen-looking app; the codec order
   maximizes cross-browser capture quality with a graceful fallback.

7. **Banner session-only dismissal + dedicated `/app/calibrate` route +
   onboarding inline step** (📌 DECISION-14). The calibration banner dismisses for
   the session via `sessionStorage`; calibration is reachable inline during
   onboarding and from a standalone `/app/calibrate` route.
   *Rationale*: a permanent dismissal would hide a not-yet-functional state
   indefinitely — a session dismissal nudges without nagging; the dedicated route
   lets the banner CTA deep-link cleanly.

8. **Cross-tab anchor-captured broadcast extends `auth-broadcast.ts`**
   (📌 DECISION-15). Completing the anchor writes a `localStorage` marker; sibling
   tabs listening on the storage event call `router.refresh()` to drop the banner.
   *Rationale*: reuses the established feature-003 cross-tab auth-sync channel
   rather than inventing a second one.

9. **Per-route `camera=(self)` + CSP `connect-src` += FastAPI origin; rollout
   order** (📌 DECISION-16). `next.config.ts` grants `camera=(self)` only on the
   capture routes (`/onboarding`, `/app/calibrate`) via a negative-lookahead
   source so each path matches exactly one Permissions-Policy rule; `proxy.ts`
   adds the FastAPI origin to CSP `connect-src`; COEP is left unset. The
   `connect-src` edit must land **before** the recorder's first call (R-5).
   *Rationale*: camera access is scoped to exactly the surfaces that need it;
   without the `connect-src` entry the recorder's upload is CSP-blocked, so the
   commit ordering is load-bearing.

10. **One deterministic synthetic demo anchor (seed 42) via service-role**
    (📌 DECISION-17). The seed writes a single reproducible synthetic anchor
    (`mulberry32(42)`) for the demo cohort using the service-role client.
    *Rationale*: the demo dashboard must show a calibrated, banner-free state
    without a real webcam recording; determinism keeps the seed idempotent and
    reviewable.

11. **Testing: mocked MediaPipe + synthetic no-face clip (pytest); mocked
    MediaRecorder + route-intercept (Playwright)** (📌 DECISION-18). Python tests
    use a `FakeFaceMesh` + synthetic MJPG clip (happy) and a no-face clip
    (extraction failure); e2e mocks `getUserMedia`/`MediaRecorder` and intercepts
    the anchor API.
    *Rationale*: the real pipeline needs a webcam and a heavier runtime;
    structural mocks exercise the contract deterministically in CI, and real
    capture is covered by the manual smoke matrix.

12. **Router Cache hard-navigation fix** (implementation discovery, commit
    `5f6d87e`). Next's App Router client-side Router Cache caches the proxy's
    `/app → /onboarding` 307 redirect; a soft `router.replace("/app")` after
    completing onboarding/calibration can no-op against the stale cached redirect
    and strand the user on `/onboarding`. The fix navigates with
    `window.location.replace("/app")` (a hard navigation) from
    `onboarding-form.tsx` and `calibrate-recorder.tsx`.
    *Rationale*: this is a **real product bug** for invited employees, surfaced by
    the e2e — not a test artifact. A hard navigation bypasses the Router Cache so
    the now-complete profile re-evaluates the proxy guard freshly. Recorded so a
    future dev does not "simplify" it back to `router.replace` and silently
    reintroduce the trap (both files' code comments point here as "DECISIONS
    2026-05-27").

13. **webkit-on-Windows worker-teardown limitation** (test-infra finding). Local
    headless webkit on Windows wedges on Playwright **worker teardown** due to an
    unreaped `WebKitNetworkProcess` handle per worker; it manifests as either
    assertion flakes or a full-suite hang once several worker teardowns
    accumulate. Verified **harmless to product correctness**: the two specs that
    flaked/hung in the full run (`employee-dashboard-shell`, `reset-password`)
    pass cleanly on webkit **in isolation** with traces showing zero logic/render
    issues, and both pass on chromium + firefox. Safari coverage therefore relies
    on smoke checks **ST-21/ST-24** (real iOS + macOS Safari) and CI (clean Linux
    webkit, `retries: 2`).
    *Rationale*: recorded so a future dev does not re-investigate a suite that is
    green on the merits but exits non-zero on this OS; the failure is a browser
    process-lifecycle quirk, not a 004 regression.

**Revisit if**: the backend moves to hosted deployment (entries 4/5 gain a
production origin, and feature 005 may add a service-role or self-scoped read path
for `anchor_vector`); a future feature needs manager-visible aggregate calibration
coverage (would be a separate admin-scoped function, never a relaxation of
`has_anchor` scope); the Router Cache redirect-caching behavior changes upstream
(entry 12); or the webkit teardown leak is fixed and the isolated-run signal
diverges from CI's webkit signal (entry 13).

---

## 2026-05-29 — feature 004 smoke-surfaced decisions + two planned decisions completed

**Status**: Accepted.

**Context**: Mohamed's manual smoke pass
(`specs/004-onboarding-video-anchor/smoke-tests.md`, ST-01…ST-24, signed off
2026-05-29) surfaced product bugs whose fixes carry architectural weight, and the
ship audit found that the collected feature-004 entry above (titled "📌 DECISION-1
through DECISION-18") silently skipped two **planned** decisions — DECISION-10 and
DECISION-11. Both omissions and all smoke-driven amendments are recorded here so
the DECISIONS log matches the shipped branch. No new DECISION-n numbers are
invented: each smoke fix amends or refines an existing decision/FR, or is recorded
as an implementation finding.

**Planned decisions omitted from the collected entry (now recorded):**

- **DECISION-10 — `/healthz` + boot-time model-load check.** `apps/api` loads the
  model at startup and aborts boot on failure (Principle II — no half-loaded
  service); `GET /healthz` (no auth) returns `200 {status:"ready", model_version}`.
  Sourced at tasks T016/T018, FR-048. The web recorder consumes it as a pre-check
  (see smoke amendment 7 below).
- **DECISION-11 — backend accepts BOTH MP4 and WebM.** `POST /anchor` accepts the
  `clip` field as MP4 or WebM and 415s anything else, so Safari (MP4) and
  Chrome/Firefox (WebM) upload natively with no client-side transcoding (FR-047).
  Sourced at task T019.

**Smoke-surfaced amendments (each ties to an existing decision or FR):**

1. **Anchor-service auth → ES256 via JWKS (DECISION-9 amendment).** The current
   Supabase CLI/cloud signs access tokens with asymmetric ES256 (`kid` header +
   JWKS), not the legacy HS256 shared secret DECISION-9 assumed; the HS256-only
   verifier 401'd every real token, surfaced by the recorder as "calibration
   temporarily unavailable" only at upload time. `verify_jwt` now verifies
   ES256/RS256/EdDSA against the published JWKS (HS256 retained as a fallback), with
   the algorithm allow-list pinned per branch (never read from the token). Full
   detail in CHANGELOG 2026-05-28; commit `1d9274c`. Supersedes the "HS256"
   parenthetical in item 5 of the collected entry.

2. **Permissions-Policy entry pattern → hard-navigate INTO capture routes
   (DECISION-16 refinement).** `Permissions-Policy` is a per-document header; Next
   App Router's client-side `<Link>` never reloads the document, so a `<Link>` from
   `/app` (`camera=()`) to `/app/calibrate` (`camera=(self)`) left the active
   document's `camera=()` enforced and `getUserMedia` was rejected. The calibration
   banner CTA is a plain `<a href>` (full navigation). Rule going forward: any link
   from a non-capture route INTO a capture route must be a hard navigation — same
   idiom as the Router Cache hard-nav (item 12 above). CHANGELOG 2026-05-28; commit
   `8ed62f3` (which corrected the wrong dev-only note in `e1971d0`).

3. **Cross-tab anchor + dismissal sync — concrete mechanism (DECISION-15
   refinement, ST-17).** Completing a recording writes `serenify-anchor-captured`;
   sibling tabs on `/app/calibrate` redirect to `/app`, and sibling tabs on `/app`
   drop the banner via `router.refresh()`. Banner dismissal is mirrored into each
   sibling tab's own `sessionStorage` so it both hides immediately and survives a
   reload in that tab until sign-out. Commit `9567869`.

4. **Anchor-marker refresh scoped to banner-bearing routes (ST-17 follow-up).**
   The cross-tab anchor-captured `storage` handler calls `router.refresh()` only on
   routes that actually render the banner, so a capture in one tab does not
   spuriously refresh unrelated authed routes in sibling tabs. Commit `b368bbc`.

5. **Banner dismissal resets on sign-out (ST-11).** Session-scoped dismissal is
   cleared on sign-out (via the auth-broadcast sign-out path) so the next sign-in
   re-shows the banner for a still-uncalibrated user; a banner refresh flash was
   removed in the same fix. Commit `649c08e`.

6. **Skip-for-now reveal: observer fires only when the explanation scrolls OUT of
   view (FR-004, ST-10).** The explanation copy (missing from the recorder UI) was
   added, and the IntersectionObserver that reveals "Skip for now" no longer fires
   on mount against an absent/zero-height element — it reveals only after the user
   scrolls past the explanation (or after the first extraction failure). Commit
   `63e9532`.

7. **Recorder runs the health pre-check before showing capture UI (ST-18, builds
   on DECISION-10).** When `/healthz` fails on entry, the recorder shows the calm
   "temporarily unavailable" copy and never flashes the recording form, so a user
   cannot record 60s into a dead backend. Commit `bd7bbce`.

8. **Recorder permission re-probe on retry (ST-02).** On the retry path the
   recorder probes `navigator.permissions` before calling `getUserMedia`, so a
   permanently-blocked camera shows the denied copy instead of flashing through the
   start-recording form. Commit `ec924bc`.

9. **Terminal recorder states are user-dismissible; no anchor on abort (Issue 3).**
   Success and failure are explicit terminal states the user dismisses ("Continue
   to dashboard" on success); the preview attaches the stream once the `<video>`
   mounts (`e43f33f`); and unmount detaches the `MediaRecorder` handlers before
   stopping tracks, so an aborted / navigated-away recording can never write a
   partial anchor (`b1db57a` / `fd618bf`).

10. **Ghost-button dark-mode hover contrast (design token).** The ghost variant's
    hover changed from `bg-accent` / `text-accent-foreground` (~1.4:1 in dark mode)
    to `hover:bg-foggy/15` with no text override, clearing WCAG AA; the
    "Skip for now" control uses this variant. Commits `c167dba` / `37425b4`.

**Revisit if**: Supabase changes its signing-key default again (item 1); a future
capture surface is reached by a client-side `<Link>` (item 2 — must hard-navigate);
or cross-device (not just cross-tab) live banner updates are needed — tracked in
`docs/BACKLOG.md` as a Supabase Realtime follow-up, since items 3/4 are
same-browser-only by design.

---

## 2026-05-29 — hotfix(005 recon): LBP-TOP ROI resize must use the training interpolation (INTER_LINEAR)

**Status**: Accepted.

**Decision**: `packages/ml-video` `features._roi_crop` resizes each ROI to 64×64
with cv2's default `INTER_LINEAR`. The extractor had overridden this with
`cv2.INTER_AREA`; that override is removed.

**Why it mattered**: the training notebook
(`video-lbp-top-motion-per-subject-calibration.ipynb`, identical to the handoff's
`refactored_v2` aside from Kaggle output cells) resizes ROIs with a bare
`cv2.resize(roi, (64, 64))` — i.e. the `INTER_LINEAR` default. `INTER_AREA` is the
textbook-better downscale filter, but it yields different 64×64 pixels → different
LBP codes → a 90-d LBP-TOP block (`f0..f89`) that lives in a *different feature
space* than the StandardScaler / RandomForest were fit on. The 2868 motion dims
(landmark-coordinate derived) were unaffected; only the 90 LBP dims drifted.

**Why it was silent**: the block still L1-normalizes per plane and still sums to
9.0, so the existing `test_pipeline_fixtures.py` invariant stayed green. Calibration
does NOT cancel the drift — the discrepancy is content-dependent, so
`lbp_area(clip) − lbp_area(anchor) ≠ lbp_linear(clip) − lbp_linear(anchor)`.

**Guard**: `tests/test_lbp_interpolation_fidelity.py` pins the 90-d LBP-TOP output to
a notebook-derived golden (a verbatim port of the notebook's resize + LBP cells run
on a deterministic synthetic clip — no dataset or MediaPipe needed). It fails if
`INTER_AREA` or any non-default resize is reintroduced; the sum-to-9.0 invariant
alone does not.

**🔴 Anchor invalidation**: any anchor produced by the extraction pipeline before
this fix was computed with `INTER_AREA` and is INVALID — its LBP block is out of the
trained space; affected users must re-capture (recalibrate). `model_version` stays
`2.0.0`, so this does NOT trip the handoff's model-version anchor-invalidation path —
nothing auto-invalidates stored anchors. For the thesis/demo, manual re-calibration
of any pre-fix extracted anchors suffices. (The demo seed's synthetic seed-42 anchor
is not extraction-derived and is unaffected.)

**Revisit if**: production gains a separate extraction/pipeline-version field — then
feature-space changes like this should invalidate stored anchors via that field
rather than by manual re-capture (backlog item; not addressed in this hotfix).

## 2026-05-31 — DECISION-22 (005 draft): recalibrate via `?mode=recalibrate`; overwrite-on-success-only; no DB change

**Status**: Draft (feature 005 — consolidated with entries 19–28 at T033).

**Decision**: The account "Set a new baseline" entry launches the *same* capture
flow in recalibrate mode through a **full-document navigation** —
`<a href="/app/calibrate?mode=recalibrate">`, never a `<Link>`/router transition —
so the per-route `camera=(self)` Permissions-Policy applies (DECISION-16, FR-055).
`calibrate/page.tsx` reads `searchParams.mode` and, in recalibrate, **suppresses the
`has_anchor`→`/app` redirect** (the ST-17 guard) so a calibrated user is not bounced
out of their own replacement. The recorder runs with `mode="recalibrate"`: copy
nudges "set"→"update" (success: "Your baseline is updated") and both exits
hard-navigate to **`/app/account`** (first-time exits stay `/app`). The reconciliation
and the exit map are a pure module (`lib/anchor/calibrate-mode.ts` —
`resolveCalibrateMode`/`calibrateExit`) so the decision is unit-tested directly.

**Clarification #3 (hardening)**: `mode` is reconciled against the *real*
`has_anchor`. A stray `?mode=recalibrate` for a user with **no** baseline falls back
to first-time semantics (copy "set", exit `/app`) — the URL alone never manufactures
a recalibration. Conservative on a null/error `has_anchor`: treated as
not-calibrated, so a transient RPC failure neither redirects nor spuriously
recalibrates.

**Overwrite-on-success-only**: the existing client write path (decode `vector_b64` →
bytea → `UPDATE` the owner's `profiles` row) already runs **only** after a successful
extraction, so stop / processing-failure / "Not now" / "Maybe later" naturally leave
the prior baseline untouched. The write is the same single in-place `UPDATE` for both
first-time and recalibrate — **no baseline history, no new table, no migration** (the
DECISION-12 UPDATE whitelist already permits the owner to overwrite their anchor
columns). An honest test injects the Supabase client and asserts `.update()` fires
exactly once on success and **never** on any abort/defer
(`anchor-recorder.write-gating.test.tsx`).

## 2026-05-31 — DECISION-23 (005 draft): account "Your calm baseline" is whether-set-only; capture date NOT surfaced

**Status**: Draft (feature 005 — consolidated with entries 19–28 at T033).

**Decision**: The account "Your calm baseline" section surfaces **only whether** a
baseline is set (from the scope-guarded `has_anchor(auth.uid())` boolean) plus the
"Set a new baseline" action. It does **not** surface the capture date or any
timestamp (FR-041), and it renders only for **employees** (team_lead/admin have no
anchor flow — Principle I).

**Why**: the date column was deliberately hidden from everyone — including the
owner's own read — in DECISION-12, to deny managers a calibration-timing pressure
signal. Surfacing even the owner's own date would need a new self-scoped
SECURITY DEFINER read, a DB surface this redesign does not require; the spec defaults
to whether-set-only (FR-041). A self-scoped date read is a clean future addition when
feature 006's inference read path lands. The section never exposes another user's
state or date.

**Voice (FR-040)**: the copy talks about the baseline itself and must not imply that
live stress monitoring or check-ins are already running; calm, no exclamation marks.
Enforced by an RTL assertion over the rendered section text
(`baseline-section.test.tsx`).

## 2026-05-31 — DECISION (005): home calibration banner CTA meadow → foggy

**Status**: Accepted (feature 005, T028).

**Decision**: The `/app` calibration banner is restyled amber → **foggy** (surface
border + bg), and its primary CTA — relabelled "Set baseline" — uses the
**foggy-filled** `Button` variant (`variant="foggy"`: `bg-foggy` with `text-ink` /
`dark:text-bg`), the *same* CTA treatment already shipped this cycle on the
failure-state and the three camera-access screens. The CTA is **foggy, not meadow**.
The lifecycle is untouched: `useSyncExternalStore` + session-dismiss +
`broadcastAnchorBannerDismissed` + the cross-tab mirror are preserved verbatim, and
the `aria-label="Calibration"` region (which the Playwright cross-tab spec keys off)
is unchanged. The CTA remains a full-document `<a href="/app/calibrate">` (Button
`asChild`), guarded by a source-level test, so the per-route `camera=(self)`
Permissions-Policy still applies (FR-055 / DECISION-16). Render-site employee-gating
already existed on `/app` (`profile.role === "employee"`, the same determination the
account baseline section uses) — not duplicated.

**Why this is an application of Principle V, not an amendment to it**: Principle V's
palette roles are unchanged — amber stays reserved for stress/affective signals,
crimson for destructive surfaces, meadow for affirmative confirmation, foggy for the
calm "needs your attention, not stress" state. The original task text said *meadow*
for the banner button; that was reconsidered because the banner is an **attention
prompt**, not an **affirmative confirmation** — so foggy (attention) is the correct
role, and meadow (reserved for "you did it" moments like the success state) would be
a misapplication. This refines *which* calm colour the CTA-colour rule selects for an
attention CTA; it does not alter any principle, so it is logged here rather than as a
constitution amendment. Spec FR-043 and the T028 task line are aligned to read foggy.

**AA note**: foggy fill + ink text clears WCAG AA in both themes
(`text-ink` ~6.8:1 light, `dark:text-bg` ~9:1 dark on the foggy fill); a white/ink
fill on the foggy wash would not, which is the practical reason the shared
`variant="foggy"` exists rather than a hand-rolled fill.

## 2026-05-31 — DECISION-25 (005 draft): device-memory — re-persist the resolved default on a cleared store

**Status**: Draft (feature 005, T029 — consolidated with entries 19–28 at T033).

**Decision**: `device-picker.tsx`'s mount effect now (re-)writes the remembered-camera
preference when the store is **empty/cleared** and a real default camera resolves
(`if (!stored && next) rememberCamera(next)`), so a cleared preference recovers for
the session rather than silently staying empty (FR-045). The write is guarded on
`!stored`, so a **stored-but-temporarily-absent** device is never clobbered — its
memory is kept and it is re-preferred when it reconnects (preserving FR-005).

**What the earlier busy-camera fix already covered (the bulk of DECISION-25)**: the
inescapable-lockout fix had already moved all *selection-time* persistence out of the
picker into the orchestrator, which writes **only a device that getUserMedia actually
started** and **repairs a dead key** by falling back to the system default and
persisting whatever started. Those two invariants (only-write-what-started,
repair-on-failure) are untouched. The picker still does **not** persist a user
*selection* — a busy/dead pick is never remembered until it starts.

**The remainder this task implemented**: only the mount-effect's auto-resolved
default was never persisted, so a *cleared* store never re-seeded for the session —
the one resolution the orchestrator can miss (a started track may expose no
`deviceId`). Persisting it does not re-introduce the lockout: it fires only when
nothing is stored (never over a known-good device), and a busy persisted default is
still repaired on the next entry by the orchestrator's fallback. An honest Vitest
(`device-picker.test.tsx`) **fails against the pre-fix code** (cleared store + one
camera → the preference is null, expected the resolved id) and passes after; sibling
cases assert the don't-clobber guard and that a still-present remembered device is
left untouched. The prior "writes nothing" test was reconciled to assert the real
invariant (a *selection* is never persisted; the mount default is).

## 2026-05-31 — DECISION (005): e2e detector injection seam + the FR-050 egress proof (T031)

**Status**: Accepted (feature 005, T031).

**Decision**: `lib/face-detect/detector.ts::createFaceDetector` reads an optional
`window.__anchorE2EDetector__` factory *first* and, when present, returns it instead
of loading the real WASM. **No application code ever sets it** — it is written only by
a Playwright `addInitScript` (`installActiveDetector`) — so it is inert in production
and guarded by presence. This is the DECISION-26 "inject the detector" seam at the
e2e layer: it lets the **real** `useFramingGuide` loop + the **real** framing gate run
against a deterministic centred-face detector, so the soft gate clears without a real
face (BlazeFace sees none in a headless browser) and the flow reaches the full
recording. The fake feed is painted bright each rAF so the on-device luma read clears
the too-dark floor.

**Why it earns its keep**: it is what makes the **NON-NEGOTIABLE** FR-050/SC-014
egress proof (`anchor-egress.spec.ts`) possible as an *active-pipeline* assertion —
Playwright intercepts every request across BOTH the green room (framing loop running)
and the full 60 s recording and proves, at the green-room / mid-recording / post-success
checkpoints, that **(a)** no VIDEO payload egresses (multipart `.webm`/`.mp4` clip part
or `video/*` Content-Type) except the single final clip POSTed to `/anchor` on success,
**and (b)** — strengthened 2026-06-01 — **no outbound body of ANY kind** reaches a
non-allowlisted destination, so a frame leak disguised as JSON/base64/image bytes to any
URL is caught too. The benign allowlist is exactly: the final `/anchor` clip POST; the
Supabase host (auth/token + the derived-hex anchor-vector write); and same-origin Next
**server actions** (matched by the `Next-Action` header — the sign-in auth RPC; a bespoke
frame leak would be a headerless fetch/beacon and stay flagged). Verified: across the
framing phases there are **zero** body-carrying requests at all (the clip POST + Supabase
write both fire only at success). Verified passing on chromium. Without the seam, the
only deterministic CI option is the detector-unavailable bypass, which would never
exercise the framing pipeline active.

**Scope**: the three stale 004 e2e specs (`anchor-onboarding`, `anchor-health-precheck`,
`anchor-skip`), which were `test.skip(true, "…re-author under T031")`, are removed and
re-authored into the 005 consolidation (`anchor-flow`, `anchor-camera-access`,
`anchor-banner`, plus the re-authored `anchor-cross-tab`). Genuinely device/browser-
dependent behaviour (real webcam, real OS prompts, the real detector clearing the gate
on a real face, the weak-device unavailable fallback) is **deferred to smoke-tests.md**
with an explicit note — not faked green. No backend/DB/seed change.

---

## 2026-06-08 — feature 005 architecture decisions (collected & finalised; 📌 DECISION-19 through DECISION-28)

This block **finalises** (Status: Accepted) the architectural decisions of feature
005 (calibration-capture-flow) and folds every mid-cycle 005 record into the planned
**19–28** numbering: the three numbered drafts (DECISION-22/23/25, dated 2026-05-31)
and the two dated-but-unnumbered Accepted notes — the **banner CTA meadow→foggy**
decision (2026-05-31, folded into DECISION-28) and the **e2e detector-seam / FR-050
egress-proof** note (2026-05-31, strengthened 2026-06-01, folded into DECISION-26).
Source tasks are named per entry and traceable to 📌 markers in
`specs/005-calibration-capture-flow/{tasks.md, plan.md, data-model.md, contracts/}`.
This collected block is authoritative; the 2026-05-29 → 2026-06-01 draft entries above
are the preserved mid-cycle record (append-only, Principle VIII).

**Whole-feature invariant**: feature 005 is **UI / read-path only** — no migration, no
backend or contract change, no seed change. The web app reuses feature 004's extraction
service, the `/healthz` gate, the scope-guarded `has_anchor(auth.uid())` RPC, and the
owner-side anchor write verbatim (`contracts/backend-unchanged.md`).

---

### 📌 DECISION-19 — On-device framing system: self-hosted detector + pure gate/drift + throttled live guide

**Status**: Accepted.

**Decision**: The live framing guide is computed **entirely on-device** in three layers.
(1) `lib/face-detect/detector.ts` lazily loads a **self-hosted** MediaPipe Tasks-Vision
BlazeFace detector from same-origin `/face-detect/` (vendored WASM, gitignored, re-copied
by `next.config.ts` on dev start) behind a `WebAssembly` capability probe and a **hard
init timeout** (~4.5 s) → `Promise<DetectorHandle | null>` that never hangs. (2)
`lib/face-detect/framing.ts` is **pure** (frame signal + prior debounce → verdict + next
debounce; no DOM, timers, or I/O) with forgiving named thresholds (`CENTRE_MAX`,
`LUMA_MIN`, `SIZE_MIN/MAX`, `SET_DEBOUNCE_MS`, `DRIFT_GRACE_MS`): only no-face /
badly-off-centre / too-dark hold the soft gate, and a drift wobble shorter than the grace
window produces **no** nudge. (3) `lib/face-detect/use-framing-guide.ts` binds a
`<video>` to the detector through a throttled loop (~7 fps green room, ~3.5 fps recording,
on a downscaled frame + canvas luma) and exposes `loading → active | unavailable`.
**`unavailable` bypasses the gate** (`ready = true`) so the user is **never locked out**
(FR-011). Nothing here ever auto-stops, and no frame leaves the browser (Principle I,
FR-050).

**Source tasks**: T002 (asset self-host), T005 (loader), T006 (pure framing), T007 (live
loop). Revisit if the detector model or the fps budget changes (Risk R-3).

---

### 📌 DECISION-20 — Scoped CSP delta: `'wasm-unsafe-eval'` on capture routes only (report-only; enforce = the T004 deploy blocker)

**Status**: Accepted (report-only). **Flipping to enforce is open as T004.**

**Decision**: Compiling the DECISION-19 detector's WASM requires `'wasm-unsafe-eval'` in
`script-src`. `proxy.ts`'s `buildCsp(nonce, pathname)` appends it (plus a provisional
`worker-src 'self' blob:`) **only** on the two capture routes (`/onboarding`,
`/app/calibrate`) — present there, absent on every other route. **No `connect-src` host
is added** (the detector is same-origin under `connect-src 'self'`) and **COEP stays
unset** (enabling it would break Supabase cross-origin). The allowance currently ships
**Report-Only**. Flipping it to **enforce** — after a `securitypolicyviolation` sweep
narrows the minimal set (dropping `worker-src` if no blob worker is needed) — is **T004**,
a **hard pre-ship deploy blocker** logged in `docs/BACKLOG.md` ("Before the 005 detector
ships"); the detector must not reach production under report-only.

**Source tasks**: T003 (scoped delta, report-only — done), **T004 (sweep + flip to
enforce — OPEN)**. `contracts/face-detection.md` §4, FR-050, Risk R-2.

---

### 📌 DECISION-21 — Recorder state-machine redesign (settle-before-record; 3-way camera split; mode; strike semantics)

**Status**: Accepted.

**Decision**: `use-anchor-recorder.ts` stays a **pure reducer** (+ a derived selector) so
it is unit-testable in isolation while the orchestrator owns every side effect. The 004
machine is redesigned: new `intro` / `green-room` / `get-ready` / `stop-confirming`
states let the user **settle before anything records**; the old `permission-denied`
splits into **three calm camera states** (`camera-blocked` / `camera-busy` /
`camera-no-device`) mapped from the `getUserMedia` `error.name` by the pure
`cameraErrorKind`; a mount-fixed `mode: "first-time" | "recalibrate"`; framing readiness
carried through; and the strike semantics preserved — **only a backend 422 increments
`failureCount`** (transport and camera errors are never strikes), with the "continue
without calibration" escape at `failureCount ≥ 3`.

**Source tasks**: T008 (reducer); transitions + the error mapping are unit-tested directly
(`use-anchor-recorder.test.ts`). FR-053, FR-031–035, FR-027/028.

---

### 📌 DECISION-22 — Recalibrate via `?mode=recalibrate` (full-doc nav; mode reconciled against `has_anchor`; overwrite-on-success-only; no DB change)

**Status**: Accepted (finalises the 2026-05-31 draft).

**Decision**: The account "Set a new baseline" action launches the *same* capture flow in
recalibrate mode through a **full-document navigation** —
`<a href="/app/calibrate?mode=recalibrate">`, never a `<Link>`/router transition — so the
per-route `camera=(self)` Permissions-Policy applies (DECISION-16, FR-055).
`calibrate/page.tsx` reads `searchParams.mode` and, in recalibrate, **suppresses the
`has_anchor`→`/app` redirect** so a calibrated user is not bounced out of their own
replacement. The recorder runs `mode="recalibrate"`: copy nudges "set"→"update" (success
"Your baseline is updated") and both exits hard-navigate to **`/app/account`** (first-time
exits stay `/app`). The reconciliation + exit map are a pure module
(`lib/anchor/calibrate-mode.ts` — `resolveCalibrateMode` / `calibrateExit`), unit-tested
directly.

**Clarification #3 (hardening)**: `mode` is reconciled against the **real** `has_anchor`
— a stray `?mode=recalibrate` for a user with **no** baseline falls back to first-time
semantics (the URL alone never manufactures a recalibration); a null/error `has_anchor` is
treated as not-calibrated, so a transient RPC failure neither redirects nor spuriously
recalibrates.

**Overwrite-on-success-only**: the existing client write (decode `vector_b64` → bytea →
`UPDATE` the owner's `profiles` row) already runs **only** after a successful extraction,
so stop / processing-failure / "Not now" / "Maybe later" leave the prior baseline
untouched. The write is the **same single in-place `UPDATE`** for both modes — **no
baseline history, no new table, no migration** (the DECISION-12 column whitelist already
permits the owner to overwrite their own anchor columns). An honest test injects the
Supabase client and asserts `.update()` fires exactly once on success and **never** on any
abort/defer (`anchor-recorder.write-gating.test.tsx`).

**Source tasks**: T025, T026, T027. FR-036/037/053/055, DECISION-16.

---

### 📌 DECISION-23 — Account "Your calm baseline" is whether-set-only; capture date NOT surfaced; employees only

**Status**: Accepted (finalises the 2026-05-31 draft).

**Decision**: The account "Your calm baseline" section surfaces **only whether** a
baseline is set (from the scope-guarded `has_anchor(auth.uid())` boolean) plus the "Set a
new baseline" action. It does **not** surface the capture date or any timestamp (FR-041),
and renders only for **employees** (team_lead/admin have no anchor flow — Principle I).

**Why no date**: the `anchor_captured_at` column was deliberately hidden from everyone —
including the owner's own read — in DECISION-12, to deny managers a calibration-timing
pressure signal. Surfacing even the owner's own date would need a new self-scoped SECURITY
DEFINER read this redesign does not require; whether-set-only is the spec default
(FR-041). A self-scoped date read is a clean future addition when feature 006's inference
read path lands.

**Voice (FR-040)**: the copy talks about the baseline itself and must not imply that live
stress monitoring or check-ins are already running; calm, no exclamation marks — enforced
by an RTL assertion over the rendered section (`baseline-section.test.tsx`).

**Source tasks**: T025. FR-040/041.

---

### 📌 DECISION-24 — Cause-telemetry → adaptive failure chip (low-light / out-of-frame / our-side default)

**Status**: Accepted.

**Decision**: During recording the orchestrator accumulates **pure** `CauseTelemetry`
(`darkFrames` / `offTargetFrames` / `totalFrames` / `detectorAvailable`) from the same
on-device framing signals (`lib/face-detect/cause-telemetry.ts`), then collapses it to one
`dominantCause()` ∈ {`low-light`, `out-of-frame`, `our-side`} that drives the post-422
failure chip (`failure-state.tsx`). A user-side cause must dominate ≥ `CAUSE_MIN_RATIO`
(0.35) of measured frames to be claimed; otherwise — and **whenever the detector was
unavailable** (no frames) — the chip defaults to **our-side**, which carries no "do
better" instruction. The mapping is pure and unit-tested. The failure surface is **foggy,
never amber/crimson** (FR-046). Guiding principle: never assert a user-side cause we did
not measure.

**Source tasks**: T021 (accumulation), T024 (failure-state surface + chip). FR-027–030.

---

### 📌 DECISION-25 — Device-memory: re-persist the resolved default on a cleared store, without clobbering a temporarily-absent device

**Status**: Accepted (finalises the 2026-05-31 draft).

**Decision**: `device-picker.tsx`'s mount effect now (re-)writes the remembered-camera
preference when the store is **empty/cleared** and a real default camera resolves
(`if (!stored && next) rememberCamera(next)`), so a cleared preference recovers for the
session rather than staying silently empty (FR-045). The write is guarded on `!stored`, so
a **stored-but-temporarily-absent** device is never clobbered — its memory is kept and
re-preferred when it reconnects (FR-005).

**Relationship to the busy-camera fix**: the inescapable-lockout fix (CHANGELOG
2026-05-31) had already moved all *selection-time* persistence into the orchestrator, which
writes **only a device that `getUserMedia` actually started** and **repairs a dead key** by
falling back to the system default. Those invariants are untouched; the picker still never
persists a mere *selection*. This task added only the mount-effect's auto-resolved default
(the one resolution the orchestrator can miss — a started track may expose no `deviceId`).
Persisting it cannot re-introduce the lockout: it fires only when nothing is stored, and a
busy persisted default is still repaired on next entry. An honest Vitest
(`device-picker.test.tsx`) **fails against the pre-fix code** (cleared store + one camera →
null preference) and passes after; siblings assert the don't-clobber guard.

**Source tasks**: T029. FR-045/005; the device-memory honest-test is FR-052.

---

### 📌 DECISION-26 — Honest-test boundary seams + the e2e detector seam + the two-layer FR-050 egress proof

**Status**: Accepted (folds in the 2026-05-31 e2e-seam note, strengthened 2026-06-01).

**Decision**: Every 005 test injects **only at the unavoidable I/O boundary**
(`getUserMedia`, `MediaRecorder`, `postAnchor`, `checkHealth`, the detector factory, the
session Supabase client) and exercises the **real** orchestration / gate / drift / reducer
logic — never mocking the unit logic green. Two seams make this airtight:

- **e2e detector seam**: `detector.ts::createFaceDetector` reads an optional
  `window.__anchorE2EDetector__` factory **first** and returns it when present. **No
  application code ever sets it** — only a Playwright `addInitScript` (`installActiveDetector`)
  does — so it is inert in production and guarded by presence. It lets the **real**
  `useFramingGuide` loop + framing gate run against a deterministic centred-face detector
  over a bright synthetic feed, so the soft gate clears without a real face (BlazeFace sees
  none headless) and the flow reaches the full 60 s recording.
- **Two-layer FR-050 egress proof** (`anchor-egress.spec.ts`, NON-NEGOTIABLE per SC-014):
  Playwright intercepts every request across the green room (framing loop running) and the
  full recording and asserts, at the green-room / mid-recording / post-success checkpoints,
  that **(a)** no VIDEO payload egresses (multipart `.webm`/`.mp4` part or `video/*`
  Content-Type) except the single final clip POSTed to `/anchor` on success, **and (b)** —
  strengthened 2026-06-01 — **no outbound body of ANY kind** reaches a non-allowlisted
  destination (so a frame leak disguised as JSON/base64/image bytes is caught too). The
  benign allowlist is exactly: the final `/anchor` clip POST; the Supabase host (auth/token
  + the derived-hex anchor write); and same-origin Next **server actions** matched by the
  `Next-Action` header (a bespoke frame leak would be a headerless fetch/beacon and stay
  flagged). Verified: across the framing phases there are **zero** body-carrying requests at
  all. Passing on chromium.

**Scope**: the three stale 004 specs (`anchor-onboarding`, `anchor-health-precheck`,
`anchor-skip`) are removed and re-authored into the 005 consolidation (`anchor-flow`,
`anchor-camera-access`, `anchor-banner`, `anchor-egress`, re-authored `anchor-cross-tab`).
Genuinely device/browser-dependent behaviour (real webcam, OS prompts, a real face clearing
the gate, the weak-device unavailable fallback) is **deferred to `smoke-tests.md`** with an
explicit note — not faked green.

**Source tasks**: applies to every task; concretely T031 (e2e consolidation + egress proof),
T032 (smoke matrix). FR-050/051/052, SC-014.

---

### 📌 DECISION-27 — Reduced-motion standardised on the shared `useMediaQuery` hook; every animated element has a motion-free equivalent

**Status**: Accepted.

**Decision**: All 005 motion is gated on the **shared**
`useMediaQuery("(prefers-reduced-motion: reduce)")` hook (`hooks/use-media-query.ts`); the
004 `countdown.tsx`'s inline `usePrefersReducedMotion` is refactored onto it. Every animated
element ships a **motion-free equivalent that preserves the information**: the breathing orb
holds at a fixed mid-size/opacity while the "Breathe in"/"Breathe out" label still swaps on
the 4 s-in / 6 s-out cadence; the 3→2→1 countdown drops the zoom/fade and shows numeral
ticks; the success check is static (no bloom); the corner-bracket drift keeps its **foggy
hue** without the blink; the preview-blur transition is instant. This is the WCAG SC
2.3.3-correct behaviour (FR-048).

**Source tasks**: T001 (standardisation), consumed by T010/T012/T013 and the recording /
success surfaces. `contracts/components.md`, FR-048/049.

---

### 📌 DECISION-28 — 005 supplants the 004 calibration surfaces (old UI removed; recorder remounted; home banner amber→foggy with a foggy CTA; `mode` the only behavioural fork)

**Status**: Accepted (folds in the 2026-05-31 banner CTA meadow→foggy note).

**Decision**: The 005 redesign **replaces** feature 004's calibration surfaces wholesale.
The old 004 calibration UI is **fully removed — no stragglers** — and the redesigned
`<AnchorRecorder>` mounts at both the onboarding first-time capture
(`(onboarding)/onboarding/onboarding-form.tsx`) and the standalone `/app/calibrate` route; a
static check asserts no removed component is still imported (clarification #1). `mode`
("first-time" | "recalibrate") is the **only** behavioural fork — it nudges copy and (via the
host) the exit destinations, nothing else.

**Home calibration banner (amber→foggy; foggy CTA — folds in the 2026-05-31 note)**: the
`/app` banner that 004 shipped **amber** is restyled **foggy** (surface border + bg), and its
primary CTA — relabelled "Set baseline" — uses the **foggy-filled** `Button` variant
(`bg-foggy` + `text-ink`/`dark:text-bg`), the same treatment shipped on the failure-state and
the three camera-access screens. The CTA is **foggy, not meadow** (the original task text said
meadow): the banner is an **attention prompt**, not an **affirmative confirmation**, so foggy
(attention) is the correct Principle V role and meadow (reserved for "you did it" moments like
the success state) would be a misapplication — this refines *which* calm colour the rule
selects, so it is an **application** of Principle V, not an amendment (FR-043). The lifecycle
is untouched (`useSyncExternalStore` + session-dismiss + `broadcastAnchorBannerDismissed` +
cross-tab mirror + the `aria-label="Calibration"` region the Playwright spec keys off), the
CTA stays a full-document `<a href="/app/calibrate">` so the per-route `camera=(self)` policy
applies (FR-055 / DECISION-16), and render-site employee-gating already existed. **AA**: foggy
fill + ink text clears WCAG AA in both themes; a white/ink fill on the foggy wash would not,
which is why the shared `variant="foggy"` exists.

**Source tasks**: T018 (old-UI removal + mount), T028 (banner restyle). Clarification #1,
FR-043/055, Constitution Principle V (applied, not amended).

---

## 2026-06-16 — fix(ml-video): VFR-webm decode mis-sampling — timestamp-driven frame sampling

### 📌 DECISION-29 — VFR-webm decode mis-sampling fix — timestamp-driven frame sampling

**Status**: Accepted; validated. Branch `fix/webm-vfr-decode-sampling` → PR #18 into `main`.
A decode-sampling fix only — no change to the usable-face-coverage gate, the `(N_kept, 956)`
`DecodedClip` contract, the feature dimensions, or any HTTP response.

**The bug.** `pipeline.extract_landmarks` decodes a calibration/anchor clip and downsamples
toward the model's ~2.5 fps working rate (`MODEL_HANDOFF §3` Steps 1–2: keep every
`skip_ratio`-th frame to ≈5 fps, then a `%2` step to ≈2.5 fps). `skip_ratio` was
`max(1, round(reported_fps / TARGET_FPS))` with `TARGET_FPS = 5`, reading `reported_fps`
from OpenCV's `CAP_PROP_FPS`. Production captures come from the browser (`getUserMedia` +
`MediaRecorder` → Chrome VP9 webm), which is **variable-frame-rate**: the container carries
no fixed frame rate, only per-frame timestamps on a 1 ms timebase. OpenCV/FFmpeg then *guess*
`CAP_PROP_FPS` from container metadata, and the guess is unreliable and unstable — two real
~60 s captures from the **same browser and format** read:

| reported_fps | frame_count | skip_ratio | raw decoded | kept | outcome |
|---|---|---|---|---|---|
| 8.417 | 504 | 2 | 505 | 126 | fine |
| 1000.0 | 59 890 | 200 | 1 738 | 4 | **collapsed** |

Because `skip_ratio` is derived from this garbage, the kept-frame count was **nondeterministic
for identical input** — sometimes ≈126, sometimes 4. A dev harness reproduced the pathology
exactly on a real Chrome `MediaRecorder` webm: `reported_fps = 1000.0`, `frame_count = 11 452`
for a clip that truly held 269 frames over 11.45 s (note `1000 fps × 11.451 s ≈ 11 451` —
OpenCV multiplies the 1/timebase "fps" by the true duration to fabricate the frame count),
and the legacy sampler kept **1** frame.

**Why it mattered (latent, silent, every capture).** The damage was twofold. (a) **Fidelity:**
the model's video features (LBP-TOP texture + landmark motion) were validated at the
temporally-even ≈2.5 fps density a CFR clip produces (~150 frames per 60 s). When `skip_ratio`
is wrong, live captures are sampled at an inconsistent, often far-too-sparse density, so the
feature vector lands in a different distribution than the one the StandardScaler/RandomForest
were fit on — and worse, the **anchor** (per-user 60 s baseline) and subsequent **live
readings** could be sampled at *different* rates, corrupting the delta-from-baseline that
Constitution **Principle II** makes the unit of every prediction. This degraded silently on
essentially every browser capture. (b) **Availability:** a capture collapsed to a handful of
frames intermittently false-rejects a perfectly good baseline downstream. The bug was **latent
since the capture flow first shipped** (feature 004); it was finally surfaced by feature 006's
usable-face-coverage gate **smoke test**, where the same good clip passed on one run and failed
on the next — a textbook case of an **end-to-end smoke test catching what unit tests
structurally could not** (the unit tests fed CFR synthetic clips, on which the legacy sampler
is correct; only a real VFR webm exposes the metadata pathology).

**The fix — hybrid, container-agnostic sampling.** Frame selection is decided from the frames'
**actual presentation timestamps** (`CAP_PROP_POS_MSEC`), which a one-time empirical probe
showed are **reliable and strictly monotonic** on these `MediaRecorder` webms (the timestamps
are real even when the derived fps/frame-count are not). `extract_landmarks` is now two-pass:
**pass 1** walks the clip with `cap.grab()` (advances the decoder and updates `POS_MSEC`
*without* the pixel `retrieve()`, ~25 % cheaper) to collect per-frame timestamps; **pass 2**
sequentially re-decodes and retrieves only the selected frames (sequential, never `seek` —
seeking is itself unreliable on VFR webm). The selection policy (`_select_keep_indices`):

- **CFR / reliable metadata** — intervals near-uniform (inter-frame-interval coefficient of
  variation ≤ 0.05) **and** `reported_fps` within 10 % of the timestamp-derived true fps →
  keep the **legacy index selection bit-for-bit**. The model-validated mp4/avi path is
  therefore *byte-identical*, at any frame rate.
- **VFR / garbage metadata** — sample by timestamp on a fixed **2.5 fps grid** phased at
  200 ms, keeping the first frame in each 400 ms bucket. The 200 ms phase is chosen so that,
  on a constant-rate stream, this rule selects *exactly* the frames the legacy index path
  keeps — i.e. the timestamp sampler is a strict generalisation, not a replacement. A large
  gap simply leaves intervening buckets empty (no catch-up clustering). Result: ≈150 kept
  frames per 60 s regardless of what fps the container reports.
- **Fallback** — if timestamps themselves are unusable (non-monotonic or zero span), fall
  back to the legacy index path (today's behaviour; no regression).

**No new dependency was added.** Because `POS_MSEC` proved reliable, the alternative of
transcoding the upload to CFR with FFmpeg before decode was **deliberately not taken** — it
would add an `ffmpeg` runtime binary to the API's deployment surface for no fidelity benefit.
(FFmpeg/`ffprobe` are present on the dev box and were used only to *probe* clips.)

**Why hybrid rather than a single universal timestamp sampler.** A pure fixed-2.5 fps
timestamp sampler is bit-identical to the legacy selection only when the frame rate is a
multiple of 5 (e.g. 30 fps); for other CFR rates the `round(fps/5)` quantisation makes the two
diverge by 1–2 frame positions (measured on a 24 fps clip: same kept *count*, but indices
`[5,15,25,35,45,55,65]` legacy vs `[5,15,24,34,44,53,63]` naive-timestamp). Routing CFR
through the **legacy** path keeps the validated mp4 fidelity exact for **all** frame rates,
while still moving every VFR webm onto the consistent 2.5 fps grid. CFR-vs-VFR separates
cleanly in the data (interval CoV ≈ 0.0000 for mp4/avi vs ≈ 1.6 for the real webm), so the
classifier has an enormous margin.

**Validation.** Real Chrome webm captures now yield **kept ≈ 150 consistently** across
`reported_fps` of 8.4, 1000, and deliberate metadata-mismatch — the kept count is finally a
function of the clip's *duration*, not its (garbage) reported fps — and `usable ≈ kept` on a
full face-present capture. CFR `mp4` (30 fps) and `avi` (24 fps) select the **identical**
frames to the pre-fix pipeline (verified at the index level, not merely by count). Tests:
`packages/ml-video/tests/test_vfr_sampling.py` pins garbage-fps consistency, CFR-unchanged at
30 **and** 24 fps, and the broken-timestamp fallback; full ml-video + apps/api suites green.

**Relation to Principle II (fidelity is load-bearing).** Principle II makes per-user
calibration mandatory: every delivered prediction is a *delta from the user's ~60 s calm
baseline*, so the baseline's feature fidelity is not cosmetic — it is the measurement datum.
This fix does not *alter* the model's feature behaviour; it **restores** it: webm now samples
at the same temporally-even ≈2.5 fps density the model was trained on, and CFR stays
bit-identical. It is therefore an *application* of Principle II (protecting
evaluation/calibration fidelity), not a model change.

**Residual caveat (deferred, not observed).** A webm with **both** a garbage reported fps
**and** unusable timestamps would hit the fallback and could still collapse. This was never
observed — `POS_MSEC` was reliable on every real capture probed — so the FFmpeg
transcode-to-CFR fallback is **deferred**. Revisit (add the transcode path, accepting the
runtime dependency) only if real captures ever exhibit broken timestamps.

**Source.** `packages/ml-video/src/ml_video/pipeline.py` — `_select_keep_indices`,
`_timestamp_keep_indices`, `_index_keep_indices`, `_reported_fps_trustworthy`,
`_timestamps_reliable`, and the two-pass `extract_landmarks` / `_probe_timestamps`. Tests:
`tests/test_vfr_sampling.py`. Dev aid retained for the fidelity re-check:
`packages/ml-video/tools/dev_webm_recorder.html`. A quiet `logger.debug` decode line records
the chosen sampling path per decode. Branch `fix/webm-vfr-decode-sampling`, PR #18.
`MODEL_HANDOFF §3` Steps 1–2.

---

## 2026-06-16 — feature 006 architecture decisions (collected; 📌 DECISION-30 through DECISION-33)

Feature **006 — Calibration Capture Quality**: a backend correctness fix for the 005-era
bug where a 60 s baseline with the face in frame for only ~2 s was silently accepted,
poisoning every later delta-from-baseline reading (Constitution Principle II — per-user
calibration is load-bearing). The fix adds a server-side, authoritative usable-face-coverage
gate in `packages/ml-video/`, surfaced through the **unchanged** `FeatureExtractionError →
HTTP 422 → 005 failure-screen` flow. The four decisions below are collected from
`specs/006-calibration-capture-quality/{research,plan,contracts/*}.md` and the implement run.

### 📌 DECISION-30 — Usable-face-coverage gate: placement, and composition with the existing floors

**Status**: Accepted.

**Decision**: A pure helper module `packages/ml-video/src/ml_video/coverage.py` exposes
`usable_face_coverage(landmarks) -> (usable, kept, fraction)` and
`assert_usable_face_coverage(landmarks)`. `compute_anchor` (`anchor.py`) calls the assert
**immediately after `extract_landmarks` and before `lbp_top_features` / `motion_features`**.
A **usable** frame is a **non-zero landmark row** (`np.any(row)`) — the exact predicate
`lbp_top_features` already uses to skip no-detection frames and the same all-zero `(956,)`
row `pipeline._landmarks_from_result` emits when no face is detected; the gate **counts a
signal that already exists, it adds no detector**. The gate is **additive and strictly
stricter**: it runs *ahead* of the existing degenerate floors (`lbp_top_features` needs ≥1
usable frame per ROI; `motion_features` needs ≥2 kept frames — neither is a coverage check),
short-circuits thin clips before the heavier LBP-TOP / motion work, and **never loosens**
the floors (control still flows into them when the gate passes). It lives **inside the
package** (Principle III), not the API router (which has no access to the landmark rows).
Confirmed gate-cannot-touch-inference: `compute_anchor` is the **baseline-capture-path-only**
entry point; live inference uses the distinct `Predictor.predict_delta`, which has zero
`apps/` callers (T003 path trace).

**Source tasks**: T003 (path confirmation), T004–T010 (gate core + wiring, TDD), research.md
Decision 1, `contracts/gate.md`, `contracts/unchanged.md`. FR-001–007.

### 📌 DECISION-31 — Rejection messaging: new `insufficient_face_frames` reason in the existing 422 (categorical-only, counts log-only) + server-reason precedence

**Status**: Accepted.

**Decision**: No existing 005 chip covers "face not visible for enough of the recording" —
the client `dominantCause` returns **`our-side`** in exactly the detector-unavailable case
(FR-011) the server gate must explain — so add **one** new reason value
`insufficient_face_frames`, carried **inside the existing 422 `reason` field**, mapped to
**one** new client `insufficient-face` chip. Mechanism: `FeatureExtractionError(message, *,
code: str | None = None)` (backward-compatible; existing raises keep `code=None`); the gate
raises with `code="insufficient_face_frames"`; the router maps `reason = getattr(exc, "code",
None) or str(exc)` — **same endpoint, status, and `{error, reason}` shape**. The chip is
selected by **server-reason precedence**: in `submitClip`, `result.reason ===
"insufficient_face_frames" ? "insufficient-face" : dominantCause(...)`; **every other reason
still selects via `dominantCause`, unchanged** (incl. detector-unavailable → `our-side`), and
the three existing chips are byte-for-byte untouched. **Privacy is load-bearing**: the
`usable` / `kept` / `fraction` counts live **only in a server `logger.info` line** — the
exception message is generic ("insufficient usable face coverage") and the wire reason is the
categorical token, so **no numeric detail leaks even via `str(exc)`** (Principle I / FR-016).
The chip copy is calm Principle-V voice: *"We couldn't see your face for enough of that
recording — let's try again."* (no exclamation, no "detected"/alarmist term, foggy surface).

**Source tasks**: T005/T006 (error.code + generic message), T017–T022 (router + chip, TDD),
research.md Decision 2, `contracts/messaging.md`. FR-009–016.

### 📌 DECISION-32 — Threshold calibration: `MIN_COVERAGE_FRACTION = 0.65` / `MIN_USABLE_FRAMES = 50`, recalibrated against four real browser-webm clips on the fixed VFR decode

**Status**: Accepted (still **provisional** — revisit against real-user data; see caveats).

**History (why these numbers moved).** The gate was first calibrated against three developer
clips handled as mp4 (`thin 4/172/0.023`, `good-ideal 154/154/1.000`, `good-realistic
129/129/1.000`), which gave `MIN_COVERAGE_FRACTION = 0.40` sitting in a "wide empty gap." But
those clips were measured through the **pre-fix decode**, which mis-sampled variable-frame-rate
browser webm (DECISION-29). Once the VFR-timestamp decode landed, the calibration was **redone
on real browser webm through the fixed pipeline — the path production actually runs — and a
deliberate half-present boundary clip was added** to populate the previously empty gap. The
webm recalibration **supersedes** the mp4 figures; only it is load-bearing.

**Decision**: The two constants are set by running four real developer clips (never StressID
media; raw clips never committed — Principle I/X) through the **real** pipeline in the **pinned
env** (Python **3.12.13**, `mediapipe==0.10.13`, `uv run`; **not** a 3.9 conda env, whose
different build would shift detection and invalidate the calibration), each clip's extracted
landmark array committed as a `.npy` fixture so CI never runs mediapipe. All four are real
browser `.webm` decoded on the **VFR timestamp path** (reported `fps=1000` is garbage; true
~28.7–30.1 fps — DECISION-29).

Measured `kept / usable / fraction` (the recalibration):

| Clip | kept | usable | fraction | duration | verdict @ 0.65 |
|------|-----:|-------:|---------:|---------:|----------------|
| thin           | 150 |  11 | **0.073** | 59.97 s | reject (face ~2–3 s only) |
| good-ideal     | 150 | 150 | **1.000** | 59.94 s | accept |
| good-realistic | 151 | 151 | **1.000** | 60.29 s | accept (natural look-aways) |
| half           | 150 |  77 | **0.513** | 59.97 s | reject (~30 s present / 30 s absent) |

Chosen: **`MIN_COVERAGE_FRACTION = 0.65`** (primary lever — the face-absent bug) and
**`MIN_USABLE_FRAMES = 50`** (secondary backstop — too-short captures). `thin` fails **both**;
`half` clears the floor (77 ≥ 50) but the **coverage lever rejects it** (0.513 < 0.65, a 0.137
margin); both good clips clear **both** by 0.35 on coverage.

**Reasoning.**

- **Legitimate captures cluster at ~1.0.** `good-realistic` held at **1.000** coverage despite
  genuine seated look-aways — FaceMesh tracks the face through brief glances / turns; coverage
  only collapses when the face *truly leaves the frame*. So raising the gate to 0.65 does **not**
  clip honest captures: both good clips sit 0.35 above it.
- **Coverage ≈ fraction-of-minute-present is validated.** `half` (~30 s present / ~30 s absent)
  measured **0.513**, almost exactly the 0.5 that even-time frame sampling predicts. The gate
  fraction is therefore a faithful proxy for "what share of the minute the face was actually
  visible," so **0.65 ≈ face present ≥ ~40 s of the 60 s**.
- **The anchor is the reference every later delta is measured against** (Principle II). A
  half-absent baseline is incomplete and possibly biased toward whatever the camera saw in the
  present half, so it must be **rejected** — a redo costs the user one minute, whereas a poisoned
  baseline silently corrupts every downstream reading. The absolute floor (50) is the backstop
  for the other failure mode: a very short clip with high coverage but too few frames to anchor.

**Honest caveats (thesis).**

- **One intermediate datapoint.** Only `half` lies between the egregious `thin` (0.073) and the
  saturated good clips (1.000). The separation is clean, but the exact knee is pinned by a single
  sample at 0.513.
- **Accept-side absence tolerance is extrapolated.** 0.65 implies tolerating up to ~35% absence
  (~15–20 s of a 60 s minute) on the accept side, but we have **no measured sample** between
  0.513 and 1.000 — that tolerance is inferred from the validated linearity (`half` ≈ 0.5), not
  directly observed.
- **Real-world distribution unknown until deployment.** How often genuine users land below 0.65
  is not yet known. This is now **observable**: the `apps/api` production logging config emits the
  reject line (`coverage reject: usable=… kept=… fraction=…`, server-side only — Principle I /
  FR-016), so the reject rate can be measured in the field and the threshold tuned from real data.

**Calibrated-floor interaction (recorded so it is not mistaken for a regression).** The 50-
frame absolute floor exceeds the kept-frame count of the short *synthetic* test clips (the
ml-video 7-frame fixture clip; the apps/api conftest clip extracts `kept=7, fraction=1.000`).
Those tests exercise feature structure / the 200 + ES256 paths, **not** the gate, so they
disable the gate with a scoped inert-threshold monkeypatch (`MIN_USABLE_FRAMES=0`,
`MIN_COVERAGE_FRACTION=0.0`); the gate is proven separately on the real `.npy` fixtures.

**Source**: initial calibration T011–T016 (extract → measure → STOP-gate → set → lock), then
the real-webm recalibration on the fixed decode (DECISION-29) — fixtures regenerated via
`tests/fixtures/extract_coverage_fixtures.py`; research.md "Calibration measurements" +
"Chosen thresholds". FR-008/017/018, SC-001/002.

### 📌 DECISION-33 — Glasses: calibrate the way you normally sit (glasses included), avoid glare, do not ban — with the between-subject thesis caveat

**Status**: Accepted (investigation-only; **no functional requirement, no code**).

**Decision**: A glasses-stratified LOSO evaluation found **no performance gap** between
glasses and no-glasses cohorts — by-eye count **24/53** subjects wearing glasses; **macro-F1
0.720** (glasses) vs **0.717** (no-glasses); **stress-class recall 0.844 vs 0.818**.
**Guidance**: calibrate the way you normally sit — **glasses included** — and avoid glare;
**do not ban glasses**.

**Thesis limitation (must accompany the result).** This is a **between-subject** comparison,
so it is **not proof of zero glasses effect**; it **cannot** test the calibrate-with /
infer-without mismatch (the failure mode that would actually matter for a per-user baseline);
and the **group sizes are modest** (24/53). State all three alongside the headline numbers.

**Source tasks**: T026 (record only), research.md "Part B — Glasses". Investigation-only.

---

## 2026-06-17 — Visual redesign: palette refreshed to "Graphite" (D5) values

**Status**: Accepted.

**Decision**: The Calm-First palette values are replaced with the "Graphite"
set (light/dark in Constitution Principle V, Amendment 4). Semantic role token
names (`--color-meadow/foggy/amber/crimson`) and the red-forbidden rule are
unchanged — only values deepen. Token-driven surfaces migrate automatically
from the nine `@theme` token edits in `apps/web/app/globals.css`; never edit the
`@theme inline` shadcn aliases (they chain to the runtime tokens).

**Rationale**: The former "Mist & Meadow" values read washed-out/timid. The
brief was richer/deeper/more modern while staying calm. Values were moved to the
confident end of "calm" and AA-verified in both modes before selection. Chosen
by the team from a nine-direction set.

---

## 2026-06-17 — Display typeface: Outfit replaces DM Serif Display; wordmark lowercased

**Status**: Accepted.

**Decision**: `--font-display` becomes Outfit (self-hosted, OFL); Inter stays
for body/UI. The wordmark is lowercase `serenify` with no trailing dot (the
prior `font-display` serif and the meadow dot are removed). Three wordmark sites
update: `header.tsx`, `(auth)/layout.tsx`, `(onboarding)/layout.tsx`.

**Rationale**: DM Serif Display read fussy/dated in a tech-health product. The
team wanted a modern Google/Samsung-adjacent feel; Outfit is a clean geometric
sans that delivers it and is freely self-hostable. (Google Sans itself is now
OFL and a viable future swap, but is not confirmed on the Google Fonts web API.)

---

## 2026-06-17 — Filled meadow/foggy CTA foreground: near-white (light) / bg token (dark)

**Status**: Accepted. Supersedes the deferred meadow-button AA item.

**Decision**: On filled meadow/foggy action surfaces, foreground text is
near-white in light mode and the `bg` token in dark mode. In `button.tsx` the
`meadow` and `foggy` variants change from `text-ink` to the bg/near-white
foreground accordingly.

**Rationale**: The deepened accents fail AA with ink foreground in light
(meadow + ink ≈ below 4.5:1); near-white passes at ~4.7–6.5:1. In dark the
accents are light, so the bg token passes. This is the clean rule that resolves
the long-deferred meadow button-fill AA failure (white on the old meadow was
~3.39:1).

---

## 2026-06-17 — Amber stress signal: soft-tint notice treatment

**Status**: Accepted.

**Decision**: The amber stress/affective signal renders as a soft-tint notice
(tint background + deep same-family text): light `#F4E3C6` / `#7E5310`, dark
`#3B2F19` / `#E6C386`, in addition to amber as a graphic/indicator hue. Dark
ink on a solid-amber fill is forbidden.

**Rationale**: A deepened solid amber with near-black ink read muddy and failed
AA in dark. The tint+deep-text notice pattern is warm, legible (5.3:1 light /
7.8:1 dark), and consistent across themes. Amber remains stress-only
(Principle V).

---

## 2026-06-17 — Type scale bump + introduce font-size tokens

**Status**: Accepted.

**Decision**: Bump the base reading scale — body 14→16px, failure/error card
copy →16–17px, captions/metadata stay 12–14px, headings remain large. Introduce
a small set of semantic font-size tokens (there are currently none; every size
is a per-component `text-*` utility) so future scale changes are centralized.

**Rationale**: A calm wellness product earns a more generous scale, and a
stressed person should not squint at an error. Not everything grows — flattening
the hierarchy would lose emphasis. Centralizing sizes avoids the per-component
churn this bump otherwise requires.

---

## 2026-06-17 — Breathing orb: clean layered bloom replaces frosted-glass treatment

**Status**: Accepted.

**Decision**: The calibration breathing orb drops the backdrop-blur "frost"
layer in favour of a clean layered bloom (concentric translucent meadow discs +
progress ring + the existing "Breathe in / out" label). The reduced-motion
fallback (static state via the repo's `useMediaQuery` hook) and the
text-off-video rule are retained. The full preview + orb-overlay + corner-
bracket composition is unchanged.

**Rationale**: The frosted look read dated and skirts Principle V's
"no glassmorphism anywhere" rule; the clean bloom is calmer, more modern, and
unambiguously compliant.

---

## 2026-06-17 — Visual redesign isolated as feature 007, no feature work riding along

**Status**: Accepted.

**Decision**: The design-system migration is its own feature/branch
(`007-visual-redesign`) with no product features bundled in. It ships before the
next product feature so later work is built on the final look.

**Rationale**: Bundling a design-system migration into feature 003 previously
caused a 112-commit sprawl. Isolation keeps the diff reviewable and `main` clean.

---

## 2026-06-18 — 007 type-scale mechanism: override Tailwind v4 `--text-*` (supersedes the 2026-06-17 type-scale entry)

**Status**: Accepted.

**Decision**: The locked role→px type scale ships by **overriding three of
Tailwind v4's built-in `--text-*` steps** in the real `@theme` block — not by
minting new semantic token names: `--text-xs` 12→13px (`0.8125rem`),
`--text-base` 16→17px (`1.0625rem`), `--text-4xl` →38px (`2.375rem`), each with a
`--text-*--line-height` companion (body ≈1.5, heading ≈1.15). `sm/lg/xl/2xl/3xl`
already equalled the locked values and were left untouched. Body inherits 17px
via `body { font-size: var(--text-base) }` in `@layer base`; the root/`html`
font-size is unchanged so rem-based zoom/scaling stays intact.

**Rationale**: Tailwind v4 already exposes `--text-*` as theme tokens, so
overriding the three deltas auto-migrates every existing `text-xs/base/4xl` call
site with zero per-component churn and keeps utilities idiomatic (research.md
R-1). This refines/supersedes the 2026-06-17 "Type scale bump + introduce
font-size tokens" entry: the as-shipped base is **17px** (not the 16px sketched
there) and the mechanism is **overriding the built-in scale**, not new token
names.

---

## 2026-06-18 — 007 `--color-on-accent`: single filled-accent foreground token

**Status**: Accepted.

**Decision**: `--color-on-accent: #F8F9FA` (defined in light only) is the single
foreground for filled meadow/foggy CTAs in light mode; dark mode uses the
`--color-bg` token (`#101214`) as the filled-accent foreground (no dark override
of `--color-on-accent`). Applied once at the shared button primitive
(`button.tsx`: meadow/foggy variants `text-on-accent dark:text-bg`).

**Rationale**: ink-on-accent failed AA (ink on foggy = 2.92:1). `on-accent`
clears AA on both fills (meadow 4.78:1, foggy 5.33:1 light; bg-on-accent
7.43:1 / 8.34:1 dark). One token — not per-component literals — prevents drift
below AA.

---

## 2026-06-18 — 007 `--color-meadow-text`: small-meadow-text token

**Status**: Accepted.

**Decision**: `--color-meadow-text: #346A56` (light) / `#63B292` (dark, = regular
dark meadow) is used for **small meadow-coloured text** on light backgrounds;
regular `--color-meadow` stays for fills, icons, graphics, and large text.
Migrated sites: all auth links (login/signup/forgot/reset), the
password-requirement "met" text, and the account has-anchor pill.

**Rationale**: old meadow-as-text was 4.22:1 (fail). `meadow-text` clears AA at
every migrated site (5.26:1 link on bg, 4.79:1 has-anchor pill on the meadow/15
tint, light; ≥5.30:1 dark). A distinct token keeps the migration from
over-reaching into the graphic meadow uses (which already pass the 3.0 non-text
bar).

---

## 2026-06-18 — 007 errors are foggy (confirmation)

**Status**: Accepted.

**Decision**: Every error/attention state is a **foggy soft-tint** notice — a
foggy tint background (`bg-foggy/10`) + a foggy hairline (`border-foggy/30…/50`)
+ `text-ink` + a foggy icon — in both modes, never amber and never a sharp red.
Confirmed across the auth notices, the OTP wrong-code notice (`otp-notice.tsx`,
which replaces the old inline `border-amber/50 bg-amber/10`), the calibration
failure / camera-access states, and the calibration banner. Amber survives only
as the stress-signal soft-tint (see the 2026-06-17 amber entry) or a graphic
hue; crimson stays destructive-only.

**Rationale**: a stressed user should never meet an alarm colour; foggy reads
calm and clears AA comfortably (ink on foggy/10 ≈ 12–13:1).

---

## 2026-06-18 — 007 scrim token: fixed Graphite ink @ 60%

**Status**: Accepted.

**Decision**: `--color-scrim: rgba(28, 32, 35, 0.60)` — Graphite ink (`#1C2023`)
at 60% — backs every dialog/sheet/notification scrim (`bg-scrim`, replacing the
old `black/80` and `black/50`). It is **fixed in both modes** (no dark override,
research.md R-2). In dark mode the modal's separation is carried by the surface
token + the 0.5px `border` + the soft shadow rather than a scrim-vs-bg luminance
delta (human-verified by eye per smoke ST-9).

**Rationale**: an ink-derived scrim is on-palette and warmer than raw black; a
single fixed value keeps both modes consistent (light surface-vs-dimmed-bg ≈
4.5:1, clearing the 3.0 non-text bar).

---

## 2026-06-18 — 007 dark `--shadow-soft` value

**Status**: Accepted.

**Decision**: dark-mode `--shadow-soft: 0 1px 2px rgba(0, 0, 0, 0.5)` (light
keeps `0 1px 2px rgba(0, 0, 0, 0.04)`). This single soft shadow plus the 0.5px
border is the only elevation treatment in both modes.

**Rationale**: the light 0.04 alpha is invisible against the near-black dark bg;
a deeper 0.5 alpha lets the one soft shadow still read in dark without adding a
second elevation shadow (FR-020 / research.md R-3.5).

---

## 2026-06-18 — 007 dropdown soft-tint hover/selected treatment

**Status**: Accepted.

**Decision**: the account-menu dropdown hover / focus / open / selected state is a
**soft foggy tint with ink text** — `focus:bg-foggy/15 focus:text-ink` (and the
`data-[state=open]:bg-foggy/15 …` equivalents) — in both modes, **not** a solid
accent fill (`dropdown-menu.tsx`).

**Rationale**: a solid-accent highlight pushed the item text below AA in dark; the
foggy/15 tint with ink text reads at AA in both modes (ink on foggy/15 ≈
10–12:1) and matches the calm soft-tint idiom used for notices.

---

## 2026-06-18 — 007 OTP success resolves by fade-out, not a vertical lift

**Status**: Accepted.

**Decision**: on a correct code the six boxes sweep → merge edge-to-edge into the
meadow "Verified" pill, which then **fades out** (`opacity → 0`) before the
handoff to `successHref` — there is **no vertical "lift."** Navigation
(`router.replace(successHref)` + `router.refresh()`), the copy, the validation
rule, and the reduced-motion path (verified pill shown directly; no
sweep/merge/fade) are all unchanged.

**Rationale**: a vertical lift visually collided with the incoming next view
during the calm ~3s handoff; a fade-out avoids the overlap and reads cleaner.
This is a deviation from FR-024's "lifts toward the next step" — recorded in
CHANGELOG 2026-06-18. Source of truth: `serenify-007-otp-mock.html`.

---

## 2026-06-18 — 007 calm informational accents = meadow soft-tint; foggy reserved for attention/error

**Status**: Accepted.

**Decision**: On affirmative/calm setup surfaces, informational & reassurance
accents take a **meadow soft-tint**, not foggy — kept as a soft-tint (never solid,
so the single solid-meadow CTA stays the focal point). First applied on the
calibration intro ("Set your calm baseline"): the three setup-hint icon tiles →
`bg-meadow/10` + `text-meadow-text` icon; the privacy-note shield → `text-meadow`.
**Foggy stays reserved for attention/error** surfaces — OTP wrong-code, the
calibration failure banners, the off-center recording nudge, camera-access-denied,
backend-down, auth error notices (`role="alert"`), and the home calibration
attention banner. Affirmative **success** notices remain meadow soft-tint (already
the case in account profile/security `status === "ok"`).

**Rationale**: a foggy info accent on a calm, meadow-CTA setup screen read as a
competing attention colour; recolouring the affirmative accents to meadow keeps the
screen reassuring and reserves foggy as the genuine attention/error signal
(Principle V). The meadow icons clear the ≥3.0 non-text bar in both modes — tile
icon (meadow-text on `meadow/10`) 4.69:1 light / 6.45:1 dark; shield (meadow on bg)
4.22:1 light / 7.43:1 dark. This is a targeted refinement, **not** a blanket
foggy→meadow swap.

---

## 2026-06-19 — feature 008 (stress-inference-service) plan decisions (D-1…D-4 + transport deviation)

Resolves the four Deferred Decisions in `specs/008-stress-inference-service/spec.md`
and records the one Constitution deviation the plan carries. Full reasoning in
`specs/008-stress-inference-service/research.md` and `plan.md`. The seven mock-gap
resolutions handed down by the mock owner are recorded as spec deltas in
`docs/CHANGELOG.md` (2026-06-19), not here (they are spec amendments, not
architectural decisions).

**D-1 — Anchor read path: server-side service-role read (option a).** Status:
Accepted. `apps/api` gains a scoped Supabase service-role client
(`app/supabase_admin.py`) that reads `profiles.anchor_vector` keyed to the
JWT-verified `user_id`, and performs the server-side session/reading writes. The
anchor never enters an authenticated client SELECT.
*Rationale*: only the server reads the anchor (for inference) and the API already
operates server-side, so (a) avoids a new DB-function surface (maintainer's lean).
This is **not** an override of feature 004's DECISION-9 ("the anchor-extract
service holds no DB credentials") — feature 004 **explicitly deferred** this path
to the inference feature: `supabase/migrations/20260527000000_anchor_columns.sql`
states *"service_role (seed, future 005 server-side read) is untouched,"* and the
004 decision block notes *"feature 005's inference read path for `anchor_vector`
(server-side service-role read, or a self-scoped SECURITY DEFINER function) is
still 005's decision"* ("005" = now-008 after the ordering reshuffle). Server-side
reading also enables server-side **writes** of `window_readings`, required for
integrity because those rows feed feature 009's sustained-tense detection and the
client must not be able to fabricate them.
*Guardrails (Principle IX)*: `SUPABASE_SERVICE_ROLE_KEY` is env-only (platform
panel in prod; mirrors `apps/web` `serverEnv` + the existing `SUPABASE_JWT_SECRET`);
the service-role client is used only to read own anchor, read own role (employee
gate), and write/read own sessions+readings; **every query is keyed by the verified
JWT `sub`** (service role bypasses RLS, so this keying discipline is the control)
and is unit-tested.
*Rejected*: (b) self-scoped SECURITY DEFINER returning the anchor — adds a DB-
function surface and, if called from the browser, delivers the 2958-d anchor to the
client (against "keep the anchor out of any authenticated client SELECT").

**D-2 — Endpoint shape + upload/buffer model: session-aware, client-assembled 60 s
window per stride, server-side smoothing.** Status: Accepted. Three endpoints —
`POST /monitoring/sessions` (create + calibrate-first guard), `…/{id}/windows`
(score one window, ~every 10 s), `…/{id}/end`, plus `PATCH …/{id}` for lifecycle
status. The client assembles the full 60 s window and uploads it per 10 s stride
(consecutive windows overlap 50 s); the server holds no rolling buffer. Smoothing,
banding, and the cold-start gate are computed **server-side** in the window
endpoint and the band is returned, so the first displayed reading is already
smoothed and the card/page trends agree (SC-008). Reads (trend/recap) are
browser-side Supabase RLS SELECTs, not API endpoints.
*Rationale*: session-aware grouping makes the trend/recap and the 009 seam trivial
and lets a rolling buffer move server-side later without a UI change; client-
assembled windows reuse the proven `/anchor` multipart path and are negligible on
localhost.
*Documented future item (not built now)*: on real deployment this uploads ~6× the
bytes and re-runs MediaPipe on ~6× overlapping frames; the optimization is a
**server-side rolling-feature cache** (client sends only the new ~10 s; the server
reuses overlapping extraction), which the session-aware shape already enables and
which pairs with the WebSocket transport in the deviation below.
*Rejected*: a single stateless per-window endpoint (no clean grouping/lifecycle);
a server rolling buffer now (efficient end state, but stateful complexity before
it is needed).

**D-3 — Smoothing, banding, cold-start.** Status: Accepted. Smoothing = rolling
mean of `proba[1]` over the last **N = 4 scored** readings (skipped windows
excluded). Bands on the **smoothed** value: `< 0.53` At ease, `0.53 ≤ x < 0.70` A
little tense, `≥ 0.70` Tense. `t_low = 0.53` is the metadata operating point
(config `STRESS_OPERATING_POINT`, default read from `metadata.json`, never a
literal — FR-012); `t_high = 0.70` is a **display-only** product split (config
`STRESS_TENSE_BAND`) because the model carries only the single stress/not-stress
operating point and `predict_proba` is not probability-calibrated. Cold-start
**M = 4** scored readings before any band → first band at ~90–105 s (matches
updated SC-001); the display holds warming-up until then. The internal 0.5 label
from `predict_delta` is ignored. No numeric value is ever shown (FR-015).
*Rationale*: 60 s windows overlap 50 s, so readings are already correlated; a
4-reading trailing mean drifts rather than flickers (SC-003) while staying
responsive. Details + tests in `contracts/smoothing-and-banding.md`.

**D-4 — Readings persistence schema.** Status: Accepted. Two tables —
`monitoring_sessions` (lifecycle: active/paused/out_of_frame/ended + end_reason +
bounds + model_version) and `window_readings` (per window, keyed user+session+
`captured_at`, with `scored`, `band`, `skip_cause`, and the **server-only** raw
`label` + `stress_probability`). RLS = SELECT-own for the owner via a column
whitelist that **excludes the raw probability/label** (the `anchor_vector`
mechanism); **no manager policy** on either table (Principle I); all writes are
service-role keyed to the verified `sub`. Retention: `window_readings` 90 days then
purge (purge job is a documented follow-up); sessions kept longer. The persisted
`band` + `captured_at` + `session_id` are the FR-020 seam — sufficient for feature
009 to detect sustained-tense by query; **008 builds no questionnaire trigger**.
Full schema in `data-model.md`.

**Constitution deviation — per-window HTTP request/response transport (not
WebSocket).** Status: Accepted (justified, logged). The Architecture-Constraints
rule "real-time prediction streams … travel over WebSockets, not polling" is
deviated from: inference is upload-bound (the client must send a 60 s window each
stride; the reading is the synchronous response), and the live signal-quality
indicator (framing/out-of-frame) is computed **on-device**, so nothing is polled.
A WebSocket carrying 60 s video blobs every 10 s adds reconnect/backpressure
complexity with no benefit while inference is upload-bound; it is **reserved** for a
future server-push streaming optimization paired with the deferred server-side
rolling-feature cache (D-2). Recorded in `plan.md` Complexity Tracking.

**Revisit if**: the backend moves to hosted deployment (the D-2 bandwidth/compute
cost becomes real → build the server-side rolling-feature cache + WebSocket
transport); or `metadata.json`'s stale `window_eval_config` (30 s) is ever
mistaken for the production window (it is not — 60 s is locked by Principle II +
`docs/MODELS.md`; research R-0 flags the cleanup).

---

## 2026-06-19 — feature 008 plan AMENDMENT: D-1 and D-2 reopened (maintainer review)

Amends the **2026-06-19 — feature 008 plan decisions** entry above. After review,
the maintainer flipped D-1 and D-2 having weighed the honestly-flagged trade-offs.
Both prior decisions are **superseded** by the ones here; everything else in the
original entry (D-3, D-4 shape, the transport deviation, the 60 s lock) stands.
Plan artifacts updated on the `008-stress-inference-service` branch (`plan.md`,
`research.md`, `data-model.md`, `contracts/inference-api.md`, `quickstart.md`).

**D-1 (REVISED) — self-scoped `SECURITY DEFINER` read; NO service-role key.** The
API must **not** gain a broad DB credential; DECISION-9's "no DB credentials in
`apps/api`" posture is preserved. The anchor is read by `public.get_my_anchor()` (a
`SECURITY DEFINER` function filtering strictly on `auth.uid()`, returning only the
caller's own anchor; EXECUTE to `authenticated` only; mirrors `has_anchor()`). The
API calls it **as the user** — forwarding the verified access token + the
**publishable anon key** (RLS-respecting), never a service credential — so the
anchor flows Supabase → API only and never enters a browser SELECT. Sessions/
readings are written **under RLS as the user** (insert-own/select-own/update-own;
still no manager policy). The raw `stress_probability`/`label` stay server-only via
the SELECT column whitelist (so the **API**, not the browser, writes the reading
row).
*Rationale*: strongest secrets posture — **no new secret** in `apps/api` (the anon
key is publishable, already in the browser bundle; grants nothing beyond RLS),
strictly stronger than the original service-role design (Principle IX). `auth.uid()`
resolves via the forwarded JWT — the established working pattern (DECISION-9 note:
SECURITY DEFINER RPCs are called via the caller's token, not service-role). Feature
004 named **both** options for this path; this is the safer one.
*Verified alignment + flagged divergence*: the `/anchor` router does **zero** DB I/O
(browser writes the anchor via its own RLS client). 008 preserves that *credential
posture* (no broad credential; user-context RLS) but the **API itself** now does the
DB I/O via forwarded JWT — a new pattern for `apps/api` (the forwarded-JWT-RPC
pattern already exists in the **web** invite handler). 008 cannot push writes to the
browser because the raw probability must stay server-side. Recorded as a deliberate
divergence, not a contradiction.
*Write-integrity — deliberately deferred (low stakes)*: under RLS-as-the-user
writes, a user could fabricate **their own** readings. Accepted: own data only;
managers never see raw readings (no manager policy); privacy invariant unchanged.
**Upgrade path (not built now)**: a **dedicated INSERT-only Postgres role** (a narrow
write credential, far less than service-role) held by the API, with INSERT revoked
from `authenticated`.
*Superseded*: original D-1 (server-side **service-role** read). Reason: it
introduced a broad DB credential / new secret into `apps/api`.

**D-2 + R-5 (REVISED) — single-recorder ~10 s segments + server-side 60 s
assembly.** The client no longer assembles 60 s windows (no staggered
`MediaRecorder` pool). It records with a **single** `MediaRecorder` (timeslice
~10 s) and uploads only the newest segment; the **server** keeps a transient
per-session buffer (last 6 segments + the init segment) and assembles the rolling
60 s window for the existing single-path extraction. The session-aware endpoint
shape is unchanged; the "deferred rolling buffer" becomes the **primary** design.
*Rationale*: one client encoder instead of ~6 (far lighter on CPU/mobile), ~6× less
upload bandwidth, and materially better cross-browser robustness — **WebKit/Safari
`MediaRecorder` is the fragile case and Safari/iOS is a hard pre-production gate**,
so the single-encoder path is the defensible choice. Buffer lifecycle: append; keep
last 6 clusters; assemble per stride; **clear on pause/end**; segments + assembled
window deleted in `finally` (Principle I — transient, never persisted).
*⚠ FLAGGED contradiction (per the instruction to flag, not work around)*: the
brief's preferred "decode each segment and concatenate sampled frames (not mux
containers)" is **not directly feasible**. Verified: (1) timeslice chunks are **not
independently decodable** — only the first webm/fMP4 chunk carries the init segment;
(2) the shared extraction entry (`extract_landmarks`/`compute_anchor`) is
**single-file/path-based** (`cv2.VideoCapture`, no frame-sequence entry). So the
realistic path is **container-level reassembly** (`[init + recent clusters]` → one
temp container → existing decode) — exactly the container concatenation the brief
said to flag. Recommended path **B1** (container reassembly) with the R-7 early
Safari spike de-risking decodability across Chrome webm + Safari fMP4; **B2
fallback** = stop/restart standalone segments + a **new multi-clip extraction entry**
in `packages/ml-video` (a package change) if B1 fails on Safari.
*Superseded*: original D-2 client-assembled 60 s windows / R-5 staggered recorder
pool.

**Change 3 — Safari/WebKit early validation (carried into the plan, front-loaded).**
The segment + server-assembly path MUST be validated on **WebKit/Safari (incl. iOS)
early** — a small spike before the full build, among the first `/speckit-tasks`
items — not discovered late. Rationale: Playwright has given false cross-browser
capture/timing confidence (see the e2e-load-timing flake history), so the real
Safari/iOS smoke gate is prioritized. Recorded as research R-7 + a plan test-plan
item.

**Change 4 — `metadata.json` hygiene (small, separate).** The stale
`window_eval_config` (30 s) block should be removed or annotated (production contract
is the 60 s LOSO block). This is **metadata/doc only** — no model/feature-space
change, so **no `model_version` bump and no anchor invalidation**; the model artifact
is **not** edited as part of this plan. Recorded as a backlog/task note + flagged for
the model owner (research R-0).

**Constitution Check delta**: Principle IX now has **no new secret** (publishable
anon key only) — stronger than before; the original service-role Complexity-Tracking
row is **removed**. Principle I still holds (managers read nothing; raw
probability/label server-only via the SELECT whitelist; anchor server-side only) —
the only change is writes now run as the user under RLS (write-integrity deferred as
above). The transport-deviation entry is unchanged.

## 2026-06-19 — feature 008 plan AMENDMENT: B1 windowing NO-GO → B2 (standalone clips + multi-clip frame concat)

Amends the **D-2 + R-5 (REVISED)** decision in the *2026-06-19 — feature 008 plan
AMENDMENT* entry above. The R-7 windowing spike returned a **structural NO-GO on B1**
(single timeslice recorder + server-side **container reassembly**). **B2** is adopted
as the windowing approach. Everything else in the prior amendment stands (D-1, D-3,
D-4 shape, the 60 s lock, the transport deviation). Plan artifacts updated on the
`008-stress-inference-service` branch (`research.md` R-5/R-7/R-6/D-2, `plan.md`,
`contracts/inference-api.md`, `quickstart.md`; `data-model.md` needs no change — it
describes no assembly).

**B1 (container reassembly) is REJECTED — NO-GO (structural; accepted as-is, real-
device confirmation optional/non-blocking).** Three reasons:
1. **`[chunk0 + recent tail]` is not a clean trailing 60 s.** The first timeslice
   blob is the init segment **plus ~10 s of media**, so stitching chunk0 onto a recent
   tail is not a clean trailing 60 s **without container surgery**.
2. **Silent `motion_features` corruption.** A spliced container has a **time
   discontinuity** at the splice; `motion_features` is a frame-to-frame diff, so the
   **spurious diff at the splice inflates max/std across the 2868 motion dims** — the
   decode can **"succeed" and still be wrong** (no error raised). This silent feature
   corruption is the disqualifying failure mode.
3. **webm timeslice boundaries aren't guaranteed cluster-aligned**, so a reassembled
   webm can be structurally invalid (cut mid-cluster) — decodability itself is
   unreliable across browsers.

A B1 harness exists at **`_scratch-008-b1-spike/`** for optional empirical
confirmation; **the decision does not wait on it.**

**B2 (ADOPTED) — standalone clips + server-side frame concatenation.** The client
**stops/restarts** the `MediaRecorder` every ~10–12 s so each clip is a **complete,
independently-decodable** standalone clip (its own init), uploading only the newest.
The server buffers the **last ~6 clips**, **decodes each via the existing extraction
path**, and **concatenates the sampled frames** into one ~150-frame / ~60 s set, then
runs LBP-TOP + motion on that set. No shared-init surgery, no mid-cluster splice, no
intra-file discontinuity. Privacy unchanged: clips are **transient, in-memory,
cleared on pause/end, deleted in `finally`** — never persisted.
*Package change (Principle III)*: B2 adds **one new public entry** to
`packages/ml-video`, `compute_anchor_multiclip(clip_paths) -> (2958,)`, that **reuses**
the existing per-clip `extract_landmarks` + `lbp_top_features`/`motion_features` and
only adds frame-array concatenation — **not a second copy** of extraction. (B1 had
kept ml-video untouched by reassembling containers in `apps/api`; that path is gone.)
*Why B2 resolves the blockers the prior amendment flagged*: stop/restart makes every
clip independently decodable (removes blocker 1), and the new multi-clip entry gives
ml-video a multi-clip path (removes blocker 2). The cost — a recorder stop/restart
each stride (a few frames lost per seam) and a package change — is accepted, and the
**frames-lost-per-seam + per-seam `motion_features` diff are now measurable, bounded
quantities** validated by a **hard fidelity gate**, not B1's silent corruption.

**Front-loaded, gating validation (R-7).** The first two `/speckit-tasks` items, both
gating the rest of the build:
1. **B2 capture validation on real Chrome + real Safari/iOS (NOT Playwright)** — each
   clip independently decodable; frames-lost-per-restart within budget; no glitches
   across the ~5 seams of a 60 s window. The Safari/iOS pre-production gate.
2. **Multi-clip extraction fidelity HARD GATE (`packages/ml-video`)** — the same ~60 s
   as **one continuous clip** vs as **~6 stop/restart standalone clips** must agree
   **within tolerance** (measuring the per-seam `motion_features` diff + frames lost
   per restart). If it fails, the windowing approach is revisited before the rest of
   the feature is built.

*Superseded*: B1 (single timeslice recorder + server-side container reassembly), the
D-2/R-5 decision of the prior 2026-06-19 amendment. The R-6 webm/VFR **codec** check
remains scheduled hardening; its **assembly** dimension is now the R-7 multi-clip
gate.

---

## 2026-06-19 — Multi-clip motion assembly made seam-aware; B2 fidelity gate still FAILS on Chrome (divergence beyond the seams)

**Status**: Accepted (code change kept). **GATE NOT cleared — Phases 3–8 remain blocked.**

**Context**: The first real-fixture run of the R-7 multi-clip fidelity HARD GATE
(T008) on the recorded **Chrome** fixtures FAILED. Measured before vs after the fix:

| | cosine (≥0.999) | lbp_maxabs (≤0.05) | motion_rel_p99 (≤0.25) | frames_lost (≤12) | seam_motion_ratio |
|---|---|---|---|---|---|
| **Before (seam-contaminated)** | **0.9010** ❌ | 0.0089 ✅ | **1.2923** ❌ | 3 ✅ | 5.72 |
| **After (seam-aware)** | **0.8958** ❌ | 0.0089 ✅ | **0.6998** ❌ | 3 ✅ | 5.72 |

The accepted diagnosis was that the only divergence was the motion block's
frame-to-frame `np.diff` taken **across the stop/restart clip seams** (~0.5–2 s
recorder gap → a spurious ~5.7× jump per seam, ~5 seams dominating the 2868-d motion
block). The prescribed fix: compute motion diffs **per clip** and **exclude the
cross-seam diffs** before the mean/std/max aggregation.

**Decision**: The multi-clip motion assembly is now **seam-aware**. New
`ml_video.features.motion_features_seamaware(landmark_blocks)` computes `|np.diff|`
**within each clip** and concatenates the per-clip diffs (cross-seam rows excluded)
before mean/std/max; `compute_anchor_multiclip` calls it instead of running
`motion_features` over the fully-concatenated stack. The **single-clip
`compute_anchor` / `motion_features` path** (which extracts the continuous reference)
is **untouched**; the LBP/texture path, the coverage gate, and frame concatenation are
unchanged; no gate threshold was loosened. For a single clip the seam-aware path
reduces **exactly** to `motion_features`.

**Outcome — the fix is correct but does NOT clear the gate; the seams were not the
dominant divergence.** The fix did exactly what it should to the motion block —
**motion-block cosine 0.861 → 0.956**, **motion_rel_p99 1.29 → 0.70** — confirming the
seams *were* contributing to the tail. But the gate's headline **full-vector cosine
barely moved (0.901 → 0.896, slightly worse)**: removing the spurious seam spikes shrank
the multi-clip motion magnitude (l2 ratio multi/continuous: mean 0.79, std 0.55,
**max 0.43**), rebalancing the full vector toward the near-perfectly-aligned LBP block
(cosine 0.9997) and incurring a magnitude-mismatch penalty that cancelled the
directional gain.

The decisive evidence is the **relative motion-error distribution** after the fix:
**p50 = 0.41, p90 = 0.64, p99 = 0.70** — ~41% error *at the median*, broadly distributed
across **all** motion dims. A seam-localized problem is low-median / high-tail; this is
**broadband**. Tighter seam handling cannot close a 41%-median broadband gap. The
residual is **divergence beyond the seams**: the continuous clip and the 6 standalone
clips are **two independent back-to-back recordings**, and the motion block captures
exactly the involuntary micro-motion (blinks, sway, breathing, VFR sampling) that does
**not** reproduce take-to-take. As fixtured, the gate conflates **assembly fidelity**
with **recording reproducibility**, and the latter dominates the motion block (97% of
the 2958 dims).

**Consequence**:
- The gate is **NOT cleared**. Per T009 / the plan, **STOP — do not start Phases 3–8.**
  Safari/iOS was never reached (no fixtures recorded) and is independently still required.
- The seam-aware code is **kept** (it is the correct multi-clip implementation and a real
  improvement) but it is **not** sufficient, and **no threshold was changed**.
- Windowing fidelity goes to a **design session**. Items for it: (1) re-fixture the gate
  to isolate assembly fidelity from recording variance — compare one continuous decode vs
  the **same decoded frames** programmatically re-chunked into N standalone clips, so the
  only difference is assembly; (2) reconsider whether a 0.999 full-vector cosine is even
  achievable on the take-irreproducible motion block, or whether the fidelity contract
  needs a motion-aware / magnitude-normalized metric; (3) only then re-judge B2.

**Numbers recorded in**: `specs/008-stress-inference-service/smoke-tests.md` (T009 table,
before + after) and `research.md` R-5. The gate catching this before any build is the gate
working as intended (Principle VII).

**Revisit at**: the windowing design session (next 008 work session).

---

## 2026-06-19 — B2 windowing design session: cross-take fixture was a real flaw; single-source re-fixture isolates a residual per-clip sampling-phase divergence (gate still NOT cleared)

**Status**: Accepted (analysis + test re-fixture; **no code/threshold change**). Amends the
diagnosis of the **2026-06-19 — Multi-clip motion assembly made seam-aware** entry above.
**GATE still NOT cleared — Phases 3–8 remain blocked.**

**Context**: The prior entry diagnosed the seam-aware fix's residual as "broadband divergence
beyond the seams" and sent windowing to a design session with the first action: *re-fixture to
isolate assembly fidelity from recording variance — compare one continuous decode vs the **same
decoded frames** re-chunked.* This entry executes that action and reports the result.

**What was done (fix the test, not the budget)**: The Step E `chrome` fixture compared **two
independent recordings** (a continuous take and a separate 6-clip take of "the same" ~60 s).
Involuntary micro-motion (blinks, breathing, sway) and VFR sampling do not reproduce
take-to-take, so the motion block (97% of the 2958-d vector) diverged for reasons unrelated to
the **assembly** — the fixture conflated *assembly fidelity* with *recording reproducibility*.
A new **single-source** fixture removes the confound with **no new recording**: the existing
`chrome/continuous.webm` is **losslessly segmented** (`ffmpeg -c copy -f segment
-segment_time 11 -reset_timestamps 1` — same VP9 frames, no re-encode) into 6 standalone clips.
Verified same take: the 6 segments decode to **1984** frames, **exactly** `continuous.webm`'s
1984. `-reset_timestamps 1` makes each segment restart at `t≈0`, modelling a real B2
stop/restart clip. (Lossless cuts snap to the ~3.36 s keyframe grid, so segment durations are
non-uniform — 13.4/10.0/10.0/13.4/10.0/8.8 s; this does not change the frames.) New artifacts:
`tests/fixtures/multiclip/chrome-singlesource/` (README + `.gitkeep`; raw webm gitignored) and
the diagnostic `tests/helpers/singlesource_fidelity.py`. The production gate
(`test_multiclip_fidelity.py`) auto-discovers the fixture; **no threshold was loosened**.

**Measured (production gate `_measure`, cross-checked by the diagnostic):**

| Fixture | cosine (≥0.999) | lbp_maxabs (≤0.05) | motion_rel_p99 (≤0.25) | frames_lost (≤12) | seam_ratio |
|---|---|---|---|---|---|
| `chrome` (cross-take) | 0.8958 ❌ | 0.0089 ✅ | 0.6998 ❌ | 3 ✅ | 5.72 |
| `chrome-singlesource` (lossless segments) | **0.9910** ❌ | 0.0025 ✅ | **0.3336** ❌ | **0** ✅ | 1.52 |

**Finding 1 — the cross-take fixture WAS a real flaw (the prior "broadband" read was a fixture
artifact).** Isolating to one source moves cosine **0.896 → 0.991**, median relative motion
error **0.41 → 0.05**, LBP-block cosine to **0.99997**, and removes the broadband take-to-take
noise. Most of Step E's failure was **recording reproducibility, not assembly**. The
single-source (lossless-segment) fixture is the **correct test going forward**; the cross-take
`chrome` fixture is retired as the wrong test (kept on disk only as a contrast row).

**Finding 2 — but B2's assembly is still not faithful enough; a real, smaller divergence remains
and is localized.** The single-source gate **still fails**: cosine **0.991 < 0.999**,
motion_rel_p99 **0.334 > 0.25**. The residual is **motion-only** (LBP cosine 0.99997) and
**localized to the per-clip sampling phase**:
- `frames_lost = 0` (165 = 165) → not frame loss but frame **substitution**;
- only **31.5%** of the 2.5 fps-sampled frames coincide (52/165); the other 113 picks are
  offset from the continuous pick by **median 79 ms / p90 175 ms / max 195 ms** — up to ~½ the
  400 ms sampling period;
- **mechanism**: each standalone clip re-applies the 200 ms-phased 2.5 fps timestamp grid
  (`_timestamp_keep_indices`) from its own `t≈0` (`CAP_PROP_POS_MSEC` resets per clip), and the
  clip start offsets are not multiples of 400 ms, so each clip samples a **different set of
  frames** than continuous sampling. Different frames → different landmark diffs → motion
  magnitude ~14% lower (l2 ratio 0.864). LBP texture is phase-insensitive (averaged), so it is
  unaffected.

**Why this likely cannot be patched server-side for *real* B2 clips**: the lossless fixture has
knowable global offsets, but a **real** stop/restart clip carries **no global clock** — its
`POS_MSEC` genuinely starts at 0 and the server cannot know the (variable) recorder
stop→restart wall-clock gaps, so the continuous sampling phase cannot be reconstructed from
standalone clips. A **continuous single-stream upload** sidesteps re-phasing entirely.

**Decision / consequence**:
- **GATE still NOT cleared.** Per T009 / the plan, **STOP — do not start Phases 3–8.** No
  threshold loosened; no production code changed.
- The **single-source fixture is adopted as the canonical windowing fidelity test**; the
  cross-take comparison is retired. Safari/iOS must be validated with the **same single-source
  method** before any build (still independently required; no Safari fixture recorded yet).
- The windowing-approach choice is the **maintainer's call, now with numbers in hand**: (a) make
  per-clip decode+sample phase-faithful (appears intractable for real standalone clips — see
  above), or (b) switch B2 to a **continuous single-stream upload**. This entry deliberately
  **does not** make that change.

**Numbers recorded in**: `specs/008-stress-inference-service/smoke-tests.md` (Step F) and
`tests/fixtures/multiclip/chrome-singlesource/README.md`. Lint nit fixed in passing
(`tests/helpers/decode_smoke.py` E501) so the T001 "ruff passed" record is accurate.

**Revisit at**: the windowing-approach decision (continuous upload vs phase-faithful per-clip
sampling) — the next 008 work session.

---

## 2026-06-19 — feature 008 windowing DECISION: B2 REJECTED; adopt continuous single-stream upload + server tail-extract (D-2 reversed)

**Status**: Accepted (windowing approach changed). **Reverses the D-2 + R-5 (B2)
windowing decision** of the three 2026-06-19 amendment entries above, and resolves the
maintainer's open call recorded in the *B2 windowing design session* entry. **Unchanged**:
D-1 (self-scoped `SECURITY DEFINER` `get_my_anchor()`, no service-role, RLS-as-user
writes), D-3 (smoothing/banding/cold-start), D-4 (schema), the 60 s window lock, the 0.53
re-threshold, the transport deviation, and the seven mock-gap resolutions. Plan artifacts
updated on `008-stress-inference-service`: `research.md` (D-2/R-5/R-6/R-7), `plan.md`,
`contracts/inference-api.md`, `quickstart.md`, `spec.md`, and `tasks.md` re-issued;
`data-model.md` is **unchanged** (it describes no assembly).

**Why B2 is rejected — the single-source numbers settled it.** The single-source
re-fixture (prior entry) removed the recording-reproducibility confound with **no new
recording**: the existing continuous Chrome clip was **losslessly re-segmented** (same VP9
frames, no re-encode) into 6 standalone clips. With **identical source content**, B2's
multi-clip frame-concat assembly reached only:
- **cosine 0.991 (< the 0.999 budget)**, with
- a systematic **~14% motion-magnitude shortfall** (l2 ratio 0.864) and **motion_rel_p99
  0.334 (> 0.25)**;
- the divergence is **not** the seams and **not** frame loss (`frames_lost = 0`): it is a
  **per-clip sampling-phase reset** — only **31.5%** of the 2.5 fps-sampled frames coincide
  with continuous sampling (52/165); the rest are offset by up to ~½ the 400 ms sampling
  period, because each standalone clip re-applies the timestamp grid from its **own `t≈0`**
  (`CAP_PROP_POS_MSEC` resets per clip).

Two things are both true and both recorded:
1. **The earlier cross-take fixture was a real flaw** — it compared two *independent*
   recordings, so take-to-take micro-motion / VFR noise (not assembly) dominated (cosine
   0.896, motion p50 0.41). The **single-source fixture is the correct test** and is kept as
   the canonical windowing-fidelity diagnostic.
2. **Even with the correct test, B2 cannot reach fidelity, and the residual is not patchable
   for real clips.** A real stop/restart clip carries **no global clock** — its `POS_MSEC`
   genuinely starts at 0, and the server cannot know the variable recorder stop→restart
   wall-clock gaps, so continuous sampling phase **cannot be reconstructed** from standalone
   clips. (The lossless fixture only slips through by *accident* of having knowable global
   offsets; real separately-recorded clips lose variable time at each restart.)

**Decision — adopt continuous single-stream upload.**
- **Client**: **one continuous `MediaRecorder`** (timeslice only for *incremental capture*,
  never stop/restart). Each stride uploads the **contiguous recording-so-far** — the init
  segment + all chunks **in order**, i.e. the literal growing file, which is **always
  decodable** (the case already proven reliable; no surgery, no clip stitching, no
  init-segment retention). No stop/restart, no per-clip containers.
- **Server**: decode the uploaded continuous clip and extract the **last 60 s** with the
  **existing, validated single-clip extraction path** (`compute_anchor` + the VFR
  timestamp / `POS_MSEC` sampler) **bounded to the trailing window** — sample frames whose
  timestamp ≥ `duration − 60 s`. **No multi-clip assembly.** The only ml-video change is a
  thin **tail-window option** on the existing extraction (reuses the exact decode + sampler +
  features; it only bounds *which* frames feed the features) — strictly smaller than
  `compute_anchor_multiclip`.
- **Faithful by construction.** The scored window is a **genuine continuous 60 s segment
  sampled by one continuous grid** — no stop/restart seams, no per-clip phase resets — i.e.
  exactly the single-clip input the extraction path is **already validated on** (the notebook
  fidelity gate + the existing webm/VFR sampler). **There is therefore no new feature-fidelity
  gate to pass.** (Residual: only a ≤200 ms *global* phase offset between the window grid and
  a standalone clip's grid — within ordinary recording-to-recording sampling variation, **not**
  the per-stride re-phasing that sank B2.)

**Retired (kept in git history; removed from the active path).** `compute_anchor_multiclip`,
`test_multiclip_fidelity.py`, the seam-aware `motion_features_seamaware` helper, and the
multi-clip frame-concat **HARD GATE** are retired — the assembly step they validated no longer
exists. The **single-source diagnostic** (`tests/helpers/singlesource_fidelity.py`), the
single-source fixture, and the finding above **stay recorded** (they are *why* B2 was rejected).
*(Code retirement is a task in the re-issued `tasks.md`; this session records the decision and
does not edit code past the docs.)*

**Known cost — accepted, with one flag.** Upload size and the server's decode-to-tail work
**grow over the session** (each stride re-uploads the whole recording-so-far, and the server
re-decodes it to reach the tail). Both are **bounded by the 5-minute hard cap** and
**negligible on localhost** (the dev/demo target).
- **⚠ Flag — growing per-stride decode could breach the 10 s stride within a 5-min session on
  the droplet.** Real Chrome webm is VFR and VFR seek is unreliable, so reaching the tail means
  **sequential decode from the start of the growing file** each stride. At the 5-min cap that
  is ~300 s of video decoded per stride; to stay inside the 10 s stride the CPU must decode at
  **≥ ~30× realtime** — plausible for low-res webcam video, **not guaranteed for 720p VP9 on
  the DigitalOcean droplet** (the same CPU that makes MediaPipe ~3–5 s/window). Late-session
  strides may exceed 10 s. **Bounded, not fatal**: FR-016 non-blocking means the client keeps
  capturing and uploads are fire-and-forget, so only the *reading cadence* degrades toward
  end-of-session; the 5-min cap caps the worst case. The keep-up check is exactly what the (now
  lighter) windowing validation measures.
- **Deferred optimization (unchanged — still deferred, not built now)**: a **server-side
  rolling decoded-frame buffer** — retain the trailing 60 s of sampled frames and decode only
  the **newest increment** each stride — collapses per-stride decode from O(elapsed) to
  O(stride) and removes the growth. This is the **same** optimization already deferred (pairs
  with the future WebSocket transport). **Build it before relying on long droplet sessions in
  production**; localhost/demo does not need it.

**Windowing validation is now much lighter (no fidelity gate).** The heavy multi-clip fidelity
question is gone (faithful by construction). The remaining real-device check is only:
**continuous recording + growing upload + last-60 s tail-extract works on real Chrome and real
Safari/iOS, and per-stride server time stays within the 10 s stride across a 5-minute session.**
It largely **reuses the proven `/anchor` single-clip upload+extract path**. The
**real-Safari/iOS check stays the pre-production gate** — but it is now a *"does the continuous
capture/upload/tail-extract work and keep up"* check, **not** a fidelity gate. A failure means
"the deferred rolling-buffer optimization is needed for production," **not** "re-open the
windowing approach."

**Superseded**: B2 (standalone stop/restart clips + multi-clip frame-concat assembly + the
multi-clip fidelity HARD GATE) and `compute_anchor_multiclip`. B1 remains rejected (prior
entries).

**Numbers recorded in**: this entry + `specs/008-stress-inference-service/smoke-tests.md`
(Step F) + `tests/fixtures/multiclip/chrome-singlesource/README.md`.

**Revisit at**: production deployment scale-up (when the deferred rolling decoded-frame buffer /
WebSocket push becomes worth building).

---

## 2026-06-19 — feature 008 corrective docs/tasks pass: enforce "faithful by construction", complete the keep-up reasoning, make the B2 retirement non-breaking

**Status**: Accepted (docs + `tasks.md` correction; **no code, no decision reversal**). A
pre-`/speckit-analyze` cleanup of three gaps found in the re-issued `tasks.md` + `research.md`
after the *continuous single-stream* windowing decision (prior entry). The windowing decision is
**not** reopened (continuous single-stream stays adopted); **D-1, D-2 (continuous), D-3, D-4, the
seven mock-gap resolutions, the 0.53 re-threshold, and Principles I/V/VI/VII are untouched.**

**Three gaps closed:**

1. **"Faithful by construction" is now an *enforced* invariant, not an assumption.** The pivot
   rests on the tail-extract sampling on **one file-global grid (anchored at the file's t=0)** and
   keeping the trailing 60 s — so the kept tail frames are exactly the *suffix* of the full-file
   keep-set. B2 failed precisely because the grid was **re-zeroed per segment**
   (`CAP_PROP_POS_MSEC` reset to 0). Nothing in the task list stopped a future change — most
   likely the **deferred rolling decoded-frame buffer** (R-5) — from reintroducing that
   re-zeroing, and T006 only asserted the tail frames fell in the right *range* (a re-zeroed grid
   satisfies the range while picking the *wrong frames inside it*). **Fix**: `tasks.md` T005 now
   mandates compute-global-then-filter with an explicit prohibition on trim/seek-and-resample;
   T006 adds a deterministic, **CI-runnable integer-index suffix-equality invariant** on synthetic
   VFR timestamps (no video, no tolerance) that any future incremental/buffered decoder must keep
   passing; `research.md` R-5 ties faithfulness to the preserved global grid + this enforcement.
   This is **not** the retired multi-clip fidelity gate — it is exact integer-index equality on
   identical source frames.

2. **Keep-up reasoning corrected and completed.** (a) The budget bar was understated — decode must
   fit `(10 s − extract)` ≈ **5–7 s / ~43–60× realtime** at the 5-min cap, not the full 10 s /
   ~30×. (b) Keep-up has **two** components: *growing decode-to-tail* (O(elapsed) — the rolling
   buffer fixes it) **and** *constant per-window extract* (MediaPipe + LBP, ~10–15 s/window
   projected on the droplet — the buffer does **not** touch it; an extract-bound breach calls for
   slower cadence or GPU MediaPipe, not the buffer). `research.md` R-5 + `tasks.md` T008/T009 now
   split the diagnosis, and T008 records decode-to-tail and extract times **separately**. All
   droplet figures are flagged **indicative only** — the droplet is being phased out (Azure student
   credits / HuggingFace), so production keep-up must be re-evaluated against the chosen target.

3. **B2 retirement (T004) made complete and non-breaking.** The kept single-source diagnostic
   `tests/helpers/singlesource_fidelity.py` **imports `compute_anchor_multiclip`**, so the blind
   removal the old T004 described would break the very file that records *why* B2 was rejected.
   T004 now: **deletes `compute_anchor_multiclip` + `motion_features_seamaware` from the package
   source entirely** (resolution **(a)** — the active source carries **zero** retired B2 code),
   **inlines** the assembly logic they contained into the kept diagnostic so it stays runnable,
   runs a **repo-wide reference sweep**, deletes the `_scratch-008-b2-spike/` harness, and removes
   the **orphaned cross-take** fixtures (`multiclip/chrome/`, `multiclip/safari/`) while keeping
   the **single-source** fixture (`multiclip/chrome-singlesource/`) as evidence.

**Files changed (docs/tasks only — no feature code, no test/fixture code, no model artifact, no
`model_version` bump)**: `specs/008-stress-inference-service/tasks.md` (T003, T004, T005, T006,
T008, T009), `specs/008-stress-inference-service/research.md` (R-5), `docs/DECISIONS.md` (this
entry), `docs/CHANGELOG.md`.

**References**: the windowing decision (prior entry — *B2 REJECTED; adopt continuous
single-stream*), research R-5/R-7, the single-source diagnostic finding.

**Revisit at**: `/speckit-analyze`; then at implementation of T005/T006 (the invariant guard) and
of the deferred rolling decoded-frame buffer (which must pass the T006 invariant).

---

## 2026-06-19 — Feature 008 windowing device gate (T009): PASS on real Chrome + Safari/iOS

**Status**: Accepted. Resolves the Phase-2 windowing validation checkpoint (T009).

**Decision**: The continuous single-stream path — one continuous `MediaRecorder` → upload the
**contiguous recording-so-far** each stride → server **tail-extract** the last 60 s
(`compute_anchor(clip, tail_seconds=60)`) — **works on real devices**. **Phase 3+ is unblocked.**

**Evidence (real browsers, not Playwright; full detail in `smoke-tests.md`):**

- **Chrome 149 (webm/vp9), ~5-min continuous session, 30 strides:** every stride decodable; every
  framed stride (t≥30 s) → `(2958,)`. Offline re-confirm on the saved fixtures: `decode_smoke` OK
  ×5, `compute_anchor(_301, tail_seconds=60)` → `(2958,)` all-finite.
- **Safari/iOS — works PASS on BOTH containers it can produce:**
  - **Notable finding:** this iOS Safari **supports WebM/VP9 MediaRecorder** (contradicting the
    spec's "Safari emits fragmented MP4" assumption). With the harness's webm-first `pickMime`, the
    **default** iOS capture is **webm/vp9** — decodable + `(2958,)` (decode 19.4 s / extract 3.9 s).
  - **Fragmented MP4 explicitly exercised** (the gate's named unknown): forcing `?mime=mp4` pushed
    iOS into its genuine **fragmented-MP4 / CMAF** encoder (`major_brand=iso5`, `…cmfc`, **59 `moof`
    fragments**, handler `Core Media Video`, 9.4 Mbps / 68 MB — not a re-encode). It **decodes +
    tail-extracts to `(2958,)`** — the "fragile encoder" fear is dispelled (it decoded *faster* than
    the webm: 7.0 s vs 19.4 s).

**Keep-up — breaches, expected, NOT a windowing failure (production-deploy concern only).** Per-
stride server time exceeds the 10 s stride well before the 5-min cap. The breach is **decode-to-tail-
dominated and grows with session length** (Chrome live: decode-to-tail 30→122→134 s vs extract
bounded ~5–24 s on a constant ~150-frame tail; at t=300 s decode ≈ 25× extract) ⇒ the lever is the
**deferred server-side rolling decoded-frame buffer** (decode only the newest increment; research
R-5) — the *decode* side, not extract. The live worst-case is additionally inflated by ~30 concurrent
strides contending on one machine (the same 60 s clip: **9.7 s standalone vs 30 s live**) — a
cadence/back-pressure concern orthogonal to clip size. Localhost/demo is unaffected; the build
proceeds.

**Transport note (scaffolding, not a gate finding):** iOS records ~4× larger than Chrome (~12 MB/10
s), so the contiguous uploads reach 20–110 MB; a free cloudflared tunnel from a phone uplink could
not carry them (only the first ~10 s stride uploaded live, decodable, `skipped` on face-coverage —
the QUIC default also had to be switched to `--protocol http2` to carry even the mid-size POSTs). The
Safari works + per-component split were therefore measured by processing the **saved** recording-so-
far fixtures through the **same** `compute_anchor`/`measure` building blocks the live server uses —
faithful (identical extraction), since whether the bytes arrive by upload or file transfer does not
change whether they decode. (One transfer attempt via WhatsApp-as-*video* silently **re-encoded** the
clip to a 6.5 MB H.264-Baseline `mp42isom` MP4 — discarded; the real 68 MB CMAF fMP4 was re-sent as a
WhatsApp *document*.)

**Faithful by construction still holds** — there is **no fidelity outcome to fail**; the gate only
confirmed *works* + characterized *keep-up*. The T006 file-global-grid suffix invariant remains the
CI guard.

**Files changed (docs/smoke-tests/tasks only — no feature code, no model artifact, no `model_version`
bump):** `specs/008-stress-inference-service/smoke-tests.md` (T007/T008/T009 results),
`specs/008-stress-inference-service/tasks.md` (T007/T008/T009 → done), `docs/DECISIONS.md` (this
entry). The disposable harness `_scratch-008-continuous-spike/` gained per-stride works/keeps-up
logging, a markdown export, a `?mime=mp4` force, and the device-gate RUNBOOK.

**References**: the prior windowing decision (*B2 REJECTED; adopt continuous single-stream*) and the
windowing-refinements entry (R-5 keep-up split); `smoke-tests.md` § Windowing validation (continuous).

**Revisit at**: Phase 3 build (T010+); production keep-up must be re-measured against the chosen
deploy target (the rolling decoded-frame buffer is the decode-side lever if it breaches there).

---

## 2026-06-20 — feature 008: server-side smoothing reads an IN-MEMORY buffer, not the DB

**Status**: Accepted. Resolves a read-path gap left open by the D-1 flip (see
*2026-06-19 — feature 008 plan AMENDMENT: D-1 and D-2 reopened*).

**Context (the gap)**: D-3 smooths the band over the **last N=4 scored `proba[1]`**,
computed **server-side**. The *original* D-4 keyed all writes to the **service-role**, so
the API would have read `stress_probability` back with that broad credential, bypassing
the column whitelist. The **D-1 flip removed the service-role** (all DB I/O as the user via
the forwarded JWT) but only reconciled the *anchor read* (`get_my_anchor()`) and the
*writes* — it never specified how the server-side smoother reads prior `proba` back. With
no service-role **and** the `window_readings` SELECT column whitelist deliberately
**excluding `stress_probability` / `label`** from the `authenticated` role, the API (acting
as the user) **cannot** read those columns — a plain `select("stress_probability")` is
column-level permission-denied at runtime.

**Decision**: keep the rolling smoothing buffer **in server memory**, never in the DB.
- `smoothing.py` (T019) stays a **pure** function: given the recent scored `proba[1]` + the
  config thresholds (`STRESS_OPERATING_POINT` / `STRESS_TENSE_BAND`), return mean → band.
- `inference.py` (T020) holds a **per-session in-memory buffer** (`{session_id:
  deque(maxlen=4)}`, LRU-capped on session count). Each window: extract → `predict_delta` →
  the raw `proba[1]` is appended **only for scored windows** (skipped + `< 60 s` warming-up
  windows are excluded from both the buffer and the M=4 count) → smooth → band → persist the
  row (server-only `label` + `stress_probability` via the INSERT grant; `band` for the
  trend). **The raw `stress_probability` is never read back from the DB**; the SELECT
  whitelist stays exactly as committed (T010), and **no read RPC / read role is added**.
- Per-session cleanup on End is wired in US2 / T036 (`buffers.drop(session_id)`); the LRU cap
  bounds memory for abandoned sessions until then.

**Rationale**: preserves every committed privacy invariant — managers get nothing, the
owner still cannot SELECT a probability, no service-role, no new RPC that would expose the
raw `proba` to a browser (the alternative `SECURITY DEFINER recent_scored_proba()` would, like
`get_my_anchor()`, be callable by the owner's browser). The buffer is the natural home for
overlapping-window smoothing state and matches the server-authoritative-band design (SC-008).

**Trade-off (documented; deferred)**: the in-memory buffer assumes a **single worker** (or
session affinity / a shared cache such as Redis) and is **lost on API restart** → that
session simply **re-warms** (≤ ~90 s). Acceptable for the MVP / localhost demo; it is a
production-deploy concern in the same class as the deferred rolling decoded-frame buffer and
back-pressure. Logged in `docs/BACKLOG.md` (feature 008).

**References**: `contracts/smoothing-and-banding.md`, `contracts/inference-api.md` §2 step 8,
`data-model.md` (the `window_readings` SELECT whitelist), the D-1 flip entry above.

**Revisit at**: production deploy (choose single-worker / session affinity / shared cache);
and if write-integrity is ever enforced via the deferred INSERT-only role (the read path is
unaffected — it never touches the DB for `proba`).

## 2026-06-21 — feature 008 keep-up: SURGICAL O(stride) tail-decode (ffmpeg-CLI), full rolling buffer deferred

**Status**: Accepted. Implements the deferred "server-side rolling decoded-frame buffer"
keep-up item (plan.md / `docs/BACKLOG.md`) as a *surgical* O(stride) tail decode rather than
the full per-session rolling buffer. Gated build — both fidelity (GATE 1) and keep-up (GATE 2)
proven before commit.

**Context (the breach)**: under continuous single-stream upload the server re-decoded the
**whole growing recording-so-far** every window just to tail-extract its last 60 s — per-window
decode **O(elapsed)**. The 2026-06-20 supervised smoke measured the live lag *growing* ~9 s/window
to ~3 min behind (SC-001 missed). Two O(elapsed) walks: the `< 60 s` gate (`probe_recorded_seconds`
→ whole-file grab) and the tail decode (`compute_anchor(tail_seconds=60)` → whole-file decode).

**Investigation (the prescribed primitive does not exist; a faithful one does)**: "seek to a
keyframe then decode forward" assumed OpenCV can seek — it **cannot** on an un-finalized
MediaRecorder webm (no Cues index): `cap.set(POS_MSEC/POS_FRAMES)` returns `True` but is a
**silent no-op that rewinds to t=0** (decode-after-"seek" reads the whole file). The realizable
primitive: a cheap **ffprobe packet read** (demux only) for the file-global 2.5 fps grid +
duration, then decode **only the bounded trailing window** — OpenCV native `cap.set` for mp4
(seekable), an **`ffmpeg -c copy` lossless tail remux → OpenCV decode** for webm. A direct ffmpeg
`bgr24` decode is NOT bit-identical to OpenCV (a YUV→BGR colourspace shift, Chrome cosine 0.999055
— borderline); the `-c copy` remux keeps OpenCV as the decoder → **bit-identical (max|Δ|=0)**.

**Decision**: ship the surgical tail decode in `ml-video` only — `pipeline._extract_landmarks_tail`
+ `probe_global_timestamps_fast`, dispatched from `extract_landmarks(tail_seconds=…)` and
`anchor.probe_recorded_seconds`. **No change** to the upload contract, `score_window`, the
smoothing/M=4 cold-start, the `(2958,)` shape check, the skip→`FeatureExtractionError` mapping,
RLS, the SELECT whitelist, or JWT. **GATE 1**: bit-identical to the whole-file path on the real
chrome+safari continuous fixtures (`tests/test_tail_seek_keepup.py`, local-only/ffmpeg-gated; CI
suffix-invariant stays T006). **GATE 2**: per-window total **O(elapsed) 18→55 s (grows 3.1×) →
O(stride) flat ~9–13 s**; the gate alone 3.2→15.3 s → 0.1–0.8 s.

**Trade-offs (documented)**: (1) adds an **ffmpeg/ffprobe CLI** host dependency (Dockerfile +
`apps/api/README.md`); **absent → graceful fallback** to the whole-file OpenCV decode (correct,
O(elapsed)) so CI / degraded deploys keep working, **runs-but-fails on a clip → skipped window**
(200), never 500. (2) The flat cost is still ~9–13 s on the dev laptop — partly the constant
MediaPipe+LBP extract (R-5's separate lever: slower cadence / GPU) and partly the bounded decode;
the **full rolling buffer** (decode only the new ~10 s increment → true O(stride) ~1.5 s) is the
upgrade to build **only if** keep-up re-measured on the chosen deploy target breaches the stride
there. Logged in `docs/BACKLOG.md` (feature 008 keep-up entry).

**Rationale (surgical over the rolling buffer)**: bit-identical (GATE 1 at cosine 1.0) and
**stateless** — no cross-window frame cache, no reused FaceMesh, so it avoids the continuity
fidelity risk a rolling buffer would introduce and needs no extra fidelity proof; minimal; meets
GATE 2 here. The rolling buffer's only gain is headroom for a slower deploy target not yet chosen
or measured — not worth its complexity now.

**References**: `pipeline.py` (`_extract_landmarks_tail`, `_decode_tail`,
`probe_global_timestamps_fast`), `tests/test_tail_seek_keepup.py`, `tests/test_tail_window.py`
(T006 CI guard), plan.md deferred-items, `docs/BACKLOG.md` (008 keep-up).

**Revisit at**: production deploy — re-measure keep-up on the real target; build the full rolling
decoded-frame buffer (and/or read-loop back-pressure) only if the surgical flat cost breaches the
10 s stride there.

---

## 2026-06-21 — 008 edge-case pass: one-active-session-per-user fix + US4 read-path decisions

**Status**: Accepted. The session-lifecycle fix is **built** on `008-stress-inference-service`
(migration `20260621000000` + create-route change, TDD, full `apps/api` suite green and the
migration applied + the local replay test re-verified against real Postgres). The US4 read
decisions are **recorded only** — US4 (T046–T050) is deferred/unbuilt; they bind its build.

**Context**: a design-and-logic edge-case sweep over feature 008 (US1–US4), triaged with a
scoped read-only CC audit. The audit's two findings of substance were both in the **built**
US1–US3 lifecycle; the rest of the worry surface (timezone, empty/degenerate sessions, n=1
render, today-boundary) is about the **deferred** US4 read path and resolves to build-time
constraints. The privacy "watch hardest" item (D1) was found already structural at the DB
engine (column-GRANT whitelist denies `label`/`stress_probability` even to a `SELECT *`,
`42501`) — robust as-is, re-audit the US4 `.select()` strings when they land.

**Decision 1 — one active session per user (C1 orphaned-active + C2 concurrency), BUILT.**
Ending is client-driven (even the 5-min auto-end is a browser timer), so a crash/closed tab
left a row `active` forever — which also shadowed the recap's "most-recent **ended** session"
read — and two tabs created two parallel active sessions (the `plan.md` one-per-user
assumption was unenforced). Fix = make "at most one active (`ended_at IS NULL`) per user" a
**DB invariant** + **last-tab-wins** create route:

- **Partial unique index** `monitoring_sessions_one_active_per_user_idx (user_id) WHERE
  ended_at IS NULL` (migration `20260621000000`), preceded by a **backfill** that finalizes
  pre-existing duplicate actives (keep most-recent `started_at`, end the rest) so the index
  builds on existing data. New terminal `end_reason = 'abandoned'` (CHECK extended).
- **Create route** finalizes any prior active session as `'abandoned'` **before** inserting
  the new run — `ended_at` stamped at that session's **last reading** (the honest
  end-of-activity), or `now()` if it never scored. Two tabs ⇒ last-tab-wins; the first tab's
  next window upload hits the existing-already-ended `409` path. A concurrent insert that
  loses the index race (`23505`) is recovered with one finalize+retry, never a 500.
- Constraints honored: no service-role (all I/O as the user via the forwarded JWT, RLS the
  control), RLS + the SELECT column whitelist unchanged, append-only readings unchanged.
- Files: `supabase/migrations/20260621000000_one_active_session_per_user.sql`,
  `apps/api/app/supabase_user.py` (`get_active_session` / `latest_reading_at` /
  `finalize_active_session`), `apps/api/app/routers/monitoring.py` (create route),
  `apps/api/tests/test_monitoring_endpoints.py` (fake models the index race; 4 new tests).

**Decision 2 — US4 read-path rules (recorded; bind T046–T050 when built).** Mirrored into
`specs/008-stress-inference-service/data-model.md` § Reads ("US4 read-rules"):

- **Retrospective-only (B4)** — Today/recap show **ended** sessions; a fresh-active session
  (reading within 5 min) stays on the monitor page and is never drawn. "Ended" for the recap
  = `status='ended'` **OR stale-active** (active but last reading > 5 min old; activity signal
  = `max(window_readings.captured_at)`, no new column).
- **Read-less / degenerate (B1/B2/B3)** — a session with **zero** readable bands renders an
  honest "checked in, but we didn't get a clear read" + neutral marker, **never** calm; a
  single-band (n=1) session renders as a **dot**, never a broken/empty path.
- **Day attribution (A2)** — a midnight-crossing session belongs to its **start day**; no split.
- **Local time (A3)** — render `captured_at` (stored UTC) in the **user's local** zone.
- **Empty-vs-calibrate (E4)** — the recap/empty surface on the check-in card must branch on
  `has_anchor` so a no-anchor first-ever user gets calibrate-first, not "no sessions yet".

**Rationale**: structural-not-disciplinary, matching the rest of 008 — the index enforces the
invariant even if the route is bypassed or races; the create route makes the common path clean
(no orphan accumulation). Settling the US4 read rules now keeps the deferred build (and its
mock) from re-deriving them and prevents a degenerate session ever reading as "at ease".

**Revisit if**: a server-side session reaper is later added (would make the stale-active read
rule redundant — then the recap could filter strictly on `status='ended'`); or US4's mock
chooses a different in-progress treatment than retrospective-only (re-open Decision 2/B4).

---

## 2026-06-22 — 008 merge gate: ships its own spec, not polish; the two silent breaks were spec violations fixed in-branch

**Status**: Accepted.

**Decision**: Feature 008 merges when it delivers **its own spec**, not when it is polished. The
two silent breaks the Phase 8 smoke surfaced — **PATCH-CORS** (lifecycle transitions never
persisted) and **stale-token-401** (long sessions silently stopped scoring) — are **spec
violations**, not polish: persisting the lifecycle transition is a US2 deliverable, and "keeps
scoring across a long session" is the US1 read path. Both were fixed **in-branch before merge** and
verified server-side (CHANGELOG 2026-06-22; the *approach A* decision below). **Visible or cosmetic**
smoke findings (copy, spacing, animation tweaks) are **not** merge blockers and go to
`008-followups`.

**Rationale**: The merge gate is "does it do what the spec says," kept distinct from "is it
polished." A silent **wrong** result (a frozen band; an un-persisted status) breaks the spec's
promise and stays in-branch; a visible-but-correct rough edge does not, and deferring it keeps the
merge boundary clean. This is the same structural-not-disciplinary posture as the rest of 008.

**Revisit if**: a later smoke finds another **silent-wrong** break — by this gate it is in-branch,
not a followup.

---

## 2026-06-22 — stale-token fix = approach A (fresh token per upload via the browser client) + honest signed-out surface

**Status**: Accepted.

**Decision**: Fix the stale-token-401 by fetching a **fresh access token from the Supabase browser
client per window upload** (the SDK auto-refreshes near expiry — confirmed in the installed SDK
source), through the existing `deps.getSession()` seam at the upload call site; plus an **honest
signed-out surface** (a new `SESSION_EXPIRED` signed-out op → re-authenticate) whenever a session is
genuinely un-refreshable. Chosen over **approach B (reactive 401-retry: catch the 401, refresh,
replay the upload)**.

**Rationale**: The browser client was already cleanly available at the upload call site, so a
per-upload fresh token removes the expiry case **entirely** (proactive) rather than recovering from
it after the fact (reactive). It is less code in the fragile US2 async-timing area, and it fails
honest — an un-refreshable session can no longer present as a frozen-but-live band. RLS posture is
unchanged: still the **user's own** token, just **current**.

**Revisit if**: a future change moves the upload off the browser client (e.g. a server-proxied
upload), at which point the token can no longer be refreshed at the call site and a reactive retry
(or a server-side refresh) becomes the right shape.

---

## 2026-06-22 — Known followup L1: live cross-expiry continuation proven by composition, not yet demonstrated live (next smoke)

**Status**: Accepted (followup recorded).

**Decision**: The happy path "a live session crosses a token expiry and keeps scoring" is
established **by composition** — (1) the Supabase SDK refreshes the JWT near expiry, (2) the server
accepts a fresh current token under RLS, and (3) the client now fetches a fresh token per upload
(approach A) — **not** yet demonstrated live against an actually-aged session. The **silent freeze
is definitively gone** (that was the in-branch fix). The **live cross-expiry continuation** goes on
the next smoke checklist.

**Rationale**: Composition proves the freeze can't recur (each leg is independently verified), but a
live run against a >1 h aged session is the honest end-to-end confirmation. It is a smoke-retest
item, not a code gap — nothing is known-broken.

**Revisit at**: the next supervised smoke — run a session across a real token expiry and confirm
scoring continues uninterrupted.

---

## 2026-06-22 — Known followup L2 (→ `008-followups`): lifecycle PATCH calls still read the cached token

**Status**: Accepted (deferred to `008-followups`).

**Decision**: A **narrower instance of the same bug class** as the fixed stale-token break remains
and is deferred out of 008. The pause/resume/end lifecycle PATCH calls still read the **cached**
token (kept current by uploads, but **not** refreshed while paused). A manual pause longer than the
token lifetime (~1 h) followed by resume/end could send one stale token on that PATCH, which
`patchStatus` swallows as `{ok:false}` → silent status non-persistence again (the same class as the
two fixed breaks). **Followup**: route the lifecycle calls through the same fresh-token helper as the
window upload; while doing it, confirm whether a manual pause **auto-ends** (which would shrink this
to near-zero).

**Rationale (why deferred, not in-008)**: it is far **narrower** than the fixed bug — it needs a
manual pause held past the full token lifetime, where the fixed bug hit **every** long session — and
the fix lands in the **fragile US2 async-timing area right at merge time**, exactly where late
changes are riskiest. Approach A already removes the common, every-long-session case; this residual
edge is a clean, scoped followup.

**Revisit at**: `008-followups` — route pause/resume/end through the fresh-token helper; first
confirm the auto-end-on-pause behaviour (it may make this moot).

## 2026-06-22 — 009 today-card trend redesign: fork resolutions (R-2 headline, R-3 amber, radius, SVG)

**Status**: Accepted.

These resolve the two forks + two governance notes raised in
`specs/009-today-card-trend-redesign/plan.md` (Complexity Tracking) and
`research.md` (R-2, R-3). Docs/governance only; the code edits land during
`/speckit-implement`.

**Decision 1 — Honest three-level headline (R-2).** 009 FR-002 / SC-010 supersede
feature 008's `FR-022` "any stress reads as 'tense' at a glance" copy rule. The
today-card headline names the real peak in **three** levels: **at ease** (calm
wording, no amber keyword), **a little tense** (amber keyword), **tense** (amber
keyword). The "tense" wording appears **only** when the tense band is actually
reached; an a-little-tense-only day reads "a little tense", not "tense". Headline
keyword colour: `--amber-head` for any tension peak (a little tense or tense);
calm/meadow treatment for at-ease. **Scope (Step-1 grep outcome):** `deriveHeadline`
is private and feeds **only** the today card — `deriveHeadline` → (only)
`deriveRecap` → (only) `getTodayRecap` → (only) `todays-checkin-card.tsx` →
`today-view.tsx`. It is **not** shared with the live monitor (separate
`SessionTrend`/`getSessionTrend` subtitle), notifications, or any other surface, so
the fix applies **directly to `deriveHeadline`** with no scoping needed and no risk
to other surfaces. **Presentation copy only** — no read, RLS, SELECT-whitelist, or
probability change.

**Decision 2 — Amber palette tokens (R-3).** The light amber **text** token value is
**`#8A580F`** (approved-mock choice; measured ~4.78:1 on the amber tint, 5.52:1 on the
card surface — passes WCAG AA), **superseding** the constitution's previously-documented
`#7E5310`. Register the new amber sub-tokens (light / dark): `--color-amber-text`
`#8A580F` / `#E6C386` (chip text + axis tension labels); `--amber-tint` `#F4E3C6` /
`#3B2F19` (tension chip background); `--amber-soft-line` `#D49A4A` / `#E8BC7A`
("a little tense" graph line — graphic, not text); `--amber-head` `#BC7A2A` / `#E4AE5C`
(headline keyword, weight 700, large text). Bright graphic amber (`--color-amber`,
`#C98637` / `#E4AE5C`) stays on graph lines/markers only, **never** small text (2.77:1
fails). Codified by constitution Amendment 5 (MINOR).

**Decision 3 — Card radius 20px accepted.** The today card (and its plot region) use a
20px (`rounded-2xl`) radius, matching the approved mock and the already-shipped cards on
`main` (e.g. `session-trend.tsx`). Pre-existing drift from the 007 visual redesign;
codified by constitution Amendment 6 (PATCH) — range widened 8–16px → 8–20px.

**Decision 4 — Inline SVG, not Recharts, for the trend.** The fixed-px lane plot (DC-001:
1 SVG unit = 1 screen pixel) is hand-authored inline SVG. Recharts' `ResponsiveContainer`
stretches to `width:100%` — structurally the totem mechanism DC-001 forbids — so the
stack's charts library is unsuitable for this bespoke affective micro-visualization.
Precedent exists on `main` (`today-view.tsx`, `session-trend.tsx`). The stack table is
unchanged; Recharts remains the default for ordinary data charts.

**Rationale**: (1) the feature's central promise is an honest header — emitting "tense"
for a non-tense day would reintroduce the dishonesty the redesign removes; (2) bright
amber fails small-text AA, so a dedicated AA-safe text token is mandatory, and `#8A580F`
is the warmest value that still clears AA on the tint; (3)/(4) match what is already
shipped and the non-negotiable anti-totem requirement.

**Revisit if**: a future surface needs the today headline copy (it would then be shared
and require re-scoping); or a visual pass deepens the amber line colours (graphic-only,
no AA-text penalty — spec A-005).

---

## 2026-06-23 — 009 headline rework: recovery behavior (spec) + copy/voice decisions (presentation)

**Status**: Accepted.

The today-card headline is being reworked. **One part is a behavior change** (recorded
in the spec — the FR-002 / SC-010 recovery extension); **the rest is presentation copy**
and is recorded here so `/speckit-analyze` stays consistent and the implementer has the
contract. This refines the 2026-06-22 "Honest three-level headline (R-2)" decision — the
three-level honesty is unchanged — and adds the recovery branch plus the wording shape.
Docs/governance only; the `deriveHeadline` code + tests land in a separate follow-up.

**Behavior change (spec, not copy) — surface recovery, not just the peak.** A day that
reached a tension peak (tense or a-little-tense) but whose **most recent** session sits at
a **lower** band (the user eased/recovered) MUST surface that recovery (e.g. "…then eased")
rather than reporting the peak alone. The existing honesty rule is preserved: "tense"
wording appears **only** when the tense band was actually reached, and recovery wording
never upgrades a sub-tense day to "tense". This is the WHAT — recorded as the 009 FR-002 /
SC-010 extension; the exact strings are the follow-up's to propose for a final eyeball.

**Copy decisions (presentation-only; no spec change):**

- **Voice**: second-person ("your morning…"). **No trailing period** on any headline.
- **Amber scope narrowed**: the amber `hot` keyword span (rendered `--amber-head`, weight
  700) is the **bare state descriptor only** — "tense" / "a little tense". The part-of-day
  is **NOT** inside the amber span; it moves to `pre` / `post`. (The headline data shape
  stays `pre` + `hot` + `post`; only what falls inside `hot` narrows.)
- **Part-of-day rule for calm→tension arcs**: name **both** parts of day when the calm
  phase and the peak phase are **different** parts of day ("Your morning started calm, then
  you had a tense afternoon"); **collapse** to a time-neutral second clause when they are
  the **same** part of day ("Your morning started calm, then turned tense"), to avoid
  repeating the part-of-day word.
- **"No clear read today"** stays **impersonal** — no "your", no period. It describes a
  measurement gap, not the user's state.
- **Honesty preserved throughout**: the tense word appears only when tense was reached;
  "a little tense" for an a-little-tense peak; calm wording (no amber `hot`) otherwise.

**Rationale**: the recovery branch is the honest read of a day that improved — reporting
only the peak would overstate the user's *current* state, the same dishonesty the redesign
exists to remove. The copy rules (second-person, no period, amber = bare descriptor,
same-part-of-day collapse, impersonal no-read) are presentation choices with no AA or
read-surface implication, so they are logged here rather than as spec requirements — but
they are binding on the implementer and on `/speckit-analyze`.

**Source**: 009 spec FR-002 / SC-010 (recovery extension); 009 tasks T029 / T030 (headline
rework + recovery branch and its tests), which extend the now-shipped T007 / T010
three-level honesty. Accompanies the 2026-06-22 009 fork-resolution entry.

**Revisit if**: a future surface needs the today headline copy (it would then be shared and
require re-scoping — same caveat as the 2026-06-22 entry); or product decides recovery
should also be surfaced in the collapsed mini-trend colour (today it is headline copy only).

## 2026-06-23 — 009 partial-easing honesty: "eased a little" when a recovery never reaches calm

**Status**: Accepted.

Partial-easing honesty for the today-card headline recovery clause. **Bare "…then eased" is
reserved for a recovery that returns to calm (`at_ease`)**; a peak that only steps down to
**a-little-tense** (still elevated, never reaching calm) renders **"…then eased a little"**. A
reader takes an unqualified "eased" as "back to fine", which a tense→a-little-tense day has not
earned — the prior recovery branch rendered an identical bare "…then eased" for both, conflating a
full recovery with a partial one. This extends the recovery copy contract from the 2026-06-23
"headline rework" decision (66bd2d7); implemented in `deriveHeadline` at 52c2b2d.

The amber peak word and the three-level honesty are unchanged — `level` still reports the real
peak; only the easing clause is qualified, keyed off whether the most-recent confident band is
`at_ease`. Full bare "…then eased" was verified still correct for both **tense→calm** and
**a-little-tense→calm** recoveries (both reach `at_ease`).

**Rationale**: surfacing recovery must not overstate it. Reporting "eased" for a day that only
stepped from tense to a-little-tense claims a return to calm that didn't happen — the same class of
dishonesty (overstating the user's *current* state) the redesign exists to remove.

**Source**: 009 headline-rework follow-up §3 (partial-easing honesty verification); implemented at
52c2b2d — the `deriveHeadline` recovery branch in `apps/web/lib/api/monitoring-reads.ts` plus the
PARTIAL/FULL easing tests in `apps/web/tests/unit/lib/monitoring-reads.test.ts`. Extends the
2026-06-23 "headline rework" decision (66bd2d7) and the now-shipped T029 / T030 recovery branch.

**Revisit if**: the "a little tense" band label is collapsed to a single word (backlogged copy
pass) — the partial-easing clause "eased a little" should be re-phrased alongside it; or product
asks for the cross-pod easing pod to be named (backlogged), which would touch the same clause.

---

## 2026-06-23 — Constitution Amendment 8 — roadmap reorder + renumber (1.5.2 → 1.6.0)

**Status**: Accepted (constitutional amendment, MINOR bump `1.5.2 → 1.6.0`).

Principle VIII's provisional feature ordering is reconciled with built reality and
reordered, and two new planned features are added. Docs/governance only — no code, no
spec, no `specs/NNN/` folder.

**Reconciliation.** `009` is reconciled to its built reality, the today-card trend
redesign (`009-today-card-trend-redesign`) — the slot the provisional list had reserved
for the questionnaire. `008-followups` is noted as an unslotted follow-up branch (a
follow-up to feature 008 that never held a provisional slot of its own).

**Reorder.** `010-llm-client-and-chatbot` is placed ahead of `011-questionnaire` and
`012-recommendations`. Rationale: the LLM client is a shared dependency for both the
chatbot and the recommendations engine, so building it first unblocks both.

**New — `013-personalization-onboarding`.** Captures personal de-stress preferences that
feed recommendations.

**Decision (generic-first recommendations + preferences seam).** Recommendations (`012`)
ships generic-first; personalization is an additive layer. The recommendations spec MUST
define a preferences "seam" — a preferences source the engine reads, defaulted in v1 — so
`013-personalization-onboarding` plugs in later without reworking the engine.

**New — `015-preferences-hub`.** App/locale settings: language, theme, default camera,
timezone. Timezone is grouped here as a locale/display setting (NOT in the personalization
profile); because timezone needs no i18n infrastructure, it may ship ahead of the deferred
language work.

**Cross-references updated.** Principle IV audio `015 → 018`; Principle III fusion
`017 → 020`. Downstream slots shift accordingly.

**Amendment artifacts**: `.specify/memory/constitution.md` — Principle VIII ordering list,
Principle III + IV feature-number cross-references, the version line (`1.5.2 → 1.6.0`), and
the Sync Impact Report Amendment 8 entry; `docs/CHANGELOG.md` 2026-06-23. Template audit:
**none** — the `.specify/templates/{plan,spec,tasks}-template.md` files reference principles
by number, not by slug or feature number, so no template edit is required.

**Revisit if**: a later feature is realized in a different slot than the provisional list
reserves (reconcile as done here for `009`); or the recommendations engine needs a
preferences shape richer than the v1 default seam anticipates.

---

## 2026-06-24 — BACKLOG ↔ GitHub Issues mirror contract (constitution Amendment 9)

**Status**: Accepted (constitutional amendment, MINOR bump `1.6.0 → 1.7.0`). Establishes the
rules for an upcoming `docs/BACKLOG.md` → GitHub Issues migration. **This decision opens no
issues** — the migration itself is a separate, later step; this entry + the constitution
amendment + the `CLAUDE.md` rule only establish the contract.

**Approach — BACKLOG.md is the source of truth; GitHub Issues are a 1:1 mirror.** Chosen over
making Issues the source of truth, because the rich in-repo record (full descriptions, fix
scopes, cross-references, the chronological "deferred-from" log) is read by both Claude Code and
planning-Claude during specs/plans; GitHub Issues are the collaboration/visibility surface, not
the canonical store. On any conflict, **BACKLOG wins** and the issue is reconciled to it.

**Scope — *all* backlog items migrate, including already-fixed ones.** Resolved / struck-through
entries become issues that are **created and then immediately closed**, with the real resolution
date + commit/PR recorded in the issue body (GitHub stamps every issue "opened today", so the
honest history must live in the body, not GitHub's timestamps). `watch` items migrate as **open**
issues (monitor-only). Nothing in BACKLOG is deleted — it remains the append-only log; the issues
are the mirror.

**The 4-rule contract (the steady-state flow for future work):**
1. **BACKLOG is the source of truth; Issues mirror it; BACKLOG wins on conflict.**
2. **New follow-up → open its issue in the same change** and record `(#NN)` on the BACKLOG entry.
3. **Fixed follow-up → mark the BACKLOG entry resolved (date + commit/PR) AND close the matching
   issue in the same change.**
4. **The link is two-way** — the BACKLOG entry carries `(#NN)`; the issue links back to BACKLOG.
Never update one side without the other.

**Label taxonomy** (to be created in the later migration via `gh label create`; milestones are
intentionally skipped for now to avoid overhead):

| Label | Hex | Applies to |
|---|---|---|
| `type:bug` | `#d73a4a` | known-wrong behavior |
| `type:tech-debt` | `#845422` | structural cleanup |
| `type:polish` | `#bfdadc` | UX nicety, non-blocking |
| `type:feature` | `#0e8a16` | new capability |
| `type:tooling` | `#5319e7` | harness/CI/dev-tooling |
| `area:web` | `#1d76db` | `apps/web` |
| `area:api` | `#006b75` | `apps/api` |
| `area:ml-video` | `#8250df` | `packages/ml-video` |
| `area:ml-audio` | `#a371f7` | audio modality |
| `area:db` | `#fbca04` | Supabase/migrations/RLS |
| `area:infra` | `#5a6772` | Azure/CI/cloudflared |
| `area:docs` | `#0075ca` | docs only |
| `priority:blocker` | `#b60205` | pre-production deploy blockers |
| `status:watch` | `#fef2c0` | monitor-only, no work yet |

**Status mapping** (BACKLOG status → label/state): `bug` → `type:bug`; `polish` → `type:polish`;
`tech-debt` → `type:tech-debt`; `deferred-feature` → `type:feature`; `deferred-tooling` →
`type:tooling`; `deferred-bug` → `type:bug` (legacy mislabel, being normalized to `bug` in
BACKLOG); `watch` → `status:watch` + **open**; `resolved` → **closed**. The `type:` and
`priority:` / `status:` labels are the governed set; `wontfix` is intentionally **NOT** created
(no current items qualify).

**Amendment artifacts** (files this change touched): `.specify/memory/constitution.md` (Principle
VIII new bullet + version line `1.6.0 → 1.7.0` + Sync Impact Report Amendment 9 entry); `CLAUDE.md`
("Backlog ↔ Issues" section, placed outside the SpecKit-managed block so `/speckit-*`
regeneration cannot clobber it); `docs/BACKLOG.md` (cleanup ride-along — five stale `— in
progress` headers flipped to `— merged <date>`; three status normalizations; the manager-visibility
item merge into feature 016; the feature-number remap); `docs/CHANGELOG.md` (2026-06-24 line); this
`docs/DECISIONS.md` entry.

**Cross-references**: constitution Amendment 9 (`.specify/memory/constitution.md`); `docs/CHANGELOG.md`
2026-06-24; `CLAUDE.md` "Backlog ↔ Issues".

**Revisit if**: the team decides a different store should be canonical (would require re-deciding
rule 1 and re-rating BACKLOG vs Issues); or the label taxonomy needs a new `type:`/`area:` as new
packages/surfaces land (add the label, record it here).

---

## 2026-06-25 — protobuf high (Dependabot #1 + #17): accept-and-document, do not patch

**Status**: Accepted (tolerable risk; documented). Supersedes any default "patch every high"
reflex for these two alerts only.

**Context**: Dependabot raised the same protobuf high twice — alert **#1** (`apps/api`) and
alert **#17** (`packages/ml-video`) — both for `protobuf 4.25.9`
(GHSA-7gcm-g887-7qv7 / CVE-2026-0994). It surfaces twice because protobuf is a transitive of
the load-bearing `mediapipe==0.10.13` pin in both Python workspaces.

**Decision**: Leave both **unpatched, on purpose.** Dismiss the alerts as tolerable risk and add
a Dependabot `ignore` rule for `protobuf` on both pip ecosystems so the un-takeable bump stops
being re-proposed (`.github/dependabot.yml`, same pass).

**Why the fix is out of range** (not a "won't bother" — it is *unavailable* under our pins):

- The advisory's only fix floor on the 4.x/5.x line is **protobuf 5.29.6** — there is **no
  4.25.x patched release**; the entire 4.x branch sits inside the vulnerable range with no
  escape below 5.
- **`mediapipe==0.10.13` requires `protobuf<5`** (`<5,>=4.25.3`). 5.29.6 violates that cap, so
  the fix cannot be taken without abandoning the mediapipe pin. `uv sync --locked` cannot even
  resolve `mediapipe 0.10.13 + protobuf 5.29.6` — the conflict surfaces at lock time, so
  Dependabot can't generate a mergeable PR for these manifests anyway.

**Why bumping mediapipe is not a free lunch** (it reaches into the thesis deliverable):

- Every mediapipe that *does* admit protobuf ≥5 (**0.10.30+**) **drops the legacy
  `mediapipe.solutions.face_mesh` API the extraction pipeline uses** — the newer lines expose
  only the Tasks-API `FaceLandmarker`. Taking the fix is therefore a **feature-extraction
  rewrite plus model re-validation**: landmark coordinates drift between the two APIs, so the
  2958-d vectors must be re-extracted, the per-user-delta model re-fit, and LOSO re-run to
  confirm discrimination holds. Estimated **~2–6 days**, and it touches the model artifact the
  thesis depends on — not a dependency-bump-sized change.

**Why it is not reachable** (the residual risk is low, hence "tolerable"):

- The CVE is a **JSON-parse recursion-depth DoS** in protobuf's `json_format` parser. The
  pipeline feeds mediapipe **only its own internally-generated *binary* graph/config protobufs**
  — there is **no attacker-controlled JSON** reaching protobuf on any surface (the `/anchor` and
  monitoring uploads are video bytes, decoded by OpenCV, never JSON→protobuf). So the
  vulnerable code path is not exercised by any input an attacker can shape.

**Backstop on revisit**: the model already carries a confirmatory **served-path-vs-notebook**
check (the bit-for-bit extraction/proba fidelity gate; PROGRESS 2026-06-20, MODEL_HANDOFF). Any
future deliberate ML-stack/Tasks-API upgrade that takes the protobuf fix MUST re-run that gate
(re-extract → re-fit → re-LOSO) before trusting production vectors. Until such an upgrade is
scheduled as a unit, the accept-and-document stands.

**Revisit when**: the ML stack is intentionally upgraded to a mediapipe line on protobuf ≥5
(at which point this is a planned feature-extraction + model-revalidation workstream, not a
security patch), or the CVE's reachability changes (e.g. a new surface starts parsing
attacker-controlled JSON through protobuf — none today).

**Cross-references**: Dependabot alerts #1 / #17; `.github/dependabot.yml` (the `protobuf`
ignore rules); DECISION-1 (the `mediapipe==0.10.13` / Python-3.12 ceiling); `docs/MODELS.md` +
the `features.py` fidelity caveats; `docs/PROGRESS.md` 2026-06-25 (the security pass).

---

## 2026-06-25 — Correction to DECISION-20: the capture-route CSP is ENFORCED (T004 flip done)

**Status**: Correction (append-only). DECISION-20 is **not** rewritten; this entry records that
its "Status: Accepted (report-only); flipping to enforce is open as T004" line is now **stale**.

**What changed since DECISION-20 was written**: DECISION-20 (feature 005) described the scoped
`'wasm-unsafe-eval'` capture-route CSP delta as shipping **Report-Only**, with the flip to
enforce tracked as the open **T004** deploy blocker. That flip has since happened — the entire
app CSP, **including** the capture-route delta, is now served **enforcing**, not report-only.

**The enforcing code (where to look)**:

- `apps/web/proxy.ts` — `const CSP_HEADER = "content-security-policy";` (the enforcing header
  name, **not** `…-report-only`). Its comment records the rollout: the slice-5 fix pass first
  shipped Report-Only, drove every route under Playwright capturing `securitypolicyviolation`
  events until the violation list was empty (the one real finding — Zod 4's JIT `new Function`
  probe — was resolved via the `@/lib/zod` jitless barrel, not by weakening `script-src`), then
  renamed the header to enforce.
- `buildCsp(nonce, pathname)` in the same file appends `'wasm-unsafe-eval'` to `script-src`
  **only** on the capture routes — now `/onboarding`, `/app/calibrate`, **and `/app/monitor`**
  (feature 008 added the monitoring capture route to `isCaptureRoute`); everywhere else keeps
  the stricter policy. No `connect-src` host added for the detector (same-origin under
  `connect-src 'self'`); COEP stays unset.
- `docs/security/05-csp-header.md` documents the Report-Only → capture → enforce rollout
  ("Rollout executed") and the empirical violation capture.

**Net**: the "detector must not ship under report-only" deploy blocker DECISION-20 named is
**resolved** — the policy is enforced in code. The `'wasm-unsafe-eval'` allowance remains tightly
scoped to the capture routes only. Keep the capture-route set in lockstep across
`isCaptureRoute` (`proxy.ts`), `CAPTURE_ROUTES` (`next.config.ts`), and the site-wide `camera=()`
negative-lookahead — see the BACKLOG "new camera/capture route must be registered in EVERY
camera-policy touchpoint" item (#83).

**Cross-references**: DECISION-20 (the original report-only decision); `apps/web/proxy.ts`;
`docs/security/05-csp-header.md`; BACKLOG #83 (capture-route registration lockstep).

---

## 2026-06-25 — Dependabot: security-updates only (version updates turned OFF)

**Status**: Accepted. Corrects the 2026-06-25 `.github/dependabot.yml` (added in the security-pass
closeout, PR #101) which inadvertently left *version* updates enabled.

**Context**: The `dependabot.yml` added in the security pass was framed and intended as
"grouped **security** updates only." It is not. A Dependabot `updates:` block enables **version**
updates *by default*, and `applies-to: security-updates` on a `groups` entry only controls how
*security* PRs are **grouped** — it does **not** scope the block to security-only. So the block,
written purely to fence the load-bearing ML pins (`protobuf`/`mediapipe`/…) and pre-group security
PRs, also quietly switched on weekly version-update PRs the next time Dependabot ran. That produced
five unsolicited version bumps in one batch — **#102** react-dom, **#103** @radix-ui/react-dropdown-menu,
**#104** react-hook-form, **#105** lucide-react, **#106** eslint — none of them security fixes, two
of them red.

**Decision**: Make the file genuinely security-updates-only by **disabling version updates**, not by
trying to "scope" them away:

- `open-pull-requests-limit: 0` on all three blocks (npm `/`, pip `/apps/api`, pip
  `/packages/ml-video`). A limit of 0 turns **version**-update PRs off entirely. **Security** updates
  are unaffected — Dependabot tracks them against a *separate internal limit of 10*, independent of
  `open-pull-requests-limit`. The `groups: { applies-to: security-updates }` blocks still pre-group
  the weekly security PRs at limit 0; the `ignore:` ML-pin fences stay intact (and now matter only
  for the rare case where an ignored pin is itself the subject of a security advisory).
- `labels: []` on all three blocks so Dependabot stops stamping its off-taxonomy `dependencies` /
  `javascript` labels on PRs, keeping the curated `type:`/`area:`/`priority:`/`status:` taxonomy
  (Constitution Principle VIII / `docs/DECISIONS.md` label-taxonomy entry) clean.

Routine currency bumps (keeping leaf deps fresh) are henceforth handled as **deliberate, reviewed
batch passes** when we choose to do them — not as a passive weekly PR stream that has to be triaged
and closed.

**Why version updates are not worth the passive stream here** — the two concrete failure modes the
#102–#106 batch demonstrated, both of which a human batch pass absorbs but an auto-PR does not:

- **Majors break transitively, silently (#106, eslint 9 → 10).** ESLint 10 removes
  `context.getFilename()`, which `eslint-plugin-react` still calls, so the flat config throws at
  lint time; ESLint 10 also raises its Node engine floor, tripping an `EBADENGINE` against the
  repo's pinned Node 22.11. A version-update PR happily proposes the major and goes red, with the
  real cost (a plugin-compat + Node-floor migration) buried under a one-line "bump eslint".
- **Exact-pinned pairs skew (#102, react-dom).** `react` and `react-dom` are exact-pinned and must
  move together, but Dependabot bumps one leaf at a time — so a lone `react-dom` bump lands
  mismatched against `react` and fails. Version updates have no notion of "these two move as a unit."

**Why not auto-merge / required-CI gating instead**: leaving version updates on but gating them still
costs a human a triage+close on every passive PR (the majority of which we don't want this week
anyway). Turning them off is the lower-friction correct default; we re-enable a currency pass
intentionally when it's worth the migration attention.

**Revisit when**: we want a scheduled dependency-currency sweep — at which point run it as an
explicit batch (or temporarily raise `open-pull-requests-limit` for a single controlled pass),
review the majors by hand (eslint-style breakage, exact-pin pairs), and drop the limit back to 0.
Security updates need no revisiting — they keep flowing at limit 0.

**Cross-references**: `.github/dependabot.yml` (the limit-0 + labels-[] change); the 2026-06-25
"protobuf accept-and-document" entry (the `ignore` ML-pin fences this block was originally written
for); Dependabot version-update PRs #102–#106 (closed post-merge as unintended); Dependabot alert
#10 / postcss (left open — deferred, unaffected); `docs/PROGRESS.md` 2026-06-25.

---

## 2026-06-25 — Constitution Amendment 10 — `009b-monitoring-graph-redesign` roadmap slot (1.7.0 → 1.8.0)

**Status**: Accepted (constitutional amendment, MINOR bump `1.7.0 → 1.8.0`).

Principle VIII's provisional ordering gains one new planned slot for the within-session
monitoring-graph redesign — the live "This session" graph
(`apps/web/components/monitor/session-trend.tsx`) that was scoped out of feature 009.
Docs/governance only — no code, no spec, no `specs/NNN/` folder, no `session-trend.tsx`
change. (Authored by editing `.specify/memory/constitution.md` directly, not via
`/speckit-constitution`, to preserve the hand-curated Sync Impact Report amendment history.)

**Decision — slot it as `009b` (009's sibling), not `010`.** The new slot is inserted
immediately after the shipped `009-today-card-trend-redesign` and before
`010-llm-client-and-chatbot`; slots `010`–`020` are NOT renumbered.

**Why `009b` and not `010` (renumber-avoidance + decoupled label):**
- **Avoids renumbering 11 downstream slots.** Inserting at `010` would push `010`–`020`
  each up by one, churning every stale cross-reference to those numbers (Principle III
  fusion `020`, Principle IV audio `018`, BACKLOG "feature NNN" pointers, CHANGELOG
  history) for no semantic gain. The `b` suffix inserts the slot in place with zero
  downstream edits.
- **It is a redesign of an existing surface, not a new forward feature.** The "This
  session" graph already ships (`session-trend.tsx` on `main`); this slot redesigns it, so
  it belongs adjacent to its sibling `009` (the today-card trend redesign it was scoped out
  of), not at the tail of the forward-feature queue.
- **The roadmap label is decoupled from the real branch number.** SpecKit auto-assigns the
  actual `NNN-` branch number at `/speckit-specify` time regardless of this label, so the
  roadmap slug `009b` carries no constraint on the eventual branch number — it records
  ordering/intent only.

**Why the shipped `009` is NOT renamed to `009a`.** `009` keeps its number: its branch /
PR #25 / CHANGELOG history is fixed, and relabeling it `009a` would create constitution↔git
drift. The `b` suffix already implies `009` is the original.

**Design-locked, pending spec.** A signed-off HTML reference for the redesign exists, so the
visual direction is locked; only the spec/plan/tasks remain. No BACKLOG entry / GitHub Issue
is opened for this slot at this step — the redesign was deliberately not filed to BACKLOG
(`docs/PROGRESS.md` 2026-06-25), and a roadmap slot is the appropriate tracking until its
spec opens; if a follow-up is later logged it follows the BACKLOG↔Issues contract
(Amendment 9).

**Amendment artifacts**: `.specify/memory/constitution.md` — Principle VIII ordering list (the
new `009b` slot), the version line (`1.7.0 → 1.8.0`), and the Sync Impact Report Amendment 10
entry; `docs/CHANGELOG.md` 2026-06-25. Template audit: **none** — the
`.specify/templates/{plan,spec,tasks,checklist,constitution}-template.md` files reference
principles by number, not by slug or feature number (the only `009`-shaped string in the
templates is the unrelated task id `T009`), so no template edit is required (consistent with
the Amendment 8/9 audits).

**Revisit if**: the monitoring-graph redesign is realized in a different slot than the
provisional list reserves (reconcile as done for `009`); or a future scheme change wants the
`NNNx` sibling-suffix convention generalized or retired.

---

## 2026-06-26 — Live-monitor inference concurrency control: per-session gate = 1 + drop-stale

**Status**: Accepted. Implemented on `fix-inference-concurrency-camera-down` (PR #113);
BACKLOG #110 (formalizes #78 note (b)). Behavioural change to the inference read path, so
recorded here.

**Context**: the live-monitor reading lag was contention-dominated and *growing*. A window
scores ~10–11 s isolated, but `POST /monitoring/sessions/{id}/windows` dispatched scoring via
`run_in_threadpool` under the **anyio default `CapacityLimiter` = 40**, and the browser fired a
new 60 s window every ~10 s regardless of whether the previous finished. ~10 windows scored at
once on one session → CPU oversubscription → each ballooned to 40–110 s → lag climbed. (The
earlier O(stride) tail-decode fix removed the decode half of #78; this removes the concurrency
half.)

**Decision**:
1. **Bound scoring to one window per session** via a per-session `asyncio.Lock` held across the
   `run_in_threadpool` call (`app/services/scoring_gate.py` `SessionScoringGate`). **Concurrency
   1, not 2** — the D-3 `_SessionBuffers` smoothing buffer assumes a single writer per session
   (DECISIONS 2026-06-20 / BACKLOG #79); 2 would let two threads mutate one session's `deque`.
2. **Drop-stale** via a **monotonic per-session sequence**, not a `captured_at` marker (a counter
   has no same-millisecond tie, so "freshest" is unambiguous). On acquiring the lock a window
   re-checks `my_seq == latest_seq`; if a newer window arrived it is **shed**. The freshest window
   always wins the check, so warm-up still reaches its 4 scored windows — drop-stale only sheds the
   *backlog*, never the newest (the hard constraint).
3. **Shed shape = a dedicated `superseded` outcome**, not a reused `skipped`/`warming_up`: it
   **persists no `window_readings` row**, shows no misleading "couldn't read" note, and is parsed
   client-side as a **true no-op** — explicitly *not* folded into `warming_up`, which would regress
   an active band.
4. **Client back-pressure** (`monitoring-session.tsx`) is the bandwidth half: never two uploads in
   flight, coalesce to the latest window. This makes drop-stale rarely fire in single-tab use; the
   server gate is the backstop for misbehaviour / a second tab.
5. **Camera-down mislabel (same PR, BACKLOG #111)**: create-session failures route to honest
   surfaces — `401` / null-token → the existing **signed-out** surface (a token problem, not the
   backend being down), `network` / `5xx` / stray `403` → a new **service-unavailable** surface;
   `no_anchor` and the real `getUserMedia` denial (Path A) unchanged.

**Rationale**: caps live lag regardless of client behaviour while preserving the single-writer
buffer invariant and the on-schedule warm-up latch. The `superseded` no-op keeps the honest-surface
discipline (no fabricated "couldn't read" for a deliberate shed) and avoids persisting rows for shed
windows.

**Consequence to weigh later (009b / US3)**: drop-stale ⇒ fewer persisted `window_readings` rows ⇒
the 009b "This session" trend (`specs/010-monitoring-graph-redesign`) will have sparser points —
revisit when US3 resumes (BACKLOG #110 forward-note).

**Revisit if**: a multi-worker deploy is chosen (the gate is process-local, like `_SessionBuffers`
#79 — needs session affinity or a shared coordinator); or warm-up latency (#112) is tuned in a way
that needs the gate to allow a bounded burst for the first M windows.

---

## 2026-06-26 — Tier-2 warm-up scoring concurrency: tried and ABANDONED (no-go)

**Status**: Rejected (negative result — recorded so it is not re-attempted). Built and measured on
the throwaway branch `try-tier2-warmup-concurrency` (PR #114, **closed unmerged**, branch deleted;
head commit `667fa8d` retained via the closed PR). `main` is byte-for-byte unchanged. This is the
experiment the preceding (2026-06-26 gate) entry's *"Revisit if … warm-up latency (#112) … bounded
burst for the first M windows"* forward-note anticipated — and the answer is **no**.

**Hypothesis**: time-to-first-band is the bulk of the warm-up, so let the first **M=4** cold-start
windows score **concurrently** (a per-session `asyncio.Semaphore(M)` that never sheds), then hard-clamp
back to the #113 single-flight + drop-stale once the band latches, to pull the first reading earlier.

**Why it was abandoned — three findings**:
1. **Capture-floor bound (hardware-independent).** The 4th *scoreable* window cannot be **captured**
   before ~90 s (10 s stride × 4 windows, each needing ≥ 60 s of recording). Concurrency speeds up
   *processing*, not *capture*, so there is nothing for it to compress — the band lands at ~90 s + one
   window's processing no matter what. Shortening the stride is a **different lever** (not pursued here).
2. **Under contention it was SLOWER.** Offline replay of the real cold-start fixtures (harness in PR
   #114 / `667fa8d`): 4-way concurrent extraction inflated per-window processing **~3.1×**
   (~7.3 s → ~22.7 s) — MediaPipe/LBP decodes are CPU-bound and 4 saturate the cores. The band is
   delivered only after the band-carrying window finishes, so inflating that window pushed first-band
   *later*. A **live 3-session diagnostic** confirmed it: first-band **delivered** at 1:46 / 1:47 / 2:06
   vs a serial floor of ~1:42 — concurrency *added* 4–24 s, worst on the cold first run.
3. **It introduced a reachable display regression the serial path cannot produce.** With concurrency the
   first M windows complete **out of capture order**, so a later-captured window can finish while the
   buffer briefly holds < M scored → it returns `warming_up` **after** a band was already delivered. The
   reducer's `warming_up` branch unconditionally sets `op:"warming-up"`, regressing the live band to
   "Getting a read on things" (the #80/#81 fingerprint) and rendering an early-looking band + a warming
   gap in the `captured_at`-ordered trend. Serial completion is *in* capture order (buffer fills
   1→2→3→4 monotonically), so this is structurally impossible. Observed in the heavy-contention cold-start
   session (a ~0.1 s near-miss live; present in the persisted trend).

**Confirmed good (kept as knowledge, not as code)**: steady-state stayed **bounded** — the #113 lag fix
held; per-window processing recovered to ~13 s once the clamp engaged, with **no return** of the growing
40→110 s lag. The correctness mechanisms were sound and fully tested (capture-ordered, lock-guarded
`_SessionBuffers`; warm-up semaphore gate that re-arms on Resume).

**No CHANGELOG entry** — nothing shipped.

**Revisit only if**: a target deploy is materially **slower per-window than the dev laptop** (so
per-window processing exceeds the 10 s stride → a real serial pileup to compress) or upload bandwidth of
the multi-MB growing clips dominates — re-measure on that hardware first with the PR #114 harness; **or**
the capture stride itself is shortened (a different lever that moves the capture floor). On current
hardware neither holds.

---

## 2026-06-27 — feature 010 (monitoring-graph-redesign, roadmap 009b): load-bearing decisions

**Status**: Accepted. Shipped on `010-monitoring-graph-redesign`, **merged to `main`** via **PR #118**
(squash `6b8653e`, 2026-06-27). Frontend-only inside `apps/web` (one component
`components/monitor/session-trend.tsx` replaced + one new pure module `lib/session-trend-geometry.ts`);
the read layer, RLS, SELECT whitelist, page layout, and `globals.css` are untouched and no probability
reaches the client. Full reasoning in `specs/010-monitoring-graph-redesign/{spec,plan,research}.md`;
this entry pins the three decisions that are load-bearing for anyone touching the live graph next.

### D1 (headline) — out-of-frame staleness threshold re-tuned 20 s → 60 s, constant-derived + two-sided regression guard

**Context.** During the ST-7 smoke (#117) the parked now-marker behaviour exposed two coupled bugs: a
single-reading → out-of-frame transition **blanked** the graph (the marker vanished instead of parking),
and the freshness horizon that decides "is the live edge stale enough to park the marker?" was set to a
flat **20 s** — short enough that a perfectly healthy live read could exceed it and **false-park** (the
marker mutes/relabels "last clear read" while the read is actually fine).

**Decision.**
1. **Fix the blank** with a silent-empty refetch guard in `session-trend.tsx`: `getSessionTrend` returns
   `[]` (it does **not** throw) on any transient Supabase error, and `refetch` previously called
   `setPoints(next)` unconditionally, wiping `points` → `isEmpty`. Replace with a functional update that
   treats a silent empty response like a thrown exception: `setPoints((prev) => next.length === 0 &&
   prev.length > 0 ? prev : next)` — keep the existing rows. (The geometry already handled
   `[confident, no_read]` correctly; the bug was purely in the component's data layer.)
2. **Raise the freshness horizon to a constant-derived 60 s**, not a hand-picked round number:
   `STRIDE_MS (10) + PROCESSING_CEILING_MS (30) + POLL_MS (12) + FRESHNESS_MARGIN_MS (8) = 60 s`. The
   horizon is the **worst-case age of a still-healthy live read** plus margin — derived from the actual
   pipeline cadence, so it tracks the system rather than a guess.
3. **Guard it two-sided** (the regression discipline): the threshold must be **greater than the
   worst-case healthy read age (~52 s)** — its lower bound — *and* **less than `WINDOW_MS` (120 s)** —
   its upper bound. The lower bound stops **false-parking a live read** (the #117 symptom); the upper
   bound guarantees a **genuinely stale** reading still **scrolls off the rolling ~2-min window**
   (FR-002a) rather than parking forever off-screen. A one-sided "just make it bigger" fix would have
   satisfied the lower bound while silently risking the upper.

**Rationale.** Parking the marker on a stale reading while still showing a live anchor is exactly the
dishonesty this redesign exists to prevent; the threshold is the hinge between "honest stale anchor" and
"false-parked healthy read", so it is derived from named cadence constants and fenced from both sides,
not tuned by feel. **Scope note (Principle VIII):** the `20 s → 60 s` value is an **implementation
constant** — it is not a number written into any FR/SC, and FR-004a's parked-marker *behaviour* is
unchanged in wording — so this is a code re-tune, not a spec amendment. Live-confirmed in the ST-7
re-run (2026-06-27). BACKLOG `#117` (CLOSED).

### D2 — three honest no-read treatments + ramp-up fill-to-width geometry (US2)

**Decision.** Split no-reads into **three** treatments derived in the pure module from `band` +
`skipCause` + position: **warming** (dashed muted line, session-start-only, ≥2 points) · **out-of-frame
foggy gap** (built per the mock but **gated OFF at launch** behind a single injectable
`showOutOfFrameFoggy` boolean — at launch out-of-frame routes to the muted gap) · **no-clear-read muted
gap** (static-opacity fade, never a bridged flat carried-forward line; a leading skip with no prior
confident reading is **fade-in only**). The x-axis is a **uniform slot per capture window** on a rolling
~2-min window; during **ramp-up** (< `N_target = 12` windows) the few windows **fill the full plot
width** edge-to-edge (pitch `plotWidth / (count − 1)`), **locking** at `plotWidth / (N_target − 1)` once
the count reaches 12 (continuous at the hand-off, no jump), then older windows scroll off the left.

**Rationale / why over the alternatives.** The component used to **flatten every no-read into one
undifferentiated gap** and discard both `skipCause` and the warming-vs-skip signal (both already on
every `SessionTrendPoint`); the redesign is honesty-critical, so each cause gets a distinct, honest
treatment. The **foggy gate ships OFF** because out-of-frame reliability is unproven until issue **#100**
confirms `skipCause === "out-of-frame"` is distinguishable from low-confidence — honesty-first means not
shipping a "you left frame" claim we cannot stand behind; the gate is a **one-line flip**, not a
re-implementation, when #100 lands. **Fill-to-width** was chosen over the prior right-anchored fixed
`plotWidth / N_target` slots (which left the left of the plot blank — a "cut off" look for the first
~2 min of every session) and over fill-**from-left** (which would move the "you are here" now-marker for
~2 min); the pick keeps the now-marker dead-still at the right edge and accepts gentle background
re-spacing as the cost. Static-opacity fades (not temporal animation) satisfy reduced-motion (SC-006) by
construction.

### D3 — event-driven now-marker freshness via a `refreshSignal` prop (the orb/trend lag fix)

**Decision.** Make the live now-marker reflect a new reading as promptly as the camera-stage bloom/orb:
`monitoring-session.tsx` bumps a `trendRefresh` counter on each **persisted** window outcome (reading /
scored-warming / skipped — **not** `superseded`, which writes no `window_readings` row) and passes it as
a `refreshSignal` prop; `session-trend.tsx` re-fetches `getSessionTrend` **immediately** on each
`refreshSignal` change, while the pre-existing ~12 s poll stays as the steady-state **backstop**
(deliberately **not** lowered — DB load on the deploy VM).

**Rationale / why over the alternatives.** The marker visibly **trailed the live orb by up to a poll
(~2 s+)** because it only updated on the background poll. Rejected: **lowering the poll interval**
(raises DB load on every session for a problem that only matters at the live edge) and an **optimistic
in-memory marker value** (would risk a marker-vs-step-line mismatch). The marker stays sourced from the
**persisted row** — committed *before* the window POST response returns (`insert_reading` precedes the
returned outcome in `apps/api/app/services/inference.py` + `supabase_user.py`) — so the event-driven
refetch reads a row that already exists: **no optimistic value, no mismatch**, and the same read
layer/contract (only *when* `getSessionTrend` is called changes).

**Cross-references**: `specs/010-monitoring-graph-redesign/` (spec FR-002a / FR-004 / FR-004a / FR-011 /
FR-012 / FR-015, SC-008 / SC-009 / SC-011 / SC-012a; research R-2 / R-3 / R-4; plan Complexity
Tracking); `docs/CHANGELOG.md` 2026-06-27; `docs/PROGRESS.md` 2026-06-27; `docs/BACKLOG.md` "From
feature 010" (#117 resolved) + the open #100 (foggy-gate trigger); the 2026-06-25 Amendment 10 entry
(the `009b` roadmap slot); the 2026-06-26 inference-concurrency entry (drop-stale ⇒ sparser trend
points, the forward-note this feature consumes).

---

## 2026-06-27 — Constitution Amendment 11 — roadmap renumber `009b → 010` (monitoring-graph) (1.8.0 → 1.8.1)

**Status**: Accepted (constitutional amendment, PATCH bump `1.8.0 → 1.8.1`). Authored by editing
`.specify/memory/constitution.md` directly (not via `/speckit-constitution`, to preserve the
hand-curated Sync Impact Report history). Docs/governance only — no code, no spec, no `specs/NNN/`
rename.

**Decision — make monitoring-graph canonically `010`, not the `009b` interstitial.** Amendment 10
(2026-06-25) slotted the redesign as `009b` to avoid renumbering the tail *while it was still
design-locked and pending spec*. It has since **shipped** — a full feature with its own
`specs/010-monitoring-graph-redesign/` folder, US1–US3, a pure geometry module, 726 unit tests, and a
squash-merge to `main` (PR #118, `6b8653e`, 2026-06-27). A shipped feature with its own spec earns a
**sequential number**, and SpecKit had already auto-assigned the branch `010`, so the roadmap is
reconciled **to git reality**: `009b-monitoring-graph-redesign` → `010-monitoring-graph-redesign` (the
"scoped out of 009 … pending spec" parenthetical dropped — no longer true). The tail renumber
(`010-llm-client-and-chatbot → 011` … `020-fusion → 021`) is the **mechanical consequence**, plus the
two live cross-refs (Principle IV audio `018 → 019`, Principle III fusion `020 → 021`).

**Why `010`-canonical over keeping `009b`.** The `b`-suffix interstitial was a *renumber-avoidance*
device justified by "it's a redesign of an existing surface, not a forward feature, and it isn't
built yet" (Amendment 10). Both halves of that lapsed once it shipped with a sequential `specs/010-…`
folder: the roadmap label now **diverges from the actual branch/spec number** (`010`), and a
roadmap whose labels don't match the shipped artifacts is the very drift the ordering list exists to
prevent. Keeping `009b` would mean the canonical record says `009b` while git, the specs folder, and
PR #118 all say `010` — confusing for every future reader. Renumbering is cheap here precisely
because **every renumbered slot is unstarted** (no branch, PR, or spec folder bears those numbers
yet); the shipped `001`–`010` are untouched.

**Why PATCH, not MINOR.** Amendment 8 was MINOR because it **added two new feature slots** and
reordered — materially changing the guidance. This amendment adds **no** slot, removes **no** slot or
principle, and changes **no** rule: the same features remain in the same relative order; only the
numeric labels shift to match shipped reality. That is a non-semantic documentation reconcile —
PATCH. (Contrast also Amendment 10's MINOR, which *added* the `009b` slot.)

**Risk**: low. No started work references the renumbered slots; the shipped feature numbers are
fixed; the Amendment 10 narrative is left verbatim as the dated record of the interstitial decision
(append-only history is not rewritten to make numbers line up).

**Cross-references**: `.specify/memory/constitution.md` Amendment 11 (Sync Impact Report) + Principle
VIII ordering list + Principle III/IV cross-refs + the version line; `docs/CHANGELOG.md` 2026-06-27;
`specs/010-monitoring-graph-redesign/`; PR #118 (`6b8653e`); the 2026-06-25 Amendment 10 entry (the
superseded-by-shipping `009b` slot decision).

## 2026-06-28 — Primary/fallback LLM switch to gpt-oss (Groq Llama-3.3-70B deprecation)

**Status**: Accepted.

**Decision**: Primary LLM `llama-3.3-70b-versatile` → `openai/gpt-oss-120b` (Groq, `reasoning_effort="low"`). Fallback Gemma-3-4B → `openai/gpt-oss-20b` via LM Studio. The adapter keeps a defensive `{...}` extractor backstop for reasoning that leaks into `content` (a known Groq bug); `reasoning_format` is a Qwen param and is NOT used (use `reasoning_effort`). Scorers use `response_format={"type":"json_object"}`.

**Rationale**: Groq is shutting down Llama-3.3-70B on 2026-08-16. gpt-oss is Groq's stated consolidation target (deprecation-resilient), supports strict JSON-schema structured outputs, and keeps primary + fallback in one family. Chosen over qwen3.x (coding-agent register, wrong for a companion) and over staying on any Llama (all deprecating).

**Revisit if**: per-message-scorer token cost on the reasoning model becomes a problem in production (a reasoning model as the every-turn scorer is wasteful — consider a lighter scorer path and/or prompt caching before go-live).

## 2026-06-28 — Rollup uses its own variant prompt, not the shared per-message prompt

**Status**: Accepted. Reverses an earlier "shared is fine" call.

**Decision**: The session rollup uses a dedicated "where did they land — weight the ending, not the peak" prompt (`scorer_rollup`), separate from the per-message scorer (`scorer_per_message`). Two scorer prompt files.

**Rationale**: A test run showed the shared prompt anchoring on peak stress (stuck on "tense") on a conversation that ended calm, while the variant correctly read the calmer landing ("at_ease"). The rollup is the considered whole-conversation read; it must weight the arc.

## 2026-06-28 — Crisis is a live-only signal (band-only persisted)

**Status**: Accepted.

**Decision**: The per-message `crisis` flag and Ren's silent `[CRISIS]` token drive the resource panel in the moment. The rollup persists **band only**. Crisis is never stored as a conversation property, never a dashboard band/badge, never a per-message log.

**Rationale**: Persisting crisis latched a false sticky "crisis" label on the whole session. Live-only also satisfies the Principle I invariant (crisis never persisted, never to the employer chain). Consistent with constitution Amendment 12.

## 2026-06-28 — Crisis panel trigger = scorer crisis OR Ren [CRISIS]

**Status**: Accepted. Extends the original brief (scorer-only gate).

**Decision**: The resource panel fires when the per-message scorer returns `crisis:true` OR Ren emits the `[CRISIS]` token. Either is sufficient.

**Rationale**: Live testing showed the scorer can miss where Ren catches. A false-positive panel is mildly intrusive; a missed crisis is dangerous — maximize recall on the safety path.

## 2026-06-28 — Relief-vs-loss crisis framing (precision fix)

**Status**: Accepted.

**Decision**: Crisis = a person framing their absence as relief / being better off gone. NOT crisis = absence framed as loss / being needed, or ordinary mortality / natural-death worry. Encoded in both the scorer and Ren prompts.

**Rationale**: Fixed a false-positive class (e.g. "if I died they'd be left with debt" — mortality anxiety, not intent) without losing genuine passive-ideation detection.

## 2026-06-28 — Known limitation: the two crisis nets are not independent

**Status**: Accepted (logged, not fixed).

**Decision**: The scorer `crisis` flag and Ren's `[CRISIS]` token both run on the same relief-vs-loss heuristic, so they catch the same cases and miss the same cases — correlated, not independent, redundancy.

**Rationale**: Acceptable for the demo. Revisit before real users — e.g. a differently-framed second check — so the second net fails independently of the first.

## 2026-06-28 — Per-message scorer returns band + crisis (not crisis-only)

**Status**: Accepted.

**Decision**: The every-turn scorer returns `{band, crisis}`. The band serves as the rollup's fallback if the rollup call fails or returns malformed JSON.

**Rationale**: Testing showed zero crisis-detection cost from also returning the band, so one call covers both jobs.

---

## 2026-06-30 — Constitution Amendment 13 — work-environment feedback is anonymized-aggregate-only for managers

**Status**: Accepted (constitutional amendment, MINOR bump `1.9.0 → 1.10.0`).

**Decision**: Feature 012's weekly work-environment check-in introduces a new
employee-submitted data class: overall sentiment, and when negative, a roadblock
selection plus a desired-support selection. This class is separate from stress
signals. It may reach the manager-facing layer only as an anonymized team-level
aggregate and must never appear as an individual employee's attributed answer.

**Rationale**: Principle I already governs direct-manager visibility for stress
trends, but the questionnaire creates a different privacy surface: explicit
employee-submitted workplace feedback. For the demo, the manager value is the
team aggregate, not attribution. Small-team anonymization hardening
(minimum-headcount suppression so a tally cannot identify one person) is
deferred to BACKLOG because it is larger than the demo slice, but it is mandatory
before any real employee data is collected.

**Cross-references**: `.specify/memory/constitution.md` Amendment 13;
`docs/CHANGELOG.md` 2026-06-30; `docs/BACKLOG.md` work-environment-feedback
anonymization-hardening item; `specs/012-questionnaire/` (spec to follow).

---

## 2026-06-30 — 012 implementation decisions (as-built, Phases 3–8)

**Status**: Accepted (implementation choices; no spec/FR change).

**Decision (D-1) — confirmatory trigger is browser-local, no cross-worker state.** The
sustained-tense clock, dwell floor, one-per-session guard, single-resolution guard, and the
next-session false-alarm suppression all live in the browser beside the monitoring loop, over
the existing coarse `WindowOutcome`/`Band` stream. The trigger module itself keeps **no**
`localStorage`/`sessionStorage`/global state (proved by a source scan); the one piece of
state that must survive the monitor→dashboard→monitor full-navigation — the one-shot false-alarm
suppression and the just-ended-session handoff — lives in a tiny `sessionStorage` HOST store
(per-tab, browser-local; not cross-worker or server). Rationale: the inference service keeps
per-session smoothing in memory (research R-3); server-side eligibility state would couple the
product prompt to the worker buffer.

**Decision (D-2) — confirmatory `user_id` from the JWT, not an extra round-trip.** The prompt
insert sets `user_id` to the access token's `sub` claim (decoded locally). RLS still verifies it
equals `(select auth.uid())` on the same token, so a wrong value is simply rejected — the decode
is an optimization, not a trust boundary.

**Decision (D-3) — optional `trigger_window_reading_id` deferred (research R-4).** The prompt
stores the REQUIRED `triggered_window_captured_at` time linkage and leaves the optional
`window_readings.id` null; the monitoring API does not return the reading id, and the time
linkage is sufficient for the prompt + the feature-017 forward join. Resolving the id is a
later optimization, not a correctness gap.

**Decision (D-4) — anti-collision centralized; instruments split by surface.** The confirmatory
prompt renders on the monitor page (resolved as `expired:session_end` before the end-navigation),
while session-end feedback + the weekly check-in render on the dashboard through
`QuestionnaireCoordinator`. A single pure `decideQuestionnaireSurface` encodes the priority
(confirmatory wins; session-end only once monitoring ended and no prompt is open; weekly is
separate from active monitoring and yields to session-end), so two surfaces can never co-occur.
The coordinator mounts ADDITIVELY on the dashboard — Today card / trend rendering is untouched
(T064: zero import edges in either direction).

**Decision (D-5) — result animations via component-local CSS gated by `useMediaQuery`.** The
four end-state animations (smiley/check draw, progress fill, muted skip) use component-local
`qri-*`/`qprogress-*` keyframes in `globals.css` (mirroring the `today-plot` precedent — no token
remap), and the components omit the animation class entirely under reduced motion so the element
renders in its final state; the global `prefers-reduced-motion` rule is the belt to that
suspenders. Framer Motion's `useReducedMotion` is deliberately NOT used (research R-6).

**Cross-references**: `specs/012-questionnaire-feedback/` (plan / research / contracts);
`docs/CHANGELOG.md` 2026-06-30; `docs/PROGRESS.md` 2026-06-30.

---

## 2026-07-02 — 012 post-implementation decisions (as-built, T067 follow-up + pre-merge polish)

**Status**: Accepted (implementation choices found live-running the e2e suite / pre-merge polish;
no spec/FR change). Continues the D-N numbering of the 2026-06-30 "012 implementation decisions"
entry above.

**Decision (D-6) — a questionnaire card's own end-state must dwell-paint before the coordinator
swaps surfaces.** `SessionEndFeedbackCard` and `WeeklyCheckInCard` each own a local terminal
"ending" render (the `QuestionnaireResultIcon` end-state) before calling `onResolved()` to hand
control back to `QuestionnaireCoordinator`. `onResolved()` must fire on a deferred timer
(`QUESTIONNAIRE_RESULT_DWELL_MS`, timer cleared on unmount) — never synchronously in the same
handler that sets the local "ending" state — so the end-state actually paints in its own React
commit before the coordinator swaps to the next surface. Calling it synchronously lets the
coordinator's surface swap and the card's own terminal render race in the same commit, which can
drop the end-state entirely (found live-running the e2e suite: a routed reason's action button
could vanish before its own 3rd click landed — a real SC-007 violation). The two routed reasons
(`suggestion_didnt_help` / `needed_quiet`) are exempt from the dwell — they resolve only from
`route()`, on the action-button click, once navigation is already underway.

**Decision (D-7) — session feedback is upserted, not inserted, keyed on
`monitoring_session_id`.** `saveSessionFeedback` writes via
`.upsert(payload, { onConflict: "monitoring_session_id" })` with every nullable column
(`sentiment` / `reason` / `free_text` / `action_target`) set explicitly rather than omitted, and
`route()` halts (logs, does not navigate/resolve) on a failed save rather than proceeding as if
it succeeded. A plain `.insert` cannot represent "the employee changed their answer before
acting": the DB enforces one row per session (`qsf_one_per_session`
`UNIQUE(monitoring_session_id)`), so a second insert after a reason switch was silently rejected,
leaving the first (now-stale) answer as the row of record. The upsert makes the last write the
row of record and the explicit nulls keep the CHECK constraints
(`qsf_free_text_scope`/`qsf_good_no_reason`/`qsf_skip_is_empty`) satisfied on every overwrite, not
just the initial insert.

**Cross-references**: `specs/012-questionnaire-feedback/smoke-tests.md` (T067 live-execution
writeup); `docs/CHANGELOG.md` 2026-07-02; `docs/PROGRESS.md` 2026-07-02.

---

## 2026-07-02 — 012 confirmatory-prompt budget semantics: explicit-answer-only consumes it; DB-constraint fix deliberately deferred (partial #127)

**Status**: Accepted (implementation choice + explicit scope split; no spec/FR change).
Continues the D-N numbering of the 012 entries above.

**Decision (D-8) — the one-per-session prompt budget is consumed ONLY by an explicit user
answer, never by an auto-resolution.** `useConfirmatoryTrigger`'s `PromptResolution` already
distinguished `type: "answered"` (confirmed / false_alarm / opened_chat) from `type:
"expired"` (`signal_drop` / `session_end`), but the reducer's single `resolved` flag
conflated "this specific shown prompt is done" with "the session's budget is spent" — every
resolution, including an auto-expiry, permanently blocked further prompting for the rest of
the session. Chose to split this into two fields (`resolved` — per-prompt guard;
`budgetConsumed` — session-scoped, set only by an answered resolution) rather than, say,
making the budget itself session-storage-backed or introducing a resolution counter: the
split keeps the trigger fully in-memory and pure-reducer-testable (Decision D-1 — no new
`sessionStorage`/global state), and it makes "what consumes the budget" a single, explicit,
one-line predicate (`resolution.type === "answered"`) rather than something implied by
control flow. `markResolvedRearm` resets the trigger to a fresh, un-shown state on any
non-consuming resolution — this is intentionally a full reset (not a targeted field clear),
so the hook's own per-prompt refs (`resolvedRef`, `promptIdRef`) and the pure state
(`tenseRunStartMs`, `shown`, `lastOutcomeTense`) can never disagree about whether a new
prompt cycle has started.

**Decision (D-9) — shipped the client-side re-arm as its own PR (#130) and deliberately did
NOT close BACKLOG #127 / GitHub #127.** The client fix alone is not sufficient: the DB
`qcp_one_per_session UNIQUE (monitoring_session_id)` constraint
(`supabase/migrations/20260630000000_questionnaire_feedback.sql`) still allows only one row
per session regardless of `lifecycle`, so `createConfirmatoryPrompt`'s plain `.insert` for a
SECOND prompt after an auto-expiry rejects with a unique violation and `handleShow` silently
no-ops — in production a user still cannot be re-prompted end-to-end. This was found during
the post-merge doc reconcile for PR #130, i.e. after merge; the unit test suite mocks
`createPrompt` and does not model the real constraint, so it could not have caught the gap.
Rather than quietly closing the issue on a partial fix, or scope-creeping the DB migration +
cooldown/cap policy into an unplanned change, the decision is to record the split explicitly:
PR #130 is the client-side half only, BACKLOG #127 is updated in place (not
marked resolved) with the remaining scope, and the GitHub issue stays open. The original
BACKLOG #127 entry already anticipated this needing "its own spec-fix pass, not a drop-in
change" for the partial-unique-index migration and the cooldown/cap design — that judgment
holds.

**Cross-references**: `docs/CHANGELOG.md` 2026-07-02 (PR #130 entry); `docs/PROGRESS.md`
2026-07-02 (PR #130 entry); `docs/BACKLOG.md` #127.

---

## 2026-07-02 — 012 confirmatory prompt: insert + partial index, not upsert-in-place (#127 done)

**Status**: Accepted (implementation choice; no spec/FR change). Continues the D-N numbering
of the 012 entries above.

**Decision (D-10) — the DB fix completing #127 (PR #132) keeps `questionnaire_confirmatory_prompts`
INSERT-per-episode with a partial unique index, not upsert-in-place.** The old
`qcp_one_per_session UNIQUE (monitoring_session_id)` constraint was replaced by
`qcp_one_answered_per_session ON questionnaire_confirmatory_prompts (monitoring_session_id)
WHERE lifecycle = 'answered'` — capping only *answered* rows at one per session, so a re-armed
episode's `visible`/`expired` rows can coexist. The alternative considered was the same pattern
D-7 uses for the sibling `questionnaire_session_feedback` table: upsert-in-place keyed on
`monitoring_session_id`. Rejected here, because the two tables model different things. D-7's
upsert is correct for `qsf` because a session has exactly ONE evolving product-feedback answer —
a reason switch overwrites the prior one, and there is no history worth keeping. A confirmatory
prompt is not an evolving answer; each sustained-tense episode is a DISTINCT event with its own
`shown_at` / `lifecycle` / `outcome`, so upserting would collapse a re-armed session down to its
most recent episode and destroy the record of the earlier one(s).

Keeping one row per episode (a) preserves genuine per-episode history for any future
noise/reliability metric (e.g. how often a prompt expires vs. gets answered per session, or how
many times a session re-arms) — extending D-3's "the time linkage is sufficient for the
feature-017 forward join": that join now has more than a single collapsed row to reason about
when a future consumer needs one; (b) breaks no existing reader (nothing today queries more than
the latest row); and (c) needed no upsert-payload discipline on the client —
`createConfirmatoryPrompt`'s plain `.insert` (`apps/web/lib/api/questionnaire-client.ts`) is
unchanged, unlike D-7's `qsf` fix, which had to set every nullable column explicitly to keep its
CHECK constraints satisfied on every overwrite.

**Cross-references**: `docs/CHANGELOG.md` 2026-07-02 (PR #132 entry); `docs/PROGRESS.md`
2026-07-02 (PR #132 entry); `docs/BACKLOG.md` #127 (resolved); D-3, D-7, D-9 above.

---

## 2026-07-03 — 012 confirmatory prompt: tense-senior budget + per-kind answered index (#134)

**Status**: Accepted (implementation choice; no spec/FR change). Continues the D-N numbering
of the 012 entries above. A deliberate sibling to D-10 — the second, milder trigger (#134, PR
#135) reuses the #127/#130/#132 machinery and only extends the budget and its DB mirror.

**Decision (D-11) — the second (mild) trigger uses a tense-senior TWO-budget model, mirrored at
the DB by a per-`(monitoring_session_id, kind)` answered index rather than one answered row per
session.** Two coupled decisions:

1. **Tense-senior budget (two flags, not one shared budget).** The acute trigger's one-time
   budget (`budgetConsumed`) is joined by a mild one (`mildBudgetConsumed`), and a new `shownKind`
   records which trigger produced the shown prompt. A **mild** answer spends ONLY the mild budget;
   a **tense** (explicit) answer spends BOTH. The alternative — a single shared one-per-session
   budget for both triggers — was rejected on two grounds, one level up from the #127 guarantee
   (D-8: only an explicit answer consumes the budget). First, a wasted mild prompt must never lock
   out a real tense one: with a shared budget, answering (or even showing) a low-stakes mild prompt
   would silently spend the session's only shot, so a genuine acute spike later in the same session
   would go un-surfaced — the opposite of what the acute trigger exists for. Keeping the tense
   budget independent guarantees the acute path always keeps its shot. Second, answering a genuine
   tense prompt SHOULD close the door on a lower-tier mild "nag" for the rest of that session —
   hence a tense answer is senior and spends both. Auto-resolutions (signal-drop / session-end)
   still spend neither and re-arm (D-8 unchanged). The two flags keep the trigger fully in-memory
   and pure-reducer-testable (D-1), and make "what each answer consumes" an explicit one-line
   predicate keyed on `shownKind` rather than something implied by control flow.

2. **Per-kind answered index (the DB mirror of the per-type budget).** The database now caps one
   `answered` row per `(monitoring_session_id, kind)` — `qcp_one_answered_per_session_per_kind ON
   questionnaire_confirmatory_prompts (monitoring_session_id, kind) WHERE lifecycle = 'answered'`
   (`supabase/migrations/20260703000000_qcp_kind_column.sql`) — extending D-10's insert +
   partial-index choice by adding a `kind` dimension, rather than D-10's single answered-per-session
   cap. This was proven necessary, not cosmetic: D-10's `qcp_one_answered_per_session
   (monitoring_session_id) WHERE lifecycle = 'answered'` caps answered rows at one per session, full
   stop, so a mild-answered + tense-answered pair collides — verified live against the local
   Postgres, where the second `answered` UPDATE raised `duplicate key value violates unique
   constraint "qcp_one_answered_per_session"`. A new `kind` ('mild' | 'tense') column (existing rows
   backfilled to 'tense') carries the discriminator; `trigger_band` was deliberately left unchanged
   (still the constrained 'tense'-only column — widening it would touch the base migration's CHECK
   and the T003 privacy assertion, out of scope here). The per-kind index is the exact DB-level
   analogue of the two-flag budget: one answered mild + one answered tense per session, neither kind
   answerable twice.

**Cross-references**: `docs/CHANGELOG.md` 2026-07-03 (PR #135 entry); `docs/PROGRESS.md`
2026-07-03 (PR #135 entry); `docs/BACKLOG.md` #134 (resolved); D-3, D-8, D-10 above.

---

## 2026-07-12 — Azure Container Apps for backend and ML serving

**Status**: Accepted (locked-stack substitution; Constitution Amendment 14).

**Decision**: Host the FastAPI backend and ML inference service on the existing Azure
Container App under Azure for Students, replacing the planned DigitalOcean Droplet as the
production target. Provision production-equivalent compute at 4 vCPU and 8 GiB, matching the
capacity of the current Azure Container Instance, and use scale-to-zero to control student-credit
consumption when the service is idle.

Azure Container Apps is the selected target because Azure for Students credits and the available
free-tier allowances reduce deployment cost while preserving the required compute profile. Its
managed HTTPS ingress and custom-domain support provide the production path for
`api.serenify.tech` without operating a separate TLS reverse proxy. Production secret values
remain exclusively in the Azure, Vercel, and Supabase secret or environment panels; no value is
recorded here or committed to the repository.

**Validation and rollback**: The existing Azure Container Instance remains running as the rollback
target until the Container App revision, health endpoint, managed HTTPS, custom domain, and
production behavior are validated. The hosting cutover is not complete merely because this stack
choice is ratified; failed validation returns traffic to the old ACI while the Container App is
corrected.

**Cross-references**: `.specify/memory/constitution.md` Amendment 14; Constitution Principle IX
and Technology Stack (Locked).

> **Superseded in part (2026-07-22)**: the "Validation and rollback" paragraph above is factually
> wrong as written — the ACI rollback target did not survive this PR. See the 2026-07-22 entry
> "No ACI rollback target exists — Container Apps is the only production backend" below.

---

## 2026-07-22 — No ACI rollback target exists — Container Apps is the only production backend

**Status**: Accepted (correction; supersedes the "Validation and rollback" paragraph of the
2026-07-12 entry "Azure Container Apps for backend and ML serving").

**Correction**: The 2026-07-12 entry states *"The existing Azure Container Instance remains running
as the rollback target."* **This is not true and was never true after that PR merged.** The
2026-07-12 cutover *design* doc records the opposite in the same squashed PR
(`docs/superpowers/specs/2026-07-12-production-cutover-design.md`: *"Mohamed deleted the prior Azure
resource groups to stop credit consumption… There is no legacy Azure rollback target."*). The
DECISIONS entry was drafted earlier in the PR and never reconciled against the design doc, so the
two shipped contradicting each other.

**Live verification (2026-07-22)**: `az group list` against the Azure for Students subscription
returns exactly one resource group:

| Name | Location | Status |
|---|---|---|
| `serenify-prod-rg` | francecentral | Succeeded |

`az resource list -g serenify-prod-rg` returns exactly three resources, all Container Apps:

| Name | Type |
|---|---|
| `serenify-prod-env` | `Microsoft.App/managedEnvironments` |
| `serenify-api` | `Microsoft.App/containerApps` |
| `serenify-prod-env/mc-serenify-prod--api-serenify-tec-8034` | `Microsoft.App/managedEnvironments/managedCertificates` |

There is **no `Microsoft.ContainerInstance/containerGroups` resource in the subscription**, and no
second resource group. The ACI is gone.

**Consequence — state this plainly: there is no rollback target.** If the `serenify-api` Container
App revision breaks, traffic cannot be returned to a previously-validated backend; the only
recovery paths are (a) `az containerapp revision` rollback to an earlier *revision of the same
Container App*, which exists only while an older healthy revision is retained, or (b) re-provision
from `ghcr.io/mohamedasem318/serenify-api:production` — the image tag is the real durable artifact.
Recovery is a re-provision, not a traffic flip, and it is not instantaneous.

**Why this was accepted rather than fixed by re-creating an ACI**: the ACI was deleted deliberately
to stop student-credit consumption, and the Container App runs `minReplicas=0` for the same reason.
Keeping a warm parallel ACI would reintroduce exactly the cost the scale-to-zero design exists to
avoid. The mitigation is the GHCR image tag plus Container Apps revision retention, not a second
always-on host.

**Cross-references**: the 2026-07-12 entry above (corrected here);
`docs/superpowers/specs/2026-07-12-production-cutover-design.md`;
`.specify/memory/constitution.md` Amendment 14; `apps/api/Dockerfile` (target-host comment corrected
in the same change).

---

## 2026-07-22 — Resend is live as Supabase's custom SMTP provider (zero repo footprint by design)

**Status**: Accepted (records a delivered integration; Constitution Amendment 15, PATCH).

**Decision / state of the world**: Transactional email for Serenify is delivered by **Resend**,
wired as the **custom SMTP provider beneath Supabase Auth**, configured through the Supabase
dashboard. Production email is sending. The two Graphite-branded templates shipped in PR #142
(`supabase/templates/confirmation.html`, `recovery.html`) are rendered by Supabase Auth and handed
to Resend for delivery.

**Why this is recorded explicitly**: a repo-scoped audit will find **no trace of Resend** — no
`RESEND_API_KEY`, no SDK dependency, no calling code, no SPF/DKIM/DMARC files. That absence is the
*intended architecture*, not an incomplete integration. Because Resend sits beneath Supabase Auth
as an SMTP relay rather than being called by application code, the entire integration lives in the
Supabase dashboard plus DNS records at the registrar. A 2026-07-21 recon read the repo-level
absence as "Resend is NOT integrated"; that inference was wrong, and this entry exists so the same
wrong conclusion is not drawn again from the same correct observation.

**Operational consequences**:
- Mail-delivery incidents are diagnosed in the Supabase Auth logs and the Resend dashboard, **not**
  in this repository. Nothing in `apps/` or `packages/` participates in delivery.
- The SMTP password is a Supabase dashboard secret. It is never committed and never appears in CI
  (Principle IX).
- Changing sender identity, domain, or rate limits is a dashboard + DNS operation and will produce
  little or no repo diff. Do not expect a PR to accompany such a change.
- The earlier claim that live new-user signup was gated on SMTP landing (`docs/BACKLOG.md` #139) is
  obsolete; that gate is cleared.

**Cross-references**: `.specify/memory/constitution.md` Amendment 15 and the Technology Stack
(Locked) transactional-email row; `docs/BACKLOG.md` #139 (Resend note); `supabase/config.toml`
template wiring; `supabase/templates/{confirmation,recovery}.html`.

---

## 2026-07-24 — Constitution Amendment 16: insert `013-public-surface-and-legal`, fix the privacy-controls dependency inversion, add the Privacy-Policy/ToS-per-PR rule

**Status**: Accepted (Constitution Amendment 16, MINOR, `1.11.1 → 1.12.0`). Approved by Mohamed.

**Decision**: Three changes to Principle VIII, landed as one amendment directly on `main` ahead of cutting the 013 branch:

1. **New slot `013-public-surface-and-legal`** — the public landing page, `/terms`, `/privacy`, the site footer, and the signup consent gate.
2. **Fixed a dependency inversion** — `privacy-controls-and-transparency` (employees choosing what their team lead can see) moved to sit **after** `team-lead-dashboard`, because it cannot meaningfully ship before the dashboard it constrains exists. Resulting 013–022 ordering: `013-public-surface-and-legal`, `014-recommendations`, `015-personalization-onboarding`, `016-preferences-hub`, `017-team-lead-dashboard`, `018-privacy-controls-and-transparency`, `019-admin-dashboard`, `020-audio-modality`, `021-physio-modality`, `022-fusion`. By-slug renumber: recommendations 013→014, personalization-onboarding 014→015, preferences-hub 016 (unchanged), team-lead-dashboard 017 (unchanged), privacy-controls-and-transparency 015→018, admin-dashboard 018→019, audio-modality 019→020, physio-modality 020→021, fusion 021→022. Two live constitution body cross-references moved with the tail: Principle IV audio `019 → 020`, Principle III fusion `021 → 022`.
3. **New standing rule** in Principle VIII (grouped with the DECISIONS/PROGRESS/CHANGELOG/BACKLOG logging bullets), mirrored verbatim into `CLAUDE.md`: *whenever a feature changes what data is collected, where it goes, who can see it, or how long it is retained, the Privacy Policy and Terms of Service MUST be reviewed and updated in the same PR.*

**Accepted consequence, stated plainly**: with change (2), `017-team-lead-dashboard` ships with **hardcoded default visibility scopes** and `018-privacy-controls-and-transparency` **retrofits** employee-facing controls (the 3-position privacy slider + the "what your manager sees right now" transparency view) onto that already-shipped surface. The alternative was leaving the inversion in place; putting the dependency in the right order was judged the better cost. Tracked as **GitHub issue #152** and a mirrored `docs/BACKLOG.md` entry ("From constitution Amendment 16"), not left only inside the constitution rationale — with the instruction that `017` must implement its defaults as explicit, centralized values so `018` can intercept them without a rewrite.

**Why MINOR (not PATCH)**: a new planned slot, a reorder of the provisional ordering, and new guidance added to an existing principle each materially extend the guidance (Governance's MINOR definition; consistent with Amendments 8/9/10/13). No principle is added, removed, or restructured; no numbered section changes. Hand-edited (not via `/speckit-constitution`) to preserve the curated Sync Impact Report history, per the Amendment 10 precedent.

**Template audit — none.** `.specify/templates/{plan,spec,tasks,checklist,constitution}-template.md` were grepped for the affected slugs, the feature-number literals `013`–`022`, and `Privacy Policy`/`Terms of Service`/`retention`. The single hit is a generic `[NEEDS CLARIFICATION: retention period not specified]` example FR in `spec-template.md` — an illustrative placeholder in the "marking unclear requirements" block, not a reference to the new rule or any feature. No template edit; recorded so the next auditor does not re-flag the coincidental `retention` match.

**Cross-reference sweep — what was reconciled and what was deliberately left**:
- **`docs/BACKLOG.md` reconciled in place** (it is the forward-routing source of truth): number-bearing references corrected keeping each durable slug — admin-dashboard `018 → 019` and privacy-controls-and-transparency `015 → 018`. `feature 017` references (team-lead-dashboard, unchanged) were verified correct and left.
- **`#86` (90-day `window_readings` purge job) clarified as unslotted** — its "Address by" now says explicitly it is **not** owned by `013-public-surface-and-legal`; Amendment 16's Privacy-Policy/retention rule requires the *policy* to describe retention, not this *purge job* to be built. Not closed.
- **`docs/BACKLOG.md:599`** (`features 008/010/014 will mount it`) — left as pre-existing ambiguous drift (a plural-list `014` whose referent predates this amendment); noted here so it isn't re-discovered as an oversight.
- **Shipped `specs/*/` NOT retro-edited**, consistent with Amendments 8 and 11 — those spec docs are point-in-time records and the constitution's ordering list is the source of truth for a feature's current number. Identified-and-deliberately-left: `specs/011-llm-client-chatbot/spec.md:90,265` and `specs/012-questionnaire-feedback/spec.md:228,229` (recommendations 013→014, personalization 014→015). `specs/004-onboarding-video-anchor/spec.md:420,565,636,637,638` (audio=013/physio=014/fusion=015) are **pre-existing drift** — already stale under the pre-amendment constitution, unrelated to this change — and also left.

**Open reconciliation flagged for the 013 spec — BACKLOG `#75` ↔ `013` ownership — RESOLVED 2026-07-24**: the ToS/Privacy/consent-gate item `#75` was mechanically renumbered `015 → 018` (keeping its `privacy-controls-and-transparency` slug per the sweep instruction), but its actual subject — the ToS/Privacy documents and the signup consent gate — is **exactly the scope of the new `013-public-surface-and-legal`**. #75's "draft alongside privacy-controls" rationale (privacy-controls defines the data-handling substance the documents describe) is real, but ownership of the *documents themselves* now overlaps 013. Resolved by reconciling #75's "Address by" in `docs/BACKLOG.md`: **`013-public-surface-and-legal` owns the ToS/Privacy documents and the signup consent gate**; `018-privacy-controls-and-transparency` continues to supply the data-handling substance those documents describe, per the standing Privacy-Policy/ToS-per-PR rule. #75 stays **OPEN** (013 has not shipped) — only the owning-feature routing changed. GitHub issue #75 updated to match.

**Cross-references**: `.specify/memory/constitution.md` Amendment 16 (Sync Impact Report + Principle VIII ordering + Principle III/IV body cross-refs + version line `1.12.0`); `docs/CHANGELOG.md` 2026-07-24; `CLAUDE.md` "Privacy Policy & Terms of Service" section (mirrored rule); `docs/BACKLOG.md` "From constitution Amendment 16" section + `#152` + `#86` (unslotted) + `#75` (013 reconciliation flag); GitHub issue #152.

---

## 2026-07-24 — Constitution Amendment 17: canonize the two-colour wordmark (Principle V) + manager-visibility copy discipline (Principle I)

**Status**: Accepted (Constitution Amendment 17, MINOR, `1.12.0 → 1.13.0`). Approved by Mohamed.

**Decision**: Two changes on two existing principles, landed as **one** amendment ahead of `/speckit-plan` for `013-public-surface-and-legal`:

1. **Principle V gains a `Wordmark` block.** `serenify` is canonized as a **two-colour** wordmark — `seren` in the `ink` token, `ify` in the `meadow-text` token — always lowercase, never carrying a dot or other terminal punctuation, and **defined once as a single shared component** reused at every site that renders it inside the web app's React tree. The lowercase sentence **moves** out of the Typography block into Wordmark rather than being duplicated, and Wordmark deliberately does **not** restate that the wordmark is set in Outfit — Typography, two sentences above, already assigns it. Two places stating one rule is two places to drift.
2. **Principle I gains a public-communication rule.** Any public-facing or user-facing text describing manager visibility MUST describe the end-state honestly, MUST mark not-yet-live controls as not-yet-live, and MUST NOT flatten the distinction between what never reaches a manager (chat content, crisis disclosures) and what is manager-visible by default (stress-trend summaries, at the `summary only` granularity).

**Why one amendment and not two**: both answer blocking open questions in the *same* feature spec (`OQ-3` wordmark, `OQ-1` manager visibility), both must clear before `/speckit-plan`, and both land in one PR. **Amendment 12 is the direct precedent** — it paired an unrelated Principle IV / locked-stack provider swap with new Principle I disclosure invariants on a single feature trigger (011). Amendment atomicity in this repository tracks the **landing event**, not the topic. The counter-argument — visual identity and privacy copy are substantively unrelated — is real and was considered; splitting would cost two Sync Impact Report blocks, two version bumps, two DECISIONS entries and two PRs, and would leave a future reader asking "why did 013 need constitutional work?" with two half-answers. Recorded so it is not re-litigated.

**Why Principle I's substance is NOT changed**: per-individual manager visibility and the employee-controlled granularity slider remain the intended end-state; no existing invariant is edited. This resolves the 013 spec's blocking `OQ-1` by **choosing its Option B and constraining how B is written**, not by amending Principle I — which was Option A, and was not taken.

**The `summary only` default was verified, not introduced.** The new rule's clause "manager-visible by default, at the `summary only` granularity" quotes an existing invariant — Principle I, bullet 2: *"Employees control granularity via a three-position privacy slider: `full detail` / `summary only` (DEFAULT) / `off during specified hours`."* That text has carried `(DEFAULT)` since the 1.0.0 ratification and is untouched by every amendment since. A copy-discipline rule must not be the place a new substantive default first appears; it is not.

**`--color-meadow-text` registered in Principle V (a gap closed, not a token added).** The wordmark rule depends on `meadow-text`, and Principle V's palette is declared *"locked, no additions without amendment"* — yet the token shipped in feature 007 (`apps/web/app/globals.css:40,157`; `specs/007-visual-redesign/spec.md:350` FR-009; `docs/DECISIONS.md` 2026-06-18) and was **never named in the constitution**. Principle V listed only bg / surface / ink / muted / meadow / foggy / amber / crimson / border, plus the four amber sub-tokens that Amendment 5 explicitly registered. Registering it here (light `#346A56` / dark `#63B292`) makes the amendment's "no new token" claim literally true rather than approximately true. **No CSS change and no value change.**

**Two sibling 007 tokens deliberately left**: `--color-on-accent` (`globals.css:39`) and `--color-scrim` (`globals.css:41`) are in the identical unregistered position — Amendment 4 described the filled-accent foreground rule in prose without naming `on-accent`, and never mentioned `scrim`. They are **out of scope** here (not load-bearing for the wordmark rule) and are logged to `docs/BACKLOG.md` + **GitHub issue #155**, to ride along with whichever amendment next touches Principle V. Recorded so this is not rediscovered as a surprise.

**The out-of-React carve-out is load-bearing, not a hedge.** "Defined once and reused everywhere it renders" would be violated on day one by `apps/web/app/opengraph-image.tsx:52` (Satori cannot load the app's self-hosted fonts — an accepted deviation already recorded for PR #144) and by `supabase/templates/{confirmation,recovery}.html:38` (inline-styled HTML outside the React tree). A rule the codebase already breaks is worse than no rule, so both are named as a hand-sync obligation instead.

**Verified wordmark render inventory** (the two-colour rule engages all of these; the `seren`/`ify` split is verified from the signed-off mock, `docs/mockups/serenify-landing-mock.html:92,422`):

| Site | Today | In the shared component? |
|---|---|---|
| `apps/web/components/header/header.tsx:26` | single-colour `text-ink` | yes |
| `apps/web/app/(auth)/layout.tsx:41` | single-colour `text-ink` | yes |
| `apps/web/app/(onboarding)/layout.tsx:39` | single-colour `text-ink` | yes |
| `apps/web/app/opengraph-image.tsx:52` | Arial, inline | **no — hand-sync** |
| `supabase/templates/{confirmation,recovery}.html:38` | hardcoded `#1C2023`, inline | **no — hand-sync** |
| public navbar + public footer | do not exist yet | yes (built by 013) |

**Note for `/speckit-plan`**: the 013 spec's FR-029 enumerates only "public navbar, public footer, authed app header, auth-pages layout" — it **under-enumerates**, missing `(onboarding)/layout.tsx` and `opengraph-image.tsx`. Reconcile at plan time; not edited here.

**Why MINOR (not PATCH)**: both changes add new enforceable MUSTs to existing principles, which is Governance's "materially expanded guidance" (consistent with Amendments 5/12/13). Change 1 alone could be argued PATCH, since Principle V already said the wordmark is lowercase — it is not, because two-colour, define-once-reuse, and no-terminal-punctuation are each a new constraint that can be violated, not a clarification of an existing one. Moot regardless: Change 2 is unambiguously MINOR and the higher bump governs. No principle is added, removed, or restructured; no numbered section changes. Moving the lowercase sentence between two sub-blocks of Principle V is not a structural change — MAJOR is scoped to removing a principle or a numbered section. Hand-edited (not via `/speckit-constitution`) to preserve the curated Sync Impact Report history, per the Amendment 10 precedent.

**Template audit — none.** `.specify/templates/{plan,spec,tasks,checklist,constitution}-template.md` were grepped for `wordmark`, `two-colour`/`two-color`, `lowercase`, `Principle V`, `Principle I`, `manager visibility`, `Graphite`, `meadow`, `meadow-text`, `ink`, `--color-ink`, and `serenify`. Zero substantive matches. The only hits are coincidental substrings of `ink` inside the words "link"/"Link" — `checklist-template.md:5,39`, `plan-template.md:3`, `spec-template.md:19`, all ordinary markdown link boilerplate. No template edit; recorded so the next auditor does not re-flag the coincidental `ink` matches (same practice as Amendment 16's `retention` note).

**Cross-reference sweep — reported, deliberately NOT bulk-edited in this amendment.**

*Needs a not-yet-live qualifier (public-facing, present-tense product fact):*

- `README.md:18` — *"**Employee-controlled granularity** — a three-position privacy slider: full detail, summary only, or off during set hours."* The clearest hit: it sits under "privacy **is** the architecture, not a setting:" as a present-tense architectural bullet, and the slider does not exist (feature 018). `README.md:49` mentions "privacy-transparency settings — placeholder panels" but is 31 lines away and never names the slider.
- `README.md:11` — *"Managers see graded trends for their reports — never raw video, never chat content."* Present tense; no manager surface exists, as `README.md:48` itself says.
- `README.md:15` — *"managers get graded bands, aggregates, and trends, computed downstream of the model"*. Same framing, same gap.
- `README.md:16` — *"**Bounded visibility** — a direct manager sees only their own reports; skip-level and above see anonymized org-wide aggregates."* Accurate to Principle I and notably **not** the flattened claim — it correctly distinguishes direct from skip-level. Present tense, unmarked.

All four are the honest end-state, correctly un-flattened; the only defect is the missing not-yet-live marker, so the fix is one added sentence rather than four rewrites. `apps/web/components/account/privacy-placeholder.tsx:24-26` is the model to copy.

*Contains the forbidden flattening — but cannot be edited by a PR:* `docs/mockups/serenify-landing-mock.html:550` (*"A team lead sees anonymised group trends and nothing else. Not your individual readings…"*), `:772` (a narration line reading *"Nothing here ever reaches a manager."*), and `:442` (*"checks in with the person — never a manager"*). This file is **gitignored and untracked** (`.gitignore:100`, `serenify-*.html`; only `docs/mockups/README.md` is tracked, and it documents the policy at lines 7–15). It therefore needs no edit and cannot receive one — the new rule binds at **transcription time**, when 013's landing copy is written from it. This is the single most actionable output of the sweep and must be carried into the 013 plan.

*Sweep methodology caveat, recorded because it is how a line like this survives review:* two passes missed the mock for two different reasons — ripgrep honours `.gitignore` and skipped it silently (an unfiltered `rg` returns clean), and a shell `grep` filtered to `--include=*.md,tsx,ts,sql,py` never scanned `.html`. **Any future copy sweep must pass `--no-ignore` or scope explicitly to `*.html`.**

*Verified already compliant — MUST NOT be "corrected":* `apps/web/components/account/privacy-placeholder.tsx:24-26` (future tense plus an explicit "nothing to configure yet"); `apps/web/components/monitor/op-surfaces.tsx:68` (*"Your manager never sees your video"* — scoped to video, true and permanent); `apps/web/components/questionnaire/weekly-check-in-card.tsx:291` (*"Only an anonymized team-level summary reaches your manager — never your individual answer"* — scoped to the check-in answer, which genuinely is aggregate-only per Principle I bullet 3, and pinned by two tests); `README.md:17` (chat and crisis never reach an employer — true, permanent, and precisely the distinction the new rule protects).

*Out of scope — not public- or user-facing:* `docs/security/01-rls-and-security-definer.md:238` (internal audit doc); `specs/008-stress-inference-service/spec.md:170`, `specs/001-auth-and-roles/data-model.md:360`, `specs/012-questionnaire-feedback/spec.md:32,80,96,205,212,287`, `specs/012-questionnaire-feedback/checklists/privacy-data-flow.md:31` (point-in-time spec records — **not** retro-edited, per the Amendment 16 precedent); `docs/BACKLOG.md:1672` and `docs/DECISIONS.md:4757` (correctly scoped to the questionnaire data class); `supabase/migrations/20260517000050_reports_under.sql:10` (accurate SQL comment); `graphify-out/**` (gitignored, regenerable build output).

**Not mirrored into `CLAUDE.md`** — unlike Amendment 16's Privacy-Policy/ToS rule, which is a per-PR procedural gate. Both of these are design/copy rules, and the stated rationale for putting the wordmark in the constitution at all is that the constitution is read on every SpecKit feature. Keeping `CLAUDE.md` lean was the explicit call.

**Cross-references**: `.specify/memory/constitution.md` Amendment 17 (Sync Impact Report + Principle I public-communication bullet + Principle V Typography/Wordmark blocks + version line `1.13.0`); `docs/CHANGELOG.md` 2026-07-24 (Amendment 17); `docs/BACKLOG.md` "From constitution Amendment 17" section; GitHub issue #155; `specs/013-public-surface-and-legal/spec.md` OQ-1 (resolved: Option B) and OQ-3 (resolved: an amendment is required); `docs/DECISIONS.md` 2026-06-18 (`--color-meadow-text` origin) and 2026-06-17 (filled-accent CTA foreground).

---

## 2026-07-25 — GitHub resolves a `pull_request` workflow from the PR's **merge ref**, not from the base branch or `main`

**Status**: Accepted (measured, not inferred).

**Context**: `.github/workflows/ci.yml` triggered only on `main`, so all three
checks — `python (ruff · pytest)`, `web (lint · typecheck · vitest)` and
`speckit-skills guard` — were silent for every PR into a feature branch; only
Vercel ran. Confirmed on PR #160 (base `013-public-surface-and-legal`): two
Vercel contexts, zero Actions checks — against PR #159 (base `main`) running all
three. Feature 013 lands as ~9 stacked PRs including a migration and an
application-wide entry gate, so this was a precondition
(`specs/013-public-surface-and-legal/plan.md` §15, R1). Fixed in PR #164 by adding
`[0-9][0-9][0-9]-*` — this repo's feature-branch convention, `001-auth-and-roles`
through `013-public-surface-and-legal` — to both `pull_request` and `push`.

**Finding**: For a `pull_request` event, GitHub reads the workflow file from the
PR's **merge ref** (head merged into base). It does **not** read it from the base
branch alone, and it does **not** read it from the default branch. Landing a
trigger change on `main` therefore does not, by itself, make checks appear on PRs
into a feature branch that was cut before that change.

**Evidence** — three throwaway PRs, all with a `013-*` base, opened **before** #164
merged so `main` could not be a confounder. All were closed and their branches
deleted:

| Probe | Base has the fix | Head has the fix | Guard checks ran? | Evidence |
|---|---|---|---|---|
| A (#161) | yes | yes | **yes**, all three green | run `30139855625` (`pull_request`) |
| B (#162) | no | no | **no** — Vercel only | no CI run was created for that branch at all |
| C (#163) | no | **yes** | **yes**, all three green | run `30139858220` (`pull_request`) |

Probe C is the discriminator: the base branch carried no trigger change and the
checks still ran, because the head carried it into the merge ref. Probe B is the
control — not a cancelled or failed run, but no run created at all.

**Consequence**: a feature branch cut **before** the trigger fix must have the
commit merged into it before PRs into it run checks. `013-public-surface-and-legal`
was 1 commit ahead of `main` and 0 behind, so this was **not** a fast-forward — it
took merge commit `528f70e`. Branches cut from `main` **after** `cbb7f81` (the #164
squash merge) inherit the trigger automatically and need nothing.

Verified afterwards on PR #165 (head `chore/ci-verify-013-probe`, cut from
`013-public-surface-and-legal` exactly as a phase branch will be, and deliberately
named so it does **not** match `[0-9][0-9][0-9]-*`): all three checks ran from a
single `pull_request` run `30140145032`, each listed once.

**Side-effect, accepted**: a head branch whose own name matches `[0-9][0-9][0-9]-*`
now also gets a `push` run, so its PR check list shows each check **twice** — once
from `push`, once from `pull_request`. Both must pass; it is cosmetic noise, not a
correctness problem. The `push` half is kept because an integration branch
accumulating a 9-PR stack deserves the same green baseline `main` has: the base
moves under earlier PRs, so the post-merge state is worth re-checking. Dropping
`[0-9][0-9][0-9]-*` from the `push` trigger removes the duplication at that cost.

**Cross-references**: PR #164 (the fix, squash-merged as `cbb7f81`); PRs #161, #162,
#163 (probes, closed, branches deleted); PR #165 (post-merge verification, closed);
`.github/workflows/ci.yml` header comment (the finding is recorded there so it need
not be rediscovered); `specs/013-public-surface-and-legal/plan.md` §15 R1.

---

## 2026-07-27 — Next 16 does **not** error when `app/page.tsx` and `app/(public)/page.tsx` both exist — it silently prefers the ungrouped file

**Context**: P6 (T086) moves the root route into the `(public)` route group. `tasks.md`
T086 and `research.md` §11 both justify deleting `app/page.tsx` in the same commit by
asserting that **"both files existing simultaneously is a build-breaking route conflict"**.
That justification is wrong on Next **16.2.11**, and the truth is a stronger argument for
the same action.

**What the docs on disk actually say** (`node_modules/next/dist/docs/`, read at 16.2.11):

- `01-app/01-getting-started/02-project-structure.md:77` — `app/page.tsx` → `/`.
- same file `:97` — `app/(marketing)/page.tsx` → `/`, "Group omitted from URL".
- `01-app/03-api-reference/03-file-conventions/route-groups.md:12` — a parenthesised
  folder "should **not be included** in the route's URL path".
- same file `:31` — "**Conflicting paths**: Routes **in different groups** should not
  resolve to the same URL path … and cause an error."

The conflicting-paths caveat is scoped to **group vs group**. `app/page.tsx` is in no
group, so the documented error case does not cover this pair — and empirically it does
not error.

**How it was proved.** `app/page.tsx` was temporarily recreated alongside
`app/(public)/page.tsx` and the app was built and served:

1. `npm run -w apps/web build` — **exit 0**, no error, no warning, no conflict message.
2. Next's own route table listed **`ƒ /` exactly once**.
3. `next start` served `/` from **`app/page.tsx`** — the probe text rendered and the
   public shell's `<nav>` did **not**.

The probe file was then deleted; the tree matched HEAD.

**Why this matters more than the correction.** The real failure mode is *silent
precedence*, which is worse than a build error. Had the takeover been done as a **copy**
rather than a **move**, `tsc` would be green, `next build` would be green, every unit test
would be green — and the landing page would simply never render, outside the public shell,
with no navbar and no footer. Nothing in the suite would have noticed.

**Decision**: the move stands, for this reason rather than the one given. The check is
made permanent as a unit test —
`apps/web/tests/unit/app/one-page-owns-root.test.ts` — asserting that exactly one route
file resolves to `/` and that it is `(public)/page.tsx`. It is deliberately narrow: one
assertion about one URL, **not** a general route-table test, which would re-derive Next's
routing semantics somewhere nobody would maintain.

**Not done**: `research.md` §11 and `plan.md` are **not** edited. Planning artifacts are
not edited mid-build; this entry is the record.

---

## 2026-07-27 — The landing narration row is two lines below 768 px: the "one line at 320 px" rule was written without measuring and is unachievable

**Context**: `plan.md` §10.3 constraint 2, R12, and T107 all require the hero card's
narration to render on **exactly one line at 320 px for every beat**, and all three state
that a failure is "a copy-length problem, not a CSS problem" whose fix is **re-approval of
the string, not a taller row**.

**Measured, before any of the card was built** — real Chromium, 320 px viewport, the app's
own `next/font` Inter, against the approved §10.3 Position 3 string ("What you said stays
yours. The video was read and forgotten.", 60 chars):

| Font size | Width required |
|---|---|
| 17 px (`--text-base`) | 496.7 px |
| 14 px | 409.0 px |
| **13 px (`--text-xs`, the smallest token that exists)** | **379.8 px** |

A card at a 320 px viewport has roughly **260 px** of inner width (16 px page padding +
14 px card padding per side). The string needs **379.8 px at the smallest legible token**
and would fit only at **~8.8 px**. The conclusion survives every layout choice: spanning
the full 320 px viewport with **zero** padding it still needs ~11 px. It is not only 320 px
either — at 13 px the string needs a viewport of roughly **440 px**, so the rule as written
fails at **320, 375 and 414** and passes only at 768.

A second string was over too: `backToAtEase` ("Back to at ease — because they were asked,
not told.", transcribed from mock `:771`) at 329.0 px. The other ten fit at 13 px.

**Decision (Mohamed, 2026-07-27)**: **hold the copy, move the layout rule.** The approved
§10.3 strings stay byte-exact; `backToAtEase` is left as transcribed. The narration row is
**fixed at two lines below 768 px and one line at and above it** — fixed at every width,
never content-dependent. Single-line strings are vertically centred so the shorter beats do
not hang off the top.

**Why this does not violate "not a taller row".** The harm those three passages name is
*dynamic* height — "breaking the fixed-height narration row", "force the fixed height up",
"clip". FR-009's guarantee is that **content changing cannot move anything below it**. A
row fixed at two lines never changes height with content, so that guarantee holds
unchanged; only the line budget moved.

**T107's assertion** changes accordingly: below 768 px it asserts the row height is
**constant across all 17 beats** and that no string exceeds two lines; at 768 px it asserts
exactly one line. Zero outer-dimension drift remains the bar at all four widths.
**Re-measured after implementation**: all 12 narration strings fit within two lines at 320,
375 and 414 px and one line at 768 px — nothing needs three. All five layout tests pass.

**Not done**: `plan.md` is **not** edited and T107's text is unchanged beyond the
assertion itself. The amendment is noted in the P6 PR body.

---

## 2026-07-28 — The public navbar becomes sticky and gains Sign in / Sign up; the story card's narration returns to `--text-xs` at every width

Three divergences from the spec, recorded here rather than by editing `plan.md`,
`spec.md` or `research.md` mid-build. All three came out of a fidelity pass against the
signed-off mock (`docs/mockups/serenify-landing-mock.html`), which is the authority for
how the page **looks** — never for what it **says**.

### 1. The navbar is sticky and translucent (diverges from FR-018)

**Context**: FR-018 requires the public navbar to be visually identical to the app header,
and P3 read that as covering behaviour too — so it was neither sticky nor translucent,
because `components/header/header.tsx` is neither.

**Decision**: on the public shell it is now `sticky top-0 z-50` over
`color-mix(in srgb, var(--color-bg) 88%, transparent)` with a 12 px backdrop blur, which is
what the mock's `nav` rule does. The reasoning that produced the original choice inverts on
a landing page: `/` is a long scrolling narrative whose entire job is to deliver a stranger
to the two buttons in the bar, and a bar that scrolls away takes them with it. The app
header sits above short, task-shaped screens where sticky buys nothing. Everything else
FR-018 names — `h-16`, `border-b border-border`, the wordmark size, the three-slot rhythm,
the trailing theme toggle — is unchanged.

`html { scroll-padding-top: 4rem }` is added in `globals.css` as a direct consequence: the
hero's second CTA targets `#how-it-works`, and without it the browser parks that heading
underneath the now-fixed bar.

### 2. The navbar carries Sign in and Sign up (a functional gap, not a style choice)

**Context**: the trailing slot held the theme toggle alone. A returning visitor landing on
`/` therefore had **no way into the product from the navigation at all** — the hero's
"Get started" CTA was the only door on the route, and on a phone it is below the fold.

**Decision**: `Sign in` (outlined) and `Sign up` (solid ink) are added, sourced from a new
`PUBLIC_AUTH_ACTIONS` in `components/public/destinations.ts`. They are deliberately **not**
members of `PUBLIC_DESTINATIONS`: that list also drives the footer's site map, where an auth
action does not belong, and keeping them separate is what lets the shell test go on
asserting the destination list contains nothing authed. `/login` and `/signup` are
unauthenticated routes under `app/(auth)/` — not `/app`, not role-gated — so this does not
put an authed destination on the public surface.

Per the mock, `Sign in` hides below 420 px so the bar still fits at 320 px; **both** appear
in the mobile sheet, so the narrowest viewport loses nothing (FR-019).

### 3. The narration is `--text-xs` at every width — the `md:` step is removed

**Context**: P6 stepped the story card's narration to `--text-base` (17 px) at `md`. The
mock's `.vo` is 12.5 px at every width; the step has no counterpart there.

**Measured 2026-07-28, real Chromium**: at 1024, 1280 and 1440 px the closing beats
(`backToAtEase` and the approved §10.3 Position 3 string) rendered **51 px of text inside
the 25.5 px one-line row** and were sliced in half by `overflow-hidden`. The cause is the
two-column hero: at `lg` the card becomes a ~520 px column, and 17 px copy needs more room
than that. The four widths T107 measured — 320/375/414/768 — are all **single-column**,
where the card is full width and the string fits, which is why the suite passed 5/5 while
the page was visibly broken.

**Decision**: the narration returns to `--text-xs` at every width. This is a **reversal of
a P6 regression, not a new size** — it restores the mock's own value, and it changes no
copy. The 2026-07-27 amendment above is untouched: the row is still two lines below 768 px
and one line at and above it.

`tests/layout/landing-hero-stability.spec.ts` gains **1280 px** to its width list and a new
`narrationClipped` assertion (text `scrollHeight` against row `clientHeight`), because the
existing checks structurally could not see this: a fixed row height is exactly what does
*not* change when content is clipped, and "wrapped" and "clipped" are different facts. Both
additions were confirmed **red** against the old code before the fix.

**Not done**: `plan.md`, `spec.md` and `research.md` are not edited. This entry is the
record.

---

## 2026-07-28 (second pass) — FR-053 gains a spent 24×24 exception for the chapter markers; the wordmark enters headings; the Ren thread types

Four changes from the landing fidelity pass's follow-up round. Only **one** of them edits a
planning artifact: FR-053, at Mohamed's explicit instruction. `plan.md` and `research.md`
are untouched, and nothing else in `spec.md` changed.

### 1. FR-053 — a 24×24 px exception, scoped to the chapter markers, spent

**Context**: the 44px tap-target floor made the mock's chapter-marker treatment
unreachable. Six controls in one row means the cluster is **264px wide at 44×44** however
small the dot is drawn, because the *hit area* sets the width — against the mock's ~66px.
The row read as scattered rather than as a cluster. Reported as a constraint conflict
rather than resolved unilaterally, since shrinking a stated floor was not mine to decide.

**Decision (Mohamed, 2026-07-28)**: amend FR-053 with an exception permitting **24×24px**
targets for `components/landing/chapter-markers.tsx` **only**, marked spent, in the same
shape as FR-026's single-silhouette exception. The reasoning recorded in the amendment:
24×24 satisfies **WCAG 2.5.8 (AA)** — a step from AAA to AA on one control, not a drop
below conformance — the markers are a **convenience rather than a path** (the story
auto-advances without them, so no beat is reachable only through a marker), and they must
stay keyboard-reachable with a visible focus ring.

**Measured after**: markers are **24×24**, the cluster is **144px** (was 264px), the
resting dot holds **5.58:1 light / 6.58:1 dark**, and a focused marker still renders the
app's focus ring. Every other interactive element on the public surface remains ≥44px and
the walk asserts it, exempting only these six.

The mock's literal ~66px is still not reached and cannot be without going below 24px. 144px
is the floor under the amended rule.

### 2. The wordmark renders inside headings — without widening FR-029's site table

Six headings name the product: one on the landing page and five across the two legal
documents. They now render it through the shared `<Wordmark />` via a new
`components/brand/wordmark-in-text.tsx`, which splits the copy string and delegates.

**Why this is not a new FR-029 site.** FR-029's table is exhaustive about the *chrome*
surfaces that render the wordmark as a standing brand mark, and — load-bearingly — about
the two that **cannot** consume the shared component and are therefore named hand-sync
exceptions. A heading containing the product name in a sentence introduces no hand-sync
exception: it consumes the one definition, so the rule the table exists to protect (one
definition, reused, never re-typed) is satisfied rather than stretched. Writing the two-tone
markup at each of the six call sites would have been the actual violation.

**Superseded in part, 2026-07-28:** this reading was accepted and **FR-029 was amended** to
state it, because "exhaustively" read as a closed list of every place the wordmark may
appear. The amendment clarifies rather than allows — in-prose usage through the shared
definition is permitted, re-typing the markup at such a site remains a violation, and the
hand-sync exceptions remain exactly two. So the sentence above saying `spec.md` is not
edited for this held on the day it was written and no longer does.

**Deliberately not applied anywhere else.** Body copy, section labels and the legal
documents' contents index stay plain. The contents index is a nav list rather than a
heading, and a two-tone mark repeated down a sidebar is the wallpaper effect that costs the
hero the effect it exists to carry.

### 3. The quiet panel's bars follow the band

They were pinned to meadow, so the panel stayed green while the reading beside it said
"A little tense" and the sparkline had already gone amber — three parts of one readout
disagreeing about the same moment. Same three tokens and the same mapping `story-trend.tsx`
uses. Following the band is not encoding a value: the bars still carry no number and their
heights are unchanged.

### 4. The Ren thread types — and the drift invariant was never traded for it

The person's messages type character by character and Ren shows a typing indicator before
each reply. The obvious hazard is a growing element inside a box whose whole guarantee is
that nothing moves.

**The bubble reserves its final size and fills in.** Each animating bubble is a 1×1 grid
holding two children in the SAME cell: an `invisible` copy of the complete message, which
is what the grid measures, and the revealed prefix painted over it. The box is the finished
box from the first character, and the prefix wraps where the finished text wraps because
both lay out at the same width.

**Measured, because "it looks fine" is not the bar here.** Sampled mid-type and after, at
320/414/768/1280: the bubble is **324.3×27.9 / 299.5×45.8 / 212×45.8 identical in both
samples**, painted 13–17 of 50 characters at the mid sample, with the card's own box
unchanged, nothing outside the panel, no thread scrolling, and the 4-bubble cap intact.
Ren's indicator is the one thing that changes size and it only grows *toward* the
already-measured finished state, in the same slot — never a fifth list item.

**Reduced motion is absence, not slowness**: no typing, no indicator, and no dependence on
a timer having fired, so a visitor stepping through with the markers sees complete text at
every beat. The answer is threaded down from `use-story-clock.ts` rather than queried
again — T099 asserts exactly one landing module reads that query, and a second reader could
disagree with the clock on the render where they resolve.

**The indicator is an animation, not copy**: it is `aria-hidden`, and every bubble carries
its full text in an `sr-only` span from mount, so a screen reader gets each message once,
statically, and hears nothing as it types. A live region would have re-announced a growing
string on every frame.

---

## 2026-07-28 (third pass) — Feature 013's closing decisions: what the consent design settled, and the two residuals it ships knowingly

Recorded by T143 as feature 013 closes. Eight of these are decisions the feature made and
closed; the last two are **residuals it ships with open eyes**, written down here precisely so
that a later reader does not mistake either one for an oversight.

### 1. Order A — the legal half first, and the hero story last

Decided 2026-07-25 (`plan.md` §14.2). The two candidate orders traded the same scarce thing —
which half of the feature gets built while there is still slack — and the feature chose to spend
that slack on the Terms of Service and Privacy Policy rather than on the landing hero.

**The reason is that the two risks are different in kind, not merely in size.** The hero story
card is the largest and least predictable *implementation* item in the feature — 17 beats, four
absolutely positioned panels, a zero-pixel-drift geometry contract at four widths, reduced
motion, an `IntersectionObserver` with a known repo gotcha, chapter markers. Its risk is
**schedule** risk: bounded, visible while it is happening, and cuttable. The legal text's risk is
**correctness** risk on a **durable public promise** — the kind that is invisible on the day and
expensive later, and the kind FR-050 exists to stop being incurred in a hurry.

The cost was accepted rather than argued away: building the hero last means discovering it last,
and if it overran it would overrun at the end, against the deadline. It did not, but the decision
would have been the same either way — a late hero is a schedule problem, and hurried legal text
is a promise nobody can take back.

### 2. Re-consent is decided by version IDENTITY, never by comparing timestamps

`user_consents.document_version` holds a version id (`terms_privacy@2026-07-26.1`), and the gate
asks whether the id a person holds is **at or past the binding revision's position in the
registry** — `satisfiesConsent()` at `apps/web/lib/consent/evaluate.ts:67–79`, a `findIndex`
membership test against `CONSENT_REGISTRY`.

**A timestamp comparison would have been the obvious implementation and it is wrong**, for a
reason worth stating because it recurs: "consent recorded before the document changed" is not the
same question as "consent recorded against wording we now consider superseded". A clock
comparison answers the first. It gets the second wrong every time the two diverge — a cosmetic
revision would re-prompt everyone who consented before it, and a material revision published with
a backdated timestamp would re-prompt nobody. Materiality is a **human judgment made at publish
time** and recorded on the revision (`registry.ts`, `materiality` + a required `rationale`); it is
never derived from a text diff, a content hash, or a date (FR-043a).

`publishedOn` exists on every revision and is **evidence only** — the registry's own comment says
so, and nothing in the gate reads it.

### 3. The version registry lives in the repository, not in a database table

`apps/web/lib/consent/registry.ts` is a constants module (`research.md` §6.3).

**What this buys.** Publishing a revision is a pull request and **zero migrations**: the wording
edit and the registry entry describing it land in the **same PR** (`research.md` §6.1), so a
reviewer reads the new text directly beside its materiality classification and the stated reason
for that classification. Put the registry in a table and those two things separate — the wording
ships in a deploy, the classification is typed into a database by whoever remembers, and the
review that is the entire safeguard never happens in one place.

**What it costs, stated plainly.** The registry cannot be edited at runtime. Correcting a
misclassification means a deploy. That is the right trade for something that is supposed to be
slow and reviewed.

The module is deliberately **pure** — it imports nothing from `server-only`, so Vitest loads it
directly and the evaluator suite covers every registry shape without a database. Its invariants
(explicit materiality, non-empty rationale, unique well-formed self-prefixed ids, ascending
publication order, append-only against a frozen snapshot) are CI-enforced in
`tests/unit/lib/consent/registry-guards.test.ts`.

### 4. The two gates fail in OPPOSITE directions, and the asymmetry is the design

- **The app-shell Terms/Privacy gate fails OPEN** (§7.3). If the consent read errors, the user
  reaches the app and `failOpen()` says so in the logs.
- **The camera-and-inference gate fails CLOSED** (§7.2, `lib/consent/read.ts`). If the read
  errors, no capture happens.

**Why they differ.** The failure modes are not symmetric in consequence. A broken read at the
shell gate, failing closed, locks **every user out of the entire product** over a database blip —
an outage manufactured by a safety mechanism. Failing open costs a window in which someone browses
the app under wording they have not re-acknowledged: recoverable, and detectable. A broken read at
the camera gate, failing open, means **a camera turns on and inference runs against someone who
has not agreed to it.** That is not recoverable and not detectable after the fact. So the shell
gate optimises for availability and the camera gate optimises for restraint, and neither direction
is a default anyone should "make consistent" later.

**`lib/consent/read.ts` deliberately hard-codes neither direction.** It returns a discriminated
result, so "no rows" and "read failed" cannot be conflated by accident, and **the call site owns
the fail direction**. That is why the same module can serve both gates without either one
inheriting the other's answer.

**"No rows" is a real, expected answer, not a malfunction** — every pre-existing user has zero
consent records (FR-041, §7.4), and so does anyone created during the deploy window. It means *not
consented*; it does not mean *broken*.

### 5. The migration stays one file

`supabase/migrations/20260726000000_user_consents.sql` carries the table, its constraints, its
index, its immutability trigger, RLS, the grants, and the `CREATE OR REPLACE` of
`handle_new_user()` — all of it. It was not split.

**Because a split has no partial state worth landing in.** The table without its RLS policies is a
table anyone can read; the trigger without the table raises on every signup. Every intermediate
state of a split is worse than either endpoint, and splitting only creates the opportunity to stop
halfway. One file has one outcome: applied, or not.

### 6. `decision` admits only `'granted'` — and declining is not withdrawal

The column is `NOT NULL DEFAULT 'granted' CHECK (decision IN ('granted'))`
(`…_user_consents.sql:32`).

**Declining writes nothing** (FR-042): no row, no deletion, no withdrawal state, no tombstone.
`'declined'` is deliberately **absent from the CHECK**, and the migration says why in place —
admitting the value would invite writing the row. There is no "declined" record because a decline
is the absence of a consent, not a kind of consent.

**The seam is left open on purpose.** Feature **018** owns withdrawal, and it widens this CHECK and
inserts a **new** row — never updates an old one. The table is append-only by design (FR-043b) and
carries an immutability trigger plus no UPDATE or DELETE grant to `authenticated`, so consent is a
**history**: one row per accepted revision, and the record of what someone agreed to in the past
survives them changing their mind.

### 7. RESIDUAL — SC-006 holds for the product's own signup surface, and NOT against a caller who bypasses it. Open signup is a DELIBERATE posture, not an omission.

**This is the entry a later reader is most likely to misread, so it is stated flatly.**

SC-006 — every account has a consent row — **holds for 100% of accounts created through the
product's own `/signup` surface.** It **does not hold** against a caller who goes around that
surface and calls the auth API directly. The consent row is written by `handle_new_user()` only
when the signup supplied `terms_privacy_version` in its user metadata; a caller who omits it
creates an account with no consent row, and a caller who supplies a well-formed value forges one.

**The root cause is that `/signup` is open self-serve — issue #62 — and #62 STAYS OPEN,
deliberately.**

`plan.md` §15 R8 describes this residual as one whose root cause "must close before real user data
is processed". A reader who takes that at face value, then visits the live site and finds `/signup`
open, will reasonably conclude the gate was forgotten. **It was not forgotten. It was weighed and
accepted.** The demo deployment at **serenify.tech ships knowingly with open self-serve signup**
for the demo window; #62 is held open as an accepted posture until adoption, not as a backlog item
that slipped; and **R8's SC-006 bypass is therefore LIVE and ACCEPTED for that window.**

**The blast radius, unchanged from R8 and worth repeating because it is what makes the posture
defensible:** one forged consent row, **for the forger's own account**, RLS-scoped to
`auth.uid()`. No cross-user write. No privilege escalation. Nothing else in the product unlocked
by it. A person can lie about having read the Terms — on their own behalf, to their own row.

### 8. RESIDUAL — R7 is NARROWER than `plan.md` §15 says, and the two cases are not the same

`plan.md` §15 R7 reads: *"a malformed signup consent version could be written… shape-constrained by
two DB CHECKs; a non-registry value never satisfies `satisfiesConsent()`."* That sentence blurs two
outcomes which differ completely. Established by reading the shipped trigger and constraints:

- **Well-formed but non-registry** (e.g. `terms_privacy@2099-01-01.1`) — **is written**, and is
  **inert** exactly as R7 says. `satisfiesConsent` is a membership test
  (`evaluate.ts:74–77`, `findIndex` → `-1`), and `-1` is never `>=` a valid binding index, so it
  never satisfies the gate. The §6.3 reconciliation query lists it.
- **Malformed** (fails the format regex at `…_user_consents.sql:28`, or arrives as JSON `null`
  against the `NOT NULL` at `:27`) — **is never written at all.** It raises **`23514`** /
  **`23502`**. `on_auth_user_created` is `AFTER INSERT ON auth.users FOR EACH ROW`
  (`20260517000030_profile_trigger.sql:27–29`), so the exception aborts the statement and **the
  `auth.users` row is rolled back — that signup fails outright.** `ON CONFLICT DO NOTHING`
  (`:111`) does **not** swallow it: it covers unique and exclusion violations only.

So the first case is a junk row that can never unlock anything, and the second is not a row at all
— it is a failed signup. Neither is "a malformed value written to the database", which is what R7
reads as.

**`plan.md` is deliberately NOT edited to match.** R7 **overstates** a risk rather than
understating one, and the plan is not amended mid-build. This entry is where the correction lives.

### 9. Production deploys from `main`, so the merge IS the deploy — and production verification therefore happens AFTER it

Established 2026-07-28 during P8 Stage 4, read from the Vercel API. The `serenify` project has
`productionBranch: "main"`, no deploy hooks, and the last **13** production deployments are all
`source: git` from `main`.

**Consequence: "deploy, verify, then merge" is not achievable on this platform**, and P8's phasing
should not be read as implying it was. T138 had already said as much in passing — *"serenify.tech
does not have it until T148 merges"* — without recording the mechanism behind it.

**The CLI escape hatch was considered and rejected**, because it does not buy the order it appears
to. `vercel --prod` from the feature branch would produce a genuine production deployment without
merging; but the merge then triggers a **fresh** production build from `main`, and *that* build —
not the verified one — is what serves users. There is no sequence here in which the artefact you
verified and the artefact serving users are the same object **and** the merge comes last. Merging
first is the only order in which they are the same object.

**Promoting the branch preview was also rejected**, and the reason is an honest "cannot prove it".
A preview deployment is built with **preview** environment variables and `NEXT_PUBLIC_*` are
inlined at build time, so promoting it would serve preview-scoped values to real users — `SITE_URL`
in particular, which drives auth redirect and confirmation-email links. An attempt to establish
whether the preview and production values actually differ was **inconclusive**: the Vercel API
returns them encrypted even with `decrypt=true`, so a hash comparison proves nothing in either
direction. Unprovable-as-safe was treated as reason enough not to take it.

**What follows from this** is recorded in `deploy-protocol.md` §3: production verification runs
immediately after the merge, unbroken, with **Lever 0** (`vercel rollback` to the pre-013
deployment — an alias flip, seconds, no rebuild, destroys no consent history) armed beforehand.
The window between "013 is live" and "013 is verified" is the risk this ordering creates; the
mitigation is to keep it short and to hold the rollback in hand before starting.

### 10. RESIDUAL — the Terms/Privacy gate does not cover `(onboarding)`, and that ships knowingly with a measured population of ZERO

Found by the **T146 final review**, immediately before the merge. Recorded here rather than fixed,
and the reasoning matters more than the verdict.

**The gap.** The app-shell gate lives in `apps/web/app/(authed)/layout.tsx`.
`apps/web/app/(onboarding)/layout.tsx` has **no consent gate at all**, and `(onboarding)` is a
**sibling** route group rather than a child of `(authed)`. **FR-043c** says a user who has not
accepted *"MAY NOT use the application at all"*, and onboarding is part of the application.

**The population is measured, not asserted.** `apps/web/proxy.ts:200-208` makes `/onboarding`
reachable **only** when `profiles.full_name IS NULL`. Against hosted on 2026-07-28, immediately
before the merge:

```
 null_full_name_users        →  0
 null_name_and_unconsented   →  0
 total_users                 → 20
```

**Zero.** All 20 existing accounts have `full_name` set and therefore cannot reach `/onboarding` at
all; each meets the gate at `/app` correctly. Post-013 signups set `full_name` **and** write a
consent row in the same `handle_new_user()` transaction, so they never qualify either. The gap is
**structural, not populated** — and it is written down with its number precisely because *a known
gap with an unmeasured size is the bad kind of record.*

**Why it was not fixed at the deploy boundary — and this is the load-bearing reason.** The
precedent is **T049**: the last time `/onboarding` was gated broadly, it created a **permanent
lockout for every new employee**, and that was caught only because the task was refused as written
rather than implemented. Mirroring a second high-blast-radius gate into that same layout, at the
deploy boundary, **unexercised** — ST-10, ST-10a and ST-10b were every one of them run against the
`(authed)` gate only — is that same failure mode, incurred against an exposure that the
**camera-and-inference gate already covers** (it is present at `/onboarding` and fails **closed**,
so capture is consented regardless) and a population measured at zero.

**The residual, stated so it cannot be mistaken for an oversight**: for the 013 release, a user in
that state *could* complete onboarding and a first calibration without meeting the Terms/Privacy
gate. Nobody is in that state. The window closes by itself the moment onboarding completes and the
proxy routes to `/app`. Tracked as **#195**, to be fixed in its own change **with** an
ST-10-equivalent lockout-and-recovery exercise — because on this layout the exercise, not the code,
is the expensive half.

### 11. The data controller is named "Mohamed Assem" in both legal documents, deliberately, against FR-046's spelling

Raised by the T146 review as a possible defect; it is not one, and the reason is recorded so it is
not re-raised.

Both legal documents write the controller as **"Mohamed Assem"** (`lib/legal/copy.ts:123`, `:333`),
while **FR-046** writes **"Mohamed Asem"**. The divergence is **intentional and documented at the
site** (`lib/legal/copy.ts:141-145`): FR-024 names the same person as *"Mohamed Assem Adel"* in the
authors list, and the documents use one spelling throughout **so that a reader never meets two
spellings of the same person across the controller role and the author role**. The
`copy-invariants` suite pins the double-s form, so code and tests agree.

**Confirmed by Mohamed on 2026-07-28: "Mohamed Assem" is correct.** The constitution (`:555`),
`README.md:67` and FR-024 already use it; FR-046's single-s form is the outlier.

**`spec.md` is deliberately NOT edited to match**, on the same principle as the R7 correction above:
a requirement whose wording is narrower or looser than what shipped is corrected **in the decision
log**, not by amending the spec mid-build. FR-046 identifies the right person; it spells the name
one way and the shipped documents spell it the other, and this entry is the record of which one is
authoritative.

## 2026-07-28 (fourth pass) — Sign-out revokes **only the current session**, not every device: `scope: "local"` replaces supabase-js's `"global"` default

Recorded as a **security-posture decision**, not a typo fix. It changes who gets logged out by a
sign-out, which is session-invalidation behaviour and is exactly the kind of change that should not
appear in a diff without a written reason.

### What changed

Both sign-out call sites now pass `{ scope: "local" }`:

- `app/(authed)/actions.ts` — the Server Action behind all five sign-out controls
- `components/cross-tab-auth.tsx` — the sibling-tab handler that clears cookies before navigating

Previously both called `supabase.auth.signOut()` with no argument. From the installed
`@supabase/auth-js` 2.106.2 (`dist/main/GoTrueClient.js:3176`):

```js
async signOut(options = { scope: 'global' }) {
```

The scope is a **server-side GoTrue parameter**, not a client-side filter — `GoTrueAdminApi.js:73`
issues `POST ${url}/logout?scope=${scope}`. `global` revokes the refresh token for **every session
the user holds, on every device**. The library's own docstring, twenty lines above the default, says
the opposite is usually wanted: *"`{ scope: 'local' }` to only sign out the current session. This is
usually what apps want on a 'Sign out' button, especially when users sign in from multiple devices
and do not expect signing out of one to terminate the others."*

Serenify had the behaviour the docstring warns about. Signing out on a laptop ended the session on
the user's phone. For a wellbeing app that people are expected to keep signed in on a personal
device, that is a real surprise, and nobody chose it — it was the default arriving unexamined.

### What this does **not** fix, stated because it is the easy misreading

**It does not narrow the cross-tab race** that caused #200, and it must not be described as doing so.

Two tabs in one browser share one cookie jar, therefore one refresh token, therefore **one session**.
A `local` revoke from a sibling tab ends *precisely the session the originating tab is using* — the
same outcome `global` produced for that tab. The only difference is blast radius **across devices**.

The race was survivable only after the transport fix in `proxy.ts` (#200 C1). Anyone reading this
entry as "we fixed the race by narrowing the scope" would draw the wrong conclusion about why the
sign-out failure stopped.

### The sibling tab still calls `signOut` at all — deliberately

Considered removing it, since the originating tab's action now clears the cookies authoritatively
and both tabs share the jar. Rejected: `proxy.ts`'s `user && isAuthPage → /app` rule is a **GET**
gate after C1, and `router.push` **is** a GET. A sibling that navigates to `/login` while the cookies
are still valid is bounced straight back to `/app`. The call is what guarantees the cookies are gone
before the navigation, which is the race-condition guard the original comment describes.

### Forced cookie clearing, and why it lives in app code

The revoke result was previously discarded. supabase-js clears the local session **only** when the
logout request succeeds or fails with 401/403/404 (`GoTrueClient.js:3186-3200`); on anything else —
a network timeout surfaces as `AuthRetryableFetchError`, which is not an `AuthApiError` — `_signOut`
returns early **without** clearing, and `_removeSession` is private. **There is no public API to
force it.**

So the action clears the cookies itself, matching on the `sb-` prefix (the base cookie is
`sb-<project-ref>-auth-token`; an oversized session splits across `<name>.0`, `<name>.1`, …), and
redirects either way. This is the fix for the reported *"sometimes a manual refresh doesn't land on
the login screen"*: before it, a failed revoke left the user on `/login` holding valid cookies, and
the proxy bounced them back to `/app`.

The alternative — reaching into `_removeSession` — was rejected. A private underscore method is not
a contract, and a supabase-js patch release could remove it silently.

### Consequence to be aware of

A user who wants to end **all** their sessions no longer has a control that does it. That capability
was never offered deliberately — it was a side effect of the default — and no UI ever described it,
so nothing shipped is now inaccurate. If "sign out everywhere" is wanted, it should be built as its
own explicit control with its own copy, not restored by widening this scope.

---

## 2026-07-29 — The public navbar becomes SOLID (reversing the translucency of the day before), the app header becomes sticky, and the two destination rows become one treatment

**Status**: Accepted. Branch `fix/navbar-chrome-and-active-state`. Not a SpecKit feature —
a follow-up fix branch in the manner of PR #113, with no `specs/` directory of its own.

### 1. Translucency and the backdrop blur are REVERSED; stickiness is kept

This **reverses part of the 2026-07-28 entry above**, "The public navbar becomes sticky and
gains Sign in / Sign up". That entry made the bar `sticky top-0 z-50` over
`color-mix(in srgb, var(--color-bg) 88%, transparent)` with a 12 px `backdrop-blur-md`,
following the signed-off landing mock. **Only the translucency is reversed.** Stickiness,
`h-16`, `border-b border-border`, the wordmark size, the three-slot rhythm, the trailing
theme toggle and the Sign in / Sign up pair are all unchanged, and item 2 of that entry
(the auth actions) is untouched and still stands.

The bar is now plain `bg-bg` — the same opaque token `components/header/header.tsx` uses.
Two reasons, and the first is the load-bearing one:

- **The inline `style={{ background: "color-mix(…)" }}` was a colour declaration bypassing
  the token utilities.** FR-057 requires the landing page to reuse the real design tokens
  rather than port the mock's CSS; an inline `color-mix` computed against a token is a
  *derived* value written into the component, which is the seam FR-057 exists to close. A
  token utility (`bg-bg`) is the shape the rule asks for.
- **An 88 % veil over scrolling body copy bought nothing.** A sticky bar's job is to cover
  what passes under it. Measured after the change on `/terms` at scroll y=700: every pixel
  in an empty region of the bar is exactly the bar's own background, with no second colour.
  Before, body copy blended through.

### 2. `docs/mockups/serenify-landing-mock.html` is SPENT as the authority for this element's background

**Scoped narrowly and deliberately.** The mock remains authoritative everywhere else — its
type, spacing, section rhythm, hero composition and colour usage are all still the
reference. What it no longer decides is **the public navbar's background treatment**:
opacity, `backdrop-filter`, or any translucent ground on that one element.

This is recorded because **the mock is gitignored and untracked**, so it cannot be
corrected by a pull request. Without this entry the next fidelity pass reads the mock's
`nav` rule, sees an 88 %-opaque blurred bar, finds an opaque one in the code, and "fixes"
the translucency back in — with the same reasoning that put it there on 2026-07-28. The
mock is not wrong; it is simply no longer the decider for this property.

### 3. The app header becomes sticky, so the two bars match in both directions

`components/header/header.tsx` gains `sticky top-0 z-50`. It was already `bg-bg` and
already `h-16`, so no background or height change was needed — confirmed rather than
assumed. `app/(authed)/layout.tsx` is untouched: the header is already the first child of
a `flex min-h-dvh flex-col` column with no transform, filter or opacity, so it creates no
stacking context and `sticky` resolves against the document scroller.

The 2026-07-28 entry justified the divergence by arguing that `/` is a long scrolling
narrative while the app sits above short task-shaped screens. That argument is not
withdrawn — it explains why the public bar went first — but "matching means matching
behaviour too" is the better rule, and the way to honour it is to make both sticky rather
than neither.

**Measured consequences, in real Chromium, before the line was added** — recorded because
the class-level prediction that preceded them was wrong in both magnitude and target:

- On `/app/chat`, the only thing that passes under the bar is the page `<h1>`, and only
  below a **624 px** viewport height. The chat card itself is only touched below **576 px**,
  and above **656 px** the route does not scroll at all. An earlier reading derived "~688 px"
  from `h-[calc(100dvh-8rem)]` in isolation; that is wrong, because `min-h-[35rem]` binds
  below 688 px and the `calc` never applies there. **The ~32 px of slack between the
  reserved `8rem` and the real 96 px of chrome is therefore inert in the range where the
  overlay happens, and the arithmetic is deliberately left alone.**
- The open `ChatPill` panel is also `z-50` but later in DOM order, so it **paints on top of**
  the header where they overlap, which begins below a **444 px** viewport height. Confirmed
  with `elementFromPoint`, not inferred from the spec. Not a defect; a modal-ish overlay
  covering chrome is correct, and the outcome is unchanged from before (the header was
  already covered there — it just scrolled rather than stuck).

### 4. The two destination rows become ONE treatment — and the mirror runs UPWARD

`components/public/public-desktop-nav.tsx` now renders a class string **character-identical**
to `components/header/center-nav.tsx`'s (124 bytes, byte-compared, not eyeballed):

```
"inline-flex h-11 items-center rounded-md px-3 text-sm text-ink transition-colors hover:bg-surface",
active && "bg-surface",
```

Dropped from the public row: `underline decoration-2 underline-offset-4`, `text-muted` as
the resting colour, `rounded-control`, `whitespace-nowrap`, and the
`focus-visible:outline-none … ring-2 …` chain.

**The underline is a knowing accessibility trade, ruled on explicitly rather than
overlooked.** `public-desktop-nav.tsx` previously carried a thirty-line argument for it,
and the argument is correct: `bg-surface` on `bg-bg` measures **1.094:1 in light**
(`#F4F5F6` on `#EAEBEC`) and **1.085:1 in dark** (`#181B1E` on `#101214`), against the
**3:1** WCAG 1.4.11 asks of a non-text indicator — and `hover:bg-surface` renders
pixel-identically to the active fill, so "the page you are on" and "the link under your
cursor" look the same. Both were true of `CenterNav` all along. The ruling: the two bars
are made identical, and this is a **shared, known property of the house pill** rather than
something one file fixes unilaterally. `aria-current="page"` is unaffected and remains the
machine-readable half. Pinned by tests in both components so it cannot drift silently.

**`CenterNav` was RAISED to `h-11`, not the public row lowered to `h-9`.** This is the part
that decided the direction. FR-053 requires a 44 px tap target on the public surface and
its single exception — the landing chapter markers, 2026-07-28 — is explicitly **spent**:
"It licenses no other sub-44px target anywhere on the public surface; a further one needs a
further amendment." Lowering the public row to 36 px would have needed that amendment, to
make a target *smaller*, on a row live from 768 px up (which includes touch tablets, and
768 px is one of the four widths FR-053 names). Raising the app row costs nothing and
satisfies the constraint. **No spec is amended by this change, and `docs/CHANGELOG.md`
therefore gets no entry.**

Measured across 12 combinations (768/820/1024/1280 px × employee two-pill and admin
one-pill × `/app` and `/app/chat`): the header box stays 64 px, nothing overflows, pill
widths are byte-identical, labels stay on one line box, and **every other piece of header
furniture — hamburger, wordmark link, wordmark glyph, theme toggle, avatar — is unchanged
in height, top, centre and x-extent.** The right-hand cluster was *already* 44 px, so
`h-9` had made the nav pills the only sub-44 interactive element in that bar.

**The custom focus ring's removal is not a regression, and was checked before the removal
rather than after.** Nothing in `globals.css` resets outlines, and Tailwind v4's preflight
contains exactly one outline declaration — `:-moz-focusring { outline: auto }` at
`preflight.css:172-174`, which *restores* a ring. Tabbing to a `CenterNav` link in real
Chromium yields `outline: auto 1px rgb(28, 32, 35)`, visible in both themes. FR-055 is
satisfied by the UA ring. The trade is that the ring is now browser-dependent where the
meadow ring was identical everywhere.

**`components/public/public-mobile-nav.tsx` is deliberately NOT changed.** It uses a third,
weaker rule — `pathname === href`, exact-only, no prefix branch. Left for a separate
decision rather than folded in silently.

### 5. The legal contents rail clears the bar; the anchor split of labour is made explicit

`components/legal/legal-document.tsx`'s contents rail was `lg:sticky lg:top-8` — 32 px
against a 64 px bar. Measured at `lg` on `/terms` at two scroll positions: **32 px of the
rail sat under the bar, the "Contents" heading was entirely hidden, and the first link's
top edge was 0.8 px from being clipped.** Now `lg:top-20` (80 px = the bar plus a 16 px
gap), with `lg:max-h-[calc(100dvh-4rem)]` becoming `lg:max-h-[calc(100dvh-6rem)]` so the
reserve tracks the offset instead of letting the rail grow past the viewport bottom by the
amount the offset grew.

The sections stay at **`scroll-mt-8`**. Raising them to `scroll-mt-20` was tried and
**reverted after measuring the result**. The reasoning for raising was self-sufficiency:
`html { scroll-padding-top: 4rem }` ADDS to a target's `scroll-margin` rather than maxing
with it, so 32 px of scroll-margin was only clearing the bar because of a global declared
in another file for another surface. True, but the cure cost more than the disease — at
`scroll-mt-20` an anchored heading landed **119.6 px** below the bar instead of **71.6 px**,
about 15 % of an 800 px viewport spent on dead space, on the common path. Speculative
robustness is not worth a visible regression.

The division of labour stands, and is now documented at both ends instead of being
implicit: **`scroll-padding-top` clears the bar; each section's `scroll-mt-*` is breathing
room on top of it.** `globals.css`'s comment now says the rule is load-bearing and must not
be deleted, and `legal-document.tsx` records why the larger value was rejected.

The `globals.css` comment claiming the rule is "harmless on the authed surfaces, whose
header is not sticky and which have no in-page anchors" was false in both halves after
item 3 and is rewritten. The **value** `4rem` is unchanged and still correct for both bars.

### What this change is NOT

**It does not make the public navbar auth-aware.** A signed-in visitor still sees
"Sign in / Sign up" on `/`. That is a separate change, kept apart deliberately because it
adds a `profiles` read to public routes and the deploy should carry one suspect at a time.

### Two pre-existing defects found while verifying, filed rather than fixed

- **#208** — `service_role` holds no DML on **any** `public` table, so Playwright's
  `globalSetup` aborts at `42501` and **zero e2e specs run**. The cause is the project's
  `pg_default_acl` for relations created by `postgres` (`Dxtm` only — no `arwd`), not a
  revoke; the grant is absent from all 16 migrations. No runtime path uses the service-role
  key, so production is unaffected. Combined with the fact that **CI has never run the e2e
  suite** (`ci.yml:4` — "No secrets, no Supabase, no Playwright"), there is currently **no
  environment in which e2e can execute**.
- **#209** — `--color-border` self-references inside `@theme inline`
  (`globals.css:124`), making it cyclic. In **light mode** it computes invalid and all 81
  `border-border` usages across 47 files fall back to `currentColor` (ink) instead of
  `#D7D9DC`. Dark mode is unaffected, because `:root.dark` re-declares the token
  non-cyclically — so the default mode is the broken one. A one-line deletion fixes it, but
  a palette token touches every surface, which is a wider blast radius than a navbar change
  should carry.

### How this change is verified, stated honestly

- **Unit (Vitest)** — 1460 tests across 133 files, green. Seven new assertions were
  confirmed **red against `main`** first.
- **Layout (`playwright.layout.config.ts`)** — a new `tests/layout/public-chrome.spec.ts`,
  5 tests, of which **3 were confirmed red against `main`**. The other 2 are guards, not
  fix-tests, and are labelled as such.
- **The app header's stickiness is covered by CLASS-LIST ASSERTIONS ONLY.** `/app` is
  authed, and the layout config has no `globalSetup` precisely so it needs no Supabase —
  which also means it cannot log in. The rendered behaviour was measured by hand in real
  Chromium (the viewport thresholds in item 3) and is recorded, not asserted.
- **The layout specs are NOT a gate.** CI does not invoke that config. They are a local
  instrument a human has to remember to run with `npm run -w apps/web test:layout`.
- **No e2e evidence exists for this change**, per #208. The four files touched have no e2e
  coverage today regardless: the only spec that mentions the nav asserts hamburger
  visibility at 360 px, below `md`, where the nav is not rendered.

---

## 2026-07-29 (second pass) — `Co-authored-by:` trailers are rescinded; merged history keeps its own

**Status**: Accepted, on Mohamed's explicit confirmation. Reverses the blanket co-author
rule that had stood since the early features.

### The rule that is being reversed

`CLAUDE.md` carried a blanket instruction:

> - Co-author trailers: add all three teammates (`Fatma-Alzahraaa`, `gehaddmohamedd`,
>   `hebatullah003`) as `Co-authored-by:` trailers on every commit.

It is replaced by the opposite: **do not add `Co-authored-by:` trailers.**

### Why

**They are redundant.** All three teammates are direct contributors to this repository
now. A trailer exists to credit someone who has no commit of their own on the work; that
is no longer the situation.

**And they were actively misattributing.** GitHub matches a co-author to an account by
**email**, not by the handle in the angle brackets. The trailers written onto the
`fix/navbar-chrome-and-active-state` commit used three addresses that appear **nowhere** in
`main`'s history:

```
written:   fatma.alzahraa@users.noreply.github.com
           gehad.mohamed@users.noreply.github.com
           hebatullah@users.noreply.github.com

on main:   190964222+Fatma-Alzahraaa@users.noreply.github.com   (+ 3 other variants)
           147542332+gehaddmohamedd@users.noreply.github.com    (+ 3 other variants)
           198823283+hebatullah003@users.noreply.github.com     (+ 2 other variants)
```

None of the three matches a real account, so they credited nobody. `main`'s history also
shows **eleven distinct spellings** across the three people — four for one of them — which
is the deeper problem: a rule that says "add three trailers" without pinning the exact
addresses cannot be followed correctly from memory, and was not.

### Scope, exactly

- **Commits on `fix/navbar-chrome-and-active-state` (PR #210)**: trailers stripped, by
  amending in place and force-pushing with `--force-with-lease`. The rest of the message is
  byte-identical.
- **All future commits**: no trailers.
- **Merged history is NOT rewritten.** Every commit already on `main` keeps its trailers,
  correct or not. Published history is not rewritten for a convention change — the same
  posture `CLAUDE.md` already takes toward the two `Claude-Session:` trailers that exist on
  older feature commits (`#23`, `#118`).

### What is unaffected

**The `Claude-Session:` / `claude.ai` URL prohibition stands unchanged and is unrelated.**
That rule exists because this repository is public and those URLs link to private agent
sessions. Nothing here touches it. Verified on this branch after the amend: zero
`Co-authored-by` lines, and zero `Claude-Session` trailers or `claude.ai` URLs in either the
commit message or the PR body.

### Nothing enforced this, and nothing enforces the reversal

Searched before changing anything. The rule lived in exactly one operative place —
`CLAUDE.md` — plus one historical restatement in
`specs/013-public-surface-and-legal/tasks.md`. It is **not** in
`.specify/memory/constitution.md` (so this is a `CLAUDE.md` edit, not a constitutional
amendment), there is no `.gitmessage` or `commit.template`, the only two git hooks are
graphify's graph-rebuild hooks which never read a commit message, and `.codex/hooks.json`
holds only the disabled graphify guard.

CI does not check commit messages either. The `speckit-skills guard` job runs
`scripts/check-speckit-skills.mjs`, which verifies that the speckit skill files exist and
that `.gitignore`'s `.claude` entry is narrow — nothing else. So the force-push cost only a
CI re-run, and no check will fail for the absence of trailers going forward.

Descriptive mentions in `docs/PROGRESS.md`, `docs/CHANGELOG.md`, `RECON_2026-07-21.md` and
`specs/013/smoke-tests.md` are left alone: they are records of what past commits carried,
not instructions, and editing them would falsify the record.

---

## 2026-07-29 (third pass) — the focus outline sits flush (`outline-offset-0`), against Hallmark's default

**Decision**: the shared focus indicator on text-entry controls is a **2 px meadow outline with
`outline-offset-0`** — flush against the border, no gap. This **deviates from the Hallmark skill**,
which prescribes an offset, and the deviation is deliberate. Do not "correct" it back.

### What Hallmark says

`~/.claude/skills/hallmark/references/interaction-and-states.md`, verbatim:

> ```css
> :focus-visible {
>   outline: 2px solid var(--color-focus);
>   outline-offset: 2px;
> ```
> - 2px offset from the element.

and in its state-by-state input recipe:

> | **Focus** | `outline: 2px solid var(--color-focus)` · `outline-offset: 1px` … |

So the skill asks for 1–2 px of offset. This repo uses 0.

### Why we deviate

An offset paints **page background between the border and the outline**. The control then reads as
*two* concentric strokes with a channel between them, rather than one emphasised edge. That was
rejected on sight during review of #211, and the fix for it is exactly the offset: remove it and the
two strokes merge into a single 3 px edge (1 px border + 2 px outline, both meadow), so **one** thing
changes on focus rather than three (border colour + a new ring + a new gap).

This matters more here than it would elsewhere because the brand is deliberately calm. A gapped
double ring on every field in the auth flow is visual noise the rest of the surface does not have.

### What we did NOT compromise to get it

The offset is a *visual* property; every accessibility property Hallmark cares about is preserved or
exceeded:

- **2 px width is kept, and is a floor rather than a preference.** SC 2.4.13 Focus Appearance
  requires an indicator area at least as large as a 2 px perimeter. A 1 px outline is half that, and
  the border pixel cannot be counted toward it because grey→meadow is only 1.27:1.
- **Contrast is measured, not assumed**: the outline paints over pixels that were page background,
  giving **4.22:1 light / 7.43:1 dark**, well past the 3:1 the same criterion asks for.
- **The ring is instant.** Tailwind v4's `transition-colors` silently includes `outline-color`, which
  animated the outline in and would have violated Hallmark's "focus rings appear instantly. Always."
  The affected controls scope their transition to `transition-[color,background-color,border-color]`.
- **`:focus-visible`, not `:focus`**, exactly as the skill asks — and verified in a real browser to
  still match under mouse click, so no mouse user loses the indicator.

### `outline` rather than `ring`, also deliberate

Tailwind's `ring-*` is a `box-shadow`, and **box-shadow is clipped by `overflow-hidden` ancestors**.
Both inline rename inputs (`chat-shell.tsx`, `recent-chats-card.tsx`) sit inside one. `outline` is
never clipped. This happens to agree with Hallmark, which also prescribes `outline`; the rest of the
codebase's ~20 `ring-*` focus sites do not, which is the known two-idiom gap recorded on #211.

### The trap that makes this non-obvious

`outline-none` sets `--tw-outline-style: none`. Adding only `focus-visible:outline-2` therefore sets
a **width on an outline whose style is still `none`** — computed `outlineStyle` stays `"none"` and
**nothing paints at all**. `focus-visible:outline-solid` is required alongside the width. This was
caught only by reading computed style in a real engine; a DOM-shim unit test sees the class, finds it
present, and passes. Anyone editing this triad should re-run
`apps/web/tests/layout/focus-indicator.spec.ts` rather than trusting the class list.

---

## 2026-07-29 (fourth pass) — the public navbar becomes auth-aware, and FR-018 is superseded for the signed-in case only

**Decision**: `/terms` and `/privacy` now render a **signed-in** navbar when the visitor has a
session — **"Go to app" · theme toggle · profile dropdown**, replacing "Sign in / Sign up". The
signed-out navbar is byte-for-byte unchanged. `spec.md` is **not** edited.

### The defect

The public navbar rendered "Sign in / Sign up" to everybody. The path that matters is not
cosmetic: a pre-013 user meets the Terms/Privacy re-consent gate, opens one of the two documents
from it — in a new tab, by design (`components/consent/terms-reconsent-screen.tsx:104`) — and the
site greets them as a stranger. There are ~20 production accounts and **every pre-013 one meets
that gate**.

`/` was never affected: `app/(public)/page.tsx:65-70` already redirects a signed-in visitor to
`/app`. The one caveat is that the redirect is gated on `getUser()` returning a user, so a failed
auth read renders `/` signed-out — the same fail-open direction chosen below, and pre-existing.

### FR-018 is superseded for one case, and the case it was written for is untouched

`specs/013-public-surface-and-legal/spec.md:379-381`, verbatim:

> **FR-018**: The public navbar MUST **visually match** the real app navbar but be a **separate
> component** with its own nav items and **no dashboard or authed links**. It MUST NOT be
> translucent.

Restated in `contracts/public-surface.md:71` and `plan.md:111`.

FR-018 was guarding a **different failure** from the one fixed here, and its own test says so:

> "the failure mode is somebody 'de-duplicating' the two into one component that takes an optional
> session — at which point an authed destination reaches a **signed-out** page"

That guarantee is **absolute and unchanged**. What FR-018 should never have bound is the signed-in
case, which did not exist when it was written — the public surface had no way to resolve a session
at all, so there was no third state to legislate for.

**Superseded, not amended.** Feature 013 has shipped (PR #194) and was production-verified (#199);
its spec is a point-in-time record. The constitution states the convention directly:

> "forward-looking feature-number references in shipped `specs/*/` are NOT retro-edited … those
> spec docs are point-in-time records"

And the precedent is exact: **PR #210 changed this very component's chrome and rewrote
`public-shell.test.tsx`, touching no file under `specs/013/`**; PR #212 likewise. Both recorded the
change here. So `spec.md`, `contracts/public-surface.md` and `plan.md` are left alone, and no
`CHANGELOG.md` entry is written — per `CLAUDE.md`, that is for when a spec **is** amended.

### The guard test is split, not relaxed

`tests/unit/components/public/public-shell.test.tsx`:

- **signed out** — the original assertion at its original strictness, unconditional: no `/app`,
  `/onboarding` or `/auth` href; no `dashboard|sign out|my account|profile` in the rendered text;
  and, new, **no avatar trigger at all** (the dropdown's contents live in a Radix portal that only
  mounts on open, so the two text/href assertions cannot see them while it is closed — asserting
  the trigger's absence is what actually covers `/app/account` and "Sign out").
- Run across **all three ways of expressing "no viewer"** — prop omitted, `undefined`, `null` — so
  a future merged component that defaults its session parameter, or branches on a truthiness test
  a null profile object would pass, fails on at least one. The de-duplication risk went **up** with
  this change, not down, because the component now has a signed-in branch to get wrong.
- **signed in** — asserts the authed destinations ARE present, and that neither "Sign in" nor
  "Sign up" survives.
- The sheet gets the same pair, because otherwise the defect just moves into it.

### It fails open, and it fails silent

`lib/public-viewer.ts` cannot throw and cannot reject: auth failure, profiles failure and
client-construction failure all return `null`, log `[public-viewer] FAIL-OPEN`, and render the
signed-out navbar. Pinned by `tests/unit/lib/public-viewer.test.ts`.

The asymmetry is the point. `/terms` and `/privacy` are **legally load-bearing** — FR-043d entitles
a blocked user to read both in full, and the re-consent screen links into them as the gate's only
exit. A wrong navbar is a nuisance, and it is the navbar those routes shipped with anyway; a legal
page that 500s because an auth call timed out takes the gate's exit with it. Same direction as the
consent gate in `app/(authed)/layout.tsx`, same loud-and-greppable log convention.

**Not a client fetch.** Resolving auth after mount would flash "Sign in / Sign up" on every load,
which is worse than the bug. `getUser()`, never `getSession()`.

### Accepted cost: the `profiles` row is read twice per signed-in load

`proxy.ts:243-247` already selects `full_name` on every GET, including these routes. The proxy is a
**separate Node function invocation that completes before the render begins**, so React's
per-request memoisation cannot span the two — this is not a `cache()` problem, it is two processes.

The alternatives are worse: forwarding profile data on a request header across every route in the
app to save one query on two of them, or dropping the name and rendering email-derived initials for
every user. It is one indexed primary-key lookup of one column, and a **signed-out visitor pays
none of it** — `readPublicViewer` returns before touching `profiles` when there is no user.
Accepted, not engineered around.

**There is a clean way out, and it belongs to a different change.** #213 (filed from this branch)
proposes exempting `/terms` and `/privacy` from the proxy's onboarding gate — which is where the
proxy's `profiles` select lives. Landing that removes the proxy's read on exactly these two routes
and leaves `readPublicViewer`'s as the only one. It is not folded in here because `proxy.ts` is the
highest-blast-radius file in the repo and wants its own PR with dedicated gate coverage. **When #213
lands, this paragraph is superseded** — the duplicate read is gone rather than accepted.

### Two things checked and deliberately left alone

- **`public-footer.tsx` needs no change.** It renders no auth actions at all — wordmark,
  `PUBLIC_DESTINATIONS`, and the `© 2026 Serenify` line. The bug cannot move into it.
- **No sign-out control in the mobile sheet.** The profile dropdown is visible in the bar at every
  width, exactly as in the app header, so sign-out is already one click. The app's own
  `MobileMenu` carries none either.

### No rendering behaviour changes

`/terms` and `/privacy` were already `ƒ (Dynamic)` before this — the root layout awaits `headers()`
for the CSP nonce (`app/layout.tsx:45`), so nothing in this application prerenders. Confirmed
against a real `next build` on `main` **before** the change, not assumed, and re-confirmed after.

### Two follow-ups routed to BACKLOG, and why the fix itself needs no entry

Principle VIII governs **follow-ups deferred out of a change**. The navbar fix itself is not one —
it is planned work shipping complete in its own PR, with no deferred remainder.

Two genuine follow-ups were found while verifying it, and both are logged with issues:

- **#213** — a signed-in user with `full_name IS NULL` cannot open `/terms` or `/privacy` at all;
  `proxy.ts`'s onboarding gate exempts only `/api/*`. Measured, not reasoned: direct navigation,
  a new tab (the `target="_blank"` path every legal anchor uses), and `/signup` all 302 to
  `/onboarding`, while a signed-out control reaches both. **Latent, not a consent-integrity
  break** — no user is ever asked to accept a document they cannot read. The 013 legal anchor is
  on the *signup* form, where the user is signed out; the onboarding surface has none; and the
  camera gate cannot appear before the block lifts, because `onboarding-form.tsx:55-67` writes
  `full_name` and only then calls `setStep("anchor")`.
- **#214** — `lib/consent/copy.ts:23-28` justifies omitting manager-visibility copy from the
  camera gate on the grounds that "this surface links to it [the Privacy Policy]", and the shipped
  `camera-consent-gate.tsx` renders no links at all. Pre-existing, shipped in 013.

---

## 2026-07-29 — Hosted email templates sync from the repo, via a template-only Management API PATCH

**Status**: Accepted. Addresses #189's mechanism half; **#189 stays open until the mechanism has
actually run** (see the required steps at the end of this entry). Branch `fix/email-template-sync`.

**Decision**: `supabase/templates/{confirmation,recovery}.html` and their subjects are published to
the hosted Supabase project by CI. `.github/workflows/sync-email-templates.yml` fires on a push to
`main` touching `supabase/templates/**` or `supabase/config.toml`, plus `workflow_dispatch`, and runs
`scripts/sync-hosted-email-templates.mjs`. That script sends **one PATCH** to
`https://api.supabase.com/v1/projects/excukdzjudslbqmkysrc/config/auth` carrying **exactly four
fields**:

| field | source |
| --- | --- |
| `mailer_subjects_confirmation` | `supabase/config.toml` `[auth.email.template.confirmation].subject` |
| `mailer_subjects_recovery` | `supabase/config.toml` `[auth.email.template.recovery].subject` |
| `mailer_templates_confirmation_content` | the file named by that table's `content_path` |
| `mailer_templates_recovery_content` | ditto, recovery |

It then `GET`s the config back and **fails the run** if any of the four did not apply.

**Why a template-only PATCH, and why `supabase config push` was rejected.** `config push` sends the
whole `[auth]` block — including `site_url` and `additional_redirect_urls`, which in this repo point
at `localhost:3000` for local development. Pushing that to production would break every emailed
confirmation and recovery link in the product. The PATCH is strictly narrower: the request body has
**no required fields** (verified on `UpdateAuthConfigBody` in the published OpenAPI spec at
`api.supabase.com/api/v1-json`, which is also where the four field names above come from — they were
read, not guessed), so a field that is not in the body is a field that cannot be touched. There was
nothing to gain from testing `config push` once the narrower mechanism was verified to exist.

**Read-back verification is the point, not a nicety.** #189 was not "the templates were wrong", it
was "the templates were wrong and nothing noticed for weeks". A 200 from the PATCH is not treated as
evidence; the script re-reads all four fields and reports the first differing offset with context
from both sides. Up to three read-backs, three seconds apart, cover propagation lag only — the last
one still fails the run.

**This is what makes `wordmark-sync.test.ts` mean something.** That test reads
`supabase/templates/*.html` off disk. Before this change it could only prove the repo agreed with
itself, which is precisely how the two-colour wordmark passed CI for weeks while production rendered
one colour. Now that the repo is the thing that pushes, the disk state it asserts on *is* the hosted
state. The test did not change; what changed is that it became enforcement rather than a tautology.
That is the substance of this decision, not a side effect of it.

**Accepted risk: the token is account-wide.** Supabase issues **no project-scoped Management API
tokens** — a personal access token can reach every project on the account. That is a real widening
of blast radius and it is accepted knowingly, not overlooked. The controls:

- **One action, pinned to a commit SHA.** Every action in a job can read that job's secrets, so the
  list is exactly one — `actions/checkout` at `11d5960a…` rather than a mutable `@v4` tag.
  Everything else is the runner's own Node. A second action here re-opens the question.
- **No PR-triggered event, enforced by test.** The `…_target` variant runs with the base repo's
  secrets against an untrusted head ref, which would hand the token to anyone who can open a PR.
  `apps/web/tests/unit/ops/hosted-email-template-sync.test.ts` asserts the substring appears
  **nowhere in the workflow file** — a whole-file check rather than a structural one, because YAML
  structure can be walked around and a substring cannot.
- **The project ref is a hardcoded constant, not a parameter**, pinned by that same test. Given an
  account-wide token, a caller-supplied ref is a wrong-project write waiting to happen.
- **`permissions: contents: read`.** The job writes nothing back to GitHub.
- **Fail-before-send.** The payload is built — config parsed, both templates read — before the token
  is even looked at. A missing or unparseable input aborts with nothing sent, because a PATCH
  carrying one of two templates is a silent, successful, half-applied deploy.

**Rotation expectation**: the PAT is created with a **90-day expiry** and rotated at expiry, or
immediately on any suspicion of exposure. Rotation is a two-step operator action — mint a new token
in the Supabase dashboard, update the `SUPABASE_ACCESS_TOKEN` repository secret, revoke the old one —
and needs no code change. When the workflow starts failing with a 401, an expired token is the first
thing to check.

**The TOML reader is 20 lines and deliberately narrow.** The subjects stay in `supabase/config.toml`
and are read from it; restating them in the workflow would recreate, one layer up, the exact drift
#189 is about. No TOML dependency was added: the reader accepts only a plain double-quoted scalar on
its own line inside the named table, and **throws** on anything else rather than mis-parsing a value
into a subject line that then reaches production. It also refuses a `content_path` outside
`./supabase/templates/*.html`. In a workflow holding an account-wide token, a reader that refuses
what it does not understand beats a dependency that accepts everything.

**Unverified on merge, stated plainly.** The end-to-end push has never been executed — it targets
production and the secret did not exist when this was written. Everything short of the network is
unit-tested; the first real run is a manual `workflow_dispatch`. The merge does not fire it: the path
filter covers only `supabase/templates/**` and `supabase/config.toml`, and this change touches
neither. The workflow file and the script are **deliberately absent** from that filter for the same
reason — listing them would make the merge that introduces or edits the mechanism auto-fire a
production write instead of leaving a watched manual run.

**The PR references #189 without a closing keyword, deliberately.** Merging would otherwise close the
issue on the strength of something that has not happened — which is the same species of
claim-without-evidence that produced #189 in the first place. #189 and its BACKLOG entry are closed
together, by hand, after the steps below.

**What this mechanism CANNOT catch, and the required human step.** The read-back proves the four
fields *arrived*. It says nothing about whether they are *correct*. A template that is malformed but
still valid HTML — a broken `{{ .ConfirmationURL }}` interpolation, a table that collapses in
Outlook, a dark-block rule that no longer reaches the wordmark — applies cleanly, returns 200,
matches byte-for-byte on the read-back, and breaks every signup email in production. Byte equality
between repo and hosted is the *only* claim this mechanism makes; "the email is good" is a strictly
larger claim and no automated check in this repo establishes it.

**Therefore: a real signup email, received and read by a human, is a required step after any run
that changes a template — not an optional sanity check.** It is the only thing standing between a
green workflow and a broken production email, and it is written down here precisely so it does not
survive only as something someone remembers to do. The first such check follows the first dispatch;
#189 does not close before it.

**Line endings, noted because it surprises.** The repo has no `.gitattributes` and the authors work
on Windows with `core.autocrlf=true`, so the templates are CRLF in a Windows working tree and LF in
git (4966 vs 4895 bytes for `confirmation.html`). The Linux runner checks out LF, so what lands on
hosted is byte-identical to the git blob. Running the script from a Windows shell would publish the
CRLF form — harmless for HTML, but it is why CI is the intended caller.

---

## 2026-07-29 — The recovery hedge stays, the checkout pin moves to v7, and Gmail dark mode is left alone

Three unrelated decisions that shipped on one branch (`fix/reset-copy-and-ci-pin`). Recorded
separately below.

### The `/forgot-password` hedge is security theatre, and it stays anyway

**Do not "simplify" the sent-state copy to "We've sent you an email."** The conditional phrasing —
*"If &lt;email&gt; is registered, we've sent a link to reset your password"* — looks like redundant
hedging and it is not.

**It is theatre, and that is stated plainly here so nobody has to rediscover it.** As an
anti-enumeration control the hedge protects nothing. `signup-form.tsx` answers the same question
outright — *"This email already has an account. Sign in, or reset your password."* — unauthenticated,
with no password required. Anyone who wants to test an address against the user list uses signup, not
recovery. `docs/security/02-auth-cookies-broadcast.md` records that disclosure as
**intentional and not flagged**: the standard signup-form trade-off, since the visitor supplied the
address and needs actionable guidance.

**So the reason to keep it is no longer secrecy. It is accuracy.** `requestPasswordReset` always
returns `{status:"ok"}` and swallows every Supabase error (FR-007), so the application genuinely does
not know whether an email went out. An unconditional *"We've sent you an email"* would therefore be a
claim the server cannot support — false for exactly the case that prompted this change, an address
whose account had been deleted. The hedge is the honest sentence, independent of what it hides.

Three further reasons it is not worth "cleaning up":

- **It is already correct if the signup posture ever tightens.** Open-signup posture is tracked as a
  separate axis. If disclosure at signup is ever closed, recovery is already right; removing the
  hedge now creates work then.
- **Changing one surface silently de-syncs three.** Signup discloses, login does not, recovery does
  not. That split is deliberate and documented. Editing recovery alone leaves a posture nobody chose.
- **The cost of keeping it is one subordinate clause.**

**What was actually wrong, and was fixed.** Not the hedge — two honesty defects sitting next to it:

1. The OTP helper asserted *"The email also includes a 6-digit code"*, a definite claim contradicting
   the hedge nine lines above it on the same screen. Now *"If it arrives, it also includes…"*.
2. A dead end. An address with no account could enter codes indefinitely; every attempt returned
   *"That code didn't match. Try again, or request a fresh email"*, looping back to a mailbox nothing
   was sent to. The sent state now carries an exit to `/signup`, phrased as a condition rather than a
   verdict, so it reads identically to someone who does have an account.

Both are pinned by `apps/web/tests/unit/forgot-password-copy.test.tsx`, which also guards the two
properties that must not regress: the hedge stays, and nothing on the surface resolves which case the
reader is in. The e2e specs that touch this copy cannot run (#208), which is why the coverage is a
unit test.

### `actions/checkout` moves from v4.4.0 to v7.0.1

`11d5960a…` (`v4` / `v4.4.0`) declares `runs.using: node20`, which GitHub now forces onto Node 24 with
a deprecation warning. The pin is now `3d3c42e5aac5ba805825da76410c181273ba90b1` (`v7` / `v7.0.1`,
`runs.using: node24`).

**v7 rather than v5, to avoid bumping this again.** Every breaking change between v5 and v7 is scoped
to fork-PR checkout under `pull_request_target` / `workflow_run` — the `allow-unsafe-pr-checkout`
default flip backported into v5.1.0 and v6.1.0, and the fork-PR block in v7.0.0 — or to a runner
minimum (v5 → 2.327.1; v6 → 2.329.0, and only for Docker container actions). This workflow triggers on
`push` to `main` and `workflow_dispatch`, performs a bare checkout with **no inputs**, and forbids
`pull_request_target` outright, enforced by a whole-file substring assertion in
`apps/web/tests/unit/ops/hosted-email-template-sync.test.ts`. None of the breaking changes can reach
it. The runner is GitHub-hosted `ubuntu-latest`, far past both minimums.

**Verified against the tag list and the action manifest, not the version string.** Both SHAs were
resolved through `git/matching-refs/tags` and their `action.yml` `runs.using` values read at that
exact ref. That test asserts `/^actions\/checkout@[0-9a-f]{40}$/` — SHA *shape*, not SHA *value* — so
it stays green across this bump by design, and no test goes red on it. The empirical `node20 → node24`
check is the evidence.

**The 2026-07-29 entry above still reads `11d5960a…` / `@v4`. That is intentional.** This log is
append-only; that entry records what was true when it was written, and this one supersedes it.

### Gmail dark mode: not fixable, not a defect, left alone

**Do not add Gmail-specific dark-mode hacks to `supabase/templates/*.html`.** A confirmation email
renders light in a Gmail client set to dark mode. This is a client limitation, not template drift —
the workflow's read-back proves hosted is byte-identical to the repo, and the
`@media (prefers-color-scheme: dark)` overrides `wordmark-sync.test.ts` asserts are present in what
Gmail received.

Google's own [CSS support reference](https://developers.google.com/workspace/gmail/design/css)
enumerates the supported media queries — `min-width`, `max-width`, `min-device-width`,
`max-device-width`, `orientation`, `min-resolution`, `max-resolution` — and `prefers-color-scheme` is
absent, as is any mention of dark mode. That is an absence from an enumerated list rather than an
explicit denial, and it is the strongest vendor signal available. caniemail marks it supported across
all four Gmail clients, but that is a community-maintained database whose Gmail entry was last tested
2023-03-08, and it is contradicted by both the vendor list and direct observation. Gmail web darkens
its own chrome and leaves the message body light; Android partially darkens; iOS often full-inverts.

**The overrides are not losing to Gmail — they never reach it, and Gmail exposes no targetable hook.**
They do pay off on Apple Mail, iOS Mail, Outlook 2019+, Samsung Mail and Thunderbird, so the dark
blocks and their tests stay. Every available workaround (bulletproof table layering, transparent-PNG
logos, inversion-tuned colours) fixes one Gmail client while risking the others and cannot be verified
without a real-device matrix. A legible email with a mild aesthetic mismatch does not justify that.

---

## 2026-07-29 (fifth pass) — `CLAUDE.md` and `AGENTS.md` get a mirroring contract, and one divergence is marked deliberate

**Status**: Accepted.

Two agents read this repository — Claude Code via `CLAUDE.md`, Codex via `AGENTS.md` — and
the files had drifted apart with nothing holding them together. `AGENTS.md` still pointed at
feature 012, still told Codex to navigate via a `graphify-out/wiki/index.md` that has never
existed, still described `graphify-out/` as expected-dirty working files when it is gitignored,
and still claimed Codex handled **all** git operations with Mohamed's only step being the
squash-merge click — which had not been true for a long time. Meanwhile the three rules with
the sharpest teeth lived only on the Claude side, so a Codex session was bound by none of them.

### The mirroring contract

Both files now carry the same clause: **a change to a shared rule in one requires the same
change in the other, in the same PR.**

Shared, and therefore synchronised: commit and PR conventions, git workflow, branch naming,
security and privacy invariants, the backlog ↔ issues contract.

Agent-specific, and free to differ: harness and tool config, skill names and invocation
syntax, which SpecKit surface the agent drives, and the design-skill split below.

The alternative — one shared file with a thin per-agent shim — was not taken. Each harness
discovers its own filename by convention, the agent-specific halves are substantial rather
than incidental, and a symlink or include is not portable across both. A stated contract that
a human reviewer can check in a diff is the cheaper instrument, and the drift being fixed here
was never caused by the two files being separate — it was caused by nothing saying they had
to agree.

### The design-skill divergence is deliberate

`CLAUDE.md`'s user-level counterpart routes all UI work through `hallmark` and **forbids**
stacking `frontend-design` or `responsive-design` on top of it, because Hallmark encodes the
same source material with stricter responsive gates and the token systems contradict each
other. `AGENTS.md` tells Codex to use `frontend-design`, `ui-ux-pro-max`, and
`responsive-design`.

**This stays. Hallmark is not installed for Codex**, so the Claude-side prohibition has no
Codex-side equivalent to attach to — removing Codex's three skills would leave it with no
design guidance at all. It is now marked as such in `AGENTS.md` §Skills, so a future audit
reads it as a decision rather than as drift and does not "reconcile" it. **If Hallmark is ever
installed for Codex, that note is the trigger to revisit the split.**

### Branch naming is written down for the first time

The only branch-naming rule the repo had was the SpecKit validator at
`.specify/extensions/git/`, which *requires* a `NNN-` or timestamp prefix — and the last
several branches (`fix/otp-success-hold`, `fix/navbar-chrome-and-active-state`,
`chore/smoke-test-scripts`) all violate it. They were right and the written rule was wrong,
because it only ever described SpecKit feature branches.

Both halves are now stated in both files: SpecKit features are `NNN-feature-slug`; everything
else **must not** match `[0-9][0-9][0-9]-*`, because that prefix makes CI run a doubled check
list on a PR into `main`. **The validator itself is untouched** — it fires only when a
`/speckit.git.*` command runs, which is exactly the case where the first half applies. Widening
it to know about typed prefixes would mean teaching it a rule it has no occasion to enforce.

### Also: the stale local memory that contradicted all of this

Claude Code's project memory still carried `serenify-commit-coauthors.md`, instructing every
session to append `Co-authored-by:` trailers to every commit — the exact rule rescinded in the
second-pass entry above. It loaded on every session start, so each session began holding two
opposed instructions on the same subject. Deleted from disk and from the memory index. It is
local-only and outside the repository, so this change leaves no trace in the diff; it is
recorded here because the contradiction is the reason the mirroring contract was worth writing.

---

## 2026-07-29 — Foggy is Ren's identity colour (constitution Amendment 18)

**Status**: Accepted. Ratifies practice that already shipped.

**Decision**: Ren's mark is filled `foggy` in both modes at every site that renders it,
and `RenAvatar`'s `color` prop — the mechanism that let a call site decide otherwise — is
removed. More generally, a mark identifying a persistent non-human entity MUST NOT use an
accent that carries band or outcome meaning (`meadow`, `amber`, `crimson`). Separately and
narrowly, the primary forward action inside Ren's chat surface may be filled `foggy`
rather than `meadow`.

**Rationale**: `meadow`, `amber` and `crimson` are the stress-band and outcome accents. A
mark wearing one of them encodes a reading it does not have — a meadow Ren sitting beside
a stress readout looks like it is asserting that readout is calm, which is precisely the
kind of accidental claim Principle I's honesty rule exists to prevent. `foggy` is the only
accent outside the band scale, so Ren can appear next to any reading without being read as
a state.

This was already the landing page's behaviour. Feature 013 shipped a foggy Ren through the
`color` prop as an approved liberty under FR-022, and flagged it for review in ST-4
specifically because foggy's registered role is attention. The flag is now resolved in the
direction the practice already went, rather than being reverted.

**Why the prop had to go rather than just be re-pointed**: one component was already the
single *definition* of the mark, but it was not a single *appearance* — the chat surface
passed nothing and got meadow, the landing page passed foggy. That is the drift the
extraction was supposed to prevent, arriving through the escape hatch the extraction left
open. A rule that says "always foggy" alongside a prop that says "unless you'd rather not"
is not a rule. Foggy is now structural.

**The chat-surface exception, and its limits**: with a foggy Ren in the header, a lone
meadow send button reads as a mistake rather than as emphasis — the same cohesion problem
that drove the calibration flow rework. Amendment 18 permits foggy for the primary action
**inside Ren's chat surface only**, as one named exception. It does not generalize:
`meadow` remains the required fill for primary and forward actions on every other surface,
and a future surface wanting this treatment needs its own amendment, not a reading of this
one. No other control anywhere in the product was recoloured.

**Contrast**: measured, not assumed. Filled foggy with `--color-on-accent` is **5.33:1** in
light and **8.34:1** in dark — both clear AA, and both better than the meadow the send
control replaced (4.78:1). No regression.

**Registered along the way**: `--color-on-accent` and `--color-scrim` are now named in
Principle V's palette for the first time. Both shipped in feature 007 and have been in use
since, but the palette is declared "locked, no additions without amendment" and never
admitted they exist. Amendment 17 identified the gap and deferred it to "whichever
amendment next touches Principle V"; this is that amendment, and the identity-mark rule
cites `--color-on-accent` directly, so leaving it unregistered would have the constitution
name a token its own palette denies. Documentation only — neither value changed. Closes
GitHub issue #155.

**Not done here, deliberately**: Ren has no typing indicator today (`isSending` in
`chat-shell.tsx` only disables the composer; the assistant message appears atomically), so
the new `thinking` state has nothing to drive yet. Wiring it would mean adding a
placeholder row to the message list — a new element, not a reskin — and is left as
follow-up. Four surfaces where Ren arguably belongs but does not appear (assistant message
rows, the pill launcher, recent-chat rows, landing thread bubbles) are likewise left alone.

**Cross-references**: `.specify/memory/constitution.md` Amendment 18 (1.13.0 → 1.14.0);
`docs/CHANGELOG.md` 2026-07-29; `apps/web/components/chat/ren-avatar.tsx`;
`docs/DECISIONS.md` 2026-06-17 (filled-accent CTA foreground) and 2026-07-24
(Amendment 17, which logged the token gap).

---

## 2026-07-30 — Ren's chat surface goes foggy as a whole (constitution Amendment 19)

**Status**: Accepted. Widens the exception recorded one day earlier in the 2026-07-29 entry.

**Decision**: Ren's chat surface takes `foggy` across every accent-carrying element —
sent-message bubbles, primary actions, accent text links, focus indicators — and the
treatment is a CONSISTENCY REQUIREMENT rather than a per-control permission. The exception
also extends to controls whose sole purpose is to open Ren: today the floating chat pill.

**Rationale**: Amendment 18 wrote the exception at the level of a single control ("the
primary forward action (the composer's send control)"). Shipping it exposed that as the
wrong level. Recolouring the send control alone left eight other meadow elements on the
same screen — the message bubbles, the "Say hello" empty-state button, the composer focus
ring, the "Open full history" link, the "Try again" and end-chat links, the rename input's
focus border, and the pill panel's two header controls. Each then read as exactly the
defect the exception was written to prevent. The reasoning was always cohesion across a
surface; only the wording was pitched at a control.

**Why the pill came too**: it exists only to open Ren, and after Amendment 18 a meadow pill
opened a foggy panel — the same incoherence one level out. The permission is written to
reach the CONTROL and not its host: a dashboard carrying a foggy Ren pill keeps meadow for
its own actions. That boundary is what stops this from becoming general licence, and it is
stated explicitly in the amendment rather than left to be inferred.

**Why this is a widening and not a correction**: recorded plainly because rewriting an
exception a day after adding it looks like churn otherwise. Nothing about Amendment 18 was
wrong on the merits — foggy Ren, foggy send control, non-generalizing scope all stand. What
changed is the unit the rule is written in. That only became visible by applying it.

**No new token, and notably no `--color-foggy-text`**: the meadow role needed a deepened
`--color-meadow-text` sibling because raw meadow reads 4.61:1 as small text on surface,
marginal for AA. Raw foggy reads 5.15:1 light and 7.68:1 dark and needs no such companion,
so the accent text links consume `--color-foggy` directly. The palette is untouched.

**Contrast — every ratio improved on the meadow it replaced**, measured not assumed:
focus rings 4.22 → 4.71 light and 7.43 → 8.34 dark (both far past the 3:1 an indicator
needs); accent text links 5.76 → 5.15 light and 7.68 dark (both clear AA small text); the
pill's dark outlined chip 6.8 → 7.68; filled surfaces 4.78 → 5.33 light and 8.34 dark. No
AA regression at any site. The pill's light-fill / dark-outline inversion is unchanged in
shape — a fill in dark washes the near-white text out regardless of hue, so the outline
stays.

**Unchanged and deliberately so**: `meadow` remains the required fill for primary and
forward actions on every other surface, and its calm/affirmative role is untouched. No
control outside Ren's chat surface and its launcher was recoloured.

**Cross-references**: `.specify/memory/constitution.md` Amendment 19 (1.14.0 → 1.15.0) and
Amendment 18 (the bullet it replaces); `docs/CHANGELOG.md` 2026-07-30; `docs/DECISIONS.md`
2026-07-29 (Amendment 18); `apps/web/components/chat/chat-shell.tsx`;
`apps/web/components/chat-pill.tsx`.

---

## 2026-07-29 — Launch video: Remotion, at `video/`, outside the npm workspaces

**Status**: Accepted.

**Decision**: The ~60s LinkedIn launch video is built with Remotion (React → MP4).
The project lives at `video/` in the repo root, **outside** the root
`workspaces: ["apps/*", "packages/*"]` globs, with its own `package-lock.json`
and its own `node_modules`. No CI change accompanies it. The beat sheet — the
source of truth for the video — is `docs/video/serenify-launch-video-beat-sheet.md`.

**Rationale for Remotion**: the video's product screens are the *real*
`apps/web` components, animated, rather than hand-redrawn mockups. That is the
entire reason to accept a React video toolchain over an editor. A screen that
drifts from the app is a screen that has to be re-drawn every time the app
changes; a screen that imports the component cannot drift.

**Rationale for the location**: putting it under `apps/` or `packages/` would
fold ~270 Remotion packages into the root lockfile, so every `npm ci` — including
CI's, before it lints `apps/web` — would install a video toolchain to run unit
tests, and `node_modules` would re-hoist for everyone working on `apps/web` or
`apps/api`. Outside the globs, the root lockfile is byte-unchanged and the cost
is one extra `npm install` for whoever actually works on the video.

**Why no CI change was needed**: all three jobs in `.github/workflows/ci.yml` are
already scoped — `speckit-skills guard` reads `.claude/` and `.gitignore`, `web`
runs everything through `-w apps/web`, `python` runs inside `apps/api` and
`packages/ml-video`. None globs the repo root. Root `tsconfig.json` includes only
`scripts/**/*.ts`; root `vitest.config.mts` only `scripts/__tests__/**`. The
directory is invisible to every existing task, which was verified by running
them rather than assumed.

**The load-bearing check, and it passed**: a real `apps/web` component
(`components/brand/wordmark.tsx`) renders inside a Remotion composition with its
real Tailwind v4 `@theme` tokens — `#EAEBEC` background, `text-ink` on `seren`,
`text-meadow-text` on `ify`, `lowercase` enforced, Outfit typeface. If this had
failed the tool choice would have been void, so it was verified on a rendered
frame and not on a clean exit code. `<Wordmark />` was chosen as the probe
because it fails visibly rather than subtly.

**Three pieces make that work** (`video/remotion.config.ts`,
`video/src/tailwind.css`): the app's own `@` → `apps/web` alias, which webpack
otherwise knows nothing about; `react`/`react-dom` pinned to `video/`'s copies,
because a file under `apps/web` would otherwise resolve React by walking up to
the root hoisted copy and put two instances in one bundle; and Tailwind through
`@remotion/tailwind-v4` with a CSS entry that imports `apps/web/app/globals.css`
verbatim. No palette is re-declared for the video — the tokens are the shipped
app's, so the video follows the app rather than drifting from it.

**Known limits, recorded now so they are not rediscovered**: components importing
`server-only` or reading Supabase / `next/headers` at module scope will not
bundle; `next/font` does not exist under Remotion, so font tokens need
`@remotion/google-fonts` (see `video/src/WebComponentProbe.tsx`); `next/image`
and `next/link` will need shimming when a component reaches for them.

**Licensing**: Remotion's free tier covers this use — individuals and non-profit;
no company exists here. Decided by Mohamed, 2026-07-29.

**Cross-references**: `video/README.md`;
`docs/video/serenify-launch-video-beat-sheet.md`; `.github/workflows/ci.yml`.

---

## 2026-07-29 — Remotion agent skills installed at project scope, in both agent trees

**Status**: Accepted. Extends the same-day Remotion entry above.

**Decision**: Seven of Remotion's eleven upstream agent skills
([remotion-dev/skills](https://github.com/remotion-dev/skills), `4.0.501` tree)
are installed at **project scope** — committed to the repo — as byte-identical
real directories under **both** `.claude/skills/` (Claude Code) and
`.agents/skills/` (Codex, per `AGENTS.md` § Skills).

Installed: `remotion-best-practices` (the router), `remotion-markup`,
`remotion-create`, `remotion-render`, `remotion-docs`, `remotion-captions`,
`remotion-multimedia`. Excluded: `remotion-maps`, `remotion-saas`,
`remotion-upgrade`, `remotion-interactivity`.

**Why project scope and not global**: a global install is invisible to the repo
and to everyone else working in it, and would silently disappear on a fresh
clone or a different machine. Committed skills travel with the branch.

**Why real copies rather than symlinks**: upstream's own
`scripts/sync-agent-skills.ts` symlinks `.agents/skills/<name>` into
`packages/skills/skills/<name>` and then symlinks `.claude/skills` at
`.agents/skills` wholesale. Neither survives a Windows checkout without
`core.symlinks`, and this repo's existing speckit skills are already dual real
copies in the two trees. Matching the existing pattern beats importing a
layout built for Remotion's own monorepo. The cost is that the two trees must be
edited together, which `video/README.md` and both instruction files say
explicitly.

**`remotion-markup` was initially excluded and that was reversed before merge**,
recorded because the reasoning generalises: it was filtered out on its NAME,
which reads as HTML/markup-language. Its actual description is "content,
animation and effects best practices" and it ships `sequencing.md`, `timing.md`,
`transitions.md`, `multi-scene-video.md`, `text-highlights.md`, `voiceover.md`
and `google-fonts.md` — the beat sheet's material almost line for line. Two
skills that WERE selected (`remotion-create` and the router) link into it, so
excluding it would also have broken links from the chosen entry points. Upstream
skill names are not reliable descriptions of contents; read the directory.

**Two deliberate divergences from upstream, both reversible and both recorded**:
upstream ships the router with a full nested copy of every other skill, linked as
`<name>/REFERENCE.md`, which does not fit a flat `skills/` layout. So (1) the
router's links were flattened to `../<name>/SKILL.md` and the four uninstalled
skills' sections were deleted rather than left dangling — section bodies are
otherwise upstream's, unedited; and (2) six links from installed files into
uninstalled skills (four to `remotion-interactivity`, two to `remotion-maps`)
were flattened to plain text marked `(skill not installed in this repo)`, and
`remotion-markup`'s embedded 569 KB copy of `remotion-maps` was stripped.
Verified after install: zero dangling internal links in either tree.

**Scope discipline**: these skills carry Remotion's conventions and are scoped to
`video/`. They say nothing about `apps/web` or `apps/api`, and in particular must
not override the `hallmark` routing rule for UI work. Stated in both `CLAUDE.md`
and `AGENTS.md`.

**No CI or lockfile impact**: the skills are markdown only. Root
`package-lock.json` and `video/package-lock.json` are both unmodified, and the
`speckit-skills guard` job — which asserts the fifteen `speckit-*` skills exist
and that `.gitignore` does not broadly ignore `.claude/` — still passes.

**Cross-references**: `video/README.md` § Agent skills; `CLAUDE.md` § Remotion
skills; `AGENTS.md` § Skills; PR #223.

---

## 2026-07-29 — `remotion-interactivity` installed as a link target; hand-edits cut to one file

**Status**: Accepted. Amends the entry immediately above (same day), which
recorded `remotion-interactivity` as excluded and six links hand-flattened.

**Decision**: `remotion-interactivity` is installed after all — eight skills, not
seven — and the four links into it are restored to upstream form. The two links
into `remotion-maps` stay flattened; `remotion-maps` stays out.

**Rationale, and it generalises**: the skill was excluded on its merits and that
judgement still holds — Studio drag-to-position editing is not how this video is
authored. But excluding it cost four hand-edits across three files
(`remotion-create/SKILL.md`, `remotion-markup/SKILL.md`, `cropping.md`,
`text-highlights.md`), and every hand-edit is a re-application at every upstream
sync, forever. At 7.7 KB the skill is cheaper to carry than the divergence it
avoids. **The operative rule is now: when a link would dangle, install the target
rather than hand-edit the file** — recorded in `CLAUDE.md`, `AGENTS.md` and
`video/README.md`.

**Why `remotion-maps` is the one exception**: 569 KB of Cesium/Mapbox/GeoJSON 3D
flyover assets against two hand-edits in a single file, plus a permanent entry in
both agents' skill listings for a capability this video will never use. That
trade goes the other way.

**Restored by re-copying from upstream, not by reverting the sed**, so the four
files are provably byte-identical to the `4.0.501` tree rather than
approximately so.

**Result**: exactly two files diverge from upstream —
`remotion-best-practices/SKILL.md` (nested-to-flat link rewrite plus three
dropped sections; **unavoidable in a flat layout**, and it would persist even at
a full eleven-skill install) and `remotion-markup/SKILL.md` (the two maps links,
and its stripped embedded copy of `remotion-maps`). Every other installed file is
byte-identical. Verified: zero dangling internal links in either tree, and the
`.claude` and `.agents` trees are `diff -r` clean against each other.

**No CI or lockfile impact**, unchanged from the entry above: markdown only, both
lockfiles untouched, `speckit-skills guard` still passes.

**Cross-references**: `video/README.md` § Agent skills; `CLAUDE.md`; `AGENTS.md`;
PR #223.

---

## 2026-07-30 — Launch video: the character base is Avataaars, and the licence is MIT

**Status**: Accepted.

**Decision**: the launch video's character (`video/src/greybox/character/`) is
built on a stripped [getavataaars.com](https://getavataaars.com) export —
Avataaars, by Pablo Stanley — shipped in this public repository and used in a
promotional video. The full notice, the measured landmark table and the two
deltas applied to the export live in `video/src/greybox/character/NOTICE.md`.

**Why this needed a decision at all**: the getavataaars.com site describes its
terms in plain English — free for personal and commercial use, no attribution
required — which is a *grant*, not a licence text. This repository is public, so
that is not a formality: a plain-English grant is not something to ship a derived
asset on.

**What was actually read**: the `LICENSE` file inside the
[`avataaars`](https://www.npmjs.com/package/avataaars) npm package (`2.0.0`),
which is the React implementation the web exporter is built on. It is **MIT**,
`Copyright (c) 2017 Pablo Stanley, Fang-Pen Lin`. MIT grants use, modification,
distribution, sublicensing and commercial use without restriction; its only
condition is that the copyright and permission notice travel with copies or
substantial portions.

**The export was tied to that package rather than only to the website.** Every
path in the shipped asset was checked byte-for-byte against `avataaars@2.0.0`:
the body/skin path (`avatar/index.tsx` + `Skin.tsx`), the shirt and its collar
shadow (`clothes/ShirtCrewNeck.tsx`), the hair (`top/ShortHairShortFlat.tsx`) and
the nose (`face/nose/Default.tsx`). All four match. So the asset is not merely
"from a site with friendly terms" — it is a derivative of MIT-licensed source,
which is a licence this repository can rely on.

**Compliance**: the notice is reproduced verbatim in
`video/src/greybox/character/NOTICE.md`, alongside the pristine `av2-base.svg`
and the `base.tsx` that inlines it. Nothing further is required — MIT asks for
no attribution in the video itself.

**Two deltas from the export**, both documented in `NOTICE.md`: the nose's
`fill-opacity` raised 0.16 → 0.27, and an authored shoulder extension (the
export's shoulders stop ~12% short of its own frame; scaling the shirt to fix
that would scale its crew neck with it).

**The office backdrop is authored in code, not sourced**, so **no unDraw licence
entry is incurred**. unDraw was the declared fallback if a code attempt did not
come together; it did. Recording the road not taken because unDraw's terms
reportedly forbid use as AI/ML training data — irrelevant to decorative video
use, but Serenify is an ML product in a public repo, so if it is ever adopted it
gets its own entry here.

**Cross-references**: `video/src/greybox/character/NOTICE.md`;
`docs/video/serenify-launch-video-beat-sheet.md` § The character rig.

---

## 2026-08-05 — Correction: `proxy.ts` runs on the Node.js runtime, not the Edge runtime (#202)

**Status**: Correction (append-only). The 2026-05-25 security-slice-5 entry ("the
Node `crypto.randomBytes` import is unavailable in the Edge runtime the middleware
runs in") is **not** rewritten; this entry records that its runtime premise is now
**stale**. Same append-only idiom as the 2026-06-25 correction to DECISION-20.

**What changed since it was written**: Next 16 renamed `middleware.ts` to
`proxy.ts` **and changed its default runtime from Edge to Node.js** (installed-package
docs: `node_modules/next/dist/docs/.../proxy.md` — "Proxy defaults to using the
Node.js runtime", listed under the v16.0.0 changes). `apps/web/proxy.ts` sets no
`runtime` override, so it runs on Node.js. The Edge-runtime reasoning was accurate
when written (pre-16 middleware) and is preserved as history.

**What this does and does not change**:

- The nonce code **stands unchanged**: `crypto.getRandomValues(new Uint8Array(16))`
  is the global Web Crypto API and runs identically on both runtimes. Only its
  *justification* ("because `node:crypto` is unavailable") is stale — `node:crypto`
  would work in `proxy.ts` today. No code change is warranted for #202; the pick
  also isn't revisited here (the Web-Crypto call is runtime-portable, which is a
  property worth keeping for free).
- The in-memory rate-limit option in `docs/security/07-rate-limits-and-parity.md`
  keeps its verdict: a per-instance `Map` still does not survive across serverless
  instances on the Node runtime; only the "Edge" naming was stale.
- "Sole **edge** gate" phrasing (07 §traced-path) meant "outermost request gate",
  which `proxy.ts` remains — reworded at the source to say so without the runtime pun.

**Where the fixes landed**: `apps/web/proxy.ts:52-60` already carried an in-file
"Correction 2026-07-28" (PR #204). This pass corrects the three remaining doc
sites: the slice-5 entry above (via this correction), and direct dated edits in
`docs/security/05-csp-header.md` (§Deviations) and
`docs/security/07-rate-limits-and-parity.md` (§Implementation options, §Traced path).
`specs/001-auth-and-roles/*` is deliberately untouched — it records feature 001 as
built, pre-Next-16, and was accurate when written.

**Cross-references**: GitHub issue #202; `docs/BACKLOG.md` (#202 entry, resolved
this date); Next 16 upgrade entry earlier in this file.

---

## 2026-08-05 — Constitution Amendment 20: the two-token boundary split lands #209 (approved by Mohamed)

**Decision**: fix #209 as the two-token split its scope-corrected BACKLOG entry prescribed,
not the bare deletion the original issue described. Mohamed approved the amendment text and
the token values explicitly this date, after a side-by-side comparison of the review-settled
values against the only in-palette alternative.

**What was decided, and why each way**:

1. **The self-reference is deleted** (`--color-border: var(--color-border)` in
   `@theme inline`) — the original one-line diagnosis stands; it was the accident, not the
   design.
2. **`--color-control` enters the Graphite palette** (light `#7D8083`, dark `#6C7074`) via
   Amendment 20 (1.15.0 → 1.16.0, MINOR — the Amendment 5 sub-token precedent). The
   in-palette alternative (`--color-muted` doing border duty at 5.6–6.3:1) was considered
   and shown side-by-side; the settled values won on weight — a calm hairline just above
   the 3:1 bar rather than a text-gray at double it.
3. **`--color-input` re-points to the control token.** shadcn's `input` semantic IS a
   form-control border; the outline Button follows automatically.
4. **The Card primitive states `border-border` explicitly.** Tailwind v4's bare `border`
   defaults to `currentColor`; once the seams lightened, ink card outlines read as a
   regression the fix itself caused, so cards join the seam system in the same change.
   Scoped to `ui/card.tsx` only — no hunt for other bare border utilities.
5. **The questionnaire option tiles keep the seam token** — filled, text-bearing
   button-tiles whose affordance is fill + text, not an empty box.

**Sequencing honoured**: after #211 (closed 2026-07-29), per the one-way dependency the
BACKLOG entry recorded — the split regresses no focus signal.

**One recorded surprise**: Chromium paints the consent checkbox natively — author borders
compute to 0 px on it, so the UA box (clearly visible in both schemes) is the real
affordance there, not our token. The control token stays on it for engines that do paint
author borders; if the checkbox is ever restyled `appearance:none`, the token is already
correct. This surprise does not weaken the amendment: the OTP boxes and every text input
are CSS-painted and measurably carry the 3:1 values (live computed-style probes, both
modes).

**Out of scope, noted while here**: #208 was live-confirmed during the visual sweep — the
Playwright globalSetup died on `42501 permission denied for table profiles` exactly as
that issue predicts. Untouched; it remains its own decision.

**Cross-references**: `.specify/memory/constitution.md` Amendment 20;
`docs/CHANGELOG.md` 2026-08-05; `docs/BACKLOG.md` #209 (resolved this date);
GitHub #209, #211; PR #240 (pass A of the same triage).
