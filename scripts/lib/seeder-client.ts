if (process.env.NODE_ENV === "production") {
  throw new Error("seeder client must never run in production");
}

import type { SupabaseClient } from "@supabase/supabase-js";

// Canonical implementation lives with the e2e harness — same identity, same
// runtime-derived local token; see that module for the full design record
// (#208, DECISIONS 2026-08-14). scripts/ importing from apps/web follows the
// existing seed-demo → consent-registry precedent.
import { createSeederClient } from "../../apps/web/tests/e2e/setup/seeder-client.js";

import type { Target } from "./env.js";

/**
 * Table-writing client for the seed scripts: PostgREST as `serenify_seeder`,
 * the purpose-made seeding identity whose grants are enumerated in
 * supabase/migrations/20260814000000_seeding_identity.sql.
 *
 * LOCAL TARGETS ONLY. The identity is only assumable where supabase/seed.sql
 * has run (local resets), and its token only validates against the CLI's
 * public dev secret — so a remote target cannot work and is refused loudly
 * instead of failing mid-run after auth users were already created.
 */
export function createSeederClientFor(target: Target): SupabaseClient {
  if (target.kind !== "local") {
    throw new Error(
      "Seeding a remote project is not supported: table writes run as the " +
        "purpose-made local seeding identity (#208, DECISIONS 2026-08-14). " +
        "Enabling it on a deployed project is a separate deliberate act and " +
        "is not wired up.",
    );
  }
  return createSeederClient(target.url);
}
