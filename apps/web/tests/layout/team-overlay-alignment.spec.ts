import { expect, test } from "@playwright/test";

import { TEAM_KEYS, TEAM_SILHOUETTES } from "../../lib/landing/team-silhouettes";

/**
 * The team overlay's alignment proof (feature 013, US4 — `contracts/public-surface.md`
 * §9.2, FR-024, FR-053, FR-055, SC-008).
 *
 * REAL BROWSER, REAL LAYOUT, NO DATABASE. Runs under `playwright.layout.config.ts`.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────────────
 *
 * P7 is entirely geometry, and NOTHING in the unit suite can see geometry. jsdom counts
 * DOM nodes and DOM nodes have no layout, so `tests/unit/components/landing/
 * team-section.test.tsx` passes identically against a correct overlay and one that is
 * offset, mirrored, letterboxed, or attached to the wrong person — `preserveAspectRatio`
 * is checked as an ATTRIBUTE STRING there, and four `<path>` nodes are checked to EXIST.
 * Neither is evidence that an outline lands on a human being.
 *
 * This is the same gap that let P6 ship a thread rendering 104 px outside its panel while
 * its layout spec passed 5/5. The measurements that caught it here were taken by hand in
 * a browser and would have been true on the day and unguarded ever after. This file is
 * those measurements, committed.
 *
 * ── WHAT IT STILL CANNOT PROVE ───────────────────────────────────────────────────────
 *
 * WHICH HUMAN IS WHICH NAME. Every assertion below would pass if all four names were
 * rotated by one, because it checks each outline against ITS OWN declared coordinates,
 * and those coordinates are internally consistent whatever the labels say. That residual
 * is ST-7 and is a human check — see the header of `lib/landing/team-silhouettes.ts`.
 */

const WIDTHS = [320, 375, 414, 768] as const;

/** The x-range each outline declares, derived from the module so a re-trace stays honest. */
function declaredXRange(path: string): { min: number; max: number } {
  const nums = (path.match(/-?\d+\.?\d*/g) ?? []).map(Number);
  const xs: number[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) xs.push(nums[i] as number);
  return { min: Math.min(...xs), max: Math.max(...xs) };
}

const DECLARED = TEAM_KEYS.map((key) => ({
  key,
  ...declaredXRange(TEAM_SILHOUETTES[key]),
}));

