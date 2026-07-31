import { Easing, interpolate, useCurrentFrame } from "remotion";

import { CameraKey, frameRect, Rect, rect, Shot, shot, union } from "../greybox/Camera";
import {
  CLOCK,
  EMPHASIS_FACTOR,
  GATE,
  PHONE_PX,
  PROMPT,
  RAW,
  SCROLL,
  STATELINE_RAISED,
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
//
// The LEFT column scrolls; the right column does not. `VIEWFINDER`, `TOAST` and `PROMPT` are
// already world rects and never take `scrolled()` — that is the whole of L14's fix for the
// toast/viewfinder overlap, and framing them through a scroll offset would put it straight back.

const S = SCROLL.monitor;
const bloom = scrolled(RAW.bloom, S);
const head = scrolled(RAW.statelineHead, S);
const sub = scrolled(RAW.statelineSub, S);
const controls = scrolled(RAW.controls, S);
const vf = VIEWFINDER;
const trendAtMonitor = scrolled(RAW.trend, S);
/** The stateline at the top of its raise, widest copy — what the composite must contain. */
const raised = scrolled(STATELINE_RAISED, S);

/**
 * **The composite** — bloom + stateline + viewfinder, all three whole. Beat 7's landing, beat
 * 8's wide phase, beat 9's opening and beat 11's near phase are all this one shot, which is what
 * makes those four beats read as one continuous screen rather than four visits to it.
 *
 *   union   x 331.3 – 1176.0   (844.8)   ← the stateline RAISED, not at rest
 *           y 212.0 –  653.3   (441.3)
 *   frameRect(m=20) → w = max(844.8 + 40, (441.3 + 40) × 16/9) = 884.8
 *   frame   x 311.3 – 1196.0   y 183.8 – 681.5
 *
 * **Width governs here, so the real vertical clearance is 28.2px rather than the nominal 20.**
 * The frame overshoots the world's bottom edge by 6.5px — free, because the page background and
 * the camera backdrop are the same colour (`Camera.tsx:130`), so that edge is invisible.
 *
 * ── IT FRAMES THE RAISE, NOT THE REST, AND THAT IS THE FIX FOR TWO REAL CROPS ───────
 *
 * The union is `STATELINE_RAISED` — the block at L12's full 1.25×, at its widest copy — because
 * two separate things were being cropped and both were invisible in review for the same reason,
 * that every still anyone framed was an `at_ease` one:
 *
 *  · **Horizontally.** The `tense` sub is 430 wide (it is the only copy that wraps, so it fills
 *    its box instead of shrink-wrapping); `geometry.ts` had recorded the `at_ease` sub's 287.6.
 *    The old 760-wide composite began at x 436 and the `tense` sub begins at 385 — so **it was
 *    sliced by 51px at rest** in beats 8 and 9, before any emphasis at all.
 *  · **Vertically.** The raise hangs 23.25px below the resting block, so at the sheet's usual
 *    24px margin the frame's bottom and the raised block's bottom were three quarters of a pixel
 *    apart. That is not clearance, it is luck.
 *
 * Same class of arithmetic as beat 5f's ripple overshoot (`SUCCESS_FRAMED`): the bounding box
 * that matters is the one the DEVICE reaches, not the one the component occupies at rest.
 *
 * **The cost is stated rather than buried.** Framing the widest copy raised, with the sub's box
 * reserving two lines on every band, makes this shot 884.8 rather than the 760 it used to claim
 * — so the 17px sub lands at **8.11px** on a phone at rest and **10.13px raised**. The device is
 * what carries it over the floor, which is exactly what L12 is for, and it is now available on
 * every band including the one the film turns on. The previous pass's 9.4px was a number
 * measured against copy the shot did not actually have to hold.
 *
 * The stage card runs off the top, the bottom and the left of this frame. That is deliberate and
 * unchanged from every previous pass: at 673 tall the card cannot be held whole by any 16:9
 * frame ≤1200 world px (it would need 1196 with zero margin), and cropped on three sides it
 * reads as the ground the reading sits on rather than as a cropped object. What must never be
 * cropped — the bloom, the stateline, the viewfinder — is not.
 */
export const COMPOSITE: Shot = frameRect(union(union(bloom, raised), vf), 20);

/**
 * **Beat 8, phase 1** — the clock and the toast, where the toast is READ.
 *
 * The clock, the toast and the viewfinder share a right edge at **1176**, which is the drawn
 * clock's own (`shell.tsx:84`), so this frames one vertical stack rather than three unrelated
 * things — the sheet's relationship, and this time the rect agrees with the paint. It did not
 * before: `CLOCK` said 1063 while the clock was drawn to 1176, so this shot ended at 1133 and
 * the clock rendered **"11:30 A"**.
 *
 *   union   x 856.0 – 1176.0   (320.0)
 *           y  58.0 –  200.0   (142.0)
 *   frameRect(m=24) → w = max(368, 190 × 16/9) = 368.0
 *
 * The clock reads at 32.1px on a phone and the toast's subject at 16.1px — both up on the
 * previous pass's 25.7 / 12.8, because the stack is shorter now that the toast sits 96–200
 * instead of 187–291. That is what lets the audience do the arithmetic unaided: 11:30, "by 12",
 * and nobody says *thirty minutes*.
 */
export const BEAT8_CLOCK: Shot = frameRect(union(CLOCK, TOAST), 24);

/**
 * **Beat 8, phase 2** — the toast still up, and his face, where the FALL happens.
 *
 *   union   x 856.0 – 1176.0   (320.0)
 *           y  96.0 –  393.3   (297.3)
 *   frameRect(m=24) → w = max(368, 345.3 × 16/9) = 613.9
 *
 * ── WHY THE BEAT HAS THREE LANDINGS AND NOT THE SHEET'S TWO ─────────────────────────
 *
 * The sheet's beat 8 holds clock + toast + face in ONE tight shot and falls there. The clock is
 * browser chrome at y 58 and the viewfinder is at 212, so any shot holding both spans 335px of
 * height and 16:9 charges ~683px of width for it — at which the head falls at 74px on a phone,
 * under the ~80 the register accepted. So the beat's tight→wide move gains one position instead:
 * clock+toast (368) → toast+face (614) → wide. One continuous move, no cut — the sheet's own
 * remedy for this class of problem.
 *
 * L14 improves both numbers it cares about again: **the clock reads at 32.1px and the face falls
 * at 82.3px**, against 25.7 / 88.7 before. The face gives up 6px and the clock — the number the
 * whole beat turns on, and the one that was being sliced — gains 6.4.
 */
export const BEAT8_FACE: Shot = frameRect(union(TOAST, vf), 24);

/**
 * **Beat 8, phase 3** — the reading, whole, with his face beside it: where the stateline changes
 * twice under one raise.
 *
 * It is `COMPOSITE`, exactly, and that is a consequence of L14 rather than a shortcut. The toast
 * is not in the union because **the toast dismisses as the camera arrives here** — a macOS
 * banner auto-dismisses, the fall has already happened at the tight framing (which is what L2
 * protects), and keeping it would push this shot from 884.8 to 1035 world px and take the sub
 * from 8.11px on a phone to 6.93. The dismissal is a real slide-out on the component's own
 * curve, not a pop; see `toast.tsx` § dismissFrom.
 */
export const BEAT8_WIDE: Shot = COMPOSITE;

/**
 * **Beat 9's landing** — the confirmatory prompt, whole, and the camera can finally push in on
 * it. `PROMPT` is a world rect now (`geometry.ts`); until L14 the portalled `<Notification/>`
 * resolved against the 1920×1080 output frame and sat bottom-right of the picture no matter
 * where the camera looked.
 *
 *   rect    x 856.0 – 1176.0   (320.0)
 *           y 424.0 –  714.0   (290.0)
 *   frameRect(m=24) → w = max(368, 338 × 16/9) = 600.9
 *   frame   x 715.6 – 1316.4   y 400.0 – 738.0   (the viewfinder's bottom is 393.3 — clear)
 *
 * The three options are 15px copy, which lands at **10.5px** on a phone — over the floor, which
 * is the point of pushing in on it at all.
 */
export const BEAT9_PROMPT: Shot = frameRect(PROMPT.panel, 24);

/** Beat 11's near phase — the drift and the stateline's return, both framed. */
export const BEAT11_NEAR: Shot = COMPOSITE;

/**
 * **Beat 11's landing** — the session-trend card WHOLE, with his face beside it.
 *
 * This is what the pinned right column buys the film. Before L14 the viewfinder was laid out
 * inside the scrolling column, so scrolling to the trend took his face off the screen and the
 * closing frame held a graph and nothing else. The viewfinder does not scroll now, so the beat's
 * payoff — the tail walking back down — plays next to the person it happened to.
 *
 *   union   x 344.0 – 1176.0   (832.0)
 *           y 212.0 –  658.9   (446.9)
 *   frameRect(m=20) → w = max(832 + 40, 486.9 × 16/9) = 872.0
 *   frame   x 324.0 – 1196.0   y 190.2 – 680.7
 *
 * Width governs here, so the real vertical clearance is 21.8px rather than the nominal 20 — and
 * the FR-024 footnote, which is the last thing left of the stage card at this scroll, clears the
 * frame's top edge by 33.8px rather than being sliced by it. That is what `SCROLL.trend` = 580
 * is protecting; see its note.
 *
 * **The bloom still cannot come.** Bloom top to trend bottom is 985.9px against a 519px
 * viewport, so the beat plays the drift and the stateline's return at `BEAT11_NEAR` and then
 * pulls out AND scrolls in one continuous move — the sheet's causal order with the camera
 * following the story rather than waiting for it.
 */
export const BEAT11_WIDE: Shot = frameRect(
  union(scrolled(RAW.trend, SCROLL.trend), VIEWFINDER),
  20,
);

// ── Projecting the world into output pixels ─────────────────────────────────────────

/**
 * `<Camera>`'s own interpolation, re-declared so a beat can know where the camera is looking
 * **outside** the camera's subtree.
 *
 * It exists for exactly one thing: the confirmatory prompt is portalled to `document.body` by
 * Radix and never enters `<Camera>`'s children, so beat 9 has to apply the same transform to it
 * by hand (`monitor.tsx` § `<WorldPrompt/>`), and the drawn cursor has to sit in a sibling layer
 * above it (§ `<WorldOverlay/>`). Both need this frame's shot.
 *
 * **It must match `Camera` exactly** — same keys, same clamping, same `Easing.inOut(Easing.cubic)`.
 * A beat passes the SAME array to both, so the only way they can disagree is if `Camera`'s easing
 * is retuned and this is not; that would show up as the prompt lagging the picture during beat
 * 9's push-in, which is worth naming because it would look like a motion bug rather than a
 * duplication one.
 */
export const useShotAt = (keys: CameraKey[]): Shot => {
  const frame = useCurrentFrame();
  if (keys.length < 2) return keys[0].shot;
  const at = keys.map((k) => k.frame);
  const opts = {
    extrapolateLeft: "clamp" as const,
    extrapolateRight: "clamp" as const,
    easing: Easing.inOut(Easing.cubic),
  };
  return {
    cx: interpolate(frame, at, keys.map((k) => k.shot.cx), opts),
    cy: interpolate(frame, at, keys.map((k) => k.shot.cy), opts),
    w: interpolate(frame, at, keys.map((k) => k.shot.w), opts),
  };
};

/**
 * A world point in OUTPUT pixels, under `shot`.
 *
 * `Camera` composes as `translate ∘ scale` about origin 0 0, so screen = translate + zoom · world
 * and this is that identity written out once. `zoom` comes back with it because anything drawn
 * this way also has to be SCALED by it — a prompt or a cursor pinned at output size would shrink
 * as the camera pushed in, which is the one thing no real screen recording does.
 */
export const projectWorld = (
  shot: Shot,
  x: number,
  y: number,
): { left: number; top: number; zoom: number } => {
  const zoom = 1920 / shot.w;
  return { left: 960 - zoom * shot.cx + zoom * x, top: 540 - zoom * shot.cy + zoom * y, zoom };
};

// ── Calibration ─────────────────────────────────────────────────────────────────────

/** The calibration column sits under the header; beats offset it by this. */
export const CALIB_TOP = 188;
const calibAt = (r: Rect) => rect(r.x, r.y + CALIB_TOP, r.w, r.h);

/**
 * **Beat 5b — the green room, whole, at the beat's own 27px page lift.**
 *
 * `Beat05Calibration.tsx` lifts the recorder column 27px (`PAGE_LIFT`) because the preview + the
 * green-room card run 508.2px tall against a 519px viewport that starts 32px lower than it needs
 * to — without the lift the card's own bottom border is clipped at rest. This shot has to be
 * framed against that LIFTED position, not the resting one, or the two would disagree by 27px.
 *
 *   union (lifted)   x 344 – 856   y 161 – 669.2   (512 × 508.2)
 *   frameRect(m=5)   w = max(522, 518.2 × 16/9) = 921.2
 *
 * Height governs by a long way: 508.2px of surface in a 519px band costs 921px of width in 16:9
 * and there is no way to buy it back — the status line "You're all set — start when you're
 * ready." reads at 6.4px, present and framed but not a reading. What the shot exists to hold is
 * the card, whole, and his face, which is 190 world px of head inside the preview.
 */
export const BEAT5_GREENROOM: Shot = frameRect({ x: 344, y: 161, w: 512, h: 508.2 }, 5);

/**
 * **5c + 5d — the countdown and the orb, in one hold, pulled off the numeral.**
 *
 * Framing the 512 × 288 preview alone puts a 128px countdown box across 37% of the frame's
 * height and slices "Beginning now — settle in." at 492 → 512. This holds the preview plus
 * whatever sits under it (both at the beat's 27px lift), so the count happens inside a page:
 *
 *   frame   x 305 – 895   y 156 – 487.9      w = 590
 *   5c      preview 161 – 449 · "Beginning now — settle in." 465 – 485, whole, 2.9px clear
 *   5d      preview · the capture bar and its mm:ss row 457 – 473, whole
 *   reads   the pacer's `text-sm` label at 10.01px
 *
 * **590 is a ceiling, not a preference.** The breathing pacer's `text-sm` label needs w ≤ 590.8
 * to clear the 10px floor, and the frame's bottom edge has to land in [485, 489] to clear the
 * get-ready line while keeping `<RecordingStage/>`'s card (top 489) out of shot — those two
 * constraints meet within 3px of each other.
 */
export const BEAT5_PREVIEW: Shot = shot(600, 321.95, 590);

/**
 * **Beat 5f — the success state, centred, with the ripple's real overshoot in frame.**
 *
 * `frameRect(SUCCESS_FRAMED, 9)`, lifted by `CALIB_TOP`, gives 699.9 × 393.7 centred on x
 * **600** — the component's own centre, now that `SUCCESS_FRAMED`'s x is corrected in
 * `geometry.ts` (it used to be built from the badge, which put its centre at 723.2 and panned
 * the camera the wrong way). The frame is then placed with its top edge on the app header's
 * bottom (156) rather than centred on the rect, because centring it would hang 5.8px of the
 * header into the top of the payoff shot; the ripple keeps 3.2px above it and the component 14.8
 * below, and the ripple's opacity is 0 by the time it reaches its own top edge.
 *
 *   frame   x 250 – 950   y 156 – 549.7
 *   reads   "Your baseline is set" at 21.7px · the body and the button label at 9.65px
 *   click   "Back to home" at (600, 486.9), 63px inside the frame's bottom edge
 */
const successFramedCalib = calibAt(SUCCESS_FRAMED);
const successFrame = frameRect(successFramedCalib, 9);
export const BEAT5_SUCCESS: Shot = { ...successFrame, cy: 156 + (successFrame.w * 9) / 16 / 2 };

/**
 * **5a establish — the intro, whole, and briefly.**
 *
 * The lifted column runs 161 → 675.6 and the page shows 156 → 675, so a frame of exactly that
 * band holds the heading, the lede, the three icon rows, the privacy line, the button and its
 * helper line with nothing cut and no app header in shot. 920 rather than the derived 922.7 so
 * the frame's own edges sit inside the band.
 *
 *   frame   x 140 – 1060   y 156.75 – 674.25      the 36px h1 reads 16.5px on a phone
 *
 * The beat pushes IN from here onto its own `INTRO_READ` — the privacy-line landing has no
 * counterpart in this file because it did not exist before this pass; see
 * `Beat05Calibration.tsx`.
 */
export const BEAT5_INTRO: Shot = shot(600, 415.5, 920);

// ── Beat 4's gate ───────────────────────────────────────────────────────────────────

/**
 * **Beat 4's establishing shot** — the badge, the heading, the lede and the first card's own
 * heading, all whole, with the frame's bottom edge landing in the 12px gutter between that
 * heading and the card's first bullet — now that `GATE`'s y-values carry the sticky header's
 * 64px (it used to land 64px too high, mid-layout, with no card border anywhere in shot).
 *
 * The card is 568 wide, so 16:9 charges 346.5px of height for the 616 the header needs, and the
 * page has only 280.4px between the app header's bottom (156) and the first card's top (436.4).
 * The overhang is spent upward, on the app header — full-bleed furniture, 12.5px of a 64px bar.
 *
 *   frame   x 292 – 908   y 143.5 – 490      h2 at 30px reads 20.6px on a phone
 */
export const BEAT4_ESTABLISH: Shot = shot(600, 316.75, 616);

/**
 * **Beat 4's key-line landing** — the first card's body: all four bullets, its bottom border and
 * both side borders, at 659 world px. `frameRect` over the card from just under its heading to
 * its own bottom edge, shifted by the beat's fixed scroll position (`SCROLL_A` = 250, see
 * `Beat04CameraGate.tsx`):
 *
 *   rect     `GATE.facts1.x`, 239.9    `GATE.facts1.w` × 362.7
 *   frame    w = max(576, 370.7 × 16/9) = 659      h = 370.7
 *
 * Nothing is sliced at any edge, three of the card's four borders are in shot, and the bullet the
 * beat exists to deliver ("Nothing is kept…") is the third of four rather than a fragment between
 * two fragments.
 */
export const BEAT4_LINE: Shot = frameRect(rect(GATE.facts1.x, 239.9, GATE.facts1.w, 362.7), 4);

// ── The legibility table ────────────────────────────────────────────────────────────

/**
 * **Checked, not asserted.** ~10px is the floor at which a line is read rather than merely
 * recognised on a phone. Anything below it in this table is a defect, not a preference — and
 * the two entries that sit under it are the two the emphasis exists to lift.
 */
/** The head is ~66% of the viewfinder's height; L1's 320×181.3 puts that at 119.7 world px. */
const FACE_H = VIEWFINDER.h * 0.66;

export const PHONE = {
  composite: {
    framedWidth: COMPOSITE.w,
    statelineHead: PHONE_PX(36, COMPOSITE.w),
    statelineSub: PHONE_PX(17, COMPOSITE.w),
    /** **1.25× on every band now** — see `emphasisCapFor`. It used to be ~1.01 on `tense`. */
    statelineSubRaised: PHONE_PX(17 * EMPHASIS_FACTOR, COMPOSITE.w),
    faceHeight: PHONE_PX(FACE_H, COMPOSITE.w),
  },
  beat8Clock: {
    framedWidth: BEAT8_CLOCK.w,
    clock: PHONE_PX(28, BEAT8_CLOCK.w),
    toastSubject: PHONE_PX(14, BEAT8_CLOCK.w),
  },
  beat8Face: {
    framedWidth: BEAT8_FACE.w,
    faceHeight: PHONE_PX(FACE_H, BEAT8_FACE.w),
    toastSubject: PHONE_PX(14, BEAT8_FACE.w),
  },
  /** The three options are `text-[15px]` (`confirmatory-prompt.tsx:26`). */
  beat9Prompt: {
    framedWidth: BEAT9_PROMPT.w,
    option: PHONE_PX(15, BEAT9_PROMPT.w),
    title: PHONE_PX(18, BEAT9_PROMPT.w),
  },
  /** Beat 11's landing. The trend's own axis labels are 12px; his face is the other half. */
  beat11Wide: {
    framedWidth: BEAT11_WIDE.w,
    faceHeight: PHONE_PX(FACE_H, BEAT11_WIDE.w),
    trendHeading: PHONE_PX(18, BEAT11_WIDE.w),
  },
  beat5Success: {
    framedWidth: BEAT5_SUCCESS.w,
    /** `text-3xl sm:text-4xl` → 38px at this viewport. */
    heading: PHONE_PX(38, BEAT5_SUCCESS.w),
    body: PHONE_PX(17, BEAT5_SUCCESS.w),
  },
} as const;

export { controls, trendAtMonitor, vf as viewfinderFramed };
