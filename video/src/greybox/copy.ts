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

/**
 * ── THE PROTAGONIST, IN ONE PLACE ───────────────────────────────────────────
 *
 * He is **Youssef Kamal**, and he always was — beat 2 types that name into the signup form and
 * beat 3's welcome banner greets "Youssef". What had leaked in was the repo owner's identity:
 * every `<Header/>` in the film was mounted with `fullName="Mohamed Asem"`, so the avatar in the
 * app header read **MA** for the whole second half of the video while the man on screen was
 * someone else. `deriveInitials` (`lib/initials.ts`) takes them straight off `fullName`, so
 * naming him correctly is the entire fix — there is no initials string to keep in sync.
 *
 * Every render site that needs a name reads it from here rather than inlining one, which is what
 * stops the same leak happening again on the next surface someone mounts.
 */
export const PROTAGONIST = {
  fullName: "Youssef Kamal",
  email: "youssef.kamal@example.com",
} as const;

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
    /**
     * **A REAL password, not a row of bullets.** The greybox typed "••••••••••••" because it
     * drew its own checklist and only needed something to look like typing. `<PasswordInput/>`
     * masks the field itself, and `<PasswordRequirements/>` tests the VALUE — twelve bullet
     * characters satisfy "at least 8" and fail both "contains a letter" and "contains a
     * number", so the real checklist sat permanently two-thirds unlit and 48px taller than its
     * collapsed state. That extra height pushed the submit button through the page's viewport
     * and the beat's pan landed on a sliced control.
     *
     * The order the rules light is a property of the string, so the string is chosen for it:
     * the letter at character 1, the length at 8, and the number at 14 — so the list collapses
     * to "Password looks good." on the last keystroke rather than halfway through.
     */
    { label: "PASSWORD", value: "quietmornings7" },
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
  ease: { title: "You're calm right now", body: "Steady and settled — nothing to do." },
  little: { title: "You're a little uneasy", body: "A bit of an edge lately. Maybe a slow breath." },
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
 *
 * **Turn 2 CARRIES THE SITUATION, and the previous cut of it did not.** It read
 * "boss moved it to 12. thirty minutes", which is 35 characters of pure callback:
 * *it* has no antecedent on screen, so the line only parses for someone who is
 * still holding the toast in their head from forty seconds earlier. In a feed, at
 * phone size, they are not. The beat's job is that the audience understands the
 * stakes from THIS message — the report, the new deadline, and how little time is
 * left — without going back to the notification.
 *
 * So it names the report and states the consequence: 49 characters, still lower
 * case, still no punctuation he would not type in a hurry. It runs f40–f98 — 58
 * frames, ~25 characters a second — which is faster than the ~20 c/s the sheet
 * quotes and is deliberate rather than a fitting compromise: **he is hurried**,
 * and this is the one moment in the film where that is his own behaviour rather
 * than something the UI is telling us. It is still typing and not a blur; every
 * character gets more than two frames.
 *
 * The lever the sheet forbids is speeding the typing *to fit a line the beat
 * cannot afford*. This line is affordable — the typing window opened four frames
 * earlier and the send moved two, and turn 3's hold is untouched at 60 frames.
 *
 * **Ren's reply does NOT type** — it keeps the typing-indicator-then-message
 * treatment. The human types; the AI thinks, then speaks.
 */
export const REN = {
  turns: [
    { who: "ren" as const, text: "Something shifted just now. What happened?" },
    /**
     * **Verbatim, and the lowercase is his.** Decided 2026-07-31 — Mohamed's words, character
     * for character, including the missing capitals and the full stop mid-line. Somebody typing
     * at speed with a deadline in half an hour does not reach for the shift key, and that is the
     * whole reason it is written this way.
     *
     * It is **78 characters** against the previous 49, and at the beat's own ~25 c/s that is 92
     * frames of typing rather than 58. The rate is NOT raised to absorb it — "never sped to fit"
     * is the rule and the copy is now fixed, so the beat grows instead. See `T` below.
     */
    { who: "him" as const, text: "boss moved the deadline to 12. i have only thirty minutes to finish the report" },
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

// ── The four interstitial cards (SHEET) ─────────────────────────────────────
/**
 * DECIDED 2026-08-04. The Egyptian Arabic VO is dropped and LinkedIn autoplays muted, so
 * **on-screen text is the film's only narration** — and it goes on cards rather than as an
 * overlay. The three reasons are in `beats/Interstitial.tsx`; the placement argument is in
 * `GreyboxVideo.tsx`.
 *
 * **THESE FOUR ARE ONE SENTENCE ACROSS THE FILM.** Read in order:
 *
 *   "First it learns what calm looks like. Then it stays quiet. Until something changes.
 *    Then it helps you come back down."
 *
 * Keep them in that relationship. **Do not re-word one in isolation** — in particular
 * **"First" is load-bearing**, because it is what gives the two "Then"s something to continue
 * from, and that is the whole reason the first card exists rather than only the last three.
 *
 * **"calm" is deliberate.** The calibration beat the first card introduces reads "Setting your
 * baseline — one calm moment…" (`CALIBRATION.uploading`, verbatim app copy), so the card and its
 * beat speak the same language.
 *
 * ── NO LANDING-COPY SWAP WAS AVAILABLE, AND THAT WAS CHECKED ────────────────
 *
 * Beat 12's line is verbatim from `lib/landing/copy.ts`, which is what keeps the film's claims
 * tied to the product's own, so each of these four was checked against that file for a near-exact
 * equivalent. None has one. What was considered and rejected, so nobody re-checks it:
 *
 *  · **"First it learns what calm looks like."** — the nearest landing string is `HOW_STEPS[0]`,
 *    "Serenify captures a short baseline of your ordinary face at rest", which is a description
 *    of a mechanism rather than the same sentence. The genuinely near-exact phrasing —
 *    "what your calm looks like" (the dashboard banner) and "We've learned what calm looks like
 *    for you" (the calibration success state) — is **app** copy, not landing copy, and both are
 *    already on screen in beats 3 and 5; quoting one on the card that introduces them would make
 *    the card a caption of the surface behind it.
 *  · **"Then it stays quiet."** — `PANEL_RESOLVED_BODY` has "Serenify goes quiet and keeps
 *    watching", which is loosely similar and is about a *declined* prompt, a branch this film
 *    never shows. Not a substitute.
 *  · **"Until something changes."** — `NARRATION.climbing` is "Signals climb, and keep climbing",
 *    a different claim about a different thing.
 *  · **"Then it helps you come back down."** — `NARRATION.backToCalm` is "Back to calm —
 *    because they were asked, not told", which is both a different claim and an **"X, not Y."**
 *    construction. That construction is beat 12's and is reserved: reusing it here would make the
 *    closing card the repeat of a device rather than the film's one claim.
 */
export const INTERSTITIALS = {
  /** Between beat 4 (the camera gate) and beat 5 (calibration). */
  calm: "First it learns what calm looks like.",
  /** Between beat 5 (calibration) and beat 6 (later) — the film's one unexplained time jump. */
  quiet: "Then it stays quiet.",
  /** Between beat 7 (calm) and beat 8 (the email) — the inciting incident. */
  changes: "Until something changes.",
  /** Between beat 9 (questionnaire) and beat 10 (Ren) — it stops measuring and starts talking. */
  down: "Then it helps you come back down.",
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
