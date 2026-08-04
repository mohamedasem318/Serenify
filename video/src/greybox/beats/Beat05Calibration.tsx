import React from "react";
import { AbsoluteFill } from "remotion";
import { useCurrentFrame } from "../../retime";

import { CalibratePage, type CalibPhase } from "../../app/calibrate";
import {
  BEAT5_GREENROOM,
  BEAT5_INTRO,
  BEAT5_SUCCESS,
  BEAT5_PREVIEW,
  BEAT5_UPLOADING,
  CALIB_TOP,
} from "../../app/framing";
import { CALIB, CONTROL, PHONE_PX, SUCCESS } from "../../app/geometry";
import { Hover } from "../../app/hover";
import { COUNTDOWN_FRAMES, useCaptureMinute, useEmphasis } from "../../app/motion";
import { Pointer } from "../../app/pointer";
import { usePitch } from "../../pitch-context";
import { Camera, shot } from "../Camera";
import { useExpression } from "../rig";
import { H, W } from "../theme";

/**
 * Beat 5 · Calibration · 422 frames
 *
 * **ONE TAKE.** The chain is: intro → green room → countdown → recording → the uploading line
 * REPLACES the capture stage → the success state → he clicks it → the dashboard. Every step is
 * a real component and the click is a real action.
 *
 * ══ PASS B · WHAT THE FRAMING PASS FOUND, MEASURED ══════════════════════════════════
 *
 * Every rect below was re-measured off this beat's own render (`getBoundingClientRect` against
 * the world origin) rather than taken on trust. Three of the four named problems turned out to
 * be **the page, not the camera**:
 *
 *  1. **The green-room card does not fit.** Preview 188 → 476, card 492 → **696.2**, against a
 *     viewport that ends at **675**. Its bottom border and 21px of its padding are clipped by the
 *     page itself, at rest, at scroll 0 — so no camera move could ever have held it whole.
 *  2. **5a's helper line is sliced by the same edge.** "Your browser will ask for permission
 *     next." sits at 666.6 → 686.6; the viewport cuts it at 675, through the glyphs. It was
 *     inside the OLD, pre-fix `BEAT5_INTRO`'s frame the whole time — `BEAT5_INTRO` (`framing.ts`)
 *     now carries the lifted, corrected frame instead.
 *  3. **5c's landing sliced the get-ready line.** The OLD `BEAT5_PREVIEW` framed 160 → 504 and
 *     "Beginning now — settle in." runs 492 → 512. `BEAT5_PREVIEW` now holds the page under the
 *     preview instead of the preview alone.
 *  4. `SUCCESS_FRAMED` had a **wrong x** — fixed in `geometry.ts`; `BEAT5_SUCCESS` (`framing.ts`)
 *     frames the corrected rect directly now.
 *
 * ── THE PAGE IS LIFTED 27px, WHICH IS A SCROLL AND IS HONEST ────────────────────────
 *
 * Preview (288) + `mt-4` (16) + green-room card (204.2) = **508.2**, against the 519px of page
 * visible below the app header. **It fits — by 10.8px** — and the only reason it does not is that
 * `main`'s `pt-8` starts the column at 188 rather than at 156. So the page is scrolled, exactly
 * as beat 4's gate is scrolled and for exactly the same reason: the content is taller than the
 * viewport and a real user would have scrolled it.
 *
 *   s ≥ 21.2   the green-room card's bottom border clears the fold (696.2 − s ≤ 675)
 *   s ≤ 32     the preview's top clears the app header (188 − s ≥ 156)
 *
 * The window is [21.2, 32] and 27 sits in the middle of it. It also lifts 5a's helper line whole
 * (666.6 → 639.6) and 5c's get-ready line clear of the landing below. It drops to 0 the moment
 * the capture stage is replaced, because the uploading line and the success state are shorter
 * than the viewport and a browser clamps a scroll it no longer has room for — the content swap
 * at that frame is total, so the reset is invisible.
 *
 * `<CalibratePage/>` takes no `scroll` prop and is not this pass's file, so the lift is applied
 * as one declaration against the recorder column's own `<section>`. **It should be promoted to a
 * `scroll` prop on `calibrate.tsx`**, the way `consent.tsx` already has one; the `<style>` seam
 * is the same one `Countdown` and `ComposerCaret` already use to reach into a shipped surface.
 *
 * ══ REGISTER ITEM 5 — THE PREVIEW IS 16:9 ═══════════════════════════════════════════
 *
 * The real component is a full-width **`aspect-video`** box — **512 × 288** in the `max-w-lg`
 * column — with a **3:4 bracket guide floating inside it** at 168.5 × 224.6
 * (`framing-overlay.tsx:82`). The bracket *target* was always genuinely 3:4; the *box* never was.
 * The target occupies only **33% of the box's width**, so where he sits in frame is a visible
 * fact about the shot rather than an inset inside a portrait box his face already filled.
 */

