import { expect, test } from "@playwright/test";

import { createAdminClient } from "./setup/admin-client";
import { randomEmail } from "./helpers";

const PASSWORD = "Employee123!";

test("employee can sign up, bypass-confirm, sign in, onboard, see role", async ({
  page,
}) => {
  const admin = createAdminClient();
  const email = randomEmail("employee");

  // /signup form happy path.
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Employee One");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  // Bypass email confirmation via admin client (research R-4).
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  const created = list.users.find((u) => u.email === email);
  expect(created).toBeTruthy();
  await admin.auth.admin.updateUserById(created!.id, { email_confirm: true });

  // Clear the unconfirmed-signup session cookies so the next /login
  // navigation actually shows the form (otherwise the proxy would bounce
  // a signed-in user to /app).
  await page.context().clearCookies();

  // Sign in. full_name was carried via raw_user_meta_data, so the proxy
  // routes straight to /app — no onboarding stop.
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByTestId("role-banner")).toHaveText(
    /signed in as an employee/i,
  );
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
