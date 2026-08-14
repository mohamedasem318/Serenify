import { describe, expect, it } from "vitest";

import {
  SEEDING_ROLE,
  createSeederClient,
  signLocalDevJwt,
} from "../e2e/setup/seeder-client";

/**
 * The seeding identity's token is DERIVED at runtime, not stored (#208). These
 * tests pin the two facts that make that safe and workable:
 *
 *  1. The signer reproduces the Supabase CLI's committed demo anon key
 *     byte-for-byte — proving the fixed secret in seeder-client.ts is exactly
 *     the one every local stack verifies JWTs against, so a serenify_seeder
 *     token signed the same way is accepted locally and NOWHERE else (deployed
 *     projects have their own secrets).
 *  2. The client factory refuses any non-local URL outright.
 */

// The CLI's demo anon key — public by design, committed in Supabase's own
// docs; carries {iss: supabase-demo, role: anon, exp: 1983812996}.
const WELL_KNOWN_LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

describe("seeding identity (serenify_seeder)", () => {
  it("signs with the exact secret local stacks verify against (anon derivation is byte-identical)", () => {
    expect(signLocalDevJwt("anon")).toBe(WELL_KNOWN_LOCAL_ANON_KEY);
  });

  it("mints a token whose role claim is the seeding role", () => {
    const [, payload] = signLocalDevJwt(SEEDING_ROLE).split(".");
    const claims = JSON.parse(Buffer.from(payload!, "base64url").toString());
    expect(claims).toEqual({
      iss: "supabase-demo",
      role: "serenify_seeder",
      exp: 1983812996,
    });
  });

  it("refuses to build a client for anything but a local stack", () => {
    for (const url of [
      "https://excukdzjudslbqmkysrc.supabase.co",
      "https://example.com",
      "",
    ]) {
      expect(() => createSeederClient(url)).toThrow(/refusing a non-local/i);
    }
    expect(() => createSeederClient("http://127.0.0.1:54321")).not.toThrow();
    expect(() => createSeederClient("http://localhost:54321")).not.toThrow();
  });
});
