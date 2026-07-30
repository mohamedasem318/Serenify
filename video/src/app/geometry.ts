import { Rect, rect } from "../greybox/Camera";

/**
 * ══ MEASURED GEOMETRY ═══════════════════════════════════════════════════════════════
 *
 * **Every number in this file was measured, not estimated.** They come from
 * `src/SwapProbe.tsx` rendering the REAL `apps/web` components at the REAL 1200px world, in
 * dark, and printing `getBoundingClientRect()` to stdout. Re-run it after any `apps/web`
 * layout change:
 *
 *   npx remotion still SwapProbe out/probe.png --frame=0 --port 3412 --log=verbose
 *
 * Three consecutive revisions of the beat sheet logged crop complaints, and all three traced
 * to framing fitted against greybox rectangles. Nothing here is scaled from those — the old
 * numbers were thrown away rather than converted, which is the whole point of the exercise.
 *
 * ── WHAT THE MEASUREMENTS CHANGED, IN ONE PLACE ─────────────────────────────────────
 *
 *  · The monitoring column is `max-w-3xl` = **768**, not the greybox's 700.
 *  · The stage card is **607.7 tall**, not 476. The bloom alone is `sm:size-72` = **288**,
 *    where the greybox drew 148.
 *  · **The viewfinder is INSIDE the stage card**, top-right, overlaying it at `z-10`
 *    (`monitoring-session.tsx:805`) — not a separate panel 300px to the card's right. Its real
 *    size is 224×126.9.
 *  · The session readout is a row ABOVE the card, not a corner overlay.
 *  · The trend is a full card BELOW the stage, 101.5 tall with its own heading and legend.
 *  · The calibration preview is **512×288 and 16:9**; only the bracket guide inside it is 3:4,
 *    at 168.5×224.6 (register item 5).
 *
 * ── THE CONSEQUENCE THAT COSTS THE MOST ─────────────────────────────────────────────
 *
 * The real monitoring page is **~973px tall** below the chrome, against a 583px viewport. It
 * scrolls, and it always did — the greybox only fitted because it was drawing a smaller card.
 * So the beats now carry a scroll offset (`SCROLL`), which is honest behaviour rather than a
 * device, and beat 11 travels between two of them. Measured directly: bloom-top to trend-bottom
 * is 664.2px and the viewport below the sticky header is 519px, so **the bloom and the trend
 * cannot be on screen together at this world.** Beat 11 is staged around that, in the sheet's
 * own causal order.
 */

// ── The shell ───────────────────────────────────────────────────────────────────────

/** OS chrome ends / page begins. */
export const VIEWPORT_Y = 92;
/** `Header` — `sticky top-0 … h-16`. Measured 0,92 → 1200×64. */
export const HEADER: Rect = rect(0, 92, 1200, 64);
/** The toolbar clock (L11). Right edge shares the toast's and the viewfinder's — see below. */
export const CLOCK: Rect = rect(923, 58, 140, 30);

// ── The monitor page, at scroll 0 ───────────────────────────────────────────────────
//
// Measured with the real `<Header/>` mounted. Everything except the header shifts up by
// `SCROLL.monitor` when a beat renders the page scrolled.

export const RAW = {
  timerRow: rect(216, 188, 768, 44),
  stage: rect(216, 244, 768, 607.7),
  bloom: rect(456, 309, 288, 288),
  statelineHead: rect(450.8, 621, 298.5, 36),
  statelineSub: rect(456.2, 663, 287.6, 25.5),
  controls: rect(449.4, 716.5, 301.2, 44),
  footnote: rect(449.4, 792.5, 301.2, 18.2),
  /** The REAL viewfinder, unscaled: `w-52 sm:w-56` `aspect-video` at `right-4 top-4`+`top-12`. */
  viewfinder: rect(743, 309, 224, 126.9),
  /**
   * **POPULATED, not empty.** The empty card is 101.5 tall — heading and one line — and the
   * populated one is **355.7**, because it also carries the subtitle, a 718×210 plot and a
   * six-key legend. Beat 11's landing was first derived from the empty height and framed the
   * plot straight off the bottom edge; the card looked present and the line the beat exists to
   * show was not in the shot.
   */
  trend: rect(216, 871.7, 768, 355.7),
  /** The plot itself, inside the card. Measured 718×210 at y 962.2. */
  trendPlot: rect(241, 962.2, 718, 210),
  welcome: rect(216, 1005.2, 768, 83.1),
  calibrationBanner: rect(216, 1112.3, 768, 87.5),
} as const;

