import { expect, test } from "@playwright/test";

import {
  RECORD_AND_LAND_TIMEOUT,
  WEBKIT_SKIP_REASON,
  createOnboardingEmployee,
  installAnchorMocks,
  interceptAnchorApi,
  recordAnchor,
  signInToOnboarding,
} from "./anchor-helpers";

const NAME = "Anchor Employee";

test("employee records an anchor during onboarding and lands on /app with no banner (FR-043)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(120_000); // dev cold compiles + a real 60s recording
  await installAnchorMocks(page);
  await interceptAnchorApi(page);
  const emp = await createOnboardingEmployee();

  await signInToOnboarding(page, emp);
  await page.getByLabel("Full name").fill(NAME);
  await page.getByRole("button", { name: "Continue" }).click();

  // Employee advances in-page to the recorder (no /app redirect yet).
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("button", { name: "Start recording" })).toBeVisible({
    timeout: 30_000,
  });

  await recordAnchor(page);

  // 60s capture → upload (intercepted) → vector written → onComplete → /app, no banner.
  await expect(page).toHaveURL(/\/app$/, { timeout: RECORD_AND_LAND_TIMEOUT });
  await expect(page.getByRole("region", { name: "Calibration" })).toHaveCount(0);
});

test("completing the anchor in one tab refreshes a sibling tab to /app (SC-008)", async ({
  context,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(120_000);
  const emp = await createOnboardingEmployee();

  const tabA = await context.newPage();
  await installAnchorMocks(tabA);
  await interceptAnchorApi(tabA);
  await signInToOnboarding(tabA, emp);

  // Sibling tab opens /onboarding (shared session) while full_name is still
  // null, so it sits on the name step. It only needs to BE on /onboarding when
  // the broadcast fires — the listener refreshes any /onboarding tab, and the
  // proxy then bounces it once full_name is set.
  const tabB = await context.newPage();
  await tabB.goto("/onboarding");
  await expect(tabB.getByLabel("Full name")).toBeVisible();

  // tabA completes the name + anchor → lands on /app and broadcasts.
  await tabA.getByLabel("Full name").fill(NAME);
  await tabA.getByRole("button", { name: "Continue" }).click();
  await expect(tabA.getByRole("button", { name: "Start recording" })).toBeVisible({
    timeout: 30_000,
  });
  await recordAnchor(tabA);
  await expect(tabA).toHaveURL(/\/app$/, { timeout: RECORD_AND_LAND_TIMEOUT });

  // tabB receives the storage event → router.refresh() → proxy bounces it off
  // /onboarding to /app (full_name now set) — no manual reload (SC-008).
  await expect(tabB).toHaveURL(/\/app$/, { timeout: 15_000 });
});
