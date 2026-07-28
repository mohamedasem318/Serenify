"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Delete the @supabase/ssr session cookies.
 *
 * Matched by the `sb-` prefix rather than reconstructed by name. The base cookie
 * is `sb-<project-ref>-auth-token`, and a session too large for one cookie is
 * split across `<name>.0`, `<name>.1`, … — matching the prefix covers the base
 * and every chunk without this file duplicating a format @supabase/ssr owns.
 */
async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  for (const { name } of cookieStore.getAll()) {
    if (name.startsWith("sb-")) {
      cookieStore.delete(name);
    }
  }
}

/**
 * End the current session and return to /login.
 *
 * `scope: "local"` (2026-07-28) — supabase-js defaults to `"global"`, which
 * revokes the refresh token for EVERY session this user holds, on every device.
 * Signing out of a laptop should not end the session on a phone. This does not
 * change cross-tab behaviour: sibling tabs share one cookie jar, one refresh
 * token and therefore one session, so `"local"` ends theirs too. Recorded in
 * docs/DECISIONS.md — it is a session-invalidation change, not a typo fix.
 *
 * The result is no longer discarded. supabase-js clears the local session only
 * when the logout request succeeds or fails with 401/403/404; on anything else
 * — a network timeout surfaces as `AuthRetryableFetchError`, which is not an
 * `AuthApiError` — `_signOut` returns early WITHOUT clearing, and `_removeSession`
 * is private, so there is no public API to force it. Previously we redirected
 * anyway and the user arrived at /login still holding valid cookies, so proxy.ts
 * bounced them back to /app: the "sometimes a refresh doesn't land on the login
 * screen" symptom. Now we clear the cookies ourselves on that path.
 *
 * The redirect happens either way. A user who asked to sign out should never be
 * left sitting on an authed surface because the auth server was unreachable.
 */
export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    console.error(
      "[sign-out] revoke failed; clearing session cookies locally",
      error,
    );
    await clearAuthCookies();
  }

  redirect("/login");
}
