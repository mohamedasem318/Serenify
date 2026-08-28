import { describe, expect, it } from "vitest";

import type { Band } from "@/lib/api/monitoring-client";
import {
  CATEGORY_RULE_TABLE,
  MAX_PICKS_PER_EPISODE,
  MIN_CATEGORY_AFFINITY,
  isPickWarranted,
  nonRepeatExclusions,
  peakBand,
  rankCategories,
  selectPick,
  timeOfDaySegment,
  type DayBandReading,
  type PickHistoryEntry,
  type SelectPickInput,
} from "@/lib/recommendations/engine";
import {
  RECOMMENDATION_CATEGORIES,
  RECOMMENDATION_LIBRARY,
  type LibraryItem,
  type RecommendationCategory,
} from "@/lib/recommendations/library";
import {
  NEUTRAL_AFFINITY,
  neutralPreferenceSource,
  type PreferenceSource,
} from "@/lib/recommendations/preference-source";

/**
 * T008 — the deterministic selection engine, and T007's seam proof
 * (`contracts/selection-engine.md`; spec FR-002/FR-003/FR-005/FR-006/FR-018; SC-001/SC-002).
 *
 * Three things this file is here to hold:
 *
 *   1. **SC-001 determinism.** Identical inputs → identical pick, 100% of runs, across the
 *      input shapes of all ten card states. Asserted by repeated calls, not by inspection.
 *   2. **Budget × non-repeat.** The budget exhausts at three surfaced picks; the non-repeat
 *      rule retires the swap EARLY when it bites first (FR-018); the state-8 replacement
 *      draws on the same budget.
 *   3. **FR-006's seam.** A fake non-neutral `PreferenceSource` re-ranks selection with ZERO
 *      edits to `engine.ts`. If this ever needs an engine change to pass, feature 015's
 *      whole plan has quietly broken.
 *
 * All fixtures build times with the LOCAL `Date` constructor, so the time-of-day segments
 * are the same on any runner's zone (the `monitoring-reads.test.ts` convention).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

/** A local wall-clock instant today, in epoch ms — zone-independent by construction. */
function atLocalHour(hour: number, minute = 0): number {
  const d = new Date(2026, 7, 16, hour, minute, 0, 0);
  return d.getTime();
}

function reading(band: Band, hour: number): DayBandReading {
  return { band, atMs: atLocalHour(hour) };
}

function historyEntry(
  itemId: string,
  flags: Partial<Omit<PickHistoryEntry, "itemId" | "category">> = {},
): PickHistoryEntry {
  const item = RECOMMENDATION_LIBRARY.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error(`fixture references an item outside the library: ${itemId}`);
  return {
    itemId,
    category: item.category,
    opened: false,
    swappedAway: false,
    outcome: null,
    ...flags,
  };
}

const EPISODE = { id: "episode-1", picksUsed: 1 };

function input(overrides: Partial<SelectPickInput> = {}): SelectPickInput {
  return {
    dayBands: [reading("a_little_tense", 10)],
    nowMs: atLocalHour(10, 30),
    todayHistory: [],
    episode: { id: "episode-1", picksUsed: 0 },
    preferences: neutralPreferenceSource,
    library: RECOMMENDATION_LIBRARY,
    ...overrides,
  };
}

/** A fake source that leans hard toward one category and away from everything else. */
function leaningSource(favourite: RecommendationCategory, weight = 10): PreferenceSource {
  return { categoryAffinity: (category) => (category === favourite ? weight : NEUTRAL_AFFINITY) };
}

const itemsIn = (category: RecommendationCategory): readonly LibraryItem[] =>
  RECOMMENDATION_LIBRARY.filter((item) => item.category === category);

// ─────────────────────────────────────────────────────────────────────────────
// The rule table is DATA, and its shape is part of the contract
// ─────────────────────────────────────────────────────────────────────────────

