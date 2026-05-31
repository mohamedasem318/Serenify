import { expect, test } from "@playwright/test";

import {
  WEBKIT_SKIP_REASON,
  createCalibratableEmployee,
  installAnchorMocks,
  installCameraError,
  interceptAnchorApi,
  signInToApp,
} from "./anchor-helpers";

/**
 * T031 — the three calm camera-access states (US4, FR-031–035). getUserMedia is made
 * to reject with each real `error.name`, and the orchestrator's REAL error→state
 * mapping (use-anchor-recorder.ts) routes to the matching foggy state. Each names the
 * problem + the fix and offers "Try again" / "Not now". WebKit is skipped (it locks
 * navigator.mediaDevices, so getUserMedia cannot be made to reject deterministically).
 */

const CASES = [
  { name: "NotAllowedError", heading: /camera.s blocked/i, hint: /address bar/i },
  { name: "NotReadableError", heading: /camera.s in use/i, hint: /video call|screen recorder/i },
  { name: "NotFoundError", heading: /no camera found/i, hint: /connect or enable/i },
] as const;

for (const c of CASES) {
  test(`${c.name} → its distinct foggy camera-access state (FR-031–035)`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
    test.setTimeout(60_000);
    await installAnchorMocks(page);
    await installCameraError(page, c.name); // getUserMedia rejects with this error.name
    await interceptAnchorApi(page);
    const emp = await createCalibratableEmployee();

    await signInToApp(page, emp);
    await page.goto("/app/calibrate");
    await page.getByRole("button", { name: "Turn on camera" }).click();

    await expect(page.getByRole("heading", { name: c.heading })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(c.hint)).toBeVisible();
    // both calm actions present; never a recording timer (we never got the camera).
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Not now" })).toBeVisible();
    await expect(page.getByRole("timer")).toHaveCount(0);
  });
}

test("'Not now' from a camera-access state exits to /app with the banner (first-time, FR-035)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(60_000);
  await installAnchorMocks(page);
  await installCameraError(page, "NotReadableError");
  await interceptAnchorApi(page);
  const emp = await createCalibratableEmployee();

  await signInToApp(page, emp);
  await page.goto("/app/calibrate");
  await page.getByRole("button", { name: "Turn on camera" }).click();
  await expect(page.getByRole("heading", { name: /camera.s in use/i })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Not now" }).click();

  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Calibration" })).toBeVisible();
});
