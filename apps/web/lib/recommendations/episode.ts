/**
 * Feature 014 — the episode / budget / non-repeat reducer (T009; spec FR-001, FR-013…
 * FR-019, FR-030, FR-031; research R-3; `contracts/confirmatory-resolution.md`).
 *
 * PURE, like the engine it drives. Given today's pick rows, today's band readings and the
 * card's in-flight UI flags, this module derives WHICH OF THE TEN STATES the card is in,
 * how much of the episode's shared three-pick budget is left, which items the day's
 * non-repeat rule has retired, and — when a fresh pick is warranted — what the engine
 * chose. Nothing here reads a clock, a store, or the network; `nowMs` and `newEpisodeId`
 * are injected exactly as they are for the engine.
 *
 * ── Two rules that are easy to get subtly wrong, stated up front ─────────────────────
 *
 * **Budget consumption counts SURFACED ROWS, never stamps** (Amendment 2026-08-16,
 * reversing the 2026-08-15 position; `contracts/recommendation-storage-rls.md` §Swap write
 * ordering point 5). `picksUsed = count(today's rows WHERE episode_id = current)` — exactly
 * the data-model §3 derivation. So a pick that was stamped `swapped_away_at` and whose
 * replacement INSERT never landed charges its own slot and nothing more: the person does
 * not lose one of the episode's three suggestions because a write failed on our side. The
 * stamp still stands as a real preference signal and a real non-repeat exclusion.
 *
 * **Day reset is filtering, not clearing** (FR-019). There is no reset routine and no state
 * to purge: every derivation below starts by filtering to `localDay`, which is the
 * today-card day semantics (`localDayWindow` — local midnight to local midnight). Hand this
 * reducer tomorrow's `localDay` and the budget, the exclusions, the episode and the outcome
 * prompt are all gone at once, because none of them was ever stored anywhere else.
 */

import type { Band } from "@/lib/api/monitoring-client";
import type { LibraryItem, RecommendationCategory } from "@/lib/recommendations/library";
import {
  MAX_PICKS_PER_EPISODE,
  WARRANTING_BANDS,
  isPickWarranted,
  nonRepeatExclusions,
  selectPick,
  type EngineEpisode,
  type PickHistoryEntry,
  type PickOutcome,
  type SelectedPick,
} from "@/lib/recommendations/engine";
import type { PreferenceSource } from "@/lib/recommendations/preference-source";

// ─────────────────────────────────────────────────────────────────────────────
// Row and event shapes
// ─────────────────────────────────────────────────────────────────────────────

/** What warranted the pick when it was first surfaced (`recommendation_picks.source`). */
export type PickSource = "reading" | "confirmed";

/**
 * One `recommendation_picks` row as the browser holds it — the data-model §2 shape with
 * timestamps parsed to epoch milliseconds, so every comparison in this module is a number
 * comparison and no `Date` parsing happens twice.
 */
export interface PickRow {
  id: string;
  localDay: string;
  episodeId: string;
  itemId: string;
  category: RecommendationCategory;
  source: PickSource;
  suggestedAtMs: number;
  confirmedAtMs: number | null;
  openedAtMs: number | null;
  outcome: PickOutcome | null;
  outcomeAtMs: number | null;
  swappedAwayAtMs: number | null;
}

/** One of the day's readings. `localDay` is derived here, not supplied — see FR-019 above. */
export interface BandReading {
  band: Band;
  atMs: number;
}

/**
 * The card's in-flight UI facts — the third input alongside rows and readings. None of
 * these is persisted; all of them vanish on reload, which is correct: the outcome prompt is
 * ignorable at no cost (FR-016) and an ignored prompt must not resurrect itself as a
 * record.
 */