/**
 * ── THE PAGE LIFT ───────────────────────────────────────────────────────────────────
 *
 * See the header. `section.space-y-6` is the recorder column's own root (`calibrate.tsx:246`) and
 * is the only `<section>` in this beat's tree — the app header is a `<header>` and every
 * component under it is a `<div>`.
 */
const PAGE_LIFT = 27;

/**
 * ── THE SUCCESS RECT'S x WAS WRONG IN `geometry.ts`, AND THAT WAS THE WHOLE OF 5f ───
 *
 * `SUCCESS_FRAMED` used to be built as `x = SUCCESS_BADGE.x − RIPPLE_OVERSHOOT` = 552 − 52.8 =
 * **499.2**, with `w = max(SUCCESS.w, …) = 448`. So the rect ran 499.2 → 947.2 and its centre was
 * at **723.2**, while the component it is supposed to describe is centred at **600** — `frameRect`
 * put the camera 123.2px to the right of the surface, which was precisely the reported symptom:
 * *the success state sits left of frame, and the camera pans further left instead of centring it*.
 *
 * `geometry.ts` now derives `SUCCESS_FRAMED` from the component's own bounds — the ripple governs
 * the y axis only, where it actually crosses the component's top edge — and `BEAT5_SUCCESS`
 * (`framing.ts`) is the corrected frame. See it there rather than a local copy here.
 */
// ── The five landings ───────────────────────────────────────────────────────────────

/**
 * **5a's read, and the answer to the sheet's open item.**
 *
 * "Your video isn't stored — only the calm reading it produces." is `text-sm` — **14px** — at
 * (390.8, 558.6) 418.4 wide, and L12 raises it to 523 × 25. The sheet records it landing at
 * **5.8px on a phone** at `BEAT5_INTRO`'s 1021.5 and asks Pass B to find a framing that makes it
 * readable. This is it, and the arithmetic that fixes its width is what makes it possible:
 *
 *   the raised line is 523 wide     → the frame can never be narrower than ~570
 *   the lifted page gives a clean vertical window between the lede's last line (ends 315.6)
 *     and the helper line's own bottom (659.6) — **344px**, so 16:9 allows up to 611
 *   the button is 432 wide and its click is at f66, so it has to be in the same shot
 *
 *   frame   x 305 – 895   y 335.5 – 667.4      w = 590
 *   holds   all three icon rows, the privacy line seated AND raised (33.5px of clearance each
 *           side of the raised 523), "Turn on camera" whole, and its helper line whole
 *   reads   **10.01px seated · 12.51px raised** — over the floor, from 5.8px
 *
 * ── AND THE FIRST GUIDELINE ROW HAD 7px OF HEADROOM, WHICH READS AS A CROP ──────────
 *
 * The window this shot has to land inside is bounded by two things nobody had measured: the
 * lede's last line ends at **315.6** and the helper line's bottom is at **659.5**, so anything
 * outside [315.6, 659.5] slices a line of type. The first guideline's icon tile — the 40px
 * `bg-meadow/10` square beside "A quiet moment to yourself" — starts at **347.5**.
 *
 * At the old 580 the frame ran 340.5 → 666.7: nothing was actually sliced, and the tile had
 * **7px** of headroom, which at this beat's 3.3× magnification is 23 output pixels. A content
 * element sitting 23px off the frame edge reads as cropped whether or not it is, which is the
 * complaint, and "it measures fine" is not an answer to it.
 *
 * The arithmetic is a fixed budget rather than a free choice: with the helper line in shot,
 * `headroom + helperClearance = h − 312`. At 580 that is 14.25 and the split was 7/7.2. At **590**
 * it is 19.9, split **12 / 7.9**, with 19.9 above the lede as well — every clearance grows and
 * the seated line stays over the 10px floor at 10.01. Buying more headroom means a wider frame,
 * and at 611 the seated line drops to 9.66; 590 is where both constraints are met.
 *
 * The emphasis itself is untouched: same 1.25×, same grow-downward-from-its-own-top-edge, same
 * `text-muted` grey and meadow shield. Only its WINDOW moved, so that it fires while the camera
 * is landed rather than while it is still travelling — the sheet's own rule that the two
 * movements in 5a must never compete for the eye.
 */
