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

export const RAW = {
  /**
   * The `Session · MM:SS` readout and the back link, as ONE row inside the stage card's own
   * `pt-16` band — not the row above the card the app draws. Nothing about the readout changes
   * except which box it sits in, and that move is what freed the page scroll: the row above the
   * card is what forced `SCROLL.monitor` into the old 39–41.5 window.
   */
  sessionReadout: rect(385, 209, 430, 44),
  /** 675.2, not 673.2: the card's own 1px border top and bottom, which is easy to lose. */
  stage: rect(344, 188, 512, 675.2),
  bloom: rect(456, 253, 288, 288),
  /** The `at_ease` head — the WIDEST of the three heads at 298.5. */
  statelineHead: rect(450.8, 565, 298.5, 36),
  /**
   * The `at_ease` sub. **Two lines, always reserved** (`min-height: 51`) — see § THE SUB IS
   * RESERVED below. The paragraph shrink-wraps to its content, so this is 287.6 wide.
   */
  statelineSub: rect(456.2, 607, 287.6, 51),
  /**
   * ── AND THE `tense` SUB, WHICH NOTHING HAD EVER MEASURED ──────────────────────────
   *
   * 430 wide — 142.4px wider than the `at_ease` one, because it is the only copy that wraps and
   * a wrapped paragraph fills its `max-w-[42ch]` box (capped here by the card's own 430px
   * content width) instead of shrink-wrapping. Every horizontal framing number in this file used
   * to be derived from the 287.6 above, which meant **the `tense` sub was cropped at rest in
   * beats 8 and 9 and nobody had seen it** — the same class of defect as the two-line clipping,
   * for the same reason: every still anyone framed was an `at_ease` one.
   *
   * Both paragraphs are centred on x 600, so this is the rect the emphasis grows from.
   */
  statelineSubTense: rect(385, 607, 430, 51),
  controls: rect(449.4, 728, 301.2, 44),
  footnote: rect(449.4, 804, 301.2, 18.2),
  /**
   * The REAL viewfinder's UNSCALED size: `w-52 sm:w-56` `aspect-video`, 224 × 126.9. Only `w`/`h`
   * are load-bearing now — the component is no longer laid out inside the scrolling card, so its
   * position is `VIEWFINDER` below, in the pinned right column.
   */
  viewfinder: rect(615, 253, 224, 126.9),
  /**
   * **POPULATED, not empty.** The empty card is ~101.5 tall — heading and one line — and the
   * populated one is not, because it also carries the subtitle, the plot and a six-key legend.
   * Beat 11's landing was first derived from the empty height and framed the plot straight off
   * the bottom edge; the card looked present and the line the beat exists to show was not in the
   * shot.
   *
   * **It is still 355.7 at the 512 column**, which was worth checking rather than assuming: the
   * plot keeps its declared 210 height and narrows to 462, and the six-key legend already fitted
   * on its rows at 768 with room, so nothing wrapped. Measured, not scaled.
   */
  trend: rect(344, 883.2, 512, 355.7),
  /** The plot itself, inside the card. 462 wide at this column, against 718 at `max-w-3xl`. */
  trendPlot: rect(369, 973.7, 462, 210),
  welcome: rect(216, 1005.2, 768, 83.1),
  calibrationBanner: rect(216, 1112.3, 768, 87.5),
} as const;

/**
 * ── THE SCROLL OFFSETS, AND WHY THESE TWO ───────────────────────────────────────────
 *
 * `monitor` = 28, and beats 7, 8 and 9 never leave it — the page is static for three whole
 * beats, which is what the pinned right column is for.
 *
 * **It is not zero, and the 28 is arithmetic rather than taste.** The app's authed `<main>` is
 * `px-4 pt-6 sm:px-6 sm:pt-8`, so at this world content begins at 92 + 64 + 32 = **188**, and
 * `MAIN_PT` is the shared shell every other authed beat is framed against (beats 3, 6 and 10) —
 * it cannot be shortened for one page. 28px of honest page scroll puts the card top at **160**,
 * 4px under the sticky header, and that is the whole of it:
 *
 *   stateline head top (raw)      565
 *   block height, 2 lines          93   (head 36 + `mt-1.5` 6 + reserved sub 51)
 *   viewport bottom (raw)     675 + s
 *   cap = (675 + s − 565) / 93 ≥ 1.25   ⟹   s ≥ 6.25
 *
 * so anything from ~7 up restores L12; 28 is chosen because it is exactly what removes the app's
 * `pt-8` from the shot, and because the two remaining constraints are satisfied with room:
 *
 *   Pause/End controls stay BELOW the fold   728 − 28 = 700 > 675            ✓ 25px clear
 *   the readout stays visible                it is INSIDE the card now       ✓ unconditionally
 *
 * That second line is the one that changed. The old window was (39, 41.5] — a 2.5px slot — and
 * the thing that pinned it was the `Session · MM:SS` row sitting ABOVE the card, under a sticky
 * header. Moving the readout into the card's own `pt-16` band is what removed the constraint,
 * and it is why 28 is now a choice with slack rather than an intersection with none.
 *
 * `trend` = 580, and it is **the page scrolled to its end** rather than a framing device: the
 * trend card is the last thing on the monitoring page (bottom at raw 1238.9), and 580 rests its
 * bottom edge 16px above the viewport's, which is where a scrolled-to-the-bottom page sits. Beat
 * 11 travels 28 → 580 in one continuous move, with the camera.
 *
 * It is also, checked rather than assumed, the offset at which beat 11's closing frame holds the
 * FR-024 footnote ("Processed just for you — analyzed, then deleted.") whole rather than slicing
 * it: at 580 the footnote's top lands 33.8px inside the frame's top edge. At the arithmetically
 * tidier "centre the card in the viewport" value of 645.6 it clears by **1.0px**, which is a
 * cropped line waiting to happen the next time anything about the card changes.
 *
 * **And the bloom still cannot come with it**, which is measured rather than judged: bloom top
 * to trend bottom is 985.9px against a 519px viewport. What L14 changes is that the *viewfinder*
 * can — it no longer scrolls, so beat 11's landing holds the trend card whole WITH his face,
 * which is the pairing the beat actually needs.
 */
