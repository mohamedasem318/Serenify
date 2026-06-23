import { defineConfig, devices } from "@playwright/test";

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
    command: "npm run dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
