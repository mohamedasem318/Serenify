import "server-only";

import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env/server";

/**
 * Legacy admin client for the disabled invite endpoint. Bypasses RLS when
 * configured, so production deployments should leave the key unset.
 */
export function createAdminClient() {
  const serviceRoleKey = serverEnv.supabaseServiceRoleKey;
  if (!serviceRoleKey) {
    throw new Error("Admin Supabase client is disabled");
  }

  return createClient(serverEnv.supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
