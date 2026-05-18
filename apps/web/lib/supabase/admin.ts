import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS — NEVER import from a client
 * component. The `server-only` import above causes the build to fail if any
 * client-component graph reaches this file.
 *
 * Used by POST /api/admin/invite (apps/web/app/api/admin/invite/route.ts) and
 * not exposed anywhere else in the production bundle.
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
