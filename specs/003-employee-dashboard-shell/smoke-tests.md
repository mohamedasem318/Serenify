# Smoke Tests: Employee Dashboard Shell

**Feature**: `003-employee-dashboard-shell`
**Owner of human-validated pass**: Mohamed
**When run**: After `/speckit.implement` completes (T071 of `tasks.md`), before the branch merges to `main`.

This document is the Constitution Principle VII human-validated gate.
Every row MUST be ✅ before merge (or ⚠ with a documented deferral
that Mohamed accepts). Record ✅ / ❌ / ⚠ inline in the **Status**
column AND a one-line note in the **Result** column (date,
observation, any deviation).

ST-1 through ST-7 are sourced verbatim from `plan.md` § Smoke tests.
Each row mirrors a success criterion from `spec.md` (see the
**Mirrors** column). The two new Playwright specs introduced in this
feature (`employee-dashboard-shell.spec.ts`, `cross-tab-auth-sync.spec.ts`)
provide automated coverage for some of the same outcomes — the smoke
rows below validate the human-visible behavior that test selectors
alone do not catch.

## Pre-conditions for every row

- The `003-employee-dashboard-shell` branch is checked out and
  rebased onto current `main` (merge-base = `8dc822b` or later).
- `npm install` has been run from the repo root.
- Local Supabase is running (`supabase start`).
- `apps/web/.env.local` is intact with the three required keys.
- Feature 001 quickstart has been completed (bootstrap admin exists
  at a real maintainer email, NOT `*@demo.serenify.local`).
- Feature 002's demo cohort is seeded (`npm run seed` from repo
  root) — 30 demo users at `*@demo.serenify.local` distributed
  2/5/23 admin/team_lead/employee.
- `npm run typecheck --workspace=apps/web` and
  `npm run lint --workspace=apps/web` are green.
- `npm run test --workspace=apps/web` (Vitest) is green.
- `npm run test:e2e --workspace=apps/web` (Playwright) is green —
  including the two new specs from this feature plus the seven
  preserved feature-001 / hotfix specs.
- Dev server is running locally at `http://localhost:3000`
  (`npm run dev --workspace=apps/web`).
