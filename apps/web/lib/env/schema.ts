import { z } from "@/lib/zod";

/**
 * Zod schemas for the application's environment variables.
 *
 * Free of any `server-only` import and of env-binding side effects so they can
 * be unit-tested directly and reused by both the client and server binding
 * modules (`./client.ts`, `./server.ts`). The `z` here comes from the
 * `@/lib/zod` barrel, whose only side effect is the benign `jitless` config
 * (CSP; see docs/security/05-csp-header.md) — not a server-only or env binding.
 *
 * Public Supabase keys are validated by length only. Optional server-only
 * secrets must stay optional here so production deployments can omit privileged
 * admin capabilities entirely.
 */

const supabaseKey = z
  .string()
  .min(100, "Supabase key looks too short — expected a JWT");
const optionalSupabaseKey = z.preprocess(
  (value) => (value === "" ? undefined : value),
  supabaseKey.optional(),
);

export const clientEnvSchema = z.object({
  supabaseUrl: z.url(),
  supabaseAnonKey: supabaseKey,
  // FastAPI anchor service origin (feature 004). Public by design — the browser
  // posts the recorded clip here and reads /healthz. Defaults to the local dev
  // origin; production sets NEXT_PUBLIC_API_URL. The CSP `connect-src` in
  // proxy.ts is derived from this value.
  apiUrl: z.url().default("http://127.0.0.1:8000"),
});

export const serverEnvSchema = clientEnvSchema.extend({
  supabaseServiceRoleKey: optionalSupabaseKey,
  siteUrl: z.url().default("http://localhost:3000"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Render a ZodError as a readable, one-issue-per-line list for boot errors. */
export function formatEnvIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}
