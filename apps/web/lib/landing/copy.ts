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

// ─────────────────────────────────────────────────────────────────────────────────────
// Everything below is T090: the rest of the landing copy, transcribed from
// `docs/mockups/serenify-landing-mock.html` in the T088 pass. Strings marked ADAPTED
// diverge from the mock, always for a stated reason — the mock predates the binding
// terminology and predates FR-003's retention statement, so a verbatim transcription of
// those places would ship a rule violation.
//
// THREE RULES HOLD ACROSS EVERY STRING IN THIS FILE:
//
//  · No blanket manager-negation and no on-device-processing claim (FR-002). The only
//    permitted "reaches a manager" claim is the scoped chat-and-crisis one above.
//  · No numeric quality metric — no digit next to F1 / AUC / ROC / recall / accuracy /
//    precision / % (FR-004, SC-005).
//  · The binding terminology, by name: CALIBRATION, MONITORING SESSION, and WEEKLY
//    WORK-ENVIRONMENT CHECK-IN. Bare "check-in" is never used for the concept.
//    (`HERO_LEDE` contains the verb phrase "checks in with the person"; that is approved
//    §10.3 copy, is unrewordable under FR-032, and does not name the questionnaire.)
// ─────────────────────────────────────────────────────────────────────────────────────

// ── Hero ─────────────────────────────────────────────────────────────────────────────

export const HERO_HEADLINE_LEAD = "Stress detection that";
/** The accented tail of the headline. Split for emphasis, not for meaning. */
export const HERO_HEADLINE_ACCENT = "asks before it decides.";

/** The FR-005 data-handling line, directly beneath the lede as in the mock. */
export const HERO_DATA_LINE = "Your camera is read, then forgotten. Only the reading is kept.";

/**
 * The two CTA labels are FIXED BY FR-020 and are not re-worded. The mock's primary read
 * "Create an account"; the label — not the destination — is what FR-020 fixes.
 */
export const CTA_PRIMARY = "Get started";
export const CTA_SECONDARY = "See how it works";

// ── Story card — the permanently visible readout ─────────────────────────────────────

/**
 * The reading LABELS are not here on purpose. They come from `lib/bands.ts` (FR-015), so
 * the landing readout and the monitor's trend axis cannot drift apart.
 */
export const READOUT_WINDOW_LABEL = "Rolling 60-second window";
export const READOUT_HEADING = "Today";

/** Accessible name for the story card as a whole; it is a narrated illustration. */
export const STORY_CARD_LABEL = "An illustrated walkthrough of a monitoring session";

// ── Story card — the four swap panels ────────────────────────────────────────────────

export const PANEL_QUIET_SINCE = "Since 09:04";

/** ADAPTED. The mock's header read "Checking in", which is banned twice over: bare
 *  "check-in", and it mis-names the surface — this is the MONITORING SESSION asking, not
 *  the weekly work-environment check-in. */
export const PANEL_PROMPT_HEAD = "Serenify asks";
export const PANEL_PROMPT_BODY =
  "Your signals have looked tense for a little while. Is that how you're feeling?";
export const PANEL_PROMPT_OPTION_YES = "Yes, that's me";
export const PANEL_PROMPT_OPTION_NO = "No, I'm okay";
export const PANEL_PROMPT_OPTION_TALK = "Maybe — talk about it";

export const PANEL_RESOLVED_TITLE = "Set aside";
/** ADAPTED. The mock added "nothing sent anywhere", which is unscoped — the reading
 *  itself is retained. Narrowed to what declining actually guarantees (FR-041: declining
 *  writes nothing and deletes nothing), which is also the beat the page is built around:
 *  the false alarm costs the person nothing. */
export const PANEL_RESOLVED_BODY =
  "No follow-up, and nothing to explain. Serenify goes quiet and keeps watching.";

export const PANEL_REN_NAME = "Ren";
export const PANEL_REN_SUBTITLE = "here to listen";
/** Kept from the mock deliberately: the AI disclosure belongs on the surface. */
export const PANEL_REN_FOOTNOTE =
  "Ren is an AI companion, not a substitute for professional care.";

// ── Story card — the seven scripted Ren messages ─────────────────────────────────────
//
// Scripted static copy, NOT a model call. There is no LLM on this page (Principle IV).

export const REN_MSG_1 = "Thanks for saying so. What has today been like?";
export const REN_MSG_2 = "Back to back calls since nine. I have not stopped.";
export const REN_MSG_3 =
  "Six hours without a gap is a lot to carry. Is there a stretch this afternoon that is yours?";
export const REN_MSG_4 = "Maybe twenty minutes at four.";
export const REN_MSG_5 =
  "Then let us keep it. Step away from the screen, and we can pick this up whenever you want.";
export const REN_MSG_6 = "Took the twenty minutes. That actually helped.";
export const REN_MSG_7 = "I am really glad. That was yours to take, and you took it.";

// ── Story card — the six chapter names ───────────────────────────────────────────────
//
// Accessible names for the chapter markers (FR-014). Named, not numbered, so the marker
// says where it goes rather than how far along it is.

export const CHAPTER_NAMES = [
  "A normal morning",
  "It stops and asks",
  "A false alarm, resolved",
  "A different day",
  "The conversation",
  "Later that afternoon",
] as const;

export const CHAPTER_NAV_LABEL = "Story chapters";

