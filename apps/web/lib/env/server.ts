import "server-only";

import { serverEnvSchema, formatEnvIssues, type ServerEnv } from "./schema";

/**
 * Validated server environment — the single home for server-secret config.
 *
 * The `server-only` import makes the build fail if any Client Component graph
 * reaches this module, which is what keeps `SUPABASE_SERVICE_ROLE_KEY` out of
 * the client bundle: the secret is only ever read through `serverEnv`, and
 * `serverEnv` cannot be imported from the client. See
 * docs/security/04-secrets-handling.md Finding 1 and the DECISIONS.md
 * 2026-05-25 (Security slice 4) validated-env-module entry.
 */
function loadServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    siteUrl: process.env.SITE_URL,
  });
  if (!result.success) {
    throw new Error(
      `Invalid server environment configuration:\n${formatEnvIssues(result.error)}`,
    );
  }
  return result.data;
}

export const serverEnv = loadServerEnv();
