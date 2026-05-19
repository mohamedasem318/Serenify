# Phase 1 Data Model: Employee Dashboard Shell

## Schema impact

**This feature introduces no schema migrations, no new columns, no
new tables, no new indexes, and no new RLS policies.** The shell
reads and writes only the existing `public.profiles` columns shipped
by feature 001.

## Tables consumed

### `public.profiles` (existing — feature 001)

Columns this feature reads:

- `id` (uuid, FK to `auth.users.id`) — the user identifier used by
  every server-component read and the account-page server action.
- `full_name` (text, nullable) — read for: the welcome banner
  greeting (first whitespace-separated token), the header avatar
  initials, the profile dropdown display name, the account-page
  Profile section editor's initial value. Subject to the 60-char
  application-level max (Decision K) and the 24-char display
  truncation (Decision K).
- `role` (text, one of `employee` / `team_lead` / `admin`) — read
  by `(authed)/app/page.tsx` to branch between the employee shell
  body and the role placeholder. Read by `(authed)/layout.tsx` to
  gate the persistent chat pill (FR-035).

Columns this feature writes:

- `full_name` — updated by the account page's `updateProfile`
  server action when the user submits the Profile section editor.
  Write goes through the row-owner RLS policy already in place
  from feature 001 (no SECURITY DEFINER call needed for a
  self-edit).

Columns this feature DOES NOT touch:

- `role` — read only. Privilege escalation is out of scope; the
  admin-only `admin_update_role` RPC (per DECISIONS 2026-05-17)
  is not called by any path in this feature.
- `manager_id` — not read, not written.
- `created_at`, `updated_at` — `updated_at` is bumped by the
  feature-001 `profiles_set_updated_at` trigger on any UPDATE,
  but this feature does not reference the column.

### `auth.users` (existing — Supabase Auth)

Read indirectly via `supabase.auth.getUser()` for:

- `email` — displayed in the Profile section's read-only email
  field, and used as the fallback source for the avatar initials
  when `full_name` is null/empty (FR-010, Decision K).
- The session metadata (signed-in vs. signed-out, `auth.uid()`) —
  consumed by route guards (already feature-001 territory) and by
  the new cross-tab listener at the root layout.

Written via:

- `supabase.auth.signOut()` — invoked by the profile dropdown's
  Sign out button, the account page's Sign out section, and the
  role-placeholder Sign out button. All three converge on the
  same call.

## Server actions (new)

### `updateProfile(formData: FormData)`

Location: `apps/web/app/(authed)/app/account/actions.ts`.

Signature:

```ts
"use server";
export async function updateProfile(formData: FormData): Promise<{ status: "ok" } | { status: "invalid"; message: string }>;
```

Behavior:

1. Read `full_name` from `formData`. Validate against the schema
   `z.object({ full_name: z.string().trim().min(1, "Name can't be empty").max(60, "Keep it under 60 characters") })`.
2. On validation failure, return `{ status: "invalid", message }`.
3. Get the current user via the SSR Supabase client. If no user,
   the route guard from feature 001 already redirected — this
   action should not have been callable.
4. `UPDATE public.profiles SET full_name = $1 WHERE id = auth.uid()`
   — relies on feature 001's row-owner RLS policy:
   `(auth.uid() = id)` is satisfied for self-edits.
5. `revalidatePath("/app")` and `revalidatePath("/app/account")` so
   the next render of either page reflects the new value. The
   header avatar/dropdown name is updated by an optimistic React
   state update inside the form component before the action even
   returns — see component contracts.
6. Return `{ status: "ok" }`.

Failure modes:

- Validation error → returned to the client with the form schema's
  error message rendered inline.
- RLS denial (theoretically impossible for a self-edit, but
  defensively) → logged server-side; the client receives a
  generic `{ status: "invalid", message: "We couldn't save that —
  try again." }` per the calm-voice rubric.

### `signOut()` (existing — feature 001)

Located at `apps/web/app/(authed)/actions.ts`. Already shipped by
feature 001. Reused unchanged by:

- The new profile dropdown's Sign out button.
- The new account page's Sign out section button.
- The new role-placeholder Sign out button.

No changes to this action.

## Client-side data

### `cross-tab-auth.tsx` (new — root layout)

Subscribes to `supabase.auth.onAuthStateChange` once on mount. The
client-side Supabase client at `apps/web/lib/supabase/client.ts` is
the same instance feature 001 uses; no new client factory is
introduced.

State: none stored locally. The listener acts only by calling
`router.push()` (or returning without action). All session truth
lives in Supabase's localStorage entries (`sb-<project>-auth-token`)
and the `storage` event drives the cross-tab path.

Pathname-gating per FR-046:

- `SIGNED_IN` while pathname starts with `/login`, `/signup`,
  `/forgot-password`, `/reset-password`, or is `/` → push `/app`.
- `SIGNED_IN` while pathname starts with `/app`, `/onboarding` →
  no-op (already on an authed route — the local tab navigated
  itself).
- `SIGNED_OUT` while pathname starts with `/app`, `/onboarding` →
  push `/login`.
- `SIGNED_OUT` while pathname starts with `/login` etc. → no-op.
- `TOKEN_REFRESHED` → no-op regardless of pathname.

### Theme state

Owned entirely by next-themes via the existing `Providers` wrapper.
Persisted in `localStorage.serenify-theme` (Decision C / D).
No React Context introduced by this feature; consumers call
`useTheme()` directly where needed (today, only the existing
`theme-toggle.tsx`).

## Auth route guards

Reused unchanged from feature 001:

- `apps/web/proxy.ts` — the Next 16 proxy (DECISIONS 2026-05-17)
  gates the `(authed)/` group on a valid session cookie. No
  changes.
- `(authed)/layout.tsx` already invokes `supabase.auth.getUser()`
  and redirects to `/login` if absent. This feature modifies the
  layout's body content (new header + chat pill) but preserves the
  guard.
- `(authed)/app/page.tsx` already redirects to `/onboarding` if
  the profile row is absent. This feature preserves the redirect
  and adds the role-conditional branch downstream of it.

## Validation summary

Per the spec's Acceptance Criteria and the FR list:

- `full_name` length ≤ 60 chars (Decision K, application-side).
- `full_name` may be empty/null at read time — the welcome banner
  and avatar handle the missing case per FR-010 / Decision K.
- `role` is always one of three known values (database CHECK from
  feature 001).
- Email is never written by this feature.

No new constraints, triggers, functions, or policies. The data
model is a pure consumption pattern over feature 001's schema.
