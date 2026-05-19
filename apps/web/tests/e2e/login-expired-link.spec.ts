import { expect, test } from "@playwright/test";

test("shows the calm expired-link notice when ?error=expired_link", async ({
  page,
}) => {
  await page.goto("/login?error=expired_link");

  const notice = page.getByRole("status");
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText(
    "Your activation link expired. Please sign in below.",
  );

  // The form must still render — the notice never replaces the sign-in path.
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("renders no notice on a bare /login", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("renders no notice for an unknown error value", async ({ page }) => {
  await page.goto("/login?error=mystery_code");
  await expect(page.getByRole("status")).toHaveCount(0);
});
