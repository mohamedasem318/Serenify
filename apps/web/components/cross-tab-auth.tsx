"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Pathnames where a SIGNED_IN event in a SIBLING tab means the user
 * landed on /app from a sign-in elsewhere — this tab should follow.
 * All five are "signed-out surfaces" plus the bare `/` landing.
 */
const SIGNED_IN_FROM_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
] as const;

/**
 * Pathnames where a SIGNED_OUT event in a SIBLING tab means the user
 * signed out elsewhere — this tab should bounce to /login. /onboarding
 * is included because it lives in its own (onboarding) route group as
 * of Phase 5's restructure (309e78d) — it is authed but sits outside
 * the (authed) layout, so the layout-level guard would not catch a
 * cross-tab sign-out on its own.
 */
const SIGNED_OUT_FROM_PATHS = ["/app", "/onboarding"] as const;

function pathMatches(
  pathname: string,
  prefixes: readonly string[],
): boolean {
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Cross-tab auth state listener (📌 DECISION-8).
 *
 * Mounted at the ROOT layout (apps/web/app/layout.tsx) — NOT the
 * (authed) layout — so the listener is live on every surface,
 * including /login itself. Per US-6 AS-1 the listener must fire when
 * both tabs are at /login (e.g. user opens two sign-in tabs, signs
 * in via Tab A, expects Tab B to follow), which would not work if
 * the listener only mounted inside the (authed) tree.
 *
 * Lives under components/ rather than under app/ so the app/
 * directory stays route-only (medium-fix-14 in plan.md).
 *
 * Returns null — no visible UI, just side effects.
 *
 * FR-046 navigation rules (pathname-gated):
 *   - SIGNED_IN  on /, /login, /signup, /forgot-password,
 *     /reset-password  →  router.push("/app")
 *   - SIGNED_OUT on /app, /onboarding  →  router.push("/login")
 *   - TOKEN_REFRESHED  →  no-op, regardless of pathname
 *   - All other transitions  →  no-op
 *
 * Storage-event mechanics: supabase-js (the @supabase/ssr browser
 * client) subscribes its own `storage` listener internally when
 * persistSession is enabled (the default). When Tab A's
 * onAuthStateChange fires due to a sign-in, the same client writes
 * the new session to localStorage; Tab B's `storage` event handler
 * picks it up and re-emits onAuthStateChange in Tab B. The listener
 * here sees that re-emission and navigates if the pathname matches.
 *
 * Subscription cleanup: the effect captures the
 * `{ data: { subscription } }` return value and calls
 * subscription.unsubscribe() on cleanup. The effect re-runs when
 * pathname changes — which is fine, because we WANT the listener
 * to evaluate against the latest pathname. The re-subscribe window
 * is sub-millisecond.
 */
export function CrossTabAuth(): null {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED") return;

      if (
        event === "SIGNED_IN" &&
        pathMatches(pathname, SIGNED_IN_FROM_PATHS)
      ) {
        router.push("/app");
        return;
      }

      if (
        event === "SIGNED_OUT" &&
        pathMatches(pathname, SIGNED_OUT_FROM_PATHS)
      ) {
        router.push("/login");
        return;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  return null;
}