for (const width of WIDTHS) {
  test.describe(`team overlay at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await page.locator("#team").scrollIntoViewIfNeeded();
      await page.locator("#team img").first().waitFor({ state: "visible" });
      // The overlay maps onto the image's box, so the box must be settled first.
      await expect
        .poll(async () =>
          page.locator("#team img").first().evaluate((el) => (el as HTMLImageElement).complete),
        )
        .toBe(true);
    });

    test("the overlay box is the image box, to the pixel", async ({ page }) => {
      // THE constraint of the phase. `preserveAspectRatio="none"` stretches the 0–100
      // square onto this box, so if the box is not exactly the image's box, every
      // outline is off its person — and the attribute would still read "none".
      const delta = await page.evaluate(() => {
        const img = document.querySelector("#team img") as HTMLElement;
        const svg = document.querySelector('#team svg[viewBox="0 0 100 100"]') as SVGSVGElement;
        const i = img.getBoundingClientRect();
        const s = svg.getBoundingClientRect();
        return {
          left: s.left - i.left,
          top: s.top - i.top,
          right: s.right - i.right,
          bottom: s.bottom - i.bottom,
        };
      });
      for (const [edge, value] of Object.entries(delta)) {
        expect(Math.abs(value), `${edge} edge drifted by ${value}px`).toBeLessThan(0.5);
      }
    });

    test("the image box carries the source's exact aspect ratio", async ({ page }) => {
      // What makes it an exact-aspect box: explicit width/height + `h-auto w-full`. A
      // later `h-64`, an `object-cover`, or a swap to `fill` breaks this and nothing in
      // the unit suite would notice.
      const ratio = await page.evaluate(() => {
        const r = (document.querySelector("#team img") as HTMLElement).getBoundingClientRect();
        return r.width / r.height;
      });
      expect(ratio).toBeCloseTo(1600 / 1164, 2);
    });

    test("preserveAspectRatio is still none", async ({ page }) => {
      const value = await page
        .locator('#team svg[viewBox="0 0 100 100"]')
        .getAttribute("preserveAspectRatio");
      expect(value).toBe("none");
    });

    test("each outline renders exactly where its coordinates say", async ({ page }) => {
      // The assertion the unit suite structurally cannot make. For each person: activate
      // them, then measure the visible outline's bounding box as a percentage of the
      // photo box and compare it against the x-range the path itself declares. An
      // offset, a letterbox, a mirror, or a stray transform all fail here.
      for (const [index, person] of DECLARED.entries()) {
        await page.locator("#team button").nth(index).click();

        // The highlight crossfades over 300ms. Measuring straight after the click reads
        // a mid-transition opacity, so wait for it to settle rather than sleeping.
        await expect
          .poll(
            async () =>
              page.evaluate((i) => {
                const svg = document.querySelector(
                  '#team svg[viewBox="0 0 100 100"]',
                ) as SVGSVGElement;
                const p = svg.querySelectorAll("g")[i]!.querySelectorAll(
                  "path",
                )[1] as SVGPathElement;
                return Number(getComputedStyle(p).opacity);
              }, index),
            { timeout: 5000 },
          )
          .toBeGreaterThan(0.95);

        const measured = await page.evaluate((i) => {
          const img = document.querySelector("#team img") as HTMLElement;
          const svg = document.querySelector('#team svg[viewBox="0 0 100 100"]') as SVGSVGElement;
          const box = img.getBoundingClientRect();
          const group = svg.querySelectorAll("g")[i] as SVGGElement;
          const crisp = group.querySelectorAll("path")[1] as SVGPathElement;
          const r = crisp.getBoundingClientRect();
          const visible = Array.from(svg.querySelectorAll("g")).filter((g) => {
            const p = g.querySelectorAll("path")[1] as SVGPathElement;
            return Number(getComputedStyle(p).opacity) > 0.5;
          }).length;
          return {
            min: ((r.left - box.left) / box.width) * 100,
            max: ((r.right - box.left) / box.width) * 100,
            visible,
          };
        }, index);

        // The stroke is 2.2 CSS px wide and non-scaling, so the painted box overshoots
        // the geometry by ~1.1px either side. At 320px that is ~0.4 of a viewBox unit.
        const tolerance = (1.6 / (width * 0.9)) * 100 + 0.3;
        expect(
          measured.min,
          `${person.key} left edge: rendered ${measured.min.toFixed(2)}% vs declared ${person.min}`,
        ).toBeCloseTo(person.min, 0);
        expect(
          measured.max,
          `${person.key} right edge: rendered ${measured.max.toFixed(2)}% vs declared ${person.max}`,
        ).toBeCloseTo(person.max, 0);
        expect(Math.abs(measured.min - person.min)).toBeLessThan(tolerance);
        expect(Math.abs(measured.max - person.max)).toBeLessThan(tolerance);
        expect(measured.visible, "exactly one outline is highlighted at a time").toBe(1);
      }
    });

    test("nothing overflows the document horizontally", async ({ page }) => {
      const overflow = await page.evaluate(() => {
        const d = document.documentElement;
        return d.scrollWidth - d.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test("every control clears the 44px touch target", async ({ page }) => {
      // FR-055 and Principle VI. The unit suite does not assert this at all, not even by
      // class name, so dropping `min-h-11` or `size-11` is currently invisible to CI.
      const sizes = await page.evaluate(() =>
        Array.from(document.querySelectorAll("#team a[href], #team button")).map((el) => {
          const r = el.getBoundingClientRect();
          return {
            name: el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "?",
            w: r.width,
            h: r.height,
          };
        }),
      );
      expect(sizes).toHaveLength(12);
      for (const s of sizes) {
        expect(s.h, `${s.name} height ${s.h}`).toBeGreaterThanOrEqual(43.5);
        expect(s.w, `${s.name} width ${s.w}`).toBeGreaterThanOrEqual(43.5);
      }
    });

    test("no name label wraps to a second line", async ({ page }) => {
      // T122's own "Done when" claims this and nothing enforced it. Measured with
      // `Range.getClientRects()` rather than by dividing box height by line height,
      // because the button carries `[overflow-wrap:anywhere]` — when it does eventually
      // wrap it breaks mid-word and degrades silently rather than overflowing visibly.
      const lines = await page.evaluate(() =>
        Array.from(document.querySelectorAll("#team button")).map((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const rects = Array.from(range.getClientRects()).filter((r) => r.height > 1);
          const tops = new Set(rects.map((r) => Math.round(r.top)));
          return { name: el.textContent?.trim() ?? "?", lines: tops.size };
        }),
      );
      expect(lines).toHaveLength(4);
      for (const l of lines) {
        expect(l.lines, `"${l.name}" wrapped onto ${l.lines} lines`).toBe(1);
      }
    });
  });
}
