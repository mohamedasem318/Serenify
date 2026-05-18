import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";

// Load .env.local for the test runner. Next.js does this automatically
// for the dev server but Playwright's own process needs the env to:
//   1. Pass the localhost-guard in globalSetup
//   2. Construct the admin client with SUPABASE_SERVICE_ROLE_KEY
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/setup/**"],
  fullyParallel: false,
  // All specs share one local Supabase. Serializing across workers
  // avoids races on the seeded test admin and on user-state cleanup.
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: path.resolve(__dirname, "./tests/e2e/setup/global-setup.ts"),
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
