/**
 * Feature 014 — the recommendation item library and the card's deterministic strings
 * (T004; `data-model.md` §1, research R-1).
 *
 * THIS FILE IS THE COPY REVIEW SURFACE for the "Things that might help" card. Every word a
 * person reads on that card either lives here or is a re-phrasing of a string that lives
 * here. It is an in-repo constants module rather than a database table for exactly the
 * reason the consent registry is one (`lib/consent/registry.ts`, 013 research §6.3): a
 * pull-request diff puts the text next to its classification, and content that only ever
 * changes by review does not need seeding, RLS, or an editorial pipeline.
 *
 * PURE. No `server-only`, no imports at all — Vitest loads it directly, and the engine
 * (`engine.ts`) consumes it as data.
 *
 * ── What the review gate checks (T005, spec FR-007/FR-008/FR-009/FR-028) ──────────────
 * Every item and every string below was written against these, and each is Mohamed's to
 * confirm line by line:
 *   • No physical discomfort as a coping technique — no ice, no cold shock, no snapping,
 *     no pain, no intense sensation framed as relief (FR-008).
 *   • No substances of any kind, including caffeine, and nothing edible (FR-008).
 *   • Nothing clinical or therapy-adjacent, no outcome claim ("this will calm you"), and
 *     nothing that requires leaving the workplace — every item is doable at or near an
 *     office desk (FR-009).
 *   • Nothing touching crisis territory. Crisis is feature 011's, live-only, from the
 *     verified resource table; this library has no path into it (FR-007).
 *   • Calm-first voice (FR-028 / Principle V): invitational, plain, no urgency, no
 *     cheerleading, no exclamation mark anywhere, no "should", no grading of the person.
 *
 * ── Order is a contract, not a convenience ───────────────────────────────────────────
 * `RECOMMENDATION_CATEGORIES` and the order of items within each category are part of the
 * deterministic selection contract (R-10, `contracts/selection-engine.md` §4–5): category
 * ties break by declared category order, and within a category the engine takes the first
 * item the day's non-repeat exclusions allow. Both orders are therefore *deliberate*, not
 * alphabetical, and reordering this file changes what people are shown. Within each
 * category the most universally applicable item — the one needing the least space, time,
 * privacy, or equipment — is declared first.
 *
 * Titles, why-lines, durations, steps, and foot-notes render VERBATIM (FR-004). Nothing
 * here is ever generated, summarised, or re-worded at runtime.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types (data-model §1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The five fixed categories, in declared order. The SET is load-bearing and may not
 * change without a spec change (FR-004/FR-005) — feature 015 generates instances *within*
 * a category this feature has already reviewed. The per-category item count may grow.
 */
export type RecommendationCategory =
  | "breathing_grounding"
  | "movement"
  | "sensory_reset"
  | "taking_a_break"
  | "connection";

/** One reviewed suggestion. Rendered verbatim; `id` is what a pick row stores. */
export interface LibraryItem {
  /** Stable slug, matching the `recommendation_picks.item_id` CHECK: `^[a-z0-9-]{1,64}$`. */
  id: string;
  category: RecommendationCategory;
  /** The item heading (mock `item-title`). */
  title: string;
  /** The single "why" line under the title (mock `item-why`). */
  whyLine: string;
  /** The duration pill, e.g. "2 min" (mock `dur`). */
  durationLabel: string;
  /** The expanded instructions, one string per numbered step (mock `steps`). */
  steps: string[];
  /** Optional closing line, rendered italic under the steps (mock `steps-foot`). */
  footNote?: string;
}

/** Declared category order — the engine's stable tiebreak (R-10). */
export const RECOMMENDATION_CATEGORIES: readonly RecommendationCategory[] = [
  "breathing_grounding",
  "movement",
  "sensory_reset",
  "taking_a_break",
  "connection",
];

/** The slug shape the database enforces independently on `recommendation_picks.item_id`. */
export const LIBRARY_ITEM_ID_PATTERN = /^[a-z0-9-]{1,64}$/;

// ─────────────────────────────────────────────────────────────────────────────
// The library — 5 categories × 3 items (v1)
// ─────────────────────────────────────────────────────────────────────────────

