import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const webRoot = resolve(__dirname, "../..");
const productionRoots = ["app", "lib"].map((dir) => resolve(webRoot, dir));
const replayHarness = resolve(webRoot, "../api/tests/test_inference_replay_local.py");
const authE2eSpecs = [
  resolve(webRoot, "tests/e2e/employee-signup.spec.ts"),
  resolve(webRoot, "tests/e2e/reset-password.spec.ts"),
];
const forbiddenRuntimeTokens = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "service_role",
  "service-role",
  "createAdminClient",
  "supabaseServiceRoleKey",
  "/auth/v1/admin/",
  // The purpose-made seeding identity (#208, DECISIONS 2026-08-14). Its token
  // is not a secret (derived from the CLI's public local dev secret), but the
  // IDENTITY is elevated: no request-serving code path may acquire it, same
  // rule as service_role. Role name, factory, module path, and signer.
  "serenify_seeder",
  "createSeederClient",
  "seeder-client",
  "signLocalDevJwt",
];

function stripNonExecutableText(source: string, file: string): string {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  if (file.endsWith(".py")) {
    return withoutComments
      .replace(/(^|\n)\s*(?:[rubf]{0,3})?(?:\"\"\"[\s\S]*?\"\"\"|'''[\s\S]*?''')/gi, "$1")
      .replace(/#.*$/gm, "");
  }
  return withoutComments;
}

function sourceFiles(root: string): string[] {
  const entries = readdirSync(root);
  return entries.flatMap((entry) => {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return sourceFiles(path);
    if (!/\.(ts|tsx|mts)$/.test(entry)) return [];
    if (/\.test\.(ts|tsx|mts)$/.test(entry)) return [];
    return [path];
  });
}

describe("runtime secret posture", () => {
  it("keeps service-role/admin-client code out of production runtime and replay files", () => {
    const files = [...productionRoots.flatMap(sourceFiles), replayHarness];
    const violations = files.flatMap((file) => {
      const source = stripNonExecutableText(readFileSync(file, "utf8"), file);
      return forbiddenRuntimeTokens
        .filter((token) => source.includes(token))
        .map((token) => `${file.replace(`${webRoot}\\`, "")}: ${token}`);
    });

    expect(violations).toEqual([]);
  });

  it("keeps privileged auth bypasses out of auth e2e specs", () => {
    const violations = authE2eSpecs.flatMap((file) => {
      const source = stripNonExecutableText(readFileSync(file, "utf8"), file);
      return forbiddenRuntimeTokens
        .filter((token) => source.includes(token))
        .map((token) => `${file.replace(`${webRoot}\\`, "")}: ${token}`);
    });

    expect(violations).toEqual([]);
  });

  it("does not ship a runtime Supabase admin client module", () => {
    expect(existsSync(resolve(webRoot, "lib/supabase/admin.ts"))).toBe(false);
  });
});
