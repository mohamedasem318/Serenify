-- Recommendation picks — ONE owner-private table, owner-only RLS, no manager/admin
-- path, no service-role path, no seeder path, and NO delete path of any kind.
--   Feature:    014-recommendations (T001)
--   Decisions:  revised D-1 posture (features 008/011/012) — all DB I/O runs AS THE
--               USER via the forwarded JWT + publishable anon key; there is NO
--               service-role key.
--   Data model: specs/014-recommendations/data-model.md §2
--   Contract:   specs/014-recommendations/contracts/recommendation-storage-rls.md
--
-- Privacy is STRUCTURAL (Principle I + the feature-008/011/012 mechanism):
--   * ENABLE + FORCE RLS. FORCE is safe and desirable: every writer is the browser
--     acting as `authenticated` via a forwarded user JWT and is fully subject to
--     RLS; FORCE also blocks any accidental table-owner bypass. There is no
--     server-side write path to exempt.
--   * NO manager / admin / team-lead / aggregate / RPC policy. What a person was
--     offered, whether they opened it, and whether it helped never reaches the
--     manager layer — the same boundary as raw signals and chat content.
--   * NO DELETE policy and NO DELETE grant: a pick row is created, then updated
--     along one linear lifecycle. Nothing removes it. (Retention is ninety days as
--     POLICY not mechanism, FR-027 — no purge job exists or is promised here.)
--   * NO SECURITY DEFINER function touches this table; this migration creates none.
--   * Per-role grants are enumerated explicitly: Supabase grants per role, so
--     `REVOKE … FROM PUBLIC` alone is a no-op (DECISIONS 2026-05-25). We REVOKE ALL
--     from anon + authenticated, then GRANT the precise verbs back to
--     `authenticated` only. anon ends with nothing.
--   * UPDATE is COLUMN-SCOPED. Identity and provenance (user_id, local_day,
--     episode_id, item_id, category, source, suggested_at) are immutable after
--     insert BY GRANT, not merely by convention — only the five lifecycle stamps
--     plus updated_at are updatable.
--   * The purpose-made seeding identity (`serenify_seeder`, #208) gets NOTHING here:
--     no seed script and no Playwright fixture writes picks, and the #208/#268 rule
--     is that every seeder grant traces to a write a fixture demonstrably performs.
--   * `service_role` IS revoked explicitly below, and the reason matters. The
--     2026-08-14 claim that "on this project's default privileges service_role
--     holds no DML on any public table" was true of the LOCAL stack only and was
--     over-generalised; read-only queries against the linked CLOUD project on
--     2026-08-15 disproved it there. On cloud, `pg_default_acl` grants
--     service_role full `arwdDxtm` on new public tables, every existing public
--     table's relacl already carries it, and `rolbypassrls` is true for
--     service_role. BYPASSRLS defeats RLS but NOT grants — so on the deploy
--     target the REVOKE, not the owner-only policies, is the boundary that
--     actually holds. See DECISIONS 2026-08-15 (correction to 2026-08-14).
--
-- IMMUTABILITY: this migration touches no existing table, function, policy or grant.

-- ── recommendation_picks ──────────────────────────────────────────────────
-- One row per SURFACED pick — the initial pick of an episode, a swap replacement,
-- or a state-8 replacement. Opening the item IS the engagement record (opened_at,
-- FR-015); the one outcome question follows (outcome/outcome_at, FR-016); a swap is
-- a DISTINCT signal from "didn't help" (swapped_away_at, FR-017).
--
-- `item_id` carries a library slug and deliberately has NO foreign key: the fifteen
-- reviewed items live in the repo (apps/web/lib/recommendations/library.ts), not in
-- the database. `category` is denormalised alongside it so 015 can read at category
-- level without the library (FR-005).
--
-- `local_day` is client-computed from the today-card day semantics (localDayWindow)
-- — the `iso_week_start` precedent from 012. Every read is filtered by it, so the
-- daily reset (FR-019) is a query-time property with nothing to clear.
CREATE TABLE public.recommendation_picks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The person's own local day, from the today-card boundary. Not a timestamp:
  -- everything about this feature resets at that boundary.
  local_day       date        NOT NULL,
  -- Client-generated at episode start; shared across every pick in the episode so
  -- the three-pick budget can be counted (FR-018). No FK — an episode is a browser
  -- concept, not a row.
  episode_id      uuid        NOT NULL,
  item_id         text        NOT NULL CHECK (item_id ~ '^[a-z0-9-]{1,64}$'),
  category        text        NOT NULL
                    CHECK (category IN ('breathing_grounding', 'movement', 'sensory_reset',
                                        'taking_a_break', 'connection')),
  -- What warranted the pick when it was FIRST surfaced. 'confirmed' means a
  -- confirmatory "Yes, that's me" resolved to it (012 → 014); 'reading' means the
  -- reading alone did.
  source          text        NOT NULL CHECK (source IN ('reading', 'confirmed')),
  suggested_at    timestamptz NOT NULL DEFAULT now(),
  -- Set when a confirmed detection attaches to an already-surfaced pick (card state
  -- 3 → 4). Prominence only — it never changes which item was picked.
  confirmed_at    timestamptz,
  -- THE engagement record (FR-015): set once, when the item is first expanded.
  opened_at       timestamptz,
  outcome         text        CHECK (outcome IN ('helped', 'didnt_help')),
  outcome_at      timestamptz,
  -- The preference signal, deliberately distinct from an outcome of 'didnt_help'
  -- (FR-017): swapping away says "not this one", not "this did not work".
  swapped_away_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- The lifecycle is linear per pick.
  -- An outcome and its timestamp exist together or not at all.
  CONSTRAINT rp_outcome_iff_at CHECK ((outcome IS NULL) = (outcome_at IS NULL)),
  -- The outcome prompt exists only after the item was opened (FR-016).
  CONSTRAINT rp_outcome_requires_opened CHECK (outcome IS NULL OR opened_at IS NOT NULL),
  -- A pick is answered or swapped away — never both.
  CONSTRAINT rp_outcome_xor_swap CHECK (NOT (outcome IS NOT NULL AND swapped_away_at IS NOT NULL))
);

