---

description: "Ordered task list for feature 003-employee-dashboard-shell"
---

# Tasks: Employee Dashboard Shell

**Input**: Design documents from `/specs/003-employee-dashboard-shell/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/components.md, contracts/shadcn-mapping.md, quickstart.md

**Tests**: Per Constitution Principle VII, this feature ships Vitest + React Testing Library tests for every new component AND two new Playwright specs (`employee-dashboard-shell.spec.ts` happy path, `cross-tab-auth-sync.spec.ts` two-page propagation). Feature 001's role-trio Playwright suite and the `login-expired-link.spec.ts` from hotfix `8dc822b` are preserved unchanged (one copy-assertion update on the role-trio specs is the only permitted change).

**Organization**: Tasks follow the plan's **Branch Commit Ordering** (steps 1–13). Each step is a PR-sized unit; the ordering is contractual — earlier steps gate later steps, and CI must be green at the end of each step before the next starts. Tasks within a step are decomposed for traceability; commits group them as the plan describes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel within the same step (different files, no incomplete deps).
- **[Story]**: User-story label (`US1`–`US7`) for traceability — matches `spec.md` priorities.
- **⚠ Principle VII**: marker when a task introduces code without immediate test coverage; the line names the downstream task that exercises it.
- **📌 DECISION-n**: marker tagging the task as the source for DECISIONS.md entry `n` from plan.md's "DECISIONS.md entries this plan implies" list (entries 1–11). T056 in Phase 13 collects all entries — but the source task is named at the point of work so Mohamed can audit the entry against the actual diff.

## Path Conventions

Paths are repo-relative. All new code lives under `apps/web/`. The cross-tab listener at `apps/web/components/cross-tab-auth.tsx` is imported by `apps/web/app/layout.tsx` (the listener file itself does NOT live in `app/`; `app/` stays route-only per plan.md Decision F + the medium-fix-14 review pass).

## Cross-cutting notes

- **No schema migration in this feature**. `data-model.md` confirms zero new columns / tables / RLS policies. The shell reads/writes only `profiles.full_name` (the existing row-owner RLS from feature 001 covers self-edits) and reads `profiles.role` for the landing branch.
- **Mist & Meadow tokens stay verbatim** in `apps/web/app/globals.css`'s `@theme` block. The shadcn install adds a new `@theme inline` block that *maps* shadcn variable names onto Mist & Meadow tokens — it does NOT replace the palette. The 19-row mapping in `contracts/shadcn-mapping.md` (18 originals + `--destructive-foreground` added 2026-05-20) is the contract.
- **No red on affective and ambient surfaces** (Constitution Principle V; spec FR-042 scope-clarified per CHANGELOG 2026-05-20). shadcn's `--destructive` is remapped to the new `--color-crimson` token (`#7B4244` light, `#C17F81` dark), permitted only on destructive action surfaces. `--destructive-foreground` is symmetric `--color-bg`. The earlier amber mapping is superseded (it failed dark-mode WCAG AA at 1.4:1). Verified at the end of Step 3 by a static scan + manual visual check that flags any red outside the documented crimson token.
- **Auth surfaces stay bespoke** (FR-040, FR-043). The (auth) page files (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/onboarding`) MUST render byte-equivalent to `main` after the primitives extraction in Step 1. Verified by the unchanged-pass of feature 001's auth Playwright specs after every step (`admin-seeded.spec.ts`, `team-lead-seeded.spec.ts`, `employee-otp.spec.ts`, `employee-signup.spec.ts`, `reset-password.spec.ts`, `demo-coexistence.spec.ts`, `login-expired-link.spec.ts`).
- **The cross-tab listener mounts at the ROOT layout** (`apps/web/app/layout.tsx`), not the `(authed)` layout — per US 6 AS-1, propagation must fire when both tabs are at `/login`, which sit outside the (authed) tree.
- **Subtitle copy is locked**: "A space to check in with yourself." (plan.md Decision M, Mohamed-chosen in plan-review). Role-placeholder copy is also locked (Decision L). Any copy change during `/speckit.implement` requires a `docs/CHANGELOG.md` entry per Principle VIII.
- **CSS-variable stacking convention** (Decision H, 📌 DECISION-11): the chat pill writes `--chat-pill-offset` on `<html>` on mount; the notification reads it via `bottom: calc(1rem + var(--chat-pill-offset, 0px) + 1rem)`. Manager pages (no pill) collapse to `bottom: 2rem` automatically.
- **Stale Out-of-Scope bullet** about the `/login?error=expired_link` notice is superseded by hotfix `8dc822b`. The CHANGELOG entry already landed in plan-commit `e5b11cf`. `docs/BACKLOG.md` reclassification is T054 below.
- **Commit cadence**: one task = one commit (with a few exceptions noted inline where files share a single coherent unit). Commit messages use `<scope>(003): <imperative summary>` matching feature-002 convention.

---

## Phase 1: Setup (Pre-flight verification)

**Purpose**: Confirm the branch is rebased onto post-hotfix main and the toolchain prerequisites this feature's later steps depend on are intact. No code is written in this phase.

- [x] T001 [P] Verify `8dc822b` is in the branch's history: `git merge-base --is-ancestor 8dc822b HEAD` returns exit code 0. If not, rebase onto `main` before continuing — otherwise the references to `login-expired-link.spec.ts` and the CHANGELOG supersession note both become inaccurate. NOT a code task.
- [x] T002 [P] Verify `apps/web/tsconfig.json` declares `"paths": { "@/*": ["./*"] }` under `compilerOptions`. Required by every `@/components/ui/...` and `@/components/...` import in this feature. If absent (it should not be — feature 001 set it up), restore before Step 3 starts. NOT a code task.
- [x] T003 [P] Verify `apps/web/tests/e2e/login-expired-link.spec.ts` exists on the current branch. Required by Steps 1, 4, 7, 9, 10, 12 regression gates. NOT a code task.

**Checkpoint**: All three pre-flight items green. Step 1 may begin.

---

## Phase 2: Step 1 — Extract auth primitives to `components/ui/auth/` (US7) 🎯 prerequisite for shadcn

**Goal**: Move feature 001's bespoke auth primitives out of inlined page-file code into `apps/web/components/ui/auth/` so the shadcn install in Step 3 lands into an existing `components/ui/` directory without colliding with bespoke primitives. **No behavior change** — the (auth) pages render byte-equivalent to `main` after this step (US7 Acceptance Scenarios 1–4).

**Independent Test**: After T010 commits, run `npm run test:e2e --workspace=apps/web` — all auth Playwright specs (`admin-seeded.spec.ts`, `team-lead-seeded.spec.ts`, `employee-otp.spec.ts`, `employee-signup.spec.ts`, `reset-password.spec.ts`, `demo-coexistence.spec.ts`, `login-expired-link.spec.ts`) pass unchanged. Manual visual check: open each (auth) page at desktop and 360px in both themes; confirm no visual delta vs. `main`.

**📌 DECISION-4 sourced here** (Component folder convention: bespoke under `components/ui/auth/`, shadcn flat in `components/ui/`, composite outside `ui/`).

### Implementation for Step 1 (US7)

- [x] T004 [P] [US7] Move `apps/web/components/ui/password-input.tsx` → `apps/web/components/ui/auth/password-input.tsx`. File contents unchanged. Update no other files in this task (import sites land in T009).
- [x] T005 [P] [US7] Move `apps/web/components/ui/password-requirements.tsx` → `apps/web/components/ui/auth/password-requirements.tsx`. File contents unchanged.
- [x] T006 [P] [US7] Move `apps/web/app/(auth)/otp-panel.tsx` → `apps/web/components/ui/auth/otp-panel.tsx`. File contents unchanged. The file was not "inlined in a page file" so FR-038's exact wording does not cover it — but `research.md` R-6 identifies it as a logical peer of `PasswordInput` and includes it in the extraction. Import sites land in T009.
- [x] T007 [US7] Create `apps/web/components/ui/auth/field.tsx` exporting `Field` (a typed wrapper over `<input>` with id/label/error and password-input branching). The component contract is exactly the local `Field` definition currently inlined in `apps/web/app/(auth)/login/login-form.tsx` lines 154-195. Re-export the same `FieldProps` type. The implementation MUST be byte-equivalent to the inlined definitions so DOM and CSS class output are unchanged. ⚠ Principle VII: covered by T010 (auth Playwright regression).
- [x] T008 [US7] Grep `apps/web/app/(auth)/**` for any other primitive that is (a) inlined in a page or form file, (b) reused across two or more (auth) pages. Flag findings to plan-review rather than expanding scope unilaterally. **Expected outcome**: none — the inlined `Field` in T007 is the only such case based on the plan-time scan. If anything else is discovered, STOP and surface to Mohamed before extracting it.
- [x] T009 [US7] Update import sites: in each of `apps/web/app/(auth)/login/login-form.tsx`, `apps/web/app/(auth)/signup/signup-form.tsx`, `apps/web/app/(auth)/forgot-password/forgot-form.tsx`, `apps/web/app/(auth)/reset-password/reset-form.tsx`, `apps/web/app/(authed)/onboarding/onboarding-form.tsx`:
  - Replace the local `Field` declaration with `import { Field } from "@/components/ui/auth/field";`.
  - Update existing `import { PasswordInput } from "@/components/ui/password-input";` → `import { PasswordInput } from "@/components/ui/auth/password-input";`.
  - Update any `password-requirements` import similarly.
  Grep `apps/web/` for the literal `from "@/components/ui/password-input"` and `from "@/components/ui/password-requirements"` — both should return zero matches after this task. Grep for the literal `from "./otp-panel"` (used by (auth) pages today) and update those import sites to `from "@/components/ui/auth/otp-panel"`.
- [x] T010 [US7] Regression gate: run `npm run test:e2e --workspace=apps/web` from the repo root. All auth Playwright specs MUST pass unchanged. Run `npm run lint --workspace=apps/web` and `npm run typecheck --workspace=apps/web` — both green. Visual check on `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/onboarding` at desktop and 360px in both themes — no delta vs. `main`. NOT a code task; this is the human-validated US7 gate (SC-009).

**Checkpoint**: Step 1 complete. `apps/web/components/ui/auth/` exists with four files. (auth) pages still render identically. The directory is now ready to accept shadcn primitives flat alongside it.

---

## Phase 3: Step 2 — `next-themes` attribute migration (`data-theme` → `class`)

**Goal**: Flip the dark-mode attribute from `data-theme` to `class` so shadcn primitives in Step 3 land into a project whose CSS already targets `.dark`. Add `storageKey="serenify-theme"` to namespace the localStorage entry.

**Independent Test**: Theme toggle on every (auth) page and on `/app` (still the feature-001 placeholder at this point) continues to work. Reload — theme persists. Sign out / sign in — theme persists. The browser's localStorage shows a `serenify-theme` key.

**📌 DECISION-3 sourced here** (Dark-mode attribute migration `data-theme` → `class`).

### Implementation for Step 2

- [x] T011 Update `apps/web/app/providers.tsx`: change `attribute="data-theme"` → `attribute="class"`; add `storageKey="serenify-theme"`. Other props (`defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`) unchanged. ⚠ Principle VII: covered by T013 + the existing role-trio Playwright suite + the post-step manual visual check below.
- [x] T012 Update `apps/web/app/globals.css`: change the selector `:root[data-theme="dark"]` → `:root.dark`. The block contents (dark-mode color overrides) are unchanged. Mist & Meadow tokens stay verbatim.
- [x] T013 Grep `apps/web/` for the literal string `data-theme` — expected matches after T011+T012: zero. Grep for `[data-theme=` — expected: zero. If any other reference exists (e.g., a stray CSS selector in a (auth) page, a JS attribute write), flag to plan-review rather than silently editing. NOT a code task.
- [x] T014 Manual validation: open each (auth) page + the existing feature-001 `/app` placeholder. Click the theme toggle in the header. Confirm theme flips. Reload. Confirm theme persists. Open DevTools → Application → Local Storage → `http://localhost:3000`; confirm a `serenify-theme` key exists with value `"light"`, `"dark"`, or `"system"`. NOT a code task.

**Checkpoint**: Step 2 complete. The (auth) pages and the feature-001 placeholder still work identically; the dark selector is now `.dark`, ready for shadcn.

---

## Phase 4: Step 3 — Install shadcn/ui (Tailwind v4 path), configure mapping

**Goal**: Bring shadcn primitives into the project on the Tailwind v4 path. Configure `components.json`. Hand-reconcile `globals.css` so the existing Mist & Meadow `@theme` block survives and the shadcn variable names map to Mist & Meadow tokens via Decision B.

**Independent Test**: After T020 commits, run `npm run test:e2e --workspace=apps/web` — all (auth) Playwright specs pass unchanged (the (auth) pages import zero shadcn primitives, so the visual delta MUST be empty). Render a `<Button variant="destructive">Test</Button>` in a developer-preview surface; confirm it renders crimson (`#7B4244` light, `#C17F81` dark) with bg-colored text per the symmetric `--destructive-foreground` mapping. Not amber, not shadcn-default red.

**📌 DECISION-1 sourced here** (shadcn/ui adopted on Tailwind v4 path: install command, `components.json` shape, baseColor `neutral` overridden, CSS-vars mode).
**📌 DECISION-2 sourced here** (CSS-variable mapping: 19-row table including `--destructive → crimson` + `--destructive-foreground → --color-bg` per CHANGELOG 2026-05-20 scope clarification of FR-042; `--muted → --color-surface` not `--color-border`; `--primary-foreground → --color-bg` symmetric across modes for WCAG AA; `--radius → --radius-control`).
**📌 DECISION-10 sourced here** (`framer-motion` added; `tailwindcss-animate` replaced by `tw-animate-css` on the v4 path).

### Implementation for Step 3

- [x] T015 From `apps/web/`, run `npx shadcn@latest init`. Pick: CSS-vars mode = yes, baseColor = `neutral`, iconLibrary = `lucide`. **Refuse** the CLI's offer to overwrite `globals.css` — the existing Mist & Meadow `@theme` block must survive. The CLI writes `apps/web/components.json` and adds `class-variance-authority`, `clsx`, `tailwind-merge`, and `tw-animate-css` to `package.json`. ⚠ Principle VII: covered by T020 + per-step regression.
- [x] T016 Verify `apps/web/components.json` matches the shape in plan.md Decision E. Specifically: `"style": "default"`, `"rsc": true`, `"tsx": true`, `"tailwind.config": ""`, `"tailwind.css": "app/globals.css"`, `"tailwind.baseColor": "neutral"`, `"tailwind.cssVariables": true`, `"aliases.ui": "@/components/ui"`, `"aliases.components": "@/components"`, `"aliases.utils": "@/lib/utils"`, `"aliases.lib": "@/lib"`, `"aliases.hooks": "@/hooks"`, `"iconLibrary": "lucide"`. If the CLI's emission differs, hand-edit to match.
- [x] T017 Hand-reconcile `apps/web/app/globals.css`: add the `@theme inline` block from `contracts/shadcn-mapping.md` (the canonical implementation section). The block maps shadcn variable names onto the pre-existing Mist & Meadow tokens. **All entries use the `--color-*` prefix** (e.g. `--color-destructive`, not `--destructive`) — Tailwind v4 generates utility classes only from `--color-*`-prefixed tokens (research.md R-2.1). Pay special attention to the three load-bearing mappings: `--color-destructive → var(--color-crimson)` + `--color-destructive-foreground → var(--color-bg)` (FR-042 scope-clarified per CHANGELOG 2026-05-20; supersedes the earlier amber mapping that failed dark-mode WCAG AA at 1.4:1), `--color-muted → var(--color-surface)` (NOT `--color-border` — research.md R-2), `--color-primary-foreground → var(--color-bg)` symmetric across modes (research.md R-2 WCAG AA rationale). Also add the 7-step radius ladder (`--radius-sm` through `--radius-4xl`) anchored to `--radius-control` (8px) and `--radius-card` (12px) so Tailwind generates `rounded-{sm,md,lg,xl,2xl,3xl,4xl}` (radius-card and radius-control are pre-existing from feature 001; no new declarations of those).
- [x] T018 Create or augment `apps/web/lib/utils.ts` to export `cn(...inputs: ClassValue[]): string` using `clsx` + `tailwind-merge`. The shadcn CLI may have placed it during init; if so, this task is a verify-and-commit only.
- [x] T019 Run `npx shadcn@latest add button card dropdown-menu sheet dialog avatar separator` from `apps/web/`. Each primitive's emitted file lands in `apps/web/components/ui/`. Note: shadcn does NOT touch `apps/web/components/ui/auth/` because that subfolder is not in shadcn's emission path; the bespoke auth primitives survive untouched per FR-040.
- [x] T020 Regression gate: run `npm run test:e2e --workspace=apps/web`. All (auth) Playwright specs MUST pass unchanged — the (auth) pages import zero shadcn primitives, so the diff at this step MUST be visually empty on those surfaces. Run `npm run lint --workspace=apps/web` and `npm run typecheck --workspace=apps/web` — both green. Manual: in a developer-preview file (temporary; delete before commit), mount `<Button variant="destructive">Test</Button>` and run two computed-style probes (DevTools or Playwright MCP, not just visual eyeball — research.md R-2.1's symptom was that the button LOOKED unstyled but the eye couldn't tell whether Tailwind had generated the class or the colors were just wrong): (a) `getComputedStyle(button).backgroundColor` MUST be `rgb(123, 66, 68)` in light mode (`#7B4244`) and `rgb(193, 127, 129)` in dark mode (`#C17F81`); (b) `getComputedStyle(button).color` MUST be `rgb(236, 238, 233)` in light mode (`#ECEEE9`) and `rgb(22, 25, 23)` in dark mode (`#161917`); (c) `getComputedStyle(button).borderRadius` MUST be a real px value (not `0px`, which would indicate the radius ladder is missing). Not amber, not shadcn-default red, not transparent. NOT a code task (the temporary preview file does not commit).

**Checkpoint**: Step 3 complete. shadcn primitives are available at `@/components/ui/{button,card,dropdown-menu,sheet,dialog,avatar,separator}`. Mist & Meadow tokens drive every variable. (auth) pages unchanged.

---

## Phase 5: Step 4 — Header + center nav + profile dropdown (US1, US2)

**Goal**: Build the persistent header that renders on every authenticated page. Header is a Server Component reading `profiles.full_name` and `profiles.role`; sub-components are Client Components where state or `usePathname` is needed. Center nav has only "Home" active in this feature. Profile dropdown contains exactly three items per FR-003.

**Independent Test**: After T030 commits, an employee signing in lands at the existing `/app` (still wrapped in the new shell at this point even though the body is unchanged) and sees the full header — logo, "Home" active in the center nav, theme toggle in the right cluster, profile avatar/dropdown. Clicking the avatar opens a dropdown with display name + Account link + Sign out. At 360px the center nav collapses to a hamburger; the avatar stays as its own separate trigger.

### Implementation for Step 4 (US1, US2)

- [ ] T021 [P] [US1] Create `apps/web/lib/truncate-name.ts` exporting `truncateName(input: string, max?: number = 24): string`. Pure function per plan.md Decision K — no `Intl` / locale APIs, no `Date`, no env reads. Returns `input` if `input.length <= max`; otherwise `input.slice(0, max - 1) + "…"` (Unicode U+2026, not three ASCII dots). ⚠ Principle VII: covered by T029 (Vitest tests for truncate-name + the components that consume it).
- [ ] T022 [P] [US1] [US2] Create `apps/web/components/header/header.tsx` **[server]** per `contracts/components.md`. Props: `{ fullName: string | null; email: string; role: "employee" | "team_lead" | "admin" }`. Renders logo → `<CenterNav />` → right cluster (theme toggle, JSX comment marker for feature-010 talk slot, `<ProfileDropdown />`). Mobile (≤768px): center nav replaced by `<MobileMenu />`. ⚠ Principle VII: covered by T029.
- [ ] T023 [P] [US1] Create `apps/web/components/header/center-nav.tsx` **[client]** (uses `usePathname()`). Renders `<nav aria-label="Workflow destinations">` containing only "Home" → `/app` in this feature. Active state per plan.md Decision J: `bg-surface rounded-md` when pathname starts with `/app`; no underline; normal text weight. Returns `null` at ≤768px.
- [ ] T024 [P] [US1] [US2] Create `apps/web/components/header/profile-dropdown.tsx` **[client]** using `@/components/ui/dropdown-menu` and `@/components/ui/avatar`. Trigger: avatar with initials per Decision K (`fullName` if present → first letter of first token + first letter of last token, uppercased; fallback → first two letters of email local-part, uppercased; single-token names → first two letters of that token). Content: three items in order — display name (truncated via `truncateName`), Account link → `/app/account`, Sign out (uses the shared `<SignOutButton variant="secondary">` from T026).
- [ ] T025 [P] [US1] Create `apps/web/components/header/mobile-menu.tsx` **[client]**. Renders Lucide `<Menu>` icon button (≥44×44px). On click opens a `<Sheet>` (`@/components/ui/sheet`) listing workflow destinations vertically. Profile avatar is NOT inside the sheet per FR-005 — it sits in the header separately at all viewport widths.
- [ ] T026 [P] [US1] [US2] Create `apps/web/components/sign-out-button.tsx` **[client]** — a tiny shared sub-component used by ProfileDropdown (T024), the account-page Sign out section (T037), and the role placeholder (T046). Wraps `<form action={signOut}>` (reuses the existing `signOut` server action at `apps/web/app/(authed)/actions.ts` — feature-001 unchanged) and renders a `<Button variant="secondary">Sign out</Button>`. This is the "sign-out styling consistency" enforcement point from the plan's medium-fix-9.
- [ ] T027 [US1] [US2] Replace `apps/web/app/(authed)/layout.tsx` body content with the new shell. Keep the existing `supabase.auth.getUser()` route guard and the `redirect("/login")` on missing user (feature-001 contract preserved). Read `profiles.full_name`, `profiles.role`, and the user email in a single Server Component pass; pass them as props to `<Header />`. Render `<Header />` above `<main>{children}</main>`. Do NOT render the chat pill yet — that lands in Step 7 (T040). Do NOT add the cross-tab listener — that lands at the root layout in Step 10 (T049).
- [ ] T028 [P] [US1] [US2] Create `apps/web/components/sign-out-button.test.tsx`, `apps/web/components/header/header.test.tsx`, `apps/web/components/header/center-nav.test.tsx`, `apps/web/components/header/profile-dropdown.test.tsx`, `apps/web/components/header/mobile-menu.test.tsx`. Coverage per plan.md "Test Strategy → Vitest + React Testing Library":
  - `header.test.tsx` asserts the right-cluster contains exactly two children in order (`ThemeToggle` then `ProfileDropdown`) — per medium-fix-2, JSX comments do not render. When feature 010 inserts `<TalkButton />`, this flips to three children.
  - `profile-dropdown.test.tsx` opens on click; contains exactly three items in the documented order; sign out triggers the expected action.
  - The other test files cover their respective FR contracts.
- [ ] T029 [P] [US1] Create `apps/web/lib/truncate-name.test.ts`: asserts pure-function behavior — same input produces same output across repeated calls; identical output on server-equivalent and client-equivalent runs (test the function in isolation, no SSR/CSR simulation needed because there's nothing locale-dependent); single-character ellipsis at the boundary; passes through short names unchanged.
- [ ] T030 [US1] [US2] Manual validation: sign in as a `*@demo.serenify.local` employee. Verify header renders with logo, "Home" active, theme toggle, profile avatar (with initials). Click avatar → dropdown shows name + Account + Sign out. Resize to 360px → center nav collapses to hamburger; avatar stays separate. NOT a code task.

**Checkpoint**: Step 4 complete. Header is shipped. `/app` body is still the feature-001 placeholder (it's wrapped in the new shell now but the placeholder content sits inside `<main>`). Profile dropdown works. Mobile hamburger works.

---

## Phase 6: Step 5 — `/app/account` page with five sections (US2, US3)

**Goal**: Build the `/app/account` route with five stacked sections (Profile, Security, Privacy placeholder, Notifications placeholder, Sign out). Profile section edits `full_name`; Security section routes to feature 001's `/forgot-password` flow.

**Independent Test**: After T038 commits, an employee navigates to `/app/account` from the profile dropdown. Sees the five sections in order. Edits full_name → save → header avatar/initials and dropdown display name update immediately on the same render cycle. Clicks "Change password" → lands on `/forgot-password`. Clicks the bottom Sign out button → redirected to `/login`.

### Implementation for Step 5 (US2, US3)

- [ ] T031 [US2] Create `apps/web/app/(authed)/app/account/page.tsx` **[server]**. Reads `auth.users` (for email) and `profiles` (for `full_name`) once; passes values as props to the section components. Lays out the five sections vertically with separators between them (uses `@/components/ui/separator`). Page is role-agnostic per spec Edit-1 (FR-015) — same content for employee, team_lead, and admin. The chat pill is gated by role at the layout level, not here.
- [ ] T032 [P] [US2] Create `apps/web/app/(authed)/app/account/actions.ts` exporting the `updateProfile` server action per `data-model.md`. Validates `full_name` via `z.object({ full_name: z.string().trim().min(1, "Name can't be empty").max(60, "Keep it under 60 characters") })`. Writes via the SSR Supabase client (row-owner RLS from feature 001). Calls `revalidatePath("/app")` and `revalidatePath("/app/account")` on success. Returns `{ status: "ok" } | { status: "invalid"; message: string }`. ⚠ Principle VII: covered by T038 (Playwright happy-path covers the edit).
- [ ] T033 [P] [US2] Create `apps/web/components/account/profile-section.tsx` **[client]**. Uses `react-hook-form` + `zodResolver` (already installed) + `useTransition`, matching the (auth) form pattern. Imports `Field` from `@/components/ui/auth/field` for the full_name input. Email rendered as plain read-only text per FR-018. Avatar/initials placeholder uses the same `<Avatar>` from `@/components/ui/avatar` but at a larger size than the header. On submit success, calls a parent state setter (via prop or React Context) so the header avatar/initials and dropdown display name update on the same render cycle without a full reload — FR-017 / SC-006.
- [ ] T034 [P] [US3] Create `apps/web/components/account/security-section.tsx` **[server]**. Renders a short label + explanatory paragraph + `<Link href="/forgot-password">` styled as `<Button variant="secondary">Change password</Button>`. No inline form. No new email template. Routes through feature 001's existing reset flow per FR-020.
- [ ] T035 [P] [US2] Create `apps/web/components/account/privacy-placeholder.tsx` **[server]**. Renders a `<Card>` with `border-2 border-dashed border-border` styling, muted body text describing that visibility controls arrive with feature 010. No live controls.
- [ ] T036 [P] [US2] Create `apps/web/components/account/notifications-placeholder.tsx` **[server]**. Same shape as privacy-placeholder but with notifications copy ("TBD" framing — calm-voice). No live controls.
- [ ] T037 [P] [US2] Create `apps/web/components/account/sign-out-section.tsx` **[server]**. Uses the shared `<SignOutButton variant="secondary">` from T026 (the sign-out styling consistency rule). Wrapped in a minimal section header.
- [ ] T038 [P] [US2] [US3] Vitest + RTL tests: `apps/web/components/account/profile-section.test.tsx` (validation, submit, optimistic update), `security-section.test.tsx` (link routing assertion), `privacy-placeholder.test.tsx` + `notifications-placeholder.test.tsx` (rendered, no live controls present).
- [ ] T039 [US2] [US3] Manual validation: navigate to `/app/account` via the dropdown. Confirm five sections in order. Edit name → save → header reflects new name immediately. Click "Change password" → arrives at `/forgot-password`. Click bottom Sign out → arrives at `/login`. NOT a code task.

**Checkpoint**: Step 5 complete. `/app/account` is shipped. US2 (profile dropdown + account management) and US3 (password change through Security) are both functional.

---

## Phase 7: Step 6 — `/app` body for employee role (US1)

**Goal**: Replace the existing feature-001 `/app` placeholder body with the welcome banner + three skeleton cards in the documented 60/40 layout. Adaptive greeting per FR-008. Subtitle "A space to check in with yourself." per Decision M.

**Independent Test**: An employee on `/app` sees "Good morning, [first name]" (or afternoon/evening) + the subtitle + three cards laid out 60% left ("Today's check-in") / 40% right (with "Things that might help" stacked above "Recent chats"). At 360px the three cards stack vertically in the order Today's check-in → Things that might help → Recent chats. Empty-state copy in each card is calm; no exclamation marks; no red.

**📌 DECISION-7 sourced here** (Welcome banner subtitle: "A space to check in with yourself.").

### Implementation for Step 6 (US1)

- [ ] T040 [P] [US1] Create `apps/web/components/home/welcome-banner.tsx` **[server]**. Props: `{ fullName: string | null }`. Renders adaptive greeting (server's local time per `contracts/components.md` — the timezone-deferral follow-up is logged in BACKLOG, not in scope here) + first-name extraction per FR-010 + fallback per Decision K. Subtitle is the locked string from Decision M.
- [ ] T041 [P] [US1] Create `apps/web/components/home/todays-checkin-card.tsx` **[server]**. Uses `@/components/ui/card`. Calm "not yet" empty-state copy — final wording set in this task, must satisfy: no exclamation marks; no alarmist or clinical language; supportive voice. The card visually claims ~60% of desktop width via the parent layout's grid columns.
- [ ] T042 [P] [US1] Create `apps/web/components/home/things-that-might-help-card.tsx` **[server]**. Smaller secondary card with calm "not yet" empty-state copy acknowledging that suggestions land here when they're useful.
- [ ] T043 [P] [US1] Create `apps/web/components/home/recent-chats-card.tsx` **[server]**. Smaller secondary card with calm "not yet" empty-state copy acknowledging past conversations show up here.
- [ ] T044 [US1] Update `apps/web/app/(authed)/app/page.tsx` to assemble the employee shell body for `role === "employee"`. Layout per FR-011: desktop `grid-cols-[3fr_2fr]` (or equivalent ~60/40) with the right column hosting a vertical stack of "Things that might help" → "Recent chats". At ≤768px: `grid-cols-1` with all three cards stacked in the documented top-to-bottom order. The role branch for team_lead / admin lands in Step 9 (T046) — for now, non-employees still see the existing feature-001 role-banner placeholder body.
- [ ] T045 [P] [US1] Vitest + RTL tests: `apps/web/components/home/welcome-banner.test.tsx` (adaptive greeting branches; null full_name fallback; subtitle locked), `todays-checkin-card.test.tsx` / `things-that-might-help-card.test.tsx` / `recent-chats-card.test.tsx` (empty-state copy contains no exclamation marks and no item from the alarmist blocklist).

**Checkpoint**: Step 6 complete. Employees see the new home page; team_leads and admins still see the feature-001 role-banner placeholder body inside the new shell (Step 9 replaces that).

---

## Phase 8: Step 7 — Persistent chat pill (US1)

**Goal**: Ship the visual-only chat pill anchored bottom-right on employee-role authed pages. Sets `--chat-pill-offset` on `<html>` per Decision H so the notification component (Step 8) can stack 16px above it.

**Independent Test**: An employee on `/app` or `/app/account` sees the chat pill bottom-right. Click → no-op (no popover, no navigation). At 360px → collapses to icon-only floating button, ≥44×44px touch target. Devtools → `<html>` element has `--chat-pill-offset: 48px` style attribute while the pill is mounted. team_lead and admin pages → no pill rendered.

**📌 DECISION-11 sourced here** (Chat-pill / notification stacking via `--chat-pill-offset` CSS variable). Notification half lands in Step 8.

### Implementation for Step 7 (US1)

- [ ] T046 [US1] Create `apps/web/components/chat-pill.tsx` **[client]** per `contracts/components.md`. Exports `ChatPill` and `CHAT_PILL_HEIGHT = 48`. Renders a `fixed bottom-4 right-4` capsule on desktop, icon-only circle on mobile (≤768px). `bg-surface`, `border-border`, meadow icon. Touch target ≥44×44px (FR-025). On click: **true no-op** (no popover per medium-fix-11, FR-024). On mount: `document.documentElement.style.setProperty("--chat-pill-offset", "${CHAT_PILL_HEIGHT}px")`; on unmount: `document.documentElement.style.removeProperty("--chat-pill-offset")`. ⚠ Principle VII: covered by T048.
- [ ] T047 [US1] Update `apps/web/app/(authed)/layout.tsx`: render `<ChatPill />` outside the `<main>` element (so it persists across `/app` → `/app/account` navigation) and conditionally on `role === "employee"` (FR-035). The layout already reads `role` from T027.
- [ ] T048 [P] [US1] Create `apps/web/components/chat-pill.test.tsx`: renders at desktop and mobile sizes; onClick is a true no-op (no popover opens); sets `--chat-pill-offset` on mount; removes it on unmount; renders only when `role === "employee"`.

**Checkpoint**: Step 7 complete. Chat pill ships on employee pages. CSS-variable offset is wired for the notification's positioning math.

---

## Phase 9: Step 8 — Notification toast/sheet component (US5)

**Goal**: Build the reusable notification component on Radix Dialog + Framer Motion + `useMediaQuery`. Built but NOT mounted by any production code in this feature (FR-033). Features 007 / 008 / 010 will consume it.

**Independent Test**: After T053 commits, the Vitest + RTL test suite for `notification.test.tsx` passes in three configurations — desktop slide-in, mobile bottom sheet, reduced-motion (opacity-only). The notification's `bottom` value resolves to `2rem` when the chat pill is not mounted (manager pages) and to `calc(1rem + 48px + 1rem) = 80px` when the pill is mounted (employee pages).

**📌 DECISION-5 sourced here** (Notification component built on Radix Dialog + Framer Motion, NOT Sonner).
**📌 DECISION-6 sourced here** (Notification component: explicit-dismiss only; no auto-dismiss).

### Implementation for Step 8 (US5)

- [ ] T049 [P] [US5] Add `framer-motion` to `apps/web/package.json` as a runtime dependency (caret-pinned to the latest stable; exact version locked at this task's commit time). Run `npm install --workspace=apps/web`. ⚠ Principle VII: covered transitively by T052.
- [ ] T050 [P] [US5] Create `apps/web/hooks/use-media-query.ts` exporting `useMediaQuery(query: string): boolean`. Standard `matchMedia` hook with SSR safety: returns `false` during SSR and on first client render until `matchMedia` has been queried; flips to the real value on first effect. ⚠ Principle VII: covered by T052 (consumed by `notification.tsx`).
- [ ] T051 [US5] Create `apps/web/components/notification.tsx` **[client]** per `contracts/components.md`. Composes Radix Dialog (already added via `shadcn add dialog` in T019) + Framer Motion + `useMediaQuery`. Desktop (≥768px): bottom-right slide-in card positioned at `bottom: calc(1rem + var(--chat-pill-offset, 0px) + 1rem); right: 1rem;`. Mobile (≤768px): full-width bottom sheet. `useReducedMotion()` from Framer collapses the variants to opacity-only when set. Explicit dismiss control only — no auto-dismiss. Exports `Notification`, `type NotificationProps`. JSDoc captures the stacking convention per medium-fix-3.
- [ ] T052 [US5] Create `apps/web/components/notification.test.tsx`: three configurations — `useMediaQuery` mocked to `false` (desktop slide-in variant active), mocked to `true` (mobile bottom-sheet variant active), and `useReducedMotion` mocked to `true` (opacity-only variant active). Asserts the dismiss control closes the surface. Asserts the desktop `bottom` style resolves correctly with and without `--chat-pill-offset` set on the document element.
- [ ] T053 [US5] Verify no production code mounts the notification component (FR-033). Grep `apps/web/` for imports of `@/components/notification` — expected matches: only `apps/web/components/notification.test.tsx`. If any non-test import exists, STOP and surface to Mohamed before continuing.

**Checkpoint**: Step 8 complete. Notification component is shipped, tested, unmounted. Features 007 / 008 / 010 inherit the contract.

---

## Phase 10: Step 9 — Role placeholders for team_lead / admin (US4)

**Goal**: For users with `profiles.role` of `team_lead` or `admin`, replace the feature-001 role-banner placeholder body with the one-screen role-acknowledging surface from Decision L. The header (logo, theme toggle, reserved talk slot, profile avatar) renders identically to the employee shell — only the body content differs. The chat pill is NOT rendered (FR-035, already gated in T047).

**Independent Test**: A team_lead signs in → lands on `/app` → sees the centered placeholder ("Your team-lead view is coming together." + subtitle + Sign out button). Header is full. No welcome banner, no skeleton cards, no chat pill. Admin signs in → same pattern with the admin copy variant. Sign out from the placeholder → arrives at `/login`.

### Implementation for Step 9 (US4)

- [ ] T054 [P] [US4] Create `apps/web/components/role-placeholder/role-placeholder.tsx` **[server]** per `contracts/components.md`. Props: `{ role: "team_lead" | "admin" }`. Renders the locked Decision L copy: team_lead heading "Your team-lead view is coming together." + subtitle; admin heading "Your admin view is in progress." + subtitle. Layout: centered single column with `py-24 sm:py-32`, DM Serif Display heading, Inter subtitle in `text-muted`, `<SignOutButton variant="secondary">` (T026) beneath. ⚠ Principle VII: covered by T056 + Playwright role-trio update in T057.
- [ ] T055 [US4] Update `apps/web/app/(authed)/app/page.tsx` (modifying T044's work): branch on `profile.role`. For `employee`, render the employee shell body (welcome banner + three cards from Step 6). For `team_lead` or `admin`, render `<RolePlaceholder role={profile.role} />`. The chat pill render condition in `(authed)/layout.tsx` (T047) is already employee-only, so no additional gating needed here.
- [ ] T056 [P] [US4] Create `apps/web/components/role-placeholder/role-placeholder.test.tsx`: renders the team_lead copy for `role="team_lead"`; renders the admin copy for `role="admin"`; asserts the welcome banner is NOT present (queryBy for a banner-specific text); asserts the chat pill is NOT present (queryBy for a pill-specific aria-label).
- [ ] T057 [US4] Update the role-trio Playwright specs to assert against the new role-placeholder copy. Grep `apps/web/tests/e2e/` for the literal `data-testid="role-banner"` and `role-banner` references. Update every matching assertion to target the new contract:
  - **admin/team_lead specs** (`admin-seeded.spec.ts`, `team-lead-seeded.spec.ts`, and any other file the grep surfaces) → assert the role-placeholder copy is visible ("Your admin view is in progress." / "Your team-lead view is coming together.").
  - **employee specs** (whichever file(s) the grep finds — at plan-time scan: none, but the grep is the authority, not the plan-time scan) → drop the role-banner assertion; the welcome banner check in T064's `employee-dashboard-shell.spec.ts` is the new employee contract.

  This is **the one permitted change to feature 001's auth Playwright specs**, scoped strictly to copy assertions per FR-036. Any non-copy change to these specs is a regression and blocks the merge.
- [ ] T058 [US4] Manual validation: sign in as a `*@demo.serenify.local` team_lead → confirm placeholder + header + no chat pill. Repeat for admin. Sign out from each placeholder → arrives at `/login`. NOT a code task.

**Checkpoint**: Step 9 complete. Role-routing contract preserved (FR-036, SC-007). team_lead and admin landings are calm and explicit.

---

## Phase 11: Step 10 — Cross-tab auth state listener (US6)

**Goal**: Mount a single `supabase.auth.onAuthStateChange` listener at the root layout so two-tab propagation works (sign-in in one tab → other tab navigates to `/app`; sign-out in one tab → other tab navigates to `/login`). `TOKEN_REFRESHED` events are silent.

**Independent Test**: After T062 commits, `npm run test:e2e --workspace=apps/web -- cross-tab-auth-sync` passes. Two `/login` tabs in the same browser context: sign in in tab A → tab B navigates to `/app` within 2s. Sign out in tab A via UI → tab B navigates to `/login` within 2s.

**📌 DECISION-8 sourced here** (Cross-tab auth listener mount point: root layout, not (authed) layout).
**📌 DECISION-9 sourced here** (Playwright cross-tab spec pattern: single context, two pages; sign-in via form, sign-out via dropdown click).

### Implementation for Step 10 (US6)

- [ ] T059 [US6] Create `apps/web/components/cross-tab-auth.tsx` **[client]** per `contracts/components.md`. The file lives under `components/` so `app/` stays route-only (medium-fix-14). Subscribes to `supabase.auth.onAuthStateChange` once on mount; returns `null`. Pathname-gates per FR-046: `SIGNED_IN` on `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/` → `router.push("/app")`. `SIGNED_OUT` on `/app`, `/onboarding` → `router.push("/login")`. `TOKEN_REFRESHED` → no-op. All other transitions → no-op. Cleans up subscription on unmount.
- [ ] T060 [US6] Update `apps/web/app/layout.tsx`: import `CrossTabAuth` from `@/components/cross-tab-auth` and render it as a sibling of `<Providers>` inside `<body>`. No prop changes; component is a self-contained listener.
- [ ] T061 [P] [US6] Create `apps/web/components/cross-tab-auth.test.tsx` per medium-fix-8. Mocks `supabase.auth.onAuthStateChange`; feeds synthetic events. Asserts:
  - `SIGNED_IN` on `/login` calls `router.push("/app")` exactly once.
  - `SIGNED_IN` on `/app` does NOT navigate.
  - `SIGNED_OUT` on `/app` calls `router.push("/login")`.
  - `SIGNED_OUT` on `/login` does NOT navigate.
  - **`TOKEN_REFRESHED` NEVER navigates regardless of pathname**.
  - The subscription is unsubscribed on unmount.

  This is the unit-level guard on FR-046.
- [ ] T062 [US6] Create `apps/web/tests/e2e/cross-tab-auth-sync.spec.ts` per plan.md Decision N. **Single `context.newContext()`, two `context.newPage()` instances** so localStorage is shared (the `storage` event mechanics require shared storage). Sign-in driven via the real `/login` form in pageA. Sign-out driven via the profile dropdown UI in pageA (NOT `page.evaluate(client.auth.signOut())` per critical-fix-1). Asserts pageB navigates to `/app` within 2s on sign-in; to `/login` within 2s on sign-out. Uses the demo cohort password `DemoUser123!`.
- [ ] T063 [US6] Manual validation: open two `/login` tabs. Sign in tab A with an employee demo user → tab B navigates to `/app`. Sign out tab A via profile dropdown → tab B navigates to `/login`. Stopwatch each propagation; record ≤ 2s. NOT a code task.

**Checkpoint**: Step 10 complete. Cross-tab sync ships. US 6 closed.

---

## Phase 12: Steps 11–12 — Import migration verification + full test pass

**Goal**: Verify no stale imports remain after the extraction sweep. Run the full Vitest + Playwright suites. Run typecheck + lint. Author the Playwright happy-path spec for the employee role.

**Independent Test**: `npm run test --workspace=apps/web` green. `npm run test:e2e --workspace=apps/web` green. `npm run typecheck --workspace=apps/web` and `npm run lint --workspace=apps/web` both green. No grep matches for the legacy import paths.

### Implementation for Steps 11–12

- [ ] T064 [P] [US1] [US2] Create `apps/web/tests/e2e/employee-dashboard-shell.spec.ts` — the Playwright happy-path covering US 1 and US 2:
  1. Sign in as a `*@demo.serenify.local` employee.
  2. Assert `/app` shows the welcome banner with the adaptive greeting + first name; the three skeleton cards in the documented order; the persistent header; the chat pill bottom-right.
  3. Click the theme toggle. Reload. Assert theme persists.
  4. Click the profile avatar → assert dropdown shows three items in order.
  5. Click "Account" → navigate to `/app/account`. Assert five sections in order.
  6. Edit the full_name field. Submit. Assert the header avatar/initials and dropdown display name reflect the new value WITHOUT a full reload (same render cycle, SC-006).
  7. Click the bottom Sign out button. Assert at `/login`.

  This is the SC-012 employee-role Playwright gate.
- [ ] T065 [P] Grep `apps/web/` for stale import paths after the extraction:
  - `from "@/components/ui/password-input"` → expected zero matches (all paths use `@/components/ui/auth/password-input` now).
  - `from "@/components/ui/password-requirements"` → expected zero.
  - `from "./otp-panel"` → expected zero (all paths use `@/components/ui/auth/otp-panel`).
  Any non-zero match → fix the import and re-grep.
- [ ] T066 Run the full test pass:
  - `npm run typecheck --workspace=apps/web` — zero errors.
  - `npm run lint --workspace=apps/web` — zero warnings.
  - `npm run test --workspace=apps/web` — Vitest suite green (all per-component tests + cross-tab-auth reducer test + truncate-name test).
  - `npm run test:e2e --workspace=apps/web` — Playwright suite green (the seven auth specs from feature 001 + the hotfix's `login-expired-link.spec.ts` + the two new specs `employee-dashboard-shell.spec.ts` and `cross-tab-auth-sync.spec.ts`).
  Any failure blocks Phase 13.

**Checkpoint**: Steps 11–12 complete. All tests green. Branch is mergeable pending smoke-test pass + DECISIONS.md + BACKLOG.md hygiene.

---

## Phase 13: Step 13 — DECISIONS.md, BACKLOG.md, smoke-tests, PROGRESS

**Goal**: Append the 11 DECISIONS.md entries this plan implies. Append two BACKLOG.md follow-ups. Reclassify the expired-link entry in BACKLOG. Author smoke-tests.md (already drafted alongside this tasks.md). Mohamed runs the smoke tests. PROGRESS.md updated.

### Implementation for Step 13

- [ ] T067 [P] Append **11 entries** to `docs/DECISIONS.md` per plan.md "DECISIONS.md entries this plan implies". Each entry is dated `2026-05-20` (current date at `/speckit.tasks` time; if `/speckit.implement` lands across multiple days, use the actual date of each entry's commit). Append-only; existing decisions are not edited.
  1. **shadcn/ui adopted on the Tailwind v4 path** — install command, `components.json` shape, baseColor `neutral`-overridden, CSS-vars mode. Sources: T015, T016. (DECISION-1)
  2. **shadcn variable names mapped to Mist & Meadow tokens** — reproduces the 19-row mapping table from `contracts/shadcn-mapping.md`. Names the three load-bearing choices: `--destructive → crimson` + `--destructive-foreground → --color-bg` (FR-042 scope-clarified per CHANGELOG 2026-05-20; supersedes the earlier amber mapping that failed dark-mode WCAG AA at 1.4:1); `--muted → --color-surface` (not border, per research.md R-2); `--primary-foreground → --color-bg` symmetric across both modes (WCAG AA per research.md R-2). Also the `--radius → --radius-control` mapping. Source: T017. (DECISION-2)
  3. **Dark-mode attribute: `data-theme` → `class`** — names the breaking selector change in `globals.css` and the `attribute` prop change in `providers.tsx`. Source: T011, T012. (DECISION-3)
  4. **Component folder convention: bespoke under `components/ui/auth/`; shadcn flat in `components/ui/`; composite outside `ui/`**. Source: Phase 2 (Step 1) as a whole; cite T004–T009. (DECISION-4)
  5. **Notification component built on Radix Dialog + Framer Motion, NOT Sonner** — including the `useReducedMotion` React-state gate rationale. Source: T051. (DECISION-5)
  6. **Notification component: explicit-dismiss only; no auto-dismiss** — names that consuming features may layer auto-dismiss on top. Source: T051. (DECISION-6)
  7. **Welcome banner subtitle: "A space to check in with yourself."** — Mohamed-chosen from three candidates in the plan-review pass; rationale: reflective framing pairs with every adaptive greeting and primes the eventual passive-detection + questionnaire loop. Source: T040. (DECISION-7)
  8. **Cross-tab auth listener mount point: root layout (`app/layout.tsx`), not (authed) layout** — US 6 contradiction resolution. Source: T059, T060. (DECISION-8)
  9. **Playwright cross-tab spec pattern: single context, two pages; both halves driven through real UI clicks (sign-in via form, sign-out via dropdown menu item)** — names the storage-event mechanics that forbid two contexts AND the `page.evaluate` shortcut. Source: T062. (DECISION-9)
  10. **`framer-motion` added; `tailwindcss-animate` replaced by `tw-animate-css` on the v4 path** — names the dep deltas. Source: T015, T049. (DECISION-10)
  11. **Chat-pill / notification stacking convention via `--chat-pill-offset` CSS variable** — chat pill writes the offset on mount, notification reads it via `calc(1rem + var(--chat-pill-offset, 0px) + 1rem)`. Documents the binding convention for features 007 / 008 / 010. Source: T046 (writer), T051 (reader). (DECISION-11)
- [ ] T068 [P] Append **three follow-up entries** to `docs/BACKLOG.md` (plan.md "Two `BACKLOG.md` additions" plus one additional entry surfaced during `/speckit.tasks` review):
  - **Dynamic welcome banner subtitle variants** — re-logged per FR-009's deferral. Note the markup accommodates a future swap (the single `<p>` slot beneath the greeting). Status: `deferred-feature`. Address by: post-feature-006 when signal data exists.
  - **Notifications-section live controls** — re-logged per FR-021's placeholder. Status: `deferred-feature`. Address by: a later notifications-prefs feature.
  - **Welcome banner timezone awareness** — the server-rendered greeting in T040's `welcome-banner.tsx` uses the server's local time (Vercel deployment region). Users outside that timezone may see the wrong morning / afternoon / evening label — e.g., a user in `Asia/Tokyo` greeted "Good morning" at their local 8pm if the server is in `America/Los_Angeles`. Deferred to a later feature when client-side timezone detection is wired (e.g., defer the greeting to a `useEffect` that reads `Intl.DateTimeFormat().resolvedOptions().timeZone`, or pass the IANA zone in a cookie). Status: `deferred-bug`. The `welcome-banner.tsx` Server Component implementation in T040 already names this trade-off in its component comment, pointing here.

  Verified at `/speckit.tasks` time (`2026-05-20`): `docs/BACKLOG.md` does not currently contain a `timezone` entry; this is a new addition.
- [ ] T069 [P] Reclassify the **`/login` page does not render the `?error=expired_link` notice** entry in `docs/BACKLOG.md` (currently under "From feature 001 (auth-and-roles)") from `bug` to `merged` (or remove and add a "Merged hotfixes" section if cleaner). Reference commit `8dc822b` (PR #2) as the resolving merge. The CHANGELOG.md note in plan-commit `e5b11cf` already records the spec-side supersession; this task is the BACKLOG-side hygiene.
- [ ] T070 [P] Append a feature-003 entry to `docs/PROGRESS.md`: branch merged, smoke-test pass status, deviations resolved, gates passed, total commit count.
- [ ] T071 Mohamed runs `specs/003-employee-dashboard-shell/smoke-tests.md` manually; records ✅/❌/⚠ inline on ST-1 through ST-7. **The branch may not merge to `main` until every row is ✅** (or ⚠ with a documented deferral). This is the Constitution Principle VII human-validated gate; not a code task.

**Checkpoint**: Step 13 complete. All gates green. Branch is ready to merge to `main` pending Mohamed's PR review.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: No dependencies. T001 + T002 + T003 all [P] — different concerns.
- **Phase 2 (Step 1)**: Depends on Phase 1. T004 + T005 + T006 + T007 + T008 all [P] (different files). T009 depends on T004-T008. T010 depends on T009.
- **Phase 3 (Step 2)**: Depends on Phase 2 only inasmuch as the auth pages must still work after the migration — semantic dependency, not file conflict. T011 → T012 → T013 → T014.
- **Phase 4 (Step 3)**: Depends on Phase 2 (Step 1 must land before shadcn install per FR-038) AND Phase 3 (the `.dark` selector must be in place before shadcn primitives reference it). T015 → T016 → T017 → T018 → T019 → T020.
- **Phase 5 (Step 4)**: Depends on Phase 4 (header + dropdown consume shadcn primitives). T021 [P]; T022/T023/T024/T025/T026 all [P]; T027 depends on T022-T026; T028 [P]; T029 [P]; T030 depends on T027.
- **Phase 6 (Step 5)**: Depends on Phase 5 (account page consumes header + shared SignOutButton). T031 → T032/T033/T034/T035/T036/T037 (all [P] after T031). T038 [P]. T039 depends on T031-T037.
- **Phase 7 (Step 6)**: Depends on Phase 5 (welcome banner consumes header context). T040/T041/T042/T043 all [P]. T044 depends on T040-T043. T045 [P].
- **Phase 8 (Step 7)**: Depends on Phase 5 (chat pill lives in (authed)/layout.tsx). T046 → T047. T048 [P].
- **Phase 9 (Step 8)**: Depends on Phase 4 (notification consumes shadcn Dialog). T049 [P], T050 [P]; T051 depends on T049, T050; T052 depends on T051; T053 depends on T051.
- **Phase 10 (Step 9)**: Depends on Phase 7 (role placeholder lives next to the employee shell body in `/app/page.tsx`) and Phase 8 (chat pill role-gate is verified here). T054 → T055; T056 [P]; T057 → T058.
- **Phase 11 (Step 10)**: Depends on Phase 5 (the dropdown sign-out UI is the test fixture for the cross-tab spec). T059 → T060; T061 [P]; T062 → T063.
- **Phase 12 (Steps 11–12)**: Depends on all preceding phases. T064 [P], T065 [P]; T066 depends on T064, T065.
- **Phase 13 (Step 13)**: Depends on Phase 12. T067/T068/T069/T070 all [P]; T071 depends on the full branch state.

### Within each step

- Lib helpers (truncate-name, use-media-query) ship before their consuming components.
- Server components that read profiles read once in `(authed)/layout.tsx` or in the route page, then pass props down — no duplicate Supabase calls.
- Server Action (`updateProfile`) lands before the client component that calls it.
- shadcn add commands run sequentially (the CLI updates the same `components.json` and `package.json`).

### Parallel opportunities

- Phase 1 (T001–T003): all [P].
- Phase 2 (T004–T008): all [P] for the file moves and the new Field component; T009 sequences after.
- Phase 5 (T022–T026): all [P]; T021 [P]; T028 [P]; T029 [P].
- Phase 6 (T032–T037): all [P] after T031.
- Phase 7 (T040–T043): all [P]; T045 [P].
- Phase 9 (T049–T050): both [P]; T052 + T053 sequence after T051.
- Phase 11 (T061): [P] with T062 once T059, T060 commit.
- Phase 12 (T064, T065): both [P]; T066 sequences after.
- Phase 13 (T067–T070): all [P]; T071 sequences after.

---

## Implementation Strategy

### Foundation-first (Steps 1–3 are mandatory before any user-visible work)

The plan's branch ordering is contractual: Steps 1 (extraction), 2 (theme migration), 3 (shadcn install) are foundational and MUST land in order before any user-visible component work begins. Skipping ahead risks the (auth) regression in US 7 going undetected until Phase 12, when the diff has grown beyond easy rollback.

1. Phase 1 Setup (T001–T003).
2. Phase 2 Step 1 (T004–T010). **STOP and VALIDATE**: (auth) Playwright suite green.
3. Phase 3 Step 2 (T011–T014). **STOP and VALIDATE**: theme toggle works on all surfaces.
4. Phase 4 Step 3 (T015–T020). **STOP and VALIDATE**: shadcn primitives are calm-themed; no red anywhere.

### User-visible build-out

5. Phase 5 Step 4 — Header (T021–T030). Closes US 2's structural needs (profile dropdown shape).
6. Phase 6 Step 5 — Account page (T031–T039). Closes US 2 + US 3 (account management + Security routing).
7. Phase 7 Step 6 — Home body (T040–T045). Closes US 1's body landing.
8. Phase 8 Step 7 — Chat pill (T046–T048). Closes US 1's persistent-affordance landing.
9. Phase 9 Step 8 — Notification (T049–T053). Closes US 5.
10. Phase 10 Step 9 — Role placeholders (T054–T058). Closes US 4.
11. Phase 11 Step 10 — Cross-tab listener (T059–T063). Closes US 6.

### Verification + polish

12. Phase 12 Steps 11–12 (T064–T066). Full suite green.
13. Phase 13 Step 13 (T067–T071). DECISIONS.md, BACKLOG.md, smoke-tests pass, PROGRESS.md, merge.

### Parallel Team Strategy

Two developers:

- **Dev A**: Phase 1 → Phase 2 → Phase 3 → Phase 4 (header + dropdown) → Phase 5 (account page) → Phase 7 (chat pill) → Phase 10 (cross-tab listener) → Phase 12 → Phase 13.
- **Dev B**: After Phase 4 commits, can pick up Phase 6 (home body), Phase 8 (notification), and Phase 9 (role placeholders) in parallel — these three are independent of Dev A's chain except where they touch `(authed)/app/page.tsx` (which sequences naturally: home body in Phase 6, then role branch in Phase 9). Dev B converges with Dev A at Phase 12.

---

## Notes

- **One task = one commit** with two minor exceptions: (a) the `Field` extraction + import update may bundle T007 with T009 if the implementer prefers a single coherent "extract Field" commit; (b) the shadcn init + components.json verify may bundle T015 with T016 if the CLI output matches plan.md Decision E exactly. Otherwise each T-numbered task is its own commit.
- **Commit message convention**: `<scope>(003): <imperative summary>` (e.g. `refactor(003): move PasswordInput to components/ui/auth/`, `feat(003): build header with profile dropdown`, `feat(003): notification toast/sheet component`, `test(003): cross-tab auth sync Playwright spec`, `chore(003): append DECISIONS.md entries`). The `<scope>` matches feature-002 convention (`feat`, `refactor`, `chore`, `test`, `docs`, `fix`).
- **No new architectural decisions in tasks**. The plan's `/speckit.plan` pass closed all of them. If something under-specified surfaces during implementation, STOP and flag to plan-review — do NOT resolve it in tasks or in `/speckit.implement` without a CHANGELOG entry.
- **Constitution Principle VII coverage map**:
  - Vitest + RTL: T028, T029, T038, T045, T048, T052, T056, T061.
  - Playwright: existing role-trio + hotfix `login-expired-link` (preserved unchanged save the copy update in T057); new `employee-dashboard-shell.spec.ts` (T064); new `cross-tab-auth-sync.spec.ts` (T062).
  - Smoke tests: T071 (Mohamed runs `specs/003-employee-dashboard-shell/smoke-tests.md`).
- **DECISIONS.md source-tagging**: every implementation task that produces a DECISIONS.md entry carries a 📌 marker in its phase header. T067 is the single collection point during implementation.
- **CHANGELOG.md** received its supersession entry in plan-commit `e5b11cf`; it is NOT touched by any task in this list.
- **No team_lead / admin functional work** in this feature beyond the placeholder. Features 011 (team-lead-dashboard) and 012 (admin-dashboard) replace the placeholder wholesale.