/**
 * ── THE SCROLL OFFSETS, AND WHY THESE TWO ───────────────────────────────────────────
 *
 * `monitor` = 32. Chosen against two constraints that nearly conflict, both measured:
 *
 *   · At scroll 0 the stateline's SUB sits at y 663–688.5 and the viewport ends at 675 — the
 *     sub is clipped. Beat 7 cannot read at scroll 0 at all.
 *   · The session readout (`Session · 47:12`) lives in the row at y 188–232, and the sticky
 *     header covers everything above 156. Any scroll past 32 hides the readout, which beat 7
 *     lists as required content.
 *
 * So 32 is the largest scroll that keeps the readout and the smallest that frees the sub.
 * It is not a taste value; it is the intersection of two measured constraints.
 *
 * `trend` = 634 centres the POPULATED trend card (871.7 – 1227.4, 355.7 tall) in the region
 * below the sticky header. Beat 11 travels 32 → 634 during its pull-out.
 *
 * **And the stateline cannot come with it**, which was measured rather than judged:
 *
 *   stateline head top → trend plot bottom     551.2 px
 *   viewport below the sticky header           519.0 px
 *                                              ─────────
 *                                              32 px short
 *
 * Thirty-two pixels, and there is no honest way to find them — the header is `sticky top-0` so
 * it cannot be scrolled away, and framing through it would put the returned copy behind the
 * header. So the beat reads the returned stateline in the shot BEFORE the move (it changes at
 * f146, framed) and lands on the trend card whole. Both are read, neither is cropped, and the
 * causal order is the sheet's own.
 */
export const SCROLL = { monitor: 40, trend: 634 } as const;

/**
 * ── THE SUB IS NOT ALWAYS ONE LINE, AND THAT IS WHY `monitor` MOVED 32 → 40 ─────────
 *
 * `RAW.statelineSub` was measured at **25.5 tall — one line** — against the `at_ease` copy, which
 * is what the probe happened to render. Two of the three copies the film shows are one line:
 *
 *   at_ease         "Steady and settled — nothing to do."                        1 line
 *   a_little_tense  "A bit of an edge lately. Maybe a slow breath."              1 line
 *   tense           "This has held a while. Serenify can check in when you're    2 lines
 *                    ready."
 *
 * The sub is `max-w-[42ch]` (~393px at 17px Inter), and the `tense` copy is 62 characters, so it
 * wraps. At the old scroll of 32 its second line ran to raw y 714 against a viewport bottom of
 * 707, and **the descenders of the film's most important reading were sliced** — at rest, before
 * any emphasis, and the sheet's own rule is that a sliced line of text is always a failure. It
 * was invisible in review because every still anyone framed was an `at_ease` one.
 *
 * 40 is again the intersection of measured constraints, now three:
 *
 *   s > 39      the two-line `tense` sub clears the viewport bottom (714 − s ≤ 675)
 *   s ≤ 41.5    the Pause/End controls stay BELOW the fold (716.5 − s ≥ 675). Past this they
 *               appear, and the raised stateline lands on top of them.
 *   s as small  the `Session · 47:12` readout sits in the row at y 188–232 under a sticky header
 *   as possible ending at 156. At 40 the row's top 8px is covered and its centred text clears by
 *               ~14px; past ~48 the text itself goes under.
 *
 * The window is (39, 41.5]. There is no taste in it.
 */

