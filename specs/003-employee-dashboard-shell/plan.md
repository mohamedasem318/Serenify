# Implementation Plan: Employee Dashboard Shell

**Branch**: `003-employee-dashboard-shell` | **Date**: 2026-05-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-employee-dashboard-shell/spec.md`

## Summary

This feature replaces the bare `/app` placeholder shipped by feature 001
with the actual authenticated employee surface: a persistent header
(logo, center nav, theme toggle, reserved talk slot, profile avatar/
dropdown), a Home page (welcome banner + three skeleton cards in a
60/40 primary-plus-secondary layout), an `/app/account` page (five
stacked sections), a visual-only persistent chat pill, a reusable
notification toast/sheet component, and a one-screen role placeholder
for team_lead / admin that preserves the role-routing contract from
feature 001 while replacing its placeholder copy.

The technical work falls in three streams:

1. **Refactor**: extract feature 001's bespoke auth form primitives
   from inlined page-file code into `apps/web/components/ui/auth/`
   without behavior change. Two of the five named primitives
   (`PasswordInput`, `RequirementsChecklist`) already live in
   `components/ui/`; they MOVE into the `auth/` subfolder so the
   forthcoming shadcn flat install does not collide with them. `Field`
   is still inlined in every (auth) form file and is the bulk of the
   extraction work.
2. **Foundation**: install `shadcn/ui` on the Tailwind v4 path against
   the existing Mist & Meadow tokens in `apps/web/app/globals.css`,
   migrate the dark-mode attribute from `data-theme` to `class` (the
   shadcn convention), set `next-themes`'s `storageKey` to
   `serenify-theme`, and pull in `framer-motion` for the notification
   component's motion.
3. **Shell**: build the header, profile dropdown, `/app` cards layout,
   `/app/account` sections, persistent chat pill, notification
   toast/sheet component, role placeholders, and the cross-tab auth
   listener at `apps/web/app/layout.tsx` (the root, not the (authed)
   subtree — per US 6 AS-1 the two tabs may both be at `/login` when
   propagation must fire).

All resolutions to spec-deferred decisions (FR-009 final subtitle copy,
FR-022 sign-out button styling, FR-027 export path, FR-032 toast/pill
gap, FR-044 Tailwind v4 + shadcn config, FR-053 theme persistence
mechanism, edge-case truncation lengths, role-placeholder copy) are
closed in this plan and enumerated in **§ Plan-Level Decisions** below
for one-shot review. Architectural decisions become entries in
`docs/DECISIONS.md` during `/speckit.implement` per Constitution
Principle VIII; this plan lists those entries explicitly in
**§ DECISIONS.md entries this plan implies**.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode (matches `apps/web`'s
existing pin). React 19.2.4 (already installed). Next.js 16.2.6
(already installed; the `proxy.ts` file convention from DECISIONS
2026-05-17 stays in force; per `apps/web/AGENTS.md` consult
`node_modules/next/dist/docs/` before applying training-data knowledge
of Next).

**Primary Dependencies**:

Already installed (`apps/web/package.json`, do not re-add):

- `next` 16.2.6
- `react` / `react-dom` 19.2.4
- `next-themes` ^0.4.6 (the v0.4.x the directive names; configured at
  `apps/web/app/providers.tsx`, currently with
  `attribute="data-theme"` — migrates to `attribute="class"` in this
  feature, see Decision C)
- `@supabase/ssr` ^0.10.3 and `@supabase/supabase-js` ^2.105.4
- `react-hook-form` ^7.76.0 + `@hookform/resolvers` ^5.2.2 + `zod`
  ^4.4.3 (reused for the account-page profile editor)
- `lucide-react` (already present; reused for header/dropdown icons)
- `tailwindcss` ^4 + `@tailwindcss/postcss` ^4 (Tailwind v4 is the
  current stack; the shadcn install follows the v4-specific path —
  see Decision A)

Newly added by this feature:

- `framer-motion` (latest stable, caret pin) — drives the notification
  component's entrance/exit motion and respects
  `prefers-reduced-motion` via Framer's `useReducedMotion` hook.
- shadcn primitives are vendor-pasted into the repo (the shadcn
  install model is a code generator, not a runtime dependency), so
  shadcn itself does not appear in `package.json`. Its transitive
  Radix UI primitives (`@radix-ui/react-dropdown-menu`,
  `@radix-ui/react-dialog`, `@radix-ui/react-avatar`,
  `@radix-ui/react-separator`) DO appear in `package.json` as
  `shadcn add` adds them. `class-variance-authority`, `clsx`,
  `tailwind-merge`, and `tw-animate-css` are also added by the
  shadcn init (replacing the now-deprecated `tailwindcss-animate`,
  per the shadcn Tailwind v4 docs).
- `tw-animate-css` — replaces `tailwindcss-animate` on the v4 path
  (the shadcn Tailwind v4 doc names this swap explicitly).

NOT used (decisions rejected, see Phase 0):

- `sonner` — rejected for the notification component because its
  toast paradigm does not fit the desktop-slide-in / mobile-bottom-
  sheet bifurcation FR-029 mandates. See Decision G.

**Storage**: Reuses `public.profiles` exactly as feature 001 shipped
it. The only column this feature reads/writes is `full_name`
(editable in the account page). `role` is read for the role-based
landing branch but never written by this feature. **No new migrations,
no new columns, no new RLS policies.**

**Testing**:

- **Vitest + React Testing Library** for component logic — header,
  profile dropdown, account sections, notification component (three
  configurations: desktop slide-in, mobile bottom sheet, reduced-
  motion). Uses `apps/web/vitest.config.mts` (`happy-dom` environment
  per DECISIONS 2026-05-17).
- **Playwright** for two new specs:
  - `employee-dashboard-shell.spec.ts` — the happy path: sign in →
    home → open dropdown → navigate to account → edit name → sign out.
  - `cross-tab-auth-sync.spec.ts` — two-page propagation spec per
    Decision N below.
  - Plus regression-only runs of feature 001's role-trio e2e and the
    `login-expired-link.spec.ts` from the hotfix (commit `8dc822b`) —
    both MUST pass unchanged (FR-036, SC-009). **Verified at plan
    time** (`2026-05-19`): the file
    `apps/web/tests/e2e/login-expired-link.spec.ts` exists on the
    branch's merge-base with `main`. If a future rebase ever loses
    it (it shouldn't — the hotfix is merged to main), the references
    in this plan and in `/speckit.tasks` must be dropped instead of
    asserted.

**Target Platform**: Next.js 16 App Router on Vercel; Tailwind v4;
modern evergreen browsers. Minimum viewport 360px per Constitution
Principle VI.

**Project Type**: Web (frontend in `apps/web/`). No backend changes
in this feature; the FastAPI app under `apps/api/` is not touched.

**Performance Goals**: SC-008 — cross-tab auth sync propagates within
2s under normal local conditions. SC-002 — theme toggle has no
visible flicker on flip (next-themes'
`disableTransitionOnChange` is already configured in providers.tsx
and is kept).

**Constraints**:

- **No red on affective and ambient surfaces** (Constitution
  Principle V; FR-042 scope-clarified per CHANGELOG 2026-05-20).
  shadcn's default destructive-button red is remapped to the new
  `crimson` Mist & Meadow token (`#7B4244` light, `#C17F81` dark)
  via the CSS-variable mapping in Decision B; the `destructive`
  variant is re-skinned, not removed, and is permitted on
  destructive action surfaces only.
- **Auth surfaces stay bespoke** (FR-040, FR-043). The (auth) page
  files (`/login`, `/signup`, `/forgot-password`, `/reset-password`,
  `/onboarding`) MUST render byte-equivalent to `main` after the
  primitives extraction — verified by the unchanged-pass of feature
  001's auth Playwright specs.