describe("the rule table (contract rule 4 — reviewable data in the module)", () => {
  it("covers every (tenor × time-of-day) combination exactly once", () => {
    const keys = CATEGORY_RULE_TABLE.map((row) => `${row.tenor}/${row.segment}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(2 * 4);
  });

  it("gives every one of the five categories a finite positive weight in every row", () => {
    for (const row of CATEGORY_RULE_TABLE) {
      for (const category of RECOMMENDATION_CATEGORIES) {
        const weight = row.weights[category];
        expect(Number.isFinite(weight)).toBe(true);
        expect(weight).toBeGreaterThan(0);
      }
    }
  });

  it("never zeroes a reviewed category out of selection entirely", () => {
    // A weight of 0 would make an item that passed the FR-007/8/9 review permanently
    // unreachable — a content decision smuggled in as a number.
    const allWeights = CATEGORY_RULE_TABLE.flatMap((row) => Object.values(row.weights));
    expect(Math.min(...allWeights)).toBeGreaterThan(0);
  });
});

describe("time-of-day segmentation", () => {
  it.each([
    [0, "night"],
    [4, "night"],
    [5, "morning"],
    [8, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [16, "afternoon"],
    [17, "evening"],
    [20, "evening"],
    [21, "night"],
    [23, "night"],
  ] as const)("local hour %i is %s", (hour, segment) => {
    expect(timeOfDaySegment(atLocalHour(hour))).toBe(segment);
  });
});

describe("peak band and warrant (contract rule 1)", () => {
  it("takes the peak, not the latest — a tense morning sets the day's tenor", () => {
    expect(
      peakBand([reading("at_ease", 9), reading("tense", 10), reading("a_little_tense", 15)]),
    ).toBe("tense");
  });

  it("is null with no readings", () => {
    expect(peakBand([])).toBeNull();
  });

  it.each([
    [[], false],
    [[reading("at_ease", 9)], false],
    [[reading("at_ease", 9), reading("at_ease", 14)], false],
    [[reading("a_little_tense", 9)], true],
    [[reading("tense", 9)], true],
    [[reading("at_ease", 9), reading("tense", 15)], true],
  ] as const)("warrant over %#", (bands, warranted) => {
    expect(isPickWarranted(bands)).toBe(warranted);
  });

  it("returns null when nothing today warrants a pick (states 1 and 2 render instead)", () => {
    expect(selectPick(input({ dayBands: [] }))).toBeNull();
    expect(selectPick(input({ dayBands: [reading("at_ease", 9)] }))).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SC-001 — determinism, across all ten states' input shapes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row per FR-001 card state. Each names the input SHAPE that state presents to the
 * engine, so SC-002 reachability is exercised from the engine's side too: a state that
 * expects no pick asserts `null`, a state that expects one asserts a library member.
 */
const TEN_STATE_SHAPES: readonly {
  state: number;
  name: string;
  input: SelectPickInput;
  expectsPick: boolean;
}[] = [
  {
    state: 1,
    name: "no reading yet today",
    input: input({ dayBands: [] }),
    expectsPick: false,
  },
  {
    state: 2,
    name: "calm",
    input: input({ dayBands: [reading("at_ease", 9), reading("at_ease", 13)] }),
    expectsPick: false,
  },
  {
    state: 3,
    name: "uneasy, unconfirmed — the first pick of an episode",
    input: input({ dayBands: [reading("a_little_tense", 10)] }),
    expectsPick: true,
  },
  {
    state: 4,
    name: "confirmed detection — same inputs, prominence is not the engine's business",
    input: input({ dayBands: [reading("tense", 10)] }),
    expectsPick: true,
  },
  {
    state: 5,
    name: "item expanded — the active pick is not yet opened in history",
    input: input({
      dayBands: [reading("tense", 10)],
      episode: EPISODE,
      todayHistory: [historyEntry("box-breathing")],
    }),
    expectsPick: true,
  },
  {
    state: 6,
    name: "outcome prompt pending — the pick is opened, so it is excluded",
    input: input({
      dayBands: [reading("tense", 10)],
      episode: EPISODE,
      todayHistory: [historyEntry("box-breathing", { opened: true })],
    }),
    expectsPick: true,
  },
  {
    state: 7,
    name: "recorded, helped",
    input: input({
      dayBands: [reading("tense", 10)],
      episode: EPISODE,
      todayHistory: [historyEntry("box-breathing", { opened: true, outcome: "helped" })],
    }),
    expectsPick: true,
  },
  {
    state: 8,
    name: "recorded, didn't help — the replacement draws on the same budget",
    input: input({
      dayBands: [reading("tense", 10)],
      episode: EPISODE,
      todayHistory: [historyEntry("box-breathing", { opened: true, outcome: "didnt_help" })],
    }),
    expectsPick: true,
  },
  {
    state: 9,
    name: "at rest — budget spent",
    input: input({
      dayBands: [reading("tense", 10)],
      episode: { id: "episode-1", picksUsed: MAX_PICKS_PER_EPISODE },
      todayHistory: [
        historyEntry("box-breathing", { opened: true, outcome: "didnt_help" }),
        historyEntry("feet-on-the-floor", { swappedAway: true }),
        historyEntry("three-two-one-around-you", { opened: true, outcome: "helped" }),
      ],
    }),
    expectsPick: false,
  },
  {
    state: 10,
    name: "swapped away — the next pick appears",
    input: input({
      dayBands: [reading("tense", 10)],
      episode: EPISODE,
      todayHistory: [historyEntry("box-breathing", { swappedAway: true })],
    }),
    expectsPick: true,
  },
];

describe("SC-001 — determinism across all ten card states' input shapes", () => {
  it.each(TEN_STATE_SHAPES)("state $state ($name) is stable over repeated calls", (shape) => {
    const first = selectPick(shape.input);
    for (let run = 0; run < 50; run += 1) {
      const again = selectPick(shape.input);
      expect(again?.item.id ?? null).toBe(first?.item.id ?? null);
      expect(again?.episodeId ?? null).toBe(first?.episodeId ?? null);
    }
    if (shape.expectsPick) {
      expect(first).not.toBeNull();
      // FR-007 — the engine can only return a member of the library it was passed.
      expect(RECOMMENDATION_LIBRARY.some((item) => item.id === first?.item.id)).toBe(true);
    } else {
      expect(first).toBeNull();
    }
  });

  it("does not mutate its inputs — a second caller sees what the first one passed", () => {
    const shape = input({
      dayBands: [reading("tense", 10)],
      todayHistory: [historyEntry("box-breathing", { opened: true })],
    });
    const snapshot = JSON.stringify(shape.todayHistory);
    selectPick(shape);
    expect(JSON.stringify(shape.todayHistory)).toBe(snapshot);
  });

  it("reads no clock — the same inputs at a different injected nowMs stay self-consistent", () => {
    // The pick MAY differ across segments (that is the rule table doing its job); what must
    // not happen is a different answer for the same injected instant.
    for (const hour of [1, 9, 13, 18, 22]) {
      const shape = input({ dayBands: [reading("tense", 10)], nowMs: atLocalHour(hour) });
      expect(selectPick(shape)?.item.id).toBe(selectPick(shape)?.item.id);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Budget × non-repeat (contract rules 2 and 3, FR-018)
// ─────────────────────────────────────────────────────────────────────────────

describe("rule 2 — the episode budget", () => {
  it("is three", () => {
    expect(MAX_PICKS_PER_EPISODE).toBe(3);
  });

  it.each([0, 1, 2])("still offers a pick at picksUsed = %i", (picksUsed) => {
    expect(selectPick(input({ episode: { id: "e", picksUsed } }))).not.toBeNull();
  });

  it.each([3, 4])("offers nothing at picksUsed = %i", (picksUsed) => {
    expect(selectPick(input({ episode: { id: "e", picksUsed } }))).toBeNull();
  });

  it("counts SURFACED picks — a stamped pick with no successor row charges nothing extra", () => {
    // Amendment 2026-08-16: budget consumption counts rows that landed, never stamps. The
    // engine sees that as `picksUsed` simply not having advanced, so a pick is still on
    // offer after a failed swap.
    const afterFailedSwap = input({
      episode: { id: "e", picksUsed: 1 },
      todayHistory: [historyEntry("box-breathing", { swappedAway: true })],
    });
    expect(selectPick(afterFailedSwap)).not.toBeNull();
    expect(selectPick(afterFailedSwap)?.item.id).not.toBe("box-breathing");
  });

  it("attributes the pick to the open episode", () => {
    expect(selectPick(input({ episode: { id: "episode-77", picksUsed: 1 } }))?.episodeId).toBe(
      "episode-77",
    );
  });

  it("opens a new episode only with an injected id, and never invents one", () => {
    expect(selectPick(input({ episode: null, newEpisodeId: "episode-new" }))?.episodeId).toBe(
      "episode-new",
    );
    // Fail closed: `episode_id` is NOT NULL in the schema, so an unattributable pick is
    // no pick at all.
    expect(selectPick(input({ episode: null }))).toBeNull();
  });
});

describe("rule 3 — non-repeat within the day", () => {
  it("excludes items opened or swapped away, and nothing else", () => {
    const excluded = nonRepeatExclusions([
      historyEntry("box-breathing", { opened: true }),
      historyEntry("feet-on-the-floor", { swappedAway: true }),
      historyEntry("three-two-one-around-you"),
    ]);
    expect([...excluded].sort()).toEqual(["box-breathing", "feet-on-the-floor"]);
  });

  it("never re-offers an opened item, even with the whole budget intact", () => {
    const pick = selectPick(
      input({
        episode: { id: "e", picksUsed: 0 },
        todayHistory: [historyEntry("box-breathing", { opened: true })],
      }),
    );
    expect(pick?.item.id).not.toBe("box-breathing");
  });

  it("falls through to the next ranked category once one is exhausted (contract rule 5)", () => {
    const breathing = itemsIn("breathing_grounding");
    const pick = selectPick(
      input({
        dayBands: [reading("tense", 10)],
        nowMs: atLocalHour(10),
        episode: { id: "e", picksUsed: 0 },
        todayHistory: breathing.map((item) => historyEntry(item.id, { opened: true })),
      }),
    );
    // tense/morning ranks breathing_grounding first; exhausted, it falls to movement.
    expect(pick?.item.category).toBe("movement");
  });

  it("BEATS the budget — the swap retires early when exclusions leave nothing (FR-018)", () => {
    const everythingOpened = RECOMMENDATION_LIBRARY.map((item) =>
      historyEntry(item.id, { opened: true }),
    );
    const pick = selectPick(
      input({
        // Budget completely untouched…
        episode: { id: "e", picksUsed: 0 },
        todayHistory: everythingOpened,
      }),
    );
    // …and still nothing, because the non-repeat rule wins.
    expect(pick).toBeNull();
  });

  it("state 8's replacement draws from the SAME budget, not a second allowance", () => {
    const answered = historyEntry("box-breathing", { opened: true, outcome: "didnt_help" });
    // Two picks surfaced so far → one slot left → a replacement is offered.
    expect(
      selectPick(input({ episode: { id: "e", picksUsed: 2 }, todayHistory: [answered] })),
    ).not.toBeNull();
    // Three surfaced → the no-replacement variant, even though 14 items are still eligible.
    expect(
      selectPick(input({ episode: { id: "e", picksUsed: 3 }, todayHistory: [answered] })),
    ).toBeNull();
  });

  it("returns null on an empty library rather than throwing (FR-030)", () => {
    expect(selectPick(input({ library: [] }))).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Category ranking and the declared-order tiebreak (contract rules 4 and 5)
// ─────────────────────────────────────────────────────────────────────────────

describe("rule 4 — category ranking", () => {
  it("ranks all five categories, always", () => {
    const ranked = rankCategories("tense", "morning", neutralPreferenceSource);
    expect([...ranked].sort()).toEqual([...RECOMMENDATION_CATEGORIES].sort());
  });

  it("leads with breathing_grounding on every tense row", () => {
    for (const segment of ["morning", "afternoon", "evening", "night"] as const) {
      expect(rankCategories("tense", segment, neutralPreferenceSource)[0]).toBe(
        "breathing_grounding",
      );
    }
  });

  it("breaks the tense/afternoon tie by DECLARED category order, not by object key order", () => {
    // movement (65) === taking_a_break (65); movement is declared earlier, so it wins.
    const ranked = rankCategories("tense", "afternoon", neutralPreferenceSource);
    expect(ranked.indexOf("movement")).toBeLessThan(ranked.indexOf("taking_a_break"));
    expect(RECOMMENDATION_CATEGORIES.indexOf("movement")).toBeLessThan(
      RECOMMENDATION_CATEGORIES.indexOf("taking_a_break"),
    );
  });

  it("varies with the time of day on the same tenor", () => {
    const morning = rankCategories("a_little_tense", "morning", neutralPreferenceSource);
    const evening = rankCategories("a_little_tense", "evening", neutralPreferenceSource);
    expect(morning[0]).not.toBe(evening[0]);
  });

  it("takes the first item in DECLARED order within the chosen category", () => {
    const pick = selectPick(
      input({ dayBands: [reading("tense", 10)], nowMs: atLocalHour(10) }),
    );
    expect(pick?.item.id).toBe(itemsIn("breathing_grounding")[0]?.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-006 — the preference seam, proven with ZERO engine edits
// ─────────────────────────────────────────────────────────────────────────────

describe("FR-006 — the preference seam (T007)", () => {
  it("the neutral source weights every category identically", () => {
    for (const category of RECOMMENDATION_CATEGORIES) {
      expect(neutralPreferenceSource.categoryAffinity(category)).toBe(NEUTRAL_AFFINITY);
    }
  });

  it("a fake non-neutral source re-ranks selection — no engine change required", () => {
    const shape = { dayBands: [reading("tense", 10)], nowMs: atLocalHour(10) };
    const neutral = selectPick(input({ ...shape, preferences: neutralPreferenceSource }));
    expect(neutral?.item.category).toBe("breathing_grounding");

    for (const favourite of RECOMMENDATION_CATEGORIES) {
      const leaning = selectPick(input({ ...shape, preferences: leaningSource(favourite) }));
      expect(leaning?.item.category).toBe(favourite);
      expect(leaning?.item.id).toBe(itemsIn(favourite)[0]?.id);
    }
  });

  it("a leaning source is still deterministic", () => {
    const shape = input({
      dayBands: [reading("tense", 10)],
      preferences: leaningSource("connection"),
    });
    const first = selectPick(shape)?.item.id;
    for (let run = 0; run < 25; run += 1) expect(selectPick(shape)?.item.id).toBe(first);
  });

  it("a source that returns 0 re-orders but never censors — the floor holds", () => {
    const silencing: PreferenceSource = { categoryAffinity: () => 0 };
    const pick = selectPick(input({ dayBands: [reading("tense", 10)], preferences: silencing }));
    expect(pick).not.toBeNull();
    expect(MIN_CATEGORY_AFFINITY).toBeGreaterThan(0);
    // Scaling every category by the same floor leaves the rule table's order intact.
    expect(pick?.item.category).toBe("breathing_grounding");
  });

  it.each([NaN, Infinity, -1])("degrades a bad affinity (%s) to neutral rather than throwing", (bad) => {
    const broken: PreferenceSource = { categoryAffinity: () => bad as number };
    const pick = selectPick(input({ dayBands: [reading("tense", 10)], preferences: broken }));
    expect(pick?.item.category).toBe("breathing_grounding");
  });

  it("a source that THROWS degrades to neutral — nothing reaches the surface (FR-030)", () => {
    const throwing: PreferenceSource = {
      categoryAffinity: () => {
        throw new Error("015 source blew up");
      },
    };
    expect(() =>
      selectPick(input({ dayBands: [reading("tense", 10)], preferences: throwing })),
    ).not.toThrow();
  });
});
