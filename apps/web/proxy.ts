import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env/client";

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
 *
 * Slice 5 also emits the Content-Security-Policy here: the policy carries a
 * per-request nonce, so it cannot be a static header. The nonce is set on both
 * the forwarded REQUEST headers (Next reads it to stamp its own inline
 * scripts — RSC flight + bootstrap) and the RESPONSE (browser enforcement).
 * Static security headers live in next.config.ts instead. See
 * docs/security/05-csp-header.md.
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

// Header name for the CSP. Enforcing. The slice-5 fix pass first shipped this as
// "content-security-policy-report-only" and drove every route under Playwright
// (capturing securitypolicyviolation events) until the violation list was empty
// — the one real finding (Zod 4's JIT `new Function` probe) was resolved via the
// `@/lib/zod` jitless barrel rather than weakening script-src with 'unsafe-eval'.
// See docs/security/05-csp-header.md. Next reads the nonce from this header on
// the request to stamp its framework inline scripts.
const CSP_HEADER = "content-security-policy";

/**
 * Build the per-request CSP string. The 128-bit nonce (CSP3 floor) is generated
 * with the Edge-runtime-safe global Web Crypto `getRandomValues` (the Node
 * `crypto.randomBytes` import is unavailable in the Edge runtime middleware runs
 * in); `Buffer` is polyfilled by Next in the Edge runtime.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const supabaseOrigin = new URL(clientEnv.supabaseUrl).origin;
  // FastAPI anchor service (feature 004) — the first non-Supabase, non-same-origin
  // connect-src entry. Dev default http://127.0.0.1:8000; prod the configured
  // NEXT_PUBLIC_API_URL origin. The recorder POSTs the clip + GETs /healthz here.
  const apiOrigin = new URL(clientEnv.apiUrl).origin;
  const directives = [
    "default-src 'self'",
    // Nonce covers the 2 app inline scripts (theme-migration IIFE, next-themes
    // FOUC) + the 9 framework inline scripts (auto-stamped). 'strict-dynamic'
    // propagates trust to the chunk scripts the nonced bootstrap loads. Dev
    // (Turbopack) needs 'unsafe-eval' (React debug eval); prod does not.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // 'unsafe-inline' (NOT a nonce): Radix react-remove-scroll injects a runtime
    // <style> that is un-nonced under Turbopack/SWC, and a nonce on style-src
    // would make the browser IGNORE 'unsafe-inline' and break scroll-lock.
    // CSS cannot execute JS, so this is far lower-risk than on script-src.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self'",
    "font-src 'self'",
    // Supabase REST/Auth/Storage. No wss: (no realtime .channel() today). Dev
    // adds the local Supabase origin.
    `connect-src 'self' ${supabaseOrigin} ${apiOrigin}${isDev ? " http://127.0.0.1:54321 ws://127.0.0.1:54321" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
  ];
  // `upgrade-insecure-requests` is PRODUCTION-ONLY. In dev the app is served over
  // http://localhost and WebKit honors this directive by upgrading even loopback
  // subresource requests to https (Chromium/Firefox exempt localhost) — every
  // /_next/static chunk then fails with an SSL error and the page never
  // hydrates. It is also a no-op in dev (no mixed content on an http origin).
  // Verified empirically: WebKit e2e matrix 12 failures → 0 once dev drops it.
  if (!isDev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export async function proxy(request: NextRequest) {
  // --- CSP / nonce (slice 5) ---
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    "base64",
  );
  const csp = buildCsp(nonce);

  // The nonce + CSP must ride the forwarded REQUEST headers so Next stamps its
  // own inline scripts; `x-nonce` lets the root layout read the value cheaply.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(CSP_HEADER, csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(CSP_HEADER, csp);

  const supabase = createServerClient(
    clientEnv.supabaseUrl,
    clientEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // Re-create the response with the same forwarded headers so the nonce
          // override is not lost, then re-apply the response CSP.
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.headers.set(CSP_HEADER, csp);
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

  // Carry the CSP header onto a redirect response (defense-in-depth /
  // consistency — redirects render no HTML, so the nonce is moot there).
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    redirect.headers.set(CSP_HEADER, csp);
    return redirect;
  };

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
    return redirectTo("/login");
  }

  // Step 3: signed-in user trying to reach an auth page.
  if (user && isAuthPage) {
    return redirectTo("/app");
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
      return redirectTo("/onboarding");
    }

    if (!needsOnboarding && pathname === "/onboarding") {
      return redirectTo("/app");
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Skip RSC prefetch requests (not full HTML documents → no CSP/nonce
    // needed); the actual navigation still hits the proxy and is gated.
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
