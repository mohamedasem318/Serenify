import { defineConfig, devices } from "@playwright/test";

import { assertPortFree } from "./tests/port-guard";

/**
 * Layout-only Playwright config (feature 009) — pure rendered-geometry guards that need a real
 * browser with real layout but NO database. Deliberately separate from `playwright.config.ts`:
 *   • NO globalSetup → does not require a local Supabase (the auth e2e suite does).
 *   • baseURL uses `localhost` (NOT 127.0.0.1) — the dev server's canonical origin. Hitting
 *     127.0.0.1 trips Next 16's cross-origin dev-block (allowedDevOrigins), which suppresses
 *     HMR and hydration → the page freezes at its un-hydrated SSR output and the live
 *     measurement path never runs. localhost hydrates, so the ResizeObserver math is exercised.
 *   • chromium only — this asserts layout math, not cross-browser rendering.
 *
 * Run: `npm run test:layout`. Specs live in tests/layout/.
 */

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);

// See tests/port-guard.ts — runs before Playwright's own port error, whose suggested
// remedy is the reuse this config deliberately disables.
assertPortFree(PORT, "playwright.layout.config.ts");

export default defineConfig({
  testDir: "./tests/layout",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Never reuse — same reasoning as playwright.config.ts (#261): an ECONNRESET dev
    // server keeps listening and poisons every later run. tests/port-guard.ts.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "layout-test-placeholder".repeat(8),
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000",
      SITE_URL: process.env.SITE_URL ?? `http://localhost:${PORT}`,
    },
  },
});
