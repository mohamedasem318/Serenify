import { describe, expect, it } from "vitest";

import * as library from "@/lib/recommendations/library";
import {
  AT_REST_FORWARD_LINE,
  buildAtRestFallbackText,
  buildCalmFallbackText,
  CALM_FORWARD_LINE,
  LIBRARY_ITEM_ID_PATTERN,
  OUTCOME_ACKNOWLEDGEMENT,
  RECOMMENDATION_CATEGORIES,
  RECOMMENDATION_LIBRARY,
  REFLECTIVE_COPY_MAX_LENGTH,
  type AtRestReflectionFacts,
  type CalmReflectionFacts,
  type LibraryItem,
  type RecommendationCategory,
} from "@/lib/recommendations/library";

/**
 * T006 — the STRUCTURAL guard over the recommendation library and the card's deterministic
 * strings (tasks.md Phase 2).
 *
 * SCOPE, stated plainly so nobody reads more into a green run than is there: this file
 * guards *structure* and *voice mechanics* — the fixed category set and its declared order,
 * the per-category counts, slug shape and uniqueness, non-empty fields, the absence of
 * placeholder tokens and exclamation marks, the forbidden clinical/alarmist vocabulary, and
 * the fallback builders' length and fact-discipline.
 *
 * CONTENT SAFETY IS NOT CLAIMED HERE. Whether an item recommends physical discomfort, a
 * substance, something clinical, something outcome-claiming, something requiring leaving the
 * workplace, or anything touching crisis territory (FR-007/FR-008/FR-009) is decided by
 * Mohamed's line-by-line review — task T005, a blocking human gate. A passing suite means
 * the library is well-formed, never that it is approved.
 *
 * The declared order asserted below is part of the deterministic selection contract (R-10,
 * contracts/selection-engine.md §4–5), not cosmetics: reordering changes what people see.
 */

// ─────────────────────────────────────────────────────────────────────────────
// The scan corpus — every reviewed string this module ships
//
// Collected from the module NAMESPACE rather than a hand-written list, so a string
// constant added later is covered without anyone remembering to add it here.
// ─────────────────────────────────────────────────────────────────────────────

const CALM_THREE_CHECKINS: CalmReflectionFacts = {
  checkinCount: 3,
  times: ["9:40", "11:15", "2:30"],
  bandLabels: ["Calm"],
};
const CALM_NO_CHECKINS: CalmReflectionFacts = { checkinCount: 0, times: [], bandLabels: [] };

const CALM_FACTS: CalmReflectionFacts[] = [
  CALM_THREE_CHECKINS,
  { checkinCount: 1, times: ["9:40"], bandLabels: ["Calm"] },
  { checkinCount: 2, times: ["9:40", "11:15"], bandLabels: ["Calm"] },
  {
    checkinCount: 6,
    times: ["9:05", "9:40", "11:15", "1:20", "2:30", "4:45"],
    bandLabels: ["Calm"],
  },
  { checkinCount: 2, times: ["9:40", "11:15"], bandLabels: [] },
  CALM_NO_CHECKINS,
];

const AT_REST_TRIED_AT: AtRestReflectionFacts = {
  checkinCount: 3,
  times: ["9:40", "11:15", "2:30"],
  bandLabels: ["Calm", "Uneasy"],
  triedItemTitle: "Box breathing",
  triedAtLabel: "2:20",
};

const AT_REST_FACTS: AtRestReflectionFacts[] = [
  AT_REST_TRIED_AT,
  {
    checkinCount: 2,
    times: ["9:40", "2:30"],
    bandLabels: ["Tense"],
    triedItemTitle: "Look out a window",
  },
  { checkinCount: 1, times: ["9:40"], bandLabels: ["Uneasy"] },
];

const builderOutputs: string[] = [
  ...CALM_FACTS.map(buildCalmFallbackText),
  ...AT_REST_FACTS.map(buildAtRestFallbackText),
];

/** Every string exported by the module, flattening exported string arrays. */
const exportedStrings: string[] = Object.values(
  library as Record<string, unknown>,
).flatMap((value) => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return value as string[];
  }
  return [];
});

