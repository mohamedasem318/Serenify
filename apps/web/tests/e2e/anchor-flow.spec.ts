import { expect, test } from "@playwright/test";

import {
  DEMO_PASSWORD,
  RECORD_AND_LAND_TIMEOUT,
  WEBKIT_SKIP_REASON,
  createCalibratableEmployee,
  createCalibratedEmployee,
  createManager,
  findDemoEmployee,
  installActiveDetector,
  installAnchorMocks,
  interceptAnchorApi,
  recordAnchor,
  signInToApp,
  signInToOnboarding,
} from "./anchor-helpers";

/**
 * T031 — consolidated 005 capture-flow e2e (re-authors the removed 004 specs:
 * anchor-onboarding, anchor-health-precheck, anchor-skip). Boundary seams only
 * (📌 DECISION-26): getUserMedia + MediaRecorder + detector + /healthz + /anchor are
 * mocked; the REAL orchestration (intro → green room → soft gate → 3·2·1 → 60s →
 * success), the real /healthz gate, the real mode reconciliation, and the real
 * Supabase write all run. WebKit is skipped (it locks navigator.mediaDevices).
 */

test("first-time: intro → green room → record → success → /app, banner gone (US1, FR-001–026)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(150_000); // one real 60s recording + dev cold-compile
  await installAnchorMocks(page);
  await installActiveDetector(page);
  await interceptAnchorApi(page);
  const emp = await createCalibratableEmployee();

  await signInToApp(page, emp);
  await expect(page.getByRole("region", { name: "Calibration" })).toBeVisible();

  await page.goto("/app/calibrate");
  await expect(page.getByRole("heading", { name: "Set your calm baseline" })).toBeVisible({
    timeout: 30_000,
  });
  await recordAnchor(page); // intro → … → success → "Back to home"

  await expect(page).toHaveURL(/\/app$/, { timeout: RECORD_AND_LAND_TIMEOUT });
  await expect(page.getByRole("region", { name: "Calibration" })).toHaveCount(0);
});

test("recalibrate: ?mode=recalibrate with an anchor → 'updated' → /app/account (US6, FR-038/039/053)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(150_000);
  await installAnchorMocks(page);
  await installActiveDetector(page);
  await interceptAnchorApi(page);
  const emp = await createCalibratedEmployee(); // already has a baseline → no banner

  await signInToApp(page, emp);
  await expect(page.getByRole("region", { name: "Calibration" })).toHaveCount(0);

  await page.goto("/app/calibrate?mode=recalibrate");
  // recalibrate copy: the intro heading nudges "set" → "update".
  await expect(page.getByRole("heading", { name: "Update your calm baseline" })).toBeVisible({
    timeout: 30_000,
  });
  await recordAnchor(page); // … → "Your baseline is updated" → "Back to account"

  await expect(page).toHaveURL(/\/app\/account$/, { timeout: RECORD_AND_LAND_TIMEOUT });
});

test("recalibrate hardening: stray ?mode=recalibrate with NO anchor behaves first-time (clarification #3)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(60_000);
  await installAnchorMocks(page);
  await installActiveDetector(page);
  await interceptAnchorApi(page);
  const emp = await createCalibratableEmployee(); // NO anchor

  await signInToApp(page, emp);
  await page.goto("/app/calibrate?mode=recalibrate");
  // reconciled down to first-time: the intro reads "Set …", not "Update …".
  await expect(page.getByRole("heading", { name: "Set your calm baseline" })).toBeVisible({
    timeout: 30_000,
  });
});

test("the /healthz gate sits at 'I'm ready': a down backend blocks the countdown (FR-056)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(60_000);
  await installAnchorMocks(page);
  await installActiveDetector(page);
  await interceptAnchorApi(page, { healthy: false }); // backend down
  const emp = await createCalibratableEmployee();

  await signInToApp(page, emp);
  await page.goto("/app/calibrate");
  await page.getByRole("button", { name: "Turn on camera" }).click();
  const ready = page.getByRole("button", { name: /ready/i });
  await expect(ready).toBeEnabled({ timeout: 30_000 });
  await ready.click();

  // the calm "temporarily unavailable" gate copy shows and the countdown never starts.
  await expect(page.getByText(/quiet moment/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("timer")).toHaveCount(0);
});

test("first-time 'Not now' defers to /app with the banner (FR-007/053)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(60_000);
  await installAnchorMocks(page);
  await installActiveDetector(page);
  await interceptAnchorApi(page);
  const emp = await createCalibratableEmployee();

  await signInToApp(page, emp);
  await page.goto("/app/calibrate");
  await page.getByRole("button", { name: "Turn on camera" }).click();
  await expect(page.getByRole("button", { name: /ready/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Not now" }).click();

  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Calibration" })).toBeVisible();
});

test("recalibrate 'Not now' returns to /app/account, baseline intact, no banner (FR-053)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(60_000);
  await installAnchorMocks(page);
  await installActiveDetector(page);
  await interceptAnchorApi(page);
  const emp = await createCalibratedEmployee();

  await signInToApp(page, emp);
  await page.goto("/app/calibrate?mode=recalibrate");
  await page.getByRole("button", { name: "Turn on camera" }).click();
  await expect(page.getByRole("button", { name: /ready/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Not now" }).click();

  await expect(page).toHaveURL(/\/app\/account$/, { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Calibration" })).toHaveCount(0);
});

for (const role of ["team_lead", "admin"] as const) {
  test(`a ${role} has no anchor flow: /app/calibrate redirects to /app (Principle I, FR-022)`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const mgr = await createManager(role); // NULL full_name → routes through onboarding

    // managers onboard with NO anchor step, then land on /app — no recorder, no banner.
    await signInToOnboarding(page, mgr);
    await page.getByLabel("Full name").fill("Manager Person");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
    await expect(page.getByRole("region", { name: "Calibration" })).toHaveCount(0);

    // the employee-only recalibration route bounces a manager back to /app.
    await page.goto("/app/calibrate");
    await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
  });
}

test("a demo employee with the synthetic anchor lands on /app with no banner (SC-007)", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const demo = await findDemoEmployee();
  test.skip(
    demo === null,
    "no demo employee with a synthetic anchor (cohort absent or seeded before 004); re-run `npm run seed` — N/A this run",
  );

  await page.goto("/login");
  await page.getByLabel("Email").fill(demo!.email);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Calibration" })).toHaveCount(0);
});
