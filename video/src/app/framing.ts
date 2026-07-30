import { frameRect, Rect, rect, Shot, union } from "../greybox/Camera";
import {
  CALIB,
  CLOCK,
  CONSENT_GATE,
  EMPHASIS_FACTOR,
  PHONE_PX,
  RAW,
  SCROLL,
  SUCCESS_FRAMED,
  TOAST,
  VIEWFINDER,
  scrolled,
} from "./geometry";

/**
 * ══ THE SHOTS, DERIVED ══════════════════════════════════════════════════════════════
 *
 * **No framing number in this pass was scaled from the greybox's.** Every shot below is
 * `frameRect(...)` over rects measured off the real components (`geometry.ts`), and every one
 * carries the phone-legibility figure it produces. That is the whole discipline of this file:
 * three consecutive revisions of the beat sheet logged crop complaints, and all three traced to
 * framing fitted against greybox rectangles and then nudged.
 *
 * `frameRect` is the framing rule as arithmetic — the tightest shot containing a rect with
 * `margin` of clearance on every side, widening past the rect's own width where 16:9 demands
 * it. The one deliberate exception is full-bleed furniture (the header, the omnibox, the page
 * background), which may run off the left and right edges. What must never bleed is a content
 * element, and a sliced line of type is always a failure.
 */

// ── The monitoring surface, at its beat scroll ──────────────────────────────────────

const S = SCROLL.monitor;
const bloom = scrolled(RAW.bloom, S);
const head = scrolled(RAW.statelineHead, S);
const sub = scrolled(RAW.statelineSub, S);
const controls = scrolled(RAW.controls, S);
const vf = scrolled(VIEWFINDER, S);
const trendAtMonitor = scrolled(RAW.trend, S);

/**
 * **Beat 7 / 9's composite** — bloom + stateline + viewfinder, all three whole.
 *
 *   union   x 450.8 – 1063.0   (612.2)
 *           y 277.0 –  656.5   (379.5)
 *   frameRect(m=24) → w = max(612.2 + 48, (379.5 + 48) × 16/9) = 760.0
 *
 * Height governs, which is why the shot is 760 and not 660. The frame's bottom lands at 680.4,
 * 5px past the world's 675 edge — free, because the page background and the camera backdrop
 * are the same colour, so the world's bottom edge is literally invisible.
 */
export const COMPOSITE: Shot = frameRect(union(union(bloom, sub), vf), 24);

/**
 * **Beat 8, phase 1** — the clock and the toast, where the toast is READ.
 *
 * The clock, the toast and the viewfinder share a right edge at 1063 (`geometry.ts`), so this
 * frames one vertical stack rather than three unrelated things — the relationship the sheet
 * asks for, restored at the real geometry after the real viewfinder made the greybox's 1176
 * unreachable.
 *
 *   union   x 743.0 – 1063.0   (320.0)
 *           y  58.0 –  269.0   (211.0)
 *   frameRect(m=24) → w = max(368, 259 × 16/9) = 460.4
 *
 * The clock reads at 25.7px on a phone and the toast's subject at 12.8px. Both are far above
 * the ~10px floor, which is what lets the audience do the arithmetic unaided — 11:30, "by 12",
 * and nobody says *thirty minutes*.
 */
export const BEAT8_CLOCK: Shot = frameRect(union(CLOCK, TOAST), 24);

/**
 * **Beat 8, phase 2** — the toast still up, and his face, where the FALL happens.
 *
 *   union   x 743.0 – 1063.0   (320.0)
 *           y 187.0 –  457.0   (270.0)
 *   frameRect(m=24) → w = max(368, 318 × 16/9) = 565.3
 *
 * ── THE ONE FRAMING THAT HAD TO BE RESTRUCTURED, AND WHY ────────────────────────────
 *
 * The sheet's beat 8 holds clock + toast + face in ONE tight shot and falls there. At the real
 * geometry that shot is 794.7 wide, and his head lands at **63px** on a phone — against the
 * ~80px the register accepted and the ~100px the sheet quotes for the fall. The cause is pure
 * geometry: the clock is browser chrome at y 58 and the real viewfinder is a card overlay at
 * y 277, so any shot holding both spans 399px of height and 16:9 charges ~795px of width for it.
 * The greybox's viewfinder sat at y 200, and that 77px is the whole difference.
 *
 * So the beat's existing tight→wide move gains ONE more position instead: clock+toast (460) →
 * toast+face (565) → wide. Still one continuous move, still no cut — the sheet's own remedy for
 * this class of problem, applied once more. It is strictly better than the greybox on both
 * numbers it cares about: **the clock reads at 25.7px instead of ~19, and the face falls at
 * 88.7px instead of ~80.**
 */
export const BEAT8_FACE: Shot = frameRect(union(TOAST, vf), 24);

/**
 * **Beat 8, phase 3 / beat 9** — wide enough for the whole card, the viewfinder and the toast
 * still up, where the stateline changes twice under one raise.
 */
export const BEAT8_WIDE: Shot = frameRect(union(union(scrolled(RAW.stage, S), vf), TOAST), 20);

/** Beat 9's landing on the confirmatory prompt, which the real `Notification` portals. */
export const BEAT9_PROMPT: Shot = COMPOSITE;

