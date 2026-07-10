import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const webRoot = resolve(__dirname, "../..");
const productionRoots = ["app", "lib"].map((dir) => resolve(webRoot, dir));
const forbiddenRuntimeTokens = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "service_role",
  "service-role",
  "createAdminClient",
  "supabaseServiceRoleKey",
];

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
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
  it("keeps service-role/admin-client code out of production web runtime files", () => {
    const files = productionRoots.flatMap(sourceFiles);
    const violations = files.flatMap((file) => {
      const source = stripComments(readFileSync(file, "utf8"));
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
