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
 *  · The monitoring column ships at `max-w-3xl` = **768**, not the greybox's 700. **L14 narrows
 *    it to `max-w-lg` = 512** — see `shell.tsx` § MONITOR_COL for the measured reason, and the
 *    note below for what it bought.
 *  · The stage card is **607.7 tall** as the app lays it out, not the greybox's 476 — and
 *    **675.2 at L14**, which spends the difference on the reserved second sub line and the 70px
 *    controls gap. The bloom alone is `sm:size-72` = **288**, where the greybox drew 148.
 *  · **The viewfinder ships INSIDE the stage card**, top-right, overlaying it at `z-10`
 *    (`monitoring-session.tsx:805`) — not a separate panel 300px to the card's right. Its real
 *    unscaled size is 224×126.9. **L14 pins it beside the card instead**, outside the scroll
 *    container; see § THE PINNED RIGHT COLUMN.
 *  · The session readout ships as a row ABOVE the card, not a corner overlay. **L14 moves it
 *    into the card's own `pt-16` band**, which is what freed the page scroll.
 *  · The trend is a full card BELOW the stage: 101.5 tall EMPTY, **355.7 populated**, with its
 *    own heading, subtitle, plot and six-key legend.
 *  · The calibration preview is **512×288 and 16:9**; only the bracket guide inside it is 3:4,
 *    at 168.5×224.6 (register item 5).
 *
 * ── THE CONSEQUENCE THAT COST THE MOST, AND WHAT L14 DID ABOUT IT ───────────────────
 *
 * The real monitoring page is **~973px tall** below the chrome, against a 583px viewport. It
 * scrolls, and it always did — the greybox only fitted because it was drawing a smaller card.
 * At `max-w-3xl` that scroll was not a staging device but a trap, and three separate defects
 * were all one fact:
 *
 *   · the POPULATED trend card's bottom (1227.4) is **918.4px** below the bloom's top (309), so
 *     no 16:9 frame ≤1200 world px can hold the reading and the trend together;
 *   · the viewfinder was rendered INSIDE the scrolling column, so at `SCROLL.monitor = 40` its
 *     top landed at 269 against the toast's bottom at 291 — **the toast overlapped the
 *     viewfinder by 22px**, which is the "notification covers the viewfinder" defect in beats
 *     8 and 9. The old 18px gap was computed against the UNSCROLLED viewfinder;
 *   · the two-line `tense` sub had 94px of room for a 93px block, i.e. an emphasis cap of
 *     ~1.01× — the film's central device dead on the film's most important reading.
 *
 * **L14 is the rearrangement those measurements ask for**, and it is arrangement only — no
 * component is re-styled, re-coloured or re-worded:
 *
 *   1. the column narrows to `max-w-lg` (512), which leaves the bloom exactly where it was
 *      (x 456–744, centred) and frees the page from x 856 rightward;
 *   2. the viewfinder, the mail toast and the confirmatory prompt move into a **pinned right
 *      column at x 856–1176** that does NOT scroll. The toast/viewfinder overlap is gone by
 *      construction, and 1176 is the drawn clock's own right edge — the sheet's "clock, toast
 *      and viewfinder share a right edge" relationship, restored;
 *   3. the `Session · MM:SS` readout moves out of a row ABOVE the card into the card's own
 *      `pt-16` band. That row is what used to pin the scroll into a 39–41.5 window;
 *   4. the stateline's sub **reserves two lines always**, so the block's height — and therefore
 *      every framing derived from it — no longer changes when the copy does;
 *   5. the stateline→controls gap goes 28 → 70, which is what buys L12's 1.25× back on the
 *      two-line copy with 46.75px still clear of the controls.
 */

// ── The shell ───────────────────────────────────────────────────────────────────────

/** OS chrome ends / page begins. */
export const VIEWPORT_Y = 92;
/** `Header` — `sticky top-0 … h-16`. Measured 0,92 → 1200×64. */
export const HEADER: Rect = rect(0, 92, 1200, 64);
/**
 * The toolbar clock (L11). Right edge 1176 — shared with the toast's and the viewfinder's.
 *
 * ── THIS RECT USED TO DISAGREE WITH THE DRAWN CLOCK, AND IT SLICED IT ───────────────
 *
 * It said x 923 (right edge 1063) while `shell.tsx:84` **draws** the clock at x 1036 (right edge
 * 1176), because the previous pass moved the toast/viewfinder stack left to 1063 and moved this
 * rect with it without moving the drawing. `BEAT8_CLOCK` frames `CLOCK ∪ TOAST`, so it framed
 * 673–1133 and the drawn clock was cut at 1133: on a render it reads **"11:30 A"**. The one
 * number in the film the whole of beat 8 depends on, with its meridiem sliced off.
 *
 * Geometry follows the drawing, never the other way round — the clock is not moved.
 */
export const CLOCK: Rect = rect(1036, 58, 140, 30);

// ── The monitor page, at scroll 0 ───────────────────────────────────────────────────
//
// Measured with the real `<Header/>` mounted, at L14's arrangement (`max-w-lg`, the readout in
// the card's top band, the sub reserving two lines, the 70px controls gap). Everything HERE
// shifts up by `SCROLL.monitor` when a beat renders the page scrolled; the sticky header and the
// pinned right column (`VIEWFINDER`, `TOAST`, `PROMPT`) never do.

/**
 * ── THE ARRANGEMENT L15 SPENDS, AND WHERE IT IS APPLIED ─────────────────────────────
 *
 * All of it is applied from OUTSIDE `apps/web`, by the scoped stylesheet in `monitor.tsx`
 * (`<StageLayout/>`) — the same mechanism `motion.tsx` uses four times over to reach into a
 * component the video must not fork. Nothing in the product is edited; what changes is the
 * arrangement the film renders it in.
 *
 * They are declared here because every framing number is derived from them.
 */
