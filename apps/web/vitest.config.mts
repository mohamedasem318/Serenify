import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    // happy-dom: lighter than jsdom and avoids @csstools/css-calc ESM-CJS
    // require() conflicts on Node < 22.12. Drop in jsdom later if a test
    // ever needs a behaviour happy-dom doesn't cover.
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./tests/unit/setup.ts"],
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "components/**/*.test.{ts,tsx}",
      "lib/**/*.test.{ts,tsx}",
      "hooks/**/*.test.{ts,tsx}",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
