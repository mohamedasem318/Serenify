import { describe, expect, it } from "vitest";

import {
  REFLECTIVE_COPY_MAX_LENGTH,
  buildAtRestFallbackText,
  buildCalmFallbackText,
} from "@/lib/recommendations/library";
import {
  type ReflectiveFacts,
  validateReflectiveCopy,
} from "@/lib/recommendations/reflective-copy-validation";

/**
 * Feature 014 — T021. SC-004's zero-fabrication clause, from the hostile side.
 *
 * The validator's whole job is to disbelieve the model, so these fixtures are written as
 * an adversary would write them: numbers hidden inside words, a supplied time
 * re-punctuated, a band word in the wrong case, the real count swapped for a neighbouring
 * numeral. A fixture that only tests the obvious ("the model said 47 out of nowhere")
 * would leave the interesting half of the rule unwatched.
 *
 * The PASS fixtures are re-phrasings of the real deterministic builders' output — the
 * strings this validator exists to let through (`contracts/reflective-copy.md`: the
 * fallback is the source of truth for *what* is said, generation changes only *how*).
 */

const CALM_FACTS_BASE = {
  checkinCount: 3,
  times: ["9:40", "11:15", "2:30"],
  bandLabels: ["Calm"],
};

const calmFacts = (): ReflectiveFacts => ({
  state: 2,
  ...CALM_FACTS_BASE,
  fallbackText: buildCalmFallbackText(CALM_FACTS_BASE),
});

const AT_REST_FACTS_BASE = {
  checkinCount: 2,
  times: ["9:40", "2:30"],
  bandLabels: ["Uneasy"],
  triedItemTitle: "Box breathing",
  triedAtLabel: "2:20",
};

const atRestFacts = (): ReflectiveFacts => ({
  state: 9,
  ...AT_REST_FACTS_BASE,
  fallbackText: buildAtRestFallbackText(AT_REST_FACTS_BASE),
});

describe("validateReflectiveCopy — the deterministic strings themselves", () => {
  it("accepts the state-2 builder's own output (the fallback must always validate)", () => {
    const facts = calmFacts();
    expect(validateReflectiveCopy(facts.fallbackText, facts)).toEqual({ ok: true });
  });

  it("accepts the state-9 builder's own output", () => {
    const facts = atRestFacts();
    expect(validateReflectiveCopy(facts.fallbackText, facts)).toEqual({ ok: true });
  });

  it("accepts the state-2 no-band shape (count as subject, no band word anywhere)", () => {
    const base = { checkinCount: 1, times: ["9:40"], bandLabels: [] };
    const facts: ReflectiveFacts = {
      state: 2,
      ...base,
      fallbackText: buildCalmFallbackText(base),
    };
    expect(validateReflectiveCopy(facts.fallbackText, facts)).toEqual({ ok: true });
  });
});

describe("validateReflectiveCopy — valid re-phrasings pass", () => {
  it("accepts a re-ordered sentence using only supplied facts", () => {
    const facts = calmFacts();
    const text =
      "All 3 of today's check-ins — 9:40, 11:15 and 2:30 — came back Calm. " +
      "Suggestions show up here when something shifts.";
    expect(validateReflectiveCopy(text, facts)).toEqual({ ok: true });
  });

  it("accepts a re-phrasing that mentions fewer facts than it was given", () => {
    const facts = calmFacts();
    expect(validateReflectiveCopy("Calm across today's check-ins so far.", facts)).toEqual({
      ok: true,
    });
  });

  it("accepts a lower-case band word against the 'Calm' display label", () => {
    // Case-insensitive by design: re-casing a supplied label mid-sentence is phrasing,
    // not a new claim.
    const facts = calmFacts();
    expect(validateReflectiveCopy("Today read calm at 9:40.", facts)).toEqual({ ok: true });
  });

  it("accepts the item title verbatim even though the state-9 time sits beside it", () => {
    const facts = atRestFacts();
    const text = "Box breathing was what you reached for at 2:20 today.";
    expect(validateReflectiveCopy(text, facts)).toEqual({ ok: true });
  });

  it("accepts words that merely CONTAIN a band word ('intense', 'calmly')", () => {
    // A substring scan would reject both and push good copy to the fallback for no
    // reason — the rule is about band CLAIMS, not about the letters.
    const facts = { ...calmFacts(), bandLabels: [] };
    expect(validateReflectiveCopy("The morning passed calmly enough.", facts)).toEqual({
      ok: true,
    });
    expect(validateReflectiveCopy("Nothing intense stood out today.", facts)).toEqual({
      ok: true,
    });
  });
});