/**
 * ── L16 · THE TREND MOVES INTO THE CARD, AND TWO THINGS GIVE FOR IT ─────────────────
 *
 * L15 put the trend in the pinned right column, beside his face. It reads there, and it costs
 * the column an occupant it then has to swap: the confirmatory prompt lands on the same y, so
 * beat 9 covers the trend with the prompt. **The trend belongs under the reading it is the
 * history of**, which is the left card, and the right column then holds one thing — the
 * viewfinder — with the toast above it and the prompt below it, neither replacing anything.
 *
 * The recon priced the move and it does not fit for free: at the card's own content width the
 * column runs 587.6px against a 519px viewport. **Two blocks give, not one:**
 *
 *  · **The orb comes down 176 → 96.** It is the largest block of vertical page in the act and it
 *    is the only one big enough. The halo is `-inset-[28%]`, so the glow still spans 150.
 *  · **FR-024's footnote is DELETED — and this is a CONTENT liberty, not a geometric one**, the
 *    same category as L15's Pause / End controls and recorded with the same distinction. See the
 *    liberties table (L16): it removes a real privacy statement from a real surface, and it is
 *    acceptable only because the film states that idea more loudly twice over — the camera
 *    consent gate is a whole beat, and beat 5a's privacy line carries the in-place emphasis.
 *
 * Everything else in this block resizes or repositions something the product ships.
 */
/** `sm:size-72` = 288 in the product; 176 at L15. The halo is `-inset-[28%]` → the glow spans 150. */
export const BLOOM_SIZE = 96;
/** `pt-16` = 64 in the product. The readout row's 44px box fits 48 at `top-1`. */
export const CARD_PT = 48;
/** `sm:pb-10` = 40 in the product. */
export const CARD_PB = 24;
/** The sub's reserved height — two lines of its own 25.5px leading. */
const STATELINE_LINE_H = 25.5;
export const SUB_MIN_HEIGHT = STATELINE_LINE_H * 2;
/** The gutter the pinned column keeps from the card AND between its own surfaces. */
export const PINNED_GAP = 32;

/**
 * The air between the stateline block and the trend card inside the stage card. It is
 * `CARD_PB`, deliberately: the trend then carries the same 24px above it as the card's own
 * padding gives it below, so the nested card sits in the stage card's content box with equal air
 * on both sides rather than with a gap chosen by eye.
 */
export const TREND_GAP = CARD_PB;

/**
 * ── THE TREND'S WIDTH IS THE CARD'S OWN CONTENT WIDTH, NOT A CHOSEN NUMBER ─────────
 *
 * `max-w-md` (448) less `sm:px-10` (40 each side) = **368**. Drawing it at anything else would
 * be a number to defend; drawn at the content width it is simply a card inside a card, and its
 * left and right edges are the stage card's own padding box.
 */
export const TREND_NATURAL_W = 768;
export const TREND_RENDER_W = 368;
export const TREND_SCALE = TREND_RENDER_W / TREND_NATURAL_W;

export const RAW = {
  /**
   * The `Session · MM:SS` readout and the back link, as ONE row inside the stage card's own top
   * band — not the row above the card the app draws. Nothing about the readout changes except
   * which box it sits in, and that move is what freed the page scroll (L14).
   */
  sessionReadout: rect(417, 193, 366, 44),
  /**
   * The stage card, at L16's arrangement — the orb at 96, no footnote, and the trend inside it.
   * Whole in the composite, as it has been since L15.
   *
   * **457.5, and the column is now one rhythm.** The trend's own card is stripped (see
   * `trendNatural` and `monitor.tsx` § THE TREND IS NO LONGER A CARD INSIDE A CARD), which takes
   * 23.9 scaled px out of the card AND removes the doubled air the nested `sm:p-6` was adding
   * above the heading and under the plot. Every gap in the column is `CARD_PB` = 24 now, top to
   * bottom, with the single exception of the stateline's own `mt-1.5` inside its block:
   *
   *   card top          188          (+1 border, +48 top band)
   *   bloom             237 –  333
   *   stateline head    357 –  393   (`mt-6`      → 24 clear of the orb)
   *   stateline sub     399 –  450   (`mt-1.5`, two lines always reserved)
   *   the trend         474 – 620.5  (`TREND_GAP` → 24 clear of the sub)
   *   card bottom       645.5        (+24 bottom pad, +1 border)
   *
   * Measured on `SwapProbe`'s `stage`, not derived — the freed 23.9 is not given to anything, so
   * the card is simply shorter and every framing that unions it tightens with it.
   */
  stage: rect(376, 188, 448, 457.5),
  bloom: rect(552, 237, BLOOM_SIZE, BLOOM_SIZE),
  /** The `at_ease` head — the WIDEST of the three heads at 298.5. */
  statelineHead: rect(450.8, 357, 298.5, 36),
  /**
   * The `at_ease` sub. **Two lines, always reserved** (`min-height: 51`) — see § THE SUB IS
   * RESERVED below. The paragraph shrink-wraps to its content, so this is 287.6 wide.
   */
  statelineSub: rect(456.2, 399, 287.6, 51),
  /**
   * ── AND THE `tense` SUB, WHICH NOTHING HAD EVER MEASURED ──────────────────────────
   *
   * It is the only one of the three copies that wraps, and a wrapped paragraph **fills** its
   * `max-w-[42ch]` box (capped by the card's own content width) instead of shrink-wrapping.
   * This file used to record the `at_ease` width for all three, which meant **the `tense` sub
   * was cropped at rest in beats 8 and 9 and nobody had seen it** — every still anyone framed
   * was an `at_ease` one.
   *
   * At L15's `max-w-md` column the card's content width is 366, so it still wraps to exactly two
   * lines. That was checked rather than assumed: at three lines `SUB_MIN_HEIGHT` and every
   * framing derived from the block would be wrong by 25.5px.
   *
   * Both paragraphs are centred on x 600.
   */
  statelineSubTense: rect(417, 399, 366, 51),
  /**
   * The REAL viewfinder's UNSCALED size: `w-52 sm:w-56` `aspect-video`, 224 × 126.9. Only `w`/`h`
   * are load-bearing — the component is not laid out inside the scrolling card, so its position
   * is `VIEWFINDER` below, in the pinned right column.
   */
  viewfinder: rect(615, 253, 224, 126.9),
  /**
   * **The session trend, at its NATURAL width — the size it is drawn at before L16 scales it.**
   *
   * `w` is `TREND_NATURAL_W` and `h` is what the card measures there. Its height is very nearly
   * independent of its width (`session-trend-geometry.ts:53` fixes the plot's viewBox at
   * `H = 210`; the heading, subtitle, gutters and six-key legend account for the rest), which is
   * exactly why drawing it wide and scaling it down is what makes it fit — see `TREND`.
   *
   * **305.7, not 355.7 — the inner card is gone.** `<StageLayout/>` now strips the component's own
   * `rounded-2xl border bg-surface shadow-soft sm:p-6`, so a card inside a card is one card. The
   * 50px is that card's chrome exactly: 24 of top padding, 24 of bottom, and 2 of border. Measured
   * on `SwapProbe`'s `trend-natural`, with `data-emph` on the probe's wrapper so the harness
   * measures what the beats render.
   *
   * It also widened the plot: at `sm:p-6` the measured container was 720 inside a 768 card, and it
   * is 768 now — the SVG is the full content width of the stage card for the first time.
   */
  trendNatural: rect(0, 0, TREND_NATURAL_W, 305.7),
  welcome: rect(216, 1005.2, 768, 83.1),
  calibrationBanner: rect(216, 1112.3, 768, 87.5),
} as const;

