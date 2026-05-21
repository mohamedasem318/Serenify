import { expect, test } from "@playwright/test";

import { createAdminClient } from "./setup/admin-client";
import { randomEmail, signInAs, signOut } from "./helpers";

const TEST_PASSWORD = "SeededLead123!";

test("seeded team_lead can be invited and signs in to their role placeholder", async ({
  page,
}) => {
  const admin = createAdminClient();
  const leadEmail = randomEmail("team-lead");

  // Sign in as the test admin (seeded by globalSetup).
  await signInAs(page, {
    email: process.env.TEST_ADMIN_EMAIL!,
    password: process.env.TEST_ADMIN_PASSWORD!,
  });

  // POST /api/admin/invite as the admin.
  const inviteResponse = await page.request.post("/api/admin/invite", {
    data: { email: leadEmail, role: "team_lead" },
  });
  expect(inviteResponse.status()).toBe(201);
  const inviteBody = (await inviteResponse.json()) as { user_id: string };
  expect(inviteBody.user_id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );

  // Bypass email confirmation and set the password (research R-4).
  await admin.auth.admin.updateUserById(inviteBody.user_id, {
    email_confirm: true,
    password: TEST_PASSWORD,
  });

  // Sign out the admin, sign in as the new team_lead.
  await signOut(page);
  await signInAs(page, { email: leadEmail, password: TEST_PASSWORD });

  // Phase 10 T055/T057: the role-banner testid is gone for managers.
  // team_leads see the RolePlaceholder with Decision L copy.
  // Copy-only assertion per FR-036.
  await expect(
    page.getByRole("heading", {
      name: "Your team-lead view is coming together.",
    }),
  ).toBeVisible();

  // POST /api/admin/invite from the team_lead session is forbidden.
  const forbiddenResponse = await page.request.post("/api/admin/invite", {
    data: { email: randomEmail("denied"), role: "employee" },
  });
  expect(forbiddenResponse.status()).toBe(403);
});