describe("validateReflectiveCopy — fabricated numbers", () => {
  it("rejects a count that was never supplied", () => {
    const facts = calmFacts();
    expect(validateReflectiveCopy("Calm at all 4 check-ins today.", facts)).toEqual({
      ok: false,
      reason: "fabricated_number",
    });
  });

  it("rejects the supplied count re-written as a different numeral", () => {
    const facts = calmFacts(); // count 3
    expect(validateReflectiveCopy("Calm at all 8 check-ins today.", facts)).toEqual({
      ok: false,
      reason: "fabricated_number",
    });
  });

  it("documents the known limit: a run supplied by a TIME can be re-used as a count", () => {
    // With times ["9:40", "11:15", "2:30"] the run "30" is a supplied maximal run, so
    // "30 check-ins" passes rule 1 even though the real count is 3. This is the
    // contract's rule as written ("every maximal digit run … appears verbatim in the
    // facts"), not a defect in the implementation — it is pinned here so that a future
    // tightening is a deliberate, visible change rather than an accident.
    const facts = calmFacts();
    expect(validateReflectiveCopy("Calm at all 30 check-ins today.", facts)).toEqual({
      ok: true,
    });
  });

  it("rejects a digit hidden inside a word", () => {
    const facts = calmFacts();
    expect(validateReflectiveCopy("Calm on day7 of the week.", facts)).toEqual({
      ok: false,
      reason: "fabricated_number",
    });
  });

  it("rejects a number assembled from supplied digits ('940' from '9:40')", () => {
    // Substring containment would let this through; membership of the maximal-run set
    // does not.
    const facts = calmFacts();
    expect(validateReflectiveCopy("Calm since 940 this morning.", facts)).toEqual({
      ok: false,
      reason: "fabricated_number",
    });
  });

  it("rejects an invented duration", () => {
    const facts = atRestFacts();
    expect(
      validateReflectiveCopy("Box breathing took 5 minutes at 2:20.", facts),
    ).toEqual({ ok: false, reason: "fabricated_number" });
  });
});

describe("validateReflectiveCopy — fabricated times", () => {
  it("rejects a clock time that was never supplied", () => {
    // Built from its OWN base so `fallbackText` carries no other time — a fixture that
    // reused the three-time fallback would be smuggling 11:15 in through the corpus.
    const base = { checkinCount: 1, times: ["9:40"], bandLabels: ["Calm"] };
    const facts: ReflectiveFacts = {
      state: 2,
      ...base,
      fallbackText: buildCalmFallbackText(base),
    };
    expect(validateReflectiveCopy("Calm at 9:40 and 11:15.", facts)).toEqual({
      ok: false,
      reason: "fabricated_number", // 11 and 15 are not supplied digits either — first rule wins
    });
  });

  it("rejects a supplied time re-punctuated ('9.40' for '9:40')", () => {
    // Every DIGIT here was supplied, so only the time rule can catch it — this is the
    // fixture that proves rule 2 is doing real work.
    const facts = calmFacts();
    expect(validateReflectiveCopy("Calm from 9.40 onwards.", facts)).toEqual({
      ok: false,
      reason: "fabricated_time",
    });
  });

  it("rejects a meridiem the facts never carried ('9:40 am')", () => {
    const facts = calmFacts();
    expect(validateReflectiveCopy("Calm at 9:40 am today.", facts)).toEqual({
      ok: false,
      reason: "fabricated_time",
    });
  });

  it("rejects a bare-hour meridiem built from a supplied digit ('9 pm')", () => {
    const facts = calmFacts();
    expect(validateReflectiveCopy("Calm right through to 9 pm.", facts)).toEqual({
      ok: false,
      reason: "fabricated_time",
    });
  });
});

