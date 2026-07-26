import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * T033 — FR-051: no `localStorage` and no `sessionStorage` anywhere in this feature.
 *
 * SCOPED TO THIS FEATURE'S DIRECTORIES, DELIBERATELY. The repository has pre-existing web
 * storage in `app/layout.tsx` (the theme bootstrap), `components/anchor/device-memory.ts`,
 * `lib/questionnaire/*`, and `components/home/recent-chats-card.tsx`. Those are not this
 * feature's, they are out of scope, and they MUST NOT be "fixed" here — a guard that
 * fails against code the current change did not write teaches people to disable the
 * guard. Later phases widen `FEATURE_DIRS` as they add directories.
 *
 * The scan reads files from disk rather than inspecting imports, because the failure this
 * guards against is a single line added to one component months from now — which an
 * import graph would not notice and a reviewer might not either.
 *
 * It is a PLAIN SUBSTRING SCAN, comments included, and that is intentional. Stripping
 * comments first would mean parsing, and a parser is a thing that can be wrong; a
 * substring scan cannot be. The cost is that prose mentioning the APIs also fails, which
 * is a cost worth paying — it means a commented-out call cannot sit in the tree waiting to
 * be uncommented, and it caught exactly one thing on its first run: a doc comment in
 * `public-mobile-nav.tsx` promising the component used neither API. Feature files name the
 * rule ("no browser storage") rather than the APIs.
 */

const WEB_ROOT = join(__dirname, "..", "..", "..", "..");

/** Directories this feature owns. Later phases add to this list; they do not replace it. */
const FEATURE_DIRS: readonly string[] = [
  "app/(public)",
  "components/public",
  "components/legal",
  "components/brand",
  "lib/legal",
  "lib/consent",
];

const SOURCE_EXTENSIONS = [".ts", ".tsx"];

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, found);
    } else if (SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
      found.push(full);
    }
  }
  return found;
}

const FEATURE_FILES = FEATURE_DIRS.flatMap((dir) => walk(join(WEB_ROOT, dir)));

describe("the scan actually covers this feature's files", () => {
  it("finds source files in every declared directory", () => {
    // Without this, a renamed directory turns the whole guard into a no-op that passes.
    for (const dir of FEATURE_DIRS) {
      const inDir = FEATURE_FILES.filter((file) => file.startsWith(join(WEB_ROOT, dir)));
      expect(inDir.length, `no source files found under ${dir} — has it moved?`).toBeGreaterThan(0);
    }
  });
});

describe("FR-051: this feature uses no web storage", () => {
  it.each(["localStorage", "sessionStorage"])("no file references %s", (api) => {
    const offenders = FEATURE_FILES.filter((file) =>
      readFileSync(file, "utf8").includes(api),
    ).map((file) => relative(WEB_ROOT, file).replace(/\\/g, "/"));

    expect(
      offenders,
      `${api} is used by this feature (FR-051):\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });
});