const INTRO_READ = shot(600, 501.45, 590);

/**
 * 5b (green room), 5c/5d (the countdown and the orb) and 5f (the success state) are
 * `BEAT5_GREENROOM`, `BEAT5_PREVIEW` and `BEAT5_SUCCESS` in `framing.ts` — see them there for the
 * derivations. Framed once, not duplicated per beat.
 */

/**
 * ── THE COUNTDOWN GETS REAL TIME, AND 5d PAYS FOR IT ────────────────────────────────
 *
 * **5c was not counting.** `<GetReadyCountdown/>` decrements through a `setTimeout` that no
 * frame-addressed render ever fires, so across its thirty frames it held **"3"** and then the
 * beat cut to the recording. What read as "abrupt" was a static numeral followed by a jump — not
 * a fast count, no count.
 *
 * It counts now (`useCountdown`), and it is given **45 frames — 15 a number, half a second each**.
 * Half a second is a 2× compression of a real countdown against the 3× the beat was nominally
 * claiming, and it is the point at which a digit reads as having landed.
 *
 * ── AND ONE BREATH WAS NOT ENOUGH BREATHS ───────────────────────────────────────────
 *
 * The orb's breath was parameterised on the window — one complete inhale+exhale inside 5d. **That
 * is one phase change, and it was unreadable.** `BREATH_PHASES` sets the count instead of the
 * cycle, and the cycle falls out of it:
 *
 *     window 45f ÷ 3 phases = **15 frames a phase** → cycle = 15 × 2 = **30 frames**
 *
 * Three phases — **in, out, in** — at half a second each. Four would be 11.25 frames (375ms) and
 * is a strobe; two is what was there. The third phase starts at f225 with a full 15 frames to run
 * before the cut at f240, so no phase is clipped — and `BEAT5_PREVIEW` holds all of it at 10.01px.
 *
 * ── AND THE MINUTE GETS ANOTHER SECOND (3.6) ────────────────────────────────────────
 *
 * 5d ran **45 frames — 1.5s for a 60-second process**, a 40× compression, and at that rate the
 * three breathing phases got 15 frames each: half a second per phase, which is the floor at which
 * a pacer reads as a pacer rather than as a flicker. It was on the floor, so nothing in the beat
 * could breathe.
 *
 * 5d is **75 frames** now (2.5s, 24× compression) and the phase count stays at three, so each
 * phase gets **25 frames — five sixths of a second**. That is the difference between seeing that
 * the label alternates and being able to follow it. The bar and the readout take the new
 * compression directly, as they always did.
 *
 * **Everything after f270 shifts by +30 and nothing else about the beat changes.** The beat goes
 * 372 → 402 frames.
 */
/**
 * 5d's pacer must alternate visibly, not once. Three phases: in → out → in.
 *
 * **The count comes from `PitchContext` now, and 3 is still what this cut gets** — the default
 * is the launch cut, so nothing here changes unless the pitch composition's provider is above
 * it. The pitch cut runs 5d over 240 output frames rather than 75 and takes **six** phases at 40
 * frames each; at three that window would be 2.7s a phase, slower than a breath, and the label
 * would alternate twice in eight seconds. See `../../pitch-context.tsx`.
 */
const BREATH_PHASES_LAUNCH = 3;

/**
 * ── THE INTRO'S BEATS MOVED 18 FRAMES LATER, AND NOTHING ELSE DID ──────────────────
 *
 * 5a now pushes in, and a push-in that lands before the emphasis fires costs frames the old
 * locked-off wide did not have to spend. All of them come out of the intro's own tail:
 * `turnOnCamera` 48 → 66 and `greenRoom` 60 → 76. **Every timing from the gate onward is
 * untouched** — `gateClear` 108, `imReady` 146, `countdown` 150, and the green room's camera hold
 * still runs f98 → f150. The beat is still 372 frames and 5b still gets its 52-frame hold on the
 * first sight of his face.
 */
