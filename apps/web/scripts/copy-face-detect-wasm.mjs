// Self-host the MediaPipe Tasks-Vision WASM runtime for the calibration capture
// flow (feature 005, 📌 DECISION-19/20). Copies the pinned package's wasm assets
// into public/face-detect/wasm/ so they are served SAME-ORIGIN (covered by the
// CSP `connect-src 'self'`) — no third-party CDN, no new connect-src host.
//
// Runs automatically via `predev` / `prebuild` (and is safe to run by hand:
// `npm run face-detect:wasm`). The generated wasm is gitignored and reproduced
// from the locked dependency; only the small .tflite model is committed.
//
// If the copy ever fails, the in-browser detector's capability probe falls back
// to "no live guide — you can still record" (FR-011), so the app degrades calmly
// rather than breaking.

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
// Resolve the package entry (the "." export) — `./package.json` is not exposed by
// the package's `exports` map. The wasm/ folder sits beside the bundle at the root.
const wasmSrcDir = join(dirname(require.resolve("@mediapipe/tasks-vision")), "wasm");
const destDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "face-detect", "wasm");

// FilesetResolver.forVisionTasks() loads the SIMD pair and falls back to no-SIMD.
const FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

mkdirSync(destDir, { recursive: true });
let copied = 0;
for (const file of FILES) {
  const src = join(wasmSrcDir, file);
  if (!existsSync(src)) {
    console.warn(`[face-detect] missing wasm asset (skipped): ${src}`);
    continue;
  }
  cpSync(src, join(destDir, file));
  copied += 1;
}
console.log(`[face-detect] copied ${copied}/${FILES.length} wasm assets -> public/face-detect/wasm/`);
