import { expect, test } from "@playwright/test";

import {
  DEMO_PASSWORD,
  RECORD_AND_LAND_TIMEOUT,
  WEBKIT_SKIP_REASON,
  createManager,
  createOnboardingEmployee,
  findDemoEmployee,
  installAnchorMocks,
  interceptAnchorApi,
  recordAnchor,
  signInToOnboarding,
} from "./anchor-helpers";

const NAME = "Anchor Employee";

test("employee skips during onboarding, then calibrates from the banner (FR-004/021/022)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(120_000); // includes one real 60s recording on /app/calibrate
  await installAnchorMocks(page);
  await interceptAnchorApi(page);
  const emp = await createOnboardingEmployee();

  await signInToOnboarding(page, emp);
  await page.getByLabel("Full name").fill(NAME);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: "Start recording" })).toBeVisible({
    timeout: 30_000,
  });

  // "Skip for now" is revealed once the explanation sentinel scrolls into view
  // (FR-004), then lands on /app WITH the calibration banner.
  const skip = page.getByRole("button", { name: "Skip for now" });
  await expect(skip).toBeVisible({ timeout: 10_000 });
  await skip.click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Calibration" })).toBeVisible();

  // Recalibrate from the banner → /app/calibrate → record → /app, banner gone.
  await page.getByRole("link", { name: "Take a minute to calibrate" }).click();
  await expect(page).toHaveURL(/\/app\/calibrate$/, { timeout: 30_000 });
  await recordAnchor(page);
  await expect(page).toHaveURL(/\/app$/, { timeout: RECORD_AND_LAND_TIMEOUT });
  await expect(page.getByRole("region", { name: "Calibration" })).toHaveCount(0);
});

for (const role of ["team_lead", "admin"] as const) {
  test(`a ${role} onboards with no anchor step and no banner; /app/calibrate redirects (FR-029, SC-007)`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const mgr = await createManager(role);

    await signInToOnboarding(page, mgr);
    await page.getByLabel("Full name").fill("Manager Person");
    await page.getByRole("button", { name: "Continue" }).click();

    // Managers are server-redirected straight to /app — no recorder, no banner.
    await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Start recording" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Calibration" })).toHaveCount(0);

    // The employee-only recalibration route bounces managers back to /app.
    await page.goto("/app/calibrate");
    await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
  });
}

test("a demo employee lands on /app with no calibration banner (SC-007, FR-031)", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const demo = await findDemoEmployee();
  test.skip(
    demo === null,
    "no demo employee with a synthetic anchor (cohort absent or seeded before 004); re-run `npm run seed` — check is N/A this run",
  );

  await page.goto("/login");
  await page.getByLabel("Email").fill(demo!.email);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Demo users carry full_name, so the proxy routes straight to /app. The
  // synthetic anchor means has_anchor is true → no banner.
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Calibration" })).toHaveCount(0);
});