export const SCROLL = { monitor: 28, trend: 580 } as const;

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
 * The sub is `max-w-[42ch]` (~393px at 17px Inter), and the `tense` copy is 62 characters, so it
 * wraps. So the block's height, the controls' position, the footnote's position and **every
 * framing derived from any of them** changed on the frame the copy changed — which is how the
 * two-line `tense` sub came to be sliced by the viewport bottom at rest, in the one reading the
 * film exists to deliver, invisibly, because every still anyone framed was an `at_ease` one.
 *
 * So the sub now carries `min-height: 51px` — two lines of its own 25.5px leading — applied from
 * the video side by a scoped stylesheet (`monitor.tsx` § `<StageLayout/>`). One-line copies keep
 * an empty second line under them, which is what a layout that does not jump looks like. The
 * block is **93px tall on every band**, and that is what makes `emphasisCapFor` a constant
 * rather than a per-copy negotiation.
 */

/**
 * ── AND THE EMPHASIS NOW HAS THE ROOM IT WAS ALWAYS SPECIFIED WITH ──────────────────
 *
 * L12's 1.25× was derived against a one-line block. At `max-w-3xl`, scroll 40, with the controls
 * 28px under the sub, the two-line `tense` block had 94px of room for 93px of block — a cap of
 * **1.01×**, i.e. the device was dead on the film's most important reading, and the arithmetic
 * was scroll-invariant so no scroll could rescue it.
 *
 * Three of L14's five moves are what fix it, and they are all arrangement:
 *
 *   the readout leaves the row above the card   → the scroll is free
 *   the sub reserves two lines                  → the block is 93 on every band
 *   the stateline→controls gap 28 → 70          → the raise has somewhere to go
 *
 * Measured at `SCROLL.monitor` = 28:
 *
 *   room  = (675 + 28) − 565         = 138
 *   block = 36 + 6 + 51              =  93   on EVERY band
 *   cap   = 138 / 93 = 1.484 → capped at L12's 1.25×
 *
 *   raised block   565 → 681.25  (raw)   = 537 → 653.25 on screen
 *   viewport bottom                       675      → **21.75px clear**
 *   Pause/End controls top   728 (raw)    = 700     → **46.75px clear**
 *   COMPOSITE's frame bottom              660       → **6.75px clear** (see `framing.ts`,
 *                                                     whose margin is 30 for exactly this)
 *
 * `emphasisCapFor` keeps its `lines` parameter and keeps returning `Math.min(…)` against the
 * real room, because the guard is what makes the device safe rather than a rule anyone has to
 * remember — it simply no longer bites. It returns 1.25 for one line AND for two.
 */
const STATELINE_LINE_H = 25.5;
const VIEWPORT_BOTTOM_RAW = 675 + SCROLL.monitor;

/**
 * The natural (unraised) height of the stateline block.
 *
 * `lines` is kept in the signature and deliberately ignored for the height: the sub's box is
 * `min-height: 51` on every band (see above), so the block is the same 93px whether the copy
 * wraps or not. A caller that passes 1 and a caller that passes 2 now get the same answer, which
 * is the point of the reserve.
 */
export const statelineBlockHeight = (lines: number): number =>
  Math.max(
    RAW.statelineSub.y + STATELINE_LINE_H * lines - RAW.statelineHead.y,
    RAW.statelineSub.y + RAW.statelineSub.h - RAW.statelineHead.y,
  );