/**
 * ── THE PAGE NO LONGER SCROLLS, AND THAT IS THE POINT OF L15 ────────────────────────
 *
 * `monitor` was 28 and `trend` was 580 — the page scrolled to its end so that beat 11 could
 * reach a trend card sitting 855px down. At L15's arrangement the whole monitoring act is
 * **481.4px of card beside 181.3px of pinned viewfinder, inside a 519px viewport**, so there is
 * nothing below the fold and nothing to scroll to. Beat 11's third landing WAS that scroll; it
 * is one settled frame now.
 *
 * Kept as an object, at 0, because the page is still a page: a beat that ever needs to move it
 * should move a named value rather than a magic number.
 */
export const SCROLL = { monitor: 0 } as const;

/**
 * ── THE SUB RESERVES TWO LINES, ALWAYS ──────────────────────────────────────────────
 *
 * `RAW.statelineSub` used to be measured at **25.5 tall — one line** — against the `at_ease`
 * copy, which is what the probe happened to render. Two of the three copies the film shows are
 * one line:
 *
 *   at_ease         "Steady and settled — nothing to do."                        1 line
 *   a_little_tense  "A bit of an edge lately. Maybe a slow breath."              1 line
 *   tense           "This has held a while. Serenify can check in when you're    2 lines
 *                    ready."
 *
 * So the block's height, the trend card's position and **every framing derived from either** would
 * change on the frame the copy changed. The sub carries `min-height: 51px` — two lines of its own
 * 25.5px leading — applied from the video side by a scoped stylesheet (`monitor.tsx` §
 * `<StageLayout/>`). One-line copies keep an empty second line under them, which is what a layout
 * that does not jump looks like. The block is **93px tall on every band.**
 */

/**
 * ══ THE EMPHASIS LEAVES THE STATELINE ═══════════════════════════════════════════════
 *
 * L12's in-place grow-and-settle fired on every stateline copy change, and the reason it existed
 * was legibility: at the old 884.8-wide composite the 17px sub landed at **8.11px on a phone**,
 * under the floor, and the raise carried it to 10.13. The device was doing real work there.
 *
 * **L15's composite is tighter and the head reads at 18.1px**, so the reading is legible at rest
 * and the device would be decorating a line that no longer needs it. Three costs stop being
 * worth paying with it: it was why the card needed a 70px gap under the stateline (page the
 * trend now uses), why every horizontal framing number had to clear a RAISED rect rather than a
 * resting one, and a movement the audience had to be taught to read.
 *
 * **The device itself is unchanged and is not retired** — beat 5a's privacy line still takes it,
 * at the same 1.25×, and `motion.tsx` still owns it. What is removed is its application to the
 * statelines. `EMPHASIS_FACTOR` stays here because that is the copy 5a reads.
 *
 * **One thing to watch, and it is recorded rather than assumed away.** The emphasis was also
 * directing the eye at the moment the reading changed — beat 8 steps "a little tense" → "tense"
 * inside a static wide hold, and the two copies differ by a few words. If that escalation ever
 * reads as easy to miss, the emphasis is the fix and it should come back **for that one
 * transition only**, not for all three firings.
 */
export const EMPHASIS_FACTOR = 1.25;

/** A raw rect shifted by a scroll offset. The sticky header never moves. */
export const scrolled = (r: Rect, s: number): Rect => rect(r.x, r.y - s, r.w, r.h);