// ── Story card — the 17 beats' narration ─────────────────────────────────────────────
//
// Sixteen transcribed from the mock; the seventeenth is STORY_CLOSING_BEAT above, which
// is approved §10.3 copy. Beats where the mock re-runs without calling `say()` reuse the
// preceding key, exactly reproducing the mock's behaviour of leaving the line in place.

export const NARRATION = {
  morning: "A normal morning. Nothing to report.",
  climbing: "Signals climb, and keep climbing.",
  stopsAndAsks: "So it stops — and asks.",
  answerIsNo: "Sometimes the answer is no.",
  falseAlarm: "A false alarm costs the person nothing.",
  differentDay: "Same moment, a different day.",
  tenseAgain: "Signals looked tense for a little while.",
  wantToTalk: "This time, they want to talk.",
  renPicksUp: "Ren picks up. Private, always.",
  laterThatAfternoon: "Later that afternoon.",
  backToAtEase: "Back to at ease — because they were asked, not told.",
  closing: STORY_CLOSING_BEAT,
} as const;

// ── The "Never" cards ────────────────────────────────────────────────────────────────

export const NEVER_SECTION_HEADING = "What Serenify will never do.";
export const NEVER_SECTION_SUB =
  "Most of this product is a set of refusals. They are worth stating before anything else.";
export const NEVER_TAG = "Never";

/** Card 1. Says video IS sent for inference — the true claim, not family (a)'s lie. */
export const NEVER_CARD_VIDEO_HEADING = "Keep your video.";
export const NEVER_CARD_VIDEO_BODY =
  "Frames are sent for inference, read, and discarded. Nothing is stored, and no one — including us — can view or replay them. Only the resulting reading is kept.";

/** Card 3. */
export const NEVER_CARD_DECIDE_HEADING = "Decide on your behalf.";
export const NEVER_CARD_DECIDE_BODY =
  "A detection is a question, not a verdict. If you say it got it wrong, that is the end of it — the reading is set aside and nothing follows.";

// ── How it works ─────────────────────────────────────────────────────────────────────
//
// ADAPTED THROUGHOUT. The mock named the three stages "It notices / It asks / It helps,
// if you want", which names none of the three surfaces this product actually has. T102
// requires CALIBRATION, the MONITORING SESSION, and the WEEKLY WORK-ENVIRONMENT CHECK-IN
// by exactly those names. The mock's closing clause "never a report to anyone else" is
// dropped: it is unscoped, and the claim that IS permitted is already made on the second
// "Never" card.

export const HOW_HEADING = "Three steps. The middle one matters most.";

export const HOW_STEPS = [
  {
    number: "01",
    heading: "Calibration",
    body: "Once, at the start, Serenify captures a short baseline of your ordinary face at rest. Every later reading is measured against your own baseline rather than against a stranger's.",
  },
  {
    number: "02",
    heading: "The monitoring session",
    body: "While a session runs, your webcam feeds a model that scores strain over a rolling 60-second window. When signals stay elevated, Serenify stops and puts the question to you. You can confirm it, wave it off, or ask to talk. Nothing moves until you answer.",
    flag: "The part most systems skip",
  },
  {
    number: "03",
    heading: "The weekly work-environment check-in",
    body: "Once a week there is a short set of questions about the work around you — workload, control, support. It is text, not camera, and it is answered in your own time.",
  },
] as const;

// ── Retention and status ─────────────────────────────────────────────────────────────

export const STATUS_HEADING = "Honest about what runs today.";
export const STATUS_SUB =
  "Serenify is a graduation project that is genuinely deployed. Three modalities were researched; one is in the live product.";

export const STATUS_MODALITIES = [
  {
    name: "Video",
    state: "Live",
    body: "The deployed detector. Facial-texture and motion features with a per-user baseline captured at calibration.",
  },
  {
    name: "Audio",
    state: "In research",
    body: "Trained and evaluated against the same subject-disjoint protocol. Not wired into the live product.",
  },
  {
    name: "Physiological",
    state: "In research",
    body: "ECG, EDA and respiration from the research dataset. Needs hardware most desks do not have.",
  },
] as const;

/**
 * ADAPTED. The mock's closing sentence was "The check-in is not a courtesy; it is the
 * correction." — bare "check-in", and it meant the monitoring session's prompt rather
 * than the questionnaire, so the word was wrong twice. Recast to name what it means.
 *
 * "subject-disjoint" is retained deliberately and stays free of numbers: research.md
 * §12.2 makes its number-free presence a copy invariant.
 */
export const STATUS_NOTE =
  "Reading stress from a webcam is hard, and we will not pretend otherwise. Models trained on lab recordings meet a messier world: different lighting, different faces, different reasons for a furrowed brow. Evaluation was subject-disjoint — no person appears in both training and test — so the numbers we trust are lower than the ones we could have quoted. That difficulty is precisely why the second step exists. Asking is not a courtesy; it is the correction.";

/**
 * FR-003. Stated as a POLICY and nothing more.
 *
 * There is deliberately NO claim, promise, or implication that anything is deleted
 * automatically — the purge job is BACKLOG #86, unslotted, and is not owned by this
 * feature. "are kept for" describes the rule; it does not assert a mechanism that does
 * not exist yet.
 */
export const RETENTION_HEADING = "What is kept, and for how long.";
export const RETENTION_BODY =
  "Readings are kept for 90 days under our retention policy. The video they were computed from is not kept at all. The full detail is in the Privacy Policy and the Terms of Service.";

export const RETENTION_LINK_PRIVACY = "Privacy Policy";
export const RETENTION_LINK_TERMS = "Terms of Service";

