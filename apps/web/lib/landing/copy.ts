/**
 * Landing-page copy — the ONE reviewable surface (feature 013, US1; `plan.md` §10.1 item 1).
 *
 * Every string the landing components render is a named constant here, and there is no
 * string literal in any component under `components/landing/`. That is the whole design:
 * the forbidden-claim review (FR-002) becomes a review of one file rather than of a
 * component tree, and `tests/unit/landing/forbidden-claims.test.ts` walks this module's
 * exports directly.
 *
 * ── THE THREE APPROVED §10.3 STRINGS BELOW ARE FIXED COPY (FR-032) ────────────────────
 *
 * They replace the mock's three forbidden lines (`plan.md` §10.2). They were APPROVED on
 * 2026-07-25 and go in character-for-character: NOT paraphrased, NOT re-punctuated, NOT
 * re-cased, and NOT re-worded at implementation time. If one of them appears to need a
 * change, that is a re-approval request to Mohamed, not an edit (R12).
 */

// ── §10.3 Position 1 — the hero lede, replacing mock `:442` ───────────────────────────
//
// FIXED COPY under FR-032. Not re-worded at implementation time.
//
// The manager clause of the original was DROPPED rather than re-scoped: the approved
// FR-005 data-handling line sits directly beneath it, so a lede that also made a
// raw-video claim would read as repetition. This asserts nothing about visibility at
// all, which is why it belongs to neither forbidden family.
export const HERO_LEDE =
  "Serenify notices signs of strain during the workday and checks in with the person first. What happens next is always their call.";

// ── §10.3 Position 2 — the whole "Never" card, replacing mock `:547–551` ──────────────
//
// FIXED COPY under FR-032. Not re-worded at implementation time.
//
// A STRUCTURAL REPLACEMENT, NOT A BODY REWRITE — the heading changed too, because the
// original card's *premise* was the forbidden claim. The card becomes a different
// refusal, keeping the three-card grid and the "Never" tag.
//
// Family (b), stated unconditionally and correctly: this is a Principle I invariant
// rather than an unbuilt control, so it carries NO not-yet-live marker (FR-001).
//
// The closing sentence is "Not now, not ever." — NOT "Not now, not later.", which would
// read as a deferral of the promise rather than its permanence.
export const NEVER_CARD_CHAT_HEADING = "Read your conversations.";
export const NEVER_CARD_CHAT_BODY =
  "What you say to Ren is yours. Companion chat, and anything you disclose in a crisis, never reaches a manager, an admin, or an employer. Not now, not ever.";

// ── §10.3 Position 3 — the closing story beat, replacing mock `:772` ──────────────────
//
// FIXED COPY under FR-032. Not re-worded at implementation time.
//
// TWO LOAD-BEARING CONSTRAINTS, both easy to break by accident:
//
//  1. CLAUSE ORDER IS DELIBERATE AND MUST NOT BE REVERSED. The chat clause comes FIRST so
//     the deletion frame in the second clause does not bleed backwards and imply the
//     conversation was deleted too. It was not — companion chat is STORED,
//     employee-private (chat RLS is self-only). "Stays yours" is a privacy claim; "read
//     and forgotten" is a deletion claim; they attach to different things, and the order
//     is what keeps them attached correctly. Swapping them makes the line false.
//     Asserted in `tests/unit/components/landing/story-card.test.tsx` (T106).
//
//  2. IT MUST NOT WRAP AT 320 px. The narration row is fixed-height (FR-009), so a second
//     line would either clip or force the row taller. This is the longest narration
//     string and therefore the binding case for the layout spec's one-line assertion
//     (T107). A failure there is a COPY-LENGTH problem, not a CSS problem — it means the
//     string must change, and that requires re-approval, not a taller row (R12).
export const STORY_CLOSING_BEAT = "What you said stays yours. The video was read and forgotten.";
