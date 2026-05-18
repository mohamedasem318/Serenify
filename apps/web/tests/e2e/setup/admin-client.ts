if (process.env.NODE_ENV === "production") {
  throw new Error("admin test client must never run in production");
}

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for Playwright tests ONLY.
 *
 * NEVER imported from application code. Two layers of defence:
 *   1. The runtime guard above throws on production loads even if a
 *      future refactor accidentally imports this file from elsewhere.
 *   2. The file lives under `tests/`, which Next.js excludes from the
 *      route/layout/server-component graph by convention, so the
 *      production bundle has no transitive path here.
 *
 * Used by Playwright globalSetup (truncating users between runs,
 * seeding the test admin) and by individual specs that need to
 * bypass email confirmation (research R-4).
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
