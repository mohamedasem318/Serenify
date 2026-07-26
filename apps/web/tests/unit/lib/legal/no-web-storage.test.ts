import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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

/**
 * T059 (P4) — THE ONLY PHASE THAT EDITS THIS FILE.
 *
 * Every directory this feature creates is enumerated here in one change, including the
 * ones that do not exist yet, so that P4, P5 and P6 cannot collide on one small test
 * file. P5 (T073) and P6 (T109) VERIFY this list and promote their own paths; they add
 * nothing else.
 *
 * The list is split rather than flat, because "a path entry matching nothing is inert"
 * would have been a bad guarantee to build on: the coverage assertion below deliberately
 * FAILS on a declared-but-empty directory, so that a renamed or mistyped path cannot
 * silently turn the whole guard into a no-op that passes. Both properties are wanted, so
 * both are stated separately.
 */

/** Directories that exist NOW and must contain source. A miss here is a broken guard. */
const FEATURE_DIRS: readonly string[] = [
  "app/(public)",
  "components/public",
  "components/legal",
  "components/brand",
  "components/consent",
  "lib/legal",
  "lib/consent",
];

/**
 * Directories a LATER phase creates. P6 creates both of these with the landing page.
 *
 * They are asserted ABSENT, not scanned — and that assertion is the point. The moment
 * P6 creates one, this test fails and names it, so promoting the path into FEATURE_DIRS
 * becomes a mechanical CI-enforced step rather than a remembered one. It is the same
 * mechanism as the wordmark sync test and the registry's append-only snapshot: the guard
 * that protects a future change is the one that fails when the future arrives.
 */
const RESERVED_FOR_LATER_PHASES: readonly string[] = ["components/landing", "lib/landing"];

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

  it("the reserved paths do not exist yet — promote them the moment they do", () => {
    // The reciprocal of the assertion above, and the reason the split is safe. When P6
    // creates components/landing/ or lib/landing/, this fails by name and the fix is
    // one line: move that entry into FEATURE_DIRS. Nobody has to remember.
    for (const dir of RESERVED_FOR_LATER_PHASES) {
      expect(
        existsSync(join(WEB_ROOT, dir)),
        `${dir} now exists — move it from RESERVED_FOR_LATER_PHASES into FEATURE_DIRS ` +
          `so FR-051 actually covers it (T073 for P5, T109 for P6).`,
      ).toBe(false);
    }
  });

  it("declares every directory this feature creates, in one place", () => {
    // The enumeration T059 fixes. Stated as a set comparison so an accidental deletion
    // from either list fails here rather than silently narrowing the guard's reach.
    expect([...FEATURE_DIRS, ...RESERVED_FOR_LATER_PHASES].sort()).toEqual(
      [
        "app/(public)",
        "components/brand",
        "components/consent",
        "components/landing",
        "components/legal",
        "components/public",
        "lib/consent",
        "lib/landing",
        "lib/legal",
      ].sort(),
    );
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
