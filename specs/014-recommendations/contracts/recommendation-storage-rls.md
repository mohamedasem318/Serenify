# Contract — recommendation storage & RLS

**Table**: `public.recommendation_picks` (shape: [data-model.md](../data-model.md) §2)
**Posture**: the 011 chat-storage posture (`20260628000000_chat_conversations_messages.sql`),
owner-only, structural.

## Invariants (SC-003 tests pin every line)

1. `ENABLE` + `FORCE ROW LEVEL SECURITY` on the table.
2. Exactly three policies, all `TO authenticated`, all `(select auth.uid()) = user_id`:
   owner SELECT, owner INSERT (WITH CHECK), owner UPDATE (USING + WITH CHECK).
3. **No** DELETE policy. **No** manager, admin, team-lead, aggregate, RPC, or
   service-role policy. No SECURITY DEFINER function touches this table.
4. `REVOKE ALL FROM anon, authenticated` first; re-grant only `SELECT, INSERT` table-wide
   and `UPDATE` **column-scoped** to
   `(confirmed_at, opened_at, outcome, outcome_at, swapped_away_at, updated_at)`.
   `anon` ends with nothing.
5. `serenify_seeder` gets grants/policies **only if** a seed script or e2e fixture
   demonstrably writes picks; each grant enumerated in its own migration (the #208/#268
   rule). Not anticipated for v1 — omit unless a fixture proves the need.
6. `service_role`: no grant of any kind. Note for reviewers: on this project's
   `pg_default_acl`, service_role already holds no DML on any public table — this contract
   forbids adding any.

## Write paths (all as the signed-in user, forwarded JWT + anon key)

| action | write |
|---|---|
| pick surfaced (initial / swap replacement / state-8 replacement) | INSERT full row |
| confirmed detection attaches | UPDATE `confirmed_at` |
| item expanded first time | UPDATE `opened_at` (set once; client guards re-set) |
| outcome answered | UPDATE `outcome`, `outcome_at` — **retry once** on failure, then degrade silently (FR-030) |
| swapped away | UPDATE `swapped_away_at` — **no retry**, degrade silently to the previous pick (FR-030) |
| ignored outcome prompt | **no write** (FR-016) |

## Verification

- Static SQL-parse pytest gate (existing migration-audit pattern) + live RLS probe via
  `SET LOCAL ROLE` / `request.jwt.claims` impersonation (the feature-012 validated
  method): owner sees own rows; a second user, a team-lead, and an admin each read zero
  rows; anon errors; UPDATE on an identity column (e.g. `item_id`) fails on grant.
