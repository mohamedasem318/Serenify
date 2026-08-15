import { describe, expect, it } from "vitest";

import type { Band } from "@/lib/api/monitoring-client";
import { MAX_PICKS_PER_EPISODE } from "@/lib/recommendations/engine";
import {
  IDLE_CARD_UI,
  applyConfirmedDetection,
  applyIgnoredOutcomePrompt,
  deriveCardModel,
  isActive,
  toHistoryEntry,
  toLocalDayString,
  type BandReading,
  type CardDerivationInput,
  type CardModel,
  type CardStateNumber,
  type CardUiState,
  type PickRow,
} from "@/lib/recommendations/episode";
import { RECOMMENDATION_LIBRARY } from "@/lib/recommendations/library";
import { neutralPreferenceSource } from "@/lib/recommendations/preference-source";

/**
 * T009 — the episode / budget / non-repeat reducer (spec FR-001, FR-013…FR-019, FR-030,
 * FR-031; research R-3; `contracts/confirmatory-resolution.md` §Interruption).
 *
 * The fixture list below IS the FR-018 paragraph, turned into cases. Each `describe` names
 * one rule from that paragraph and the file is deliberately arranged so a reader can check
 * the spec against the test names alone.
 *
 * Two acceptance properties are asserted structurally rather than by inspection:
 *   • **All ten states are reachable** and each is demonstrated (SC-002).
 *   • **No eleventh state and no error state is derivable** (SC-002, FR-030) — a sweep over
 *     a cross-product of inputs asserts every result lands in 1…10 and nothing throws.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers — local-zone instants, so every assertion is zone-independent
// ─────────────────────────────────────────────────────────────────────────────

const TODAY = new Date(2026, 7, 16);
const YESTERDAY = new Date(2026, 7, 15);
const TODAY_DAY = toLocalDayString(TODAY);
const YESTERDAY_DAY = toLocalDayString(YESTERDAY);

function at(hour: number, minute = 0, day: Date = TODAY): number {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0).getTime();
}

function band(bandValue: Band, hour: number, day: Date = TODAY): BandReading {
  return { band: bandValue, atMs: at(hour, 0, day) };
}

let rowCounter = 0;

function pick(overrides: Partial<PickRow> & { itemId: string }): PickRow {
  const item = RECOMMENDATION_LIBRARY.find((candidate) => candidate.id === overrides.itemId);
  if (!item) throw new Error(`fixture references an item outside the library: ${overrides.itemId}`);
  rowCounter += 1;
  return {
    id: `pick-${rowCounter}`,
    localDay: TODAY_DAY,
    episodeId: "episode-1",
    category: item.category, // derived from the library, exactly as the write client does
    source: "reading",
    suggestedAtMs: at(10),
    confirmedAtMs: null,
    openedAtMs: null,
    outcome: null,
    outcomeAtMs: null,
    swappedAwayAtMs: null,
    ...overrides,
    itemId: item.id,
  };
}

function ui(overrides: Partial<CardUiState> = {}): CardUiState {
  return { ...IDLE_CARD_UI, ...overrides };
}

function derive(overrides: Partial<CardDerivationInput> = {}): CardModel {
  return deriveCardModel({
    localDay: TODAY_DAY,
    nowMs: at(10, 30),
    picks: [],
    bands: [band("a_little_tense", 10)],
    ui: IDLE_CARD_UI,
    library: RECOMMENDATION_LIBRARY,
    preferences: neutralPreferenceSource,
    newEpisodeId: "episode-new",
    ...overrides,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Day semantics (FR-019)
// ─────────────────────────────────────────────────────────────────────────────

describe("toLocalDayString — today-card day semantics", () => {
  it("names the LOCAL day, not the UTC one", () => {
    // 23:30 local on the 16th is the 17th in UTC anywhere east of Greenwich, and the 16th
    // in UTC anywhere west of it. `local_day` must say the 16th in both cases.
    expect(toLocalDayString(new Date(2026, 7, 16, 23, 30))).toBe("2026-08-16");
    expect(toLocalDayString(new Date(2026, 7, 16, 0, 30))).toBe("2026-08-16");
  });

  it("zero-pads", () => {
    expect(toLocalDayString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SC-002 — every one of the ten states is reachable and demonstrated
// ─────────────────────────────────────────────────────────────────────────────

const OPENED = pick({ itemId: "box-breathing", openedAtMs: at(10, 5) });

const TEN_STATES: readonly { state: CardStateNumber; name: string; model: () => CardModel }[] = [
  {
    state: 1,
    name: "no reading yet today",
    model: () => derive({ bands: [] }),
  },
  {
    state: 2,
    name: "calm",
    model: () => derive({ bands: [band("at_ease", 9), band("at_ease", 13)] }),
  },
  {
    state: 3,
    name: "uneasy/tense, unconfirmed",
    model: () => derive({ picks: [pick({ itemId: "box-breathing" })] }),
  },
  {
    state: 4,
    name: "confirmed detection",
    model: () => derive({ picks: [pick({ itemId: "box-breathing", confirmedAtMs: at(10, 2) })] }),
  },
  {
    state: 5,
    name: "item expanded",
    model: () =>
      derive({ picks: [{ ...OPENED }], ui: ui({ instructionsOpen: true }) }),
  },
  {
    state: 6,
    name: "outcome prompt",
    model: () =>
      derive({ picks: [{ ...OPENED }], ui: ui({ instructionsClosedAfterOpening: true }) }),
  },
  {
    state: 7,
    name: "recorded, helped",
    model: () =>
      derive({
        picks: [{ ...OPENED, outcome: "helped", outcomeAtMs: at(10, 20) }],
        ui: ui({ acknowledgement: "helped" }),
      }),
  },
  {
    state: 8,
    name: "recorded, didn't help",
    model: () =>
      derive({
        picks: [{ ...OPENED, outcome: "didnt_help", outcomeAtMs: at(10, 20) }],
        ui: ui({ acknowledgement: "didnt_help" }),
      }),
  },
  {
    state: 9,
    name: "at rest after an outcome",
    model: () =>
      derive({ picks: [{ ...OPENED, outcome: "helped", outcomeAtMs: at(10, 20) }] }),
  },
  {
    state: 10,
    name: "swapped away",
    model: () => derive({ picks: [pick({ itemId: "box-breathing" })], ui: ui({ swapInFlight: true }) }),
  },
];

describe("SC-002 — all ten card states are reachable", () => {
  it.each(TEN_STATES)("state $state — $name", ({ state, model }) => {
    expect(model().state).toBe(state);
  });

  it("covers exactly ten distinct states, no more", () => {
    expect(new Set(TEN_STATES.map((s) => s.state)).size).toBe(10);
  });
});

describe("SC-002 / FR-030 — no eleventh state and no error state is derivable", () => {
  it("lands in 1…10 for every combination of rows, readings and UI flags, and never throws", () => {
    const rowSets: PickRow[][] = [
      [],
      [pick({ itemId: "box-breathing" })],
      [pick({ itemId: "box-breathing", swappedAwayAtMs: at(10, 4) })],
      [pick({ itemId: "box-breathing", openedAtMs: at(10, 5) })],
      [pick({ itemId: "box-breathing", openedAtMs: at(10, 5), outcome: "helped", outcomeAtMs: at(10, 9) })],
      [
        pick({ itemId: "box-breathing", swappedAwayAtMs: at(10, 4) }),
        pick({ itemId: "feet-on-the-floor", suggestedAtMs: at(10, 5), openedAtMs: at(10, 6), outcome: "didnt_help", outcomeAtMs: at(10, 8) }),
      ],
      RECOMMENDATION_LIBRARY.map((item, index) =>
        pick({ itemId: item.id, suggestedAtMs: at(9) + index * 1000, openedAtMs: at(9) + index * 1000 }),
      ),
    ];
    const bandSets: BandReading[][] = [
      [],
      [band("at_ease", 9)],
      [band("a_little_tense", 10)],
      [band("tense", 10), band("at_ease", 15)],
      [band("at_ease", 9), band("tense", 11), band("tense", 16)],
    ];
    const uiSets: CardUiState[] = [
      IDLE_CARD_UI,
      ui({ instructionsOpen: true }),
      ui({ instructionsClosedAfterOpening: true }),
      ui({ instructionsClosedAfterOpening: true, outcomePromptIgnored: true }),
      ui({ acknowledgement: "helped" }),
      ui({ acknowledgement: "didnt_help" }),
      ui({ swapInFlight: true }),
    ];

    const seen = new Set<number>();
    for (const picks of rowSets) {
      for (const bands of bandSets) {
        for (const uiState of uiSets) {
          for (const hour of [8, 14, 19, 23]) {
            const model = derive({ picks, bands, ui: uiState, nowMs: at(hour) });
            expect(model.state).toBeGreaterThanOrEqual(1);
            expect(model.state).toBeLessThanOrEqual(10);
            expect(Number.isInteger(model.state)).toBe(true);
            expect(model.budgetRemaining).toBeGreaterThanOrEqual(0);
            expect(model.budgetRemaining).toBeLessThanOrEqual(MAX_PICKS_PER_EPISODE);
            seen.add(model.state);
          }
        }
      }
    }
    // The sweep is broad enough to be worth checking it exercised most of the space.
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });

  it("is deterministic — the same input derives the same model every time", () => {
    const input: Partial<CardDerivationInput> = {
      picks: [pick({ itemId: "box-breathing", openedAtMs: at(10, 5) })],
      bands: [band("tense", 10)],
    };
    const first = JSON.stringify(derive(input));
    for (let run = 0; run < 20; run += 1) expect(JSON.stringify(derive(input))).toBe(first);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE — mid-episode confirmation (FR-018, Ruling C)
// ─────────────────────────────────────────────────────────────────────────────

describe("FIXTURE: mid-episode confirmation — same pick, same budget, prominence 3 → 4 only", () => {
  const unconfirmed = pick({ itemId: "box-breathing" });
  const confirmed: PickRow = { ...unconfirmed, confirmedAtMs: at(10, 12) };

  it("changes the state from 3 to 4 and nothing else", () => {
    const before = derive({ picks: [unconfirmed] });
    const after = derive({ picks: [confirmed] });

    expect(before.state).toBe(3);
    expect(after.state).toBe(4);
    expect(after.activePick?.id).toBe(before.activePick?.id);
    expect(after.item?.id).toBe(before.item?.id);
    expect(after.episode?.id).toBe(before.episode?.id);
    expect(after.budgetRemaining).toBe(before.budgetRemaining);
    expect(after.exclusions).toEqual(before.exclusions);
  });

  it("does not start a new episode, and never inserts a second row", () => {
    const effect = applyConfirmedDetection(derive({ picks: [unconfirmed] }), "episode-brand-new");
    expect(effect.kind).toBe("attach");
    expect(effect.startsNewEpisode).toBe(false);
    expect(effect.episodeId).toBe("episode-1");
    expect(effect.kind === "attach" ? effect.pickId : null).toBe(unconfirmed.id);
  });

  it("keeps the swap available in state 4 — the person is not trapped by the attach", () => {
    expect(derive({ picks: [confirmed] }).swapAvailable).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE — the shared three-pick budget (FR-018)
// ─────────────────────────────────────────────────────────────────────────────

describe("FIXTURE: state-8 replacement draws on the shared three-pick budget", () => {
  const answeredFirst = pick({
    itemId: "box-breathing",
    openedAtMs: at(10, 5),
    outcome: "didnt_help",
    outcomeAtMs: at(10, 9),
  });

  it("offers a replacement while the episode has room, from the SAME episode", () => {
    const model = derive({ picks: [answeredFirst], ui: ui({ acknowledgement: "didnt_help" }) });
    expect(model.state).toBe(8);
    expect(model.replacementAvailable).toBe(true);
    expect(model.budgetRemaining).toBe(MAX_PICKS_PER_EPISODE - 1);
    expect(model.pendingPick?.episodeId).toBe("episode-1");
    expect(model.pendingPick?.startsNewEpisode).toBe(false);
    expect(model.pendingPick?.item.id).not.toBe("box-breathing");
  });

  it("the replacement is NOT a second allowance — three surfaced rows exhaust the episode", () => {
    const three = [
      pick({ itemId: "box-breathing", suggestedAtMs: at(10), swappedAwayAtMs: at(10, 2) }),
      pick({ itemId: "feet-on-the-floor", suggestedAtMs: at(10, 3), swappedAwayAtMs: at(10, 4) }),
      pick({
        itemId: "three-two-one-around-you",
        suggestedAtMs: at(10, 5),
        openedAtMs: at(10, 6),
        outcome: "didnt_help",
        outcomeAtMs: at(10, 8),
      }),
    ];
    const model = derive({ picks: three, ui: ui({ acknowledgement: "didnt_help" }) });
    expect(model.episode?.picksUsed).toBe(3);
    expect(model.budgetRemaining).toBe(0);
    expect(model.replacementAvailable).toBe(false);
  });

  it("counts SURFACED rows in the episode — data-model §3, verbatim", () => {
    const twoOfThree = [
      pick({ itemId: "box-breathing", suggestedAtMs: at(10), swappedAwayAtMs: at(10, 2) }),
      pick({ itemId: "feet-on-the-floor", suggestedAtMs: at(10, 3) }),
    ];
    expect(derive({ picks: twoOfThree }).episode?.picksUsed).toBe(2);
    expect(derive({ picks: twoOfThree }).budgetRemaining).toBe(1);
  });

  it("a row from another episode does not count against this one", () => {
    const priorEpisode = pick({
      itemId: "box-breathing",
      episodeId: "episode-0",
      suggestedAtMs: at(9),
      openedAtMs: at(9, 1),
      outcome: "helped",
      outcomeAtMs: at(9, 5),
    });
    const current = pick({ itemId: "feet-on-the-floor", episodeId: "episode-1", suggestedAtMs: at(14) });
    const model = derive({ picks: [priorEpisode, current], bands: [band("tense", 13)] });
    expect(model.episode?.id).toBe("episode-1");
    expect(model.episode?.picksUsed).toBe(1);
    expect(model.budgetRemaining).toBe(2);
  });
});

describe("FIXTURE: state-8 no-replacement variant", () => {
  it("variant A — the budget is spent", () => {
    const spent = [
      pick({ itemId: "box-breathing", suggestedAtMs: at(10), swappedAwayAtMs: at(10, 1) }),
      pick({ itemId: "feet-on-the-floor", suggestedAtMs: at(10, 2), swappedAwayAtMs: at(10, 3) }),
      pick({
        itemId: "roll-your-shoulders",
        suggestedAtMs: at(10, 4),
        openedAtMs: at(10, 5),
        outcome: "didnt_help",
        outcomeAtMs: at(10, 7),
      }),
    ];
    const model = derive({ picks: spent, ui: ui({ acknowledgement: "didnt_help" }) });
    expect(model.state).toBe(8);
    expect(model.replacementAvailable).toBe(false);
    expect(model.pendingPick).toBeNull();
    expect(model.budgetRemaining).toBe(0);
  });

  it("variant B — separately, the day's non-repeat rule leaves nothing eligible", () => {
    // Every library item has been opened today across earlier episodes; the CURRENT episode
    // has only surfaced one pick, so the budget still has room. It still offers nothing.
    const exhausted = RECOMMENDATION_LIBRARY.map((item, index) =>
      pick({
        itemId: item.id,
        episodeId: index === RECOMMENDATION_LIBRARY.length - 1 ? "episode-1" : `episode-old-${index}`,
        suggestedAtMs: at(8) + index * 60_000,
        openedAtMs: at(8) + index * 60_000 + 1_000,
        outcome: "didnt_help",
        outcomeAtMs: at(8) + index * 60_000 + 2_000,
      }),
    );
    const model = derive({ picks: exhausted, ui: ui({ acknowledgement: "didnt_help" }) });
    expect(model.state).toBe(8);
    expect(model.budgetRemaining).toBeGreaterThan(0);
    expect(model.replacementAvailable).toBe(false);
    expect(model.pendingPick).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE — non-repeat beats the budget (FR-018)
// ─────────────────────────────────────────────────────────────────────────────

describe("FIXTURE: non-repeat beats the budget — the swap retires early", () => {
  it("retires the swap while the budget still has room", () => {
    // 14 of the 15 items were opened in earlier episodes today. The current episode has
    // surfaced exactly one pick — the fifteenth item — so two slots remain, and swapping it
    // away would leave nothing.
    const alreadyTried = RECOMMENDATION_LIBRARY.slice(0, 14).map((item, index) =>
      pick({
        itemId: item.id,
        episodeId: `episode-old-${index}`,
        suggestedAtMs: at(8) + index * 60_000,
        openedAtMs: at(8) + index * 60_000 + 1_000,
        outcome: "helped",
        outcomeAtMs: at(8) + index * 60_000 + 2_000,
      }),
    );
    const activeItem = RECOMMENDATION_LIBRARY[14]!;
    const model = derive({
      picks: [...alreadyTried, pick({ itemId: activeItem.id, episodeId: "episode-1", suggestedAtMs: at(15) })],
      bands: [band("tense", 14)],
      nowMs: at(15, 5),
    });

    expect(model.state).toBe(3);
    expect(model.activePick?.itemId).toBe(activeItem.id);
    expect(model.budgetRemaining).toBe(MAX_PICKS_PER_EPISODE - 1);
    expect(model.budgetRemaining).toBeGreaterThan(0);
    expect(model.swapAvailable).toBe(false);
  });

  it("the swap IS available when the exclusions still leave something", () => {
    const model = derive({ picks: [pick({ itemId: "box-breathing" })] });
    expect(model.budgetRemaining).toBe(MAX_PICKS_PER_EPISODE - 1);
    expect(model.swapAvailable).toBe(true);
  });

  it("the third pick of an episode cannot be swapped — the budget bites first", () => {
    const three = [
      pick({ itemId: "box-breathing", suggestedAtMs: at(10), swappedAwayAtMs: at(10, 1) }),
      pick({ itemId: "feet-on-the-floor", suggestedAtMs: at(10, 2), swappedAwayAtMs: at(10, 3) }),
      pick({ itemId: "three-two-one-around-you", suggestedAtMs: at(10, 4) }),
    ];
    const model = derive({ picks: three });
    expect(model.budgetRemaining).toBe(0);
    expect(model.swapAvailable).toBe(false);
  });

  it("exclusions are items opened OR swapped away today, and survive episode boundaries", () => {
    const model = derive({
      picks: [
        pick({ itemId: "box-breathing", episodeId: "episode-0", suggestedAtMs: at(9), swappedAwayAtMs: at(9, 1) }),
        pick({
          itemId: "feet-on-the-floor",
          episodeId: "episode-0",
          suggestedAtMs: at(9, 2),
          openedAtMs: at(9, 3),
          outcome: "helped",
          outcomeAtMs: at(9, 6),
        }),
        pick({ itemId: "roll-your-shoulders", episodeId: "episode-1", suggestedAtMs: at(14) }),
      ],
      bands: [band("tense", 9), band("tense", 13)],
      nowMs: at(14, 5),
    });
    expect([...model.exclusions].sort()).toEqual(["box-breathing", "feet-on-the-floor"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE — Amendment 2026-08-16: a stamp charges nothing
// ─────────────────────────────────────────────────────────────────────────────

describe("FIXTURE (Amendment 2026-08-16): a swapped-away pick with NO successor row", () => {
  const stampedNoSuccessor = pick({
    itemId: "box-breathing",
    suggestedAtMs: at(10),
    swappedAwayAtMs: at(10, 3),
  });

  it("appears in the day's non-repeat exclusions", () => {
    expect(derive({ picks: [stampedNoSuccessor] }).exclusions).toContain("box-breathing");
  });

  it("is still a preference record — the stamp is real and is never reversed", () => {
    const entry = toHistoryEntry(stampedNoSuccessor);
    expect(entry.swappedAway).toBe(true);
    expect(entry.outcome).toBeNull(); // a preference, NOT an outcome (FR-017)
    expect(isActive(stampedNoSuccessor)).toBe(false);
  });

  it("charges NOTHING beyond its own slot — consumption counts surfaced rows, not stamps", () => {
    const model = derive({ picks: [stampedNoSuccessor] });
    // One row surfaced → one slot used. The failed replacement adds no row, so it adds no
    // charge: the person does not lose a suggestion because a write failed on our side.
    expect(model.episode?.picksUsed).toBe(1);
    expect(model.budgetRemaining).toBe(MAX_PICKS_PER_EPISODE - 1);
  });

  it("leaves the episode OPEN and immediately re-offers a different item", () => {
    const model = derive({ picks: [stampedNoSuccessor] });
    expect(model.episodeOpen).toBe(true);
    expect(model.state).toBe(3);
    expect(model.pendingPick?.episodeId).toBe("episode-1");
    expect(model.pendingPick?.startsNewEpisode).toBe(false);
    expect(model.pendingPick?.item.id).not.toBe("box-breathing");
  });

  it("two stamps with one successor still charge only the rows that landed", () => {
    const model = derive({
      picks: [
        pick({ itemId: "box-breathing", suggestedAtMs: at(10), swappedAwayAtMs: at(10, 1) }),
        pick({ itemId: "feet-on-the-floor", suggestedAtMs: at(10, 2), swappedAwayAtMs: at(10, 5) }),
      ],
    });
    expect(model.episode?.picksUsed).toBe(2);
    expect(model.budgetRemaining).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE — FR-014 interruption
// ─────────────────────────────────────────────────────────────────────────────

describe("FIXTURE: FR-014 interruption — a new confirmed detection while a prompt is pending", () => {
  const opened = pick({ itemId: "box-breathing", openedAtMs: at(10, 5) });

  it("removes the pending outcome prompt WITHOUT recording an answer", () => {
    const pending = derive({ picks: [opened], ui: ui({ instructionsClosedAfterOpening: true }) });
    expect(pending.state).toBe(6);

    const effect = applyConfirmedDetection(pending, "episode-brand-new");
    expect(effect.dismissesPendingOutcomePrompt).toBe(true);
    expect(effect.writesOutcome).toBe(false);
  });

  it("attaches to the still-active pick rather than inserting a second row (Ruling C)", () => {
    const pending = derive({ picks: [opened], ui: ui({ instructionsClosedAfterOpening: true }) });
    const effect = applyConfirmedDetection(pending, "episode-brand-new");
    expect(effect.kind).toBe("attach");
    expect(effect.startsNewEpisode).toBe(false);
    expect(effect.episodeId).toBe(opened.episodeId);
  });

  it("continues the episode when it never closed — a stamp with no successor", () => {
    const stamped = derive({
      picks: [pick({ itemId: "box-breathing", swappedAwayAtMs: at(10, 3) })],
    });
    const effect = applyConfirmedDetection(stamped, "episode-brand-new");
    expect(effect.kind).toBe("continue_episode");
    expect(effect.startsNewEpisode).toBe(false);
    expect(effect.episodeId).toBe("episode-1");
  });

  it("starts a NEW episode with a fresh budget IFF the prior one was closed by an outcome", () => {
    const closed = derive({
      picks: [
        pick({
          itemId: "box-breathing",
          openedAtMs: at(10, 5),
          outcome: "helped",
          outcomeAtMs: at(10, 9),
        }),
      ],
    });
    expect(closed.state).toBe(9);
    const effect = applyConfirmedDetection(closed, "episode-brand-new");
    expect(effect.kind).toBe("new_episode");
    expect(effect.startsNewEpisode).toBe(true);
    expect(effect.episodeId).toBe("episode-brand-new");
    expect(effect.writesOutcome).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE — ignoring the outcome prompt (FR-016)
// ─────────────────────────────────────────────────────────────────────────────

describe("FIXTURE: an ignored outcome prompt records nothing", () => {
  const opened = pick({ itemId: "box-breathing", openedAtMs: at(10, 5) });

  it("writes nothing — the write is `null` by type, not by accident", () => {
    const result = applyIgnoredOutcomePrompt(ui({ instructionsClosedAfterOpening: true }));
    expect(result.write).toBeNull();
    expect(result.ui.outcomePromptIgnored).toBe(true);
  });

  it("costs nothing — the pick stays active, the budget is untouched, no outcome exists", () => {
    const pendingUi = ui({ instructionsClosedAfterOpening: true });
    const pending = derive({ picks: [opened], ui: pendingUi });
    const ignored = derive({ picks: [opened], ui: applyIgnoredOutcomePrompt(pendingUi).ui });

    expect(pending.state).toBe(6);
    expect(ignored.state).toBe(3); // back to the quiet pick, not an eleventh state
    expect(ignored.activePick?.id).toBe(opened.id);
    expect(ignored.activePick?.outcome).toBeNull();
    expect(ignored.budgetRemaining).toBe(pending.budgetRemaining);
    expect(ignored.latestOutcome).toBeNull();
  });

  it("is asked once — the prompt does not come back on the same pick", () => {
    const ignoredUi = ui({ instructionsClosedAfterOpening: true, outcomePromptIgnored: true });
    expect(derive({ picks: [opened], ui: ignoredUi }).state).toBe(3);
  });

  it("never renders over the open instructions (FR-031)", () => {
    const openUi = ui({ instructionsOpen: true, instructionsClosedAfterOpening: true });
    expect(derive({ picks: [opened], ui: openUi }).state).toBe(5);
  });

  it("is not offered before the item was opened (FR-016)", () => {
    const neverOpened = pick({ itemId: "box-breathing" });
    const model = derive({ picks: [neverOpened], ui: ui({ instructionsClosedAfterOpening: true }) });
    expect(model.state).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE — episode boundaries (FR-018)
// ─────────────────────────────────────────────────────────────────────────────

describe("FIXTURE: a continuously elevated stretch is ONE episode, not a series", () => {
  it("keeps one episode id and one budget across a long run of qualifying readings", () => {
    const bands = [
      band("a_little_tense", 9),
      band("tense", 10),
      band("tense", 11),
      band("a_little_tense", 12),
      band("tense", 13),
      band("tense", 14),
    ];
    const model = derive({
      picks: [pick({ itemId: "box-breathing", suggestedAtMs: at(9, 5) })],
      bands,
      nowMs: at(14, 30),
    });
    expect(model.state).toBe(3);
    expect(model.episode?.id).toBe("episode-1");
    expect(model.episode?.picksUsed).toBe(1);
    expect(model.budgetRemaining).toBe(MAX_PICKS_PER_EPISODE - 1);
    expect(model.pendingPick).toBeNull(); // no new pick is surfaced by more of the same
  });

  it("the tenor is the day's PEAK, so an easing afternoon does not downgrade the episode", () => {
    const model = derive({
      bands: [band("tense", 10), band("at_ease", 13), band("at_ease", 14)],
      nowMs: at(14, 30),
    });
    expect(model.state).toBe(3);
    expect(model.pendingPick?.item.category).toBe("breathing_grounding");
  });
});

describe("FIXTURE: state-9 re-arm — a new stress event is a new episode with a fresh budget", () => {
  const closedEpisode = pick({
    itemId: "box-breathing",
    episodeId: "episode-1",
    suggestedAtMs: at(10),
    openedAtMs: at(10, 5),
    outcome: "helped",
    outcomeAtMs: at(10, 20),
  });

  it("rests at state 9 while nothing new has happened", () => {
    const model = derive({ picks: [closedEpisode], bands: [band("tense", 10)], nowMs: at(11) });
    expect(model.state).toBe(9);
    expect(model.episodeOpen).toBe(false);
    expect(model.episode).toBeNull();
    expect(model.pendingPick).toBeNull();
    expect(model.openedToday.map((row) => row.itemId)).toEqual(["box-breathing"]);
  });

  it("re-arms on a qualifying reading AFTER the outcome, with a fresh budget", () => {
    const model = derive({
      picks: [closedEpisode],
      bands: [band("tense", 10), band("tense", 15)],
      nowMs: at(15, 10),
    });
    expect(model.state).toBe(3);
    expect(model.episode?.id).toBe("episode-new");
    expect(model.episode?.picksUsed).toBe(0);
    expect(model.budgetRemaining).toBe(MAX_PICKS_PER_EPISODE);
    expect(model.pendingPick?.startsNewEpisode).toBe(true);
    expect(model.pendingPick?.episodeId).toBe("episode-new");
  });

  it("the re-armed episode still honours the day's non-repeat exclusions", () => {
    const model = derive({
      picks: [closedEpisode],
      bands: [band("tense", 10), band("tense", 15)],
      nowMs: at(15, 10),
    });
    expect(model.exclusions).toContain("box-breathing");
    expect(model.pendingPick?.item.id).not.toBe("box-breathing");
  });

  it("does NOT re-arm on a calm reading after the outcome", () => {
    const model = derive({
      picks: [closedEpisode],
      bands: [band("tense", 10), band("at_ease", 15)],
      nowMs: at(15, 10),
    });
    expect(model.state).toBe(9);
  });

  it("does NOT re-arm on a qualifying reading that PRECEDED the outcome", () => {
    const model = derive({
      picks: [closedEpisode],
      bands: [band("tense", 9), band("tense", 10)],
      nowMs: at(11),
    });
    expect(model.state).toBe(9);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE — the day boundary (FR-019)
// ─────────────────────────────────────────────────────────────────────────────

describe("FIXTURE: the local day boundary resets everything — by filtering, not clearing", () => {
  const yesterdaysPicks: PickRow[] = [
    pick({
      itemId: "box-breathing",
      localDay: YESTERDAY_DAY,
      episodeId: "episode-yesterday",
      suggestedAtMs: at(10, 0, YESTERDAY),
      openedAtMs: at(10, 5, YESTERDAY),
      outcome: "didnt_help",
      outcomeAtMs: at(10, 9, YESTERDAY),
    }),
    pick({
      itemId: "feet-on-the-floor",
      localDay: YESTERDAY_DAY,
      episodeId: "episode-yesterday",
      suggestedAtMs: at(10, 10, YESTERDAY),
      swappedAwayAtMs: at(10, 12, YESTERDAY),
    }),
    pick({
      itemId: "roll-your-shoulders",
      localDay: YESTERDAY_DAY,
      episodeId: "episode-yesterday",
      suggestedAtMs: at(10, 15, YESTERDAY),
      openedAtMs: at(10, 16, YESTERDAY),
    }),
  ];
  const yesterdaysBands: BandReading[] = [band("tense", 10, YESTERDAY), band("tense", 16, YESTERDAY)];

  it("yesterday's rows and readings are invisible today — state 1, nothing carried over", () => {
    const model = derive({ picks: yesterdaysPicks, bands: yesterdaysBands });
    expect(model.state).toBe(1);
    expect(model.todayPicks).toEqual([]);
    expect(model.exclusions).toEqual([]);
    expect(model.activePick).toBeNull();
    expect(model.latestOutcome).toBeNull();
  });

  it("yesterday's spent budget does not carry over — today's first pick has all three", () => {
    const model = derive({
      picks: yesterdaysPicks,
      bands: [...yesterdaysBands, band("tense", 9)],
    });
    expect(model.state).toBe(3);
    expect(model.episode?.picksUsed).toBe(0);
    expect(model.budgetRemaining).toBe(MAX_PICKS_PER_EPISODE);
    // Yesterday's exclusions are gone, so yesterday's opened item is offerable again.
    expect(model.pendingPick?.item.id).toBe("box-breathing");
  });

  it("the same rows read as yesterday's own day are fully present — nothing was destroyed", () => {
    const model = deriveCardModel({
      localDay: YESTERDAY_DAY,
      nowMs: at(17, 0, YESTERDAY),
      picks: yesterdaysPicks,
      bands: yesterdaysBands,
      ui: IDLE_CARD_UI,
      library: RECOMMENDATION_LIBRARY,
      preferences: neutralPreferenceSource,
      newEpisodeId: "episode-new",
    });
    expect(model.todayPicks).toHaveLength(3);
    expect(model.budgetRemaining).toBe(0);
    expect([...model.exclusions].sort()).toEqual([
      "box-breathing",
      "feet-on-the-floor",
      "roll-your-shoulders",
    ]);
  });

  it("an in-flight outcome prompt does not survive the boundary either", () => {
    const model = derive({
      picks: yesterdaysPicks,
      bands: yesterdaysBands,
      ui: ui({ instructionsClosedAfterOpening: true }),
    });
    expect(model.state).toBe(1); // not 6 — there is no pick to ask about
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-013 — quiet updates; the card never restates the band
// ─────────────────────────────────────────────────────────────────────────────

describe("FR-013 — only a confirmed detection makes the card prominent", () => {
  it("an uneasy reading and a tense reading both land in state 3 while unconfirmed", () => {
    expect(derive({ bands: [band("a_little_tense", 10)] }).state).toBe(3);
    expect(derive({ bands: [band("tense", 10)] }).state).toBe(3);
  });

  it("state 4 requires `confirmed_at` on the active row, nothing else", () => {
    const row = pick({ itemId: "box-breathing" });
    expect(derive({ picks: [row] }).state).toBe(3);
    expect(derive({ picks: [{ ...row, confirmedAtMs: at(10, 30) }] }).state).toBe(4);
  });
});
