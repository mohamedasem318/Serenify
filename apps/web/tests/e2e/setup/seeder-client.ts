if (process.env.NODE_ENV === "production") {
  throw new Error("seeder client must never run in production");
}

import { createHmac } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The purpose-made seeding identity (#208, Option B — DECISIONS 2026-08-14).
 *
 * Table writes for test fixtures and the seed scripts run as the Postgres role
 * `serenify_seeder`, whose reach is exactly the enumerated grants in
 * supabase/migrations/20260814000000_seeding_identity.sql — NOT as
 * service_role, which holds no table DML on this project and must not gain any
 * for a test convenience. service_role remains in use ONLY for GoTrue auth
 * admin calls (create/list/delete users); see admin-client.ts.
 *
 * HOW THE IDENTITY IS CARRIED — deliberately not a secret. The Supabase CLI
 * signs every local stack's tokens with one fixed, public dev secret (the
 * committed demo anon/service keys are HS256 over that same secret; the unit
 * test tests/unit/seeder-identity.test.ts proves the byte-identical
 * derivation). So this module SIGNS the seeder JWT at runtime instead of
 * reading it from anywhere: there is no env var, no documented handshake, and
 * nothing to leak — the token validates against local stacks ONLY, because
 * every deployed project has its own secret. Reaching a deployed database
 * would additionally require `GRANT serenify_seeder TO authenticator` there,
 * which only supabase/seed.sql issues, and seeds never ship via `db push`.
 *
 * The localhost guard below is therefore belt-and-braces, matching
 * global-setup's own refusal to run against anything remote.
 */

/** The Supabase CLI's fixed local-development JWT secret. Public by design. */
const LOCAL_DEV_JWT_SECRET =
  "super-secret-jwt-token-with-at-least-32-characters-long";

/** The Postgres role every fixture/seed table write runs as. */
export const SEEDING_ROLE = "serenify_seeder";

const base64url = (input: string | Buffer): string =>
  Buffer.from(input).toString("base64url");

/**
 * HS256-sign a local-stack JWT for the given role. Payload mirrors the CLI's
 * demo tokens exactly (`iss: supabase-demo`, same fixed expiry) so
 * signLocalDevJwt("anon") reproduces the committed demo anon key
 * byte-for-byte — which is also the proof that the secret above is the one
 * the local stack verifies against.
 */
export function signLocalDevJwt(role: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({ iss: "supabase-demo", role, exp: 1983812996 }),
  );
  const signature = createHmac("sha256", LOCAL_DEV_JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export function assertLocalSupabaseUrl(url: string, caller: string): void {
  if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
    throw new Error(
      `${caller}: refusing a non-local Supabase URL ("${url}"). The seeding ` +
        `identity exists only on local stacks (supabase/seed.sql enables it; ` +
        `#208 / DECISIONS 2026-08-14) — seeding a deployed project requires ` +
        `its own deliberate enablement and is not wired up.`,
    );
  }
}

/**
 * Supabase client whose PostgREST requests run as `serenify_seeder`.
 *
 * The Authorization bearer carries the seeder JWT; the apikey header only has
 * to satisfy the local gateway's key check, so it is the (equally public,
 * runtime-derived) local anon token. Auth methods on this client are useless
 * by construction — GoTrue does not recognise the seeder role — which keeps
 * the auth-admin capability and the table-write capability on visibly
 * separate identities.
 */
export function createSeederClient(
  url: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
): SupabaseClient {
  assertLocalSupabaseUrl(url, "createSeederClient");
  return createClient(url, signLocalDevJwt("anon"), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${signLocalDevJwt(SEEDING_ROLE)}` },
    },
  });
}
