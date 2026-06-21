import { expect, test } from "@playwright/test";

import {
  WEBKIT_SKIP_REASON,
  createCalibratedEmployee,
  installActiveDetector,
  signInToApp,
} from "./anchor-helpers";
import {
  installMonitoringMocks,
  interceptMonitoringApi,
  seedRetrospectiveSession,
} from "./monitoring-helpers";

/**
 * T051 — the employee happy-path e2e: start → permission → warming-up → reading → end →
 * the dashboard **today recap, expanded in place** (NOT a separate "today" page). Drives the
 * REAL orchestration (state machine, continuous recorder loop, the typed monitoring-client,
 * the dashboard recap RLS reads) against boundary fakes (getUserMedia + MediaRecorder + the
 * FastAPI endpoints), using the feature-005 detector-injection seam so the framing gate
 * resolves to a present face without a real camera.
 *
 * Scope note (read before extending): this is **not** the cross-browser capture gate. The
 * authoritative Safari/iOS secure-context + capture check is the real-device smoke
 * (Phase 2 / smoke-tests.md ST-08-2/3), which Playwright must not be presented as replacing.
 * WebKit is skipped (headless WebKit locks navigator.mediaDevices → getUserMedia unmockable).
 *
 * The assertions are deliberately on **observable, user-facing outcomes** (the permission
 * panel, the warming-up copy, the band stateline + bloom tone, the URL after End, the recap
 * toggle's aria-expanded + the expanded plot) — never on internal timing that would let the
 * test pass while masking a real async/navigation regression.
 */

test("employee happy path: start → permission → warming-up → reading → end → today recap expands in place", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", WEBKIT_SKIP_REASON);
  test.setTimeout(120_000);

  await installMonitoringMocks(page);
  await installActiveDetector(page); // the framing gate sees a centred, lit face → uploads proceed
  await interceptMonitoringApi(page); // warming_up ×2 → reading (at_ease)

  // A calibrated employee (real anchor → has_anchor true → the card loads the recap branch,
  // never calibrate-first) + one ended session earlier today so the recap has content.
  const emp = await createCalibratedEmployee("Monitor Tester");
  await seedRetrospectiveSession(emp.id);

  await signInToApp(page, emp);

  // ── start the check-in (a full-document nav into the camera route) ──────────────────────
  await page.getByRole("link", { name: "Start check-in" }).click();
  await expect(page).toHaveURL(/\/app\/monitor$/, { timeout: 30_000 });

  // ── permission → warming-up ─────────────────────────────────────────────────────────────
  await expect(page.getByRole("heading", { name: "Serenify needs your camera" })).toBeVisible({
    timeout: 30_000,
  });
  // The first click on a hard-loaded page can race React hydration (the same gap the anchor
  // flow's recordAnchor handles): an early click lands before the onClick is attached and is
  // lost. Retry the Allow click until the warming-up state actually appears — a real user
  // clicks once the page is interactive; this asserts the real outcome, not internal timing.
  const allow = page.getByRole("button", { name: "Allow camera access" });
  const warming = page.getByText("Getting a read on things");
  await expect(async () => {
    if (await warming.isVisible().catch(() => false)) return;
    if (await allow.isVisible().catch(() => false)) await allow.click({ timeout: 2_000 }).catch(() => {});
    await expect(warming).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 30_000 });

  // ── a smoothed band lands (the first "reading") ─────────────────────────────────────────
  await expect(page.getByText("You're at ease right now")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("bloom")).toHaveAttribute("data-tone", "ease");
  // No number/gauge is ever rendered (FR-015) — the page shows no percent sign.
  await expect(page.locator("body")).not.toContainText("%");

  // ── end the session → back to the dashboard (mock-gap #6: no standalone "ended" screen) ──
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });

  // ── the today recap is on the dashboard and EXPANDS IN PLACE (no route change) ──────────
  const viewToday = page.getByRole("button", { name: /View today/ });
  await expect(viewToday).toBeVisible({ timeout: 30_000 });
  await expect(viewToday).toHaveAttribute("aria-expanded", "false");

  await viewToday.click();

  // expanded in place: the toggle flips, the day plot is shown, and the URL is STILL /app
  // (it is not a separate /app/today page).
  await expect(page.getByRole("button", { name: /Hide today/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByTestId("today-plot")).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);
});