/**
 * ── AND THE EMPHASIS CANNOT SPEND ROOM THAT IS NOT THERE ────────────────────────────
 *
 * L12's 1.25× was derived against a one-line block. Measured against the two-line `tense` copy
 * it does not fit, and no scroll rescues it — the arithmetic is scroll-invariant:
 *
 *   raised two-line bottom   737.25 − s
 *   Pause/End controls top   716.5  − s
 *
 * The first is 20.75px below the second at EVERY scroll, so a 1.25× raise on the `tense` copy
 * either runs off the viewport or runs through the controls. There is no third option at this
 * layout. **This is the measured case for §7's Pass-B rearrangement** — moving the bloom,
 * stateline and trend into their own column is what buys the block the room it needs.
 *
 * So the factor is capped by the room actually available, per copy, and the cap is what makes
 * the device safe rather than a rule anyone has to remember:
 *
 *   room = viewportBottom(raw) − block top = (675 + 40) − 621 = 94
 *   one line   block 621 → 688.5  = 67.5 tall → cap 1.39 → L12's 1.25 applies
 *   two lines  block 621 → 714    = 93   tall → cap 1.01 → the raise is unavailable
 *
 * That is not the device failing quietly. **The collapse IS the firing**: beat 8 raises on its
 * first copy change and the block settles as the second lands, so both changes carry movement
 * and nothing yo-yos — see `Beat08Email.tsx`.
 */
const STATELINE_LINE_H = 25.5;
const VIEWPORT_BOTTOM_RAW = 675 + SCROLL.monitor;

/** The natural (unraised) height of the stateline block, for a sub of `lines` lines. */
export const statelineBlockHeight = (lines: number): number =>
  RAW.statelineSub.y + STATELINE_LINE_H * lines - RAW.statelineHead.y;

/**
 * The largest factor the block can grow to without a line leaving the page's own viewport.
 * Never above L12's 1.25×, and never below 1 — a block that would already be clipped at rest is
 * a defect to fix at the scroll, not something to shrink out of.
 */
export const emphasisCapFor = (lines: number): number => {
  const room = VIEWPORT_BOTTOM_RAW - RAW.statelineHead.y;
  return Math.max(1, Math.min(EMPHASIS_FACTOR, room / statelineBlockHeight(lines)));
};

/** How many lines each band's sub wraps to at `max-w-[42ch]`. Measured, not guessed. */
export const SUB_LINES = { at_ease: 1, a_little_tense: 1, tense: 2 } as const;

/** A raw rect shifted by a scroll offset. The sticky header never moves. */
export const scrolled = (r: Rect, s: number): Rect => rect(r.x, r.y - s, r.w, r.h);

/**
 * ── LIBERTY L1, RE-DERIVED ──────────────────────────────────────────────────────────
 *
 * The app draws the viewfinder at 224×126.9. L1 enlarges it so the face is readable on a
 * phone, and the register (item 6) kept L1 explicitly while asking for the size to be
 * re-checked against the real component "and only against a measured figure". Here is the
 * measured figure.
 *
 * L1's declared size is 320×180, and it survives — but the direction it grows had to change.
 * Scaling it about its top-RIGHT corner (its anchor in the app) grows it leftward, and the
 * bloom's right edge is at 744 against the viewfinder's left at 743: **any leftward growth
 * covers the bloom's solid core**, which is opaque out to a 69px radius (the gradient's
 * `var(--bloom) 34%` stop over a 203.6px farthest-corner). Beat 7's entire job is to plant
 * bloom, stateline and viewfinder together, so that is not available.
 *
 * So it grows from its top-LEFT instead: 743 → 1063, overhanging the stage card's right edge
 * (984) by 79px onto the page. That is within the component's own nature — it is an
 * `absolute … z-10` overlay, not a card child — and at narrower viewports the real component
 * overlaps the bloom itself. The bloom stays untouched, which is what beat 7 needs.
 */
export const VF_SCALE = 320 / 224;
export const VIEWFINDER: Rect = rect(743, RAW.viewfinder.y, 320, 126.9 * VF_SCALE);

