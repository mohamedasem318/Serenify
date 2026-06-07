import { expect, test } from "@playwright/test";

import { WEBKIT_SKIP_REASON, createCalibratableEmployee, signInToApp } from "./anchor-helpers";
import { signOut } from "./helpers";

/**
 * T031 — the home calibration banner's session lifecycle (US7, FR-042/044, ST-11),
 * re-authored for 005 (no recorder needed: a full_name'd, un-calibrated employee
 * lands on /app with the foggy banner directly). The "disappear on calibrate" half is
 * covered by the happy path in anchor-flow; the cross-tab mirror by anchor-cross-tab.
 */
test("banner appears, session-dismiss persists across refresh, reappears next session", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(90_000);
  const emp = await createCalibratableEmployee();

  await signInToApp(page, emp);
  const banner = page.getByRole("region", { name: "Calibration" });
  await expect(banner).toBeVisible(); // appears for an un-calibrated employee

  // 1. dismiss → hidden for the session
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(banner).toHaveCount(0);

  // 2. refresh → still hidden (sessionStorage survives a same-session reload)
  await page.reload();
  await expect(page).toHaveURL(/\/app$/);
  await expect(banner).toHaveCount(0);

  // 3. sign out + back in → REAPPEARS (broadcastSignOut wipes the dismissal key; ST-11)
  await signOut(page);
  await page.getByLabel("Email").fill(emp.email);
  await page.getByLabel("Password", { exact: true }).fill(emp.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
  await expect(banner).toBeVisible();
});
