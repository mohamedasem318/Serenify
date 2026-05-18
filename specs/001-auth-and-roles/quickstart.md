# Quickstart: Authentication and Role-Based Access (Local Dev)

**Feature**: `001-auth-and-roles`
**Phase**: 1
**Date**: 2026-05-17

This document tells a developer how to bring this feature up locally,
run the test suites, and validate the auth flows end-to-end. It is the
target state after `/speckit.implement` completes.

## Prerequisites

- Node.js 20.x
- npm 10.x (ships with Node 20)
- Docker Desktop (for the local Supabase stack)
- Supabase CLI ≥ 1.180 (`npm install -g supabase` or `brew install supabase/tap/supabase`)
- A Supabase project provisioned in the **Frankfurt** region for staging
  (one-time setup; not needed for local dev)

## 1. Clone and install

```bash
git clone https://github.com/mohamedasem318/serenify
cd serenify
npm install
```

`npm install` from the repo root installs dependencies for every
workspace declared in the root `package.json` (`apps/*`, `packages/*`).

## 2. Configure environment

Copy the example and fill in the local Supabase values that
`supabase start` prints:

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

`apps/web/.env.local`:

```ini
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from `supabase start` output>
SUPABASE_SERVICE_ROLE_KEY=<from `supabase start` output>
SITE_URL=http://localhost:3000
```

**Secrets discipline (Constitution Principle IX)**:
- `.env.local` is in `.gitignore`. Do not commit it.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. It is imported only by
  `apps/web/lib/supabase/admin.ts` (used by `POST /api/admin/invite`)
  and by `apps/web/tests/e2e/setup/admin-client.ts` (used by
  Playwright test setup only). No client component imports either of
  these files.
- For staging/production, set these in the Vercel project's
  Environment Variables panel.

## 3. Start local Supabase and apply migrations

```bash
supabase start          # boots Postgres, Auth, Studio at http://127.0.0.1:54323
supabase db reset       # applies every file in supabase/migrations/ in order
```

`supabase db reset` is the deterministic test fixture for local dev and
CI — it drops the local DB and re-runs every migration from scratch.

## 4. Tailwind v4 design tokens (`@theme` block)

Tailwind v4 reads design tokens from CSS, not from a JS config. The
locked Mist & Meadow palette from Constitution Principle V lives in
`apps/web/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  /* Light mode (default) — Mist & Meadow palette */
  --color-bg:           #ECEEE9;
  --color-surface:      #F5F6F2;
  --color-ink:          #1F2522;
  --color-muted:        #6E7572;
  --color-meadow:       #7A9275;
  --color-foggy:        #8AA9B6;
  --color-amber:        #DCB587;
  --color-border:       #D6D7D1;

  --radius-card:        12px;
  --radius-control:     8px;
  --shadow-soft:        0 1px 2px rgba(0, 0, 0, 0.04);

  --font-sans:          "Inter", system-ui, sans-serif;
  --font-display:       "Instrument Serif", serif;
}

@layer base {
  /* Dark mode override */
  :root[data-theme="dark"] {
    --color-bg:         #161917;
    --color-surface:    #20231F;
    --color-ink:        #DCDED5;
    --color-muted:      #8B928F;
    --color-meadow:     #97AE91;
    --color-foggy:      #9CBBC7;
    --color-amber:      #DCB587;
    --color-border:     #2D3130;
  }

  /* prefers-reduced-motion respected by default */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

No `tailwind.config.ts` is created. Tailwind v4 reads tokens from
`@theme`. A config file is only added later if a plugin requires it.

## 5. Run the dev server

```bash
npm run dev --workspace=apps/web
```

Open `http://localhost:3000`. The middleware will redirect to `/login`.

## 6. First Admin Bootstrap

This is a **one-time, per-environment** operation (run separately in
dev, staging, and production). It is **NOT** a migration — keeping it
out of `supabase/migrations/` ensures it cannot run accidentally when
a new environment is bootstrapped from CI. It is the only path by
which the very first admin in any given environment comes to exist.

The trigger defaults every signup to `role = 'employee'`. To create
the first admin:

1. Sign up via `/signup` at that environment's URL with the
   maintainer's email.
2. Confirm the email (Supabase Studio → Logs → Auth, or by clicking
   the link delivered to the inbox).
