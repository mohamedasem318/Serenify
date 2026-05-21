import { expect, test } from "@playwright/test";

import { fetchLatestOtp, randomEmail } from "./helpers";

const PASSWORD = "Employee123!";

test("employee can sign up and verify with the 6-digit OTP fallback (FR-020)", async ({
  page,
}) => {
  const email = randomEmail("otp");

  await page.goto("/signup");
  await page.getByLabel("Full name").fill("OTP One");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  // Check-email panel renders the OTP entry surface inline.
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Enter the code instead" }),
  ).toBeVisible();

  // Pull the OTP out of the Inbucket message body.
  const otp = await fetchLatestOtp(email);
  expect(otp).toMatch(/^\d{6}$/);

  // Submit it through the inline panel — same outcome as clicking the
  // magic link.
  await page.getByLabel("6-digit code").fill(otp);
  await page.getByRole("button", { name: "Verify code" }).click();

  // Proxy lands the verified user on /app (full_name was carried via
  // raw_user_meta_data at signup, so no onboarding stop).
  await expect(page).toHaveURL(/\/app$/);
  // Phase 7 T044: the role-banner testid is no longer rendered for
  // employees — they see the welcome banner + skeleton cards now.
  // T057's "drop role-banner / use welcome banner" guidance applied
  // here; the locked Decision M subtitle is the deterministic employee
  // signal that survives time-of-day greeting variation.
  await expect(
    page.getByText("A space to check in with yourself."),
  ).toBeVisible();
});