/**
 * The toast and the clock right-align to the viewfinder's right edge (1063), restoring the
 * sheet's "clock, toast and viewfinder share a right edge so beat 8 frames one vertical stack"
 * relationship at the real geometry. The greybox's shared edge was 1176; the real viewfinder
 * cannot reach it without covering the bloom, so the STACK moved rather than the viewfinder.
 *
 * The omnibox shortens to 840 to clear the clock at 923 — the same trade L11 already made.
 */
export const STACK_RIGHT = 1063;
/**
 * 104 tall, not the greybox's 82: the boss's subject line wraps to two lines at 320 wide, and at
 * 82 the second line spilled out through the panel's rounded bottom edge. Measured from the
 * content — 12 pad + 15 meta + 19 sender + 2 × 17.5 subject + margins + 12 pad.
 *
 * Bottom lands at 291, which leaves 18px between the toast and the viewfinder's top at 309 —
 * adjacent, which is the whole of liberty L2: you watch his face fall *while the toast is up*.
 */
export const TOAST: Rect = rect(743, 187, 320, 104);

/**
 * ── THE EMPHASIS (L12), AND REGISTER ITEM 3 ─────────────────────────────────────────
 *
 * The greybox grew the stateline block **1.65×**. That factor was derived against a composite
 * framing of ~1096 world px, where the app's 17px sub lands at 6.5px on a phone and needs 1.6×
 * just to clear the ~10px legibility floor.
 *
 * At the real geometry the composite is **760 wide**, not 1096 — because the real viewfinder is
 * inside the card rather than 300px to its right, so the union of bloom + stateline + viewfinder
 * is far tighter. At 760 the sub already lands at 9.4px. The factor needed for legibility alone
 * is 1.064×, which is not a device; it is a rendering artefact.
 *
 * **So the emphasis yields, which is exactly what register item 3 asks of it** — the layout does
 * not move to accommodate a video device. It goes to **1.25×**, chosen against two measured
 * clearances rather than taste:
 *
 *   bloom bottom      565.0   (scroll 32)
 *   stateline top     589.0   ← the block grows DOWNWARD from here; its top never moves,
 *                               so the bloom is untouchable by construction
 *   block at 1.25×    589.0 – 673.4
 *   controls top      684.5   → 11.1px of clearance
 *   frame bottom      680.4   → the block finishes inside the shot
 *
 * At 1.65× the block would reach 700.4 — through the controls and out of frame. The device
 * survives as grammar (it still fires on every copy change, which is what makes it grammar);
 * only its amplitude yields, and legibility is better than it was because the shot is tighter.
 *
 * **This is the CEILING, not the applied factor.** The arithmetic above is a one-line block's;
 * `emphasisCapFor()` above re-derives it per copy against the real number of lines, and the
 * two-line `tense` sub does not fit at any scroll. See that function's header.
 */
export const EMPHASIS_FACTOR = 1.25;

/** The stateline block the emphasis raises: head + sub, as one. */
export const STATELINE_BLOCK: Rect = rect(
  RAW.statelineHead.x,
  RAW.statelineHead.y,
  RAW.statelineHead.w,
  RAW.statelineSub.y + RAW.statelineSub.h - RAW.statelineHead.y,
);

// ── Calibration ─────────────────────────────────────────────────────────────────────

/**
 * **Register item 5, measured.** The preview is a full-width `aspect-video` box in a
 * `max-w-lg` (512) column — so **512×288, 16:9**. The greybox drew the whole preview 3:4 at
 * 240 wide; only the bracket GUIDE was ever 3:4, and it is, at 168.5×224.6 (`h-[78%]` of 288,
 * `aspect-[3/4]`), floating centred inside the 16:9 box.
 *
 * The change is not cosmetic: the box is 2.1× wider than the greybox's, so beat 5's framing is
 * re-derived rather than adjusted, and the centring nudge now has real room to read against —
 * the bracket target occupies only 33% of the box's width, so being off-centre is visible in a
 * way it never was inside a 3:4 box that the face filled.
 */