3. Open Supabase Studio SQL Editor for that environment and run:

   ```sql
   UPDATE public.profiles
      SET role = 'admin'
    WHERE id = (
      SELECT id FROM auth.users WHERE email = '<your-email>'
    );
   ```

4. Sign out and sign in again. `lib/supabase/server.ts` reads role from
   `profiles` directly on each request, so the new role is in effect
   immediately on the next refresh.

From this admin onward, all subsequent `team_lead` and `admin` accounts
in that environment are created via `POST /api/admin/invite`. There is
no other code path that elevates a user to `team_lead` or `admin`.

## 7. Validate the four happy paths manually

| Flow | Steps |
|------|-------|
| Self-signup (employee) | Go to `/signup`, fill the form with a fresh email, password, full_name. Open Supabase Studio → Authentication → Users, click "..." next to your row, "Send magic link" (or use the confirmation link printed in Studio → Logs → Auth). After confirmation, go to `/login`, sign in, land on `/app`, see "You are signed in as **employee**." |
| Forgot-password | Sign out, go to `/forgot-password`, submit the email. Open Supabase Studio → Logs → Auth, copy the recovery URL, paste in the browser. Set a new password. Sign in with it. |
| Admin invite (team_lead) | While signed in as an admin (see Step 6), `POST /api/admin/invite` with `{ "email": "lead@example.com", "role": "team_lead", "manager_id": null }`. The handler invites the user and then calls `admin_update_role` server-side. The invitee follows the email link, sets a password, lands on `/app`, sees "You are signed in as **team_lead**." |
| Direct-report visibility | As a `team_lead`, query `supabase.from('profiles').select()` from the browser console. Confirm you see your own row and rows whose `manager_id = your_id`, and no others. |

## 8. Run the test suites

```bash
npm run test --workspace=apps/web        # Vitest unit tests
npm run test:e2e --workspace=apps/web    # Playwright; auto-starts dev server
```

The Playwright run uses three role-specific specs:

- `e2e/employee-signup.spec.ts` — full UI signup → admin-API-confirm → onboarding → /app.
- `e2e/team-lead-seeded.spec.ts` — programmatically seeded via admin API, sign-in path tested.
- `e2e/admin-seeded.spec.ts` — same shape as team_lead, plus a probe to `/api/admin/invite` returning 201 for a fresh email and 403 when the same call is made as a non-admin (test fixture switches sessions).

Each spec uses a fresh, random email so reruns are idempotent without
manual DB cleanup. `globalSetup` truncates `auth.users` and `profiles`
between full test runs to keep CI runs deterministic. The admin client
used by `globalSetup` and individual specs is imported from
`tests/e2e/setup/admin-client.ts` only; that file refuses to load when
`process.env.NODE_ENV === 'production'`.

## 9. Verify the smoke-test checklist

Open `specs/001-auth-and-roles/smoke-tests.md` and run through each
row manually. Record ✅ / ❌ / ⚠ inline. All six rows MUST be ✅
before this branch merges to `main`.

## 10. Common gotchas

| Symptom | Cause | Fix |
|--------|------|-----|
| `/onboarding` redirect loop | Middleware reads `profiles.full_name` but the row doesn't exist | Trigger didn't fire. Check `supabase logs db` — usually means migration `20260517000030_profile_trigger.sql` wasn't applied. Run `supabase db reset`. |
| Sign-in fails with "Email not confirmed" | Local Supabase Auth enforces confirmation | Either click the link in Studio → Logs → Auth, or call `supabase.auth.admin.updateUserById(id, { email_confirm: true })` from a one-shot script. |
| RLS denies an admin SELECT | The admin's `profiles.role` is still `'employee'` — bootstrap step missed | Run the SQL in step 6. |
| `is_admin()` returns false in policy evaluation | Caller's session has no JWT (e.g., called from public route handler) | Ensure the route handler is using the server-side Supabase client created with cookies, not the anon client. |
| `403 Forbidden` on `POST /api/admin/invite` | Caller is not admin | Confirm the caller's `profiles.role` in Studio. Re-check the bootstrap step. |
| `500 { error: 'role_update_failed' }` from `/api/admin/invite` | Invite went out but the `admin_update_role` RPC failed | The user exists with `role = 'employee'`. Either rerun `admin_update_role` manually from Supabase Studio, or delete the user and re-POST the invite. |
