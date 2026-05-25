import { describe, it, expect } from "vitest";

import { clientEnvSchema, serverEnvSchema } from "@/lib/env/schema";

// Supabase keys are JWTs (~150+ chars). The schema enforces shape/length only,
// not cryptographic validity — a 120-char filler is a valid stand-in. The real
// prefix-discipline guarantee comes from WHERE each var is read (serverEnv lives
// in a `server-only` module), not from a runtime refinement here.
const fakeKey = "a".repeat(120);
const validUrl = "http://127.0.0.1:54321";

describe("clientEnvSchema", () => {
  it("parses a valid public env", () => {
    const parsed = clientEnvSchema.parse({
      supabaseUrl: validUrl,
      supabaseAnonKey: fakeKey,
    });
    expect(parsed.supabaseUrl).toBe(validUrl);
    expect(parsed.supabaseAnonKey).toBe(fakeKey);
  });

  it("rejects a malformed supabaseUrl", () => {
    expect(() =>
      clientEnvSchema.parse({ supabaseUrl: "not-a-url", supabaseAnonKey: fakeKey }),
    ).toThrow();
  });

  it("rejects a too-short key", () => {
    expect(() =>
      clientEnvSchema.parse({ supabaseUrl: validUrl, supabaseAnonKey: "short" }),
    ).toThrow();
  });
});

describe("serverEnvSchema", () => {
  it("parses a valid server env including the service-role key", () => {
    const parsed = serverEnvSchema.parse({
      supabaseUrl: validUrl,
      supabaseAnonKey: fakeKey,
      supabaseServiceRoleKey: fakeKey,
    });
    expect(parsed.supabaseServiceRoleKey).toBe(fakeKey);
  });

  it("throws when supabaseServiceRoleKey is missing", () => {
    expect(() =>
      serverEnvSchema.parse({ supabaseUrl: validUrl, supabaseAnonKey: fakeKey }),
    ).toThrow();
  });

  it("defaults siteUrl to localhost when unset", () => {
    const parsed = serverEnvSchema.parse({
      supabaseUrl: validUrl,
      supabaseAnonKey: fakeKey,
      supabaseServiceRoleKey: fakeKey,
    });
    expect(parsed.siteUrl).toBe("http://localhost:3000");
  });

  it("rejects a malformed siteUrl", () => {
    expect(() =>
      serverEnvSchema.parse({
        supabaseUrl: validUrl,
        supabaseAnonKey: fakeKey,
        supabaseServiceRoleKey: fakeKey,
        siteUrl: "not-a-url",
      }),
    ).toThrow();
  });
});
