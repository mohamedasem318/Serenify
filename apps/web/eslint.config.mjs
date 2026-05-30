import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored, gitignored MediaPipe WASM runtime (📌 DECISION-19) — copied
    // same-origin from the pinned dep by next.config.ts. Generated third-party
    // glue (emscripten/GL), never our code; do not lint it.
    "public/face-detect/**",
  ]),
]);

export default eslintConfig;
