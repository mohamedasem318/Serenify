"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  ANCHOR_BROADCAST_KEY,
  AUTH_BROADCAST_KEY,
  consumePendingSignIn,
  parseAnchorBroadcast,
  parseAuthBroadcast,
} from "@/lib/auth-broadcast";
import { createClient } from "@/lib/supabase/client";

/**
 * Pathnames where a sibling tab's sign-in should pull this tab to
 * /app. The bare `/` landing plus the five "signed-out surfaces."
 */
const SIGNED_IN_FROM_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
] as const;

/**
 * Pathnames where a sibling tab's sign-out should bounce this tab
 * to /login. /onboarding is included because it lives in its own
 * (onboarding) route group as of Phase 5's restructure (309e78d)
 * — authed but outside the (authed) layout's reach.
 */
const SIGNED_OUT_FROM_PATHS = ["/app", "/onboarding"] as const;

/**
 * Pathnames where a sibling tab's anchor capture should refresh this tab
 * (📌 DECISION-15, FR-034). A refresh on /onboarding re-runs proxy.ts, which
 * bounces a full_name-set user to /app; on /app/calibrate it re-renders with the
 * now-captured anchor. Re-calibration from /app/calibrate stays available.
 */
const ANCHOR_REFRESH_FROM_PATHS = ["/onboarding", "/app/calibrate"] as const;

function pathMatches(
  pathname: string,
  prefixes: readonly string[],
): boolean {
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Cross-tab auth state listener (📌 DECISION-8 + amended Decision N).
 *
 * Mounted at the ROOT layout (apps/web/app/layout.tsx) — NOT the
 * (authed) layout — so the listener is live on every surface,
 * including /login itself. Per US-6 AS-1 the listener must fire
 * when both tabs are at /login (e.g. user opens two sign-in tabs,
 * signs in via Tab A, expects Tab B to follow), which would not
 * work if the listener only mounted inside the (authed) tree.
 *
 * Lives under components/ rather than under app/ so the app/
 * directory stays route-only (medium-fix-14 in plan.md).
 *
 * Returns null — no visible UI, just side effects.
 *
 * Subscription target — `window` storage events on the custom key
 * `serenify-auth-broadcast` (📌 DECISION-N amendment 2026-05-22,
 * see CHANGELOG). The original Decision N pointed at supabase-js's
 * storage-event firing, which assumes session-in-localStorage.
 * @supabase/ssr stores the session in COOKIES, so supabase-js's
 * cross-tab BroadcastChannel never fires for the Server-Action
 * sign-in / sign-out path feature 001 uses. The marker-on-
 * localStorage bridge in lib/auth-broadcast.ts is what makes
 * cross-tab work in cookie-session world.
 *
 * FR-046 navigation rules (pathname-gated):
 *   - "signin"  on /, /login, /signup, /forgot-password,
 *     /reset-password  →  router.push("/app")
 *   - "signout" on /app, /onboarding  →  router.push("/login")
 *   - All other transitions  →  no-op
 *
 * The window `storage` event fires in OTHER same-origin
 * documents — not in the tab that wrote — so the tab that
 * called broadcastSignIn/broadcastSignOut won't react to its
 * own broadcast (and shouldn't, because it's navigating itself
 * via the same flow that wrote the marker).
 */
export function CrossTabAuth(): null {
  const router = useRouter();
  const pathname = usePathname();

  // 📌 ST-8 fix (2026-05-25): the email-verification / invite path
  // establishes the session in the server-only /auth/callback route,
  // which can't write the localStorage broadcast marker the way the
  // client-side form path does. That route instead drops a short-lived
  // AUTH_SIGNIN_COOKIE on its redirect; this mount-once effect — running
  // on whichever authed surface the user lands on (/app or /onboarding,
  // both under this root-layout component) — consumes the cookie and
  // emits the same `signin` broadcast, so sibling tabs propagate exactly
  // as they do for the form path. No-op on every other mount (cookie
  // absent), including the form path which broadcasts itself.
  useEffect(() => {
    consumePendingSignIn();
  }, []);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      // Anchor capture in a sibling tab → refresh if we're on a surface that
      // should fall through once the anchor exists (FR-034).
      if (event.key === ANCHOR_BROADCAST_KEY) {
        if (
          parseAnchorBroadcast(event.newValue) &&
          pathMatches(pathname, ANCHOR_REFRESH_FROM_PATHS)
        ) {
          router.refresh();
        }
        return;
      }
      if (event.key !== AUTH_BROADCAST_KEY) return;
      const auth = parseAuthBroadcast(event.newValue);
      if (auth === "signin" && pathMatches(pathname, SIGNED_IN_FROM_PATHS)) {
        router.push("/app");
      } else if (
        auth === "signout" &&
        pathMatches(pathname, SIGNED_OUT_FROM_PATHS)
      ) {
        // Race-condition guard: the originating tab's Server Action
        // clears session cookies via its HTTP response, which may
        // not have landed in the browser by the time the broadcast's
        // storage event fires. If we router.push("/login") right
        // now, feature 001's proxy.ts sees the still-valid cookies
        // and redirects us back to /app. Calling supabase.auth.signOut()
        // locally ensures the cookies are cleared (it issues its own
        // logout request and a Set-Cookie clearing response) before
        // we navigate. The IIFE swallows any auth-server error so
        // the navigation still happens — best-effort UX.
        void (async () => {
          try {
            await createClient().auth.signOut();
          } catch {
            // Auth server unreachable or already-cleared session —
            // navigate anyway so the user isn't stuck on the authed
            // surface.
          }
          router.push("/login");
        })();
      }
    }

    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [pathname, router]);

  return null;
}
