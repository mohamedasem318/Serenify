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
 * Public Supabase keys are validated by length only.
 */

const supabaseKey = z
  .string()
  .min(100, "Supabase key looks too short — expected a JWT");

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
  siteUrl: z.url().default("http://localhost:3000"),
  /**
   * Feature 013 (T064) — the app-shell Terms/Privacy gate's kill switch (§7.3 lever 2).
   *
   * DEFAULTS TO ENABLED. An absent variable means the gate is ON. A kill switch that
   * fails to the disabled state is not a safety lever, it is a silent outage: the gate
   * would be off on every environment that forgot to set it, and nothing would say so.
   *
   * NOT `z.coerce.boolean()`, deliberately. That helper applies JavaScript truthiness, so
   * the string `"false"` — the exact value a person types to switch the gate off — coerces
   * to `true` and the lever does the opposite of what it says. An explicit two-member enum
   * cannot make that mistake: the only accepted values are `"true"` and `"false"`, and
   * anything else fails the parse and throws at boot rather than being guessed at.
   * Case-sensitive on purpose — `"False"` is a typo, and a typo in a safety lever should
   * be loud at deploy time rather than silently resolved to one of the two positions.
   *
   * ABSENT FROM `clientEnvSchema` above, so it never reaches the browser bundle.
   */
  consentEntryGateEnabled: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Render a ZodError as a readable, one-issue-per-line list for boot errors. */
export function formatEnvIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}
