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
    // A capture — first-time OR recalibration — permanently retires the
    // recalibration prompt in this browser. Written HERE rather than at a
    // recalibration-specific call site precisely because this is the one
    // function every successful capture already funnels through, so the latch
    // cannot drift out of sync with the thing it claims to record. See the
    // block at the bottom of this file for why the latch is browser-scoped.
    localStorage.setItem(RECALIBRATION_PROMPT_DONE_KEY, "1");
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
//
// Cross-tab dismissal sync (Mohamed 2026-05-28, ST-17): the literal spec says
// "session-only", but the consistent UX expectation is "same user, same
// session, same intent" — dismissing in one tab should hide the banner in
// sibling tabs too. The dismissal travels via a SEPARATE localStorage
// broadcast key (storage events only fire across documents on localStorage,
// and the sessionStorage key is intentionally per-tab); the cross-tab-auth
// listener mirrors the dismissal into the receiving tab's own sessionStorage
// so the hidden state survives that tab's later refreshes too.

export const ANCHOR_BANNER_DISMISS_KEY = "serenify-anchor-banner-dismissed";
export const ANCHOR_BANNER_DISMISS_BROADCAST_KEY =
  "serenify-anchor-banner-dismissed-broadcast";

/**
 * Notify sibling tabs that the calibration banner was dismissed in this tab.
 * The originating tab still owns its own sessionStorage write (the banner
 * does that as part of its dismiss handler); this helper exists so the
 * cross-tab signal travels alongside but does not couple the storage
 * mechanisms. Timestamped value so consecutive writes still fire a `storage`
 * event in siblings. No-op under SSR; best-effort (localStorage can throw in
 * sandboxed contexts).
 */
export function broadcastAnchorBannerDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      ANCHOR_BANNER_DISMISS_BROADCAST_KEY,
      `dismissed:${Date.now()}`,
    );
  } catch {
    // see broadcastSignIn — best-effort; failure just means no sibling sync.
  }
}

/** True iff a storage-event newValue is an anchor-banner-dismissed marker. */
export function parseAnchorBannerDismissBroadcast(
  newValue: string | null,
): boolean {
  return newValue != null && newValue.startsWith("dismissed:");
}

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

// ── Recalibration prompt — the permanent "already redone it" latch ───────────
//
// The recalibration prompt (components/anchor/recalibration-prompt.tsx) recommends
// that a user who ALREADY has an anchor records a new one, because capture changed
// materially — resolution, container/codec and bitrate all moved — and scoring is
// window-minus-anchor. An anchor captured under the old settings is compared against
// windows captured under the new ones. Nothing in the API detects that; there is no
// anchor-to-window guard. It is a silent scoring error, not a visible bug.
//
// DISMISSAL IS NOT A NEW MECHANISM. The prompt reuses ANCHOR_BANNER_DISMISS_KEY
// above verbatim — the same sessionStorage key, the same sign-out clearing, the same
// cross-tab broadcast. That is safe because the two surfaces are MUTUALLY EXCLUSIVE
// by construction: `app/(authed)/app/page.tsx` renders the banner only on
// `hasAnchor === false` and the prompt only on `hasAnchor === true`, so no user can
// ever see both and no dismissal can ever be attributed to the wrong surface.
//
// WHAT IS NEW is only the key below — the "they have actually recalibrated, never ask
// again" latch. It needs its own storage because it is the one part of this feature
// the session-scoped dismissal cannot express: dismissal must come back next login,
// this must not, ever.
//
// WHY localStorage AND NOT THE DATABASE (Mohamed, 2026-08-10). There is no server-side
// signal available to answer "have they redone it since capture changed":
// `has_anchor()` returns a bare boolean, and `anchor_captured_at` is deliberately
// unreadable by every client role — the column-level SELECT whitelist in
// `20260527000000_anchor_columns.sql` omits all three anchor columns, and DECISION-23 /
// FR-041 say calibration state is whether-set and never a date. Answering it
// server-side therefore means storing something new ABOUT the user, which is a
// Privacy-Policy and Terms question, for what is only a UI preference. A deploy-date
// cutoff on `anchor_captured_at` was rejected for the same reason plus a second one:
// it collapses into cohort-targeting-by-timestamp, which this feature deliberately
// does not do — everyone with an anchor is prompted.
//
// THE ACCEPTED COST, stated plainly: "permanently" means per browser profile. A user
// who recalibrates on their laptop and later signs in on their phone is prompted once
// more there, and dismissing does not stop it — only capturing on that device does.
// With this user base that is a small, bounded annoyance and not worth a migration.
//
// NOT CLEARED ON SIGN-OUT — deliberately, and it is the whole point of the key. It
// records a fact about the anchor ("a capture has happened in this browser since the
// prompt shipped"), not about the session, so `clearAnchorBannerDismissal` above must
// never learn about it.

export const RECALIBRATION_PROMPT_DONE_KEY = "serenify-recalibration-prompt-done";

/**
 * True iff this browser has recorded a capture since the recalibration prompt
 * shipped — i.e. the prompt is permanently retired here. Reads localStorage
 * directly rather than caching, so a capture in THIS tab takes effect on the next
 * render without any invalidation step. Returns false under SSR and treats a
 * throwing storage (sandboxed iframe, private-browsing) as "not done": the cost of
 * a false negative is one extra dismissible prompt, the cost of a false positive is
 * a user who silently never gets asked.
 */
export function hasCompletedRecalibrationPrompt(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(RECALIBRATION_PROMPT_DONE_KEY) === "1";
  } catch {
    return false;
  }
}
