import "server-only";

import { serverEnvSchema, formatEnvIssues, type ServerEnv } from "./schema";

/**
 * Validated server environment.
 *
 * The `server-only` import makes the build fail if any Client Component graph
 * reaches this module.
 */
function loadServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
