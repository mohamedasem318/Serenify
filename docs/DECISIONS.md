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
