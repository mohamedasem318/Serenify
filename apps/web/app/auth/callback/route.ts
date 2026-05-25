import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import {
  AUTH_SIGNIN_COOKIE,
  destinationBroadcastsSignIn,
} from "@/lib/auth-broadcast";
import { isSafeNextPath } from "@/lib/auth/safe-next";

/**
 * Supabase email-confirmation / invite-acceptance landing per
 * contracts/routes.md § GET /auth/callback.
 *
 * The Supabase SSR cookie pattern here is the explicit-response one
 * (also used in apps/web/proxy.ts): the supabase client writes cookies
 * directly onto the NextResponse closure variable via the setAll
 * callback, then we return that response. Earlier the route relied on
 * `cookies().set()` from `next/headers` via lib/supabase/server.ts —
 * which works for the implicit response from a Route Handler but does
 * NOT propagate Set-Cookie headers when we return an explicit
 * `NextResponse.redirect(...)`. The session cookies set during
 * exchangeCodeForSession were being dropped, the PKCE verifier cookie
 * was also being rewritten without reaching the browser, and the
 * resulting "no session in browser" state showed up as ?error=expired_link
 * even though the underlying token had been spent. Returning the
 * closure-managed response fixes the propagation.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `next` is interpolated into the redirect URL below as `${origin}${next}`,
  // which is NOT same-origin-safe for arbitrary input (Finding 1). Validate it
  // through the single audited helper; fall back to /app on anything unsafe.
  // This `next` flows into BOTH the success redirect and the setAll closure's
  // redirect, so validating once here covers every interpolation site.
  const rawNext = searchParams.get("next") ?? "/app";
  const next = isSafeNextPath(rawNext) ? rawNext : "/app";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=expired_link`);
  }

  let response = NextResponse.redirect(`${origin}${next}`);

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
          response = NextResponse.redirect(`${origin}${next}`);
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

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=expired_link`);
  }

  // 📌 ST-8 fix (2026-05-25): the form sign-in path writes a localStorage
  // marker from the client so sibling tabs propagate (login-form.tsx →
  // broadcastSignIn). This route runs server-side and can't touch
  // localStorage, so the email-verification / invite path never
  // propagated cross-tab. Bridge it: drop a short-lived marker cookie on
  // the redirect that the landing tab's CrossTabAuth consumes on mount
  // (consumePendingSignIn) to emit the same broadcast. Gated to authed
  // destinations so the recovery flow (next=/reset-password) doesn't
  // broadcast a spurious sign-in. The cookie is set on the post-exchange
  // `response` so it rides the same Set-Cookie batch as the session
  // cookies; it survives proxy.ts's /app → /onboarding search-stripping
  // bounce because cookies aren't part of `url.search`.
  if (destinationBroadcastsSignIn(next)) {
    response.cookies.set(AUTH_SIGNIN_COOKIE, "1", {
      path: "/",
      maxAge: 60,
      httpOnly: false,
      sameSite: "lax",
      // Slice 2 Finding 3: add Secure in production. httpOnly stays false —
      // CrossTabAuth reads this marker from document.cookie. The value is the
      // non-sensitive literal "1". See docs/security/02-auth-cookies-broadcast.md
      // Finding 3.
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