/**
 * ── THE PINNED RIGHT COLUMN (L14/L15/L16), AND LIBERTY L1 INSIDE IT ─────────────────
 *
 * Three surfaces live at **x 856 – 1176** and none of them scrolls: the mail toast (beat 8), the
 * viewfinder (beats 7–11) and the confirmatory prompt (beat 9). 1176 is the DRAWN clock's own
 * right edge (`shell.tsx:99`), so the sheet's "the clock, the toast and the viewfinder share a
 * right edge, so beat 8 frames one vertical stack rather than three unrelated things" is
 * literally true of the render.
 *
 *   clock       58 –  88     (browser chrome; never moves)
 *   toast      101 – 205     (beat 8)
 *   viewfinder 237 – 418.3   (beats 7–11)
 *   prompt     450.3 – 740.3 (beat 9)
 *
 * ── THE COLUMN STOPS SWAPPING OCCUPANTS — L16 ───────────────────────────────────────
 *
 * The trend has left it for the stage card, so nothing in this column ever replaces anything
 * else. The viewfinder is the column: it is on screen for all five monitoring beats and it never
 * moves. The toast arrives above it in beat 8 and the prompt arrives below it in beat 9, each
 * into empty page, each leaving the viewfinder exactly where it was. That is the whole structural
 * simplification L16 buys, and it is why the prompt no longer lands on top of a graph.
 *
 * ── AND THE VIEWFINDER'S TOP IS THE ORB'S TOP ───────────────────────────────────────
 *
 * 237 is `[data-testid="bloom"]`'s own top edge (the card's 188 + its border + the 48px top
 * band), so the two columns begin on one line: the orb and the face, the composition's two
 * pictures, share a horizontal. It used to be 212, which was 25px above the orb and level with
 * nothing.
 *
 * **The alternative was the stage CARD's top edge, and it is not takeable — see § THE TOAST.**
 *
 * ── THE COLUMN'S GUTTER IS THE SAME NUMBER IN EVERY DIRECTION ───────────────────────
 *
 * `PINNED_GAP` is all of them: the reading column is `max-w-md` (448), which `mx-auto` centres at
 * **376 – 824**, so 856 is exactly 32 away; the toast ends 32 above the viewfinder; the prompt
 * begins 32 below it. That the column width the composition wanted happens to produce the gap
 * the spacing wanted is luck, and it is recorded as luck — 448 was chosen first, for the bloom.
 */
export const VF_SCALE = 320 / 224;
export const STACK_RIGHT = 1176;
export const STACK_LEFT = STACK_RIGHT - 320;
/** The orb's own top edge: `RAW.stage.y` + 1px border + `CARD_PT`. */
export const VIEWFINDER: Rect = rect(STACK_LEFT, RAW.bloom.y, 320, 126.9 * VF_SCALE);

/**
 * ── THE TREND, DRAWN WIDE AND SCALED DOWN — NOW INSIDE THE STAGE CARD ───────────────
 *
 * **The card's height barely depends on its width**, which is the fact that makes any of this
 * work: the plot's viewBox is fixed at `H = 210` (`session-trend-geometry.ts:53`) and the
 * heading, subtitle, gutters and legend are the other ~145, so the card measures 355.7 tall at
 * 512 AND at 768. Rendered directly at the 368 the stage card has room for, it would still be
 * ~350 tall and would not fit at any orb size at all.
 *
 * Drawn at **768** — `max-w-3xl`, the width the app's own monitoring column ships at — and scaled
 * to **368**, the stage card's own content width, the same card comes out **368 × 170.4**. The
 * plot loses no shape; it arrives smaller. Same class of liberty as L1 (the viewfinder scaled UP
 * so a face is readable) and L8 (Ren's avatar), in the other direction.
 *
 * **And the plot is finally the width of the card it is in.** `<SessionTrend/>` measures its own
 * container with `getBoundingClientRect` and the video's measurement patch was dividing out the
 * camera's zoom but not this wrapper's scale, so the component measured 300 where it should have
 * measured 720: the gutters collapsed to their minimums, `plotWidth` was 192 instead of 520, and
 * `capByLegibility` silently dropped a window. The series was never too short — fill-to-width was
 * working on a plot 2.7× too narrow. See `measure-patch.ts` § AND THE CAMERA WAS NOT THE ONLY
 * SCALE IN THE CHAIN.
 *
 * **What it costs, stated:** the card's 18px heading and its 12px axis labels fall under the
 * phone-legibility floor at this scale. What the shot has to deliver is the LINE — a tail that
 * climbed through beat 8 walking back down in meadow — and the plot is ~158 × 45px on a phone at
 * the composite framing, filled edge to edge for the first time. See `framing.ts` § PHONE.
 *
 * x is the stage card's own padding box (376 + 1 border + 40 `sm:px-10` ≈ 416), so the nested
 * card's left and right edges ARE the card's content edges. y is the stateline block's bottom
 * plus `TREND_GAP`; below it sits `CARD_PB`, the same 24.
 */
export const TREND: Rect = rect(
  416,
  RAW.statelineSub.y + RAW.statelineSub.h + TREND_GAP,
  TREND_RENDER_W,
  RAW.trendNatural.h * TREND_SCALE,
);

/**
 * 104 tall, not the greybox's 82: the boss's subject line wraps to two lines at 320 wide, and at
 * 82 the second line spilled out through the panel's rounded bottom edge. Measured from the
 * content — 12 pad + 15 meta + 19 sender + 2 × 17.5 subject + margins + 12 pad.
 *
 * ── IT IS DERIVED FROM THE VIEWFINDER NOW, NOT FROM THE PAGE'S TOP EDGE ─────────────
 *
 * `VIEWFINDER.y − PINNED_GAP − 104` = **101 – 205**: it keeps the column's own gutter from the
 * face below it rather than sitting "4px under the page's top edge", which was a number about a
 * page rather than about the stack it belongs to. It clears the drawn clock's bottom (88) by 13.
 *
 * ── AND THIS IS WHY THE VIEWFINDER CANNOT START AT THE STAGE CARD'S TOP ─────────────
 *
 * At the card's top edge (188) the viewfinder would leave 100px between the clock and itself and
 * the toast is 104 tall, so the toast would have to go BELOW the viewfinder — and beat 8's first
 * landing is `frameRect(CLOCK ∪ TOAST)`, whose whole job is that the audience reads *11:30* and
 * *moved the deadline to 12* in one frame. With the toast at ~401 that union is 447px tall and
 * 16:9 charges **880.5 world px** for it: the clock falls 32.1 → 13.4px on a phone and the
 * subject line **16.1 → 6.7px, under the floor**, in the shot the film's only piece of arithmetic
 * happens in. At the orb's top edge the union is 147 tall, the landing is 368 wide, and both
 * numbers are exactly what they were. The alignment that costs nothing is the one that was taken.
 */
