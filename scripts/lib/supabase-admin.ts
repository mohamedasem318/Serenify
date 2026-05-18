if (process.env.NODE_ENV === "production") {
  throw new Error("seed admin client must never run in production");
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Target } from "./env.js";

/**
 * Service-role Supabase client for the seed script ONLY.
 *
 * The script is the only consumer that needs to bypass RLS to write
 * role/manager_id on public.profiles (FR-018 — the SECURITY DEFINER
 * RPCs admin_update_role / admin_update_manager re-verify auth.uid()
 * which is NULL under a service-role context).
 *
 * Defense in depth:
 *   1. The module-load guard above throws if NODE_ENV is production,
 *      so any accidental import from app code crashes immediately.
 *   2. SUPABASE_SERVICE_ROLE_KEY is read from process.env (populated
 *      by env.ts from apps/web/.env.local) — never accepted as an
 *      argument, never logged.
 */
export function createAdminClient(target: Target): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    // env.ts already validated this, but the type system can't carry
    // that across module boundaries; assert again rather than `!`.
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient(target.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
