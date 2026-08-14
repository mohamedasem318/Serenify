if (process.env.NODE_ENV === "production") {
  throw new Error("seed admin client must never run in production");
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Target } from "./env.js";

/**
 * Service-role Supabase client for the seed script ONLY — and for GoTrue
 * AUTH ADMIN calls only (createUser / listUsers / deleteUser).
 *
 * It cannot write tables: service_role holds no DML on any public table on
 * this project (#208), so role/manager_id/anchor writes on public.profiles
 * run as the purpose-made `serenify_seeder` identity instead
 * (lib/seeder-client.ts). The SECURITY DEFINER RPCs admin_update_role /
 * admin_update_manager are no help to a script either way — they re-verify
 * auth.uid(), which is NULL outside a user session.
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