/**
 * **Beat 11's pull-out**, and the one place the real page's height forced a restaging.
 *
 * Measured: bloom-top to trend-bottom is 664.2px; the viewport below the sticky header is 519px.
 * **The bloom and the trend cannot be on screen together at this world**, at any scroll and at
 * any framing — it is 145px short, and no camera move buys page height.
 *
 * The sheet wants all three of the bloom's drift, the stateline's return and the trend's descent
 * in one wide shot, in causal order. The order survives; the single static shot does not. The
 * beat plays the drift and the return while they are framed, then pulls out AND scrolls in one
 * continuous move to land on stateline + trend for the descent — which is the sheet's causal
 * order with the camera following the story rather than waiting for it. No cut, and the
 * closing linger is on the trend, which is the thing the beat exists to show.
 */
export const BEAT11_NEAR: Shot = COMPOSITE;

/**
 * The landing: the session-trend card, WHOLE, with margin. It is the only element in the beat's
 * closing frame, and that is the resolution of the height problem above rather than a
 * compromise — the trend's tail walking back down is what the beat exists to show, and the
 * returned stateline has already been read, at 18.6px on a phone, in the shot before the move.
 */
export const BEAT11_WIDE: Shot = frameRect(scrolled(RAW.trend, SCROLL.trend), 20);

// ── Calibration ─────────────────────────────────────────────────────────────────────

/** The calibration column sits under the header; beats offset it by this. */
export const CALIB_TOP = 188;
const calibAt = (r: Rect) => rect(r.x, r.y + CALIB_TOP, r.w, r.h);

/**
 * **Beat 5b — the green room, and register item 5.**
 *
 * The preview is a 512×288 `aspect-video` box with a 168.5×224.6 3:4 bracket guide floating
 * inside it. The sheet's framing note caps the preview at 240 wide so the preview and the status
 * line can be framed together; at the real 512 that cap is meaningless, and the composite is
 * governed by the real green-room card below the box.
 *
 * The change lets the centring nudge land harder, exactly as the register predicted: the bracket
 * target is only **33% of the box's width**, so being off-centre is a visible fact about where he
 * sits in a wide frame, rather than a subtle inset inside a 3:4 box his face already filled.
 */
export const BEAT5_GREENROOM: Shot = frameRect(
  union(calibAt(CALIB.preview), calibAt(CALIB.greenRoom)),
  24,
);

/** 5c/5d — the preview alone, for the countdown and the orb. */
export const BEAT5_PREVIEW: Shot = frameRect(calibAt(CALIB.preview), 28);

/**
 * **Beat 5f — the success state, and register item 4.**
 *
 * Framed against `SUCCESS_FRAMED`, which is the component's own 448×346.9 grown by the ripple's
 * real overshoot: the `size-24` badge scales to 2.1 (`success-state.tsx:34`), reaching 52.8px
 * past the badge on every side and crossing the component's own top edge by 28.8px.
 *
 * **That 28.8px is the whole of why this beat has read as punched-in across three revisions.**
 * Every previous framing measured the component and cropped the ripple, so the payoff played
 * with its own bloom clipped by the frame edge — which looks exactly like a shot that is too
 * tight, because it is one.
 */
export const BEAT5_SUCCESS: Shot = frameRect(calibAt(SUCCESS_FRAMED), 26);

/** 5a — the intro. Short rows; the sheet keeps this wide with no push-in. */
export const BEAT5_INTRO: Shot = frameRect(calibAt(CALIB.intro), 30);

// ── Beat 4's gate ───────────────────────────────────────────────────────────────────

/**
 * The gate is 576 × 1169.9 in a 583px viewport — very nearly exactly two screens, which is why
 * the beat scrolls and why the scroll is honest rather than a device. The landing holds the key
 * line's card and the button together, both complete, with the card above entirely out of frame.
 */
export const BEAT4_ESTABLISH: Shot = { cx: 600, cy: 92 + 583 / 2, w: 1200 };
export const BEAT4_LINE: Shot = frameRect(rect(CONSENT_GATE.x, 300, CONSENT_GATE.w, 300), 26);

// ── The legibility table ────────────────────────────────────────────────────────────

/**
 * **Checked, not asserted.** ~10px is the floor at which a line is read rather than merely
 * recognised on a phone. Anything below it in this table is a defect, not a preference — and
 * the two entries that sit under it are the two the emphasis exists to lift.
 */
export const PHONE = {
  composite: {
    framedWidth: COMPOSITE.w,
    statelineHead: PHONE_PX(36, COMPOSITE.w),
    statelineSub: PHONE_PX(17, COMPOSITE.w),
    statelineSubRaised: PHONE_PX(17 * EMPHASIS_FACTOR, COMPOSITE.w),
    /** The head is ~66% of the viewfinder's height; L1 puts that at 118.8 world px. */
    faceHeight: PHONE_PX(118.8, COMPOSITE.w),
  },
  beat8Clock: {
    framedWidth: BEAT8_CLOCK.w,
    clock: PHONE_PX(28, BEAT8_CLOCK.w),
    toastSubject: PHONE_PX(14, BEAT8_CLOCK.w),
  },
  beat8Face: {
    framedWidth: BEAT8_FACE.w,
    faceHeight: PHONE_PX(118.8, BEAT8_FACE.w),
    toastSubject: PHONE_PX(14, BEAT8_FACE.w),
  },
  beat5Success: {
    framedWidth: BEAT5_SUCCESS.w,
    /** `text-3xl sm:text-4xl` → 38px at this viewport. */
    heading: PHONE_PX(38, BEAT5_SUCCESS.w),
    body: PHONE_PX(17, BEAT5_SUCCESS.w),
  },
} as const;

export { controls, trendAtMonitor, vf as viewfinderFramed };
