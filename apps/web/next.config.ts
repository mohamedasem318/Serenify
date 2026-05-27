import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Deny-by-default Permissions-Policy. camera is relaxed to (self) on the two
// capture routes only (feature 004, DECISION-16); microphone stays denied
// everywhere — audio is feature 013, not 004.
const PERMISSIONS_POLICY_BASE =
  "microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()";
const PERMISSIONS_POLICY_CAMERA_DENIED = `camera=(), ${PERMISSIONS_POLICY_BASE}`;
const PERMISSIONS_POLICY_CAMERA_SELF = `camera=(self), ${PERMISSIONS_POLICY_BASE}`;

/**
 * Static security headers (no per-request value) — applied to every response,
 * including `/_next/static` assets that the `proxy.ts` matcher deliberately
 * excludes. The per-request, nonce-bearing Content-Security-Policy is set in
 * `proxy.ts` instead (it cannot be static). See docs/security/05-csp-header.md.
 *
 * `permissionsPolicy` is the only header that varies by route group; every
 * other header is identical across all routes.
 */
function securityHeaders(permissionsPolicy: string) {
  return [
    // Stop MIME-type sniffing.
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Old-browser backstop to CSP `frame-ancestors 'none'` (clickjacking).
    { key: "X-Frame-Options", value: "DENY" },
    // Send only the origin (no path/query) cross-origin — keeps `?next=` /
    // reset tokens out of third-party Referer.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Powerful-feature gate. camera=(self) only on the capture routes; mic
    // denied everywhere. COEP is intentionally NOT set anywhere — no WASM is
    // loaded in apps/web (extraction is server-side) and no cross-origin
    // isolation is needed (FR-039).
    { key: "Permissions-Policy", value: permissionsPolicy },
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
}

// The two routes that host the anchor recorder (onboarding step + recalibrate).
const CAPTURE_ROUTES = ["/onboarding", "/app/calibrate"];

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Capture routes: camera=(self). Listed first; the site-wide rule below
      // uses a negative lookahead so each capture path matches EXACTLY ONE
      // Permissions-Policy rule. Two matching rules would emit a *combined*
      // header (camera=() ∩ camera=(self) = denied) and break the camera — the
      // per-source precedence hazard flagged in tasks T030.
      ...CAPTURE_ROUTES.map((source) => ({
        source,
        headers: securityHeaders(PERMISSIONS_POLICY_CAMERA_SELF),
      })),
      // Everywhere else: camera=(). The negative lookahead excludes the capture
      // routes (and any subpaths) so there is no Permissions-Policy overlap.
      {
        source: "/((?!onboarding|app/calibrate).*)",
        headers: securityHeaders(PERMISSIONS_POLICY_CAMERA_DENIED),
      },
    ];
  },
};

export default nextConfig;
