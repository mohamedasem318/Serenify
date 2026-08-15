/**
 * Feature 014 — the deterministic selection engine (T008;
 * `contracts/selection-engine.md`, research R-10, spec FR-002/FR-003/FR-005/FR-007).
 *
 * PURE, and deliberately boring. No model chooses the item (FR-002). There is no
 * `Date.now()` here and no `Math.random()`: the clock arrives as `nowMs` and everything
 * else arrives as data, so identical inputs produce an identical pick in 100% of runs
 * (SC-001). The determinism property test in `engine.test.ts` is what holds that line.
 *
 * The engine can only ever return a member of the library it was passed, so crisis
 * content is unreachable BY CONSTRUCTION rather than by a filter someone could delete
 * (FR-007). It also never touches band DISPLAY names ("Calm"/"Uneasy"/"Tense" live in
 * `lib/bands.ts` for the UI) — only the internal enum `at_ease` / `a_little_tense` /
 * `tense` crosses this boundary, per the contract's Boundaries section.
 *
 * ── What this module is NOT responsible for ─────────────────────────────────────────
 * Episode lifecycle — when an episode starts, when it ends, and what `picksUsed` is —
 * belongs to the caller-side reducer (`episode.ts`, T009). The engine only consumes
 * `episode.picksUsed`. It also does no `local_day` filtering: `dayBands` and
 * `todayHistory` are already today's, filtered by the reducer (FR-019).
 */

import type { PreferenceSource } from "@/lib/recommendations/preference-source";
import { NEUTRAL_AFFINITY } from "@/lib/recommendations/preference-source";
import type { LibraryItem, RecommendationCategory } from "@/lib/recommendations/library";
import { RECOMMENDATION_CATEGORIES } from "@/lib/recommendations/library";
import type { Band } from "@/lib/api/monitoring-client";

// ─────────────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────────────

/** One of today's readings, as the engine needs it: internal band enum + when. */
export interface DayBandReading {
  band: Band;
  atMs: number;
}

/** The outcome answer as persisted (`recommendation_picks.outcome`). */
export type PickOutcome = "helped" | "didnt_help";

/**
 * One of today's pick rows, reduced to what selection actually reads (the contract's
 * "item_id, category, opened/swapped/outcome flags"). The reducer projects its fuller DB
 * row shape onto this, so the engine never sees a timestamp it has no business comparing.
 */
export interface PickHistoryEntry {
  itemId: string;
  category: RecommendationCategory;
  /** The engagement record (FR-015) — opening an item is what "tried" means. */
  opened: boolean;
  /** The preference signal, distinct from an outcome (FR-017). */
  swappedAway: boolean;
  outcome: PickOutcome | null;
}

/** The open episode as the engine sees it — an id to attribute the pick to, and a count. */
export interface EngineEpisode {
  id: string;
  picksUsed: number;
}

export interface SelectPickInput {
  /** Today's readings (already `local_day`-filtered by the reducer). */
  dayBands: readonly DayBandReading[];
  /** Injected clock — NEVER read inside this module (contract §Signature). */
  nowMs: number;
  /** Today's pick rows (already `local_day`-filtered by the reducer). */
  todayHistory: readonly PickHistoryEntry[];
  /** The open episode, or `null` when none is open yet. */
  episode: EngineEpisode | null;
  /** v1 always passes `neutralPreferenceSource` (R-8, FR-006). */
  preferences: PreferenceSource;
  /** The reviewed in-repo library. `readonly` — `RECOMMENDATION_LIBRARY` is frozen by type. */
  library: readonly LibraryItem[];
  /**
   * The id to open a NEW episode with, when `episode` is `null`.
   *
   * WHY THIS EXISTS (judgement call, documented rather than hidden): the contract's return
   * type names a non-optional `episodeId`, while `episode` may be `null` — and a pure
   * function cannot mint a uuid. So the id is *injected*, exactly as `nowMs` is, keeping
   * the "no randomness, no clock reads" rule intact. Episode ids are client-generated at
   * episode start (data-model §2), so the reducer — which is the only thing that knows an
   * episode is starting — is the right place for it to come from.
   *
   * With `episode === null` and no `newEpisodeId`, the engine returns `null` rather than
   * emitting a pick it cannot attribute. That is a fail-closed choice: `episode_id` is
   * `NOT NULL` in the schema, and a placeholder here would become a corrupt row.
   */
  newEpisodeId?: string;
}

