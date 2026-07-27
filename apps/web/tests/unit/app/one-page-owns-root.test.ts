import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * T086's "only one page resolves to `/`", implemented as a standing guard rather than a
 * one-time check (feature 013, P6).
 *
 * WHY THIS EXISTS AS A TEST. P6 moved the root route into the `(public)` group, and the
 * obvious wrong way to do that is a COPY rather than a MOVE. The task text said both files
 * existing would be "a build-breaking route conflict"; it is not, in Next 16.2.11. Both
 * `app/page.tsx` and `app/(public)/page.tsx` resolve to `/`, and with both present
 * `next build` exits 0 with a single `/` in its route table and serves the UNGROUPED file
 * — measured, not assumed (see `docs/DECISIONS.md`).
 *
 * That failure mode is worse than an error: `tsc` is green, the build is green, every unit
 * test is green, and the landing page silently never renders, outside the public shell,
 * with no navbar and no footer. Nothing else in the suite would notice. The check is one
 * line of intent and it belongs where CI can see it.
 *
 * DELIBERATELY NARROW. This asserts one thing about one URL. It is not a route-table test
 * and must not grow into one — a general "every route resolves uniquely" assertion would
 * re-derive Next's own routing semantics in a place nobody would maintain, and would fail
 * for reasons that have nothing to do with this feature.
 */

const APP_DIR = join(__dirname, "..", "..", "..", "app");

/** Every `page`/`route` file under app/, as a POSIX-ish path relative to app/. */
function routeFiles(dir: string, prefix = "", found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      routeFiles(full, `${prefix}${entry}/`, found);
    } else if (/^(page|route)\.(tsx?|jsx?)$/.test(entry)) {
      found.push(`${prefix}${entry}`);
    }
  }
  return found;
}

/**
 * The URL a route file resolves to.
 *
 * Route groups are stripped because a parenthesised folder "should not be included in the
 * route's URL path" — `next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`.
 * Private `_folders` are not routable at all.
 */
function urlOf(routeFile: string): string {
  const segments = routeFile
    .replace(/(page|route)\.[tj]sx?$/, "")
    .split("/")
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")))
    .filter((segment) => !segment.startsWith("_"));
  return `/${segments.join("/")}`;
}

const ROUTE_FILES = routeFiles(APP_DIR);

describe("exactly one page owns `/`", () => {
  it("finds route files at all, so a pass is not an empty sweep", () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(5);
  });

  it("resolves `/` to exactly one file, and it is the public landing page", () => {
    const owners = ROUTE_FILES.filter((file) => urlOf(file) === "/");

    expect(
      owners,
      `expected exactly one page at "/", found ${owners.length}: ${owners.join(", ")}. ` +
        `Next 16 does NOT error on this — it silently prefers the ungrouped file, so the ` +
        `landing page would stop rendering with every other check still green.`,
    ).toEqual(["(public)/page.tsx"]);
  });

  it("has no ungrouped app/page.tsx — the takeover was a move, not a copy", () => {
    // Stated separately from the assertion above so the failure message says which of the
    // two mistakes was made.
    expect(ROUTE_FILES).not.toContain("page.tsx");
  });
});
