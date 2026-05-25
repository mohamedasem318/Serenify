import { expect, test } from "@playwright/test";

import { createAdminClient } from "./setup/admin-client";
import { fetchLatestOtp, randomEmail } from "./helpers";

/**
 * Cross-tab auth state propagation (US-6 / FR-046 / 📌 DECISION-9).
 *
 * Spec pattern per plan.md Decision N (amended 2026-05-22, see
 * CHANGELOG): single browser context, two pages so localStorage is
 * shared. Sign-in / sign-out trigger an explicit broadcast write to
 * localStorage["serenify-auth-broadcast"]; sibling tabs receive the
 * `storage` event and CrossTabAuth navigates them per FR-046.
 *
 * Both sign-in and sign-out flow through real UI clicks per Decision
 * N — sign-in via the /login form in pageA, sign-out via the
 * profile dropdown in pageA. The form / dropdown wiring carries the
 * broadcast call; `page.evaluate(client.auth.signOut())` would
 * bypass the broadcast and the spec would silently miss the
 * cross-tab path.
 *
 * Demo cohort password documented in plan.md: DemoUser123!
 * (used by the seed script; rotated only via re-seeding).
 */

const DEMO_PASSWORD = "DemoUser123!";

test.describe.configure({ mode: "serial" });

async function findDemoEmployee(): Promise<string | null> {
  const admin = createAdminClient();
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  const employee = list.users.find((u) =>
    u.email?.endsWith("@demo.serenify.local"),
  );
  return employee?.email ?? null;
}

test("cross-tab: sign-in on tab A propagates tab B from /login to /app", async ({
  browser,
}) => {
  const email = await findDemoEmployee();
  if (!email) {
    test.skip(true, "No @demo.serenify.local user — run `npm run seed`.");
    return;
  }

  const context = await browser.newContext();
  try {
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    // Both tabs sit on /login first.
    await pageA.goto("/login");
    await pageB.goto("/login");
    await expect(pageA).toHaveURL(/\/login$/);
    await expect(pageB).toHaveURL(/\/login$/);

    // Sign in via the real form in pageA. The form's success branch
    // calls broadcastSignIn() before router.replace, writing the
    // marker to shared localStorage.
    await pageA.getByLabel("Email").fill(email);
    await pageA.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
    await pageA.getByRole("button", { name: "Sign in" }).click();
    await expect(pageA).toHaveURL(/\/(app|onboarding)$/, { timeout: 5_000 });

    // Contract: pageB navigates within 2s. CrossTabAuth at pathname
    // = /login catches the signin broadcast and pushes /app. /app
    // may then redirect to /onboarding if the user has a null
    // profile, but either lands satisfy the propagation check.
    await expect(pageB).toHaveURL(/\/(app|onboarding)$/, { timeout: 2_000 });
  } finally {
    await context.close();
  }
});

test("cross-tab: sign-out on tab A propagates tab B from /app to /login", async ({
  browser,
}) => {
  const email = await findDemoEmployee();
  if (!email) {
    test.skip(true, "No @demo.serenify.local user — run `npm run seed`.");
    return;
  }

  const context = await browser.newContext();
  try {
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    // Sign in tab A first through the real form. The shared
    // cookies + the broadcast both reach tab B; we navigate tab B
    // to /app afterwards so it has a real session-based render.
    await pageA.goto("/login");
    await pageA.getByLabel("Email").fill(email);
    await pageA.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
    await pageA.getByRole("button", { name: "Sign in" }).click();
    await expect(pageA).toHaveURL(/\/(app|onboarding)$/, { timeout: 5_000 });
    if (pageA.url().endsWith("/onboarding")) {
      await pageA.getByLabel("Full name").fill("Demo Employee");
      await pageA.getByRole("button", { name: "Continue" }).click();
      await expect(pageA).toHaveURL(/\/app$/);
    }

    // Open tab B at /app. Shared cookies mean the (authed) layout's
    // getUser() guard sees a session; no redirect to /login.
    await pageB.goto("/app");
    await expect(pageB).toHaveURL(/\/app$/);

    // Sign out via the profile dropdown in tab A (Decision N: real
    // UI clicks). The dropdown's hidden form's onSubmit calls
    // broadcastSignOut() before the Server Action runs.
    await pageA.getByLabel("Open profile menu").click();
    await pageA.getByTestId("profile-dropdown-signout").click();
    await expect(pageA).toHaveURL(/\/login$/, { timeout: 5_000 });

    // pageB navigates within 2s. CrossTabAuth at pathname=/app
    // catches the signout broadcast and pushes /login.
    await expect(pageB).toHaveURL(/\/login$/, { timeout: 2_000 });
  } finally {
    await context.close();
  }
});

test("cross-tab: OTP signup verify on tab B propagates tab A from /login to /app", async ({
  browser,
}) => {
  // Regression guard for the OTP arm of the "auth completes but the
  // broadcast doesn't fire" bug class. The 6-digit OTP fallback
  // (OtpPanel) completes sign-up WITHOUT going through /auth/callback,
  // so it can't lean on that route's AUTH_SIGNIN_COOKIE bridge; OtpPanel
  // writes the broadcast marker directly (gated by successHref). A fresh
  // sign-up is required — the demo cohort is pre-verified and can't
  // exercise the confirmation OTP.
  const email = randomEmail("otp-xtab");

  const context = await browser.newContext();
  try {
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    await pageA.goto("/login");
    await expect(pageA).toHaveURL(/\/login$/);

    await pageB.goto("/signup");
    await pageB.getByLabel("Full name").fill("OTP Crosstab");
    await pageB.getByLabel("Email").fill(email);
    await pageB.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
    await pageB.getByRole("button", { name: "Create account" }).click();
    await expect(
      pageB.getByRole("heading", { name: "Enter the code instead" }),
    ).toBeVisible();

    // Pull the 6-digit code from Mailpit and verify via the inline panel
    // (not the email link) so this exercises the OtpPanel completion path.
    const otp = await fetchLatestOtp(email);
    await pageB.getByLabel("6-digit code").fill(otp);
    await pageB.getByRole("button", { name: "Verify code" }).click();
    await expect(pageB).toHaveURL(/\/(app|onboarding)$/, { timeout: 5_000 });

    // Contract: pageA (still at /login) catches the signin broadcast that
    // OtpPanel wrote and navigates within 2s.
    await expect(pageA).toHaveURL(/\/(app|onboarding)$/, { timeout: 2_000 });
  } finally {
    await context.close();
  }
});
