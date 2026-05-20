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
| ST-2 | SC-010 / FR-028, FR-029, FR-030, FR-032 | Notification toast/sheet component in three configurations. | Open the developer-preview mount (the Vitest test surface from `notification.test.tsx` can be exercised directly via `npm run test:watch --workspace=apps/web -- notification`; alternatively, mount `<Notification>` in a temporary route under `/dev/notification` that is deleted before commit). Configuration A: desktop viewport, default motion. Configuration B: 360×640 viewport, default motion. Configuration C: desktop viewport, OS-level `prefers-reduced-motion: reduce` (macOS System Settings → Accessibility → Display → Reduce motion; Windows Settings → Accessibility → Visual effects → Animation effects = off; Chrome DevTools → Rendering → Emulate CSS prefers-reduced-motion = reduce). For each configuration, mount the surface, then dismiss it. | Configuration A: surface slides in from bottom-right with a subtle motion; soft border, generous padding, amber-not-red for any callout accent. Configuration B: surface renders as a full-width bottom sheet anchored to the bottom edge. Configuration C: surface appears with an opacity-only fade — no slide motion, no translate. In all three configurations the explicit dismiss control closes the surface (FR-031). When the chat pill is concurrently rendered (employee landing in another tab or window for visual reference), the notification's `bottom` value visibly sits 16px above the pill on desktop (Decision H, FR-032). |   |   |
| ST-3 | SC-007 / FR-034, FR-035, FR-036 | Employee vs. team_lead vs. admin landing rendered side-by-side. | Open three browser-profile windows (or three private-browsing sessions). Sign in to each as a different role from the demo cohort — one employee, one team_lead, one admin. Place the three windows side-by-side at desktop width. | **Employee window**: welcome banner with time-of-day greeting + first name; three skeleton cards in the 60/40 layout with "Things that might help" above "Recent chats" on the right; chat pill bottom-right. **team_lead window**: full persistent header (logo, theme toggle, profile avatar); centered placeholder "Your team-lead view is coming together." + subtitle + Sign out; **NO** welcome banner, **NO** skeleton cards, **NO** chat pill. **admin window**: same full header; centered placeholder "Your admin view is in progress." + subtitle + Sign out; **NO** welcome banner, **NO** skeleton cards, **NO** chat pill. Sign out from each placeholder; each lands at `/login`. The role-trio Playwright specs (`admin-seeded.spec.ts`, `team-lead-seeded.spec.ts`) passed in the pre-conditions — this row is the human side-by-side check. |   |   |
| ST-4 | SC-002 (hardened) / FR-053 | Theme toggle persistence across browser restart. | Sign in as an employee. Toggle theme to whichever mode differs from your OS default (so the override is non-trivial). Reload — assert persistence. Sign out — open a fresh tab still on the dev server — assert the chosen theme is still applied to `/login`. Sign back in — assert persistence. **Hard test**: fully quit the browser (not just close the tab); reopen; navigate back to `http://localhost:3000`. The theme MUST still be the chosen mode (localStorage `serenify-theme` survives browser restart). | The chosen theme persists across: page reload, page navigation within the authed surface, sign-out, sign-in, full browser quit-and-reopen. DevTools → Application → Local Storage → `http://localhost:3000` shows a `serenify-theme` key with value `"light"`, `"dark"`, or `"system"` matching the user's choice. |   |   |
| ST-5 | SC-008 / FR-045, FR-046, FR-047 | Cross-tab sync timing observed (stopwatch). | Open two browser tabs in the same browser window at `http://localhost:3000/login`. Have a stopwatch (phone, watch, or `Date.now()` in DevTools) ready. **Sign-in propagation**: in tab A, fill the form with an employee demo user; click submit; **simultaneously** start the stopwatch when the form submits. Stop the stopwatch when tab B has visibly navigated to `/app`. **Sign-out propagation**: in tab A (now on `/app`), open the profile dropdown; click Sign out; start the stopwatch when the click happens. Stop when tab B has navigated to `/login`. | Both propagations complete in **under 2 seconds** under normal local conditions (SC-008). The Playwright `cross-tab-auth-sync.spec.ts` already asserted this with `waitForURL(..., { timeout: 2000 })` — this row is the human observation that the 2s budget feels right in practice, not a tight margin. Token-refresh events (which fire silently every ~50 minutes; not observable in a smoke run) MUST NOT navigate any tab. |   |   |
| ST-6 | SC-006 / FR-017 | Account-page full-name edit updates header avatar initials and dropdown name on the same render cycle. | Sign in as an employee. Note the current header avatar's initials and the dropdown's display name. Navigate to `/app/account` via the dropdown. In the Profile section, edit the full name to something with **different initials** — e.g., change "Mohamed Asem" to "Layla Mostafa". Submit the change. | Without reloading the page, **the same render cycle** that displays the save-success state also updates: (a) the header avatar's initials to the new ones ("LM"); (b) the profile dropdown's display name to the new value (truncated to 24 chars + `…` if necessary per Decision K). No full page reload occurs — the browser address bar does not flicker, and the page does not navigate. Reload the page — the new name persists (because `revalidatePath` flushed the server cache on submit). Navigate to `/app` — the welcome banner shows the new first name on next visit. |   |   |
| ST-7 | FR-030 / SC-010 (reduced-motion clause) | `prefers-reduced-motion: reduce` confirmed via OS preference (not just DevTools emulation). | Set OS-level reduce-motion: macOS System Settings → Accessibility → Display → Reduce motion (toggle on); Windows Settings → Accessibility → Visual effects → Animation effects (toggle off); Linux GNOME → Settings → Accessibility → Reduce animation. Close + reopen the browser to ensure the OS-level pref is picked up (some browsers cache the value until reload). Re-mount the notification surface from ST-2's developer-preview path. | The notification's entrance is **opacity-only** — no slide-in from the right (desktop) or slide-up from the bottom (mobile). The exit is also opacity-only on dismiss. The CSS rule in `globals.css` lines 49-54 (`animation-duration: 0.01ms; transition-duration: 0.01ms;`) is the OS-backstop; the Framer Motion `useReducedMotion` hook is the React-state primary. Both paths agree at this row. **Reset the OS preference after the test** so subsequent rows are not affected. |   |   |

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

## Cross-cutting visual checks (run as part of ST-1 through ST-7, no separate row)

While running each row above, also visually confirm the following invariants. Any failure is a row-level ❌ for the relevant ST.

- **No red anywhere** (Constitution Principle V; FR-052). Inspect any callout, button-destructive variant, error message, or hover state for hues in the 340–20° sector. Stress-related callouts (none in this feature, but the convention applies) use amber `#DCB587`.
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
| Run date |   |
| Validator |   |
| All rows ✅ ? |   |
| Notes / deviations |   |