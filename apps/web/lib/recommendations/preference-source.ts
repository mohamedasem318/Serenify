/**
 * Feature 014 — the preference seam (T007; data-model §5, research R-8, FR-006).
 *
 * The engine never asks "what does this person like?" directly. It asks a `PreferenceSource`,
 * and v1 always hands it the neutral one. That is the whole point: feature 015 replaces the
 * SOURCE — a module implementing this one-method interface over the person's own recorded
 * outcomes and swaps — and the engine is not edited at all. `engine.test.ts` proves this by
 * ranking with a fake non-neutral source and observing the ranking change with zero engine
 * changes; if that test ever needs an engine edit to pass, the seam has been lost.
 *
 * PURE. No clock, no storage, no network, no `server-only` — the same posture as
 * `library.ts`, so Vitest loads it directly.
 *
 * Mirrors the shape of 012's `shouldOfferSessionEndFeedback` sampling seam: an injected
 * decision function with a boring default, rather than a flag the caller has to remember.
 */

import type { RecommendationCategory } from "@/lib/recommendations/library";

/**
 * How much a person leans toward a category, as a MULTIPLIER over the engine's rule-table
 * weight (`engine.ts` — `CATEGORY_RULE_TABLE`). It is a weight, never a veto:
 *
 *   • `1` is neutral — the rule table decides alone.
 *   • `> 1` leans toward the category; `< 1` leans away.
 *   • `0` would silently delete a category from selection, so the engine floors the value
 *     at `MIN_CATEGORY_AFFINITY` (see `engine.ts`). Content that was reviewed as safe to
 *     offer stays offerable; a preference re-orders, it does not censor.
 *
 * A non-finite or negative return is treated as neutral by the engine rather than throwing
 * (FR-030: nothing on this surface renders as an error).
 */
export interface PreferenceSource {
  categoryAffinity(category: RecommendationCategory): number;
}

/** The neutral multiplier — every category weighted exactly as the rule table states it. */
export const NEUTRAL_AFFINITY = 1;

/**
 * The v1 source (R-8): constant affinity for every category. It is a frozen singleton so
 * that a caller cannot accidentally mutate the default out from under the engine, and so
 * two calls in the same render are the same object (SC-001 determinism is about the
 * returned VALUES, but a stable identity makes memoisation honest too).
 */
export const neutralPreferenceSource: PreferenceSource = Object.freeze({
  // The parameter is deliberately not declared: "neutral" means the category is not read,
  // and an unused-but-named argument would only invite someone to start reading it.
  categoryAffinity(): number {
    return NEUTRAL_AFFINITY;
  },
});
