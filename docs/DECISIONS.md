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