export interface CardUiState {
  /** The item's instructions are expanded (state 5). Swap and Ren actions are withdrawn. */
  instructionsOpen: boolean;
  /** The instructions were opened and then closed — FR-031's precondition for the prompt. */
  instructionsClosedAfterOpening: boolean;
  /** The prompt was ignored/dismissed without an answer (FR-016 — records NOTHING). */
  outcomePromptIgnored: boolean;
  /** An answer given this session, still inside its acknowledgement dwell (states 7/8). */
  acknowledgement: PickOutcome | null;
  /** A swap is being applied right now (state 10 — no acknowledgement, no ceremony). */
  swapInFlight: boolean;
}

/** The resting UI: nothing open, nothing pending, nothing acknowledged. */
export const IDLE_CARD_UI: CardUiState = Object.freeze({
  instructionsOpen: false,
  instructionsClosedAfterOpening: false,
  outcomePromptIgnored: false,
  acknowledgement: null,
  swapInFlight: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// The derived model
// ─────────────────────────────────────────────────────────────────────────────

/** The ten states of FR-001. There is no eleventh, and none of them is an error (FR-030). */
export type CardStateNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** A pick the engine chose that has not been written yet — the caller INSERTs it (T010). */
export interface PendingPick {
  item: LibraryItem;
  episodeId: string;
  source: PickSource;
  /** True when this pick opens a new episode, so the caller knows the budget is fresh. */
  startsNewEpisode: boolean;
}

export interface CardModel {
  /** Which of FR-001's ten states the card renders. */
  state: CardStateNumber;
  /** Today's row with `outcome IS NULL AND swapped_away_at IS NULL` (≤1 by DB index). */
  activePick: PickRow | null;
  /** The library entry on screen — the active pick's, or the pending pick's. */
  item: LibraryItem | null;
  /** Non-null when a pick has been selected but not yet persisted. */
  pendingPick: PendingPick | null;
  /** The episode the card is currently working in, or null when none is open or warranted. */
  episode: EngineEpisode | null;
  /** Whether that episode is still open (no outcome recorded, or state 8 continuing it). */
  episodeOpen: boolean;
  /** `3 − picksUsed`, floored at 0 (FR-018). */
  budgetRemaining: number;
  /**
   * Whether "Something else" is offered (states 3/4). False → the swap action RETIRES with
   * `SWAP_RETIRED_LINE`, either because the budget is spent or because the day's non-repeat
   * exclusions leave nothing eligible. The second reason can bite while budget remains —
   * that is FR-018's "non-repeat wins and the swap retires early".
   */
  swapAvailable: boolean;
  /** Whether state 8 offers its replacement, or renders the no-replacement variant. */
  replacementAvailable: boolean;
  /** Today's non-repeat exclusions — items opened or swapped away today (FR-018). */
  exclusions: readonly string[];
  /** Today's rows, oldest first. Every other derivation is a view over this. */
  todayPicks: readonly PickRow[];
  /** Today's rows that were opened — state 9's "what was tried" (data-model §3). */
  openedToday: readonly PickRow[];
  /** The most recent recorded outcome today, if any. */
  latestOutcome: { pick: PickRow; outcome: PickOutcome; atMs: number } | null;
}

export interface CardDerivationInput {
  /** Today, in today-card day semantics. See `toLocalDayString`. */
  localDay: string;
  /** Injected clock. */
  nowMs: number;
  /** Pick rows — may span days; filtered to `localDay` here (FR-019). */
  picks: readonly PickRow[];
  /** Band readings — may span days; filtered to `localDay` here (FR-019). */
  bands: readonly BandReading[];
  ui: CardUiState;
  library: readonly LibraryItem[];
  preferences: PreferenceSource;
  /** Client-generated uuid, used only if a NEW episode starts on this derivation. */
  newEpisodeId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Day semantics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `YYYY-MM-DD` in the viewer's own zone — what `recommendation_picks.local_day` stores.
 *
 * The boundaries are the today card's: local midnight to local midnight, identical to
 * `localDayWindow` in `lib/api/monitoring-reads.ts`. This is a formatter, not a second
 * definition of "day"; `toISOString().slice(0, 10)` is deliberately NOT used, because it
 * would name the UTC day and silently roll over mid-evening for anyone east of Greenwich.
 */
export function toLocalDayString(when: Date): string {
  const year = when.getFullYear();
  const month = `${when.getMonth() + 1}`.padStart(2, "0");
  const day = `${when.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Project a stored row onto the engine's history entry (opened/swapped/outcome flags). */
export function toHistoryEntry(row: PickRow): PickHistoryEntry {
  return {
    itemId: row.itemId,
    category: row.category,
    opened: row.openedAtMs !== null,
    swappedAway: row.swappedAwayAtMs !== null,
    outcome: row.outcome,
  };
}

/** Whether a row is the day's active pick (data-model §3). */
export function isActive(row: PickRow): boolean {
  return row.outcome === null && row.swappedAwayAtMs === null;
}

// ─────────────────────────────────────────────────────────────────────────────
// The reducer
// ─────────────────────────────────────────────────────────────────────────────

function byTime(a: PickRow, b: PickRow): number {
  return a.suggestedAtMs - b.suggestedAtMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Derive the whole card model from `(today's picks, today's bands, in-flight UI events)`.
 *
 * Total by construction: every branch below assigns one of the ten states, so no input —
 * including an empty one, a contradictory one, or a day whose readings warranted a pick the
 * non-repeat rule has since retired — can produce an eleventh state or an error state
 * (SC-002, FR-030).
 */
export function deriveCardModel(input: CardDerivationInput): CardModel {
  const { localDay, nowMs, ui, library, preferences, newEpisodeId } = input;

  // ── FR-019: the day reset IS this filter ───────────────────────────────────────────
  const todayPicks = input.picks.filter((row) => row.localDay === localDay).sort(byTime);
  const todayBands = input.bands
    .filter((reading) => toLocalDayString(new Date(reading.atMs)) === localDay)
    .slice()
    .sort((a, b) => a.atMs - b.atMs);

  const history = todayPicks.map(toHistoryEntry);
  const exclusions = [...nonRepeatExclusions(history)];
  const openedToday = todayPicks.filter((row) => row.openedAtMs !== null);

  const activePick = todayPicks.filter(isActive).at(-1) ?? null;
  const latestPick = todayPicks.at(-1) ?? null;

  const answered = todayPicks
    .filter((row) => row.outcome !== null && row.outcomeAtMs !== null)
    .sort((a, b) => (a.outcomeAtMs ?? 0) - (b.outcomeAtMs ?? 0));
  const latestAnswered = answered.at(-1) ?? null;
  const latestOutcome =
    latestAnswered && latestAnswered.outcome !== null && latestAnswered.outcomeAtMs !== null
      ? { pick: latestAnswered, outcome: latestAnswered.outcome, atMs: latestAnswered.outcomeAtMs }
      : null;

  // ── Episode identity and openness (FR-018) ─────────────────────────────────────────
  // The episode is the latest row's. It is OPEN while no outcome has been recorded on it —
  // which covers a pick that was swapped away and whose replacement never landed — and it
  // stays open through state 8, because taking the replacement continues the episode.
  const currentEpisodeId = latestPick?.episodeId ?? null;
  const picksUsed = currentEpisodeId
    ? todayPicks.filter((row) => row.episodeId === currentEpisodeId).length
    : 0;
  const episodeOpen =
    latestPick !== null &&
    (latestPick.outcome === null || ui.acknowledgement === "didnt_help");

  // A closed episode RE-ARMS when a qualifying reading arrives after the closing outcome —
  // a new stress event, so a new episode with a fresh budget (FR-018, FR-001 state 9).
  const closedAtMs = latestOutcome?.atMs ?? null;
  const reArmed =
    !episodeOpen &&
    closedAtMs !== null &&
    todayBands.some((r) => WARRANTING_BANDS.includes(r.band) && r.atMs > closedAtMs);

  const startsNewEpisode = todayPicks.length === 0 || reArmed;
  const episode: EngineEpisode | null =
    episodeOpen && currentEpisodeId
      ? { id: currentEpisodeId, picksUsed }
      : startsNewEpisode
        ? { id: newEpisodeId, picksUsed: 0 }
        : null;

  // No episode → nothing in play. A CLOSED episode with no re-arm must read 0, not 3, or
  // the card would advertise a budget that no action can spend.
  const budgetRemaining = episode ? Math.max(0, MAX_PICKS_PER_EPISODE - episode.picksUsed) : 0;

  // ── Engine consultations ───────────────────────────────────────────────────────────
  // `newEpisodeId` is deliberately NOT forwarded: `episode` already carries the new id when
  // one is warranted, so a null `episode` here means "closed, not re-armed" and the engine
  // must return null rather than open an episode nothing asked for.
  const select = (todayHistory: readonly PickHistoryEntry[]): SelectedPick | null =>
    selectPick({
      dayBands: todayBands,
      nowMs,
      todayHistory,
      episode,
      preferences,
      library,
    });

  // What the engine would surface right now, for a slot that is not yet spent.
  const nextPick = select(history);

  // Swap availability asks a different question: what would be left AFTER the active pick
  // was stamped away? So the active item joins the exclusions before the engine is asked.
  // Budget is unchanged by the question — the replacement occupies the next slot, which is
  // exactly what `picksUsed >= 3` already gates.
  const swapAvailable =
    activePick !== null &&
    select(
      history.map((entry) =>
        entry.itemId === activePick.itemId ? { ...entry, swappedAway: true } : entry,
      ),
    ) !== null;

  // State 8's replacement draws on the SAME budget. The answered pick is already opened, so
  // it is already excluded — no extra marking is needed here.
  const replacementAvailable = nextPick !== null;

  const libraryItem = (itemId: string): LibraryItem | null =>
    library.find((candidate) => candidate.id === itemId) ?? null;

  const base = {
    activePick,
    pendingPick: null as PendingPick | null,
    episode,
    episodeOpen,
    budgetRemaining,
    swapAvailable,
    replacementAvailable,
    exclusions,
    todayPicks,
    openedToday,
    latestOutcome,
  };

  // ── State 10 — swapped away. No acknowledgement, no ceremony (FR-001 state 10). ─────
  if (ui.swapInFlight) {
    return { ...base, state: 10, item: activePick ? libraryItem(activePick.itemId) : null };
  }

  // ── States 7 / 8 — the acknowledgement dwell after an answer. ───────────────────────
  if (ui.acknowledgement !== null) {
    const answeredItem = latestOutcome ? libraryItem(latestOutcome.pick.itemId) : null;
    // State 8 is the only path that offers a replacement, and it draws on the episode's
    // SAME three-pick budget (FR-018). When the engine has nothing — budget spent, or the
    // day's exclusions leave nothing eligible — `pendingPick` stays null and the card
    // renders the no-replacement variant.
    const replacement: PendingPick | null =
      ui.acknowledgement === "didnt_help" && nextPick
        ? {
            item: nextPick.item,
            episodeId: nextPick.episodeId,
            source: "reading",
            startsNewEpisode: false,
          }
        : null;
    return {
      ...base,
      state: ui.acknowledgement === "helped" ? 7 : 8,
      item: answeredItem,
      pendingPick: replacement,
    };
  }

  // ── States 3 / 4 / 5 / 6 — there is a pick on screen. ───────────────────────────────
  if (activePick) {
    const item = libraryItem(activePick.itemId);
    // State 5 — instructions visible; the outcome prompt may NOT render over them (FR-031).
    if (ui.instructionsOpen) return { ...base, state: 5, item };
    // State 6 — asked only after the item was opened and its instructions closed, asked
    // once, and ignoring it costs nothing (FR-016).
    const promptEligible =
      activePick.openedAtMs !== null &&
      ui.instructionsClosedAfterOpening &&
      !ui.outcomePromptIgnored;
    if (promptEligible) return { ...base, state: 6, item };
    // State 4 — a confirmed detection attached; same pick, same words, prominence only.
    // State 3 — quiet. Neither restates the band (FR-013).
    return { ...base, state: activePick.confirmedAtMs !== null ? 4 : 3, item };
  }

  // ── No active pick. Either one is warranted now, or the card is at rest / calm / empty. ─
  if (nextPick) {
    return {
      ...base,
      state: 3,
      item: nextPick.item,
      pendingPick: {
        item: nextPick.item,
        episodeId: nextPick.episodeId,
        source: "reading",
        startsNewEpisode,
      },
    };
  }

  // Nothing to surface. If the day has any pick history at all — including a day whose
  // non-repeat exclusions have retired everything — the honest resting state is 9: it does
  // not push another pick, does not claim the day is over, and re-arms if the day shifts.
  if (todayPicks.length > 0) return { ...base, state: 9, item: null };

  // No picks today. State 1 names the cause; state 2 is calm.
  if (todayBands.length === 0) return { ...base, state: 1, item: null };
  if (!isPickWarranted(todayBands)) return { ...base, state: 2, item: null };

  // Warranted, but the engine had nothing — with no rows today this is only reachable if
  // the library itself is empty. Still a defined state, never an error (FR-030).
  return { ...base, state: 9, item: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// In-flight events that are NOT plain derivations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FR-014 / `contracts/confirmatory-resolution.md` §Interruption — what a newly confirmed
 * detection does to the card.
 *
 * Three shapes, and the choice between them is the episode rule (FR-018) applied unchanged:
 *
 *   • **attach** — a pick is active, so the detection attaches to it: UPDATE `confirmed_at`,
 *     prominence 3 → 4, same pick, same remaining budget, NEVER a second row. If an outcome
 *     prompt was pending it is removed **without recording an answer** — that is the whole
 *     of FR-014. Attach-only is the INTENDED design (Ruling C, 2026-08-15), not a
 *     workaround for `rp_one_active_per_user_day`; the index mirrors the rule.
 *   • **continue_episode** — no active pick but the episode never closed (a pick was
 *     stamped away and its replacement did not land): surface within the SAME episode, on
 *     the same budget.
 *   • **new_episode** — the prior episode was closed by an outcome, so this detection is a
 *     new stress event and gets a fresh budget.
 */
export type ConfirmedDetectionEffect =
  | {
      kind: "attach";
      pickId: string;
      episodeId: string;
      startsNewEpisode: false;
      dismissesPendingOutcomePrompt: boolean;
      writesOutcome: false;
    }
  | {
      kind: "continue_episode" | "new_episode";
      pickId: null;
      episodeId: string;
      startsNewEpisode: boolean;
      dismissesPendingOutcomePrompt: boolean;
      writesOutcome: false;
    };

export function applyConfirmedDetection(model: CardModel, newEpisodeId: string): ConfirmedDetectionEffect {
  const dismissesPendingOutcomePrompt = model.state === 6;

  if (model.activePick) {
    return {
      kind: "attach",
      pickId: model.activePick.id,
      episodeId: model.activePick.episodeId,
      startsNewEpisode: false,
      dismissesPendingOutcomePrompt,
      writesOutcome: false,
    };
  }

  if (model.episodeOpen && model.episode) {
    return {
      kind: "continue_episode",
      pickId: null,
      episodeId: model.episode.id,
      startsNewEpisode: false,
      dismissesPendingOutcomePrompt,
      writesOutcome: false,
    };
  }

  return {
    kind: "new_episode",
    pickId: null,
    episodeId: newEpisodeId,
    startsNewEpisode: true,
    dismissesPendingOutcomePrompt,
    writesOutcome: false,
  };
}

/**
 * FR-016 — ignoring the outcome prompt. It is a valid answer that records NOTHING and costs
 * nothing: no row is written, no budget is spent, the pick stays active. This function
 * exists so that "nothing happens" is an asserted behaviour rather than an absence nobody
 * tested; `write` is permanently `null` by type.
 */
export function applyIgnoredOutcomePrompt(ui: CardUiState): { ui: CardUiState; write: null } {
  return { ui: { ...ui, outcomePromptIgnored: true, instructionsOpen: false }, write: null };
}