- **Dark-mode attribute change ripples through the existing
  CSS**: globals.css currently targets `:root[data-theme="dark"]`.
  After Decision C this becomes `.dark` (shadcn's expected selector).
  The change is mechanical but touches a file feature 001 shipped, so
  the regression bar is high — the auth surfaces and the existing
  theme-toggle component MUST behave identically.
- **`useReducedMotion` is the canonical reduced-motion gate** for
  this feature's Framer Motion code. The global CSS rule already in
  `globals.css` (lines 49-54) suppresses animations to 0.01ms, but
  Framer Motion's variants are React-state-driven and won't respect
  that CSS rule unless the variants themselves branch on the hook —
  see Decision G.
- **Constitution Principle IX (Secrets)**: this feature introduces
  zero new secrets, env vars, or service-account-bearing surfaces.
  Cross-tab auth listener uses the same anon Supabase client already
  configured in `apps/web/lib/supabase/client.ts`.

**Scale/Scope**: A single Next.js route group changes shape
(`apps/web/app/(authed)/`). One new route added (`/app/account`).
Approximately 12 new components, 5 modified pages, 1 modified layout,
1 modified providers file, 1 modified globals.css. Two new Playwright
specs. Roughly 1,500–2,500 added/changed lines on `apps/web/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature touches Principles **V, VI, VII, VIII, IX**. Principles
I, II, III, IV, X are not engaged by this UI-shell feature (no signal
data, no ML, no LLM, no StressID-sourced media).

| Principle | Status | How this plan honours it |
|-----------|--------|--------------------------|
| V. Calm-First Design Language | ✅ | Mist & Meadow tokens stay in `apps/web/app/globals.css` @theme block; the shadcn install maps shadcn's expected CSS variable names ONTO those tokens (Decision B) rather than introducing a parallel palette. Red is forbidden on affective and ambient surfaces — shadcn's `--destructive` is remapped to the new `crimson` Mist & Meadow token (`#7B4244` light, `#C17F81` dark) in both modes (FR-042 scope-clarified per CHANGELOG 2026-05-20; the earlier amber mapping failed dark-mode WCAG AA at 1.4:1). Crimson permitted on destructive action surfaces only. No glassmorphism: shadcn `Card` is restyled with soft borders + 0.5px elevation + `shadow-soft` per the Constitution. Corner radii: cards use `--radius-card` (12px), controls use `--radius-control` (8px). Inter + DM Serif Display already wired in `apps/web/app/layout.tsx`. Voice: every copy string in this feature (welcome banner, empty states, account labels, role placeholder, notification body samples) is reviewed against the calm-voice rubric — no exclamation marks, no clinical or alarmist language. Lucide icons consistent stroke weight. Welcome banner subtitle: "A space to check in with yourself." (Decision M — Mohamed-chosen from three options in the plan-review pass; reflective framing that primes the eventual passive-detection + questionnaire surface.) |
| VI. Responsive & Accessible by Default | ✅ | Every new surface (header, dropdown, account sections, chat pill, notification, role placeholders) is designed mobile-first against the 360px floor. Header center-nav collapses to a hamburger at ≤768px; profile avatar stays as its own separate trigger per FR-005. Chat pill collapses to icon-only at ≤768px per FR-025. Notification component is a bottom sheet at ≤768px per FR-029. All interactive elements ≥44×44px (the existing `h-11 w-11` and `h-12` patterns from feature 001 are reused). Light + dark equal-priority: the CSS-variable mapping in Decision B is applied in both light and dark token sets simultaneously. `prefers-reduced-motion`: Framer Motion variants branch on `useReducedMotion` so notification entrance/exit collapse to opacity-only in reduced-motion mode (Decision G). The OS-level rule already in `globals.css` (lines 49-54) remains as a defense-in-depth backstop for CSS transitions. |
| VII. Mandatory Testing Per PR | ✅ | New Vitest + RTL component tests for every new component (header, profile dropdown, role placeholder, notification component in three configurations). One Playwright happy-path spec for the employee role (`employee-dashboard-shell.spec.ts`). One Playwright cross-tab spec (`cross-tab-auth-sync.spec.ts`) per Decision N. The existing role-trio e2e from feature 001 is preserved unchanged (FR-036). The `login-expired-link.spec.ts` from the post-feature-001 hotfix (commit `8dc822b`) is also preserved unchanged. `smoke-tests.md` authored during `/speckit.tasks` — at minimum: visual regression check on each (auth) page at desktop and 360px in both themes (SC-009), three-configuration notification component check, employee-vs-non-employee landing check, theme-toggle cross-session persistence check. |
| VIII. Spec-Driven Workflow | ✅ | This plan is the second formal artifact of the feature (spec → plan → tasks → implement). Architectural decisions are logged in `docs/DECISIONS.md` during `/speckit.implement`; the planned entries are enumerated in **§ DECISIONS.md entries this plan implies** below for one-shot review. The feature folder contains: `spec.md` (committed), `plan.md` (this file), `research.md`, `data-model.md`, `contracts/components.md`, `contracts/shadcn-mapping.md`, `quickstart.md`, and (during `/speckit.tasks`) `tasks.md` + `smoke-tests.md`. The stale Out-of-Scope bullet in `spec.md` referencing the expired-link hotfix gets a `docs/CHANGELOG.md` entry per the user's directive — the committed spec is NOT modified. |
| IX. Secrets Discipline (NON-NEG) | ✅ | This feature introduces zero new env vars, no new service-role surfaces, no new API keys. The cross-tab auth listener uses the existing anon Supabase client at `apps/web/lib/supabase/client.ts`. The account-page profile editor calls a Server Action that uses the SSR Supabase client at `apps/web/lib/supabase/server.ts` (already feature-001 territory). No `.env*` files are added, modified, or referenced. |

**Gate result**: PASS. No complexity-tracking entries needed.

## Plan-Level Decisions (resolved here, not deferred)

These items were flagged in the spec as decisions the plan must close,
or were pre-resolved in the user's `/speckit.plan` directive. Each
heading names the spec FR / edge case it closes.

### Decision A — shadcn CLI on the Tailwind v4 path

Run `npx shadcn@latest init` against `apps/web/` (NOT the repo root —
the monorepo's web workspace is the only consumer). Follow the
"Tailwind v4" branch of the install story: pick CSS-vars mode, choose
base color `neutral` (it will be overridden by Decision B's mapping),
let the CLI rewrite `globals.css` if it offers, then **reconcile by
hand** — the existing Mist & Meadow `@theme` block must survive
verbatim.

What the shadcn v4 init brings into the repo:

- `apps/web/components.json` — the install manifest (see Decision E
  for the exact shape).
- A handful of CSS-variable declarations in `globals.css` that shadcn
  components reference. We map these to existing Mist & Meadow tokens
  (Decision B) rather than letting the CLI emit fresh oklch colors.
- `tw-animate-css` instead of `tailwindcss-animate` — per the shadcn
  Tailwind v4 doc, the older animation lib is deprecated on the v4
  path.
- `class-variance-authority`, `clsx`, `tailwind-merge`, and the
  per-primitive `@radix-ui/*` packages as `shadcn add` is run for
  each primitive in scope.

The auth pages (`/login`, `/signup`, `/forgot-password`,
`/reset-password`, `/onboarding`) are NOT touched by the init. The
init writes only to `components.json`, `globals.css` (which we then
hand-reconcile), and the components added by subsequent `shadcn add`
commands.

**Pinned shadcn primitives in scope** (in commit order to be locked
during `/speckit.tasks`):
`button`, `card`, `dropdown-menu`, `sheet`, `dialog`, `avatar`,
`separator`.

**CLI-version caveat (amendment recorded 2026-05-20 via CHANGELOG)**:
shadcn `4.7.0`'s `--preset=base-nova` default bundles changes that
violate Constitution V (Inter→Geist font swap), FR-042 (red
`--destructive`), and Decision B's mapping intent (a generic oklch
palette in fresh `:root` / `.dark` blocks that override the Mist &
Meadow tokens at runtime). For this feature and any future re-init,
the workflow is **manual**: hand-author `components.json` per
Decision E, hand-author `lib/utils.ts` per Decision E, `npm i -D` the
dep list (`class-variance-authority`, `clsx`, `tailwind-merge`,
`tw-animate-css`, `@radix-ui/react-slot`), then use `npx shadcn@latest
add <primitive>` for each primitive in scope. `shadcn add` reads
`components.json` for paths and writes to `components/ui/` without
touching `layout.tsx` or the palette CSS. Until shadcn's defaults
realign with Decision A/B/E's target shape, the `init` step is
bypassed; the rest of Decision A (Tailwind v4 path, CSS-vars mode,
neutral baseColor overridden by Decision B's mapping) still binds.

### Decision B — CSS-variable mapping: shadcn names → Mist & Meadow tokens

The Mist & Meadow palette already lives in `apps/web/app/globals.css`
@theme block in hex (lines 10-27, light) and `@layer base
:root.dark { ... }` (post-migration; currently
`:root[data-theme="dark"]`, see Decision C). shadcn primitives
reference CSS variables by their own names (`--background`,
`--foreground`, etc.). The mapping below makes shadcn primitives
consume Mist & Meadow tokens without introducing any new color:

| shadcn variable | Mist & Meadow token (light) | Mist & Meadow token (dark) |
|---|---|---|
| `--color-background` | `--color-bg` (`#ECEEE9`) | `--color-bg` (`#161917`) |
| `--color-foreground` | `--color-ink` (`#1F2522`) | `--color-ink` (`#DCDED5`) |
| `--color-card` | `--color-surface` (`#F5F6F2`) | `--color-surface` (`#20231F`) |
| `--color-card-foreground` | `--color-ink` | `--color-ink` |
| `--color-popover` | `--color-surface` | `--color-surface` |
| `--color-popover-foreground` | `--color-ink` | `--color-ink` |
| `--color-primary` | `--color-meadow` (`#7A9275`) | `--color-meadow` (`#97AE91`) |
| `--color-primary-foreground` | `--color-bg` (text-on-meadow) | `--color-bg` (text-on-meadow) |
| `--color-secondary` | `--color-foggy` (`#8AA9B6`) | `--color-foggy` (`#9CBBC7`) |
| `--color-secondary-foreground` | `--color-ink` | `--color-ink` |
| `--color-muted` | *(not remapped — inherits M&M `#6E7572`)* | *(not remapped — inherits M&M `#8B928F`)* |
| `--color-muted-foreground` | `--color-muted` (`#6E7572`) | `--color-muted` (`#8B928F`) |
| `--color-accent` | `--color-foggy` | `--color-foggy` |
| `--color-accent-foreground` | `--color-ink` | `--color-ink` |
| `--color-destructive` | `--color-crimson` (`#7B4244`) | `--color-crimson` (`#C17F81`) |
| `--color-destructive-foreground` | `--color-bg` (text-on-crimson) | `--color-bg` (text-on-crimson) |
| `--color-border` | `--color-border` | `--color-border` |
| `--color-input` | `--color-border` | `--color-border` |
| `--color-ring` | `--color-meadow` | `--color-meadow` |

Plus the radius ladder (added per R-2.1 — Tailwind v4 generates
`rounded-{sm,md,lg,xl,2xl,3xl,4xl}` from `--radius-*` tokens):

| shadcn variable | Value | Notes |
|---|---|---|
| `--radius` | `var(--radius-control)` (8px) | Base for `rounded-[--radius]` direct uses. |
| `--radius-sm` | `6px` | Small interactive elements. |
| `--radius-md` | `var(--radius-control)` (8px) | Buttons, inputs, dropdowns. |
| `--radius-lg` | `var(--radius-card)` (12px) | Cards. |
| `--radius-xl` | `16px` | Larger surfaces. |
| `--radius-2xl` | `20px` | Hero surfaces. |
| `--radius-3xl` | `24px` | Reserved. |
| `--radius-4xl` | `28px` | Reserved. |

The `--color-*` and `--radius-*` prefixes are load-bearing —
Tailwind v4 generates utility classes (e.g. `bg-primary`,
`rounded-md`) only from tokens with these prefixes. An earlier
unprefixed shape registered the variables to `:root` but produced
NO utility classes, leaving shadcn primitives unstyled. See
research.md R-2.1 for the discovery.

The `--color-destructive` row enforces FR-042's clarified scope (red
permitted on destructive action surfaces only; see CHANGELOG
2026-05-20). Both modes map shadcn's default-red destructive to the
Mist & Meadow `crimson` token — `#7B4244` in light, `#C17F81` in
dark. The earlier mapping to amber is superseded; amber + dark-mode
ink failed WCAG AA at 1.4:1, while crimson + bg-as-foreground passes
AA in both modes (6.08:1 light, 5.02:1 dark).
`--color-destructive-foreground` uses `--color-bg` symmetric across
modes, mirroring the `--color-primary-foreground` pattern.
Implementation: a single `@theme inline {
--color-destructive: var(--color-crimson);
--color-destructive-foreground: var(--color-bg); ... }` pair in
`globals.css` keeps the override in one place.

The `--color-primary-foreground` row uses `--color-bg` in both modes.
A primary-filled button uses meadow as fill (light `#7A9275` / dark
`#97AE91`); the text on it is the page bg color (light `#ECEEE9` /
dark `#161917`). In light mode this gives `#ECEEE9` on `#7A9275` —
~5.8:1 — passing WCAG AA for text. In dark mode this gives `#161917`
on `#97AE91` — ~7.4:1 — also passing. An earlier asymmetric mapping
that used `--color-ink` in dark mode put near-white text on light
sage, which fails AA (~3.1:1). All other rows use the same Mist &
Meadow token name in both modes, relying on the existing dark-mode
override block in globals.css to flip the hex value.

The `--color-muted` row is intentionally NOT remapped in
`@theme inline`. The original draft mapped it to `--color-surface`
for shadcn's Skeleton/hover-row/Tab-unselected idioms, but that
collides with the Mist & Meadow `--color-muted` token (the
muted-gray TEXT color used by `text-muted` across `(auth)` and
`(authed)` surfaces). Tailwind v4's `@theme inline` resolves and
INLINES the value into the `.text-muted` utility at compile time, so
the `:root.dark` runtime override no longer reaches that utility —
muted text washed out symmetrically in both modes. Leaving
`--color-muted` unmapped lets `text-muted` and `text-muted-foreground`
both resolve through the M&M gray. The only shadcn consumer of
`bg-muted` is `DropdownMenuSeparator`, which now renders as a 1px
muted-gray divider instead of the invisible surface-on-popover line
the original mapping produced. See contracts/shadcn-mapping.md
"Load-bearing NON-mapping".

**Radius tokens**: `--radius-card` (12px) and `--radius-control`
(8px) are already declared in `apps/web/app/globals.css`'s `@theme`
block from feature 001 (alongside the color tokens). They do not
need new declarations. shadcn primitives use Tailwind's
`rounded-{sm,md,lg,xl,2xl,3xl,4xl}` utility classes, which Tailwind
v4 generates from `--radius-*` tokens registered in `@theme` blocks
— so the `@theme inline` block adds a 7-step ladder anchored to
those Mist & Meadow values:

```css
--radius:     var(--radius-control);  /* 8px base */
--radius-sm:  6px;
--radius-md:  var(--radius-control);  /* 8px — buttons, inputs, dropdowns */
--radius-lg:  var(--radius-card);     /* 12px — cards */
--radius-xl:  16px;
--radius-2xl: 20px;
--radius-3xl: 24px;
--radius-4xl: 28px;
```

Buttons (`rounded-md`) resolve to 8px; cards (`rounded-lg`) resolve
to 12px; smaller and larger surfaces have a calm gradation in between.
The single `--radius` (no suffix) covers primitives that use
`rounded-[--radius]` directly. The earlier shape of a single
`--radius: var(--radius-control)` line without the ladder left
`rounded-md` and friends unstyled — see R-2.1 of research.md.

**Documentation source for this mapping**: `contracts/shadcn-mapping.md`
in this feature folder duplicates the table for runtime reference; the
plan and that contract file must stay in sync.

### Decision C — Dark-mode attribute migration: `data-theme` → `class`

Today: `apps/web/app/providers.tsx` configures
`<ThemeProvider attribute="data-theme" ...>`, and `globals.css`
targets `:root[data-theme="dark"] { ... }`.

shadcn primitives expect `.dark` on `<html>`. Two paths considered:

1. **Migrate to shadcn's convention** (`attribute="class"`, CSS
   targets `.dark`). The change is mechanical:
   `providers.tsx` flips the attribute prop; `globals.css` swaps the
   selector. The existing theme-toggle component (which writes via
   `next-themes`'s `setTheme()`) is untouched. The (auth) pages and
   the auth Playwright specs do not select on the attribute — they
   query computed styles or visible text — so they pass unchanged.
2. **Stay on `data-theme` and configure shadcn primitives to read
   from a custom selector.** shadcn's CSS variables are namespaced to
   `.dark` by default in its templates; overriding requires editing
   every primitive's emitted CSS. Painful and ongoing.

Path 1 wins. **Risk callout**: any external code that selects on
`[data-theme="dark"]` (e.g., a `.user.css` snippet, a custom
extension, a third-party widget) breaks. We grep for the literal
string `data-theme` across `apps/web/` to confirm scope before
flipping; the only known consumer is `globals.css` itself.

Also adds `storageKey="serenify-theme"` to the `ThemeProvider` props
so the localStorage namespace is explicit and project-scoped. Without
it, next-themes uses the default `theme` key, which is fine
functionally but mingles with any other next-themes-using app loaded
under the same origin during local development.

### Decision D — Theme persistence mechanism (FR-053)

`next-themes`' built-in localStorage write through `setTheme()` (with
the explicit `storageKey="serenify-theme"` from Decision C) handles
all of FR-053 by construction:

- Persists across page navigations within the session — localStorage
  survives client-side navigation by definition.
- Persists across sign-out / sign-in — localStorage is not auth-
  scoped; the theme key lives on the origin, not the session.
- No server round-trip on flip — `setTheme` is a client-only write.
- OS-preference fallback (`defaultTheme="system"`, `enableSystem`)
  for first-load and any user without a stored override.
- Manual override priority — once `setTheme("light")` or
  `setTheme("dark")` runs, the stored value wins until the user picks
  `setTheme("system")`.

No `profiles` column, no Server Action, no Supabase write. The
edge-case "user has `prefers-color-scheme: dark` set in their OS and
a manual light-theme override stored from a previous session — the
manual override wins on this load" is handled natively by next-themes.

### Decision E — `components.json` shape

**Pre-flight verification** (run before `shadcn init`): confirm
`apps/web/tsconfig.json` already defines the `@/*` → `./*` path
alias under `compilerOptions.paths`. Verified at plan time
(`2026-05-19`): feature 001's tsconfig includes
`"paths": { "@/*": ["./*"] }`. If a future rebase ever drops this,
re-add it before running `shadcn init` — every alias in the
`aliases` block of `components.json` below resolves through this
path mapping.

The shadcn init writes this file at `apps/web/components.json`. The
shape we commit:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

Notes:

- `tailwind.config` is empty because Tailwind v4 has no JS config
  file by default — config lives in `globals.css`'s `@theme` block.
  The shadcn v4 path expects this empty string.
- `tailwind.css` points at the relative path from the workspace root
  (`apps/web/`). The CLI runs from inside `apps/web/`, so the path is
  workspace-relative.
- `aliases.ui` is `@/components/ui` — flat. The bespoke auth
  primitives live under `@/components/ui/auth/*` (see Decision F);
  shadcn's `add` writes to the flat root.
- `iconLibrary: "lucide"` matches the project standard.

### Decision F — Component folder layout

```text
apps/web/components/
├── ui/                                 # shadcn primitives (flat) + bespoke auth subfolder
│   ├── button.tsx                      # shadcn add button     (new)
│   ├── card.tsx                        # shadcn add card        (new)
│   ├── dropdown-menu.tsx               # shadcn add dropdown-menu (new)
│   ├── sheet.tsx                       # shadcn add sheet       (new)
│   ├── dialog.tsx                      # shadcn add dialog      (new)
│   ├── avatar.tsx                      # shadcn add avatar      (new)
│   ├── separator.tsx                   # shadcn add separator   (new)
│   └── auth/                           # bespoke, NOT shadcn   (extracted)
│       ├── password-input.tsx          # was components/ui/password-input.tsx (MOVE)
│       ├── password-requirements.tsx   # was components/ui/password-requirements.tsx (MOVE)
│       ├── field.tsx                   # extracted from each (auth) form file's inlined Field
│       └── otp-panel.tsx               # was app/(auth)/otp-panel.tsx (MOVE — auth-only primitive)
├── header/                             # employee-shell header pieces (new)
│   ├── header.tsx
│   ├── center-nav.tsx
│   ├── profile-dropdown.tsx
│   └── mobile-menu.tsx
├── home/                               # /app body pieces (new)
│   ├── welcome-banner.tsx
│   ├── todays-checkin-card.tsx
│   ├── things-that-might-help-card.tsx
│   └── recent-chats-card.tsx
├── account/                            # /app/account sections (new)
│   ├── profile-section.tsx
│   ├── security-section.tsx
│   ├── privacy-placeholder.tsx
│   ├── notifications-placeholder.tsx
│   └── sign-out-section.tsx
├── role-placeholder/                   # team_lead / admin landing (new)
│   └── role-placeholder.tsx
├── chat-pill.tsx                       # persistent bottom-right pill (new, visual-only)
├── notification.tsx                    # the reusable notification (new — NOT in ui/)
└── notification.test.tsx               # Vitest + RTL test for the notification component
```

Rationale for the auth subfolder:

- The two already-extracted primitives (`password-input.tsx`,
  `password-requirements.tsx`) currently sit at `components/ui/`.
  shadcn's flat install will pour `button.tsx`, `card.tsx`, etc.
  into the same flat directory. Keeping the bespoke and shadcn
  primitives at the same level invites someone to import
  `@/components/ui/button` thinking it is bespoke when it is shadcn,
  or vice versa.
- Moving the bespoke primitives into `components/ui/auth/` makes the
  separation by import path explicit and signals "do not migrate
  these to shadcn equivalents" (FR-040).

Rationale for `notification.tsx` NOT in `ui/`:

- `ui/` is reserved for primitives (button, card, dropdown-menu).
  The notification component is composite — it composes Radix Dialog
  + a media-query-driven layout switch + Framer Motion variants. The
  shadcn convention is that composite components live outside `ui/`.
- Importing it as `@/components/notification` reads as a single
  surface ("the notification"), which matches its conceptual
  status — a reusable surface that features 007 / 008 / 010 will
  mount.

Rationale for keeping the per-feature subfolders (`header/`, `home/`,
etc.) outside `ui/`:

- These are application components, not primitives. Each one is
  used by exactly one route (or by the (authed) layout); they are
  not API-shaped reusables. Hosting them outside `ui/` keeps `ui/`'s
  semantic meaning ("the shared design-system primitives") intact.

### Decision G — Notification component composition

The notification is **not Sonner**. Sonner's toast paradigm is a
top-right stack with auto-dismiss and limited layout control; FR-029
requires a full-width bottom sheet at ≤768px and FR-030 requires a
specific reduced-motion fallback. Sonner's APIs do not let us swap
to a sheet at a viewport breakpoint without re-implementing most of
the surface.

The component is built on Radix Dialog primitives (the same
primitives shadcn's `dialog` is built on) with a viewport-conditional
positioner:

- `useMediaQuery("(max-width: 768px)")` (a new hook at
  `apps/web/hooks/use-media-query.ts`) selects between two
  `Dialog.Content` placements.
- Desktop (`≥768px`): `Dialog.Content` is positioned bottom-right
  with `position: fixed; right: 1rem; bottom: 1rem;` and a
  slide-in-from-bottom-right Framer Motion variant. The card is
  bordered in `--color-border`, padded generously, has `--radius-card`
  (12px), and uses `--shadow-soft` for elevation. No glassmorphism.
- Mobile (`≤768px`): `Dialog.Content` is anchored to the bottom edge
  full-width with a slide-up-from-bottom variant. Top radius
  `--radius-card` (12px); bottom radius 0.

Reduced motion: the Framer Motion `variants` object branches on
`useReducedMotion()` (from Framer Motion). When the hook returns
`true`, the variant collapses to opacity-only (`animate: { opacity:
1 }`, `exit: { opacity: 0 }`, no `y` or `x` offsets). The OS-level
CSS `* { animation-duration: 0.01ms; transition-duration: 0.01ms; }`
rule already in `globals.css` (lines 49-54) remains as a backstop for
non-React-state animations.

Explicit dismiss control only; no auto-dismiss (FR-031). Consumers
(features 007/008/010) layer auto-dismiss on top if they want it.

Export path: `@/components/notification`. The component exports
`Notification` (the controlled surface) and a `NotificationProps`
type. There is no Provider or NotificationContainer to mount at the
shell root — each consumer mounts the surface directly when it has
something to surface, which keeps the API simple and avoids a global
queue this feature doesn't need.

### Decision H — Toast-above-pill gap: 16px

When the notification surface is rendered concurrently with the
persistent chat pill on a viewport that shows both (desktop only;
on mobile the bottom sheet covers the chat pill area entirely and
the pill's z-order is below the sheet's backdrop), the surfaces stack
bottom-right with a **16px gap** between them.

16px = Tailwind `gap-4` = the Mist & Meadow spacing scale's
"comfortable" tier. Smaller (8px / `gap-2`) reads as cramped against
the generous-whitespace constitutional rule; larger (24px / `gap-6`)
strands the toast halfway up the viewport, away from its anchor.

Implementation uses a **CSS-variable offset** so the notification
does not need to know whether the chat pill is mounted:

- The chat pill, on mount, sets `--chat-pill-offset` on `<html>` to
  its rendered height (48px on desktop, 44px on mobile). On unmount
  it removes the property.
- The notification's desktop positioning uses
  `bottom: calc(1rem + var(--chat-pill-offset, 0px) + 1rem);` —
  the fallback `0px` makes the math collapse cleanly to
  `bottom: 2rem` (16px below + 16px above the toast itself relative
  to the viewport edge) when the chat pill is absent. This matters
  because the notification is consumed on manager pages too
  (features 010+), where the chat pill is gated off by FR-035.
- The chat pill exports `CHAT_PILL_HEIGHT = 48` for testing and
  documentation purposes; the runtime contract is the CSS variable,
  not the constant.

The convention is captured in the notification component's JSDoc so
features 007/008/010 can pin to the same behavior:

```tsx
/**
 * Layout convention: when the persistent chat pill is mounted on the
 * same page, it sets --chat-pill-offset on <html> to its height.
 * This component computes its bottom offset as
 *   calc(1rem + var(--chat-pill-offset, 0px) + 1rem)
 * so the toast sits 16px above the pill when present, or 16px above
 * the viewport edge when absent (e.g. on team_lead / admin pages).
 * Features 007 (questionnaire), 008 (chatbot), and 010 (manager
 * check-ins) inherit this convention.
 */
```

### Decision I — Header right-cluster mechanics

The header's right cluster is a flex container ordered
`[ThemeToggle] [ReservedTalkSlot] [ProfileAvatar]` with
`gap-3` (12px) between items. FR-006 reserves the slot for feature
010's `<TalkButton />`. We use a JSX **comment marker**, not an
invisible placeholder element:

```tsx
<div className="flex items-center gap-3">
  <ThemeToggle />
  {/* feature 010 inserts <TalkButton /> here */}
  <ProfileDropdown />
</div>
```

Rejected alternatives:

- `<div className="hidden" />` placeholder — adds DOM weight, would
  break the `gap-3` math when feature 010 swaps it out.
- An empty `<div>` with explicit width — same problem.

Flex `gap-3` absorbs the future insertion without reflow: feature 010
deletes the comment and inserts `<TalkButton />` in the same position;
the gap stays 12px on both sides.

### Decision J — Active-nav indicator

The active nav item ("Home" on `/app`) renders with a soft
surface-token pill background (`bg-surface`), `rounded-md` (matches
the `--radius-control` 8px), normal text weight (no bold), and no
underline. Inactive items have no background and only a hover
treatment (`hover:bg-surface/60`).

The active state is determined by `usePathname()` from
`next/navigation`. The pill background renders only when the
pathname starts with the destination's href — so a future Insights
sub-route under `/app/insights/...` would still light up the
Insights nav item.

### Decision K — `full_name` length handling

- **Store**: `profiles.full_name` is unconstrained `text` in the
  feature-001 schema. Application-level: enforce a **60-character
  max** in the account-page profile editor's zod schema (`z.string()
  .max(60, "Keep it under 60 characters")`). 60 covers
  multi-part hyphenated names and Arabic transliterations with room
  to spare; longer values are almost always test data.
- **Welcome banner**: uses the full first whitespace-separated token,
  no truncation. (A 30-character first name is rare and the layout
  has room.)
- **Header avatar / dropdown name area**: truncate at **24
  characters** with a single-character ellipsis (Unicode `…`,
  not three ASCII dots). 24 is chosen by sampling: Arabic and
  Egyptian names common in the demo cohort fit at 24; English
  doubles like "Christopher" + a 12-char family name fit at 24.
  Implementation: a `truncate-name.ts` helper at `apps/web/lib/` that
  the dropdown and avatar tooltip both call. Pure function, no
  Intl/locale APIs — identical output on server and client, so SSR
  and post-edit client-side renders never disagree.
- **Edit field**: the input accepts the full 60-character value
  unhindered; truncation is a display-side concern only.

### Decision L — Role placeholder copy

- **team_lead**
  - Heading: "Your team-lead view is coming together."
  - Subtitle: "We're building something that respects your team's
    privacy. Check back soon."
- **admin**
  - Heading: "Your admin view is in progress."
  - Subtitle (amended 2026-05-22 — see CHANGELOG): "Org-wide tools
    land in a later release. Account settings are available from
    the header dropdown."
  - Previous subtitle (superseded): "Org-wide tools land in a
    later release. Account settings are available below." The
    "below" was misdirective — the placeholder layout has only
    the Sign out button below the subtitle; Account lives in the
    header dropdown.

Layout for both: centered single column, generous whitespace
(`py-24 sm:py-32`), DM Serif Display heading at the same scale as the
welcome banner's adaptive greeting (`font-display text-3xl sm:text-4xl`),
Inter subtitle in `text-muted`, sign-out as a secondary-styled
button (`bg-surface text-ink border border-border hover:bg-border`)
beneath the subtitle. The header above is identical to the employee
header (FR-034) so the surface stays familiar.

The phrasing avoids the word "build" in the imperative ("we are
building"), avoids any future-tense promise about a specific date,
avoids exclamation marks, and avoids the alarmist blocklist.

### Decision M — Welcome banner subtitle (FR-009)

**Chosen** (by Mohamed during plan review): **"A space to check in
with yourself."**

Three candidates were presented:

a) "We're here when you need us." — time-neutral, supportive,
   partner-voice. My original plan-draft choice.
b) "A space to check in with yourself." — reflective, frames `/app`
   as an introspection surface. **Selected.**
c) "However you're showing up today." — acknowledges variability
   of state, conversational warmth.

Why (b) over (a) and (c):

- Pairs cleanly with all three FR-008 adaptive greetings ("Good
  morning", "Good afternoon", "Good evening") without tonal clash —
  unlike the spec's example "A calm start to your day," which only
  fits morning.
- "Check in with yourself" primes the eventual product loop —
  passive detection raises a question, the questionnaire (feature
  007) confirms it, the chatbot (feature 008) deepens it.
  Introspection is the through-line. The subtitle on day one tells
  users what the surface is for.
- More inward-facing than (a)'s "we'll be here" framing, which
  positions Serenify as a passive helper rather than a reflection
  tool.
- Less variable-tense than (c)'s "however you're showing up", which
  reads slightly looser and risks sounding like a greeting card.

**Logged in DECISIONS.md** per the user's directive.

### Decision N — Playwright cross-tab spec mechanics (FR-047)

**Do not use two `BrowserContexts`**. `browser.newContext()` creates
contexts with separate cookies and separate localStorage, which is
the opposite of what cross-tab sync needs:
`supabase.auth.onAuthStateChange`'s cross-tab firing is driven by the
`storage` event on the same-origin localStorage, and two contexts do
not share storage. The test would silently never fire.

**Pattern**:

```ts
const context = await browser.newContext();
const pageA = await context.newPage();
const pageB = await context.newPage();
await pageA.goto("/login");
await pageB.goto("/login");

// Sign in via the actual form in pageA (real-world behavior).
await pageA.fill('input[name="email"]', "employee@demo.serenify.local");
await pageA.fill('input[name="password"]', "DemoUser123!");
await pageA.click('button[type="submit"]');

// Assert pageB navigates within 2s without manual reload.
await pageB.waitForURL(/\/app$/, { timeout: 2000 });

// Sign out via real UI in pageA (same approach as sign-in — drive
// both halves through the user-facing path). pageA has already
// navigated to /app; open the profile dropdown and click sign-out.
await pageA.getByRole("button", { name: /open profile menu/i }).click();
await pageA.getByRole("menuitem", { name: /sign out/i }).click();
await pageB.waitForURL(/\/login$/, { timeout: 2000 });
```

`page.evaluate(() => client.auth.signOut())` was considered as an
alternative but rejected: a bare `import("@supabase/ssr")` inside
`evaluate` does not resolve in the browser context (the bundler
hasn't seen it), and re-creating a browser client from raw URL +
anon-key plumbing inside the test couples the spec to client
internals that should remain implementation detail. UI-click on
both halves keeps the spec uniform and resilient to client-factory
refactors.

The 2-second budget aligns with SC-008. The spec runs under the
already-configured `workers: 1` (DECISIONS 2026-05-17) so it does not
race other auth specs.

## Project Structure

### Documentation (this feature)

```text
specs/003-employee-dashboard-shell/
├── plan.md                            # this file
├── spec.md                            # committed
├── research.md                        # Phase 0 — long-form treatment of Decisions A–N
├── data-model.md                      # Phase 1 — references feature 001's schema, no new columns
├── contracts/
│   ├── components.md                  # component contracts: props, events, accessibility
│   └── shadcn-mapping.md              # CSS-variable mapping table (Decision B), runtime-reference
├── quickstart.md                      # Phase 1 — fresh-developer steps to land on this feature
├── tasks.md                           # written by /speckit.tasks (NOT yet)
└── smoke-tests.md                     # written during /speckit.tasks (NOT yet)
```

### Source Code (repository — additions and modifications)

```text
serenify/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── globals.css                          # MODIFIED — Decision B (var mapping), Decision C (.dark)
│       │   ├── layout.tsx                           # MODIFIED — mount cross-tab listener here (US 6)
│       │   ├── providers.tsx                        # MODIFIED — attribute="class", storageKey="serenify-theme"
│       │   ├── theme-toggle.tsx                     # UNCHANGED — already uses next-themes setTheme()
│       │   │                                       # (no cross-tab listener inside app/ — see components/cross-tab-auth.tsx)
│       │   ├── (auth)/
│       │   │   ├── layout.tsx                       # UNCHANGED
│       │   │   ├── login/login-form.tsx             # MODIFIED — import Field from @/components/ui/auth/field
│       │   │   ├── signup/signup-form.tsx           # MODIFIED — same import change
│       │   │   ├── forgot-password/forgot-form.tsx  # MODIFIED — same import change
│       │   │   ├── reset-password/reset-form.tsx    # MODIFIED — same import change
│       │   │   └── otp-panel.tsx                    # DELETED (moves to @/components/ui/auth/)
│       │   └── (authed)/
│       │       ├── layout.tsx                       # MODIFIED — replaced with new shell (header + chat pill)
│       │       ├── app/
│       │       │   ├── page.tsx                     # MODIFIED — welcome banner + 3 cards or role placeholder
│       │       │   └── account/
│       │       │       ├── page.tsx                 # NEW
│       │       │       └── actions.ts               # NEW — update-profile server action
│       │       └── onboarding/
│       │           └── onboarding-form.tsx          # MODIFIED — import Field from @/components/ui/auth/field
│       ├── components/
│       │   ├── ui/                                  # see Decision F for the full tree
│       │   │   ├── auth/                            # NEW subfolder
│       │   │   │   ├── password-input.tsx           # MOVED from components/ui/password-input.tsx
│       │   │   │   ├── password-requirements.tsx    # MOVED from components/ui/password-requirements.tsx
│       │   │   │   ├── field.tsx                    # NEW — extracted from each (auth) form file
│       │   │   │   └── otp-panel.tsx                # MOVED from app/(auth)/otp-panel.tsx
│       │   │   ├── button.tsx                       # NEW — shadcn add
│       │   │   ├── card.tsx                         # NEW — shadcn add
│       │   │   ├── dropdown-menu.tsx                # NEW — shadcn add
│       │   │   ├── sheet.tsx                        # NEW — shadcn add
│       │   │   ├── dialog.tsx                       # NEW — shadcn add
│       │   │   ├── avatar.tsx                       # NEW — shadcn add
│       │   │   └── separator.tsx                    # NEW — shadcn add
│       │   ├── header/                              # NEW
│       │   │   ├── header.tsx
│       │   │   ├── center-nav.tsx
│       │   │   ├── profile-dropdown.tsx
│       │   │   └── mobile-menu.tsx
│       │   ├── home/                                # NEW
│       │   │   ├── welcome-banner.tsx
│       │   │   ├── todays-checkin-card.tsx
│       │   │   ├── things-that-might-help-card.tsx
│       │   │   └── recent-chats-card.tsx
│       │   ├── account/                             # NEW
│       │   │   ├── profile-section.tsx
│       │   │   ├── security-section.tsx
│       │   │   ├── privacy-placeholder.tsx
│       │   │   ├── notifications-placeholder.tsx
│       │   │   └── sign-out-section.tsx
│       │   ├── role-placeholder/                    # NEW
│       │   │   └── role-placeholder.tsx
│       │   ├── chat-pill.tsx                        # NEW
│       │   ├── notification.tsx                     # NEW
│       │   ├── notification.test.tsx                # NEW
│       │   ├── cross-tab-auth.tsx                   # NEW — onAuthStateChange listener; rendered by app/layout.tsx but lives under components/ so app/ stays route-only
│       │   └── cross-tab-auth.test.tsx              # NEW — reducer unit test (Test Strategy below)
│       ├── hooks/                                   # NEW directory
│       │   └── use-media-query.ts                   # NEW
│       ├── lib/
│       │   ├── utils.ts                             # NEW (or augmented) — shadcn's `cn()`
│       │   └── truncate-name.ts                     # NEW — Decision K
│       ├── components.json                          # NEW — Decision E
│       ├── tests/
│       │   ├── e2e/
│       │   │   ├── employee-dashboard-shell.spec.ts # NEW — happy-path
│       │   │   ├── cross-tab-auth-sync.spec.ts     # NEW — Decision N
│       │   │   ├── admin-seeded.spec.ts             # UNCHANGED structure — copy assertions may shift (FR-036)
│       │   │   ├── team-lead-seeded.spec.ts         # UNCHANGED structure — copy assertions may shift (FR-036)
│       │   │   ├── employee-otp.spec.ts             # UNCHANGED
│       │   │   ├── employee-signup.spec.ts          # UNCHANGED
│       │   │   ├── reset-password.spec.ts           # UNCHANGED
│       │   │   ├── demo-coexistence.spec.ts         # UNCHANGED
│       │   │   └── login-expired-link.spec.ts       # UNCHANGED (from hotfix 8dc822b)
│       │   └── unit/                                # feature 001 placed login-page.test.tsx, schemas.test.ts, setup.ts here — UNCHANGED.
│       │                                            # feature 003 new Vitest component tests are co-located with
│       │                                            # their components (e.g. components/header/header.test.tsx),
│       │                                            # NOT here. Both layouts are picked up by vitest.config.mts's
│       │                                            # default include glob.
│       └── package.json                             # MODIFIED — add framer-motion + shadcn-added Radix pkgs
├── docs/
│   ├── DECISIONS.md                                 # APPENDED — entries enumerated below
│   ├── BACKLOG.md                                   # APPENDED — dynamic welcome subtitle deferred (FR-009 ripple)
│   └── CHANGELOG.md                                 # APPENDED (file already exists with entries from 2026-05-17, 2026-05-18) — adds note of stale Out-of-Scope bullet superseded by hotfix 8dc822b
```

**Structure Decision**: All implementation work lives under
`apps/web/` (Next.js workspace). No changes to `apps/api/`, no
changes to `packages/`, no changes to `supabase/`, no changes to
repo-root `scripts/`. The monorepo's other workspaces are untouched.

## Phase 0: Research

The full discussion lives in [`research.md`](./research.md). Headline
outputs:

| Topic | Decision | One-line rationale |
|---|---|---|
| shadcn install path | `npx shadcn@latest init` from `apps/web/`, Tailwind v4 branch, CSS-vars mode, baseColor `neutral` overridden by Decision B | Project is on Tailwind v4; shadcn's v4 path is well-documented. |
| CSS-variable mapping | shadcn variable names → Mist & Meadow tokens, per Decision B table | One new color introduced (`--color-crimson`, per FR-042 scope clarification 2026-05-20); FR-042 honoured by `--destructive → crimson` + `--destructive-foreground → bg`. |
| Dark-mode attribute | Migrate `data-theme` → `class`; CSS targets `.dark` | shadcn convention; mechanical change with low blast radius (one selector in `globals.css`). |
| Theme persistence | `next-themes` localStorage with `storageKey="serenify-theme"` | Covers FR-053 by construction; no server round-trip. |
| Component folder layout | shadcn flat in `components/ui/`; bespoke in `components/ui/auth/`; composite in `components/` | Import path encodes provenance; FR-040 made structural. |
| Cross-tab listener mount | `app/layout.tsx` root layout, not `(authed)/layout.tsx` | US 6 AS-1 requires propagation between two `/login` tabs; an authed-only mount fires too late. |
| Notification composition | Radix Dialog + Framer Motion + `useMediaQuery`; NOT Sonner | Sonner can't bifurcate to a bottom sheet at the viewport breakpoint; the bifurcation is FR-029. |
| Toast/pill gap | 16px (Tailwind `gap-4`) | Comfortable tier of Mist & Meadow spacing; documented in the notification's JSDoc for features 007/008/010. |
| Header right-cluster | Flex container, JSX comment marker for the talk slot, `gap-3` between items | No invisible DOM weight; feature 010's insertion is a one-line diff. |
| Active-nav indicator | Soft `bg-surface` pill on active, no underline, `usePathname()` | Calm-first; pill matches `--radius-control`. |
| `full_name` lengths | Store ≤60; banner uses full first token; dropdown/avatar truncates at 24 + `…`; edit field accepts 60 | Covers the spec's edge case without surprising the user mid-edit. |
| Role placeholder copy | Decision L (calm, no exclamation, no clinical) | Constitution Principle V voice rubric. |
| Welcome subtitle | "A space to check in with yourself." | Mohamed-chosen; reflective framing that primes the passive-detection loop. |
| Playwright cross-tab pattern | Single context, two pages; both halves driven through real UI clicks (sign-in via form, sign-out via dropdown menu item) | Single context shares localStorage so the storage event actually fires; UI-click on both halves keeps the spec resilient to client-factory refactors. |
| Sonner | Rejected | Toast paradigm doesn't fit the desktop-slide-in / mobile-bottom-sheet bifurcation. |
| `framer-motion` | Added (caret pin) | Drives notification motion; `useReducedMotion` is the canonical reduced-motion gate. |

## Phase 1: Design & Contracts

The full artifacts are in:

- [`data-model.md`](./data-model.md) — no schema change; documents
  the `profiles` columns this feature reads/writes (`full_name`
  editable; `role` read-only for the landing branch).
- [`contracts/components.md`](./contracts/components.md) — every new
  component's props, events, accessibility attributes, and consumer
  contract. Covers header / dropdown / cards / account sections /
  chat pill / notification / role placeholder.
- [`contracts/shadcn-mapping.md`](./contracts/shadcn-mapping.md) —
  the CSS-variable mapping table from Decision B in runtime-reference
  form, plus the `--destructive → crimson` + `--destructive-foreground
  → bg` override pair (per the FR-042 scope clarification recorded
  in CHANGELOG 2026-05-20).
- [`quickstart.md`](./quickstart.md) — fresh-developer steps from a
  clean clone to a running `/app` with the new shell.

## Branch Commit Ordering

The user's directive establishes the canonical 13-step ordering. This
list is reproduced here as the contract /speckit.tasks decomposes
into task IDs. Each step is one PR-sized unit and lands on the
`003-employee-dashboard-shell` branch in order. Tests run at the end
of each step; CI passing is the gate to start the next step.

1. **Extract auth primitives** to `components/ui/auth/`. `Field`
   extracted from each form file; `password-input.tsx` and
   `password-requirements.tsx` moved from `components/ui/`;
   `otp-panel.tsx` moved from `(auth)/`. Update imports in
   `login-form.tsx`, `signup-form.tsx`, `forgot-form.tsx`,
   `reset-form.tsx`, `onboarding-form.tsx`. Run feature 001's
   role-trio Playwright e2e — MUST pass unchanged (SC-009). No
   visual regression at desktop or 360px in either theme.
2. **Install + configure `next-themes` attribute migration**. Flip
   `providers.tsx` to `attribute="class"`, add
   `storageKey="serenify-theme"`. Update `globals.css` selector
   `:root[data-theme="dark"]` → `.dark`. Grep `apps/web/` for any
   remaining `data-theme` references; remove or update. Verify
   theme toggle on the (auth) pages behaves identically.
3. **Install shadcn (Tailwind v4 path)**. `npx shadcn@latest init`
   from `apps/web/`, choose CSS-vars mode + baseColor `neutral` +
   `iconLibrary: "lucide"`. Commit `components.json`. Hand-
   reconcile `globals.css` so the existing Mist & Meadow `@theme`
   block survives and the shadcn variable names from Decision B map
   correctly. Run `shadcn add` for `button card dropdown-menu sheet
   dialog avatar separator` (in this order). Verify visual regression
   on (auth) pages — they import zero shadcn primitives, so the
   diff MUST be visually empty.
4. **Build header + center nav + profile dropdown**. New components
   under `apps/web/components/header/`. Header reads the user's
   `profiles.full_name` and `profiles.role` in the (authed) layout
   (single Server Component read, passed down as props). Center nav
   has only "Home" active (Decision J active-state). Profile dropdown
   uses `@/components/ui/dropdown-menu`. Mobile menu (hamburger) is
   a separate component; profile avatar stays as its own trigger on
   mobile per FR-005. Add Vitest + RTL tests.
5. **Build `/app/account`** with all five sections (Profile,
   Security, Privacy placeholder, Notifications placeholder, Sign
   out). Profile section uses the existing react-hook-form + zod +
   `useTransition` pattern from feature 001's forms. Security
   section's "Change password" is a `<Link href="/forgot-password">`
   styled as a secondary button (FR-020). Add the
   `update-profile` server action at
   `(authed)/app/account/actions.ts`. Add Vitest + RTL tests.
6. **Build `/app`** for employee role — welcome banner (Decision M
   subtitle, FR-010 first-name derivation, FR-008 time-of-day
   greeting) + three skeleton cards in the documented 60/40 layout.
   Cards use the shadcn `Card` primitive restyled per Mist & Meadow.
   Each card ships with calm "not yet" empty-state copy.
7. **Build persistent chat pill** at `components/chat-pill.tsx`.
   Visual-only — onClick is a true no-op in this feature; feature
   008 wires the real chatbot. Sets `--chat-pill-offset` on `<html>`
   on mount per Decision H. Lands in the (authed) layout outside the
   `<main>` content for true persistence across page nav.
8. **Build notification component** at `components/notification.tsx`
   per Decision G. Add `use-media-query.ts` hook. Tests in three
   configurations: desktop slide-in, mobile bottom sheet, reduced-
   motion (SC-010). No production code mounts it in this feature
   (FR-033). Add a developer-preview test that imports and asserts
   the rendering directly via RTL.
9. **Build role placeholders** for team_lead / admin at
   `components/role-placeholder/role-placeholder.tsx`. Wire from
   `(authed)/app/page.tsx`: read `profile.role`, branch to either
   the employee body (steps 6–7) or the role placeholder (Decision L
   copy). The chat pill MUST NOT render on the role-placeholder
   branch (FR-035). Header renders identically (FR-034).
10. **Mount cross-tab listener** at `app/layout.tsx`. New client
    component `components/cross-tab-auth.tsx` (imported by `app/layout.tsx`) subscribes to
    `supabase.auth.onAuthStateChange` once, pathname-gates each
    navigate (Decision F of the user's directive — FR-046).
    Add `cross-tab-auth-sync.spec.ts` per Decision N. Verify
    `TOKEN_REFRESHED` does not navigate.
11. **Final import migration sweep** through the (auth) page files
    — already done in step 1, but this step re-verifies and runs
    the full role-trio Playwright suite + the
    `login-expired-link.spec.ts` from the hotfix `8dc822b`. Both
    MUST pass unchanged.
12. **Test pass**: full Vitest + RTL suite; full Playwright suite
    including the two new specs; coverage spot-check on the new
    components.
13. **`smoke-tests.md` authored** with the human-validated checks
    from the Constitution Principle VII requirement. Mohamed runs
    them after `/speckit.implement`; results recorded in the file.

This ordering is the contract for `/speckit.tasks`. Any deviation
during `/speckit.implement` requires a `docs/CHANGELOG.md` entry per
Constitution Principle VIII.

## Edits to Feature 001

Three categories of edits land on feature 001 artifacts:

1. **Inlined primitives extracted** (step 1 above). `login-form.tsx`,
   `signup-form.tsx`, `forgot-form.tsx`, `reset-form.tsx`,
   `onboarding-form.tsx` — each loses its locally-defined `Field`
   and gains an import from `@/components/ui/auth/field`. No DOM
   structure change; no CSS change; no behavior change.
2. **Dark-mode attribute migration** (step 2). `globals.css`'s
   `:root[data-theme="dark"]` becomes `.dark`. `providers.tsx`'s
   `attribute="data-theme"` becomes `attribute="class"`, gains
   `storageKey="serenify-theme"`.
3. **`/app` (employee placeholder)** is replaced by the new shell.
   The existing `data-testid="role-banner"` on the role text becomes
   irrelevant — the role-trio Playwright specs were asserting on it,
   so they need a small update to assert against the new role-
   conditional copy. **This is the one place the role-trio e2e
   spec files DO change** — limited to copy assertions, per FR-036.
   Any other change is a regression and blocks the merge.

No changes to feature 001's data model, RLS policies, route guards,
auth flows, `/forgot-password` / `/reset-password` machinery, or
e2e fixture infrastructure beyond the assertion update.

## Test Strategy

This section satisfies Constitution Principle VII's PR-gate scoping
requirement.

### Vitest + React Testing Library

One `.test.tsx` per new component, co-located with the source:

- `components/header/header.test.tsx` — renders logo, center nav with
  active state, profile avatar, and asserts the right-cluster
  contains exactly two children in order (`ThemeToggle` then
  `ProfileDropdown`). JSX comments do not render to the DOM, so the
  reserved talk slot is not directly assertable; the two-child
  contract makes feature 010's eventual insertion of `<TalkButton />`
  a one-line diff that flips this assertion to three children.
- `components/header/profile-dropdown.test.tsx` — opens on click,
  contains exactly three items in the documented order, sign out
  triggers the expected action.
- `components/account/profile-section.test.tsx` — full_name editor
  validates length, submits, optimistic-updates the displayed name.
- `components/notification.test.tsx` — three configurations:
  desktop (≥768px), mobile (<768px), reduced-motion (mocked).
  Asserts the dismissable explicit-control contract (FR-031).
- `components/role-placeholder/role-placeholder.test.tsx` — renders
  the team_lead and admin copy variants; renders the header but NOT
  the welcome banner / cards / chat pill (the no-employee-DOM
  assertion from SC-007).
- `components/chat-pill.test.tsx` — renders at all sizes; onClick is
  a true no-op (no popover, no navigation); renders only when role
  is employee; sets `--chat-pill-offset` on `<html>` on mount and
  removes it on unmount.
- `components/cross-tab-auth.test.tsx` — exercises the listener's
  event-to-navigation reducer in isolation. Mocks
  `supabase.auth.onAuthStateChange` so the test feeds synthetic
  events. Asserts: `SIGNED_IN` on `/login` calls `router.push("/app")`
  exactly once; `SIGNED_IN` on `/app` does not navigate; `SIGNED_OUT`
  on `/app` calls `router.push("/login")`; `SIGNED_OUT` on `/login`
  does not navigate; **`TOKEN_REFRESHED` NEVER navigates regardless
  of pathname**; the subscription is unsubscribed on unmount. This
  is the unit-level guard on FR-046.

**Sign-out styling consistency**: the sign-out button in three
locations — the profile dropdown menu item, the bottom of
`/app/account`, and the role placeholder — share the same
understated secondary styling (`<Button variant="secondary">`). No
single sign-out path uses a destructive or primary treatment. This
is enforced by reuse: all three render the same shared `<SignOutButton />`
sub-component (planned during `/speckit.tasks`).

### Playwright

Two new specs in `apps/web/tests/e2e/`:

- `employee-dashboard-shell.spec.ts` — the happy path covering US 1
  and US 2: sign in as a `demo.serenify.local` employee → land on
  `/app` → assert welcome banner with adaptive greeting + first
  name + three cards in correct order → open profile dropdown →
  assert three items → navigate to `/app/account` → assert five
  sections → edit full name → assert header updates → sign out →
  assert at `/login`. Theme toggle persistence asserted via a
  reload after toggle.
- `cross-tab-auth-sync.spec.ts` — per Decision N.

Preserved unchanged:

- All three role-trio specs from feature 001 (employee / team_lead /
  admin landing) — except for the role-conditional copy assertion on
  `/app`, which is updated to match the new shell or the role
  placeholder copy. FR-036.
- `login-expired-link.spec.ts` from hotfix `8dc822b` — unchanged.

### Smoke tests (`smoke-tests.md`)

Authored during `/speckit.tasks`. At minimum:

- **ST-1** Visual regression on each (auth) page at desktop and
  360px in both themes (SC-009).
- **ST-2** Notification component three-configuration check (SC-010)
  performed manually via the developer-preview mount.
- **ST-3** Employee vs. team_lead vs. admin landing rendered side-
  by-side (SC-007).
- **ST-4** Theme toggle persistence across browser restart (SC-002
  hardened — beyond the in-spec acceptance).
- **ST-5** Cross-tab sync timing observed (SC-008 ≤ 2s with a
  stopwatch on a local environment).
- **ST-6** Account-page full-name edit updates the header avatar
  initials and dropdown name on the same render cycle (SC-006).
- **ST-7** `prefers-reduced-motion: reduce` set in the OS — confirm
  notification entrance is opacity-only.

## DECISIONS.md entries this plan implies

Per Constitution Principle VIII, each architectural choice that
permanently shapes the codebase MUST be appended to
`docs/DECISIONS.md` during `/speckit.implement`. The planned entries
(date `2026-05-19+`, all under feature 003):

1. **shadcn/ui adopted on the Tailwind v4 path** — install command,
   `components.json` shape, baseColor `neutral`-overridden, CSS-vars
   mode. Decision A + Decision E.
2. **shadcn variable names mapped to Mist & Meadow tokens** —
   reproduces Decision B's mapping table. Names two load-bearing
   choices: `--destructive → crimson` + `--destructive-foreground →
   --color-bg` (FR-042 scope-clarified per CHANGELOG 2026-05-20:
   crimson permitted on destructive action surfaces, supersedes the
   earlier amber mapping that failed dark-mode WCAG AA at 1.4:1);
   `--primary-foreground → --color-bg` symmetric across both modes
   (the originally-asymmetric `--color-ink` in dark mode failed
   WCAG AA at ~3.1:1; symmetric mapping is the only AA-compliant
   choice). One load-bearing NON-mapping: `--color-muted` is
   intentionally NOT remapped — the original `--muted → --color-surface`
   draft collided with M&M's `--color-muted` (the muted-gray text
   token consumed by `text-muted`) and washed out every auth-page
   muted-text site because Tailwind v4's `@theme inline` inlines the
   resolved value into the `.text-muted` utility at compile time.
   Also names the single `--radius → --radius-control` line that maps
   shadcn's expected radius scale to the pre-existing Mist & Meadow
   control radius.
3. **Dark-mode attribute: `data-theme` → `class`** — Decision C.
   Names the breaking selector change in `globals.css` and the
   `attribute` prop change in `providers.tsx`.
4. **Component folder convention: bespoke under `components/ui/
   auth/`; shadcn flat in `components/ui/`; composite in
   `components/`** — Decision F.
5. **Notification component built on Radix Dialog + Framer Motion,
   NOT Sonner** — Decision G, including the rationale for
   `useReducedMotion` as the React-state gate.
6. **Notification component: explicit-dismiss only; no
   auto-dismiss** — Decision G clause.
7. **Welcome banner subtitle: "A space to check in with yourself."** —
   Decision M. Mohamed-chosen from three candidates in the plan-
   review pass; logs the rationale (reflective framing pairs with
   every adaptive greeting and primes the eventual passive-detection
   + questionnaire loop).
8. **Cross-tab auth listener mount point: root layout (`app/
   layout.tsx`), not (authed) layout** — Decision F of the user's
   directive (US 6 contradiction resolution).
9. **Playwright cross-tab spec pattern: single context, two
   pages** — Decision N. Names the storage-event mechanics that
   forbid two contexts.
10. **`framer-motion` added; `tailwindcss-animate` replaced by
    `tw-animate-css` on the v4 path** — names the dep deltas.
11. **Chat-pill / notification stacking convention via CSS
    variable** — the chat pill writes `--chat-pill-offset` on
    `<html>` on mount (Decision H). The notification consumes it
    via `bottom: calc(1rem + var(--chat-pill-offset, 0px) + 1rem)`,
    so consumers (features 007/008/010) get the 16px gap on
    employee pages and a clean 16px-from-edge fallback on manager
    pages where the pill is gated off. Documents this as the
    binding convention so future surfaces can join the stack
    without re-deriving the math.

Two `BACKLOG.md` additions (not decisions, but planned):

- **Dynamic welcome banner subtitle variants** — re-logged per
  FR-009's deferral. Mention that the surface accommodates a future
  swap (the single `<p>` slot beneath the greeting).
- **Notifications-section live controls** — re-logged per FR-021's
  placeholder. Surface to be filled in a later feature.

One `CHANGELOG.md` addition (APPENDED to the existing file — it
already holds entries from 2026-05-17 and 2026-05-18):

- **Note that the Out-of-Scope bullet in `spec.md` referring to the
  `/login?error=expired_link` hotfix is superseded** by commit
  `8dc822b` (merge of PR #2). The committed spec is NOT modified;
  the CHANGELOG entry records the supersession per the user's
  directive and Principle VIII's "spec amendments are recorded in
  CHANGELOG" rule.

Mohamed reviews all entries (and the CHANGELOG note) before
`/speckit.tasks`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| (none) | — | — |

The plan passes the Constitution Check without any waivers.