const T = {
  turnOnCamera: 66,
  greenRoom: 76,
  gateClear: 108,
  /** The "I'm ready" click. The gate cleared at f108; he acts on it. */
  imReady: 146,
  countdown: 150,
  /** …which now genuinely counts, at half a second a number. */
  recording: 150 + COUNTDOWN_FRAMES,
  /** +30 (3.6): 5d goes 45 → 75 frames, so each breathing phase gets 25 rather than 15. */
  uploading: 270,
  /**
   * ── +20, AND THE FILM GROWS RATHER THAN 5d SHRINKING ──
   *
   * The punch-in onto the uploading line used to run f244 → f272 with the flip at f270 — 26
   * frames into a 28-frame travel, so the camera had effectively arrived before the thing it
   * moved for happened. It runs f264 → f292 now (the flip 21% in; see `framing.ts` §
   * BEAT5_UPLOADING), which leaves 5d's last 20 frames on a static camera — and would leave the
   * uploading line only 6 settled frames before the pull-out began.
   *
   * That hold is the only moment the line is on screen under a stopped camera, so it keeps its
   * 26 frames and everything from here shifts **+20** instead. The beat goes 402 → 422 and the
   * running total moves with it; 5d loses nothing.
   */
  success: 332,
  doneClick: 394,
  dashboard: 404,
} as const;

/**
 * ── THE THREE CLICKS, IN WORLD COORDINATES ──────────────────────────────────────────
 *
 * Each is the measured centre of the real control, offset by the page position this beat gives
 * its component and then by the page lift where the lift is in force. Verified against this
 * beat's own render: "Turn on camera" is (384, 610.6) 432 × 48, "I'm ready" (365, 575.2) 470 × 48
 * and "Back to home" (440, 462.9) 320 × 48 — all three agree with `CONTROL.*` exactly.
 */
const at = (component: { x: number; y: number }, control: { x: number; y: number; w: number; h: number }) => ({
  x: component.x + control.x + control.w / 2,
  y: CALIB_TOP + component.y + control.y + control.h / 2,
});
const TURN_ON_RAW = at(CALIB.intro, CONTROL.turnOnCamera);
const IM_READY_RAW = at(CALIB.greenRoom, CONTROL.imReady);
const TURN_ON = { x: TURN_ON_RAW.x, y: TURN_ON_RAW.y - PAGE_LIFT };
const IM_READY = { x: IM_READY_RAW.x, y: IM_READY_RAW.y - PAGE_LIFT };
/** The success state renders after the lift has dropped to 0. */
const BACK_HOME = at(SUCCESS, CONTROL.backToHome);

