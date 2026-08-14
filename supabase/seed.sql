-- LOCAL-ONLY enablement of the seeding identity (#208, Option B).
--
-- `supabase db reset --local` runs this file after migrations ([db.seed] in
-- config.toml); `supabase db push` never ships it. That asymmetry is the whole
-- design: the serenify_seeder role and its enumerated grants travel with the
-- migrations (20260814000000_seeding_identity.sql), but the one statement that
-- makes the role ASSUMABLE exists only on local stacks. On the cloud project
-- the role stays inert — PostgREST cannot switch into a role authenticator has
-- not been granted, so no API request can exercise the seeding grants there.
--
-- With this in place a fresh local reset needs NO manual grant of any kind:
-- Playwright's globalSetup and the seed scripts sign a serenify_seeder JWT from
-- the CLI's fixed, public dev secret and write through PostgREST as the seeder
-- (apps/web/tests/e2e/setup/seeder-client.ts).

GRANT serenify_seeder TO authenticator;
