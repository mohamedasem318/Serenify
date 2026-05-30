import { expect, test } from "@playwright/test";

import {
  RECORD_AND_LAND_TIMEOUT,
  WEBKIT_SKIP_REASON,
  createCalibratableEmployee,
  installAnchorMocks,
  interceptAnchorApi,
  recordAnchor,
  signInToApp,
} from "./anchor-helpers";

// SKIP-AND-TRACK (feature 005): the cross-tab BROADCAST (FR-054) is unchanged 004
// code and still works, but this spec DRIVES it through the removed 004 flow
// (recordAnchor → "Start recording" / "Continue to dashboard"). Re-author the
// driving under T031 (e2e consolidation); the banner cross-tab is also re-covered
// by T028.
test.beforeEach(() => {
  test.skip(true, "004 calibration flow replaced by 005; re-author under T031 (e2e consolidation)");
});

/**
 * ST-17 cross-tab anchor sync (FR-034, SC-008).
 *
 * The existing SC-008 test in anchor-onboarding.spec.ts only exercises the
 * /onboarding sibling path, which works through proxy.ts's full_name → /app
 * bounce — it confirms the broadcast wire works but doesn't catch a missing
 * listener on /app or a no-op refresh on /app/calibrate. These three tests
 * cover the surfaces Mohamed actually uses (manual ST-17 reproduction
 * 2026-05-28): a /app/calibrate sibling redirecting on completion, a /app
 * sibling banner hiding on completion, and dismissal propagating between
 * /app tabs.
 *
 * All three rely on Playwright pages within ONE BrowserContext sharing
 * origin + cookies + localStorage — the same way real browser tabs do — so
 * `window "storage"` events fire across pages and `BroadcastChannel`-style
 * propagation is genuinely tested, not mocked.
 */

test("two /app/calibrate tabs: tab A completes → tab B redirects to /app (ST-17)", async ({
  context,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(120_000);
  const emp = await createCalibratableEmployee();

  const tabA = await context.newPage();
  await installAnchorMocks(tabA);
  await interceptAnchorApi(tabA);
  await signInToApp(tabA, emp);
  await tabA.goto("/app/calibrate");
  await expect(tabA.getByRole("button", { name: "Start recording" })).toBeVisible({
    timeout: 30_000,
  });

  const tabB = await context.newPage();
  await installAnchorMocks(tabB);
  await interceptAnchorApi(tabB);
  await tabB.goto("/app/calibrate");
  await expect(tabB.getByRole("button", { name: "Start recording" })).toBeVisible({
    timeout: 30_000,
  });

  // tabA completes → broadcast fires → tabB's listener calls router.refresh()
  // → /app/calibrate server component re-runs has_anchor (now true) →
  // redirect to /app. Without the has_anchor probe added to the calibrate
  // page in the ST-17 fix, refresh would re-render the same recorder and
  // tabB would hang on /app/calibrate.
  await recordAnchor(tabA);
  await expect(tabA).toHaveURL(/\/app$/, { timeout: RECORD_AND_LAND_TIMEOUT });
  await expect(tabB).toHaveURL(/\/app$/, { timeout: 15_000 });
  await expect(tabB.getByRole("region", { name: "Calibration" })).toHaveCount(0);
});

test("tab A on /app/calibrate completes → tab B on /app hides the banner (ST-17)", async ({
  context,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(120_000);
  const emp = await createCalibratableEmployee();

  const tabA = await context.newPage();
  await installAnchorMocks(tabA);
  await interceptAnchorApi(tabA);
  await signInToApp(tabA, emp);
  await expect(tabA.getByRole("region", { name: "Calibration" })).toBeVisible();
  await tabA.goto("/app/calibrate");
  await expect(tabA.getByRole("button", { name: "Start recording" })).toBeVisible({
    timeout: 30_000,
  });

  const tabB = await context.newPage();
  await tabB.goto("/app");
  await expect(tabB.getByRole("region", { name: "Calibration" })).toBeVisible();

  // tabA completes → broadcast → tabB's listener refreshes /app → the Server
  // Component re-runs has_anchor (now true) → the `hasAnchor === false`
  // banner conditional flips off. Before the ST-17 fix, /app wasn't in the
  // listener's refresh-from list at all, so tabB's banner stayed put.
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

  // tabA dismisses → broadcastAnchorBannerDismissed writes the localStorage
  // marker → tabB's cross-tab-auth listener mirrors it into tabB's own
  // sessionStorage AND dispatches a synthetic storage event so the banner's
  // useSyncExternalStore subscriber re-reads. Before the ST-17 fix dismissal
  // only wrote to sessionStorage (per-tab); tabB would still see the banner.
  await tabA.getByRole("button", { name: "Dismiss" }).click();
  await expect(tabA.getByRole("region", { name: "Calibration" })).toHaveCount(0);
  await expect(tabB.getByRole("region", { name: "Calibration" })).toHaveCount(0, {
    timeout: 15_000,
  });

  // And the dismissal survives a refresh in tabB (sessionStorage mirror
  // persists across same-tab reloads — Mohamed's explicit expectation).
  await tabB.reload();
  await expect(tabB).toHaveURL(/\/app$/);
  await expect(tabB.getByRole("region", { name: "Calibration" })).toHaveCount(0);
});
