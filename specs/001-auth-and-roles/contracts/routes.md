# Route Contracts: Authentication and Role-Based Access

**Feature**: `001-auth-and-roles`
**Phase**: 1
**Date**: 2026-05-17

Each route below is described by: HTTP method(s), auth-state precondition,
body/query schema (where applicable), and redirect/response behaviour.

## Page routes

### `GET /signup` — `app/(auth)/signup/page.tsx`

| Aspect | Contract |
|--------|----------|
| Auth state precondition | Unauthenticated. If a valid session exists, middleware redirects to `/app` (or `/onboarding` if `full_name IS NULL`). |
| Renders | Signup form: `email`, `password`, `full_name`. Calm-voice copy. shadcn/ui primitives. |
| On submit | Server Action `signUp(formData)` calls `supabase.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: '${SITE_URL}/auth/callback' } })`. |
| Success state | "Check your email to confirm" panel (no auto-redirect). |
| Failure: existing email | Calm message ("This email already has an account. Try signing in or resetting your password.") — no role/identity disclosure beyond what Supabase returns. |
| Failure: validation | Inline field errors from Zod schema. |

### `GET /login` — `app/(auth)/login/page.tsx`

| Aspect | Contract |
|--------|----------|
| Auth state precondition | Unauthenticated. Same redirect-when-authed rule as `/signup`. |
| Renders | Login form: `email`, `password`. Link to `/forgot-password` and `/signup`. |
| On submit | Server Action `signIn(formData)` calls `supabase.auth.signInWithPassword({ email, password })`. |
| Success | Redirect to `/app` (middleware will re-route to `/onboarding` if `full_name IS NULL`). |
| Failure: invalid credentials | "Those details didn't match an account. Try again, or reset your password." (No distinction between unknown email and wrong password — Supabase already returns a generic error.) |
| Failure: email not confirmed | "Confirm your email first. We can send a fresh link." — exposes a resend button calling `supabase.auth.resend({ type: 'signup', email })`. |

### `GET /forgot-password` — `app/(auth)/forgot-password/page.tsx`

