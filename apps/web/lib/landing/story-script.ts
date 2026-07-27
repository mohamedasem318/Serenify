import type { Band } from "@/lib/api/monitoring-client";

import { CHAPTER_NAMES, NARRATION, REN_MESSAGES } from "./copy";

/**
 * The hero story, as DATA rather than control flow (feature 013, US1 — T091;
 * `contracts/landing-hero-story.md` §9.1).
 *
 * Seventeen beats, six chapters, four panels, ≈42.1 s. Transcribed from the mock's beat
 * table (`:754–773`), whose durations sum to exactly 42,100 ms.
 *
 * WHY DATA. Everything honesty-critical about this page is a property of the script, not
 * of the renderer: that the false alarm resolves BEFORE the companion appears, that the
 * only bands used are the three real ones, that the thread never exceeds four. As a
 * frozen array those are unit-testable with no DOM at all (T092), and the component that
 * plays it cannot quietly disagree with them.
 *
 * THE FALSE-ALARM-BEFORE-COMPANION ORDERING IS THE PAGE'S THESIS AND IS NOT REORDERABLE
 * (FR-006, SC-002). Chapter 2 resolves a false alarm at no cost; the first companion beat
 * is in chapter 4. A page that showed the companion first would be arguing that the
 * product's value is the chat — it is not. The value is that being wrong costs the person
 * nothing, which is what makes the asking safe. T092 asserts the ordering as an INVARIANT
 * rather than trusting this comment.
 *
 * Narration is referenced BY KEY into `copy.ts` and never inlined, so the whole page's
 * copy stays reviewable in one file. Imports nothing from `server-only`.
 */

/** The four swap panels. Exactly these, and no others. */
export type StoryPanel = "quiet" | "prompt" | "resolved" | "ren";

/** Which prompt option the beat highlights, when the prompt panel is showing. */
export type PromptHighlight = "yes" | "no" | "talk";

/**
 * What the beat does to the Ren thread. Absent means "leave it alone".
 *
 * `restart` is clear-then-push in one beat, which the opening companion beat needs: the
 * mock clears the thread and posts Ren's first line on the same beat (behind a typing
 * indicator this implementation does not carry — see T097, one timer chain only).
 */
export type ThreadOp =
  | { readonly kind: "clear" }
  | {
      readonly kind: "push" | "restart";
      readonly from: "ren" | "person";
      /** A key into `copy.REN_MESSAGES` — never the message text itself. */
      readonly messageKey: keyof typeof REN_MESSAGES;
    };

export interface StoryBeat {
  readonly chapter: number;
  readonly durationMs: number;
  readonly panel: StoryPanel;
  readonly band: Band;
  readonly narrationKey: keyof typeof NARRATION;
  readonly highlight?: PromptHighlight;
  readonly threadOp?: ThreadOp;
}

const REN = (messageKey: keyof typeof REN_MESSAGES): ThreadOp => ({
  kind: "push",
  from: "ren",
  messageKey,
});
const PERSON = (messageKey: keyof typeof REN_MESSAGES): ThreadOp => ({
  kind: "push",
  from: "person",
  messageKey,
});
const RESTART = (messageKey: keyof typeof REN_MESSAGES): ThreadOp => ({
  kind: "restart",
  from: "ren",
  messageKey,
});

/**
 * Beats 10–13 and 15 carry a REPEATED narration key rather than none.
 *
 * The mock simply does not call `say()` on those beats, so the previous line stays on
 * screen. Repeating the key reproduces that exactly while keeping the type total — which
 * matters, because an optional key would make T092's "every key resolves to a real
 * export" vacuous for a third of the script and would let a dangling key render an empty
 * fixed-height row that passes every layout assertion (T107) while saying nothing.
 */
