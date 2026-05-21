/**
 * Cross-tab auth broadcast helper (📌 DECISION-N amendment 2026-05-22).
 *
 * Background: feature 003's plan-time Decision N assumed
 * supabase-js's storage-event mechanism would carry cross-tab
 * sign-in / sign-out propagation. Phase 11 implementation
 * surfaced that @supabase/ssr's createBrowserClient stores the
 * session in COOKIES, not localStorage — so supabase-js's
 * BroadcastChannel never fires for sign-in / sign-out flows
 * driven through Server Actions (the feature 001 path). Tab B's
 * localStorage stays empty when Tab A signs in via the form;
 * no `storage` event is dispatched cross-tab; the
 * onAuthStateChange listener never sees the event.
 *
 * The bridge: client-side callers of sign-in / sign-out write a
 * tiny marker to localStorage. Sibling tabs receive the
 * `storage` event on that custom key and react. The marker value
 * encodes the event type + a timestamp so consecutive writes
 * always produce a `storage` event (browsers don't fire if the
 * value is unchanged).
 *
 * This file is the single source of truth for the broadcast
 * contract. Callers MUST use the helpers below rather than
 * writing to localStorage directly — the key name and value
 * format are matched in components/cross-tab-auth.tsx and
 * changing one without the other would break propagation.
 */

export const AUTH_BROADCAST_KEY = "serenify-auth-broadcast";

export type AuthBroadcastEvent = "signin" | "signout";

/**
 * Write a sign-in marker to localStorage. Called from client-side
 * sign-in success paths (login-form.tsx after the signIn server
 * action returns ok). Sibling tabs at /login / /signup /
 * /forgot-password / /reset-password / / receive the storage
 * event and navigate to /app.
 *
 * No-op when window is undefined (SSR-safe).
 */
export function broadcastSignIn(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTH_BROADCAST_KEY, `signin:${Date.now()}`);
  } catch {
    // localStorage can throw in sandboxed iframes or private-browsing
    // contexts. The broadcast is best-effort; failure here just means
    // sibling tabs won't propagate. Same-tab navigation still works.
  }
}

/**
 * Write a sign-out marker to localStorage. Called from client-side
 * sign-out paths (SignOutButton's onSubmit, ProfileDropdown's
 * hidden form onSubmit) BEFORE the form action runs, so the marker
 * lands while the calling tab still has the user's session
 * cookies attached (Server Action runs server-side, sees the user,
 * clears cookies). Sibling tabs at /app / /onboarding receive the
 * storage event and navigate to /login.
 *
 * No-op when window is undefined.
 */
export function broadcastSignOut(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTH_BROADCAST_KEY, `signout:${Date.now()}`);
  } catch {
    // see broadcastSignIn — best-effort.
  }
}

/**
 * Parse a storage-event newValue into an auth event type.
 * Returns null if the value isn't a known broadcast.
 *
 * Consumed by components/cross-tab-auth.tsx — kept here so the
 * key + value contract live in one file.
 */
export function parseAuthBroadcast(
  newValue: string | null,
): AuthBroadcastEvent | null {
  if (!newValue) return null;
  if (newValue.startsWith("signin:")) return "signin";
  if (newValue.startsWith("signout:")) return "signout";
  return null;
}
