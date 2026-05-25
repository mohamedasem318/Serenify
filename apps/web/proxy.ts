import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next 16 renamed `middleware.ts` to `proxy.ts` and the exported function to
 * `proxy` (the old names are deprecated, see Next 16 docs §
 * "Migration to Proxy"). Functionality is unchanged.
 *
 * Five-step gate per contracts/routes.md § Middleware contract:
 *   1. Refresh the Supabase session cookie.
 *   2. Unauthenticated visitor on /app or /onboarding → /login.
 *   3. Authenticated user on /login, /signup, /forgot-password,
 *      /reset-password → /app.
 *   4. Authenticated user with full_name IS NULL → /onboarding
 *      (skip /api/* and the /onboarding page itself).
 *   5. Authenticated user with full_name set on /onboarding → /app.
 */

// /reset-password is intentionally NOT in this set: recovery flow lands
// a signed-in user there with a recovery-scoped session, so bouncing
// them away would break the password-update step.
const AUTH_PAGES = new Set([
  "/login",
  "/signup",
  "/forgot-password",
]);

const PROTECTED_PREFIXES = ["/app", "/onboarding"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
      cookieOptions: {
        // Slice 2 Finding 2: add Secure on sb-* session cookies in production.
        // httpOnly/sameSite intentionally left at @supabase/ssr defaults
        // (httpOnly: false, sameSite: "lax") — httpOnly: true would break the
        // browser client. See docs/security/02-auth-cookies-broadcast.md
        // Finding 2 and the DECISIONS.md 2026-05-25 cookie-Secure policy entry.
        secure: process.env.NODE_ENV === "production",
      },
    },
  );

  // getUser() contacts the auth server and verifies the JWT — required
  // for authorization decisions (getSession() returns unverified data).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthPage = AUTH_PAGES.has(pathname);
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // Step 2: unauthenticated visitor hitting a protected route.
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Step 3: signed-in user trying to reach an auth page.
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Steps 4 & 5: onboarding gate.
  if (user && !pathname.startsWith("/api/")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const needsOnboarding = profile?.full_name == null;

    if (needsOnboarding && pathname !== "/onboarding") {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (!needsOnboarding && pathname === "/onboarding") {
      const url = request.nextUrl.clone();
      url.pathname = "/app";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
