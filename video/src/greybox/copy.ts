/**
 * Every string that appears on screen, in one place.
 *
 * Real copy matters more here than it sounds: several beats are sized around
 * how long a line takes to read on a phone, so placeholder text at the wrong
 * length would give a false read on exactly the thing this pass tests. Where
 * the beat sheet gives verbatim app copy it is used character-for-character,
 * typographic apostrophes included.
 *
 * Provenance is marked on every block:
 *   VERBATIM  — lifted from the running app or from a repo source of truth
 *   SHEET     — given verbatim in the beat sheet
 *   PLACEHOLDER — written for this pass because the surface does not exist yet
 */

// ── Beat 1 · landing (VERBATIM — apps/web/lib/landing/copy.ts) ───────────────
export const LANDING = {
  headlineLead: "Stress detection that",
  headlineAccent: "asks before it decides.",
  lede: "Serenify notices signs of strain during the workday and checks in with the person first. What happens next is always their call.",
  dataLine: "Your camera is read, then forgotten. Only the reading is kept.",
  ctaPrimary: "Get started",
  ctaSecondary: "See how it works",
} as const;

// ── Beat 2 · signup (SHEET) ─────────────────────────────────────────────────
export const SIGNUP = {
  heading: "Create your account",
  fields: [
    { label: "FULL NAME", value: "Youssef Kamal" },
    { label: "EMAIL", value: "youssef.kamal@example.com" },
    { label: "PASSWORD", value: "••••••••••••" },
  ],
  checklist: ["At least 8 characters", "Contains a letter", "Contains a number"],
  checklistCollapsed: "Password looks good.",
  consent: "I have read and agree to the Terms of Service and the Privacy Policy.",
  submit: "Create account",
  submitting: "Creating account…",
  checkEmail: "Check your email",
  checkEmailBody: "We sent a confirmation link and a 6-digit code to youssef.kamal@example.com.",
} as const;

/**
 * VERBATIM — supabase/templates/confirmation.html. The sheet is explicit that
 * 2e must show real email content and that pulling the shipped template is free
 * fidelity, so nothing here is invented.
 */
export const EMAIL = {
  from: "Serenify",
  subject: "Confirm your Serenify email",
  preheader: "One quiet step to finish creating your Serenify account.",
  headline: "Confirm your email",
  body: "Use this secure link to finish creating your Serenify account.",
  button: "Confirm email",
  codeLabel: "Or enter this code in Serenify",
  code: "418 302",
  footer: "If you did not create a Serenify account, you can ignore this email. The link and code expire automatically.",
  /** Internal clock: signup ~10:20am, so the mail lands at 10:21. */
  time: "10:21 AM",
} as const;

// ── Beat 2f · OTP (SHEET) ───────────────────────────────────────────────────
export const OTP = {
  heading: "Enter your code",
  digits: ["4", "1", "8", "3", "0", "2"],
  verified: "Verified",
  takingYouIn: "Taking you in…",
} as const;

// ── Beat 3 · dashboard (SHEET) ──────────────────────────────────────────────
export const DASHBOARD = {
  welcomeTitle: "Good morning, Youssef",
  welcomeBody: "A space to check in with yourself.",
  calibrationBanner:
    "Stress detection isn’t active yet — it needs about a minute of calibration to know what your calm looks like.",
  setBaseline: "Set baseline",
  startCheckIn: "Start check-in",
} as const;

// ── Beat 4 · camera consent gate (SHEET) ────────────────────────────────────
export const CAMERA_GATE = {
  heading: "Before the camera turns on",
  /** The privacy pitch. The one line in ~230 words the beat pushes in on. */
  keyLine: "Nothing is kept. There is no bucket, no table, and no file path where a clip lands.",
  allow: "Allow camera and inference",
} as const;

// ── Beat 5 · calibration (SHEET) ────────────────────────────────────────────
export const CALIBRATION = {
  heading: "Set your calm baseline",
  rows: ["Sit the way you normally work", "Face a window or a lamp", "It takes about a minute"],
  turnOnCamera: "Turn on camera",
  ready: "You’re all set — start when you’re ready.",
  breatheIn: "Breathe in",
  breatheOut: "Breathe out",
  /**
   * VERBATIM — `components/anchor/anchor-recorder.tsx` `COPY.uploading`. The
   * capture stage is replaced by this line before the success state; revision 2
   * skipped it and cut straight from the recording to the result.
   */
  uploading: "Setting your baseline — one calm moment…",
  /** VERBATIM — `components/anchor/success-state.tsx`, `mode: "first-time"`. */
  done: "Your baseline is set",
  doneBody:
    "We’ve learned what calm looks like for you. You can update it anytime from your account.",
  doneCta: "Back to home",
} as const;