export const CALIB = {
  /** Relative to the calibration column's top. Column is 512 wide, centred → x 344. */
  preview: rect(344, 0, 512, 288),
  brackets: rect(515.8, 31.6, 168.5, 224.6),
  greenRoom: rect(344, 304, 512, 204.2),
  recordingStage: rect(344, 304, 512, 150),
  intro: rect(376, 0, 448, 514.6),
} as const;

/**
 * ── THE SUCCESS STATE, AND REGISTER ITEM 4 ──────────────────────────────────────────
 *
 * Measured: the component is **448 × 346.9** (`max-w-md` + `px-2 py-6`), and its badge is 96×96
 * sitting 24px below its own top edge.
 *
 * **The bounding box that matters is not the component's.** The ripple
 * (`success-state.tsx:30-36`) animates a `size-24` span to `scale: 2.1`, so it reaches
 * (96 × 2.1 − 96) / 2 = **52.8px beyond the badge on every side** — and since the badge sits
 * only 24px below the component's top edge, the ripple crosses that edge by **28.8px**.
 *
 * That is why beat 5f has read as punched-in across three revisions: every previous framing
 * measured the component and cropped the ripple, so the payoff played with its own bloom
 * clipped by the frame edge. `SUCCESS_FRAMED` is the component grown by the ripple's real
 * overshoot on all four sides — the rect the camera must actually hold.
 */
export const RIPPLE_OVERSHOOT = 52.8;
export const SUCCESS: Rect = rect(376, 0, 448, 346.9);
export const SUCCESS_BADGE: Rect = rect(552, 24, 96, 96);
export const SUCCESS_FRAMED: Rect = rect(
  SUCCESS_BADGE.x - RIPPLE_OVERSHOOT,
  SUCCESS.y - (RIPPLE_OVERSHOOT - 24),
  Math.max(SUCCESS.w, SUCCESS_BADGE.w + RIPPLE_OVERSHOOT * 2),
  SUCCESS.h + (RIPPLE_OVERSHOOT - 24),
);

// ── Beat 4's gate ───────────────────────────────────────────────────────────────────

/**
 * Measured: **576 × 1169.9**, laid out as page-level content rather than inside one tall outer
 * card. In a 583px viewport that is very nearly exactly two screens — which is why the beat
 * scrolls, and why the scroll is honest rather than a device: the page genuinely does not fit,
 * and the copy is saying "this is long because it matters".
 */
export const CONSENT_GATE: Rect = rect(312, 0, 576, 1169.9);

// ── Beats 1, 2, 3 and 6, measured ───────────────────────────────────────────────────
//
// All in WORLD coordinates as the beats render them — the probe's own page offsets are already
// subtracted. Re-run `SwapProbe` after any `apps/web` layout change.

/**
 * **The landing page, and it is not what the greybox drew.**
 *
 * The greybox had a centred 640-wide block: headline, lede, data line, two buttons. Three
 * measured facts about the real hero contradict it, and all three change the shot:
 *
 *  · **Two columns.** `hero.tsx:48` is `flex-col lg:flex-row`, and 1200 is well past `lg`, so
 *    the copy column and `<StoryCard/>` sit side by side. The stacked version exists only below
 *    1024 and the film never renders there.
 *  · **The headline is 67.2px**, not 40 — `clamp(2.125rem, 5.6vw, 3.5rem)` resolves against the
 *    viewport, and at 1200 that is the 3.5rem cap.
 *  · **The copy column is 510 wide**, and the story card is another 510 beside it. The hero is
 *    1120 across, not 640.
 *
 * The copy column is vertically CENTRED against the story card (`lg:items-center`), which is why
 * it starts 62.9px below the section's own top padding rather than at it.
 */
