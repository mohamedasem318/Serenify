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
export const SCROLL = { monitor: 32, trend: 634 } as const;

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

/**
 * Phone-legibility floor, as arithmetic rather than folklore. A 1920-wide frame viewed at 422px
 * scales by 422/1920; a push-in framing `framedWidth` world px magnifies by 1920/framedWidth.
 * ~10px is where a line is read rather than merely recognised.
 */
export const PHONE_PX = (worldSize: number, framedWidth: number) => (worldSize * 422) / framedWidth;
