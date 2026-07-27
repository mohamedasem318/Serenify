import { expect, test } from "@playwright/test";

import { createAdminClient } from "./setup/admin-client";
import { randomEmail, signInAs, signOut } from "./helpers";

const TEST_PASSWORD = "SeededAdmin123!";

// Skipped: POST /api/admin/invite was deleted in #142 and returns 404 — un-skip with #174.
test.skip("seeded admin can invite another admin; employee invite caller is 403", async ({
  page,
}) => {
  const admin = createAdminClient();
  const newAdminEmail = randomEmail("admin");
  const newEmployeeEmail = randomEmail("employee");

  // Sign in as the seeded test admin.
  await signInAs(page, {
    email: process.env.TEST_ADMIN_EMAIL!,
    password: process.env.TEST_ADMIN_PASSWORD!,
  });

  // Invite a fresh admin.
  const inviteResponse = await page.request.post("/api/admin/invite", {
    data: { email: newAdminEmail, role: "admin" },
  });
  expect(inviteResponse.status()).toBe(201);
  const { user_id } = (await inviteResponse.json()) as { user_id: string };

  // Verify the row landed with role='admin' via the admin client.
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user_id)
    .single<{ role: string }>();
  expect(profile?.role).toBe("admin");

  // Bypass email confirmation, set a password, sign in as the new admin.
  await admin.auth.admin.updateUserById(user_id, {
    email_confirm: true,
    password: TEST_PASSWORD,
  });
  await signOut(page);
  await signInAs(page, { email: newAdminEmail, password: TEST_PASSWORD });
  // Phase 10 T055/T057: the role-banner testid is gone for managers
  // too. Admins see the RolePlaceholder with Decision L copy.
  // Subtitle assertion locks the 2026-05-22 amendment (see
  // CHANGELOG) so a future revert of the placeholder copy doesn't
  // silently pass the heading-only check.
  // Copy-only assertion per FR-036.
  await expect(
    page.getByRole("heading", {
      name: "Your admin view is in progress.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Org-wide tools land in a later release. Account settings are available from the header dropdown.",
    ),
  ).toBeVisible();

  // Now seed an employee and confirm their /api/admin/invite is 403.
  await signOut(page);
  const { data: employee } = await admin.auth.admin.createUser({
    email: newEmployeeEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Test Employee" },
  });
  expect(employee.user).toBeTruthy();
  await signInAs(page, { email: newEmployeeEmail, password: TEST_PASSWORD });
  const forbiddenResponse = await page.request.post("/api/admin/invite", {
    data: { email: randomEmail("denied"), role: "employee" },
  });
  expect(forbiddenResponse.status()).toBe(403);
});
