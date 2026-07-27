import { expect, test } from "@playwright/test";

import { createCalibratedEmployee, signInToApp } from "./anchor-helpers";
import { seedRetrospectiveSession } from "./monitoring-helpers";
import { createAdminClient } from "./setup/admin-client";
import { randomEmail, termsConsentMetadata } from "./helpers";

/**
 * Employee dashboard shell happy-path (T064 / SC-012, covers US1+US2+US3).
 *
 * One test walks the full employee flow on desktop: sign-in → /app
 * welcome banner + three cards + chat pill → theme toggle persists across
 * reload → profile dropdown → /app/account with five sections → edit
 * full_name (SC-006: header avatar/initials + dropdown display name
 * reflect the new value on the same render cycle, no manual reload) →
 * change password through the inline Security form (FR-020 amendment
 * 2026-05-21) → bottom Sign out → /login.
 *
 * A second narrower test exercises the layout deltas at 360px: the
 * center-nav collapses to a hamburger trigger, the three cards stack
 * single-column, the chat pill collapses to icon-only — all behaviours
 * already covered by Vitest at the component level, this is the
 * integrated visual check.
 *
 * Pattern follows the role-trio specs (admin-seeded.spec.ts /
 * team-lead-seeded.spec.ts): provision a fresh @example.com user via
 * the service-role admin client with email_confirm + user_metadata so
 * the proxy lands the sign-in on /app directly (no onboarding stop).
 * globalSetup truncates @example.com between runs so this spec is
 * idempotent without intermediate cleanup.
 */

const PASSWORD = "Employee123!";
const INITIAL_FULL_NAME = "Layla Mostafa";
const RENAMED_FULL_NAME = "Tariq Hassan";

async function createEmployee(): Promise<{ email: string }> {
  const admin = createAdminClient();
  const email = randomEmail("emp-shell");
  const { error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: INITIAL_FULL_NAME, ...termsConsentMetadata() },
  });
  if (error) throw error;
  return { email };
}