export const TOAST: Rect = rect(STACK_LEFT, VIEWFINDER.y - PINNED_GAP - 104, 320, 104);

/**
 * The stateline block: head + sub, as one, at its WIDEST copy.
 *
 * Both paragraphs are centred on x 600 (`items-center` + `text-center`), and the widest thing the
 * block ever contains is the `tense` sub — not the `at_ease` head this used to be derived from.
 */
const STATELINE_CX = RAW.statelineSubTense.x + RAW.statelineSubTense.w / 2;
const STATELINE_W = Math.max(RAW.statelineHead.w, RAW.statelineSubTense.w);
export const STATELINE_BLOCK: Rect = rect(
  STATELINE_CX - STATELINE_W / 2,
  RAW.statelineHead.y,
  STATELINE_W,
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
 * overshoot — the rect the camera must actually hold.
 *
 * ── AND THE HORIZONTAL HALF OF THAT CONSTRUCTION WAS WRONG, WHICH IS WHY 5f SAT LEFT ──
 *
 * It used to build `x` from the BADGE — `SUCCESS_BADGE.x − RIPPLE_OVERSHOOT` = 499.2, with
 * `w = 448` — so the rect's centre was **723.2** while the component's is **600**. Beat 5f's
 * previous key is `shot(600, …)`, so the camera arrived on a rect centred 123px to the RIGHT of
 * the thing it was framing: the success state sat left of frame, and the move onto it read as a
 * pan the wrong way. That is the "sits left of frame, and the camera then pans further left"
 * complaint, and it was a bad rect rather than a bad shot.
 *
 * **The vertical half is right and the horizontal half never applied.** The ripple reaches
 * 499.2 → 700.8 horizontally, which is *inside* the component's own 376 → 824 — so the component
 * governs x and the badge must not appear in the x arithmetic at all. It only governs y because
 * the badge sits 24px below the component's top and the ripple overshoots by 52.8.
 */
export const RIPPLE_OVERSHOOT = 52.8;
export const SUCCESS: Rect = rect(376, 0, 448, 346.9);
export const SUCCESS_BADGE: Rect = rect(552, 24, 96, 96);
/** How far the ripple crosses the component's own TOP edge. The only axis it escapes on. */
export const RIPPLE_TOP_OVERSHOOT = RIPPLE_OVERSHOOT - 24;
export const SUCCESS_FRAMED: Rect = rect(
  SUCCESS.x,
  SUCCESS.y - RIPPLE_TOP_OVERSHOOT,
  SUCCESS.w,
  SUCCESS.h + RIPPLE_TOP_OVERSHOOT,
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
 *
 * ── EVERY y HERE WAS 64px HIGH, AND IT IS THE SECOND HALF OF THE CURSOR DEFECT ──────
 *
 * These were probed **without the sticky `<Header/>` mounted**, unlike `RAW.*` (whose own header
 * note says it was measured with it). The page is `VIEWPORT_Y` 92 + `HEADER_H` 64 + `MAIN_PT` 32
 * = **content top 188**, and the old `calibrationBanner.y` was 124 = 92 + 32 — the header's
 * exact height missing.
 *
 * The visible symptom was "the pointer draws above the control it's clicking" on **Set baseline**
 * and **Start check-in**, and it survived fixing the cursor sprite's own hotspot because it is a
 * different bug wearing the same face. What made it hard to see is that the **hover fired
 * correctly on the button anyway** — `hover.tsx` addresses the DOM by CSS *selector* and never
 * reads a coordinate, so it cannot corroborate one. A correct hover beside a missed click is
 * therefore not a contradiction; it is the signature of a bad rect.
 *
 * Every value below is +64 from what was here, and the set is internally consistent at the new
 * offset: banner 188 + 86 + `space-y-10` 40 = welcome 314, and welcome 188 + 83.1 + 40 =
 * todayCard 311.1, which is the same arithmetic the old numbers satisfied 64px too high.
 */
export const HOME = {
  calibrationBanner: rect(24, 188, 1152, 86),
  /** "Set baseline". Beat 3 ends on a click of it. */
  setBaseline: rect(948.8, 209, 114, 44),
  /** With the banner above it (beat 3). */
  welcomeWithBanner: rect(24, 314, 1152, 83.1),
  /** Without it (beat 6). */
  welcome: rect(24, 188, 1152, 83.1),

  /**
   * ── THE THREE CARDS, AS THE REAL EMPTY STATES ─────────────────────────────────────
   *
   * The skeleton stand-ins were 196 / 168 / 168 by invention. The real cards, in their
   * genuine no-data branches, measure **217.5 / 176.3 / 152.5** — so all three were wrong,
   * and the grid row is 176.3 rather than 168 because the two cards are deliberately not
   * height-yoked (`recent-chats-card.tsx:91` — neither carries `h-full`).
   *
   * Beat 6's card sits at 247.1: the welcome header ends at 207.1 and `space-y-10` adds 40.
   * Beat 3's sits 126 lower, at 373.1, which is the calibration banner plus its own gap —
   * the same 126 the sheet already quotes for what moves when `has_anchor` flips.
   */
  todayCard: rect(24, 311.1, 1152, 217.5),
  todayCardWithBanner: rect(24, 437.1, 1152, 217.5),
  /**
   * **"Start check-in", and beat 6 had been clicking a rectangle.** The CTA is 126.3 × 40 at
   * x 49, 152.5 down the card — so in beat 6's column it is at y 399.6. The beat used to draw
   * its own 152 × 44 button at (1000, 300) and click that, because the card underneath was a
   * stand-in with no button in it. Both the drawn button and the guessed position are gone.
   */
  startCheckIn: rect(49, 463.6, 126.3, 40),
} as const;

/**
 * ── BEAT 10'S COMPOSER, MEASURED — THE ONE CURSOR IN THE FILM THAT MISSED ───────────
 *
 * Every other click site in this film is the measured centre of a real control. Beat 10's two
 * were hand-typed: the caret at (460, 552) and **send at (872, 552)**. The send button is 44px
 * wide and starts at x 879, so the cursor was pressing **seven pixels outside the left edge of
 * the control it was pressing** — which is exactly the "it clicks near a button rather than on
 * it" complaint, and it is the only genuine instance of it in the cut.
 *
 * The panel is `mx-auto max-w-2xl` at a fixed `h-[460px]`, so it lands at x 264–936 and, under
 * the authed layout's header and `pt-8`, at y 188. `<ChatShell/>`'s composer sits 346.1 down
 * from the panel's top — a `border-t p-3` form of `min-h-[44px]`, above a `px-3 py-2` footer bar.
 *
 * The caret position was fine by luck (460, 552) is inside the textarea; it is measured now
 * anyway, because "inside by luck" is not a property that survives the next layout change.
 */
export const CHAT = {
  panel: rect(264, 188, 672, 460),
  composer: rect(277, 533.6, 646, 44.5),
  textarea: rect(277, 533.6, 592, 44.5),
  /** The send button. Beat 10 ends its typing on a click of this. */
  send: rect(879, 533.6, 44, 44),

  /**
   * ── AND THE BEAT FRAMED THINGS THIS BLOCK DID NOT CONTAIN ─────────────────────────
   *
   * Everything above describes the composer, because the composer is where the click was. Beat
   * 10's *shots* are unions of Ren's avatar with the message being read — and none of those rects
   * existed, which is why the beat was the only one in the film framing hand-typed `shot(cx, cy,
   * w)` values rather than `frameRect` over measured geometry. Framing you cannot derive is
   * framing nobody can check.
   */
  /** The conversation header — `<RenAvatar/>`, "Ren", "here to listen". On screen the whole beat. */
  header: rect(265, 189, 670, 68.7),
  /** Ren's avatar inside it (L8 enlarges the drawing, not this box). */
  renAvatar: rect(281, 205.8, 34, 34),
  /** The scrolling message log. */
  log: rect(265, 257.7, 670, 262.9),
  /** Turn 1 — Ren opens. `self-start`, bordered. */
  turn1: rect(281, 277.7, 349.5, 46.4),
  /**
   * Turn 2 — his, typed in the composer first. `self-end`, filled.
   *
   * **It is TWO lines now**, and that is a consequence of the copy rather than of the layout:
   * the message went 49 → 78 characters (2026-07-31, verbatim and fixed), so the bubble fills
   * its measure and wraps. 70.8 is the same two-line height turn 3 already had — one line is
   * 44.4 and the leading is 26.4 — and its right edge is unchanged at 919, so nothing derived
   * from `CHAT_OWNERSHIP_SPAN` moves.
   */
  turn2: rect(541.7, 338.1, 377.3, 70.8),
  /**
   * Turn 3 — Ren's suggestion. The beat's protected 60-frame hold lands here.
   *
   * **+26.4 with turn 2's second line.** This is also the slot the typing indicator draws in
   * while Ren composes it (`chat.tsx` § TypingIndicator), so a stale y here puts the dots on
   * top of the bubble above them rather than where the reply lands.
   */
  turn3: rect(281, 422.8, 472.1, 70.8),
  disclaimer: rect(277, 584.1, 646, 15.1),
  footerBar: rect(265, 611.3, 670, 35.8),
} as const;

/**
 * ── LIBERTY L8, FINALLY APPLIED — REN'S AVATAR IS DRAWN LARGER ──────────────────────
 *
 * L8 has been in the liberties table since the greybox and was **never actually built**. The
 * component pass replaced the drawn stand-in with the real `<ChatShell/>`, which mounts
 * `<RenAvatar/>` with no props at all (`chat-shell.tsx:447`) — so Ren rendered at the shipped
 * default of **34px, `state="idle"`, for all 210 frames**, in the one beat of the film where his
 * face is on screen long enough to be read. The liberty survived as a row in a table describing
 * something nobody could see.
 *
 * `apps/web` cannot take a video-only prop, so the shipped avatar is hidden and the video draws
 * its own — the same component, from the same file, at a size and a state the beat chooses. The
 * seam is `chat.tsx` § `<RenFace/>`, and it is the same one `calibrate.tsx` uses on the countdown
 * numeral: suppress the component's own copy, draw the frame-addressed one over it.
 *
 * ── 56 WAS THE CEILING, AND THE CEILING WAS THE WRONG PLACE TO SIT ─────────────────
 *
 * 56 was derived as the largest avatar that fits: it grows about the shipped box's own centre
 * (298, 222.8), so at 56 it occupies 270–326 × 194.8–250.8, inside the conversation header's own
 * 189–257.7 band with 6px top and bottom, and its right edge stops 1px short of where "Ren"
 * begins at 327. That is a bound, not a judgement — and **at the beat's face landing it is too
 * big**, which is what the `ren-face-plus-turn1.png` still showed. A companion's avatar reading
 * at 53.6px beside a 14.4px line of his own speech makes the face the subject and the sentence
 * the caption, and beat 10's subject is the exchange.
 *
 * **42 is provisional and is Mohamed's pick to make.** Three variants of the same landing are
 * rendered for him — **48 · 42 · 36** — which read at 46.0 / 40.2 / 34.5px on a phone at the
 * 440.5 framing. The framing itself barely moves across them: the landing's width is governed by
 * turn 1's own right edge at x 630.5, not by the avatar, so 48 gives 434.5 and 36 gives 432.5
 * against 42's 433.5. Varying the size does not re-frame the shot, which is why the variants are
 * comparable at all. See `Beat10Ren.tsx` § REN_TURN1.
 */
export const REN_AVATAR_SIZE = 42;
export const REN_AVATAR: Rect = rect(
  CHAT.renAvatar.x + CHAT.renAvatar.w / 2 - REN_AVATAR_SIZE / 2,
  CHAT.renAvatar.y + CHAT.renAvatar.h / 2 - REN_AVATAR_SIZE / 2,
  REN_AVATAR_SIZE,
  REN_AVATAR_SIZE,
);

/**
 * **The number that sets beat 10's scale, stated once so it stops being re-derived.** Ren's
 * avatar sits at x 281 and *his* bubble runs to x 919, so **any** landing holding both is ≥638
 * wide before margins. That is why turns 2 and 3 cannot reach the ~10px phone floor at this
 * world, and it is a property of the conversation's own layout rather than of the framing.
 */
export const CHAT_OWNERSHIP_SPAN = 919 - 281;

/**
 * ── BEAT 5a'S PRIVACY LINE, AND THE ROOM THE EMPHASIS HAS ───────────────────────────
 *
 * "Your video isn't stored — only the calm reading it produces." — `intro.tsx:52`, the single
 * most important sentence in the film for a privacy-first product, and until this pass it passed
 * as a small grey line. It takes the **in-place emphasis (L12)**, the same grow-and-settle device
 * the stateline uses, and unlike the stateline it gets the device at **full amplitude**.
 *
 * Both clearances measured, growing downward from the line's own top edge and outward from its
 * horizontal centre, at L12's 1.25×:
 *
 *   line               418.4 × 20 at (390.8, 370.6) inside the intro
 *   raised             523.0 × 25 — bottom at 395.6
 *   the CTA block      top at 422.6                 → **27px of clearance**
 *   the intro column   376 – 824                    → 37.5px past it, onto empty page
 *   the frame          89.3 – 1110.8 (BEAT5_INTRO)  → **249px of clearance each side**
 *
 * So nothing caps it: the stateline yielded to 1.25× because two measured clearances forced it,
 * and this one arrives at 1.25× because the room is simply there. The 37.5px of overhang past the
 * `max-w-md` boundary costs nothing — that boundary is invisible, with no border, no background
 * and nothing beside it to collide with.
 *
 * ~~**What the emphasis does NOT buy here is legibility.**~~ **IT BUYS BOTH NOW — the framing was
 * found.** At the old 1021.5-wide hold the line's 14px landed at **5.8px on a phone**, 7.2px
 * raised, and this comment recorded that as a limitation of the device. It was a limitation of
 * the *shot*. Beat 5a takes a **580**-wide landing held f32–76, where it reads at **10.19px
 * seated and 12.74px raised** — over the floor at rest and comfortably over it under the raise.
 *
 * Three numbers made it available. The line is `text-sm` (**14px** — several notes about it had
 * been reasoning from 17); the raise takes it to **523 wide**, so no frame under ~570 holds it
 * whole; and a **27px page lift** opens a 344px vertical window between the lede's last line and
 * the helper line's bottom, which 16:9 allows up to 611. 580 sits inside that with 7.1px of
 * gutter each side.
 *
 * **The lift is a fix rather than a device**: preview (288) + `mt-4` (16) + card (204.2) = 508.2
 * against 519px of visible page, so the column *fits* — `main`'s own `pt-8` just starts it 32px
 * too low, which was slicing the helper line at the viewport's bottom edge at rest.
 *
 * The emphasis itself is untouched — same 1.25×, same downward growth, same `text-muted` grey and
 * meadow shield. *Motion only, do not recolour* still holds; only the shot moved.
 */
export const INTRO_PRIVACY = {
  /** Relative to the intro component's own top-left. */
  line: rect(14.8, 370.6, 418.4, 20),
  /** Where the "Turn on camera" block starts — what caps the downward growth. */
  ctaBlockTop: 422.6,
} as const;

/**
 * Beat 4's gate, broken into the blocks the beat actually frames.
 *
 * 1169.9px of page in a 583px viewport — very nearly exactly two screens, which is why the beat
 * scrolls and why the scroll is honest rather than a device.
 *
 * ── EVERY y HERE WAS 64px HIGH TOO — THE THIRD INSTANCE OF THE SAME PROBE ERROR ─────
 *
 * Identical to `HOME` above and found the same way: the block was probed **without the sticky
 * `<Header/>` mounted**, so `section.y` read 124 = `VIEWPORT_Y` 92 + `MAIN_PT` 32 with the
 * header's exact 64px missing. The symptom was beat 4's landing arriving mid-layout — body copy
 * sliced at the top *and* bottom edges with no card border anywhere in frame, which looks like a
 * badly chosen shot and was a rect describing a page that does not exist.
 *
 * Three blocks in this file were wrong in exactly this way (`HOME`, `GATE`, and the beat-10 chat
 * rects), which is why the note at the top of the file now says to check the rect against a
 * render rather than to trust that it was measured. Every value below is +64.
 */
export const GATE = {
  section: rect(312, 188, 576, 1169.9),
  header: rect(316, 212, 568, 200.4),
  /** "What happens" — the first bordered card. */
  facts1: rect(316, 436.4, 568, 416.3),
  /** "What declining changes" — the second bordered card. */
  facts2: rect(316, 876.6, 568, 325.3),
  buttons: rect(316, 1225.9, 568, 108),
  /** "Allow camera and inference". The beat ends on it. */
  allow: rect(316, 1225.9, 568, 48),
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
   *
   * **THE KEY LINE IS `text-sm` — 14px, not 17.** `camera-consent-gate.tsx:149`. The "12.7px on
   * a phone" figure this file and the beat sheet both quoted was derived from a size the
   * component never uses, so the line was ~18% less legible than every note about it claimed.
   */
  keyLine: rect(341, 679.1, 518, 91),
  /** The bullet copy's real size. Every legibility figure for this beat derives from it. */
  keyLineFontPx: 14,
} as const;

/**
 * ── THE CONFIRMATORY PROMPT, BROUGHT INTO THE WORLD ─────────────────────────────────
 *
 * `<Notification/>` portals to `document.body` and is `fixed right-4 w-80 bottom-[…]`
 * (`notification.tsx:186`), so it resolves against the 1920×1080 OUTPUT frame and is outside the
 * camera's transform entirely. A wrapper around `<ConfirmatoryPrompt/>` cannot move it — the
 * portal escapes the wrapper — so beat 9's prompt used to sit bottom-right of the frame
 * regardless of where the camera was looking, and the camera could not push in on the one
 * surface the beat exists to show. That was the known framing complaint. **L14 closes it.**
 *
 * The mechanism is a scoped stylesheet on the portalled node (`monitor.tsx` § `<WorldPrompt/>`)
 * that neutralises `right`/`bottom` and re-states `left`/`top`/`transform` as the camera's own
 * per-frame projection of these WORLD coordinates. Radix keeps its portal, the component keeps
 * every one of its classes, and the prompt behaves as if it had been laid out in the world:
 * it moves and magnifies with the camera like everything else.
 *
 * **These are WORLD pixels**, and the panel is 320 × 290 measured (`w-80` + `p-6`, title, body
 * and the three 44px options). It is the last surface in the pinned right column and the one
 * element in the film deliberately allowed past the world's bottom edge: 450.3 + 290 = 740.3
 * against a 675-tall world, so its last 65px land on the camera backdrop — which is
 * `--color-bg`, the same colour as the page under it (`Camera.tsx:130`), so the seam does not
 * exist. Being portalled to the body it is drawn outside `Desktop`'s `overflow: hidden` for
 * free; that is the one thing the portal was always good for.
 *
 * **450.3 is derived, not placed.** The panel's top is the viewfinder's bottom plus
 * `PINNED_GAP`, which is also the gap between the reading column and this whole column, and the
 * gap the toast keeps above the viewfinder. One number in every direction.
 *
 * **It covers nothing — L16.** It used to land on top of the session trend, which shared its y in
 * the pinned column; the trend is inside the stage card now, so the prompt arrives into empty
 * page beneath a viewfinder that does not move. The right column stops swapping occupants.
 */
export const PROMPT = {
  panel: rect(STACK_LEFT, VIEWFINDER.y + VIEWFINDER.h + PINNED_GAP, 320, 290),
  /** "Yes, that's me" — the true-positive branch. Offsets measured off the panel's own box. */
  yes: rect(STACK_LEFT + 25, VIEWFINDER.y + VIEWFINDER.h + PINNED_GAP + 117, 270, 44),
  /**
   * "No, I'm okay" — the FALSE-ALARM branch, which the pitch cut shows and the launch cut did
   * not. See the pitch sheet §6.1.
   *
   * **This is arithmetic on `yes`, not a new measurement.** The three options are a
   * `flex flex-col gap-2` of `min-h-11` rows (`confirmatory-prompt.tsx:24,51`), so each row is
   * 44 tall and each gap is 8 — one row below `yes` is exactly +52 on y, with the same 25px
   * inset off the panel and the same 270 width. Nothing was probed for this and nothing needed
   * to be: the row pitch is in the component's own class list.
   */
  no: rect(STACK_LEFT + 25, VIEWFINDER.y + VIEWFINDER.h + PINNED_GAP + 169, 270, 44),
  /** The third option, for the union below. Same pitch again. */
  maybe: rect(STACK_LEFT + 25, VIEWFINDER.y + VIEWFINDER.h + PINNED_GAP + 221, 270, 44),
} as const;

/**
 * The three option rows as one rect — the pitch cut's beat 9 frames THIS rather than
 * `PROMPT.panel`, because by then the surface is known and the subject is the choice rather
 * than the question. See the pitch sheet §7 · beat 9.
 *
 * Derived from the three rows above, which are themselves derived from `yes`. No new
 * measurement is involved at any step.
 */
/**
 * ── AND ITS TOP EDGE IS PLACED, BECAUSE A CENTRED ONE CUT THE BODY LINE ─────────────
 *
 * The first version of this rect was the three option rows alone, centred. Rendered, its top
 * edge landed **29.5px above the first option** — which is inside the prompt's body copy, so the
 * shot opened on *"…little while. Is that how you're feeling?"* sliced through the middle of its
 * letterforms. The launch sheet's framing rule has no exception for that: full-bleed furniture
 * may run off the frame, and **a sliced line of text is always a failure.** "Partly out of frame
 * by design" is a description of the title and body being ABSENT, not of them being cut in half.
 *
 * So two changes, both of which the launch sheet already has grammar for:
 *
 *  · **the rect runs down to the panel's own bottom border**, so the shot lands on a whole
 *    element boundary below rather than on empty page;
 *  · **the top edge is PLACED rather than centred** — 14px above the first option, inside the
 *    `gap-2` the component itself puts there, so the frame's edge falls in air and crosses no
 *    glyph. `COMPOSITE` and `BEAT5_SUCCESS` both place their top edge on the app header's bottom
 *    for the same class of reason; a placed edge is established grammar here, not a special case.
 *
 * What survives from the intent: the title and the body are out of the shot, the subject is the
 * three answers, and the framing is visibly not `BEAT9_PROMPT`'s.
 */
const OPTIONS_TOP = PROMPT.yes.y - 14;

export const PROMPT_OPTIONS: Rect = rect(
  PROMPT.panel.x,
  OPTIONS_TOP,
  PROMPT.panel.w,
  PROMPT.panel.y + PROMPT.panel.h - OPTIONS_TOP,
);

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
