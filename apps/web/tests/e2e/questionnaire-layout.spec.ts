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

      // Into the stepper — Back/Done remain ≥44px and nothing overflows.
      await card.getByRole("button", { name: /Could be better/ }).click();
      await card.getByRole("button", { name: /Unclear instructions/i }).click();
      await assertNoHorizontalScroll(page);
      await assertTargets(page, [/^Back/, /^Done/]);
    });
  }
}