-- The card's daily read: this person, this local day, most recently surfaced first.
CREATE INDEX rp_user_day_idx
  ON public.recommendation_picks (user_id, local_day, suggested_at DESC);

-- DB backstop for "exactly one item at a time" (FR-003): at most one pick per person
-- per local day may still be active (no outcome, not swapped away).
--
-- The three-picks-per-episode COUNT budget is browser-enforced only and is
-- deliberately absent here: a count cap is not expressible as a unique index
-- (research R-3). Same posture as 012's #127 browser budget, and the same lesson as
-- D-11 — the DB mirrors exactly the slice an index can state, and no more.
CREATE UNIQUE INDEX rp_one_active_per_user_day
  ON public.recommendation_picks (user_id, local_day)
  WHERE outcome IS NULL AND swapped_away_at IS NULL;

CREATE TRIGGER rp_touch_updated_at
  BEFORE UPDATE ON public.recommendation_picks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS — ENABLE + FORCE ──────────────────────────────────────────────────
ALTER TABLE public.recommendation_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_picks FORCE  ROW LEVEL SECURITY;

-- Exactly three policies, all owner-self. `(select auth.uid())` (not bare
-- auth.uid()) per current Supabase guidance — the initplan is cached once per
-- statement. There is NO fourth policy: no DELETE, no manager, no admin, no
-- team-lead, no aggregate, no service-role, no seeder (Principle I; contract §2–3).
CREATE POLICY rp_select_self ON public.recommendation_picks
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY rp_insert_self ON public.recommendation_picks
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY rp_update_self ON public.recommendation_picks
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ── Per-role grants (explicit; PUBLIC/table-level revoke alone is a no-op) ──
REVOKE ALL ON public.recommendation_picks FROM anon, authenticated;
-- And from service_role. On the CLOUD project (verified 2026-08-15) pg_default_acl
-- would otherwise hand it full arwdDxtm on this new table, and cloud service_role has
-- rolbypassrls — which bypasses RLS but NOT grants, so this revoke is the only thing
-- that closes the path. Locally it drops only the non-DML `Dxtm` baseline
-- (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) that the default ACL hands out and that no
-- code path here uses. Verified after `db reset`: the table's relacl ends as
-- `postgres=arwdDxtm/postgres` + `authenticated=ar/postgres`, nothing else.
-- DECISIONS 2026-08-15.
REVOKE ALL ON public.recommendation_picks FROM service_role;

-- No server-only columns here, so SELECT is a plain table grant: the owner reads
-- every column of their own rows. INSERT is table-wide because the whole row is
-- written at once when a pick is surfaced.
GRANT SELECT, INSERT ON public.recommendation_picks TO authenticated;

-- UPDATE is COLUMN-SCOPED to the lifecycle stamps only. Rewriting user_id,
-- local_day, episode_id, item_id, category, source or suggested_at is refused by
-- the grant, so a pick can never be retargeted at a different item, day, episode or
-- person after the fact. `updated_at` is listed because the trigger owns it and a
-- client that echoes it back must not fail on privilege.
GRANT UPDATE (confirmed_at, opened_at, outcome, outcome_at, swapped_away_at, updated_at)
  ON public.recommendation_picks TO authenticated;

-- anon ends with nothing: revoked above, never re-granted.