/** Every string on every library item. */
const itemStrings: string[] = RECOMMENDATION_LIBRARY.flatMap((item) => [
  item.id,
  item.category,
  item.title,
  item.whyLine,
  item.durationLabel,
  ...item.steps,
  ...(item.footNote ? [item.footNote] : []),
]);

/** The whole reviewed surface: constants, item copy, and what the builders actually emit. */
const CORPUS: string[] = [...exportedStrings, ...itemStrings, ...builderOutputs];

const describeString = (s: string) => (s.length > 70 ? `${s.slice(0, 70)}…` : s);

// ─────────────────────────────────────────────────────────────────────────────

describe("categories — the fixed set, in declared order", () => {
  it("declares exactly the five categories, in the contract's order", () => {
    expect(RECOMMENDATION_CATEGORIES).toEqual([
      "breathing_grounding",
      "movement",
      "sensory_reset",
      "taking_a_break",
      "connection",
    ]);
  });

  it("has no sixth category anywhere in the library", () => {
    const declared = new Set<string>(RECOMMENDATION_CATEGORIES);
    const used = new Set(RECOMMENDATION_LIBRARY.map((item) => item.category as string));
    expect([...used].sort()).toEqual([...declared].sort());
    for (const item of RECOMMENDATION_LIBRARY) {
      expect(declared.has(item.category), `${item.id} has an undeclared category`).toBe(true);
    }
  });
});