export const Beat05Calibration: React.FC = () => {
  // 3 outside the pitch composition, which is every other place this beat is mounted.
  const { breathPhases } = usePitch();
  const BREATH_PHASES = breathPhases || BREATH_PHASES_LAUNCH;
  const frame = useCurrentFrame();

  // **The audience's first look at his face**, and everything in beats 7–11 depends on their
  // having learned it while it was calm. Held, not played.
  const pose = useExpression([{ frame: 0, state: "calm" }]);

  const phase: CalibPhase =
    frame >= T.success
      ? "success"
      : frame >= T.uploading
        ? "uploading"
        : frame >= T.recording
          ? "recording"
          : frame >= T.countdown
            ? "get-ready"
            : frame >= T.greenRoom
              ? "green-room"
              : "intro";

  /**
   * The lift is in force while the recorder column is taller than the viewport, and gone the
   * moment it is not. Not interpolated: the content is wholly replaced on the same frame, so a
   * step is invisible where a 12-frame settle would read as a drift under new copy.
   */
  const lift = frame < T.uploading ? PAGE_LIFT : 0;

  /**
   * The real 60s capture, compressed. The most aggressive compression in the video, and it is
   * fine — but it was taking the 30× **linearly**, which gave the bar no shape and the readout
   * thirty distinct values a second. `useCaptureMinute` eases the compression (so the minute
   * starts near real time, races, and settles — the shape that reads as elapsed time rather than
   * as a skip) and holds the numeral four frames at a time so the digits are legible. The bar
   * takes the continuous value; only the digits are paced. See `motion.tsx`.
   */
  const { remaining, shown } = useCaptureMinute(T.recording, T.uploading - T.recording);

  /**
   * ── §7 · THE PRIVACY LINE'S IN-PLACE EMPHASIS (L12) ────────────────────────────────
   *
   * "Your video isn't stored — only the calm reading it produces." It rises alone, is held, and
   * settles as the cursor arrives — so the two movements in 5a never compete for the eye.
   *
   * **The window moved with the framing and nothing else about it did.** The camera now lands
   * `INTRO_READ` at f32, so the rise starts at f34 rather than f4: a raise that plays while the
   * camera is still travelling is two movements competing, which is the one thing the sheet's own
   * note about this device forbids. Amplitude, shape, direction and the ban on recolouring are
   * unchanged — see `IntroPrivacyEmphasis`, and `geometry.ts` § INTRO_PRIVACY for the clearances.
   */
  const privacyEmphasis = useEmphasis([
    { frame: 32, up: 0 },
    { frame: 34, up: 0 },
    { frame: 46, up: 1 },
    { frame: 52, up: 1 },
    { frame: 62, up: 0 },
  ]);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // 5a · a brief establishing wide — the heading, the lede and the three icon rows, whole.
          { frame: 0, shot: BEAT5_INTRO },
          { frame: 8, shot: BEAT5_INTRO },
          // …then IN, onto the line the film's privacy claim lives in. The sheet's "5a STAYS
          // WIDE" was written when the line had no other option; at 1021.5 it reads at 5.8px.
          { frame: 32, shot: INTRO_READ },
          { frame: 76, shot: INTRO_READ },
          // 5b · the green room — the preview and the status card, both whole. The first sight
          // of his face gets a real hold.
          { frame: 98, shot: BEAT5_GREENROOM },
          { frame: 150, shot: BEAT5_GREENROOM },
          // 5c–5d · one hold across the count and the orb, wide enough to keep the page under it.
          { frame: 172, shot: BEAT5_PREVIEW },
          // 5e · the camera CLOSES IN across the flip. The capture stage is replaced at f270 —
          // every pixel of the shot at once — and under a static camera that read as a cut. The
          // move starts at f264 so the flip lands SIX frames in, while the camera is still
          // visibly travelling; at f244 it was landing 26 frames into 28 and arriving first.
          { frame: 264, shot: BEAT5_PREVIEW },
          { frame: 292, shot: BEAT5_UPLOADING },
          // …and the line keeps its full 26-frame settled hold. See `T.success`.
          { frame: 318, shot: BEAT5_UPLOADING },
          // 5f · OUT, so the whole success state AND its ripple are in frame, and only then the
          // click. Register item 4, with the rect's x corrected.
          { frame: 356, shot: BEAT5_SUCCESS },
          { frame: 404, shot: BEAT5_SUCCESS },
          // …which lands on the dashboard, at the full frame beat 6 holds.
          { frame: 422, shot: shot(W / 2, H / 2, W) },
        ]}
      >
        <CalibratePage
          clock={frame >= T.recording ? "10:40 AM" : "10:39 AM"}
          phase={phase}
          pose={pose}
          gateReady={frame >= T.gateClear}
          remaining={Math.max(0, remaining)}
          shownRemaining={Math.max(0, shown)}
          privacyEmphasis={privacyEmphasis}
          successFrom={T.success}
          countdownFrom={T.countdown}
          recordingFrom={T.recording}
          // THREE pacer phases inside the compressed minute — in, out, in — at 15 frames each.
          // A cycle is two phases, so the window divided by the phase count, doubled. See
          // `useOrbBreath` for why the orb's period is staged where the timer's is taken at 30×
          // directly, and the note above for why one breath was not enough.
          breathCycle={((T.uploading - T.recording) / BREATH_PHASES) * 2}
          overlay={
            <>
              {/*
               * ── THE PAGE LIFT ──
               *
               * The recorder column is 508.2px tall in a 519px band that starts 32px lower than
               * it needs to, so the green-room card's bottom border and 5a's helper line are both
               * clipped by the viewport at rest. This is the scroll that a user would already
               * have made. See the note on `PAGE_LIFT` — it belongs on `calibrate.tsx` as a
               * `scroll` prop, the way `consent.tsx` already carries one.
               */}
              <style>{`section.space-y-6 { margin-top: ${-lift}px; }`}</style>

              {/*
               * ── §2 · THE CONTROLS LIGHT UP BEFORE THE CLICK ──
               *
               * Each `<Hover/>` window opens as the pointer's travel ENDS and stays open across
               * the click — a real pointer is still over a button while it presses it, and a
               * control that un-hovered on the press would read as the cursor jumping off. Every
               * treatment is the variant's own, transcribed from `button.tsx`; all three of these
               * are `variant="meadow"`, so all three take `hover:opacity-90`, which the product
               * snaps because `transition-colors` does not cover opacity.
               */}
              {/* 5a ends on the click of "Turn on camera". The pointer arrives as the privacy
                  line settles, so the two movements never share the eye. */}
              <Hover
                selector="[data-probe='intro'] button"
                treatment="meadow"
                from={T.turnOnCamera - 4}
                to={T.greenRoom}
              />
              <Pointer
                path={[
                  { frame: 48, x: TURN_ON.x - 160, y: TURN_ON.y + 50 },
                  { frame: T.turnOnCamera - 4, x: TURN_ON.x, y: TURN_ON.y },
                ]}
                clicks={[T.turnOnCamera]}
                visible={{ from: 44, to: T.greenRoom }}
              />

              {/* 5b ends on "I'm ready" — the gate cleared at f108 and he acts on it. */}
              <Hover
                selector="[data-probe='greenroom'] button"
                treatment="meadow"
                from={T.imReady - 6}
                to={T.countdown}
              />
              <Pointer
                path={[
                  { frame: T.gateClear + 2, x: IM_READY.x - 180, y: IM_READY.y + 60 },
                  { frame: T.imReady - 6, x: IM_READY.x, y: IM_READY.y },
                ]}
                clicks={[T.imReady]}
                visible={{ from: T.gateClear, to: T.countdown }}
              />

              {/* 5f — the state is read whole, THEN he clicks "Back to home". */}
              <Hover
                selector="[data-calib-success] button"
                treatment="meadow"
                from={T.doneClick - 10}
                to={T.dashboard}
              />
              <Pointer
                path={[
                  { frame: T.success + 26, x: BACK_HOME.x - 190, y: BACK_HOME.y + 50 },
                  { frame: T.doneClick - 10, x: BACK_HOME.x, y: BACK_HOME.y },
                ]}
                clicks={[T.doneClick]}
                visible={{ from: T.success + 22 }}
              />
            </>
          }
        />
      </Camera>
    </AbsoluteFill>
  );
};