/**
 * The largest factor the block can grow to without a line leaving the page's own viewport.
 * Never above L12's 1.25×, and never below 1 — a block that would already be clipped at rest is
 * a defect to fix at the layout, not something to shrink out of.
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
 * ── THE PINNED RIGHT COLUMN (L14), AND LIBERTY L1 INSIDE IT ─────────────────────────
 *
 * Three surfaces live at **x 856 – 1176** and none of them scrolls: the mail toast (beat 8), the
 * viewfinder (beats 7–11) and the confirmatory prompt (beat 9). 1176 is the DRAWN clock's own
 * right edge (`shell.tsx:84`), so the sheet's "the clock, the toast and the viewfinder share a
 * right edge, so beat 8 frames one vertical stack rather than three unrelated things" is
 * literally true again — the previous pass had moved the stack to 1063 and left the clock at
 * 1176, which is the crop this pass found on a render.
 *
 *   clock       58 –  88     (browser chrome; never moves)
 *   toast       96 – 200     (beat 8)
 *   viewfinder 212 – 393.3   (beats 7–11)
 *   prompt     424 – 714     (beat 9; its last 39px land on the camera backdrop, see PROMPT)
 *
 * **The 22px toast/viewfinder overlap is gone by construction**, not by tuning: the two were
 * only ever colliding because the viewfinder was laid out inside the scrolling column and the
 * gap had been computed against its UNSCROLLED position. Neither scrolls now, so the 12px
 * between them is a fact rather than a coincidence — and 12px is adjacency, which is the whole
 * of liberty L2: you watch his face fall *while the toast is up*.
 *
 * ── LIBERTY L1, UNCHANGED IN SIZE AND FREED IN DIRECTION ────────────────────────────
 *
 * The app draws the viewfinder at 224×126.9. L1 enlarges it to **320×181.3** so the face is
 * readable on a phone, and the register (item 6) kept L1 explicitly while asking for the size to
 * be re-checked against a measured figure. It is.
 *
 * What changes at L14 is that the growth direction stops being a compromise. It used to be
 * pinned to the card's right edge and grown top-LEFT so it would not cover the bloom's opaque
 * core; now the column is 512 wide and ends at 856, so the viewfinder starts where the card
 * stops and grows into page that was empty anyway. The bloom is untouchable by geometry rather
 * than by careful arrangement.
 */
export const VF_SCALE = 320 / 224;
export const STACK_RIGHT = 1176;
export const STACK_LEFT = STACK_RIGHT - 320;
export const VIEWFINDER: Rect = rect(STACK_LEFT, 212, 320, 126.9 * VF_SCALE);

/**
 * 104 tall, not the greybox's 82: the boss's subject line wraps to two lines at 320 wide, and at
 * 82 the second line spilled out through the panel's rounded bottom edge. Measured from the
 * content — 12 pad + 15 meta + 19 sender + 2 × 17.5 subject + margins + 12 pad.
 *
 * Top at 96 — 4px under the page's own top edge, which is where a macOS banner sits. Bottom at
 * 200, 12px clear of the viewfinder.
 */
export const TOAST: Rect = rect(STACK_LEFT, 96, 320, 104);

/**
 * ── THE EMPHASIS (L12), AND REGISTER ITEM 3 ─────────────────────────────────────────
 *
 * The greybox grew the stateline block **1.65×**. That factor was derived against a composite
 * framing of ~1096 world px, where the app's 17px sub lands at 6.5px on a phone and needs 1.6×
 * just to clear the ~10px legibility floor.
 *
 * At the real geometry the composite is **884.8 wide**, not 1096, so the sub lands at 8.11px and
 * the factor needed for legibility alone is 1.233× — which is a coincidence rather than a
 * derivation, and is not what sets the number.
 *
 * **The emphasis yields, which is exactly what register item 3 asks of it** — the layout does
 * not move to accommodate a video device. It goes to **1.25×**, chosen against measured
 * clearances rather than taste, at L14's arrangement and `SCROLL.monitor` = 28:
 *
 *   bloom bottom      513.0
 *   stateline top     537.0   ← the block grows DOWNWARD from here; its top never moves,
 *                               so the bloom is untouchable by construction
 *   block at 1.25×    537.0 – 653.25
 *   controls top      700.0   → **46.75px** of clearance
 *   viewport bottom   675.0   → **21.75px**
 *   frame bottom      681.5   → the block finishes inside the shot, by 28.2px
 *
 * At 1.65× the block would reach 690.5 — through the viewport's bottom edge. The device
 * survives as grammar (it still fires on every copy change, which is what makes it grammar);
 * only its amplitude yields, and legibility is better than it was because the shot is tighter.
 *
 * **This is the CEILING, and at L14 it is also the applied factor on every band.** The
 * arithmetic above was a one-line block's, and until L14 `emphasisCapFor()` re-derived it per
 * copy and returned ~1.01 for the two-line `tense` sub — the device dead where it mattered most.
 * The reserved sub and the 70px controls gap put the two-line block at 46.75px of clearance, so
 * the cap is 1.25 for one line and for two. See `emphasisCapFor`'s header.
 */
