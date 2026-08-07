import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// --- Self-host the MediaPipe detector WASM (feature 005, 📌 DECISION-19/20) ---
// Copy the runtime from the lockfile-pinned @mediapipe/tasks-vision into public/
// so it is served SAME-ORIGIN (covered by the CSP `connect-src 'self'`; never a
// CDN — the detector is given an explicit local path in lib/face-detect/detector
// .ts). This runs at the start of every `next dev` / `next build` (config load),
// so a clean checkout or deploy reliably has it regardless of whether the build
// is invoked as `next build` or `npm run build`. The ~22 MB runtime is gitignored
// and reproduced here from the pinned dep; only the small .tflite model is
// committed (📌 DECISION-19 gitignore note). Resilient by design: a copy failure
// degrades to the detector's "no live guide — you can still record" fallback
// (FR-011) and never breaks the build. cwd is the app dir for `next dev|build`.
(function copyFaceDetectWasm() {
  try {
    const require = createRequire(join(process.cwd(), "next.config.ts"));
    const wasmSrc = join(dirname(require.resolve("@mediapipe/tasks-vision")), "wasm");
    const dest = join(process.cwd(), "public", "face-detect", "wasm");
    mkdirSync(dest, { recursive: true });
    for (const file of [
      "vision_wasm_internal.js",
      "vision_wasm_internal.wasm",
      "vision_wasm_nosimd_internal.js",
      "vision_wasm_nosimd_internal.wasm",
    ]) {
      const src = join(wasmSrc, file);
      if (existsSync(src)) cpSync(src, join(dest, file));
    }
  } catch (error) {
    console.warn("[face-detect] WASM self-host copy skipped (detector will fall back):", error);
  }
})();

// Deny-by-default Permissions-Policy. camera is relaxed to (self) on the capture
// routes only (feature 004, DECISION-16; + the feature-008 monitoring stage);
// microphone stays denied everywhere — audio is feature 013, not 004.
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
    // denied everywhere. COEP is intentionally NOT set anywhere: feature 005 DOES
    // load WASM in apps/web (the on-device face detector, capture routes only),
    // but it runs single-threaded, so no cross-origin isolation (COOP+COEP) is
    // required. The detector's scoped wasm allowance lives in the proxy.ts CSP
    // (📌 DECISION-20); the server-side extraction pipeline is unchanged.
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

// The routes that run getUserMedia and therefore need camera=(self): the anchor
// recorder (onboarding step + recalibrate) and the feature-008 live
// stress-monitoring stage. Everywhere else stays camera=(). A new capture route
// MUST be added here AND to the negative-lookahead exclusion below (and to
// `isCaptureRoute` in proxy.ts for the on-device detector WASM) — feature 008
// originally registered /app/monitor in none of them, so getUserMedia was rejected
// by the inherited camera=() policy despite a granted permission.
// /capture-probe is the flag-gated mobile capture probe (docs/triage/
// mobile-capture-diagnosis.md) — a 404 unless NEXT_PUBLIC_CAPTURE_PROBE=1 is baked
// into the build, but its Permissions-Policy registration must exist unconditionally
// (headers here are static; a probe build with the inherited camera=() would repeat
// the exact regression this list documents).
const CAPTURE_ROUTES = ["/onboarding", "/app/calibrate", "/app/monitor", "/capture-probe"];

const nextConfig: NextConfig = {
  // DEV SERVER ONLY — ignored in production builds (`next build` does not read
  // allowedDevOrigins). Lets a device on the same Wi-Fi (here the dev laptop's
  // LAN IP) reach Next dev resources (/_next/webpack-hmr etc.) so a real phone
  // can load and hydrate the app for the cross-browser smoke matrix. Next 16
  // blocks cross-origin dev requests by default; without this the HMR client
  // fails and the dev runtime thrashes in a reload loop (no hydration → dead
  // taps). Teammates on a different network add their own LAN IP here — it has
  // zero production effect. See investigation 2026-05-29.
  allowedDevOrigins: ["192.168.100.11"],
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
        source: "/((?!onboarding|app/calibrate|app/monitor|capture-probe).*)",
        headers: securityHeaders(PERMISSIONS_POLICY_CAMERA_DENIED),
      },
    ];
  },
};

export default nextConfig;
