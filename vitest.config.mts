import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/__tests__/**/*.test.ts"],
    testTimeout: 60_000,
    // Integration suites (SUPABASE_INTEGRATION=1) share one local Supabase
    // and mutate the global admin set (security-hardening's last-admin guard
    // test) / the demo cohort (seed-demo's count assertions). Run test files
    // serially so they can't race — same rationale as the Playwright
    // workers:1 decision (DECISIONS.md 2026-05-17). Negligible cost on the
    // sub-second non-integration unit files.
    fileParallelism: false,
  },
});
