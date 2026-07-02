import { expect, test, type Page } from "@playwright/test";

import { createCalibratedEmployee, signInToApp } from "./anchor-helpers";

/**
 * T059 — Feature 012 questionnaire layout gate (Principle VII).
 *
 * Renders the weekly check-in (the always-reachable coordinator surface on a fresh ISO week)
 * at 360px and desktop, in light and dark themes, and asserts: no horizontal overflow, every
 * interactive target ≥44px, and the stepper controls remain usable. Lives under tests/e2e (not
 * tests/layout) and runs through the DEFAULT e2e config (`npm run test:e2e`, chromium project)
 * because it needs `createCalibratedEmployee`/`signInToApp` — the service-role seeding and
 * globalSetup that only `playwright.config.ts` wires up; the layout-only config has neither.
 */

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
  }, theme);
}

async function assertNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow, "no horizontal overflow").toBe(false);
}

async function assertTargets(page: Page, names: RegExp[]) {
  for (const name of names) {
    const el = page.getByRole("button", { name }).first();
    const box = await el.boundingBox();
    expect(box, `target ${name} has a box`).not.toBeNull();
    expect(box!.height, `target ${name} ≥44px`).toBeGreaterThanOrEqual(44);
  }
}

// The Skip chip's clickable box is intentionally taller than its visible glyph (a hit-slop
// expansion to reach the 44px target without inflating the visible corner chip — see
// session-end-feedback-card.tsx / weekly-check-in-card.tsx). That box must still never
// geometrically overlap the heading's own box; only the vertical dimension is expanded, so a
// 2D rectangle intersection would only trip if the horizontal gap regressed too.
async function assertSkipDoesNotOverlapHeading(page: Page) {
  const skip = page.getByRole("button", { name: /Skip/ }).first();
  const heading = page.getByRole("heading", { level: 2 }).first();
  const skipBox = await skip.boundingBox();
  const headingBox = await heading.boundingBox();
  expect(skipBox, "Skip has a box").not.toBeNull();
  expect(headingBox, "heading has a box").not.toBeNull();
  const overlaps =
    skipBox!.x < headingBox!.x + headingBox!.width &&
    skipBox!.x + skipBox!.width > headingBox!.x &&
    skipBox!.y < headingBox!.y + headingBox!.height &&
    skipBox!.y + skipBox!.height > headingBox!.y;
  expect(overlaps, "Skip's clickable box does not overlap the heading's box").toBe(false);
}

for (const viewport of [
  { label: "360px", width: 360, height: 740 },
  { label: "desktop", width: 1280, height: 900 },
]) {
  for (const theme of ["light", "dark"] as const) {
    test(`weekly card layout @ ${viewport.label} · ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const emp = await createCalibratedEmployee(`Layout ${viewport.label} ${theme}`);
      await signInToApp(page, emp);
      await setTheme(page, theme);

      const card = page.getByTestId("weekly-check-in");
      await expect(card).toBeVisible();
      await assertNoHorizontalScroll(page);
      await assertTargets(page, [/^Good/, /Could be better/, /Skip/]);
      await assertSkipDoesNotOverlapHeading(page);

      // Into the stepper — Back/Done remain ≥44px and nothing overflows.
      await card.getByRole("button", { name: /Could be better/ }).click();
      await card.getByRole("button", { name: /Unclear instructions/i }).click();
      await assertNoHorizontalScroll(page);
      await assertTargets(page, [/^Back/, /^Done/]);
    });
  }
}