export const LANDING = {
  navbar: rect(0, 92, 1200, 64),
  /** The `<section>`'s top edge — immediately under the sticky navbar. */
  heroTop: 156,
  /** Headline + lede + CTAs + data line, as one column. */
  heroCopy: rect(64, 274.9, 510, 369.3),
  heroHeadline: rect(64, 274.9, 510, 178.1),
  /** "Get started" — beat 1 ends on a click of it. */
  ctaGetStarted: rect(64, 556.2, 138.7, 44),
  storyCard: rect(626, 212, 510, 495.2),
} as const;

/**
 * **Signup, and there is no card.**
 *
 * `app/(auth)/layout.tsx` states it outright — "no card chrome — the page IS the surface" — and
 * there is no public navbar either: the `(auth)` group has its own shell, a `max-w-md` (448)
 * column with the wordmark at `text-4xl sm:text-5xl` and the theme toggle. The greybox drew a
 * 512px bordered card under the public nav, which is two elements that do not exist on `/signup`.
 *
 * **And the column is 818.5 tall in a 583px viewport**, so the page scrolls — the submit button
 * sits 79.5px below the fold at scroll 0. That is the product's own behaviour at this world, not
 * a video device, and it is the same class of finding as the monitoring page's scroll.
 */
export const SIGNUP = {
  /** The content column's own bounds. `max-w-md` (448) less `px-4 sm:px-6`. */
  col: rect(400, 92, 400, 818.5),
  wordmark: rect(400, 156, 400, 56),
  section: rect(400, 260, 400, 586.5),
  heading: rect(400, 260, 400, 47.5),
  /** Label + input, as `<Field/>` renders them. The input alone is 48 tall, 22 below the label. */
  fieldName: rect(400, 370.2, 400, 72.2),
  fieldEmail: rect(400, 466.4, 400, 72.2),
  /** The password `<Field/>` plus `<PasswordRequirements/>` under it, as one `space-y-2` group. */
  fieldPassword: rect(400, 562.6, 400, 106.4),
  passwordRules: rect(400, 642.8, 400, 26),
  /** The acknowledgement's 20px checkbox — where the tick click lands. */
  consentBox: rect(400, 685, 20, 20),
  consentRow: rect(400, 685, 400, 48),
  submit: rect(400, 754.5, 400, 48),
  /** The whole labelled field group, for the 2a push-in. */
  fieldGroup: rect(400, 370.2, 400, 298.8),
  /** Consent + submit together, for the 2b–2c pan. */
  consentAndSubmit: rect(400, 685, 400, 117.5),
} as const;

/** The "Check your email" state and the OTP panel inside it. Same shell, same column. */
export const VERIFY = {
  section: rect(400, 260, 400, 442.1),
  heading: rect(400, 260, 400, 36),
  panel: rect(400, 396.2, 400, 253.9),
  /** The six boxes: 52 wide on an 8px gap, centred on the world. Confirmed by measurement —
   *  box 0 at x 424 and box 5 at x 724 give a 60px step, which is 52 + `gap-2`. */
  otpRow: rect(424, 537.1, 352, 52),
} as const;

/**
 * The dashboard, at `max-w-6xl` (1152) inside the authed layout's `sm:px-6`.
 *
 * `space-y-10` (40) separates the banner from the greeting, so beat 6's layout is not beat 3's
 * with a hole in it — everything below the missing banner moves up by 126, which is exactly the
 * "its absence is the beat's visible content" the sheet asks for.
 */
export const HOME = {
  calibrationBanner: rect(24, 124, 1152, 86),
  /** "Set baseline". Beat 3 ends on a click of it. */
  setBaseline: rect(948.8, 145, 114, 44),
  /** With the banner above it (beat 3). */
  welcomeWithBanner: rect(24, 250, 1152, 83.1),
  /** Without it (beat 6). */
  welcome: rect(24, 124, 1152, 83.1),
} as const;

/**
 * Beat 4's gate, broken into the blocks the beat actually frames.
 *
 * 1169.9px of page in a 583px viewport — very nearly exactly two screens, which is why the beat
 * scrolls and why the scroll is honest rather than a device.
 */
