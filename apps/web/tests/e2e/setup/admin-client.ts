if (process.env.NODE_ENV === "production") {
  throw new Error("admin test client must never run in production");
}

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for Playwright tests ONLY — and for GoTrue
 * AUTH ADMIN calls only (create/list/delete/update users, research R-4).
 *
 * It cannot touch tables — on any stack where the migrations through
 * 20260913100000 have been applied. There, service_role holds no privilege of
 * any kind on any public table: revoked per table (#269 step 2) and no longer
 * granted by default to new ones (#269 step 1), both pinned by static gate
 * tests in apps/api/tests. Before those two migrations reach a stack, the
 * hosted default hands service_role full DML on every public table (the
 * earlier "#208: no DML on this project" claim was true only of the local
 * stack — DECISIONS 2026-08-15). The split is deliberate regardless: table
 * writes for fixtures run as the purpose-made `serenify_seeder` identity
 * (seeder-client.ts, migration 20260814000000_seeding_identity.sql). Keep it:
 * auth capability and table-write capability live on separate identities.
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