| Aspect | Contract |
|--------|----------|
| Auth state precondition | Unauthenticated. |
| Renders | One field: `email`. |
| On submit | Server Action `requestPasswordReset(formData)` calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '${SITE_URL}/reset-password' })`. |
| Response | Always identical regardless of whether the email exists ("If that email is registered, we've sent a link."). Enforces FR-007. |

### `GET /reset-password` — `app/(auth)/reset-password/page.tsx`

| Aspect | Contract |
|--------|----------|
| Auth state precondition | Reached via the reset link in email. The page reads `code` (PKCE) from the URL and calls `supabase.auth.exchangeCodeForSession(code)`. If exchange fails, the page renders an "Your link expired" state with a button to request a fresh email. |
| Renders | Two fields: `new_password`, `confirm_password`. |
| On submit | Server Action `updatePassword(formData)` calls `supabase.auth.updateUser({ password })`. |
| Success | Redirect to `/login` with a one-time flash "Password updated — sign in with your new password." |

### `GET /onboarding` — `app/(authed)/onboarding/page.tsx`

| Aspect | Contract |
|--------|----------|
| Auth state precondition | Authenticated, `profiles.full_name IS NULL`. If `full_name` is already set, middleware redirects to `/app`. |
| Renders | One field: `full_name`. Pre-filled from `auth.users.user_metadata.full_name` if present. |
| On submit | Server Action `completeOnboarding(formData)` runs `UPDATE public.profiles SET full_name = $1 WHERE id = auth.uid()`. RLS allows this via `profiles_update_self_safe_fields` (role and manager_id are unchanged, satisfying the WITH CHECK predicate). |
| Success | Redirect to `/app`. |

### `GET /app` — `app/(authed)/app/page.tsx`

| Aspect | Contract |
|--------|----------|
| Auth state precondition | Authenticated, onboarded. |
| Renders | Placeholder authed landing (this feature has no dashboard). Single text element: "You are signed in as **{role}**." Sign-out button. |
| On sign-out | Server Action calls `supabase.auth.signOut()` then `redirect('/login')`. |

## Route handlers (server-only)

### `GET /auth/callback` — `app/auth/callback/route.ts`

| Aspect | Contract |
|--------|----------|
| Purpose | Supabase email-confirmation and OAuth-callback landing. For this feature it handles signup-confirmation and invite-acceptance links. |
| Query params | `code` (PKCE code from email link), optional `next` (redirect target after exchange). |
| Behaviour | Calls `supabase.auth.exchangeCodeForSession(code)` server-side. On success, `redirect(next ?? '/app')` (middleware will bounce to `/onboarding` if needed). On failure, `redirect('/login?error=expired_link')`. |

### `POST /api/admin/invite` — `app/api/admin/invite/route.ts`

The admin invite is a **two-step** flow: invite first, then elevate the
role via a SECURITY DEFINER function. The trigger never reads the role
from any client-controllable metadata field (see research R-5).

| Aspect | Contract |
|--------|----------|
| Auth state precondition | Caller is authenticated AND `public.profiles.role = 'admin'` (checked in handler; also re-checked inside `admin_update_role` / `admin_update_manager` in Postgres). |
| Request body | `{ email: string, role: 'team_lead' \| 'admin' \| 'employee', manager_id?: string }` (Zod-validated). |
| Behaviour | The handler performs four steps in order: <br>1. Verifies the caller's JWT resolves to `role = 'admin'` by querying `public.profiles` via the server-side Supabase client. If not admin, responds **403 Forbidden** and stops. <br>2. Calls `supabase.auth.admin.inviteUserByEmail(email)` using the server-only admin client (with `SUPABASE_SERVICE_ROLE_KEY`). The trigger creates a `profiles` row with `role = 'employee'`. <br>3. Calls `supabase.rpc('admin_update_role', { target_user_id: invited.user.id, new_role: body.role })` using the same admin client. <br>4. If `manager_id` was supplied, calls `supabase.rpc('admin_update_manager', { target_user_id: invited.user.id, new_manager_id: body.manager_id })`. |
| Success response | **201 Created** with body `{ user_id: <invited uuid> }`. |
| Partial-failure response | If step 2 succeeded but step 3 (or 4) failed, **500 Internal Server Error** with body `{ user_id, error: 'role_update_failed' \| 'manager_update_failed', detail: <pg error message> }`. The caller knows the invite email was sent and the user exists with `role = 'employee'`; recovery is manual (re-run the RPC from Supabase Studio or re-POST the invite with `{ email: same, role: ... }` after deleting the partial user). |
| Other failure responses | **400 Bad Request** on Zod validation failure; **409 Conflict** if Supabase Auth reports the email already exists; **500 Internal Server Error** for any other Supabase Auth error. |
| Surface | No UI in feature 001 — the admin uses `curl` or a temporary script. UI for this lands in feature 011 (admin dashboard). The route exists now so feature 002's demo seed can use it. |

## Middleware contract — `apps/web/middleware.ts`

| Matcher | `/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)` |
|---------|--|
| Step 1 | Refresh the Supabase session cookie via `createServerClient` from `@supabase/ssr`. |
| Step 2 | If `supabase.auth.getUser()` returns no user AND path matches `/^/(app|onboarding)/?/` → redirect to `/login`. |
| Step 3 | If user exists AND path is `/login`, `/signup`, `/forgot-password`, `/reset-password` → redirect to `/app`. |
| Step 4 | If user exists AND `profiles.full_name IS NULL` AND path is not `/onboarding` and not `/api/*` → redirect to `/onboarding`. |
| Step 5 | If user exists AND `profiles.full_name IS NOT NULL` AND path is `/onboarding` → redirect to `/app`. |
| Otherwise | `NextResponse.next()` with refreshed cookies. |

## Forms — Zod schemas (single source of truth in `lib/auth/schemas.ts`)

```ts
export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/),
  full_name: z.string().trim().min(1).max(120),
});

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z
  .object({
    new_password: z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match.',
  });

export const onboardingSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
});

export const adminInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['employee', 'team_lead', 'admin']),
  manager_id: z.string().uuid().optional(),
});
```

Error-message copy lives in the form-component layer and is reviewed
for calm voice (Principle V) during smoke testing.