export const GATE = {
  section: rect(312, 124, 576, 1169.9),
  header: rect(316, 148, 568, 200.4),
  /** "What happens" — the first bordered card. */
  facts1: rect(316, 372.4, 568, 416.3),
  /** "What declining changes" — the second bordered card. */
  facts2: rect(316, 812.6, 568, 325.3),
  buttons: rect(316, 1161.9, 568, 108),
  /** "Allow camera and inference". The beat ends on it. */
  allow: rect(316, 1161.9, 568, 48),
  /**
   * ── THE PRIVACY PITCH IS IN THE FIRST CARD, NOT THE LAST ──────────────────────────
   *
   * "Nothing is kept. There is no bucket, no table, and no file path where a clip lands." —
   * `CAMERA_GATE_WHAT_HAPPENS[2]`, the **third bullet of the first** `<Facts/>` block. The beat
   * sheet's staging assumed it was in the card nearest the button ("one landing holds the key
   * line's card AND the button"), and the greybox drew it that way; the shipped copy puts it in
   * "What happens to the video", 550px further up the page. The first landing after the swap
   * was on "What declining changes" — a real card, correctly rendered, and the wrong one.
   *
   * **And the two cannot share a frame, by 11.8px.** Key-line top to Allow's bottom is 594.8;
   * the viewport is 583. It is the closest near-miss in the film and it is still a miss, so the
   * beat takes two landings inside one continuous move — the sheet's own remedy for exactly
   * this, applied once more.
   */
  keyLine: rect(341, 615.1, 518, 91),
} as const;

/**
 * ── THE CONFIRMATORY PROMPT LIVES IN SCREEN SPACE, NOT IN THE WORLD ─────────────────
 *
 * `<Notification/>` portals to `document.body` and is `fixed right-4 w-80 bottom-[…]`
 * (`notification.tsx:186`), so it resolves against the 1920×1080 OUTPUT frame and is outside the
 * camera's transform entirely. A wrapper around `<ConfirmatoryPrompt/>` cannot move it — the
 * portal escapes the wrapper — which is why beat 9's prompt sits bottom-right of the frame
 * regardless of where the camera is looking. **That is the known framing complaint and Pass B
 * owns it**; what is recorded here is only where the control is, so the cursor can reach it.
 *
 * Measured in OUTPUT pixels, not world pixels. Anything drawn against these must sit outside
 * `<Camera>`.
 */
export const PROMPT_SCREEN = {
  panel: rect(1584, 758, 320, 290),
  /** "Yes, that's me" — the true-positive branch. */
  yes: rect(1609, 875, 270, 44),
} as const;

/**
 * ── THE CONTROLS, RELATIVE TO THEIR OWN COMPONENT ───────────────────────────────────
 *
 * A drawn pointer that lands NEAR a button reads as a miss, so every click site is measured off
 * the control rather than eyeballed. These are offsets from each component's own top-left, and
 * the beat adds the page position it gave that component — which is what keeps them correct if
 * a beat ever restages.
 */
export const CONTROL = {
  /** `<Intro/>` (448 × 514.6) — "Turn on camera". */
  turnOnCamera: rect(8, 422.6, 432, 48),
  /** `<GreenRoom/>` (512 × 204.2) — the ready button. */
  imReady: rect(21, 83.2, 470, 48),
  /** `<SuccessState/>` (448 × 346.9) — "Back to home". */
  backToHome: rect(64, 274.9, 320, 48),
} as const;

/** The centre of a rect — where a pointer's tip should land. */
export const centre = (r: Rect): { x: number; y: number } => ({
  x: r.x + r.w / 2,
  y: r.y + r.h / 2,
});

/**
 * Phone-legibility floor, as arithmetic rather than folklore. A 1920-wide frame viewed at 422px
 * scales by 422/1920; a push-in framing `framedWidth` world px magnifies by 1920/framedWidth.
 * ~10px is where a line is read rather than merely recognised.
 */
export const PHONE_PX = (worldSize: number, framedWidth: number) => (worldSize * 422) / framedWidth;
