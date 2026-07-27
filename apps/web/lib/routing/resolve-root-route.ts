/**
 * The root route's load-bearing decision, extracted as a pure function
 * (feature 013, US1 — T084; `research.md` §11 "Proof").
 *
 * `/` has three outcomes and P6 changes exactly one of them: the terminal branch stops
 * redirecting to `/login` and starts rendering the landing page. The other two — the
 * `?code=` forward and the signed-in redirect to `/app` — are behaviours FR-017 protects,
 * so they are lifted out of the Server Component and into something a unit table can
 * exhaust. Same technique `resolveCalibrateMode` uses, for the same reason: a Server
 * Component's branch is awkward to test, a pure function is not.
 *
 * PRECEDENCE IS FIXED BY §11 AND THE ORDER MATTERS:
 *
 *   1. `?code=` first. A Supabase email link that lands on `/` (a misconfigured
 *      `site_url`, say) must forward to the callback so the PKCE exchange still happens.
 *      It is FIRST because a visitor already signed in in another tab would otherwise be
 *      redirected to `/app` and the code lost — an unrecoverable dead end on a recovery
 *      link.
 *   2. Signed in second → `/app`. The proxy's onboarding gate then bounces an
 *      un-onboarded user onward, exactly as today.
 *   3. Landing last. Anonymous visitors get the public page.
 *
 * `code` is typed as Next's raw `searchParams` value rather than `string`, because that
 * is what the caller actually holds. Both non-string shapes are rejected the same way
 * today's page rejects them (`app/page.tsx:21`, `typeof code === "string" && code.length > 0`):
 * an ABSENT code and an EMPTY-STRING code are both "no code", and an ARRAY-valued code
 * (`/?code=a&code=b`) is not forwarded — there is no single code to exchange, and picking
 * one arbitrarily would be a guess about which link the visitor meant.
 *
 * Imports nothing. No `server-only`, no Supabase client, no env — Vitest loads it directly.
 */

export type RootRouteKind = "callback" | "app" | "landing";

/**
 * The resolved route. `callback` carries the narrowed `code` so the caller builds the
 * redirect URL without re-narrowing (and without a cast) — the `kind` field is still
 * exactly the three values `research.md` §11 fixes.
 */
export type RootRoute =
  | { kind: "callback"; code: string }
  | { kind: "app" }
  | { kind: "landing" };

export function resolveRootRoute({
  code,
  isSignedIn,
}: {
  code?: string | string[] | undefined;
  isSignedIn?: boolean;
}): RootRoute {
  // 1. `?code=` wins over everything, including a signed-in session.
  if (typeof code === "string" && code.length > 0) {
    return { kind: "callback", code };
  }

  // 2. A signed-in visitor goes to the application.
  if (isSignedIn) {
    return { kind: "app" };
  }

  // 3. Everyone else gets the landing page. (Before P6 this branch was `/login`.)
  return { kind: "landing" };
}