/** A selected pick, and the episode it belongs to. `null` = nothing warranted or available. */
export interface SelectedPick {
  item: LibraryItem;
  episodeId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One shared budget of three picks per episode — the initial pick, each swap, and the
 * state-8 immediate replacement all draw on it (FR-018). Browser-enforced by design: a
 * count cap is not expressible as a unique index, so the DB mirrors only the
 * one-active-pick slice (research R-3, D-11).
 */
export const MAX_PICKS_PER_EPISODE = 3;

/**
 * The floor an affinity multiplier is clamped to. A source returning `0` must not be able
 * to delete a reviewed category from selection entirely — a preference re-orders what is
 * offered first, it never censors content that passed the FR-007/FR-008/FR-009 review.
 */
export const MIN_CATEGORY_AFFINITY = 0.05;

/** The two bands that warrant a pick at all (contract rule 1; `at_ease` never does). */
export const WARRANTING_BANDS: readonly Band[] = ["a_little_tense", "tense"];

/** Peak-band ordering. Only the two elevated tenors ever reach the rule table. */
const BAND_SEVERITY: Record<Band, number> = { at_ease: 0, a_little_tense: 1, tense: 2 };

/** The tenor half of the rule table's key — today's PEAK band, not its latest. */
export type BandTenor = "a_little_tense" | "tense";

/**
 * The time-of-day half of the rule table's key. Nothing here is ever rendered — the app's
 * part-of-day DISPLAY strings live in `lib/api/monitoring-reads.ts` and stay there.
 *
 * The daytime cuts are that module's (`partOfDay`: noon, 17:00, 21:00), deliberately so —
 * two modules disagreeing about when the afternoon starts would be a bug waiting to be
 * noticed by a user. The ONE divergence is the small hours: `partOfDay` has no early-hours
 * bucket, so 02:00 reads as "morning" there. That is fine in a sentence about when a
 * check-in happened and wrong for choosing an activity — "a lap of the floor" is not a
 * 2 a.m. suggestion — so `night` here wraps past midnight to 05:00.
 */
export type TimeOfDaySegment = "morning" | "afternoon" | "evening" | "night";

/** Where the night ends. Below this local hour it is still `night`, not `morning`. */
const MORNING_STARTS_AT_HOUR = 5;

// ─────────────────────────────────────────────────────────────────────────────
// The rule table — DATA, reviewable in the module (contract rule 4)
// ─────────────────────────────────────────────────────────────────────────────

/** One row of the rule table: a (tenor × segment) key and a weight per category. */
export interface CategoryRuleRow {
  tenor: BandTenor;
  segment: TimeOfDaySegment;
  weights: Readonly<Record<RecommendationCategory, number>>;
}

/**
 * Eight rows (2 tenors × 4 time-of-day segments) × five category columns. Weights are a
 * plain 0–100 ordinal — only their ORDER within a row matters, and the spacing is there so
 * a later edit can slot a category between two others without a rewrite.
 *
 * The reasoning, so this is reviewable rather than mysterious:
 *
 *   • **Tense** leans hard on `breathing_grounding` at every hour. It is the shortest path
 *     from "tense" to "doing something about it": needs nothing but a chair, invisible to a
 *     room, and it is the library's own first-declared category for that reason.
 *   • **Uneasy** has room for the slower categories — movement in the morning, a sensory
 *     reset in the screen-heavy afternoon, a break or a conversation in the evening.
 *   • **Night** ranks `connection` last on both tenors: "message one person" and "a few
 *     minutes with someone nearby" assume somebody is around. Never zero, though — the
 *     items are still fine to offer if everything above them is exhausted.
 *   • The `tense`/`afternoon` row carries a DELIBERATE TIE (`movement` and
 *     `taking_a_break`, both 65). Ties are resolved by declared category order
 *     (`RECOMMENDATION_CATEGORIES`), and `engine.test.ts` pins that this tie resolves to
 *     `movement`. It is here so the tiebreak is exercised by real data rather than only by
 *     a synthetic fixture.
 *
 * Affinity from the `PreferenceSource` multiplies these weights; with the v1 neutral
 * source the multiplier is 1 and the table decides alone.
 */
export const CATEGORY_RULE_TABLE: readonly CategoryRuleRow[] = [
  // tenor            segment       breathing_grounding  movement  sensory_reset  taking_a_break  connection
  {
    tenor: "a_little_tense",
    segment: "morning",
    weights: { breathing_grounding: 70, movement: 80, sensory_reset: 60, taking_a_break: 50, connection: 40 },
  },
  {
    tenor: "a_little_tense",
    segment: "afternoon",
    weights: { breathing_grounding: 60, movement: 70, sensory_reset: 80, taking_a_break: 65, connection: 45 },
  },
  {
    tenor: "a_little_tense",
    segment: "evening",
    weights: { breathing_grounding: 55, movement: 60, sensory_reset: 50, taking_a_break: 80, connection: 70 },
  },
  {
    tenor: "a_little_tense",
    segment: "night",
    weights: { breathing_grounding: 75, movement: 55, sensory_reset: 70, taking_a_break: 60, connection: 30 },
  },
  {
    tenor: "tense",
    segment: "morning",
    weights: { breathing_grounding: 90, movement: 70, sensory_reset: 60, taking_a_break: 55, connection: 45 },
  },
  {
    // The deliberate tie: movement 65 === taking_a_break 65 → declared order wins.
    tenor: "tense",
    segment: "afternoon",
    weights: { breathing_grounding: 90, movement: 65, sensory_reset: 70, taking_a_break: 65, connection: 45 },
  },
  {
    tenor: "tense",
    segment: "evening",
    weights: { breathing_grounding: 85, movement: 55, sensory_reset: 50, taking_a_break: 75, connection: 60 },
  },
  {
    tenor: "tense",
    segment: "night",
    weights: { breathing_grounding: 90, movement: 45, sensory_reset: 65, taking_a_break: 60, connection: 25 },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pure derivations (exported so the rules are testable without running the whole engine)
// ─────────────────────────────────────────────────────────────────────────────

/** Whether today's readings warrant a pick at all — contract rule 1. */
export function isPickWarranted(dayBands: readonly DayBandReading[]): boolean {
  return dayBands.some((r) => WARRANTING_BANDS.includes(r.band));
}

/**
 * Today's PEAK band — `null` when there are no readings. Peak, not latest: an episode is
 * one stress event and its response (FR-018), so a single tense reading sets the tenor for
 * the day's suggestions even if the readings since have eased.
 */
export function peakBand(dayBands: readonly DayBandReading[]): Band | null {
  let peak: Band | null = null;
  for (const reading of dayBands) {
    if (peak === null || BAND_SEVERITY[reading.band] > BAND_SEVERITY[peak]) peak = reading.band;
  }
  return peak;
}

/** Local part-of-day for `nowMs`. See `TimeOfDaySegment` for the boundaries and the why. */
export function timeOfDaySegment(nowMs: number): TimeOfDaySegment {
  const hour = new Date(nowMs).getHours();
  if (hour < MORNING_STARTS_AT_HOUR) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

/**
 * The day's non-repeat exclusions (FR-018, data-model §3): item ids opened or swapped away
 * today. It is a DAY rule, not an episode rule — the set survives episode boundaries and
 * clears only at the local day boundary (FR-019), which happens by the reducer handing in
 * a different day's rows, not by anything being cleared.
 */
export function nonRepeatExclusions(todayHistory: readonly PickHistoryEntry[]): ReadonlySet<string> {
  const excluded = new Set<string>();
  for (const entry of todayHistory) {
    if (entry.opened || entry.swappedAway) excluded.add(entry.itemId);
  }
  return excluded;
}

/** Sanitise an affinity multiplier. Never throws — a bad source degrades to neutral (FR-030). */
function safeAffinity(preferences: PreferenceSource, category: RecommendationCategory): number {
  let raw: number;
  try {
    raw = preferences.categoryAffinity(category);
  } catch {
    return NEUTRAL_AFFINITY;
  }
  if (!Number.isFinite(raw) || raw < 0) return NEUTRAL_AFFINITY;
  return Math.max(raw, MIN_CATEGORY_AFFINITY);
}

/** Look up a rule row. Total over the key space — the eight rows cover every combination. */
function ruleRow(tenor: BandTenor, segment: TimeOfDaySegment): CategoryRuleRow {
  const row = CATEGORY_RULE_TABLE.find((r) => r.tenor === tenor && r.segment === segment);
  // Unreachable while the table stays 2×4; the fallback keeps the engine total rather than
  // letting a future table edit throw on a surface that must never show an error (FR-030).
  return row ?? CATEGORY_RULE_TABLE[0]!;
}

/**
 * Rank all five categories for a (tenor, segment), weighted by affinity, ties broken by
 * declared order. Returns every category — the caller falls through the ranking until a
 * category yields an eligible item (contract rule 5).
 */
export function rankCategories(
  tenor: BandTenor,
  segment: TimeOfDaySegment,
  preferences: PreferenceSource,
): readonly RecommendationCategory[] {
  const { weights } = ruleRow(tenor, segment);
  return RECOMMENDATION_CATEGORIES.map((category, declaredIndex) => ({
    category,
    declaredIndex,
    score: weights[category] * safeAffinity(preferences, category),
  }))
    .sort((a, b) => (b.score - a.score) || (a.declaredIndex - b.declaredIndex))
    .map((entry) => entry.category);
}

// ─────────────────────────────────────────────────────────────────────────────
// The engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Select the one item to surface, or `null` when none is warranted or available.
 *
 * Rules run in the contract's order, and the order is load-bearing — non-repeat is
 * evaluated AFTER the budget but WINS over it in effect, because exhausting the eligible
 * items returns `null` while the budget still had room. That is FR-018's "when the
 * non-repeat rule leaves too few eligible items to honour the budget, the non-repeat rule
 * wins and the swap retires early".
 */
export function selectPick(input: SelectPickInput): SelectedPick | null {
  const { dayBands, nowMs, todayHistory, episode, preferences, library } = input;

  // Rule 1 — warrant. No Uneasy/Tense reading today → nothing to suggest; the card renders
  // state 1 (no reading) or state 2 (calm) instead.
  if (!isPickWarranted(dayBands)) return null;

  // The episode to attribute the pick to. Fail closed rather than emit an unattributable
  // pick — see `newEpisodeId` above.
  const episodeId = episode?.id ?? input.newEpisodeId;
  if (episodeId === undefined) return null;

  // Rule 2 — budget. Three surfaced picks per episode, shared by the initial pick, every
  // swap, and the state-8 replacement (FR-018). `picksUsed` counts SURFACED ROWS, never
  // stamps: a swapped-away pick with no successor row charges nothing beyond its own slot
  // (Amendment 2026-08-16 — a person must not lose a suggestion to a failed write).
  const picksUsed = episode?.picksUsed ?? 0;
  if (picksUsed >= MAX_PICKS_PER_EPISODE) return null;

  // Rule 3 — non-repeat, all day, regardless of budget.
  const excluded = nonRepeatExclusions(todayHistory);
  const eligible = library.filter((item) => !excluded.has(item.id));
  if (eligible.length === 0) return null;

  // Rule 4 — category ranking. Warrant guarantees the peak band is one of the two elevated
  // tenors, so the `?? "a_little_tense"` is unreachable and exists only to keep the
  // function total.
  const peak = peakBand(dayBands);
  const tenor: BandTenor = peak === "tense" ? "tense" : "a_little_tense";
  const ranked = rankCategories(tenor, timeOfDaySegment(nowMs), preferences);

  // Rule 5 — first eligible item in declared order within the category; a category
  // exhausted by the day's exclusions falls through to the next ranked one.
  for (const category of ranked) {
    const item = eligible.find((candidate) => candidate.category === category);
    if (item) return { item, episodeId };
  }

  // Every ranked category was exhausted. Reachable only if `eligible` holds items whose
  // category is outside `RECOMMENDATION_CATEGORIES`, which the library's type forbids.
  return null;
}
