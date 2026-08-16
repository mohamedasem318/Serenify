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
6. `service_role`: an **explicit `REVOKE ALL ON public.recommendation_picks FROM
   service_role`** is REQUIRED, and no grant or policy of any kind may be added.
   **This corrects a disproved claim.** Earlier drafts of this contract said service_role
   "already holds no DML on any public table", so there was nothing to close. That was
   true of the local stack and false of the deploy target. Read live on 2026-08-15 by
   read-only queries against the linked cloud project: `pg_default_acl` there grants
   `postgres`, `anon`, `authenticated` **and** `service_role` full `arwdDxtm` on new
   public tables; every existing public table's `relacl` already carries
   `service_role=arwdDxtm`; and `rolbypassrls = true` for `service_role`. BYPASSRLS
   defeats **RLS** but **not grants** — so invariants 1–3 above constrain that role not at
   all on cloud, and the revoke is the only thing that does. The shipped migration
   (`20260815090000_recommendation_picks.sql`) carries it;
   `test_service_role_is_explicitly_revoked` pins it and
   `test_service_role_is_never_granted_or_given_a_policy` pins the prohibition.
   Full reasoning: `docs/DECISIONS.md` 2026-08-15.
7. **Standing invariant — no admin-key path, ever.** This feature's table is unreachable
   by `service_role`. Every read and every write goes through the end user's own
   authenticated session under RLS (forwarded JWT + publishable anon key). No task,
   fixture, endpoint, script, or migration may introduce an admin-key, service-key, or
   other privileged path to this data — not for convenience, not for a test, not for an
   admin screen. Widening this requires a spec change, not a judgement call at
   implementation time.

## Write paths (all as the signed-in user, forwarded JWT + anon key)

| action | write |
|---|---|
| pick surfaced (initial / swap replacement / state-8 replacement) | INSERT full row — on a swap this INSERT runs **second**, see the ordering below |
| confirmed detection attaches | UPDATE `confirmed_at` |
| item expanded first time | UPDATE `opened_at` (set once; client guards re-set) |
| outcome answered | UPDATE `outcome`, `outcome_at` — **retry once** on failure, then degrade silently (FR-030) |
| swapped away | UPDATE `swapped_away_at` — **stamped first**, **no retry**; see the ordering below (FR-030) |
| ignored outcome prompt | **no write** (FR-016) |

### Swap write ordering — RULED (Mohamed, 2026-08-15, "Ruling B")

`rp_one_active_per_user_day` is a partial unique index over `(user_id, local_day) WHERE
outcome IS NULL AND swapped_away_at IS NULL`, and the two writes are two separate
PostgREST requests with no transaction spanning them. **Insert-first is therefore
impossible**: the replacement row would collide with the still-active outgoing row. The
ordering is not a preference, it is the only order the index permits.

1. On a swap, stamp the outgoing pick's `swapped_away_at` **first**, then INSERT the
   replacement.
2. If the INSERT fails, **re-run the selection engine once** to refresh the card. The
   engine now sees the declined pick and produces a new one. This is visually
   indistinguishable from a successful swap, because swap has no ceremony — nothing on
   screen announces which of the two paths ran.
3. If that also fails, keep the previous pick on screen and stop. **No retry loop.**
   Nothing renders as an error (FR-030).
4. The stamp is **never reversed.** A swap-away that was recorded stays recorded; the
   preference signal is real regardless of what happened to the replacement.
Point-3 clarification (2026-08-16, found at T028 implementation; flagged for Mohamed):
points 3 and 4 cannot both hold literally on the stamp-landed-but-both-INSERTs-failed
path — once the stamp lands, the outgoing row is retired, and "keep the previous pick on
screen" as the active pick would require reversing the stamp, which point 4 forbids.
Point 4 is the stronger, data-integrity clause and governs. What actually holds, and is
test-pinned: "previous pick stays on screen" applies on the twice-failed-STAMP path
(where the outgoing row is still active and no INSERT is attempted); on the
stamp-landed path there are exactly two insert attempts then silence, the stamp stands,
the card shows the re-run's pick unpersisted (visually indistinguishable from a
successful swap, per point 2's own rationale), and a later mount retries the surface
once through the normal auto-surface path. Nothing renders as an error on either path.

5. **A failed swap does NOT consume a budget slot** (Amendment 2026-08-16, REVERSING the
   position accepted 2026-08-15 — see DECISIONS 2026-08-16). A person must not lose one
   of the episode's three suggestions because a write failed on our side. The stamp still
   stands (points 1 and 4 are unchanged — it is a true preference signal and a non-repeat
   exclusion), but budget consumption counts **replacement rows that actually landed**
   (picks surfaced), never stamps. Consequence for implementers: budget accounting can no
   longer be derived from stamp count alone — the reducer counts the episode's surfaced
   rows, and a stamped pick with no successor row charges nothing.

## Verification

- Static SQL-parse pytest gate (existing migration-audit pattern) + live RLS probe via
  `SET LOCAL ROLE` / `request.jwt.claims` impersonation (the feature-012 validated
  method): owner sees own rows; a second user, a team-lead, and an admin each read zero
  rows; anon errors; UPDATE on an identity column (e.g. `item_id`) fails on grant.
- **The `service_role` revoke (invariant 6) is a pinned invariant, not a review note.**
  The static gate requires the `REVOKE ALL … FROM service_role` statement, requires it to
  precede every GRANT, and allows `service_role` to appear in the migration exactly once —
  in that revoke. Deleting the line, moving it after the grants, re-granting the role, or
  giving it a policy each fail a named test; all four were mutation-verified on
  2026-08-15. Note the live probe cannot cover this: locally `service_role` never had DML
  to begin with, so the revoke's effect is only observable against the cloud ACL.
- The standing no-admin-key invariant (7) is structural rather than test-pinned: there is
  no privileged path to assert the absence of, because none is ever built. A reviewer
  enforces it by rejecting any change that introduces one.
