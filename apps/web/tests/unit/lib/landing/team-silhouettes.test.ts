import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { TEAM_KEYS, TEAM_SILHOUETTES } from "@/lib/landing/team-silhouettes";

/**
 * T119 — the silhouette paths, frozen (`contracts/public-surface.md` §9.2, R4).
 *
 * FR-026 says the overlay coordinates are already derived and verified and MUST be
 * reused verbatim. This file is what makes that enforceable rather than aspirational:
 * each path's exact character length AND its SHA-256 are asserted against constants, so
 * ANY edit fails CI — including the ones that look harmless. A prettier pass that
 * re-wraps the literal, a whitespace normalisation that collapses `L 1.84 99.91` to
 * `L1.84 99.91`, a "precision trim" that rewrites `39.0` as `39` — each of those is a
 * silent geometry change, and each of them moves the hash.
 *
 * ── WHAT THIS FILE DOES NOT PROVE ────────────────────────────────────────────────────
 *
 * Nothing about whether an outline lands on the right person. These are strings in a
 * unit test; jsdom has no layout and no photograph. A completely misaligned, mirrored,
 * or wrongly-attributed overlay passes every assertion below.
 *
 * Alignment is verified by eye against the rendered page. IDENTITY — which human being
 * is which name — is smoke test **ST-7** and cannot be automated at all; see the header
 * of `lib/landing/team-silhouettes.ts`.
 */

/**
 * Frozen at T118 from `docs/mockups/serenify-landing-mock.html` (~line 671).
 *
 * These are not "the current values written down". They are the mock's values, and the
 * mock is the authority. If a change makes this table fail, the change is wrong — the
 * table is not to be re-baselined to make CI green. Re-deriving the paths by any means
 * is forbidden (FR-026), and re-baselining is re-deriving with extra steps.
 */
const FROZEN = {
  mohamed: {
    length: 1390,
    sha256: "3bcee6921d20535c103b5702482ad579a124166ea4729b78ff499e9614603fda",
  },
  fatma: {
    length: 1142,
    sha256: "5442c57dc844bee4383fdabcc72b47eb7973e4810348b548d203e25bf88c706e",
  },
  hebatullah: {
    length: 822,
    sha256: "c2e0f614c04cddf72a948d0c719b26c76091add783f40fe29cf990ff925d3128",
  },
  gehad: {
    length: 625,
    sha256: "6ff965dff5658b83711488523e0a5e00acae246899e2f4f3635313e8f71cb581",
  },
} as const;

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Every coordinate pair in a path, as `[x, y]`. The paths are pure `M`/`L`/`Z`. */
function points(path: string): [number, number][] {
  const nums = (path.match(/-?\d+\.?\d*/g) ?? []).map(Number);
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pairs.push([nums[i] as number, nums[i + 1] as number]);
  }
  return pairs;
}

function xRange(path: string): { min: number; max: number } {
  const xs = points(path).map(([x]) => x);
  return { min: Math.min(...xs), max: Math.max(...xs) };
}

describe("T119: the four silhouette paths are frozen character-for-character", () => {
  it.each(TEAM_KEYS)("%s has the exact frozen character length", (key) => {
    expect(
      TEAM_SILHOUETTES[key].length,
      `${key}'s path length changed. FR-026 forbids re-deriving, re-tracing, ` +
        "reformatting or regenerating these paths — restore the mock's string rather " +
        "than re-baselining this constant.",
    ).toBe(FROZEN[key].length);
  });

  it.each(TEAM_KEYS)("%s has the exact frozen SHA-256", (key) => {
    expect(
      sha256(TEAM_SILHOUETTES[key]),
      `${key}'s path content changed. Even a whitespace-only reformat moves this hash, ` +
        "which is the point: the coordinates are normalised to the 1600×1164 crop and " +
        "any edit shifts the outline off its person.",
    ).toBe(FROZEN[key].sha256);
  });

  it("freezes exactly four paths, and no fifth key has crept in", () => {
    expect(Object.keys(TEAM_SILHOUETTES).sort()).toEqual([...TEAM_KEYS].sort());
    expect(TEAM_KEYS).toHaveLength(4);
  });
});

