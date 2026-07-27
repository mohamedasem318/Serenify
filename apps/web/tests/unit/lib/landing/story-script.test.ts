import { describe, expect, it } from "vitest";

import { BAND_LABEL } from "@/lib/bands";
import * as copy from "@/lib/landing/copy";
import {
  STORY_BEATS,
  THREAD_CAP,
  chaptersOf,
  firstBeatIndexOfChapter,
  trimThread,
} from "@/lib/landing/story-script";

/**
 * T092 (feature 013, US1) — the story's invariants, asserted with no DOM
 * (`research.md` §12.2 "Story invariants").
 *
 * Everything honesty-critical about the hero is a property of the SCRIPT, so it is
 * provable here rather than through a browser: the ordering that carries the page's
 * thesis, the band vocabulary, the thread cap, and — the one that would otherwise fail
 * silently — that every narration key names a string that actually exists.
 */

describe("shape (contracts/landing-hero-story.md §9.1)", () => {
  it("has exactly 17 beats", () => {
    expect(STORY_BEATS).toHaveLength(17);
  });

  it("has exactly 6 chapters, contiguous from 0", () => {
    expect(chaptersOf()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("runs for ≈42 s", () => {
    const total = STORY_BEATS.reduce((sum, beat) => sum + beat.durationMs, 0);
    expect(total).toBe(42_100);
    expect(total / 1000).toBeCloseTo(42, 0);
  });

  it("uses exactly the four named panels", () => {
    expect([...new Set(STORY_BEATS.map((beat) => beat.panel))].sort()).toEqual([
      "prompt",
      "quiet",
      "ren",
      "resolved",
    ]);
  });

  it("never advances faster than the 1.4 s floor the clock is built around", () => {
    // T097 drives one setTimeout chain at ≥1.4 s. A shorter beat would make the story
    // unreadable and would not survive the reduced-motion or pause behaviour either.
    for (const [index, beat] of STORY_BEATS.entries()) {
      expect(beat.durationMs, `beat ${index} is too short`).toBeGreaterThanOrEqual(1400);
    }
  });

  it("is frozen, so no consumer can mutate the script at runtime", () => {
    expect(Object.isFrozen(STORY_BEATS)).toBe(true);
  });
});

describe("the thesis: the false alarm resolves BEFORE the companion appears (SC-002)", () => {
  it("asserts the ordering as an invariant, not a convention", () => {
    // FR-006. This is the page's whole argument — that being wrong costs the person
    // nothing, which is what makes the asking safe. A page that led with the companion
    // would be arguing the product's value is the chat. Reordering the script must fail
    // HERE, loudly, and not merely look different in a browser nobody is watching.
    const resolvedChapter = STORY_BEATS.find((beat) => beat.panel === "resolved")?.chapter;
    const firstCompanionChapter = STORY_BEATS.find((beat) => beat.panel === "ren")?.chapter;

    expect(resolvedChapter).toBeDefined();
    expect(firstCompanionChapter).toBeDefined();
    expect(resolvedChapter as number).toBeLessThan(firstCompanionChapter as number);
  });

  it("resolves the false alarm exactly once, so it reads as an outcome and not a motif", () => {
    expect(STORY_BEATS.filter((beat) => beat.panel === "resolved")).toHaveLength(1);
  });
});

describe("band vocabulary (SC-011)", () => {
  it("uses only bands that BAND_LABEL knows about", () => {
    const known = Object.keys(BAND_LABEL);
    for (const [index, beat] of STORY_BEATS.entries()) {
      expect(known, `beat ${index} uses an unknown band "${beat.band}"`).toContain(beat.band);
    }
  });

  it("actually exercises all three, so the readout is not effectively static", () => {
    expect(new Set(STORY_BEATS.map((beat) => beat.band)).size).toBe(3);
  });
});

describe("narration keys resolve to real copy", () => {
  it("every narrationKey names an actual NARRATION entry", () => {
    // The failure this exists for: a dangling key renders an EMPTY fixed-height row and
    // passes every layout assertion in T107 — zero drift, one line, no overflow — while
    // the beat says nothing at all. Nothing else in the suite would notice.
    for (const [index, beat] of STORY_BEATS.entries()) {
      const text = copy.NARRATION[beat.narrationKey];
      expect(typeof text, `beat ${index} has a dangling narrationKey`).toBe("string");
      expect((text as string).length).toBeGreaterThan(0);
    }
  });

  it("every threadOp messageKey names an actual REN_MESSAGES entry", () => {
    for (const [index, beat] of STORY_BEATS.entries()) {
      if (!beat.threadOp || beat.threadOp.kind === "clear") continue;
      const text = copy.REN_MESSAGES[beat.threadOp.messageKey];
      expect(typeof text, `beat ${index} has a dangling messageKey`).toBe("string");
    }
  });

  it("closes on the approved §10.3 string, with its clauses in the approved order", () => {
    const closing = copy.NARRATION[STORY_BEATS[STORY_BEATS.length - 1].narrationKey];
    expect(closing).toBe(copy.STORY_CLOSING_BEAT);
    // Chat clause FIRST. Reversed, the deletion frame bleeds backwards and implies the
    // conversation was deleted too — it was not, so the line would be false.
    expect(closing.indexOf("stays yours")).toBeLessThan(closing.indexOf("read and forgotten"));
  });
});

describe("chapter navigation", () => {
  it("firstBeatIndexOfChapter lands on each chapter's first beat", () => {
    expect(firstBeatIndexOfChapter(0)).toBe(0);
    for (const chapter of chaptersOf()) {
      const index = firstBeatIndexOfChapter(chapter);
      expect(STORY_BEATS[index].chapter).toBe(chapter);
      expect(index === 0 || STORY_BEATS[index - 1].chapter).not.toBe(chapter);
    }
  });

  it("returns -1 for a chapter that does not exist", () => {
    expect(firstBeatIndexOfChapter(99)).toBe(-1);
  });

  it("offers one marker per chapter name", () => {
    expect(copy.CHAPTER_NAMES).toHaveLength(chaptersOf().length);
  });
});

describe("trimThread (FR-011)", () => {
  it("keeps the 4 most recent and drops the oldest", () => {
    expect(trimThread(["a", "b", "c", "d", "e"], 4)).toEqual(["b", "c", "d", "e"]);
  });

  it("leaves a short thread alone", () => {
    expect(trimThread(["a", "b"], 4)).toEqual(["a", "b"]);
    expect(trimThread([], 4)).toEqual([]);
  });

  it("handles a zero or negative cap without throwing", () => {
    expect(trimThread(["a", "b"], 0)).toEqual([]);
    expect(trimThread(["a", "b"], -1)).toEqual([]);
  });

  it("never lets the scripted thread exceed the cap at any beat", () => {
    // Replays the script's thread operations exactly as the card will, so the cap is
    // proved against the REAL sequence rather than against a hand-made fixture.
    let thread: readonly string[] = [];
    let high = 0;
    for (const beat of STORY_BEATS) {
      const op = beat.threadOp;
      if (op?.kind === "clear") thread = [];
      else if (op?.kind === "restart") thread = [op.messageKey];
      else if (op?.kind === "push") thread = trimThread([...thread, op.messageKey], THREAD_CAP);
      high = Math.max(high, thread.length);
    }
    expect(high).toBe(THREAD_CAP);
  });

  it("posts every scripted Ren message exactly once", () => {
    // Guards a transcription slip: an off-by-one in the beat table would drop or repeat
    // a line, and the story would still play convincingly.
    const posted = STORY_BEATS.flatMap((beat) =>
      beat.threadOp && beat.threadOp.kind !== "clear" ? [beat.threadOp.messageKey] : [],
    );
    expect([...posted].sort()).toEqual(Object.keys(copy.REN_MESSAGES).sort());
  });

  it("alternates speakers, as a conversation does", () => {
    const speakers = STORY_BEATS.flatMap((beat) =>
      beat.threadOp && beat.threadOp.kind !== "clear" ? [beat.threadOp.from] : [],
    );
    for (let i = 1; i < speakers.length; i++) {
      expect(speakers[i], `two ${speakers[i]} turns in a row`).not.toBe(speakers[i - 1]);
    }
  });
});
