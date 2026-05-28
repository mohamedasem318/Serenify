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

/**
 * Transient marker cookie the GET /auth/callback route sets after a
 * successful code exchange whose destination is an authed surface
 * (📌 ST-8 fix 2026-05-25). It bridges the email-verification path into
 * the same cross-tab broadcast the form path uses.
 *
 * Why a cookie and not a redirect query param: proxy.ts strips the
 * search string (`url.search = ""`) on its /app → /onboarding bounce —
 * the exact path a fresh null-profile sign-up / admin invite takes — so
 * a query param would be destroyed before any client could read it.
 * Cookies are untouched by that redirect, so the marker survives to
 * whichever authed surface the proxy lands on. Non-httpOnly by design:
 * CrossTabAuth reads it from document.cookie on mount.
 */
export const AUTH_SIGNIN_COOKIE = "serenify-auth-signin";

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
 * Also clears any same-tab anchor-banner dismissal so the next
 * sign-in shows the banner again (FR-023/024: dismissal is
 * auth-session-scoped, not browser-tab-scoped — sessionStorage
 * alone survives sign-out/sign-in within one tab).
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
  clearAnchorBannerDismissal();
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

/**
 * Server-side gate (📌 ST-8 fix): should /auth/callback set the
 * signin-broadcast cookie for this post-exchange destination?
 *
 * Only authed landings — /app and /onboarding (the proxy may bounce
 * /app → /onboarding for a null-profile user; both are sign-in
 * completions). NOT the recovery flow, which arrives with
 * `next=/reset-password`: that user is mid-password-reset, not signing
 * in to use the app, so broadcasting `signin` there would wrongly pull
 * sibling tabs to /app (and would regress smoke ST-9). The signup
 * confirmation and admin-invite links both arrive with no `next`
 * (defaulting to /app), so this returns true for them.
 *
 * Pure function — no window/document access — so it is importable from
 * the server Route Handler.
 */
export function destinationBroadcastsSignIn(next: string): boolean {
  return (
    next === "/app" ||
    next.startsWith("/app/") ||
    next === "/onboarding" ||
    next.startsWith("/onboarding/")
  );
}

/**
 * Client-side (📌 ST-8 fix): if the signin-broadcast cookie is present,
 * emit the cross-tab signin broadcast and clear the cookie. Called once
 * from CrossTabAuth on mount — the first tab to mount on the authed
 * landing after a callback redirect consumes it.
 *
 * The clear makes it idempotent: a later remount (or a sibling tab that
 * happens to re-read document.cookie before the clear lands) re-emitting
 * `signin` would be harmless anyway, but clearing keeps the marker
 * one-shot. No-op under SSR or when the cookie is absent.
 */
export function consumePendingSignIn(): void {
  if (typeof document === "undefined") return;
  // Read the marker's VALUE, not just the key: clearing a cookie with
  // Max-Age=0 deletes it outright in a real browser, but some
  // environments (e.g. happy-dom under test) leave a lingering empty
  // `name=` entry. Treating an empty value as absent keeps this
  // idempotent everywhere — a second mount won't re-broadcast.
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${AUTH_SIGNIN_COOKIE}=`))
    ?.slice(AUTH_SIGNIN_COOKIE.length + 1);
  if (!value) return;
  broadcastSignIn();
  document.cookie = `${AUTH_SIGNIN_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

// ── Anchor capture broadcast (feature 004, 📌 DECISION-15) ───────────────────
// Sibling helpers to the auth broadcast above — NOT a parallel mechanism. When a
// user captures their calibration anchor in one tab, sibling tabs sitting on the
// onboarding step / /app/calibrate refresh so they fall through to /app (FR-034).

export const ANCHOR_BROADCAST_KEY = "serenify-anchor-captured";

/**
 * Write an anchor-captured marker to localStorage. Called from the recorder's
 * success path after the vector is persisted. The timestamp guarantees a
 * `storage` event even on a repeat capture (browsers skip unchanged writes).
 * No-op under SSR; best-effort (localStorage can throw in sandboxed contexts).
 */
export function broadcastAnchorCaptured(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ANCHOR_BROADCAST_KEY, `captured:${Date.now()}`);
  } catch {
    // see broadcastSignIn — best-effort; failure just means no sibling refresh.
  }
}

/** True iff a storage-event newValue is an anchor-captured marker. */
export function parseAnchorBroadcast(newValue: string | null): boolean {
  return newValue != null && newValue.startsWith("captured:");
}

// ── Calibration banner session-dismissal (FR-023/024) ────────────────────────
// The banner's "dismiss" hides it for the current auth session: across
// refreshes, but NOT across sign-out/sign-in. The storage layer is
// sessionStorage (survives a same-tab refresh, scoped to one tab); the
// auth-session reset is achieved by clearing the key as part of every
// sign-out flow — both the initiating tab (broadcastSignOut, above) and any
// sibling tab that handles the cross-tab signout broadcast (cross-tab-auth).

export const ANCHOR_BANNER_DISMISS_KEY = "serenify-anchor-banner-dismissed";

/**
 * Remove the calibration-banner dismissal marker from sessionStorage so the
 * next sign-in re-shows the banner (FR-023/024). Called from broadcastSignOut
 * and from cross-tab-auth's signout branch. No-op under SSR; best-effort
 * (sessionStorage can throw in sandboxed contexts).
 */
export function clearAnchorBannerDismissal(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ANCHOR_BANNER_DISMISS_KEY);
  } catch {
    // best-effort — failure here just means a fresh sign-in in the same tab
    // re-sees the banner-already-dismissed state until the tab closes.
  }
}
