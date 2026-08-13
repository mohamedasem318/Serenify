import { expect, test } from "@playwright/test";

import {
  createCalibratableEmployee,
  createCalibratedEmployee,
  signInToApp,
} from "./anchor-helpers";

/**
 * The recalibration prompt (#256) on the real authenticated dashboard.
 *
 * WHY THIS FILE EXISTS. #256 shipped the prompt on 2026-08-10 with NO e2e coverage at
 * all. Four days later it was still uncovered, and in that time it had silently broken
 * eight unrelated chromium specs: the modal opens on every `/app` load for an anchored
 * employee, and Radix's overlay makes the dashboard behind it non-actionable, so specs
 * that never mention the prompt failed on timeouts against elements that were present
 * and merely unreachable. Nothing caught it because nothing looked. This file looks.
 *
 * IT DELIBERATELY DOES NOT USE THE SUPPRESSION SEAM. Every other spec now signs in via
 * `signInToApp`, which pre-sets the prompt's capture latch; these pass
 * `{ showRecalibrationPrompt: true }` so the modal renders exactly as a user meets it.
 *
 * WHAT IS HERE AND NOT IN THE UNIT TESTS. `recalibration-prompt.test.tsx` covers copy,
 * colour, persistence and the dismissal contract against a rendered component. Three
 * things it structurally cannot do, all covered below:
 *   • the PAGE-LEVEL condition — `hasAnchor === true` from a real RPC against a real
 *     row, and the mutual exclusivity with the calibration banner that lets both share
 *     one dismissal key;
 *   • outside-press and focus placement, which the unit tests pin by grepping the
 *     component's source because happy-dom models neither Radix's focus scope nor
 *     pointer-outside faithfully — here they are asserted as behaviour;
 *   • that the deep link lands on the baseline SECTION, not the top of Account.
 */

const PROMPT_TITLE = "Time for a fresh calibration";

test("an anchored employee is prompted on /app, and it blocks the dashboard behind it", async ({
  page,
}) => {
  const emp = await createCalibratedEmployee("Prompt Tester");
  await signInToApp(page, emp, { showRecalibrationPrompt: true });

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: PROMPT_TITLE })).toBeVisible();

  // The blocking is the point, not an accident: this is precisely what took out eight
  // specs, so it is pinned rather than left as folklore. If a future change makes the
  // prompt non-blocking, this failing is the correct way to find out — and the seam in
  // anchor-helpers.ts can then be deleted.
  //
  // The two locators are doing different jobs. `getByText` is DOM-based, so it proves
  // the greeting is rendered and present. `getByRole` matches the ACCESSIBILITY tree,
  // which excludes anything under Radix's `aria-hidden` — so it finding nothing is the
  // assertion that the dashboard is sealed off behind the overlay. Together they say
  // "there, but unreachable", which is exactly how the eight specs failed.
  // Scoped to the `h1` on purpose: a bare text match also catches Next's route announcer
  // (`#__next-route-announcer__`), which mirrors the heading text into a live region.
  await expect(page.locator("h1").filter({ hasText: /^Good/ })).toBeAttached();
  await expect(page.getByRole("heading", { name: /^Good/ })).toHaveCount(0);
});

test("an employee with NO anchor gets the calibration banner and never this prompt", async ({
  page,
}) => {
  // The exclusivity that makes one shared dismissal key safe (DECISIONS.md 2026-08-10,
  // point 2). Asserted end-to-end because it is enforced by two sibling conditions in
  // app/(authed)/app/page.tsx — `hasAnchor === false` and `hasAnchor === true` — which
  // no unit test of either component can see.
  const emp = await createCalibratableEmployee("Uncalibrated Tester");
  await signInToApp(page, emp, { showRecalibrationPrompt: true });

  await expect(page.getByRole("region", { name: "Calibration" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("focus opens on the dialog itself, never on the dismiss control", async ({ page }) => {
  const emp = await createCalibratedEmployee("Focus Tester");
  await signInToApp(page, emp, { showRecalibrationPrompt: true });

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Radix's default lands on the first tabbable child, which measured as "Not now" — an
  // unrequested modal drawing a focus ring around its DISMISS action reads as "this is
  // the answer we expect". The component prevents that; only a real browser can confirm
  // it worked, which is why the unit test greps the source instead.
  await expect(dialog).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Not now" })).not.toBeFocused();
});

test("outside-press does NOT dismiss — a stray tap must not spend the showing", async ({
  page,
}) => {
  const emp = await createCalibratedEmployee("Backdrop Tester");
  await signInToApp(page, emp, { showRecalibrationPrompt: true });

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Top-left corner: outside the centred panel on every viewport this runs at. Dismissal
  // persists for the whole auth session, so an accidental backdrop touch would silently
  // consume the user's one showing without them having read it.
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();
});

test("Escape dismisses it, frees the dashboard, and it stays gone across a reload", async ({
  page,
}) => {
  const emp = await createCalibratedEmployee("Escape Tester");
  await signInToApp(page, emp, { showRecalibrationPrompt: true });

  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Advice, not a gate: the dashboard is fully usable the moment it closes.
  await expect(page.getByRole("heading", { name: /^Good/ })).toBeVisible();

  // Remembered for the auth SESSION — a reload must not re-prompt, or it reads as a bug.
  await page.reload();
  await expect(page.getByRole("heading", { name: /^Good/ })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test('"Not now" dismisses without retiring the prompt permanently', async ({ page }) => {
  const emp = await createCalibratedEmployee("Not Now Tester");
  await signInToApp(page, emp, { showRecalibrationPrompt: true });

  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // "Not now" means not now, not never. Only an actual capture writes the permanent
  // latch; if dismissing ever set it, the user would never be asked again and the
  // stale-anchor scoring error this exists to surface would go quiet.
  const latched = await page.evaluate(() =>
    localStorage.getItem("serenify-recalibration-prompt-done"),
  );
  expect(latched).toBeNull();
});

test("the CTA lands on the baseline section of Account, scrolled to it", async ({ page }) => {
  const emp = await createCalibratedEmployee("Deep Link Tester");
  await signInToApp(page, emp, { showRecalibrationPrompt: true });

  await page.getByRole("link", { name: "Open baseline settings" }).click();
  await expect(page).toHaveURL(/\/app\/account#account-baseline-heading$/);

  // The fragment is the whole point — landing at the top of Account leaves the user
  // hunting for the control the prompt just told them to use.
  const heading = page.getByRole("heading", { name: "Your calm baseline" });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveAttribute("id", "account-baseline-heading");
});
