# Data model — 014-recommendations

**Date**: 2026-08-14 · **Decisions**: research.md R-1/R-2/R-3 · **RLS contract**:
[contracts/recommendation-storage-rls.md](contracts/recommendation-storage-rls.md)

## 1. Library item (in-repo, not a table)

`apps/web/lib/recommendations/library.ts` — reviewed constants (research R-1).

```ts
type RecommendationCategory =
  | "breathing_grounding" | "movement" | "sensory_reset"
  | "taking_a_break" | "connection";          // load-bearing, fixed (FR-004/FR-005)

interface LibraryItem {
  id: string;                 // stable slug, e.g. "box-breathing" — stored in pick rows
  category: RecommendationCategory;
  title: string;              // verbatim, never generated
  whyLine: string;            // the one-line "why" under the title (mock item-why)
  durationLabel: string;      // e.g. "2 min" (mock dur pill)
  steps: string[];            // the expanded instructions, verbatim
  footNote?: string;          // optional italic closing line (mock steps-foot)
}
```

Declared order of categories and of items within a category is part of the deterministic
contract (engine tiebreak, R-10). v1: 5 categories × 3 items = 15. Per-category count may
grow without a spec change; the category set may not.

## 2. `recommendation_picks` — the only new table

One row per surfaced pick (initial pick, swap replacement, or state-8 replacement).
Owner-private. Migration `supabase/migrations/<ts>_recommendation_picks.sql`.

| column | type | notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `user_id` | `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` | |
| `local_day` | `date NOT NULL` | client-computed from today-card day semantics (`localDayWindow`); `iso_week_start` precedent |
| `episode_id` | `uuid NOT NULL` | client-generated at episode start; shared across the episode's picks (FR-018) |
| `item_id` | `text NOT NULL CHECK (item_id ~ '^[a-z0-9-]{1,64}$')` | library slug; no FK — the library is in-repo |
| `category` | `text NOT NULL CHECK (category IN (…5 values…))` | denormalised for 015's category-level reads (FR-005) |
| `source` | `text NOT NULL CHECK (source IN ('reading','confirmed'))` | what warranted the pick when first surfaced |
| `suggested_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `confirmed_at` | `timestamptz` | set when a confirmed detection attaches (state 3 → 4; prominence only) |
| `opened_at` | `timestamptz` | **the engagement record** (FR-015); set once |
| `outcome` | `text CHECK (outcome IN ('helped','didnt_help'))` | FR-016/FR-017 |
| `outcome_at` | `timestamptz` | |
| `swapped_away_at` | `timestamptz` | the preference signal, distinct from outcome (FR-017) |
| `created_at` / `updated_at` | `timestamptz NOT NULL DEFAULT now()` | `touch_updated_at` trigger |

**CHECK constraints** (lifecycle is linear per pick):

- `rp_outcome_iff_at` — `(outcome IS NULL) = (outcome_at IS NULL)`
- `rp_outcome_requires_opened` — `outcome IS NULL OR opened_at IS NOT NULL`
  (the outcome prompt exists only after opening, FR-016)
- `rp_outcome_xor_swap` — `NOT (outcome IS NOT NULL AND swapped_away_at IS NOT NULL)`
  (a pick is answered or swapped away, never both)

**Indexes**:

- `rp_user_day_idx` on `(user_id, local_day, suggested_at DESC)` — the card's daily read.
- `rp_one_active_per_user_day` **partial unique** on `(user_id, local_day)`
  `WHERE outcome IS NULL AND swapped_away_at IS NULL` — DB backstop for exactly one item at
  a time (FR-003). The three-per-episode count budget is browser-enforced only (research
  R-3; a count cap is not expressible as a unique index — same posture as 012's #127
  browser budget, and the same lesson as D-11: the DB mirrors exactly the slice an index
  can state).

**RLS / grants** (the 011 `chat_conversations` shape, verbatim posture):

- `ENABLE` + `FORCE ROW LEVEL SECURITY`.
- Owner-only policies: `SELECT` / `INSERT` / `UPDATE` with
  `(select auth.uid()) = user_id`; **no DELETE policy, no manager, no admin, no team-lead,
  no aggregate, no service-role policy of any kind** (FR-025, SC-003).
- `REVOKE ALL … FROM anon, authenticated`, then `GRANT SELECT, INSERT ON … TO
  authenticated` plus **column-scoped** `GRANT UPDATE (confirmed_at, opened_at, outcome,
  outcome_at, swapped_away_at, updated_at)` — identity and provenance columns (`user_id`,
  `local_day`, `episode_id`, `item_id`, `category`, `source`, `suggested_at`) are
  immutable after insert by grant, not just by convention.
- `service_role` needs no thought experiment here: on this project's default privileges it
  holds **no DML on any public table** (`pg_default_acl`; recorded in
  `20260814000000_seeding_identity.sql`'s header and DECISIONS 2026-08-14), so there is no
  service-role path to close and none may be added.

**Retention**: ninety days, as **policy not mechanism** (FR-027) — no purge job exists or
is promised; the Privacy Policy states it (plan §Legal). The record is derived from a
reading and must not outlive its parent's stated period.

## 3. Derived state (never stored)

| concept | derivation |
|---|---|
| Active pick | today's row with `outcome IS NULL AND swapped_away_at IS NULL` (≤1 by index) |
| Card state 3 vs 4 | active pick with `confirmed_at IS NULL` vs `NOT NULL` |
| Episode budget remaining | `3 − count(rows WHERE episode_id = current)` (browser reducer) |
| Non-repeat exclusions | today's rows with `opened_at IS NOT NULL OR swapped_away_at IS NOT NULL` → their `item_id`s (FR-018) |
| Episode open/closed | episode's latest pick has no outcome → open; outcome recorded (and no replacement taken) or day boundary → closed |
| State 9 "what was tried" | today's rows with `opened_at`, most recent outcome |
| Day reset (FR-019) | nothing to clear — every read is filtered by `local_day = today` (query-time reset, the today-card pattern) |

## 4. Reflective copy facts (transient contract, not stored)

The only material the generator may phrase (FR-020/FR-023):

```ts
interface ReflectiveFacts {
  state: 2 | 9;
  checkinCount: number;         // real count from the person's own readings
  times: string[];              // preformatted clock strings, e.g. "9:40"
  bandLabels: string[];         // display labels only: "Calm" | "Uneasy" | "Tense"
  triedItemTitle?: string;      // state 9: the opened item's title, verbatim
  triedAtLabel?: string;        // state 9: preformatted time
  fallbackText: string;         // the deterministic string — the source of truth
}
```

No raw readings, no probabilities, no chat content, no user name. The generated text is
cached in `sessionStorage` keyed by a fingerprint of `(state, facts, local_day)` (R-4) —
it is never written to the database.

## 5. Preference source (seam for 015)

```ts
interface PreferenceSource {
  categoryAffinity(category: RecommendationCategory): number; // v1: constant
}
```

`neutralPreferenceSource` ships in v1; 015 replaces the module behind the interface, not
the engine (FR-006, R-8).