- A real browser is open (Chromium-class for desktop checks;
  Chromium DevTools' responsive mode at 360×640 for mobile checks).

## Smoke-test table

| ID | Mirrors | Description | How to run | Pass criterion | Status | Result |
|----|---------|-------------|------------|----------------|:------:|--------|
| ST-1 | SC-009 / FR-039 | Visual regression on each (auth) page at desktop and 360px in both themes. | Open `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/onboarding` in turn, each at desktop (≥1024px) and at 360×640 (DevTools responsive mode), each in light and in dark mode. Compare visually against the same pages on `main` (open `main` in a second window or compare against pre-merge screenshots). | No perceptible padding shift, no font-weight change, no color drift, no animation delta on any of the five pages × two viewports × two themes (20 cells). The Playwright `admin-seeded.spec.ts`, `team-lead-seeded.spec.ts`, `employee-otp.spec.ts`, `employee-signup.spec.ts`, `reset-password.spec.ts`, `demo-coexistence.spec.ts`, and `login-expired-link.spec.ts` already passed in the pre-conditions — this row is the *human* visual check on top of that. |  ✅ | 2026-05-20 — automated pixelmatch diff (20/20 cells, 0px delta). Phase 2 was rename-only; byte-identical to main confirmed.  |
| ST-2 | SC-010 / FR-028, FR-029, FR-030, FR-032 | Notification toast/sheet component in three configurations. | Open the developer-preview mount (the Vitest test surface from `notification.test.tsx` can be exercised directly via `npm run test:watch --workspace=apps/web -- notification`; alternatively, mount `<Notification>` in a temporary route under `/dev/notification` that is deleted before commit). Configuration A: desktop viewport, default motion. Configuration B: 360×640 viewport, default motion. Configuration C: desktop viewport, OS-level `prefers-reduced-motion: reduce` (macOS System Settings → Accessibility → Display → Reduce motion; Windows Settings → Accessibility → Visual effects → Animation effects = off; Chrome DevTools → Rendering → Emulate CSS prefers-reduced-motion = reduce). For each configuration, mount the surface, then dismiss it. | Configuration A: surface slides in from bottom-right with a subtle motion; soft border, generous padding, amber-not-red for any callout accent. Configuration B: surface renders as a full-width bottom sheet anchored to the bottom edge. Configuration C: surface appears without slide/translate. Under reduce-motion the appearance is instant (zero animation duration is the most a11y-respectful interpretation of prefers-reduced-motion per WCAG SC 2.3.3) — no fade is required and adding one would be worse for the users this preference targets. In all three configurations the explicit dismiss control closes the surface (FR-031). When the chat pill is concurrently rendered (employee landing in another tab or window for visual reference), the notification's `bottom` value visibly sits 16px above the pill on desktop (Decision H, FR-032). | ✅ | 2026-05-25 — Config A ✅ desktop slide-in. Config B ✅ mobile bottom sheet. Config C ✅ no slide/translate under PRM; instant appearance is correct per WCAG SC 2.3.3. "Opacity-only fade" wording amended to reflect correct a11y intent. |
| ST-3 | SC-007 / FR-034, FR-035, FR-036 | Employee vs. team_lead vs. admin landing rendered side-by-side. | Open three browser-profile windows (or three private-browsing sessions). Sign in to each as a different role from the demo cohort — one employee, one team_lead, one admin. Place the three windows side-by-side at desktop width. | **Employee window**: welcome banner with time-of-day greeting + first name; three skeleton cards in the 60/40 layout with "Things that might help" above "Recent chats" on the right; chat pill bottom-right. **team_lead window**: full persistent header (logo, theme toggle, profile avatar); centered placeholder "Your team-lead view is coming together." + subtitle + Sign out; **NO** welcome banner, **NO** skeleton cards, **NO** chat pill. **admin window**: same full header; centered placeholder "Your admin view is in progress." + subtitle + Sign out; **NO** welcome banner, **NO** skeleton cards, **NO** chat pill. Sign out from each placeholder; each lands at `/login`. The role-trio Playwright specs (`admin-seeded.spec.ts`, `team-lead-seeded.spec.ts`) passed in the pre-conditions — this row is the human side-by-side check. | ✅ | 2026-05-25 — all three role landings correct; employee banner/cards/pill ✅, team_lead/admin placeholders ✅, sign-out → `/login` ✅. |
| ST-4 | SC-002 (hardened) / FR-053 | Theme toggle persistence across browser restart. | Sign in as an employee. Toggle theme to whichever mode differs from your OS default (so the override is non-trivial). Reload — assert persistence. Sign out — open a fresh tab still on the dev server — assert the chosen theme is still applied to `/login`. Sign back in — assert persistence. **Hard test**: fully quit the browser (not just close the tab); reopen; navigate back to `http://localhost:3000`. The theme MUST still be the chosen mode (localStorage `serenify-theme` survives browser restart). | The chosen theme persists across: page reload, page navigation within the authed surface, sign-out, sign-in, full browser quit-and-reopen. DevTools → Application → Local Storage → `http://localhost:3000` shows a `serenify-theme` key with value `"light"`, `"dark"`, or `"system"` matching the user's choice. | ✅ | 2026-05-25 — OS is dark; toggled to light. Persisted across reload, sign-out, sign-in, and full browser quit+reopen. `serenify-theme: "light"` confirmed in localStorage. |
| ST-5 | SC-008 / FR-045, FR-046, FR-047 | Cross-tab sync timing observed (stopwatch). | Open two browser tabs in the same browser window at `http://localhost:3000/login`. Have a stopwatch (phone, watch, or `Date.now()` in DevTools) ready. **Sign-in propagation**: in tab A, fill the form with an employee demo user; click submit; **simultaneously** start the stopwatch when the form submits. Stop the stopwatch when tab B has visibly navigated to `/app`. **Sign-out propagation**: in tab A (now on `/app`), open the profile dropdown; click Sign out; start the stopwatch when the click happens. Stop when tab B has navigated to `/login`. | Both propagations complete in **under 2 seconds** under normal local conditions (SC-008). The Playwright `cross-tab-auth-sync.spec.ts` already asserted this with `waitForURL(..., { timeout: 2000 })` — this row is the human observation that the 2s budget feels right in practice, not a tight margin. Token-refresh events (which fire silently every ~50 minutes; not observable in a smoke run) MUST NOT navigate any tab. | ✅ | 2026-05-25 — sign-in: 1.59s / 1.25s / 2.04s (median 1.59s); sign-out: 0.98s / 0.79s / 0.98s (median 0.98s). Both medians under 2s budget. |
| ST-6 | SC-006 / FR-017 | Account-page full-name edit updates header avatar initials and dropdown name on the same render cycle. | Sign in as an employee. Note the current header avatar's initials and the dropdown's display name. Navigate to `/app/account` via the dropdown. In the Profile section, edit the full name to something with **different initials** — e.g., change "Mohamed Asem" to "Layla Mostafa". Submit the change. | Without reloading the page, **the same render cycle** that displays the save-success state also updates: (a) the header avatar's initials to the new ones ("LM"); (b) the profile dropdown's display name to the new value (truncated to 24 chars + `…` if necessary per Decision K). No full page reload occurs — the browser address bar does not flicker, and the page does not navigate. Reload the page — the new name persists (because `revalidatePath` flushed the server cache on submit). Navigate to `/app` — the welcome banner shows the new first name on next visit. | ✅ | 2026-05-25 — name change reflected in avatar initials and dropdown on same render cycle, no page reload. Persisted on reload. Welcome banner updated on `/app`. Nav active-state bug (Home highlighted on /account) found and fixed inline. |
| ST-7 | FR-030 / SC-010 (reduced-motion clause) | `prefers-reduced-motion: reduce` confirmed via OS preference (not just DevTools emulation). | Set OS-level reduce-motion: macOS System Settings → Accessibility → Display → Reduce motion (toggle on); Windows Settings → Accessibility → Visual effects → Animation effects (toggle off); Linux GNOME → Settings → Accessibility → Reduce animation. Close + reopen the browser to ensure the OS-level pref is picked up (some browsers cache the value until reload). Re-mount the notification surface from ST-2's developer-preview path. | The notification's entrance is without slide/translate — no slide-in from the right (desktop) or slide-up from the bottom (mobile). Under reduce-motion the appearance is instant (zero animation duration is the most a11y-respectful interpretation of prefers-reduced-motion per WCAG SC 2.3.3) — no fade is required. The exit on dismiss is also instant with no translate. The CSS rule in `globals.css` lines 49-54 (`animation-duration: 0.01ms; transition-duration: 0.01ms;`) is the OS-backstop; the Framer Motion `useReducedMotion` hook is the React-state primary. Both paths agree at this row. **Reset the OS preference after the test** so subsequent rows are not affected. | ✅ | 2026-05-25 — OS-level reduce-motion confirmed via Windows Animation effects off. No slide/translate on entrance or exit. OS pref reset after test. |
| ST-8 | SC-008 / FR-045, FR-046 | Cross-tab propagation on **email-verification** (fresh sign-up flow). | Open two tabs in the same browser window. Tab A on `/login`. In Tab B, complete `/signup` with a fresh email (use a `+suffix` alias on a real inbox you can read; the demo cohort is pre-verified so it can't exercise this path). Receive the verification email. Click the verification link (it may open in Tab B or in a fresh tab, depending on the mail client). Whichever tab lands after `/auth/callback` exchanges the code and redirects to `/app` (or `/onboarding`) emits the cross-tab `signin` broadcast on mount — the callback sets a short-lived `serenify-auth-signin` cookie that the landing tab's `CrossTabAuth` consumes (`consumePendingSignIn`), writing the shared-localStorage marker. | Tab A's `CrossTabAuth` listener at pathname `/login` catches the `signin` broadcast and navigates Tab A within 2s. The destination is **either `/app` or `/onboarding`** depending on the new user's profile state — both lands satisfy the contract per the `(onboarding)` route group introduced in commit `309e78d`. The Playwright `cross-tab-auth-sync.spec.ts` `toHaveURL(/\/(app\|onboarding)$/)` assertion encodes the same dual-target rule; this row is the human observation that the email-link path (not just the form path) writes the broadcast correctly. No infinite redirect, no error notice on Tab A. | ✅ | 2026-05-25 — ❌ observed: verification link opened a new Tab C; Tab C signed in correctly but Tab A and Tab B did not propagate. Root cause: `/auth/callback` is a server-only Route Handler — it can't write the client-side localStorage broadcast marker the form path writes; the Playwright spec covers the form path only. **Fix applied this branch** (`broadcast cross-tab signin on auth callback path`): the callback sets a short-lived `serenify-auth-signin` cookie on its redirect when the destination is authed (`/app`/`/onboarding`, NOT the recovery `next=/reset-password`), and `CrossTabAuth.consumePendingSignIn()` reads it on mount and emits the existing `signin` broadcast. A cookie (not a redirect query param) is used because `proxy.ts` strips `url.search` on its `/app`→`/onboarding` bounce — the path a fresh null-profile sign-up / invite takes. Covered by Vitest (gate + cookie-consume, both sides of the seam) + existing `cross-tab-auth-sync.spec.ts` (storage→nav half); a full email-verification Playwright spec is deferred (PKCE `?code=` links need a client-set `code_verifier`, which the suite already sidesteps via `email_confirm:true`). **Re-run 2026-05-25 ✅**: email-link path confirmed — Tab C ran `/auth/callback`, Tab A propagated to `/app` within 2s. ⚠ OTP-entry path (entering code directly on signup page) does NOT trigger cross-tab sync — same root cause pattern, separate issue logged for Opus discussion. Out of scope for this test row. |
| ST-9 | SC-008 / FR-045, FR-046 | Cross-tab propagation on **password reset** for the currently-signed-in user. | Tab A is signed in as employee user X (use a `*@demo.serenify.local` demo employee). Tab A sits on `/app`. In Tab B (same browser, same context), navigate to `/forgot-password`. Submit the form with X's email. Receive the reset email. Click the reset link **in Tab B** to land on `/reset-password`. Enter and confirm a new password; submit. Tab B's sign-in-after-reset success path writes the broadcast marker to shared localStorage. | Tab A propagates appropriately for whichever broadcast Tab B writes — `signin` if Tab B writes that marker (Tab A is already at `/app`, so the listener no-ops per the path-gating in `components/cross-tab-auth.tsx` lines 16-22). **Acceptance**: Tab A shows no console errors, no infinite redirect loop, no silent stale UI (the avatar still reflects X, the page is still `/app`, navigation still works). The Server Action's session-cookie rewrite from Tab B does NOT log Tab A out — feature 001's `proxy.ts` continues to see valid session cookies in Tab A's requests because they share the same cookie jar. The user can sign in on a third tab with the new password successfully. **If a `signout` broadcast fires instead** (e.g., the reset flow triggered a full session invalidation), Tab A would navigate to `/login` within 2s — which is also acceptable; either path is contractually fine, and the row records which one the implementation took. | ✅ | 2026-05-25 — N/a by design. `/forgot-password` correctly redirects authenticated sessions to `/app`; Tab A and Tab B share the cookie jar so the "Tab A authed + Tab B initiates reset" scenario is structurally unreachable. The practical unauthenticated reset flow (log out → reset → sign back in) is a composition of ST-5 (signout broadcast) + ST-8 (signin broadcast), both of which pass. The recovery path correctly excludes broadcast per the `destinationBroadcastsSignIn` gate, preserving intent. System behaves correctly; no deferred fix. |
| ST-10 | FR-045, FR-046 (isolation clause) | **Browser-profile isolation** — propagation MUST NOT cross unrelated browser sessions. | Open a normal Chromium window as Tab A on `/login`. Open a separate **Incognito / Private** window (or a different browser profile) as Tab B. In Tab B, complete sign-up + email verification per ST-8. | Tab A **does not move**. It stays on `/login` indefinitely, no console errors, no broadcast event observed. This is the **correct** behavior — Incognito / Private has its own localStorage partition, so the `serenify-auth-broadcast` key written in Tab B is never visible in Tab A's `storage` event stream. **This row exists to lock the absence-of-propagation as a contract** so a future contributor investigating "cross-tab sync seems broken across profiles" recognizes it as isolation working correctly, not a regression. Run the same check with two separate browser profiles (e.g., `--user-data-dir=/tmp/profile1` vs. `/tmp/profile2`) to confirm the same isolation across explicit profiles, not just Incognito. | ✅ | 2026-05-25 — Tab A stayed on `/login` throughout ST-8 flow in Incognito Tab B. No propagation, no console errors. Isolation confirmed. |

---

## Pre-condition verification run (2026-05-25)

**Branch**: `003-employee-dashboard-shell` @ commit `642fa09`
**Run date**: 2026-05-25
**Validator**: Mohamed (with Claude Code assistance)

| Pre-condition | Status | Notes |
|---------------|:------:|-------|
| Branch on `003-employee-dashboard-shell`, clean | ✅ | HEAD `642fa09` |
| `npm install` | ✅ | No missing deps |
| Supabase local running | ✅ | `supabase status` confirmed |
| `.env.local` (3 keys) | ✅ | All three present |
| `typecheck` | ✅ | `tsc --noEmit` clean |
| `lint` | ✅ | `eslint` clean |
| Vitest (154 tests, 20 files) | ✅ | All passed |
| Playwright E2E (53+1 → 54 tests) | ✅ | See note below |
| Dev server at `localhost:3000` | ✅ | Already running (PID 45592), restarted fresh before smoke run |

### Playwright E2E — webkit flake (resolved)

Initial run: 53 passed, 1 failed — `[webkit] › reset-password.spec.ts:87 › password requirements checklist lights up rule by rule as the user types`. Root cause was load-induced timing: the test ran against a dev server hammered by chromium+firefox suites for ~5 min, slowing webkit's React-driven `data-met` attribute updates to ~7.6s vs the 5s default timeout. Not a real defect — target test passed 3/3 with a 10s budget under varying load.

Fix commits:
- `a6d2154` — raise password-requirements assertion timeout to 10s
- `642fa09` — log dev-server resource leak in BACKLOG (bloated to 4.1 GB; monotonically growing run durations across stacked suites; workaround: restart dev server between full-suite runs; tracked as tech-debt for feature 004)

Re-run after fix and dev-server restart: **54 passed, 0 failed**. Pre-condition satisfied.

---

## T014 — Manual theme-toggle verification (2026-05-20)

**Task**: Verify feature-003's migration from `data-theme` attribute → `class` attribute and
`theme` localStorage key → `serenify-theme` key across all auth surfaces and `/app`.
**Branch**: `003-employee-dashboard-shell` @ commit `c1ce451`
**Validator**: Claude in Chrome (automated browser run), reviewed by Mohamed
**Run date**: 2026-05-20

### Results by surface

| Surface | Toggle flips? | No FOUT on reload? | `<html class="dark">` (not `data-theme`)? | `serenify-theme` in localStorage? | Notes |
|---------|:---:|:---:|:---:|:---:|-------|
| `/login` | ✅ | ✅ | ✅ | ✅ | See anomaly note below |
| `/signup` | ✅ | ✅ | ✅ | ✅ | — |
| `/forgot-password` | ✅ | ✅ | ✅ | ✅ | — |
| `/reset-password` | ✅ | ✅ | ✅ | ✅ | Expired-link state renders correctly in both themes |
| `/onboarding` | ⚠ | ⚠ | ⚠ | ⚠ | Redirects to `/app` for seeded demo users who completed onboarding; surface not independently testable with this account |
| `/app` | ✅ | ✅ | ✅ | ✅ | Feature-001 placeholder; toggle in persistent header |

### Cross-session check (steps 4 & 5)

| Step | Result |
|------|--------|
| Set dark on `/app`, sign out → `/login` still dark | ✅ Theme is origin-scoped, not session-scoped. `serenify-theme: "dark"` survived sign-out. |
| Sign back in → `/app` still dark | ✅ Theme persisted through full sign-out / sign-in cycle. |

### Anomaly: stale `theme` key on first load

On **first page load** (before any toggle interaction), `serenify-theme` was absent from
localStorage while the old `theme: "dark"` key was present. The page correctly showed dark
because the user's OS is in dark mode (next-themes fell back to system preference, not the
old key). After the first toggle, `serenify-theme` was written and all subsequent behaviour
was correct.

**Root cause**: No migration shim to read the old `theme` key and write it to `serenify-theme`
on first load. Users who had a stored preference under the old key will lose that preference
after the migration (they'll see system preference instead) until they toggle once.

**Impact assessment**: Low — the old key was `"dark"` and the user's system is also dark, so
there was no visible regression. However on a system set to light mode where a user had
previously saved `theme: "dark"`, they would see a **flash to light** on first load after the
migration, then correct dark on every subsequent load after the first toggle.

**Recommendation**: Add a one-time migration in `providers.tsx` (or a `useEffect` at the
app root) that on mount reads `localStorage.getItem('theme')`, writes the value to
`serenify-theme` if `serenify-theme` is not already set, then deletes the old `theme` key.
This is a non-blocking issue for merge but should be tracked.

### Resolution (2026-05-20)

**Implementation chosen**: an inline `<script>` in `<head>` of `apps/web/app/layout.tsx`
(not a React `useEffect`), so the migration runs synchronously during initial HTML parse
— before React hydrates and before next-themes' own FOUT-prevention script reads storage
— so users carrying the pre-migration key see no flash on first load.

**Commit trail**:

- `a5d89b3` — initial migration shim. Shipped with a `!localStorage.getItem('serenify-theme')`
  guard intended as "only migrate if new key absent." That guard silently skipped migration
  in the common state where `serenify-theme` had any stored value (e.g., `"system"` written
  the moment a user clicks the theme toggle or `setTheme(...)` fires by any other path).
  The legacy `theme` key therefore survived every reload and the page applied the wrong
  default — exactly the failure mode reported during the second T014 pass.
- `073bdaf` — corrective follow-up. Dropped the guard entirely. Migration now runs whenever
  `theme` is present; the script's own `removeItem('theme')` keeps it idempotent without
  needing a precondition.

**Verification matrix** (programmatic, against the dev server via Playwright MCP at
2026-05-20 02:11–02:13):

| Setup | Console (debug build before strip) | Post-reload state | Pass |
|-------|-----------------------------------|-------------------|:---:|
| `theme="dark"`, `serenify-theme` absent | `legacy= dark cur= null` → `migrated to dark` | `theme=null, serenify-theme="dark"`, `.dark` class on `<html>` | ✅ |
| `theme="light"`, `serenify-theme` absent | `legacy= light cur= null` → `migrated to light` | `theme=null, serenify-theme="light"`, no `.dark` class | ✅ |
| both absent | `legacy= null cur= null`, no migration log | `theme=null, serenify-theme=null` (next-themes uses defaultTheme without writing), OS preference applied | ✅ |
| `theme="dark"`, `serenify-theme="system"` (original T014 repro state) | `legacy= dark cur= system` → `migrated to dark` | `theme=null, serenify-theme="dark"`, `.dark` class | ✅ |

After all four scenarios passed, the diagnostic `console.log`/`console.error` scaffold was
removed; the final-form shim is silent-catch per the original intent. Final-form re-verified
once more against scenario 1: console contains only HMR + React DevTools info, storage flips
correctly.

### DOM attribute check

`<html>` element carries `class="... dark"` (or `class="... light"`) — **not** `data-theme`.
Migration from attribute to class is confirmed complete on all tested surfaces. ✅

### Overall T014 verdict: **PASS** (anomaly resolved 2026-05-20 in commit `073bdaf`)

The `serenify-theme` key and `class`-based theming work correctly on first load AND across
subsequent interactions. The stale-key-on-first-load anomaly originally tracked above has
been resolved by the inline migration shim; see the **Resolution** subsection for the
commit trail and four-scenario verification matrix.

---

## T019-crimson — Crimson destructive button verification (2026-05-20)

**Task**: Verify that after the FR-042 scope clarification (crimson palette token,
`--destructive` remapped from amber to crimson) and the corrected `@theme inline` prefix
contract, `<Button variant="destructive">` renders with the documented Mist & Meadow
values in both light and dark modes — confirmed via `getComputedStyle` (not visual eyeball,
because the original prefix-bug failure mode looked like "the button just isn't styled yet"
rather than a visible wrong color).

**Branch**: `003-employee-dashboard-shell` @ commit `b4c7b38`
**Validator**: Claude via Playwright MCP against the local dev server, reviewed by Mohamed
**Run date**: 2026-05-20

### Discovery trail

| Commit | What |
|--------|------|
| `e551791` | `shadcn add button` — first primitive, surfaced the `text-destructive-foreground` reference |
| `c6c8375` | FR-042 scope clarification docs (CHANGELOG + DECISIONS + constitution V1.1.0 + plan/contracts/research/tasks) |
| `89c418d` | Code: added `--color-crimson` to Mist & Meadow @theme blocks; remapped `--destructive` to crimson; added `--destructive-foreground` |
| (would-be commit 3/3) | Verification revealed the button still rendered transparent — Tailwind v4 hadn't generated any shadcn-named utility classes |
| `b4c7b38` | `@theme inline` contract corrected: all 19 mapping rows renamed to `--color-*` prefix; 7-step radius ladder added |

### Computed-style probes (post-`b4c7b38`)

Transient preview page mounted at `apps/web/app/destructive-preview/page.tsx`
(rendering `<Button variant="destructive">Delete account</Button>`), then probed via
Playwright MCP with transitions disabled to capture final-state styles. Preview deleted
before commit.

| Mode | Property | Expected | Measured | Pass |
|------|----------|----------|----------|:---:|
| Light | `background-color` | `rgb(123, 66, 68)` = `#7B4244` (crimson light) | `rgb(123, 66, 68)` | ✅ |
| Light | `color` | `rgb(236, 238, 233)` = `#ECEEE9` (`--color-bg` light) | `rgb(236, 238, 233)` | ✅ |
| Light | `border-radius` | `8px` (`--radius-md` = `--radius-control`) | `8px` | ✅ |
| Dark | `background-color` | `rgb(193, 127, 129)` = `#C17F81` (crimson dark) | `rgb(193, 127, 129)` | ✅ |
| Dark | `color` | `rgb(22, 25, 23)` = `#161917` (`--color-bg` dark) | `rgb(22, 25, 23)` | ✅ |
| Dark | `border-radius` | `8px` | `8px` | ✅ |

### Generated Tailwind utility rules (sanity check)

| Selector | Rule |
|----------|------|
| `.bg-destructive` | `background-color: var(--color-crimson);` |
| `.text-destructive-foreground` | `color: var(--color-bg);` |
| `.rounded-md` | `border-radius: var(--radius-control);` |

The `var()` chain is preserved through Tailwind v4's `@theme inline` — the
mode-flip happens at runtime via the `:root.dark` Mist & Meadow override. Note that
`getPropertyValue('--color-destructive')` on `:root` returns `""` empty (which is
how `inline` semantics work — Tailwind generates utility rules referencing the underlying
Mist & Meadow tokens directly, without intermediating through `--color-destructive`).
The shadcn-named tokens are real to Tailwind's class generator but not direct CSS vars
on `:root`.

### Cross-cutting confirmations

- ✅ Zero amber on destructive surfaces anywhere (button bg resolves to crimson hex).
- ✅ Zero red-sector colors on affective/ambient surfaces (FR-042 scope-clarified).
- ✅ Lint + typecheck green.

### Overall T019-crimson verdict: **PASS**

Destructive button renders correctly in both modes. The R-2.1 prefix correction
(`b4c7b38`) unblocks T019 to continue with the remaining six primitives (card,
dropdown-menu, sheet, dialog, avatar, separator) per the same per-primitive checkpoint
pattern.

---

## Cross-cutting visual checks (run as part of ST-1 through ST-7, no separate row)

While running each row above, also visually confirm the following invariants. Any failure is a row-level ❌ for the relevant ST.

- **No red on affective or ambient surfaces** (Constitution Principle V; FR-042 scope-clarified per CHANGELOG 2026-05-20). Inspect any callout, error message, hover state, status badge, notification, or stress-related affective copy for hues in the 340–20° sector. Stress-related callouts (none in this feature, but the convention applies) use amber `#DCB587`. **Red IS permitted on destructive action surfaces** via the `--color-crimson` token (light `#7B4244`, dark `#C17F81`) — verified at the crimson-destructive verification entry below; any future destructive surfaces (delete-account, leave-team, revoke-session) should match those exact computed-style values.
- **No exclamation marks** (FR-013, FR-052) in any visible copy on `/app`, `/app/account`, or the role placeholders.
- **No alarmist language** ("alert", "detected", "elevated risk", "abnormal") in any visible copy.
- **All interactive targets ≥44×44px on the 360px viewport** (FR-007, FR-025, FR-049). Includes header buttons, profile avatar, dropdown items, account page buttons, chat pill, notification dismiss.
- **Light and dark modes look equal-quality** (FR-050) on every surface visited. No surface is light-only or dark-only.
- **Card corners are 12px (`--radius-card`); control corners are 8px (`--radius-control`)**. Visible on cards on `/app`, on the shadcn-primitives in the account page sections, on the button variants in the dropdown and role placeholders.

---

## Notes for the validator

- ST-1's 20-cell visual matrix is the largest single check. Allow ~15 minutes. Compare against `main` directly — open the deployed `main` branch in a second window if a Vercel preview is available, or use git stash + checkout to swap between branches for each cell.
- ST-2's "developer-preview mount" choice is deferred to the implementer (Vitest in watch mode, a `/dev/notification` route, or equivalent). The route option MUST be deleted before the smoke run, OR the route MUST live under a path that does NOT ship in production. If the implementer chose the Vitest-watch approach, run `npm run test:watch --workspace=apps/web -- notification` and visually inspect the React Testing Library render output (RTL prints DOM; for a visual check, mount in a temporary file).
- ST-3 requires a real demo cohort. If `npm run seed` has not been run, this row CANNOT validate — record ⚠ "skipped — demo cohort not seeded" and resolve before merge.
- ST-4's "fully quit the browser" matters: closing the tab is insufficient because some browsers preserve in-memory state until process exit. macOS Cmd+Q on the browser app, Windows Alt+F4 on the window of the last tab, or Linux equivalent.
- ST-5's stopwatch is a human observation; under contended local conditions (Docker pegging the CPU, dev server hot-reloading) the propagation may take longer than 2s on a single trial. Take three trials and record the median. If the median exceeds 2s, this is a real SC-008 violation and blocks merge.
- ST-6's choice of "different initials" matters because the header avatar might cache the initials if the change is too subtle (e.g., "Mohamed Asem" → "Mohamed A. Asem" still computes to "MA"). Pick a name change that crosses the initials boundary so the avatar visibly updates.
- ST-7 is the only row that intentionally toggles an OS-level preference. **REMEMBER TO RESET** after the test — leaving reduce-motion on will affect ST-5's animation observations if you run ST-5 again later in the smoke pass.

## Sign-off

| Field | Value |
|-------|-------|
| Run date | 2026-05-25 |
| Validator | Mohamed Asem |
| All rows ✅ ? | Yes — ST-1 through ST-10 all ✅ |
| Notes / deviations | ST-2 Config C: "opacity-only fade" wording amended to reflect WCAG SC 2.3.3 (instant appearance is correct under prefers-reduced-motion). ST-8: OTP-entry path does not trigger cross-tab sync — separate issue logged for follow-up, out of scope for this row. ST-9: original premise structurally unexecutable (shared cookie jar); accepted ✅ by design — unauthenticated reset path is composition of ST-5 + ST-8. |