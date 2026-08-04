import { useCurrentFrame } from "remotion";

import {
  CameraKey,
  EASE_ARRIVE,
  EASE_DEPART,
  frameRect,
  Rect,
  rect,
  Shot,
  shot,
  shotAt,
  union,
} from "../greybox/Camera";
import {
  CLOCK,
  PHONE_PX,
  PROMPT,
  RAW,
  SUCCESS_FRAMED,
  TOAST,
  TREND,
  TREND_SCALE,
  VIEWFINDER,
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

// ── The monitoring surface ──────────────────────────────────────────────────────────
//
// **Nothing here takes `scrolled()` any more.** At L15's arrangement the whole act fits inside
// the page's own 519px viewport (`geometry.ts` § SCROLL), so world coordinates and page
// coordinates are the same thing on this surface and the offset that used to thread through
// every rect is gone.

const vf = VIEWFINDER;

/**
 * ══ THE COMPOSITE — TWO COLUMNS, AND ALL FOUR THINGS ════════════════════════════════
 *
 * Beat 7's landing, beat 8's wide phase, beat 9's opening and *every* landing of beat 11 after
 * the music player are this one shot — which is what makes the four beats read as one continuous
 * screen rather than four visits to it, and what lets the film close on a settled picture instead
 * of a camera arriving.
 *
 * **L16 changes what is in it without changing what it holds.** The trend moved out of the pinned
 * column and into the stage card, under the stateline, so the union is two rects rather than
 * three — and the card grew to carry it:
 *
 *   union   x 376.0 – 1176.0   (800.0)   ← the stage card WHOLE, and the viewfinder
 *           y 188.0 –  645.5   (457.5)
 *   frameRect(m=20) → w = max(800 + 40, (457.5 + 40) × 16/9) = 884.4
 *   frame   x 333.8 – 1218.2   y 156.0 – 653.5
 *
 * **Height governs now**, where at L15 width did — so the card's height is what this shot's width
 * costs, and anything that shortens the card tightens the frame for free. The frame's top is still
 * placed rather than derived: centred on the union it would show a band of page above the card, but
 * pinning it to **156**, the app header's own bottom edge, makes the shot the page below the header
 * and nothing else.
 *
 * ── AND IT TIGHTENED 42.6px WHEN THE TREND STOPPED BEING A CARD ─────────────────────
 *
 * 927.0 → **884.4**. Nothing here was retuned: `<StageLayout/>` strips the trend's own
 * `rounded-2xl border bg-surface sm:p-6`, the stage card is 457.5 tall instead of 481.4
 * (`geometry.ts` § stage), and this shot is `frameRect` over it. The frame follows the geometry,
 * which is the whole reason every landing in this pass goes through `frameRect` rather than
 * through hand arithmetic.
 *
 * ── WHAT IT CONTAINS, AND WHY EACH ONE IS IN IT ─────────────────────────────────────
 *
 *   the stage card   376 – 824   × 188 – 645.5   the orb, the stateline, AND the trend
 *   the viewfinder   856 – 1176  × 237 – 418.3   his face (L1), its top on the orb's top
 *
 * The card is **whole** — all four edges inside the frame, with margin.
 *
 * **What the arrangement reads at**, against L15's 840 and L16's own 927:
 *
 *   the stateline head   36px → **17.18px** on a phone   (927: 16.39 · L15: 18.09)
 *   the stateline sub    17px → **8.11px**                (927: 7.74 · L15: 8.54)
 *   his face             119.7 → **57.1px**               (927: 54.5 · L15: 60.1)
 *   the trend's plot     **~166 × 47px** on a phone, and FILLED (was ~158 × 45 — and the plot
 *                        itself widened 720 → 768 when the inner card's padding went)
 *
 * The head — which is the reading — is at 17.2px against a ~10px floor. The sub is a secondary
 * line under it and still does not clear the floor, which was true at L15 and at 927 alike and is
 * stated rather than smoothed over.
 */
const compositeFrame = frameRect(union(RAW.stage, vf), 20);
export const COMPOSITE: Shot = {
  ...compositeFrame,
  // Top edge on the app header's bottom — see above. `frameRect` would centre it 3.6px higher.
  cy: 156 + (compositeFrame.w * 9) / 16 / 2,
};

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
 *           y  58.0 –  205.0   (147.0)
 *   frameRect(m=24) → w = max(368, 195 × 16/9) = 368.0
 *
 * The clock reads at 32.1px on a phone and the toast's subject at 16.1px. That is what lets the
 * audience do the arithmetic unaided: 11:30, "by 12", and nobody says *thirty minutes*.
 *
 * **L16 moved the toast (96–200 → 101–205) and this shot did not move**, because width still
 * governs at 368: the union grew 5px taller and 16:9 charges 346.7 for it, under the 368 the
 * stack's own width already costs. That was the constraint the viewfinder's new top edge was
 * chosen against — see `geometry.ts` § TOAST.
 */
export const BEAT8_CLOCK: Shot = frameRect(union(CLOCK, TOAST), 24);

/**
 * **Beat 8, phase 2** — the toast still up, and his face, where the FALL happens.
 *
 *   union   x 856.0 – 1176.0   (320.0)
 *           y 101.0 –  418.3   (317.3)
 *   frameRect(m=24) → w = max(368, 365.3 × 16/9) = 649.4
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
 * **The clock reads at 32.1px and the face falls at 77.8px.** L16 costs the face 4.5px — the
 * viewfinder's top moved down 25 to meet the orb's, so the toast-to-face union is 20px taller —
 * and it is the price of the alignment. The clock landing, which is the beat's whole payload, is
 * unchanged.
 */
export const BEAT8_FACE: Shot = frameRect(union(TOAST, vf), 24);

/**
 * **Beat 8, phase 3** — the reading, whole, with his face beside it: where the stateline changes
 * twice under one raise.
 *
 * It is `COMPOSITE`, exactly, and that is a consequence of L14 rather than a shortcut. The toast
 * is not in the union because **the toast dismisses as the camera arrives here** — a macOS
 * banner auto-dismisses, the fall has already happened at the tight framing (which is what L2
 * protects), and keeping it would push this shot wider and take the sub further under the floor.
 * The dismissal is a real slide-out on the component's own curve, not a pop; see `toast.tsx` §
 * dismissFrom.
 */
export const BEAT8_WIDE: Shot = COMPOSITE;

/**
 * **Beat 9's landing** — the confirmatory prompt, whole, and the camera can finally push in on
 * it. `PROMPT` is a world rect now (`geometry.ts`); until L14 the portalled `<Notification/>`
 * resolved against the 1920×1080 output frame and sat bottom-right of the picture no matter
 * where the camera looked.
 *
 *   rect    x 856.0 – 1176.0   (320.0)
 *           y 450.3 –  740.3   (290.0)
 *   frameRect(m=24) → w = max(368, 338 × 16/9) = 600.9
 *   frame   x 715.6 – 1316.4   y 426.3 – 764.3   (the viewfinder's bottom is 418.3 — clear by 8)
 *
 * **And it covers nothing now (L16).** The trend used to start at the prompt's own y in the
 * pinned column, so the prompt landed on top of a graph; the trend is in the stage card and the
 * prompt arrives into empty page.
 *
 * The three options are 15px copy, which lands at **10.5px** on a phone — over the floor, which
 * is the point of pushing in on it at all.
 */
export const BEAT9_PROMPT: Shot = frameRect(PROMPT.panel, 24);

/** Beat 11's near phase — the drift and the stateline's return, both framed. */
export const BEAT11_NEAR: Shot = COMPOSITE;

/**
 * **Beat 11's landing — and it is the same shot it has been holding since f98.**
 *
 * It used to be its own framing, reached by scrolling the page 580px and pulling the camera out
 * at the same time, because the trend card sat 855px down and the bloom and the trend could not
 * be on screen together at any framing. `BEAT11_NEAR` and `BEAT11_WIDE` were two different
 * pictures and the film's last idea arrived in the second of them.
 *
 * At L15 they are one. The trend is pinned beside his face, the page does not move, and the
 * beat's third landing is not a move at all — the descent plays inside a frame that has already
 * settled. That is the "single settled picture" the closing image is supposed to be, and the
 * cheapest way to get it turned out to be deleting a camera move rather than choreographing one.
 */
export const BEAT11_WIDE: Shot = COMPOSITE;

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
 * **It must match `Camera` exactly**, and it no longer merely promises to: it CALLS `Camera`'s
 * own `shotAt`. It used to re-declare the interpolation, with a comment warning that retuning one
 * and not the other would show up as the prompt lagging the picture during beat 9's push-in. That
 * warning came due the moment `CameraKey` grew a per-segment `ease` (see `Camera.tsx`) — a
 * re-declared `interpolate` takes one easing for the whole list and would have ignored it. There
 * is one implementation now and this is a hook around it.
 */
export const useShotAt = (keys: CameraKey[]): Shot => shotAt(useCurrentFrame(), keys);

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

/**
 * **5e — the uploading line, and the flip that used to be a cut.**
 *
 * 5c/5d/5e all played inside one static `BEAT5_PREVIEW` hold, so at f240 the capture stage —
 * preview, orb, pacer, progress bar, mm:ss — was **replaced in a single frame** under a camera
 * that was not moving. Every pixel of the shot changed at once with nothing carrying it, which is
 * a cut wearing a continuous camera's clothes, exactly like the beat 2 → 3 join this sheet has
 * already fixed once.
 *
 * The camera closes in across the swap instead. Not a transition effect — the same push-in
 * grammar the rest of the film uses, put on the boundary that needed it.
 *
 * ── AND IT WAS ARRIVING BEFORE THE THING IT MOVED FOR ───────────────────────────────
 *
 * The move ran **f244 → f272** and the flip is at **f270** — 26 frames into a 28-frame travel,
 * which under `Easing.inOut(Easing.cubic)` is ~99.5% of the distance. So what played was an
 * abrupt push while the breathing minute was still running, a moment of stillness, and then the
 * surface changing under a camera that had already stopped: the cut wearing a continuous
 * camera's clothes, reintroduced at the other end of the move. Both this file and
 * `Beat05Calibration.tsx` carried comments ("20 frames into a move", "26 frames into a move")
 * and neither was what the numbers did.
 *
 * It runs **f264 → f292** now, so the flip lands **6 frames in — 21% of the travel** — where the
 * camera is still visibly moving and the change of surface reads as the thing the move was for.
 * It also gives 5d its last two-thirds of a second back to a static camera.
 *
 * **The cost is paid by the film, not by 5d.** The uploading line's settled hold is 26 frames
 * and it is doing work — it is the only moment the line is on screen under a stopped camera — so
 * the pull-out to `BEAT5_SUCCESS` moves f298 → f318 and everything after it shifts by the same
 * 20. Beat 5 goes 402 → 422 frames. 5d keeps every frame it had.
 *
 *   frame   x 340 – 860   y 175.6 – 468.4      w = 520
 *   reads   the line's 16px at **12.98px** on a phone, up from 11.4
 *
 * `cy` is `BEAT5_PREVIEW`'s, unchanged — the shot tightens on the same axis rather than panning,
 * and `UPLOADING_DROP` (`calibrate.tsx`) is what puts the line on it.
 */
export const BEAT5_UPLOADING: Shot = shot(600, 321.95, 520);

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
 * ── THE SEAM INTO BEAT 4, SO THE SURFACE CHANGES UNDER A MOVING CAMERA ──────────────
 *
 * "Set baseline" → "Before the camera turns on" used to be a straight cut: beat 3 held the full
 * 1200 frame from f100 to its last frame, beat 4 opened on a 616 landing, and the page changed on
 * the same frame the framing did. Two discontinuities on one boundary read as an edit, which is
 * the one thing this film's own invariant forbids — *moving between two screens is a MOVE, not a
 * cut.*
 *
 * So the push-in **starts in beat 3**, at f108, and beat 4 opens on this same shot and finishes
 * it. The navigation lands mid-move, where a change of surface reads as the thing the move was
 * for. It is the same seam beat 2 already uses into beat 3 (`BEAT2_SEAM`), applied to the other
 * boundary that was cutting.
 *
 * ── AND IT WAS STILL READING AS TWO MOVES, BECAUSE THE CAMERA STOPPED ON THE SEAM ───
 *
 * Halving the travel is not the same as making it continuous. Both segments took `Camera`'s
 * default `Easing.inOut(cubic)`, which eases **out** at the end of beat 3 and **in** at the start
 * of beat 4 — so the camera decelerated to a dead stop on the boundary frame and started again.
 * Two segments that each begin and end at rest are two moves however tightly they abut, which is
 * exactly the note: *"the timing reads as two separate moves rather than one."*
 *
 * A single gesture is one acceleration and one deceleration, handed over **at speed**. Beat 3
 * departs on `EASE_DEPART` (`Easing.in(cubic)`, no settle) and beat 4 arrives on `EASE_ARRIVE`
 * (`Easing.out(cubic)`, no start), and this shot is placed where their velocities match rather
 * than at the midpoint of the distance:
 *
 *   beat 3 carries fraction `p` over 12 frames, so it hands over at 3p/12 per frame
 *   beat 4 carries `1 − p` over 14 frames, so it takes over at 3(1 − p)/14
 *   equal  ⇒  14p = 12(1 − p)  ⇒  **p = 6/13 = 0.4615**
 *
 * — and the shot is that fraction along the travel from the full 1200 frame to `BEAT4_ESTABLISH`,
 * on every axis:
 *
 *   cy   337.5 → 316.75   at 6/13  =  327.923
 *   w   1200   → 616      at 6/13  =  930.462
 *
 * It lands close to the old hand-picked 900/327 — the point was never that the midpoint was badly
 * placed, it was that both halves came to rest on it. **The surface change is now the fastest
 * frame of the move rather than its only stationary one**, which is what the seam wanted in the
 * first place.
 */
const SEAM_T = 6 / 13;
const seamAlong = (from: number, to: number) => from + (to - from) * SEAM_T;
export const BEAT4_SEAM: Shot = shot(
  600,
  seamAlong(337.5, BEAT4_ESTABLISH.cy),
  seamAlong(1200, BEAT4_ESTABLISH.w),
);

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
    /**
     * **7.74px, and it no longer has a raise to lift it.** The stateline emphasis is off (see
     * `geometry.ts`), so this is what the sub reads at, full stop. It is the secondary line under
     * a head at 16.4px and it is stated rather than smoothed over — the same treatment beat 4's
     * bullets get.
     */
    statelineSub: PHONE_PX(17, COMPOSITE.w),
    faceHeight: PHONE_PX(FACE_H, COMPOSITE.w),
    /**
     * **The trend's type is under the floor at `TREND_SCALE`, and that is the trade L15/L16
     * make.** What the shot has to deliver is the LINE, not the labels: the plot is ~158 × 45px
     * on a phone here — and it is the FULL width of the card for the first time, because the
     * measurement patch now divides this wrapper's scale out as well as the camera's.
     */
    trendHeading: PHONE_PX(18 * TREND_SCALE, COMPOSITE.w),
    trendPlotW: (TREND.w * 0.94 * 422) / COMPOSITE.w,
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
  /** Beat 11's landing IS the composite now — kept as a name so the beat still reads. */
  beat11Wide: {
    framedWidth: BEAT11_WIDE.w,
    faceHeight: PHONE_PX(FACE_H, BEAT11_WIDE.w),
    trendHeading: PHONE_PX(18 * TREND_SCALE, BEAT11_WIDE.w),
  },
  beat5Success: {
    framedWidth: BEAT5_SUCCESS.w,
    /** `text-3xl sm:text-4xl` → 38px at this viewport. */
    heading: PHONE_PX(38, BEAT5_SUCCESS.w),
    body: PHONE_PX(17, BEAT5_SUCCESS.w),
  },
} as const;

export { vf as viewfinderFramed };
