/**
 * Feature 014 — the "Things that might help" card's SURFACE strings (T011–T013).
 *
 * ── Why this module exists, stated plainly ───────────────────────────────────────────
 * `library.ts` is the T004/T005 copy-review surface and it is APPROVED — it must not be
 * edited to add strings that were never in front of Mohamed. But the approved mock draws
 * words that `library.ts` does not export: the four card descriptions, every control label,
 * the outcome question, and the duration pill's "opened" swap. `library.ts` says so itself
 * for the first of them ("the action label belongs to the component, not to this copy
 * module" — the `NO_READING_YET_LEAD` doc block).
 *
 * Putting them in the components would scatter user-facing copy across three files with no
 * review surface. So they live here instead: ONE module, every string traced to the mock
 * panel it came from, so the whole set reads as a single reviewable diff.
 *
 * **REVIEW STATUS: NOT YET GATED.** T005 approved `library.ts`. These strings are
 * transcribed VERBATIM from the approved mock (`docs/mockups/serenify-014-things-that-might
 * -help-mock.html`) and changed in exactly one place — state 9's description, which the
 * 2026-08-15 amendment already reconciled to state 2's line and which the mock itself
 * carries. They still want Mohamed's eye before merge, on the same footing as T004's.
 *
 * Voice rules are the library's (FR-007/FR-008/FR-009/FR-028): no exclamation marks, no
 * urgency, no grading, nothing clinical. The card has NO error state, so no error string
 * exists here and none may be added (FR-030).
 *
 * PURE. No imports, no `server-only` — same posture as `library.ts`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Card chrome
// ─────────────────────────────────────────────────────────────────────────────

/** The card heading. Already shipped in the placeholder card this feature replaces. */
export const CARD_TITLE = "Things that might help";

/** State 1 — mock panel 1. Names where suggestions come from, not what is missing. */
export const CARD_DESC_NO_READING = "Suggestions come from your own readings.";

/**
 * States 2 and 9 — mock panels 2 and 9. ONE line for both, deliberately: state 9 must not
 * claim the day is over (FR-001 state 9), and the 2026-08-15 amendment (Ruling D) replaced
 * state 9's old "Nothing more to suggest today." with state 2's exact line. The two states
 * stay distinct through their sub-lines, never through this description.
 */
export const CARD_DESC_NOTHING_TO_SUGGEST = "Nothing to suggest right now.";

/** States 3, 5, 6, 7, 8, 10 — mock panels 3/5/6/7/8/10. Attributes the pick to the day. */
export const CARD_DESC_PICKED = "Picked from today's reading.";

/** State 4 — mock panel 4. Acknowledges the confirmation without restating the band. */
export const CARD_DESC_CONFIRMED = "You said that's how it feels. Here's one small thing.";

// ─────────────────────────────────────────────────────────────────────────────
// Control labels
// ─────────────────────────────────────────────────────────────────────────────

/** State 1's only action — a full-document link to the capture route. */
export const ACTION_START_CHECKIN = "Start check-in";

/** Expand the instructions. Expanding IS the engagement record (FR-015). */
export const ACTION_SHOW_ME = "Show me";

/** Collapse the instructions (state 5). */
export const ACTION_CLOSE = "Close";

/** The swap. Neutral, not a forward action — swapping is a preference (FR-017). */
export const ACTION_SOMETHING_ELSE = "Something else";

/** State 8's replacement action. The only path that offers an immediate replacement. */
export const ACTION_TRY_SOMETHING_ELSE = "Try something else";

/** The Ren row. A presence, not a text link — it opens the chat pill in place. */
export const ACTION_TALK_TO_REN = "Talk to Ren about this";

/**
 * The in-session card's ONE session control (T017/T036; plan §"Pause from the in-session
 * card"). Both words are the labels feature 008 already ships on the monitor's own controls
 * (`components/monitor/op-surfaces.tsx` — `Pause` on the live stage, `Resume` on the paused
 * stage), reproduced here verbatim rather than reworded: the card is a SECOND entry point to
 * the same handler, and giving the same action a second name is how two competing pause
 * affordances start. Nothing new enters the product's voice.
 *
 * **These two are the only strings in this module that the approved mock does not draw** —
 * the pause control is the 2026-08-15 scope addition, made after the mock was signed off, so
 * there is no panel to transcribe from. They want Mohamed's eye on that basis specifically,
 * not only on the same footing as the rest of this file.
 */
export const ACTION_PAUSE_SESSION = "Pause";
export const ACTION_RESUME_SESSION = "Resume";

// ─────────────────────────────────────────────────────────────────────────────
// The outcome question
// ─────────────────────────────────────────────────────────────────────────────

/**
 * State 6 — asked once, only after the item was opened and its instructions closed
 * (FR-016/FR-031). Ignoring it is a valid third answer that records nothing.
 */
export const OUTCOME_QUESTION = "Did that help?";
export const OUTCOME_ANSWER_HELPED = "Yes";
export const OUTCOME_ANSWER_DIDNT_HELP = "Not really";

/**
 * What the duration pill reads once the item has been opened — the mock's way of showing an
 * item has been used without adding a badge (mock panel 6).
 */
export const DURATION_OPENED_LABEL = "opened";
