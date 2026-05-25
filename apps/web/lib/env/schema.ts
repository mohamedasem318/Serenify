import { z } from "zod";

/**
 * Zod schemas for the application's environment variables.
 *
 * Kept side-effect-free and free of any `server-only` import so they can be
 * unit-tested directly and reused by both the client and server binding
 * modules (`./client.ts`, `./server.ts`).
 *
 * The keys are validated by length only (Supabase anon/service-role keys are
 * JWTs that share the same shape and differ only in payload/signature). The
 * real prefix-discipline guarantee — that the service-role key never reaches
 * the client bundle — comes from WHERE each var is read: `serverEnvSchema` is
 * only ever bound in `./server.ts`, which is `server-only`. See
 * docs/security/04-secrets-handling.md Finding 1.
 */

const supabaseKey = z
  .string()
  .min(100, "Supabase key looks too short — expected a JWT");

export const clientEnvSchema = z.object({
  supabaseUrl: z.url(),
  supabaseAnonKey: supabaseKey,
});

export const serverEnvSchema = clientEnvSchema.extend({
  supabaseServiceRoleKey: supabaseKey,
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
