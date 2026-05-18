// Playwright globalSetup — runs ONCE before the test run.
//
// Responsibilities:
//   1. Refuse to run unless NEXT_PUBLIC_SUPABASE_URL points at localhost.
//      This prevents accidentally wiping a staging or production database.
//   2. Truncate auth.users (cascades to public.profiles via FK ON DELETE
//      CASCADE) and clear any orphan profile rows defensively.
//   3. Seed a known-credentials test admin and promote its role.
//   4. Export TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD for the role specs.
//
// Contributors must run `npx playwright install --with-deps chromium
// firefox webkit` once after cloning so the browser binaries are on disk
// before the webServer block tries to launch them.

import { createAdminClient } from "./admin-client";

const TEST_ADMIN_EMAIL = "test-admin@example.com";
const TEST_ADMIN_PASSWORD = "TestAdmin123!";

export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
    throw new Error(
      `Refusing to run tests: NEXT_PUBLIC_SUPABASE_URL is "${url}", not a local Supabase. Truncating it would destroy real data.`,
    );
  }

  const admin = createAdminClient();

  // Step 2: delete every existing auth user (cascades to profiles).
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    if (data.users.length === 0) break;
    for (const u of data.users) {
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
      if (delErr) throw delErr;
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  // Belt-and-braces: clear any orphan profiles rows (should be zero
  // because of ON DELETE CASCADE, but cheap to be sure).
  await admin
    .from("profiles")
    .delete()
    .gte("created_at", "1970-01-01");

  // Step 3: seed the test admin and promote.
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Test Admin" },
    });
  if (createErr || !created.user) {
    throw createErr ?? new Error("createUser returned no user");
  }

  const { error: roleErr } = await admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", created.user.id);
  if (roleErr) throw roleErr;

  process.env.TEST_ADMIN_EMAIL = TEST_ADMIN_EMAIL;
  process.env.TEST_ADMIN_PASSWORD = TEST_ADMIN_PASSWORD;
}
