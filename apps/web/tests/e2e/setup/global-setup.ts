// Playwright globalSetup — runs ONCE before the test run.
//
// Responsibilities:
//   1. Refuse to run unless NEXT_PUBLIC_SUPABASE_URL points at localhost.
//      This prevents accidentally wiping a staging or production database.
//   2. Delete every existing auth.users row whose email matches the
//      Playwright FIXTURE pattern @example.com (cascades to public.profiles
//      via FK ON DELETE CASCADE). The demo cohort created by
//      `npm run seed` (FR-019, feature 002) uses @demo.serenify.local
//      and is left untouched so an e2e run never destroys it.
//   3. Seed a known-credentials test admin and promote its role. User
//      creation goes through the service-role auth admin API; the profile
//      promotion is a TABLE write and runs as the purpose-made
//      `serenify_seeder` identity (#208 — seeder-client.ts). A fresh
//      `supabase db reset --local` needs no manual grant of any kind.
//   4. Export TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD for the role specs.
//
// Contributors must run `npx playwright install --with-deps chromium
// firefox webkit` once after cloning so the browser binaries are on disk
// before the webServer block tries to launch them.
//
// Env prerequisites (#179) — playwright.config.ts dotenv-loads apps/web/.env.local
// into the runner process; a fresh clone needs BOTH of these in it:
//   - NEXT_PUBLIC_SUPABASE_URL — must point at the LOCAL stack (guarded below;
//     anything else refuses to run rather than truncate real data).
//   - SUPABASE_SERVICE_ROLE_KEY — the LOCAL stack's service-role key, shown by
//     `npx supabase status`. admin-client.ts builds the auth-admin client from
//     it with no fallback, so an unset value fails the whole run at startup
//     with supabase-js's bare "supabaseKey is required".
// This comment is the key's documented home ON PURPOSE. It is test-infrastructure
// only: the app has no runtime service-role path (#142 deleted it, and
// tests/unit/runtime-secret-posture.test.ts enforces the absence), so
// .env.local.example — the runtime template — deliberately stays silent about it.
// The seeding identity itself needs NO env entry anywhere: its token is derived
// at runtime from the CLI's public local dev secret (seeder-client.ts).

import { createAdminClient } from "./admin-client";
import { createSeederClient } from "./seeder-client";
import { termsConsentMetadata } from "../helpers";

const TEST_ADMIN_EMAIL = "test-admin@example.com";
const TEST_ADMIN_PASSWORD = "TestAdmin123!";
const FIXTURE_EMAIL_SUFFIX = "@example.com";

export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
    throw new Error(
      `Refusing to run tests: NEXT_PUBLIC_SUPABASE_URL is "${url}", not a local Supabase. Truncating it would destroy real data.`,
    );
  }

  const admin = createAdminClient();

  // Step 2: delete every @example.com fixture user (cascades to
  // profiles via FK; demo cohort users at @demo.serenify.local survive).
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    if (data.users.length === 0) break;
    for (const u of data.users) {
      if (u.email?.toLowerCase().endsWith(FIXTURE_EMAIL_SUFFIX)) {
        const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
        if (delErr) throw delErr;
      }
    }
    if (data.users.length < 200) break;
    page += 1;
  }

  // Step 3: seed the test admin and promote.
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
      email_confirm: true,
      // The consent metadata makes handle_new_user() record the Terms/Privacy
      // acceptance, so the test admin lands past the P5 entry gate rather than on
      // the re-consent screen. See termsConsentMetadata() for why it goes through
      // the trigger rather than a direct insert.
      user_metadata: { full_name: "Test Admin", ...termsConsentMetadata() },
    });
  if (createErr || !created.user) {
    throw createErr ?? new Error("createUser returned no user");
  }

  const { error: roleErr } = await createSeederClient()
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", created.user.id);
  if (roleErr) throw roleErr;

  process.env.TEST_ADMIN_EMAIL = TEST_ADMIN_EMAIL;
  process.env.TEST_ADMIN_PASSWORD = TEST_ADMIN_PASSWORD;
}