describe("library shape — v1 is five categories of three", () => {
  it("holds exactly fifteen items", () => {
    expect(RECOMMENDATION_LIBRARY).toHaveLength(15);
  });

  it.each(RECOMMENDATION_CATEGORIES)("category %s carries at least three items", (category) => {
    const items = RECOMMENDATION_LIBRARY.filter((item) => item.category === category);
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it("carries exactly three items per category in v1", () => {
    const counts = new Map<RecommendationCategory, number>();
    for (const item of RECOMMENDATION_LIBRARY) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    for (const category of RECOMMENDATION_CATEGORIES) {
      expect(counts.get(category), `${category} item count`).toBe(3);
    }
  });

  it("groups each category's items contiguously, so declared order is readable", () => {
    const firstIndex = new Map<RecommendationCategory, number>();
    RECOMMENDATION_LIBRARY.forEach((item, index) => {
      if (!firstIndex.has(item.category)) firstIndex.set(item.category, index);
    });
    const order = [...firstIndex.keys()];
    expect(order).toEqual([...RECOMMENDATION_CATEGORIES]);
  });
});

describe("slugs — the join key into recommendation_picks.item_id", () => {
  it("matches the database CHECK regex on every item", () => {
    for (const item of RECOMMENDATION_LIBRARY) {
      expect(LIBRARY_ITEM_ID_PATTERN.test(item.id), `${item.id} slug shape`).toBe(true);
    }
  });

  it("is unique across the library", () => {
    const ids = RECOMMENDATION_LIBRARY.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("item fields — nothing empty renders", () => {
  const required: (keyof LibraryItem)[] = ["title", "whyLine", "durationLabel"];

  it.each(RECOMMENDATION_LIBRARY.map((item) => [item.id, item] as const))(
    "%s has non-empty copy and 3–6 non-empty steps",
    (_id, item) => {
      for (const field of required) {
        expect(String(item[field]).trim().length, `${item.id}.${field}`).toBeGreaterThan(0);
      }
      expect(item.steps.length).toBeGreaterThanOrEqual(3);
      expect(item.steps.length).toBeLessThanOrEqual(6);
      for (const [i, step] of item.steps.entries()) {
        expect(step.trim().length, `${item.id} step ${i + 1}`).toBeGreaterThan(0);
      }
      if (item.footNote !== undefined) {
        expect(item.footNote.trim().length, `${item.id}.footNote`).toBeGreaterThan(0);
      }
    },
  );
});

describe("voice mechanics — over item copy AND every deterministic string", () => {
  it("scans a corpus that includes the fallback builders' own output", () => {
    // Guards the guard: if the corpus ever collapsed to nothing, every scan below would
    // pass vacuously.
    expect(CORPUS.length).toBeGreaterThan(80);
    expect(builderOutputs.length).toBe(CALM_FACTS.length + AT_REST_FACTS.length);
  });

  it("contains no exclamation mark anywhere (FR-028 / Principle V)", () => {
    const offenders = CORPUS.filter((s) => s.includes("!"));
    expect(offenders.map(describeString)).toEqual([]);
  });

  it("contains no placeholder token", () => {
    const placeholders =
      /\b(todo|tbd|fixme|lorem|ipsum|placeholder|dummy|sample text|coming soon|xxx+)\b/i;
    const offenders = CORPUS.filter((s) => placeholders.test(s));
    expect(offenders.map(describeString)).toEqual([]);
  });

  it("contains none of the forbidden clinical or alarmist vocabulary", () => {
    const forbidden = [/\balerts?\b/i, /\babnormal\b/i, /\belevated risk\b/i, /\bdetect(ed|ion)\b/i];
    for (const pattern of forbidden) {
      const offenders = CORPUS.filter((s) => pattern.test(s));
      expect(offenders.map(describeString), `matched ${pattern}`).toEqual([]);
    }
  });

  it("uses one acknowledgement word for states 7 and 8, so the answer is not graded", () => {
    expect(OUTCOME_ACKNOWLEDGEMENT).toBe("Noted.");
  });
});

describe("reflective fallbacks — the source of truth for states 2 and 9", () => {
  it("returns non-empty text within the validator's length cap for every fact shape", () => {
    for (const text of builderOutputs) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text.length, describeString(text)).toBeLessThanOrEqual(REFLECTIVE_COPY_MAX_LENGTH);
    }
  });

  it("state 2 pairs a specific line with the forward-looking line", () => {
    const text = buildCalmFallbackText(CALM_THREE_CHECKINS);
    expect(text).toContain("3");
    expect(text).toContain("9:40");
    expect(text).toContain("11:15");
    expect(text).toContain("2:30");
    expect(text).toContain("Calm");
    expect(text.endsWith(CALM_FORWARD_LINE)).toBe(true);
  });

  it("state 2 degrades to the forward line alone when no specific is derivable", () => {
    expect(buildCalmFallbackText(CALM_NO_CHECKINS)).toBe(CALM_FORWARD_LINE);
  });

  it("state 9 names what was tried, verbatim, and does not drop the re-arm line", () => {
    const text = buildAtRestFallbackText(AT_REST_TRIED_AT);
    expect(text).toContain("Box breathing");
    expect(text).toContain("2:20");
    expect(text.endsWith(AT_REST_FORWARD_LINE)).toBe(true);
  });

  it("invents no number or time that was not supplied as a fact", () => {
    const digitRuns = (s: string) => s.match(/\d+/g) ?? [];
    const check = (text: string, facts: AtRestReflectionFacts) => {
      const supplied = new Set<string>([
        ...digitRuns(String(facts.checkinCount)),
        ...facts.times.flatMap(digitRuns),
        ...digitRuns(facts.triedAtLabel ?? ""),
      ]);
      for (const run of digitRuns(text)) {
        expect(supplied.has(run), `"${run}" in ${describeString(text)} is not in the facts`).toBe(
          true,
        );
      }
    };
    for (const facts of CALM_FACTS) check(buildCalmFallbackText(facts), facts);
    for (const facts of AT_REST_FACTS) check(buildAtRestFallbackText(facts), facts);
  });

  it("is a pure function of its facts", () => {
    expect(buildCalmFallbackText(CALM_THREE_CHECKINS)).toBe(
      buildCalmFallbackText(CALM_THREE_CHECKINS),
    );
    expect(buildAtRestFallbackText(AT_REST_TRIED_AT)).toBe(
      buildAtRestFallbackText(AT_REST_TRIED_AT),
    );
  });
});
