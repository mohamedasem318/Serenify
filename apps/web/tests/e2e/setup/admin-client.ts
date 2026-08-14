if (process.env.NODE_ENV === "production") {
  throw new Error("admin test client must never run in production");
}

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for Playwright tests ONLY — and for GoTrue
 * AUTH ADMIN calls only (create/list/delete/update users, research R-4).
 *
 * It cannot touch tables: service_role holds no DML on any public table on
 * this project (#208), and that is deliberate — table writes for fixtures run
 * as the purpose-made `serenify_seeder` identity instead (seeder-client.ts,
 * migration 20260814000000_seeding_identity.sql). Keep the split: auth
 * capability and table-write capability live on separate identities.
 *
 * NEVER imported from application code. Two layers of defence:
 *   1. The runtime guard above throws on production loads even if a
 *      future refactor accidentally imports this file from elsewhere.
 *   2. The file lives under `tests/`, which Next.js excludes from the
 *      route/layout/server-component graph by convention, so the
 *      production bundle has no transitive path here.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
