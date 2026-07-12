import { expect, test } from "@playwright/test";

import { fetchLatestOtp, randomEmail } from "./helpers";

const PASSWORD = "ResetUx123!";

/**
 * UX-only coverage for the reset-password form. These tests create a fresh
 * user through the public signup and OTP flow, then visit /reset-password so
 * we can assert on the validation cadence and the password-toggle affordance
 * from the new PasswordInput component.
 *
 * /reset-password is reachable to any authenticated user because the
 * proxy doesn't bounce them off the page (it was removed from
 * AUTH_PAGES so recovery sessions could land here). For an already-
 * signed-in user the form renders directly.
 */
test.beforeEach(async ({ page }) => {
  const email = randomEmail("reset-ux");

  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Reset Ux");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  const otp = await fetchLatestOtp(email);
  expect(otp).toMatch(/^\d{6}$/);
  await page.getByLabel("Digit 1").click();
  await page.keyboard.type(otp);
  await expect(page).toHaveURL(/\/(app|onboarding)$/, { timeout: 10_000 });

  if (new URL(page.url()).pathname === "/onboarding") {
    await page.getByLabel("Full name").fill("Reset Ux");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByRole("heading", { name: "Set your calm baseline" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Turn on camera" }).click();
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(page).toHaveURL(/\/app$/);
  }

  await page.goto("/reset-password");
  await expect(
    page.getByRole("heading", { name: "Set a new password" }),
  ).toBeVisible();
});

test("mismatch error clears as soon as the confirm matches", async ({
  page,
}) => {
  const newField = page.getByLabel("New password");
  const confirmField = page.getByLabel("Confirm password");

  // Touch both fields so onTouched flips them into reactive validation.
  await newField.fill("Goodpass1");
  await newField.blur();
  await confirmField.fill("Different1");
  await confirmField.blur();

  const mismatch = page.getByText("Passwords do not match.");
  await expect(mismatch).toBeVisible();

  // Without submitting, type the matching value into confirm — the
  // error must disappear under onTouched's revalidate-on-change.
  await confirmField.fill("Goodpass1");
  await expect(mismatch).toBeHidden({ timeout: 1000 });
});

test("password strength errors are user-friendly, not Zod regex sources", async ({
  page,
}) => {
  const newField = page.getByLabel("New password");

  // Letter-only — should trip the digit rule with a friendly message.
  await newField.fill("nodigits");
  await newField.blur();
  await expect(page.getByText("Password must contain a number")).toBeVisible();
  await expect(
    page.getByText(/must match pattern \/\[0-9\]\//i),
  ).toHaveCount(0);

  // Digit-only — should trip the letter rule with a friendly message.
  await newField.fill("12345678");
  await expect(page.getByText("Password must contain a letter")).toBeVisible();
  await expect(
    page.getByText(/must match pattern \/\[A-Za-z\]\//i),
  ).toHaveCount(0);
});

test("password requirements checklist lights up rule by rule as the user types", async ({
  page,
}) => {
  const newField = page.getByLabel("New password");
  const list = page.locator("#new-password-requirements");

  // Initial state: all three rules visible and unmet (data-met="false").
  await expect(list.getByText("At least 8 characters")).toBeVisible();
  await expect(list.getByText("Contains a letter")).toBeVisible();
  await expect(list.getByText("Contains a number")).toBeVisible();
  await expect(
    list.locator('li[data-met="true"]'),
  ).toHaveCount(0);

  // Letters only — letter rule flips to met, others still unmet.
  // The data-met="true" flip rides the fill → RHF onChange → useWatch →
  // PasswordRequirements re-render chain. When this spec runs last in the
  // full suite, webkit executes ~2× slower under sustained `npm run dev`
  // load (observed 7.6s peak vs ~3.5s isolated), so the rule-satisfied
  // assertions get a 10s budget — comfortably above the default 5s — to
  // absorb that lag without masking a genuine failure.
  await newField.fill("abc");
  await expect(
    list.locator('li[data-met="true"]', { hasText: "Contains a letter" }),
  ).toHaveCount(1, { timeout: 10_000 });
  await expect(
    list.locator('li[data-met="false"]', {
      hasText: "Contains a number",
    }),
  ).toHaveCount(1);

  // Add a digit; still under 8 chars so the length rule remains unmet.
  await newField.fill("abc1");
  await expect(
    // Same 10s webkit-load budget as the letter-rule flip above.
    list.locator('li[data-met="true"]', { hasText: "Contains a number" }),
  ).toHaveCount(1, { timeout: 10_000 });
  await expect(
    list.locator('li[data-met="false"]', {
      hasText: "At least 8 characters",
    }),
  ).toHaveCount(1);

  // Cross all three — the list collapses to the success line.
  await newField.fill("Goodpass1");
  await expect(list.getByText("Password looks good.")).toBeVisible();
  await expect(list.locator("ul")).toHaveCount(0);
});

test("confirm-mismatch validation fires on the confirm field's blur AND change", async ({
  page,
}) => {
  const newField = page.getByLabel("New password");
  const confirmField = page.getByLabel("Confirm password");
  const mismatch = page.getByText("Passwords do not match.");

  // Fill the new password first and blur into confirm.
  await newField.fill("Goodpass1");
  await confirmField.focus();

  // Until confirm is touched, no cross-field error renders.
  await confirmField.fill("Goodpass");
  await expect(mismatch).toBeHidden();

  // Blur confirm — the cross-field refine fires for the first time.
  await confirmField.blur();
  await expect(mismatch).toBeVisible();

  // Now type to make it match — revalidate-on-change clears the error.
  await confirmField.fill("Goodpass1");
  await expect(mismatch).toBeHidden({ timeout: 1000 });

  // Type to break it again on the *same touched field* — error returns
  // on change, no further blur needed.
  await confirmField.fill("Goodpass2");
  await expect(mismatch).toBeVisible({ timeout: 1000 });
});

test("show/hide password toggle flips input type and aria-label", async ({
  page,
}) => {
  const newField = page.getByLabel("New password");
  await expect(newField).toHaveAttribute("type", "password");

  // The toggle button lives in the same relative-positioned wrapper
  // as the input. Scope by the parent so we don't grab the toggle
  // attached to the confirm field.
  const wrapper = newField.locator("..");
  const toggle = wrapper.getByRole("button", { name: /password/i });

  await expect(toggle).toHaveAttribute("aria-label", "Show password");
  await toggle.click();
  await expect(newField).toHaveAttribute("type", "text");
  await expect(toggle).toHaveAttribute("aria-label", "Hide password");

  await toggle.click();
  await expect(newField).toHaveAttribute("type", "password");
  await expect(toggle).toHaveAttribute("aria-label", "Show password");
});
