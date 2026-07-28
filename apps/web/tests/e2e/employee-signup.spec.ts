import { expect, test } from "@playwright/test";

import { acceptTermsOnSignup, fetchLatestOtp, randomEmail } from "./helpers";

const PASSWORD = "Employee123!";

test("employee can sign up, confirm OTP, and see the employee app", async ({
  page,
}) => {
  const email = randomEmail("employee");

  // /signup form happy path.
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Employee One");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await acceptTermsOnSignup(page);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  const otp = await fetchLatestOtp(email);
  expect(otp).toMatch(/^\d{6}$/);

  // Enter the OTP through the rendered six-box panel. Completion verifies the
  // user session and navigates to the authenticated app.
  await page.getByLabel("Digit 1").click();
  await page.keyboard.type(otp);
  await expect(page).toHaveURL(/\/app$/, { timeout: 10_000 });
  // Phase 7 T044: the role-banner testid is no longer rendered for
  // employees — they see the welcome banner + skeleton cards now.
  // T057's "drop role-banner / use welcome banner" guidance applied
  // here; the locked Decision M subtitle is the deterministic employee
  // signal that survives time-of-day greeting variation.
  await expect(
    page.getByText("A space to check in with yourself."),
  ).toBeVisible();
});

test("/signup is operable at a 360px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/signup");
  // Form heading, all three fields, and the primary CTA must be reachable
  // without horizontal scroll.
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByLabel("Full name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  // No horizontal overflow.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
