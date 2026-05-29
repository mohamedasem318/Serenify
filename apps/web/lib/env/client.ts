import { clientEnvSchema, formatEnvIssues, type ClientEnv } from "./schema";

/**
 * Validated public environment — safe to import from any Client Component.
 *
 * The `NEXT_PUBLIC_*` reads are written as literal member accesses so Next.js
 * inlines them into the client bundle at build time (these are public by
 * design — the anon key is RLS-bound). Validation runs once at module load: a
 * missing or malformed value fails fast here with a clear Zod error rather than
 * deep inside the Supabase client at first use.
 */
function loadClientEnv(): ClientEnv {
  const result = clientEnvSchema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
  });
  if (!result.success) {
    throw new Error(
      `Invalid public environment configuration:\n${formatEnvIssues(result.error)}`,
    );
  }
  return result.data;
}

export const clientEnv = loadClientEnv();
