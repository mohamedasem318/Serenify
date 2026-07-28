import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * T099 (feature 013, US1) — the lint-style unit check
 * `contracts/landing-hero-story.md` §9.1 requires.
 *
 * WHY THIS IS A TEST AND NOT A CODE REVIEW NOTE. framer-motion's `useReducedMotion`
 * SNAPSHOTS AT MOUNT and does not re-subscribe to the media query. Importing it here
 * would be invisible in CI — every unit test passes, every layout assertion passes, the
 * story renders correctly for anyone whose OS setting never changes. It fails only for a
 * visitor who turns reduced motion ON while the page is open, which is exactly what ST-5
 * does BY HAND ON A REAL DEVICE, long after CI went green. A defect that only a manual
 * smoke pass can catch is a defect worth a static assertion.
 *
 * The repo's `useMediaQuery` is built on `useSyncExternalStore` and re-subscribes, so the
 * toggle takes effect immediately. `components/monitor/bloom.tsx:5` already models the
 * correct choice — this asserts the landing page keeps making it.
 *
 * Source inspection rather than an import graph, deliberately: the failure guarded
 * against is one line added to one component months from now, which an import graph
 * resolved at test time would only notice if that module were also imported here.
 */

const WEB_ROOT = join(__dirname, "..", "..", "..", "..");
const LANDING_DIR = join(WEB_ROOT, "components", "landing");

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, found);
    else if (/\.tsx?$/.test(entry)) found.push(full);
  }
  return found;
}

const FILES = sourceFiles(LANDING_DIR);
const rel = (file: string) => relative(WEB_ROOT, file).replace(/\\/g, "/");

describe("the scan reaches the landing components", () => {
  it("finds source files, so a passing suite is not an empty sweep", () => {
    expect(FILES.length).toBeGreaterThan(5);
  });
});

describe("FR-013 / SC-010: reduced motion comes from the repo hook, not framer-motion", () => {
  it("no landing component imports useReducedMotion from framer-motion", () => {
    const offenders = FILES.filter((file) => {
      const source = readFileSync(file, "utf8");
      // Both orderings of a multi-specifier import, and the namespace form.
      return (
        /useReducedMotion/.test(source) &&
        /from\s+["']framer-motion["']/.test(source)
      );
    }).map(rel);

    expect(
      offenders,
      `framer-motion's useReducedMotion snapshots at mount and would miss a mid-session ` +
        `OS toggle (ST-5). Use useMediaQuery from @/hooks/use-media-query:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("the story clock imports useMediaQuery from the repo hook", () => {
    const clock = readFileSync(join(LANDING_DIR, "use-story-clock.ts"), "utf8");
    expect(clock).toMatch(/import\s*\{[^}]*useMediaQuery[^}]*\}\s*from\s*["']@\/hooks\/use-media-query["']/);
    expect(clock).toMatch(/useMediaQuery\(\s*["']\(prefers-reduced-motion: reduce\)["']\s*\)/);
  });

  it("exactly one landing module reads the reduced-motion query, so the answer cannot diverge", () => {
    const readers = FILES.filter((file) =>
      /prefers-reduced-motion/.test(readFileSync(file, "utf8")),
    ).map(rel);
    expect(readers).toEqual(["components/landing/use-story-clock.ts"]);
  });
});