// ── Beat 6 · the time jump (SHEET) ──────────────────────────────────────────
export const LATER = "later that morning";

// ── Beats 7, 8, 11 · statelines (SHEET) ─────────────────────────────────────
export const STATELINE = {
  ease: { title: "You're at ease right now", body: "Steady and settled — nothing to do." },
  little: { title: "You're a little tense", body: "A bit of an edge lately. Maybe a slow breath." },
  tense: { title: "You're feeling tense", body: "This has held a while. Serenify can check in when you're ready." },
} as const;

// ── Beat 8 · the toast (SHEET) ──────────────────────────────────────────────
export const TOAST = {
  app: "Mail",
  when: "now",
  sender: "Ahmed Hassan",
  subject: "Deadline moved up — need the report by 12",
  /** The audience does the arithmetic. Nobody is told it is bad news. */
  clock: "11:30 AM",
} as const;

// ── Beat 9 · confirmatory questionnaire ─────────────────────────────────────
/**
 * VERBATIM — apps/web/components/questionnaire/confirmatory-prompt.tsx.
 * The sheet flags this copy as never recon'd and says to greybox it with
 * placeholder; it turns out the surface is already built and signed off, so the
 * real strings are used instead. He picks the first option: this is the
 * TRUE-POSITIVE branch, deliberately inverted against the landing hero.
 */
export const QUESTIONNAIRE = {
  title: "Checking in",
  body: "Your signals have looked tense for a little while. Is that how you're feeling?",
  options: ["Yes, that's me", "No, I'm okay", "Maybe — talk about it"],
  chosen: 0,
} as const;

// ── Beat 10 · Ren (PLACEHOLDER) ─────────────────────────────────────────────
/**
 * PLACEHOLDER. `014-recommendations` does not exist, so this is written for the
 * video, at realistic length — length is what this beat is testing, not wording.
 *
 * Turn 3 has to read as *personal knowledge*, not a canned tip; that is the
 * whole difference between Serenify and an app that says "try deep breathing".
 */
export const REN = {
  turns: [
    { who: "ren" as const, text: "Something shifted just now. What happened?" },
    { who: "him" as const, text: "boss moved the deadline. report due at 12. that's thirty minutes" },
    {
      who: "ren" as const,
      text: "Thirty minutes is enough — just not like this. Put Billie Jean on first. You always settle faster with MJ playing.",
    },
  ],
} as const;

// ── Beat 11 · the music player (SHEET, liberty L2b) ─────────────────────────
export const PLAYER = {
  app: "Music",
  track: "Billie Jean",
  artist: "Michael Jackson",
} as const;

// ── Beat 12 · the closing subtitle card ─────────────────────────────────────
/**
 * DECIDED 2026-07-30. **VERBATIM** — `lib/landing/copy.ts`
 * `NEVER_CARD_DECIDE_BODY`, first sentence. The line names the thesis of the whole
 * project — the model does not decide alone — which the video demonstrates across
 * beats 8, 9 and 11 and never states.
 *
 * **"Nothing moved until he answered." was REJECTED, and not on taste.** A great
 * deal visibly moves before he answers: the bloom drifts to amber, the stateline
 * changes twice, the trend line climbs. The audience watches all of it in the thirty
 * seconds before the questionnaire appears, so the line reads as contradicted by the
 * footage. It works as landing-page copy, where "moved" means *no action was taken*;
 * it does not survive being placed after a graph the audience just watched climb.
 * Do not reconsider it.
 *
 * Two constraints it satisfies, for the record:
 *
 *  1. **The video shows only the true-positive path.** "A question, not a verdict"
 *     is a claim about how the reading is *treated*, which is exactly what beat 9
 *     showed; it implies no branch the video did not show.
 *  2. It is **one line**, its own beat, not a fourth event inside the end card.
 */
export const CLOSING_LINE = "A detection is a question, not a verdict.";

// ── Beat 13 · end card (SHEET) ──────────────────────────────────────────────
export const END_CARD = {
  line: "take care of yourself",
  domain: "serenify.tech",
} as const;