export const RECOMMENDATION_LIBRARY: readonly LibraryItem[] = [
  // ── breathing_grounding ────────────────────────────────────────────────────
  // Declared first of all five: it needs nothing but a chair, is invisible to a room,
  // and is the shortest path from "tense" to "doing something about it".
  {
    id: "box-breathing",
    category: "breathing_grounding",
    title: "Box breathing",
    whyLine: "Four counts in, four counts out. A shape to follow when the breath has got short.",
    durationLabel: "2 min",
    steps: [
      "Sit back and let your shoulders drop away from your ears.",
      "Breathe in through your nose for a count of four.",
      "Hold for four, then out through your mouth for four.",
      "Hold for four, and go round again. Four rounds is plenty.",
    ],
    footNote:
      "The counting is most of the point, and it does not need to be neat. If the holds feel awkward, drop them and just let the out-breath run a little longer.",
  },
  {
    id: "feet-on-the-floor",
    category: "breathing_grounding",
    title: "Feet on the floor",
    whyLine: "A minute of noticing where you are actually sitting.",
    durationLabel: "1 min",
    steps: [
      "Put both feet flat on the floor and let them take some weight.",
      "Notice the chair behind you and the desk under your hands.",
      "Notice the weight of your arms where they rest.",
      "Come back to your feet for one more slow breath, then carry on.",
    ],
    footNote: "None of this is visible from the outside, so it works in an open office.",
  },
  {
    id: "three-two-one-around-you",
    category: "breathing_grounding",
    title: "Three, two, one around you",
    whyLine: "Three things you can see, two you can hear, one you can feel.",
    durationLabel: "2 min",
    steps: [
      "Without moving much, find three things you can see and name them to yourself.",
      "Then two things you can hear — a fan, a door, traffic outside.",
      "Then one thing you can feel — the chair, the desk, your own hands.",
      "That is all of it. Go back to what you were doing.",
    ],
    footNote: "It is meant to be dull. The dullness is what makes it easy to come back to.",
  },

  // ── movement ───────────────────────────────────────────────────────────────
  {
    id: "roll-your-shoulders",
    category: "movement",
    title: "Roll your shoulders",
    whyLine: "Shoulders creep up over a morning at a desk. This is a minute of putting them back down.",
    durationLabel: "1 min",
    steps: [
      "Sit or stand tall and let your arms hang.",
      "Roll both shoulders slowly backwards five times.",
      "Then forwards five times, slower than feels necessary.",
      "Let them drop, and notice where they settle.",
    ],
    footNote: "Stay well inside an easy range. None of it needs to pull.",
  },
  {
    id: "loosen-the-desk-slump",
    category: "movement",
    title: "Loosen the desk slump",
    whyLine: "Two minutes of undoing the shape a chair puts you in.",
    durationLabel: "2 min",
    steps: [
      "Stand up and let your arms hang by your sides for a moment.",
      "Reach both arms overhead as far as is comfortable, and lower them slowly.",
      "Turn your head gently to one side, then the other, without forcing it.",
      "Sit back down deliberately rather than falling into the chair.",
    ],
    footNote: "Gentle is the whole instruction. Nothing here needs to stretch far.",
  },
  {
    id: "a-lap-of-the-floor",
    category: "movement",
    title: "A lap of the floor",
    whyLine: "A short walk that goes nowhere in particular, and back again.",
    durationLabel: "3 min",
    steps: [
      "Stand up and leave your phone on the desk.",
      "Walk to the far end of the floor at an unhurried pace.",
      "Come back a different way if there is one.",
      "Sit down again before you pick the work back up.",
    ],
    footNote: "Slower than the walk you would do to a meeting. That is the difference.",
  },

  // ── sensory_reset ──────────────────────────────────────────────────────────
  {
    id: "look-out-a-window",
    category: "sensory_reset",
    title: "Look out a window",
    whyLine: "Twenty seconds on something far away, after hours of things at arm's length.",
    durationLabel: "1 min",
    steps: [
      "Find the furthest thing you can see from where you are.",
      "Rest your eyes on it for about twenty seconds, without staring.",
      "Let your focus go soft, then come back to the room.",
    ],
    footNote: "With no window nearby, the longest line of sight in the room does the same job.",
  },
  {
    id: "something-to-hold",
    category: "sensory_reset",
    title: "Something to hold",
    whyLine: "One ordinary object, given a minute of proper attention.",
    durationLabel: "1 min",
    steps: [
      "Pick up something within reach — a pen, a key, a notebook.",
      "Notice its weight, and whether the surface is smooth or worn.",
      "Turn it over slowly and find one detail you had never noticed.",
      "Put it down and go back to what you were doing.",
    ],
    footNote: "The object does not matter. The minute of attention is the whole of it.",
  },
  {
    id: "turn-the-room-down",
    category: "sensory_reset",
    title: "Turn the room down",
    whyLine: "Fewer things asking for your attention, for a few minutes.",
    durationLabel: "2 min",
    steps: [
      "Close the tabs and windows you are not using right now.",
      "Silence notifications for the next few minutes.",
      "If you have headphones, put them on, with or without sound.",
      "Sit in the quieter version of the room for a moment before carrying on.",
    ],
    footNote: "Turning it all back on afterwards is part of it. This is a pause, not a retreat.",
  },

  // ── taking_a_break ─────────────────────────────────────────────────────────
  {
    id: "five-minutes-off-the-screen",
    category: "taking_a_break",
    title: "Five minutes off the screen",
    whyLine: "A break with a start and an end, instead of a slow drift.",
    durationLabel: "5 min",
    steps: [
      "Finish the line or the thought you are on, so there is a clean edge to come back to.",
      "Stand up and leave the screen behind. The phone stays too.",
      "Spend five minutes somewhere else — a corridor, a window, a quiet corner.",
      "Come back and pick up at the edge you left.",
    ],
    footNote: "Deciding when it ends is what keeps it a break rather than a drift.",
  },
  {
    id: "stop-at-a-clean-edge",
    category: "taking_a_break",
    title: "Stop at a clean edge",
    whyLine: "Two minutes spent closing something properly before you move on.",
    durationLabel: "2 min",
    steps: [
      "Pick the nearest point where this work could reasonably pause.",
      "Get to it, and stop there rather than halfway into the next thing.",
      "Write one line about where you got to and what comes next.",
      "Close it down and take the break you were going to take anyway.",
    ],
    footNote: "The note is for the version of you that comes back in ten minutes.",
  },
  {
    id: "park-the-rest-of-the-list",
    category: "taking_a_break",
    title: "Park the rest of the list",
    whyLine: "Everything open at once carries its own weight. This puts most of it down for a while.",
    durationLabel: "3 min",
    steps: [
      "Write down everything currently competing for your attention.",
      "Mark the one thing that genuinely has to happen next.",
      "Put the list somewhere out of sight, with a time to come back to it.",
      "Work on the marked one until that time.",
    ],
    footNote: "The list keeps. That is what writing it down is for.",
  },

  // ── connection ─────────────────────────────────────────────────────────────
  {
    id: "message-one-person",
    category: "connection",
    title: "Message one person",
    whyLine: "One message to someone outside whatever you are in the middle of.",
    durationLabel: "2 min",
    steps: [
      "Think of one person you have not spoken to in a while.",
      "Send them something short. It does not have to be about work, or about how your day is going.",
      "Put the phone down without waiting for a reply.",
    ],
    footNote: "The sending is the part that counts. A reply is a bonus.",
  },
  {
    id: "two-minutes-with-someone-nearby",
    category: "connection",
    title: "Two minutes with someone nearby",
    whyLine: "A short, ordinary conversation with whoever is closest.",
    durationLabel: "2 min",
    steps: [
      "Find someone nearby who is not deep in something.",
      "Ask them something ordinary — their weekend, what they are working on, the weather.",
      "Stay for about two minutes, then go back to your desk.",
    ],
    footNote: "Nothing about how you are doing needs to come up. Ordinary is the point.",
  },
  {
    id: "ask-for-one-small-thing",
    category: "connection",
    title: "Ask for one small thing",
    whyLine: "The smallest piece of this you could hand over or ask about, asked plainly.",
    durationLabel: "3 min",
    steps: [
      "Look at what is on you right now and find the smallest piece of it.",
      "Decide who would know the answer, or could take that piece.",
      "Ask them for that one thing only.",
    ],
    footNote: "A small ask is easier to make, and easier to say yes to, than a big one.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// The card's fixed strings
//
// These are the words the card says in its own voice, as opposed to an item's. They are
// deterministic constants, never generated. States 2 and 9 additionally allow a *phrasing*
// pass over the builders below, and only over those (contracts/reflective-copy.md).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * State 1 — no reading yet today. Two lines: the first NAMES THE CAUSE rather than
 * describing an absence (that is what stops the card reading as a failed fetch), the
 * second invites a check-in (FR-001 state 1). The card renders a "Start check-in" action
 * beside them; the action label belongs to the component, not to this copy module.
 */
export const NO_READING_YET_LEAD = "Nothing from today yet.";
export const NO_READING_YET_LINE =
  "Start a check-in and anything worth suggesting shows up here.";

/**
 * The outcome acknowledgement — ONE word, used identically by state 7 ("it helped") and
 * state 8 ("it did not"). Identical on both paths is the whole design: a different word on
 * each branch would grade the answer, and the person did not fail anything (FR-001, plan
 * §Principle V). Two constants would let the two paths drift apart, so there is one.
 */
export const OUTCOME_ACKNOWLEDGEMENT = "Noted.";

/** State 8, replacement available — the sub-line under the acknowledgement (mock verbatim). */
export const OUTCOME_DIDNT_HELP_SUBLINE = "That one wasn't it.";

/**
 * State 8, no-replacement variant — the episode's shared three-pick budget is spent, or the
 * day's non-repeat rule leaves nothing eligible. Same neutral treatment, same
 * acknowledgement word, no replacement action, and an honest line before the card settles
 * to state 9. No consolation action fills the gap (FR-001 state 8, FR-018).
 */
export const OUTCOME_NO_REPLACEMENT_SUBLINE =
  "That one wasn't it, and there is nothing further to offer just now.";

/**
 * The swap action's retirement line — shown in place of "Something else" once the episode's
 * picks are spent or the day's non-repeat exclusions leave nothing eligible (FR-018). It is
 * honest about having nothing new rather than quietly repeating an item, and it does not
 * push the person toward anything else.
 */
export const SWAP_RETIRED_LINE =
  "That is everything for now. Nothing new is left to offer today, and nothing here is worth showing you twice.";

// ─────────────────────────────────────────────────────────────────────────────
// Reflective copy — the deterministic fallbacks for states 2 and 9
//
// THE FALLBACK STRING IS THE SOURCE OF TRUTH for what is said; the 011 generation path may
// only change HOW it is said (FR-021, contracts/reflective-copy.md). So these builders may
// state nothing that was not supplied as a fact: a real count, real preformatted times, a
// real band label, a real item title. No number, time, or band claim is invented here, and
// the generator is validated against the same facts before its text is ever painted.
// ─────────────────────────────────────────────────────────────────────────────

/** Length cap shared with the generated-copy validator (contracts/reflective-copy.md §5). */
export const REFLECTIVE_COPY_MAX_LENGTH = 220;

/** The forward-looking second line of state 2. No action attached — the state has none. */
export const CALM_FORWARD_LINE = "Suggestions show up here when something shifts.";

/**
 * The forward-looking second line of state 9. It deliberately does NOT claim the day is
 * over — the card re-arms if the day shifts again (FR-001 state 9).
 */
export const AT_REST_FORWARD_LINE = "If today shifts again, something new shows up here.";

/**
 * State 2 facts: the `ReflectiveFacts` fields (data-model §4) the calm builder may use,
 * minus `state` and minus `fallbackText` — this builder PRODUCES `fallbackText`.
 */
export interface CalmReflectionFacts {
  /** Real count of the person's own check-ins today. */
  checkinCount: number;
  /** Preformatted clock strings, in the order they are to be read, e.g. ["9:40", "11:15"]. */
  times: string[];
  /** Display band labels present today: "Calm" | "Uneasy" | "Tense". */
  bandLabels: string[];
}

/** State 9 facts: the calm facts plus what was tried. */
export interface AtRestReflectionFacts extends CalmReflectionFacts {
  /** The opened item's title, verbatim from the library. */
  triedItemTitle?: string;
  /** Preformatted time the item was opened, e.g. "2:20". */
  triedAtLabel?: string;
}

/** "at 9:40" · "at 9:40 and 11:15" · "at 9:40, 11:15 and 2:30" · "from 9:40 to 4:20". */
function formatTimes(times: string[]): string {
  const clean = times.map((t) => t.trim()).filter((t) => t.length > 0);
  if (clean.length === 0) return "";
  if (clean.length === 1) return `at ${clean[0]}`;
  if (clean.length === 2) return `at ${clean[0]} and ${clean[1]}`;
  if (clean.length === 3) return `at ${clean[0]}, ${clean[1]} and ${clean[2]}`;
  return `from ${clean[0]} to ${clean[clean.length - 1]}`;
}

function capitalise(text: string): string {
  const first = text[0];
  return first === undefined ? text : first.toUpperCase() + text.slice(1);
}

/**
 * State 2 (Calm) — the deterministic reflective string: one SPECIFIC, TRUE line drawn from
 * the person's own readings, then one forward-looking line (FR-001 state 2).
 *
 * Every fact in the specific line comes from `facts`: the count is their real count, the
 * times are preformatted strings handed in, and the band word is a supplied display label —
 * never a word this module chose. Where a fact is missing the line simply says less; it
 * never fills the gap with something unverified.
 *
 * PRECONDITION: the caller only reaches state 2 when the day has readings and they are all
 * Calm. With `checkinCount < 1` no true specific line is derivable and the card is required
 * to fall back to state 1's SHAPE (FR-001 state 2) — that is the caller's branch, not this
 * builder's, so here the builder degrades to the forward line alone rather than inventing
 * a specific it cannot support.
 */
export function buildCalmFallbackText(facts: CalmReflectionFacts): string {
  const count = Math.max(0, Math.trunc(facts.checkinCount));
  if (count < 1) return CALM_FORWARD_LINE;

  const band = facts.bandLabels.map((b) => b.trim()).find((b) => b.length > 0);
  // With a band label the count is an adverbial ("Calm at all 3 check-ins today"); without
  // one it becomes the subject ("3 check-ins today"), which needs a different article.
  const subject = band
    ? `${band} at ${count === 1 ? "your one check-in" : `all ${count} check-ins`} today`
    : capitalise(`${count === 1 ? "one check-in" : `${count} check-ins`} today`);

  const timePart = formatTimes(facts.times);
  const specific = timePart ? `${subject}, ${timePart}.` : `${subject}.`;
  const full = `${specific} ${CALM_FORWARD_LINE}`;
  if (full.length <= REFLECTIVE_COPY_MAX_LENGTH) return full;

  // Unusually long inputs: drop the times rather than truncate mid-sentence. Still true,
  // still specific about the count, and still inside the cap the validator enforces.
  const shortened = `${subject}. ${CALM_FORWARD_LINE}`;
  return shortened.length <= REFLECTIVE_COPY_MAX_LENGTH ? shortened : CALM_FORWARD_LINE;
}

/**
 * State 9 (at rest, after an outcome) — the deterministic reflective string: one line
 * naming what was tried and when, then the forward-looking line.
 *
 * It reports and does not conclude: no claim that the item worked, no claim that the day is
 * done, no second suggestion pushed on top of the one they just used (FR-001 state 9). The
 * title is inserted VERBATIM from the library (FR-004) — mid-sentence capitalisation is
 * preferred over silently re-casing reviewed copy.
 */
export function buildAtRestFallbackText(facts: AtRestReflectionFacts): string {
  const title = facts.triedItemTitle?.trim() ?? "";
  const at = facts.triedAtLabel?.trim() ?? "";

  let tried = "";
  if (title && at) tried = `You tried ${title} at ${at}.`;
  else if (title) tried = `You tried ${title} today.`;

  const full = tried ? `${tried} ${AT_REST_FORWARD_LINE}` : AT_REST_FORWARD_LINE;
  return full.length <= REFLECTIVE_COPY_MAX_LENGTH ? full : AT_REST_FORWARD_LINE;
}