describe("validateReflectiveCopy — fabricated bands", () => {
  it("rejects a band word absent from bandLabels", () => {
    const facts = calmFacts(); // ["Calm"]
    expect(validateReflectiveCopy("Today looked tense around 2:30.", facts)).toEqual({
      ok: false,
      reason: "fabricated_band",
    });
  });

  it("rejects a band word in a different case when it is still not supplied", () => {
    const facts = calmFacts();
    expect(validateReflectiveCopy("UNEASY is how 11:15 read.", facts)).toEqual({
      ok: false,
      reason: "fabricated_band",
    });
  });

  it("rejects the internal enum spelling even though \\b never fires inside it", () => {
    const facts = { ...calmFacts(), bandLabels: ["Tense"] };
    expect(validateReflectiveCopy("Today read a_little_tense.", facts)).toEqual({
      ok: false,
      reason: "fabricated_band",
    });
  });

  it("rejects the at_ease enum spelling against a 'Calm' label", () => {
    const facts = calmFacts();
    expect(validateReflectiveCopy("Today read at_ease throughout.", facts)).toEqual({
      ok: false,
      reason: "fabricated_band",
    });
  });

  it("does not read the band out of fallbackText — bandLabels alone is the source", () => {
    // fallbackText says "Calm …"; bandLabels is empty. The stricter corpus is the point:
    // rule 3 is the one rule the contract pins to a single field.
    const base = { checkinCount: 3, times: ["9:40"], bandLabels: ["Calm"] };
    const facts: ReflectiveFacts = {
      state: 2,
      ...base,
      bandLabels: [],
      fallbackText: buildCalmFallbackText(base),
    };
    expect(validateReflectiveCopy("Calm at all 3 check-ins today.", facts)).toEqual({
      ok: false,
      reason: "fabricated_band",
    });
  });
});

describe("validateReflectiveCopy — voice rules (FR-028)", () => {
  it("rejects an exclamation mark", () => {
    const facts = calmFacts();
    expect(validateReflectiveCopy("Calm at all 3 check-ins today!", facts)).toEqual({
      ok: false,
      reason: "exclamation",
    });
  });

  it.each([
    ["alert", "An alert day, all Calm."],
    ["alerted (inflection)", "Nothing alerted us today."],
    ["abnormal", "Nothing abnormal today."],
    ["detected", "No stress detected today."],
    ["elevated risk", "No elevated risk today."],
  ])("rejects forbidden vocabulary: %s", (_label, text) => {
    const facts = calmFacts();
    expect(validateReflectiveCopy(text, facts)).toEqual({
      ok: false,
      reason: "forbidden_vocabulary",
    });
  });

  it("reports the fabrication first when a sentence both invents and shouts", () => {
    const facts = calmFacts();
    expect(validateReflectiveCopy("Calm at all 8 check-ins today!", facts)).toEqual({
      ok: false,
      reason: "fabricated_number",
    });
  });
});

describe("validateReflectiveCopy — shape", () => {
  it("rejects text longer than the shared cap", () => {
    const facts = { ...calmFacts(), bandLabels: [] };
    const long = "Steady, unremarkable, quiet, ordinary, and settled today. ".repeat(6);
    expect(long.trim().length).toBeGreaterThan(REFLECTIVE_COPY_MAX_LENGTH);
    expect(validateReflectiveCopy(long, facts)).toEqual({ ok: false, reason: "too_long" });
  });

  it("accepts text exactly at the cap", () => {
    const facts = { ...calmFacts(), bandLabels: [] };
    const atCap = "a".repeat(REFLECTIVE_COPY_MAX_LENGTH);
    expect(validateReflectiveCopy(atCap, facts)).toEqual({ ok: true });
  });

  it("rejects an empty string", () => {
    expect(validateReflectiveCopy("", calmFacts())).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects whitespace-only text", () => {
    expect(validateReflectiveCopy("   \n\t ", calmFacts())).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("measures length after trimming, as the painted string would be", () => {
    const facts = { ...calmFacts(), bandLabels: [] };
    const padded = `  ${"a".repeat(REFLECTIVE_COPY_MAX_LENGTH)}  `;
    expect(validateReflectiveCopy(padded, facts)).toEqual({ ok: true });
  });
});