test("employee shell: sign-in → /app → theme → account edit → password change → sign out", async ({
  page,
}) => {
  const { email } = await createEmployee();

  // ── Step 1: sign in via the real /login form. proxy.ts routes a
  // user with full_name set directly to /app — no onboarding stop.
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);

  // ── Step 2: /app body assertions — welcome banner with adaptive
  // greeting + first name; the locked Decision M subtitle; the three
  // skeleton cards in documented order; persistent header + chat pill.
  await expect(
    page.getByRole("heading", {
      name: /^Good (morning|afternoon|evening), Layla$/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("A space to check in with yourself."),
  ).toBeVisible();
  // shadcn CardTitle renders as a <div>, not a heading — use text
  // matching instead of getByRole("heading").
  await expect(page.getByText("Today's check-in")).toBeVisible();
  await expect(page.getByText("Things that might help")).toBeVisible();
  await expect(page.getByText("Recent chats")).toBeVisible();
  await expect(page.getByTestId("chat-pill")).toBeVisible();
  // Header: logo link to /app, theme toggle, profile avatar trigger.
  await expect(page.getByLabel("Go to home")).toBeVisible();
  await expect(page.getByLabel("Open profile menu")).toBeVisible();

  // ── Step 3: theme toggle persists across full reload.
  // Capture pre-toggle class state, click, capture post-toggle, reload,
  // confirm the post-toggle class survived. The button's aria-label
  // flips each click ("Switch to dark mode" / "Switch to light mode")
  // so we read it instead of hard-coding the starting theme.
  const themeButton = page.getByRole("button", {
    name: /^Switch to (dark|light) mode$/,
  });
  const beforeLabel = await themeButton.getAttribute("aria-label");
  await themeButton.click();
  // Wait for the class flip to take effect on <html>. next-themes
  // writes the class synchronously on click — but Playwright's
  // attribute-read here also forces a microtask flush.
  const expectedClass = beforeLabel === "Switch to dark mode" ? "dark" : "light";
  await expect(page.locator("html")).toHaveClass(
    new RegExp(`(^|\\s)${expectedClass}(\\s|$)`),
  );
  await page.reload();
  await expect(page.locator("html")).toHaveClass(
    new RegExp(`(^|\\s)${expectedClass}(\\s|$)`),
  );

  // ── Step 4: profile dropdown shows display name + Account link +
  // Sign out item in documented order.
  await page.getByLabel("Open profile menu").click();
  await expect(page.getByTestId("profile-dropdown-name")).toHaveText(
    INITIAL_FULL_NAME,
  );
  await expect(page.getByTestId("profile-dropdown-account")).toBeVisible();
  await expect(page.getByTestId("profile-dropdown-signout")).toBeVisible();

  // ── Step 5: navigate to /app/account; assert five sections in order.
  await page.getByTestId("profile-dropdown-account").click();
  await expect(page).toHaveURL(/\/app\/account$/);
  await expect(
    page.getByRole("heading", { name: "Account", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Profile", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Security", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Privacy", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Notifications", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sign out", level: 2 }),
  ).toBeVisible();

  // ── Step 6: edit full_name to a value with different initials.
  // SC-006 / FR-017: the header avatar/initials and dropdown display
  // name reflect the new value WITHOUT a manual page reload — the
  // ProfileSection calls router.refresh() in the success branch, which
  // re-renders the (authed) layout server component on the same render
  // cycle as the "Saved." status flip.
  const profileSection = page.locator(
    "section[aria-labelledby='account-profile-heading']",
  );
  const securitySection = page.locator(
    "section[aria-labelledby='account-security-heading']",
  );
  const nameField = page.getByLabel("Full name");
  await nameField.fill(RENAMED_FULL_NAME);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(profileSection.getByRole("status")).toHaveText("Saved.");

  // No page.reload() before this dropdown check — if it shows the new
  // name, the same render cycle that flipped to "Saved." re-fetched
  // the layout.
  await page.getByLabel("Open profile menu").click();
  await expect(page.getByTestId("profile-dropdown-name")).toHaveText(
    RENAMED_FULL_NAME,
  );
  // Close the dropdown before the next click so its overlay does not
  // intercept later interactions.
  await page.keyboard.press("Escape");

  // ── Step 7: change password through the inline Security form
  // (FR-020 amendment 2026-05-21 — the link-out to /forgot-password
  // was replaced by an inline current/new/confirm form per ADR).
  const newPassword = "EmployeeShell123!";
  await page
    .getByLabel("Current password", { exact: true })
    .fill(PASSWORD);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill(newPassword);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(securitySection.getByRole("status")).toHaveText(
    "Password updated.",
  );

  // ── Step 8: bottom Sign out button (SignOutSection / SignOutButton —
  // distinct from the dropdown's sign out, FR-022 + sign-out-styling-
  // consistency rule from T026). Lands on /login.
  await page
    .locator("section[aria-labelledby='account-signout-heading']")
    .getByRole("button", { name: "Sign out" })
    .click();
  await expect(page).toHaveURL(/\/login$/);
});

test("employee shell at 360px: hamburger menu, single-column cards, icon-only chat pill", async ({
  page,
}) => {
  const { email } = await createEmployee();

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);

  // Center-nav collapses to a hamburger at ≤768px (mobile-menu.tsx
  // visibility is `md:hidden` on the wrapping div). The avatar
  // dropdown trigger remains visible separately per FR-005.
  await expect(page.getByLabel("Open menu")).toBeVisible();
  await expect(page.getByLabel("Open profile menu")).toBeVisible();

  // Cards stack single-column. We probe the layout via bounding boxes:
  // the three card titles should each occupy the full grid row, i.e.
  // their x coordinates are roughly aligned (within a few px) and the
  // y coordinates are strictly increasing. Direct grid-template-columns
  // probing would couple the test to Tailwind class names.
  const checkin = await page.getByText("Today's check-in").boundingBox();
  const things = await page
    .getByText("Things that might help")
    .boundingBox();
  const recent = await page.getByText("Recent chats").boundingBox();
  if (!checkin || !things || !recent) {
    throw new Error("Card headings did not produce bounding boxes");
  }
  expect(things.y).toBeGreaterThan(checkin.y);
  expect(recent.y).toBeGreaterThan(things.y);
  // All three start within a 4px tolerance of the same x origin (the
  // single-column stack), eliminating the desktop 3fr/2fr split.
  expect(Math.abs(things.x - checkin.x)).toBeLessThanOrEqual(4);
  expect(Math.abs(recent.x - checkin.x)).toBeLessThanOrEqual(4);

  // Chat pill present at 360px. Per chat-pill.tsx the "Chat" label is
  // sr-only at ≤768px (`sr-only md:not-sr-only`); the testid + the
  // aria-label survive both viewports as the stable anchor.
  await expect(page.getByTestId("chat-pill")).toBeVisible();
});

/**
 * Feature 009 / T025 — the today check-in card expands IN PLACE to the redesigned trend surface
 * (Constitution VII role e2e, happy path). The two shell tests above use a fresh employee whose
 * card sits on the empty state (no check-ins → nothing to expand); this seeds the RECAP branch —
 * a calibrated employee (real anchor → has_anchor true, so the card never lands on calibrate-first)
 * plus one ended session earlier today — then asserts the expanded view's load-bearing US2 contract:
 * the level scale is the LEFT AXIS (exactly four labels), never a bottom legend (SC-001), and the
 * whole thing expands and collapses in place on /app (no separate /app/today route). Reuses the
 * proven anchor + retrospective-session seams from employee-monitoring.spec.ts.
 */
test("employee dashboard: today recap expands in place to the axis-labelled plot (no legend) and collapses", async ({
  page,
}) => {
  const emp = await createCalibratedEmployee("Recap Reader");
  await seedRetrospectiveSession(emp.id);
  await signInToApp(page, emp);
  await expect(page).toHaveURL(/\/app$/);

  // collapsed: a single toggle exposes aria-expanded=false.
  const viewToday = page.getByRole("button", { name: /View today/ });
  await expect(viewToday).toBeVisible({ timeout: 30_000 });
  await expect(viewToday).toHaveAttribute("aria-expanded", "false");

  // expand IN PLACE → the fixed-px lane plot is shown with FOUR left-axis level labels and NO
  // bottom legend (SC-001: axis, not legend). The toggle flips to Hide today / aria-expanded=true.
  await viewToday.click();
  const hideToday = page.getByRole("button", { name: /Hide today/ });
  await expect(hideToday).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("today-plot")).toBeVisible();

  const axisLabels = page.getByTestId("axis-label");
  await expect(axisLabels).toHaveCount(4);
  await expect(axisLabels).toHaveText(["tense", "a little tense", "at ease", "no read"]);
  await expect(page.getByTestId("plot-legend")).toHaveCount(0);

  // expanded in place — still on the dashboard, not a separate today page.
  await expect(page).toHaveURL(/\/app$/);

  // collapse back in place → the toggle flips back to View today / aria-expanded=false.
  await hideToday.click();
  await expect(page.getByRole("button", { name: /View today/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