export const EMPHASIS_FACTOR = 1.25;

/**
 * ── THE TWO LAYOUT VALUES L14 CHANGES, AND WHERE THEY ARE APPLIED ───────────────────
 *
 * Both are applied from OUTSIDE `apps/web`, by the scoped stylesheet in `monitor.tsx`
 * (`<StageLayout/>`) — the same mechanism `motion.tsx` uses four times over to reach into a
 * component the video must not fork. Nothing in the product is edited; what changes is the
 * arrangement the film renders it in, which is the register's own line about what a video pass
 * may and may not do.
 *
 * They are declared here because every framing number above is derived from them.
 */
/** The sub's reserved height — two lines of its own 25.5px leading. */
export const SUB_MIN_HEIGHT = STATELINE_LINE_H * 2;
/** `op-surfaces.tsx:253` ships `mt-7` (28) on the controls row. L14 spends 70. */
export const STATELINE_CONTROLS_GAP = 70;

/**
 * The stateline block the emphasis raises: head + sub, as one, at its WIDEST copy.
 *
 * Both paragraphs are centred on x 600 (`items-center` + `text-center`), and the widest thing
 * the block ever contains is the `tense` sub at 430 — not the `at_ease` head at 298.5 this used
 * to be derived from.
 */
const STATELINE_CX = RAW.statelineSubTense.x + RAW.statelineSubTense.w / 2;
const STATELINE_W = Math.max(RAW.statelineHead.w, RAW.statelineSubTense.w);
export const STATELINE_BLOCK: Rect = rect(
  STATELINE_CX - STATELINE_W / 2,
  RAW.statelineHead.y,
  STATELINE_W,
  RAW.statelineSub.y + RAW.statelineSub.h - RAW.statelineHead.y,
);

/**
 * ── THE RECT THE DEVICE REACHES, WHICH IS NOT THE RECT THE BLOCK OCCUPIES ───────────
 *
 * `<Emphasis/>` scales both paragraphs about `top center`, so at full amplitude the block is
 * `EMPHASIS_FACTOR` times as wide and as tall, growing outward from its own centre line and
 * downward from its own top edge. **This is what the composite has to frame**, and framing the
 * resting block instead is why the raise used to run off the left edge of the shot:
 *
 *   at rest      385.0 – 815.0   ×  565 – 658
 *   raised 1.25× 331.3 – 868.8   ×  565 – 681.25
 *
 * Same class of arithmetic as `SUCCESS_FRAMED` and beat 5f's ripple: the bounding box that
 * matters is the one the DEVICE reaches, not the one the component occupies while it is still.
 */
export const STATELINE_RAISED: Rect = rect(
  STATELINE_CX - (STATELINE_W * EMPHASIS_FACTOR) / 2,
  STATELINE_BLOCK.y,
  STATELINE_W * EMPHASIS_FACTOR,
  STATELINE_BLOCK.h * EMPHASIS_FACTOR,
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
  /** Turn 2 — his, typed in the composer first. `self-end`, filled. */
  turn2: rect(541.7, 338.1, 377.3, 44.4),
  /** Turn 3 — Ren's suggestion. The beat's protected 60-frame hold lands here. */
  turn3: rect(281, 396.4, 472.1, 70.8),
  disclaimer: rect(277, 584.1, 646, 15.1),
  footerBar: rect(265, 611.3, 670, 35.8),
} as const;

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
 * element in the film deliberately allowed past the world's bottom edge: 424 + 290 = 714 against
 * a 675-tall world, so its last 39px land on the camera backdrop — which is `--color-bg`, the
 * same colour as the page under it (`Camera.tsx:130`), so the seam does not exist. Being
 * portalled to the body it is drawn outside `Desktop`'s `overflow: hidden` for free; that is the
 * one thing the portal was always good for.
 *
 * **424 is derived, not placed.** `BEAT9_PROMPT` is `frameRect(panel, 24)` and its height
 * governs, so the frame's top edge lands exactly 24px above the panel. The viewfinder's bottom
 * is at 393.3, so any y below 423.3 puts a sliver of the viewfinder in the top of beat 9's
 * landing — a component sliced at rest, which is always a failure. 424 clears it by 6.7px and is
 * the smallest value that does.
 */
export const PROMPT = {
  panel: rect(STACK_LEFT, 424, 320, 290),
  /** "Yes, that's me" — the true-positive branch. Offsets measured off the panel's own box. */
  yes: rect(STACK_LEFT + 25, 424 + 117, 270, 44),
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
