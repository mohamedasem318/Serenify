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
import { signOut } from "./helpers";

const NAME = "Anchor Employee";

test("Skip stays hidden on a fresh, healthy recorder mount (FR-004 regression)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(60_000);
  await installAnchorMocks(page);
  await interceptAnchorApi(page); // healthy: true — recorder enters idle, not the down branch
  const emp = await createOnboardingEmployee();

  await signInToOnboarding(page, emp);
  await page.getByLabel("Full name").fill(NAME);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: "Start recording" })).toBeVisible({
    timeout: 30_000,
  });

  // FR-004: Skip is hidden on entry — only revealed by scroll-past, first
  // extraction failure, or a permission deny (FR-007) / health down (FR-048).
  // The IntersectionObserver delivers a synchronous initial entry on observe(),
  // which would fire isIntersecting:true whenever the sentinel sits in the
  // viewport on mount (any normal layout). That entry must be discarded — this
  // assertion regresses the ST-10 bug where Skip flashed in within ~1s.
  await page.waitForTimeout(500);
  await expect(page.getByRole("button", { name: "Skip for now" })).toHaveCount(0);
});

test("Skip via health-down branch → /app banner → calibrate from banner (FR-021/022/048)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(120_000); // includes one real 60s recording on /app/calibrate
  await installAnchorMocks(page);
  // Phase 1: /healthz down — recorder surfaces "temporarily unavailable" + a
  // permanent Skip button (FR-048, anchor-recorder.tsx). Replaces the previous
  // reliance on the buggy observer-fires-on-mount path that ST-10 caught.
  await interceptAnchorApi(page, { healthy: false });
  const emp = await createOnboardingEmployee();

  await signInToOnboarding(page, emp);
  await page.getByLabel("Full name").fill(NAME);
  await page.getByRole("button", { name: "Continue" }).click();

  const skip = page.getByRole("button", { name: "Skip for now" });
  await expect(skip).toBeVisible({ timeout: 15_000 });
  await skip.click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Calibration" })).toBeVisible();

  // Phase 2: backend recovers — calibrate from the banner. Re-registering the
  // route fulfills with healthy:true (Playwright runs route handlers in reverse
  // registration order, so the newer one wins for subsequent requests).
  await interceptAnchorApi(page, { healthy: true });
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

test("dismiss persists across refresh, resets on sign-out, reappears on sign-in (ST-11 / FR-023+024)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(90_000);
  await installAnchorMocks(page);
  // healthy=false surfaces Skip → lands on /app with the banner, no real
  // recording needed (the test is about the banner's session lifecycle, not
  // the recorder).
  await interceptAnchorApi(page, { healthy: false });
  const emp = await createOnboardingEmployee();

  await signInToOnboarding(page, emp);
  await page.getByLabel("Full name").fill(NAME);
  await page.getByRole("button", { name: "Continue" }).click();
  const skip = page.getByRole("button", { name: "Skip for now" });
  await expect(skip).toBeVisible({ timeout: 15_000 });
  await skip.click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });

  const banner = page.getByRole("region", { name: "Calibration" });
  await expect(banner).toBeVisible();

  // 1. Dismiss → hidden for the session.
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(banner).toHaveCount(0);

  // 2. Refresh → still hidden (sessionStorage survives a same-session reload).
  await page.reload();
  await expect(page).toHaveURL(/\/app$/);
  await expect(banner).toHaveCount(0);

  // 3. Sign out + sign back in → banner REAPPEARS.
  // This is the ST-11 regression: dismissal was tab-scoped via sessionStorage
  // and survived sign-out/sign-in within one tab. broadcastSignOut now wipes
  // the dismissal key as part of the sign-out flow.
  await signOut(page);
  await page.getByLabel("Email").fill(emp.email);
  await page.getByLabel("Password", { exact: true }).fill(emp.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // full_name is set now, so /app loads directly (no /onboarding bounce).
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
  await expect(banner).toBeVisible();
});

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
