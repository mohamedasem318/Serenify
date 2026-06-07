import { expect, test } from "@playwright/test";

import {
  RECORD_AND_LAND_TIMEOUT,
  WEBKIT_SKIP_REASON,
  createCalibratableEmployee,
  installActiveDetector,
  installAnchorMocks,
  interceptAnchorApi,
  recordAnchor,
  signInToApp,
} from "./anchor-helpers";

/**
 * ST-17 cross-tab anchor sync (FR-054, SC-008) — re-authored for the 005 flow under
 * T031. The cross-tab BROADCAST is unchanged 004 code; these tests drive it through
 * the new capture flow (intro → green room → 3·2·1 → 60s → success). All pages live
 * in ONE BrowserContext (shared origin + cookies + storage, like real tabs), so the
 * `storage` events + BroadcastChannel propagation are genuinely tested, not mocked.
 */

test("two /app/calibrate tabs: tab A completes → tab B redirects to /app (ST-17)", async ({
  context,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(150_000);
  const emp = await createCalibratableEmployee();

  const tabA = await context.newPage();
  await installAnchorMocks(tabA);
  await installActiveDetector(tabA);
  await interceptAnchorApi(tabA);
  await signInToApp(tabA, emp);
  await tabA.goto("/app/calibrate");
  await expect(tabA.getByRole("heading", { name: "Set your calm baseline" })).toBeVisible({
    timeout: 30_000,
  });

  const tabB = await context.newPage();
  await installAnchorMocks(tabB);
  await installActiveDetector(tabB);
  await interceptAnchorApi(tabB);
  await tabB.goto("/app/calibrate");
  await expect(tabB.getByRole("heading", { name: "Set your calm baseline" })).toBeVisible({
    timeout: 30_000,
  });

  // tabA completes → broadcastAnchorCaptured → tabB's listener calls router.refresh()
  // → /app/calibrate server component re-runs has_anchor (now true) → redirect to /app.
  await recordAnchor(tabA); // navigates tabA to /app via "Back to home"
  await expect(tabA).toHaveURL(/\/app$/, { timeout: RECORD_AND_LAND_TIMEOUT });
  await expect(tabB).toHaveURL(/\/app$/, { timeout: 15_000 });
  await expect(tabB.getByRole("region", { name: "Calibration" })).toHaveCount(0);
});

test("tab A on /app/calibrate completes → tab B on /app hides the banner (ST-17)", async ({
  context,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(150_000);
  const emp = await createCalibratableEmployee();

  const tabA = await context.newPage();
  await installAnchorMocks(tabA);
  await installActiveDetector(tabA);
  await interceptAnchorApi(tabA);
  await signInToApp(tabA, emp);
  await expect(tabA.getByRole("region", { name: "Calibration" })).toBeVisible();
  await tabA.goto("/app/calibrate");
  await expect(tabA.getByRole("heading", { name: "Set your calm baseline" })).toBeVisible({
    timeout: 30_000,
  });

  const tabB = await context.newPage();
  await tabB.goto("/app");
  await expect(tabB.getByRole("region", { name: "Calibration" })).toBeVisible();

  // tabA completes → broadcast → tabB's listener refreshes /app → has_anchor now true
  // → the `hasAnchor === false` banner conditional flips off.
  await recordAnchor(tabA);
  await expect(tabA).toHaveURL(/\/app$/, { timeout: RECORD_AND_LAND_TIMEOUT });
  await expect(tabB.getByRole("region", { name: "Calibration" })).toHaveCount(0, {
    timeout: 15_000,
  });
});

test("dismissing the banner in tab A hides it in tab B (ST-17 dismissal sync)", async ({
  context,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(60_000);
  const emp = await createCalibratableEmployee();

  const tabA = await context.newPage();
  await signInToApp(tabA, emp);
  await expect(tabA.getByRole("region", { name: "Calibration" })).toBeVisible();

  const tabB = await context.newPage();
  await tabB.goto("/app");
  await expect(tabB.getByRole("region", { name: "Calibration" })).toBeVisible();

  // tabA dismisses → broadcastAnchorBannerDismissed writes the localStorage marker →
  // tabB's cross-tab-auth listener mirrors it into tabB's sessionStorage + dispatches
  // a synthetic storage event so the banner's useSyncExternalStore subscriber re-reads.
  await tabA.getByRole("button", { name: "Dismiss" }).click();
  await expect(tabA.getByRole("region", { name: "Calibration" })).toHaveCount(0);
  await expect(tabB.getByRole("region", { name: "Calibration" })).toHaveCount(0, {
    timeout: 15_000,
  });

  // the dismissal survives a refresh in tabB (sessionStorage mirror persists).
  await tabB.reload();
  await expect(tabB).toHaveURL(/\/app$/);
  await expect(tabB.getByRole("region", { name: "Calibration" })).toHaveCount(0);
});