export const STORY_BEATS: readonly StoryBeat[] = Object.freeze([
  // ── Chapter 0 — a normal morning ───────────────────────────────────────────────────
  {
    chapter: 0,
    durationMs: 2200,
    panel: "quiet",
    band: "at_ease",
    narrationKey: "morning",
    threadOp: { kind: "clear" },
  },
  { chapter: 0, durationMs: 2400, panel: "quiet", band: "a_little_tense", narrationKey: "climbing" },

  // ── Chapter 1 — it stops and asks ──────────────────────────────────────────────────
  { chapter: 1, durationMs: 3000, panel: "prompt", band: "tense", narrationKey: "stopsAndAsks" },
  {
    chapter: 1,
    durationMs: 1500,
    panel: "prompt",
    band: "tense",
    narrationKey: "answerIsNo",
    highlight: "no",
  },

  // ── Chapter 2 — THE FALSE ALARM, RESOLVED AT NO COST. The beat the page is built
  //    around, and the reason it comes before the companion chapter at all.
  { chapter: 2, durationMs: 3200, panel: "resolved", band: "at_ease", narrationKey: "falseAlarm" },

  // ── Chapter 3 — a different day ────────────────────────────────────────────────────
  {
    chapter: 3,
    durationMs: 2000,
    panel: "quiet",
    band: "a_little_tense",
    narrationKey: "differentDay",
  },
  { chapter: 3, durationMs: 2200, panel: "prompt", band: "tense", narrationKey: "tenseAgain" },
  {
    chapter: 3,
    durationMs: 1600,
    panel: "prompt",
    band: "tense",
    narrationKey: "wantToTalk",
    highlight: "talk",
  },

  // ── Chapter 4 — the companion conversation ─────────────────────────────────────────
  {
    chapter: 4,
    durationMs: 1400,
    panel: "ren",
    band: "tense",
    narrationKey: "renPicksUp",
    threadOp: RESTART("renOpens"),
  },
  {
    chapter: 4,
    durationMs: 2600,
    panel: "ren",
    band: "tense",
    narrationKey: "renPicksUp",
    threadOp: PERSON("personBackToBack"),
  },
  {
    chapter: 4,
    durationMs: 2800,
    panel: "ren",
    band: "tense",
    narrationKey: "renPicksUp",
    threadOp: REN("renSixHours"),
  },
  {
    chapter: 4,
    durationMs: 2400,
    panel: "ren",
    band: "tense",
    narrationKey: "renPicksUp",
    threadOp: PERSON("personTwentyMinutes"),
  },
  {
    chapter: 4,
    durationMs: 3000,
    panel: "ren",
    band: "tense",
    narrationKey: "renPicksUp",
    threadOp: REN("renKeepIt"),
  },

  // ── Chapter 5 — later that afternoon, and the close ────────────────────────────────
  {
    chapter: 5,
    durationMs: 2600,
    panel: "ren",
    band: "a_little_tense",
    narrationKey: "laterThatAfternoon",
    threadOp: PERSON("personTookIt"),
  },
  {
    chapter: 5,
    durationMs: 3000,
    panel: "ren",
    band: "a_little_tense",
    narrationKey: "laterThatAfternoon",
    threadOp: REN("renGlad"),
  },
  {
    chapter: 5,
    durationMs: 3400,
    panel: "quiet",
    band: "at_ease",
    narrationKey: "backToAtEase",
    threadOp: { kind: "clear" },
  },
  // The closing beat sets no panel, band or thread state of its own in the mock — it is
  // narration only, which is why replacing its forbidden line changed one string and no
  // structure. `panel` and `band` here simply hold the previous beat's state.
  { chapter: 5, durationMs: 2800, panel: "quiet", band: "at_ease", narrationKey: "closing" },
]);

/** The chapter indices in order of first appearance. */
export function chaptersOf(beats: readonly StoryBeat[] = STORY_BEATS): readonly number[] {
  const seen: number[] = [];
  for (const beat of beats) {
    if (!seen.includes(beat.chapter)) seen.push(beat.chapter);
  }
  return seen;
}

/** Where a chapter marker jumps to. `-1` when the chapter does not exist. */
export function firstBeatIndexOfChapter(
  chapter: number,
  beats: readonly StoryBeat[] = STORY_BEATS,
): number {
  return beats.findIndex((beat) => beat.chapter === chapter);
}

/**
 * The thread cap (FR-011). Keeps the `cap` MOST RECENT messages and drops the oldest.
 *
 * The card does not resize when this trims, and that holds by construction rather than by
 * care: the thread lives inside an absolutely positioned panel inside a fixed-height swap
 * area, so it is out of flow and cannot push the card's box (FR-008). T106 asserts it
 * anyway rather than assuming it.
 */
export function trimThread<T>(messages: readonly T[], cap: number): readonly T[] {
  return cap <= 0 ? [] : messages.slice(Math.max(0, messages.length - cap));
}

/** The visible-bubble cap the story card renders with. */
export const THREAD_CAP = 4;

/** Chapter names, re-exported so a consumer needs one import for the whole script. */
export { CHAPTER_NAMES };
