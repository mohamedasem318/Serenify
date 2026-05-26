import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Static security headers (no per-request value) — applied to every response,
 * including `/_next/static` assets that the `proxy.ts` matcher deliberately
 * excludes. The per-request, nonce-bearing Content-Security-Policy is set in
 * `proxy.ts` instead (it cannot be static). See docs/security/05-csp-header.md.
 */
const securityHeaders = [
  // Stop MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Old-browser backstop to CSP `frame-ancestors 'none'` (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Send only the origin (no path/query) cross-origin — keeps `?next=` /
  // reset tokens out of third-party Referer.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Deny-by-default for powerful features. camera/microphone are relaxed by
  // features 004 (webcam+rPPG) / 013 (audio) when they land — scoped to the
  // capture routes, not pre-enabled here.
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Explicitly disable the legacy XSS auditor (removed from Chrome 2019; was
  // exploitable as a data-exfil oracle on old IE).
  { key: "X-XSS-Protection", value: "0" },
  // Sever cross-origin window.opener references (no window.open/OAuth-popup
  // flows exist — Supabase uses the redirect callback).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Block cross-origin no-cors reads of app responses.
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // HSTS is production-only — on localhost it would force http→https and break
  // dev. `preload` is intentionally omitted (near-irreversible commitment; see
  // DECISIONS.md slice-5). `includeSubDomains` alone still qualifies the domain
  // for preload when that decision is consciously made.
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