/**
 * Checked, not asserted. Every figure is `worldSize × 422 / framedWidth`, the phone-legibility
 * arithmetic in `geometry.ts`, against the shots above rather than against the old ones.
 */
export const BEAT05_LEGIBILITY = {
  introWide: { framedWidth: BEAT5_INTRO.w, heading: PHONE_PX(36, BEAT5_INTRO.w) },
  introRead: {
    framedWidth: INTRO_READ.w,
    /** `intro.tsx:52` is `text-sm`. Seated, then at L12's 1.25×. */
    privacyLine: PHONE_PX(14, INTRO_READ.w),
    privacyLineRaised: PHONE_PX(14 * 1.25, INTRO_READ.w),
    turnOnCamera: PHONE_PX(16, INTRO_READ.w),
  },
  greenRoom: { framedWidth: BEAT5_GREENROOM.w, statusLine: PHONE_PX(14, BEAT5_GREENROOM.w) },
  capture: { framedWidth: BEAT5_PREVIEW.w, breathLabel: PHONE_PX(14, BEAT5_PREVIEW.w) },
  success: {
    framedWidth: BEAT5_SUCCESS.w,
    /** `text-3xl sm:text-4xl` → 36px at this viewport. */
    heading: PHONE_PX(36, BEAT5_SUCCESS.w),
    body: PHONE_PX(16, BEAT5_SUCCESS.w),
  },
} as const;
