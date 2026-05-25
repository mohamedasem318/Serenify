# Quickstart: Employee Dashboard Shell (Feature 003)

This is the developer-onboarding path from a clean clone of
`mohamedasem318/serenify` to a working `/app` shell. It assumes
features 001 and 002 are merged and the `003-employee-dashboard-shell`
branch is checked out.

## Prerequisites

- Node 20 (or whatever feature 001's quickstart pins). Verify with
  `node -v`.
- A local Supabase project running per feature 001's quickstart
  (Docker-based, `supabase start` from the repo root).
- `apps/web/.env.local` populated with `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` —
  see feature 001's quickstart for sourcing.
- The bootstrap admin user from feature 001 created.
- The demo cohort seeded: `npm run seed` from the repo root
  (feature 002).

## Install

From the repo root:

```sh
npm install
```

This installs the new `framer-motion` plus the shadcn-introduced
Radix UI packages (`@radix-ui/react-dialog`,
`@radix-ui/react-dropdown-menu`, `@radix-ui/react-avatar`,
`@radix-ui/react-separator`), `class-variance-authority`, `clsx`,
`tailwind-merge`, and `tw-animate-css`. All are added to
`apps/web/package.json` during feature 003 implementation.

## Run the dev server

```sh
npm run dev --workspace=apps/web
```

The Next.js dev server starts on `http://localhost:3000`. Visit
`http://localhost:3000/login` to begin.

## Sign in as each role

Use the demo cohort password `DemoUser123!` (feature 002, FR-005).

To find an example user of each role, inspect the seed summary table
the `npm run seed` command printed, or query Supabase Studio for the
first row of each `profiles.role` value matching
`*@demo.serenify.local`.

### Employee landing

Sign in with any employee-role demo user. Expect:

- `/app` renders the welcome banner with a time-of-day-adaptive
  greeting + first name.
- Three skeleton cards in the 60/40 layout: "Today's check-in"
  large on the left; "Things that might help" above "Recent chats"
  on the right.
- Persistent header: logo, "Home" active, theme toggle, profile
  avatar.
- Persistent chat pill bottom-right.

### team_lead landing

Sign in with a team_lead-role demo user. Expect:

- The same persistent header.
- A centered one-screen role placeholder: "Your team-lead view is
  coming together." plus a Sign out button.
- No welcome banner, no skeleton cards, no chat pill.

### admin landing

Sign in with an admin-role demo user. Expect:

- The same persistent header.
- A centered one-screen role placeholder: "Your admin view is in
  progress." plus a Sign out button.
- No welcome banner, no skeleton cards, no chat pill.

## Account page

From the employee landing, click the profile avatar to open the
dropdown. Click "Account" to navigate to `/app/account`. Expect
five sections in order:

1. **Profile** — editable full name, read-only email, avatar
   placeholder.
2. **Security** — a "Change password" link routing to
   `/forgot-password`.
3. **Privacy** — muted dashed-border placeholder.
4. **Notifications** — muted dashed-border placeholder.
5. **Sign out** — a secondary-styled sign-out button.

Edit the full name to confirm the header avatar and dropdown
display name update immediately.

## Theme toggle

Click the moon/sun icon in the header. The theme flips. Reload the
page — the choice persists. Sign out, sign back in — the choice
still persists (localStorage `serenify-theme`).

## Cross-tab sync

Open two browser tabs at `http://localhost:3000/login`. Sign in as
an employee in tab A. Tab B navigates to `/app` automatically within
~2 seconds.

Sign out in tab A (via the profile dropdown). Tab B navigates to
`/login` automatically.

## Notification component (developer preview)

The notification toast/sheet is built but not mounted by any
production code in this feature. To exercise it manually, use the
Vitest test surface:

```sh
npm test --workspace=apps/web -- notification.test
```

Or, if a developer-preview route is added during `/speckit.tasks`
(at the team's discretion, NOT required), visit it directly.

## Running tests

### Vitest + React Testing Library

```sh
npm test --workspace=apps/web
```

Covers all new component logic — header, profile dropdown, account
sections, notification (three configurations), role placeholder.

### Playwright

```sh
npm run test:e2e --workspace=apps/web
```

Covers:

- All of feature 001's role-trio specs (preserved unchanged).
- `login-expired-link.spec.ts` (from the hotfix `8dc822b`,
  preserved unchanged).
- `employee-dashboard-shell.spec.ts` (new — happy path).
- `cross-tab-auth-sync.spec.ts` (new — per Decision N).

The suite runs under `workers: 1` (DECISIONS 2026-05-17) and
completes in roughly 90–120 seconds locally.

### Smoke tests

`specs/003-employee-dashboard-shell/smoke-tests.md` lists the
human-validated checks Mohamed runs after `/speckit.implement`
completes. The checks include: visual regression on each (auth)
page; the notification component's three configurations; the
three role landings; theme persistence across browser restart;
cross-tab sync timing; account-page profile edit reflecting in
the header; `prefers-reduced-motion` behavior.

## Troubleshooting

### "shadcn add" command not found

Run via `npx`: `npx shadcn@latest add <primitive>` — the project
does not install shadcn globally.

### Theme toggle does nothing on first load

The first render may hit next-themes' "mounted" placeholder (see
`theme-toggle.tsx`). The button is clickable on the very next
render after hydration. If it persists, check that
`apps/web/app/providers.tsx` has `attribute="class"` (NOT
`"data-theme"` — that's the pre-feature-003 value) and that
`globals.css` targets `.dark` (NOT `:root[data-theme="dark"]`).

### Cross-tab sync doesn't fire

- Verify both tabs are on the same origin (`localhost:3000`, not
  one on `127.0.0.1:3000` and one on `localhost:3000` — those are
  different origins from a localStorage standpoint).
- Open devtools → Application → Local Storage and confirm the
  `sb-<project-ref>-auth-token` key updates in tab A when you
  sign in. If it doesn't, the sign-in itself failed.
- Check the browser console for any errors from
  `cross-tab-auth.tsx`.

### Notification component doesn't animate

- Check that `framer-motion` is installed (`npm ls framer-motion
  --workspace=apps/web`).
- Check OS / browser `prefers-reduced-motion` — if set to
  `reduce`, the component's entrance is opacity-only by design
  (FR-030).

### shadcn primitive looks "off-brand"

Verify `apps/web/components.json` matches `plan.md` Decision E and
that `apps/web/app/globals.css` contains the CSS-variable mapping
from `contracts/shadcn-mapping.md`. Without the mapping, shadcn
primitives render with their default neutral palette — close to
calm but not Mist & Meadow.
