import { describe, expect, it } from "vitest";

import { clientEnvSchema, serverEnvSchema } from "@/lib/env/schema";

/**
 * T064/T068 — `CONSENT_ENTRY_GATE_ENABLED`, the app-shell gate's kill switch (§7.3).
 *
 * Asserted against the SCHEMA, not against `lib/env/server.ts`. That module imports
 * `server-only`, which throws on import under Vitest (no `react-server` condition), and
 * it parses `process.env` once at module load — so it can be observed in exactly one
 * configuration per process. `schema.ts` is deliberately free of both, which is what
 * makes every case below expressible as an ordinary parse.
 *
 * THE ASSERTION THAT MATTERS MOST IS THE FIRST ONE. An absent variable must mean the gate
 * is ON. A kill switch that fails to the disabled state is not a safety lever, it is a
 * silent outage — the gate would be off on every environment that forgot to set it, and
 * nothing anywhere would say so.
 */

/** The rest of the server env, valid, so only the flag is ever under test. */
const BASE_ENV = {
  supabaseUrl: "http://127.0.0.1:54321",
  supabaseAnonKey: "x".repeat(120),
  siteUrl: "http://localhost:3000",
} as const;

function parseWith(flag: unknown) {
  return serverEnvSchema.safeParse({ ...BASE_ENV, consentEntryGateEnabled: flag });
}

describe("CONSENT_ENTRY_GATE_ENABLED defaults to ENABLED", () => {
  it("an ABSENT variable parses to enabled — the gate is on by default", () => {
    // The load-bearing case. `process.env.CONSENT_ENTRY_GATE_ENABLED` is `undefined` on
    // every environment that has never set it, including production on the day this
    // ships. That must mean ON.
    const result = serverEnvSchema.safeParse(BASE_ENV);
    expect(result.success).toBe(true);
    expect(result.success && result.data.consentEntryGateEnabled).toBe(true);
  });

  it("an explicitly undefined variable also parses to enabled", () => {
    // `loadServerEnv()` passes `process.env.CONSENT_ENTRY_GATE_ENABLED` through by name,
    // so the key is always PRESENT with the value `undefined` rather than absent. Both
    // shapes have to reach the same default or the default is only half real.
    const result = parseWith(undefined);
    expect(result.success && result.data.consentEntryGateEnabled).toBe(true);
  });

  it('"true" parses to enabled', () => {
    const result = parseWith("true");
    expect(result.success && result.data.consentEntryGateEnabled).toBe(true);
  });
});

describe("CONSENT_ENTRY_GATE_ENABLED can actually be switched off", () => {
  it('"false" parses to DISABLED — the z.coerce.boolean() trap, asserted', () => {
    // This is the whole reason the schema uses an enum-and-transform rather than
    // `z.coerce.boolean()`. Coercion applies JavaScript truthiness, and every non-empty
    // string is truthy — so `"false"`, the exact value a person types to switch the gate
    // off, would coerce to `true` and the lever would do the opposite of what it says.
    const result = parseWith("false");
    expect(result.success).toBe(true);
    expect(result.success && result.data.consentEntryGateEnabled).toBe(false);
  });
});

describe("a malformed value is REJECTED at boot, never coerced", () => {
  it.each([
    ["False (wrong case)", "False"],
    ["FALSE (upper)", "FALSE"],
    ["True (wrong case)", "True"],
    ["the string 0", "0"],
    ["the string 1", "1"],
    ["yes", "yes"],
    ["no", "no"],
    ["off", "off"],
    ["on", "on"],
    ["the empty string", ""],
    ["whitespace", " "],
    ['" false" with a leading space', " false"],
    ["boolean false", false],
    ["boolean true", true],
    ["the number 0", 0],
    ["null", null],
  ])("rejects %s", (_label, value) => {
    // Rejection is a THROW at boot (`loadServerEnv` raises on `!result.success`), which is
    // the repo's established fail-fast convention. The alternative — resolving an
    // unrecognised value to one of the two positions — is exactly how a safety lever ends
    // up silently in the wrong one.
    expect(parseWith(value).success).toBe(false);
  });
});

describe("the flag never reaches the browser bundle", () => {
  it("is ABSENT from clientEnvSchema's shape", () => {
    expect(Object.keys(clientEnvSchema.shape)).not.toContain("consentEntryGateEnabled");
  });

  it("is stripped by clientEnvSchema even when supplied", () => {
    // The structural half of the claim: `z.object` strips unknown keys, so a value that
    // somehow reached the client parse cannot survive it into the bundle.
    const result = clientEnvSchema.safeParse({
      supabaseUrl: BASE_ENV.supabaseUrl,
      supabaseAnonKey: BASE_ENV.supabaseAnonKey,
      consentEntryGateEnabled: "false",
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data).not.toHaveProperty("consentEntryGateEnabled");
  });

  it("is present on the server schema — the two schemas genuinely differ here", () => {
    // Guards the inverse mistake: a refactor that "tidied" the flag into clientEnvSchema
    // would satisfy the two assertions above only by removing it from the server too.
    expect(Object.keys(serverEnvSchema.shape)).toContain("consentEntryGateEnabled");
  });
});