describe("T119: the mapping is not reversed and no two keys are swapped", () => {
  it("orders the keys left-to-right exactly as FR-024 requires", () => {
    // The declaration order is what the cards render in. A reordering here would
    // reorder the page, so it is asserted rather than assumed.
    expect(TEAM_KEYS).toEqual(["mohamed", "fatma", "hebatullah", "gehad"]);
  });

  it("has strictly ascending x-ranges in that same order", () => {
    // The guard against a key swap. `hebatullah` is the INNER right outline and `gehad`
    // the OUTER right one; swapping the two keys would leave every hash above green
    // while pointing each name at the wrong body, and this is what catches it.
    const ranges = TEAM_KEYS.map((key) => ({ key, ...xRange(TEAM_SILHOUETTES[key]) }));

    for (let i = 1; i < ranges.length; i++) {
      const prev = ranges[i - 1]!;
      const curr = ranges[i]!;
      expect(
        curr.min,
        `${curr.key} starts at x=${curr.min}, which is not to the right of ` +
          `${prev.key}'s start at x=${prev.min} — the keys look swapped.`,
      ).toBeGreaterThan(prev.min);
      expect(
        curr.max,
        `${curr.key} ends at x=${curr.max}, which is not to the right of ` +
          `${prev.key}'s end at x=${prev.max} — the keys look swapped.`,
      ).toBeGreaterThan(prev.max);
    }
  });

  it("pins each x-range to the values recorded in the module header", () => {
    // The header documents these four ranges as the evidence that the mapping is not
    // reversed. Asserting them keeps the prose and the data from drifting apart.
    const EXPECTED: Record<string, [number, number]> = {
      mohamed: [0.34, 21.84],
      fatma: [22.16, 40.59],
      hebatullah: [64.91, 81.47],
      gehad: [79.47, 97.78],
    };
    for (const key of TEAM_KEYS) {
      const { min, max } = xRange(TEAM_SILHOUETTES[key]);
      expect([min, max], `${key}'s x-range`).toEqual(EXPECTED[key]);
    }
  });

  it("leaves the poster's gap between the left pair and the right pair", () => {
    // fatma ends at 40.59 and hebatullah starts at 64.91; the ~24-unit gap is the
    // project poster standing between the two pairs. If a future edit closed that gap,
    // something has been re-traced.
    expect(xRange(TEAM_SILHOUETTES.hebatullah).min).toBeGreaterThan(
      xRange(TEAM_SILHOUETTES.fatma).max + 20,
    );
  });
});

describe("T119: the paths are the shape the overlay assumes", () => {
  it("keeps every coordinate inside the 0–100 viewBox", () => {
    // The overlay is `viewBox="0 0 100 100"` with `preserveAspectRatio="none"`. A
    // coordinate outside that range would render outside the photo.
    for (const key of TEAM_KEYS) {
      for (const [x, y] of points(TEAM_SILHOUETTES[key])) {
        expect(x, `${key} x`).toBeGreaterThanOrEqual(0);
        expect(x, `${key} x`).toBeLessThanOrEqual(100);
        expect(y, `${key} y`).toBeGreaterThanOrEqual(0);
        expect(y, `${key} y`).toBeLessThanOrEqual(100);
      }
    }
  });

  it("uses only M/L/Z commands, so the two-subpath outlines need fill-rule=evenodd", () => {
    for (const key of TEAM_KEYS) {
      expect(TEAM_SILHOUETTES[key].replace(/[-\d.\s]/g, ""), `${key} commands`).toMatch(
        /^[MLZ]+$/,
      );
      expect(TEAM_SILHOUETTES[key].trimEnd().endsWith("Z"), `${key} closes`).toBe(true);
    }
  });
});
