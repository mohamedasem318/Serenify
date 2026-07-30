import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { CalibratePage, type CalibPhase } from "../../app/calibrate";
import {
  BEAT5_GREENROOM,
  BEAT5_INTRO,
  BEAT5_PREVIEW,
  BEAT5_SUCCESS,
  CALIB_TOP,
  PHONE,
} from "../../app/framing";
import { CALIB, CONTROL, SUCCESS } from "../../app/geometry";
import { Hover } from "../../app/hover";
import { COUNTDOWN_FRAMES, useCaptureMinute, useEmphasis } from "../../app/motion";
import { Pointer } from "../../app/pointer";
import { Camera, shot } from "../Camera";
import { useExpression } from "../rig";
import { H, W } from "../theme";

/**
 * Beat 5 · Calibration · 372 frames
 *
 * **ONE TAKE.** The chain is: intro → green room → countdown → recording → the uploading line
 * REPLACES the capture stage → the success state → he clicks it → the dashboard. Every step is
 * a real component and the click is a real action.
 *
 * ══ REGISTER ITEM 5 — THE PREVIEW BECOMES 16:9 ══════════════════════════════════════
 *
 * The greybox drew the preview as a 240-wide 3:4 box. The real component is a full-width
 * **`aspect-video`** box — **512 × 288** in the `max-w-lg` column — with a **3:4 bracket guide
 * floating inside it** at 168.5 × 224.6 (`framing-overlay.tsx:82`, `aspect-[3/4] h-[78%]`). The
 * bracket *target* was always genuinely 3:4, so 5b was faithful to it; the *box* never was, and
 * the decision is to go faithful.
 *
 * **The take is reframed rather than adjusted**, and the change does what the register
 * predicted. The bracket target occupies only **33% of the box's width**, so where he sits in
 * frame is a visible fact about the shot rather than an inset inside a portrait box his face
 * already filled — the centring nudge finally has room to read against. The sheet's old framing
 * note capped the preview at 240 wide so the preview and the status line could be held
 * together; at the real 512 that cap is meaningless, and the composite is governed by the real
 * green-room card below the box instead.
 *
 * ══ REGISTER ITEM 4 — THE SUCCESS STATE, FRAMED AGAINST THE RIPPLE ══════════════════
 *
 * This beat has read as punched-in across three revisions, and the cause turns out to be one
 * number. The component measures 448 × 346.9. Its ripple (`success-state.tsx:30-36`) scales a
 * `size-24` span to **2.1**, so it reaches (96 × 2.1 − 96) / 2 = **52.8px past the badge on
 * every side** — and the badge sits only 24px below the component's own top edge, so **the
 * ripple crosses that edge by 28.8px**.
 *
 * Every previous framing measured the component and cropped the ripple. The payoff therefore
 * played with its own bloom clipped by the frame edge, which looks exactly like a shot that is
 * too tight — because it is one. `BEAT5_SUCCESS` frames the component grown by the ripple's
 * real overshoot on all four sides.
 *
 * **The order is unchanged and still matters:** the uploading line resolves → the camera pulls
 * out to hold the whole state → it is read → *then* he clicks.
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
 * At the old thirty that would have been ten frames a number, and a third of a second is a
 * flicker rather than a beat settling. Half a second is a 2× compression of a real countdown
 * against the 3× the beat was nominally claiming, and it is the point at which a digit reads as
 * having landed.
 *
 * ── THE FIFTEEN FRAMES COME OUT OF 5d, AND NOT OUT OF THE CAMERA ────────────────────
 *
 * This is the constraint that decided it: **framing is Pass B's and no keyframe moves here.** The
 * camera holds `BEAT5_GREENROOM` to f150 and lands on `BEAT5_PREVIEW` at f172, so a countdown
 * starting before f150 would play its first two numbers at the green-room framing — and worse,
 * `<GreenRoom/>` unmounts the moment the phase flips, so those frames would hold a 204px hole
 * where its card had been. Starting the countdown early is only free if the camera moves with it,
 * and it cannot.
 *
 * So the countdown stays at f150 and takes its fifteen frames from the recording window: 5d goes
 * from 60 frames to 45, ~2s to ~1.5s. **The sheet's own trim list already prices that** — "Beat 5,
 * 12.4s → 10.5s. 5d recording can lose a second" — so this is spending half of a cut the sheet
 * had already agreed was available. The orb's breath is parameterised on the window
 * (`breathCycle={T.uploading - T.recording}`), so it still shows exactly one complete breath.
 *
 * **Nothing after f240 moves, the beat stays 372 frames, and the running total is unchanged.**
 */
const T = {
  turnOnCamera: 48,
  greenRoom: 60,
  gateClear: 108,
  /** The "I'm ready" click. The gate cleared at f108; he acts on it. */
  imReady: 146,
  countdown: 150,
  /** …which now genuinely counts, at half a second a number. */
  recording: 150 + COUNTDOWN_FRAMES,
  uploading: 240,
  success: 282,
  doneClick: 344,
  dashboard: 354,
} as const;

/**
 * ── THE THREE CLICKS, IN WORLD COORDINATES ──────────────────────────────────────────
 *
 * Each is the measured centre of the real control, offset by the page position this beat gives
 * its component. `CONTROL.*` are offsets inside the component; `CALIB_TOP` is where the
 * calibration column starts. A pointer that lands NEAR a button reads as a miss, which is why
 * none of these is eyeballed.
 */
const at = (component: { x: number; y: number }, control: { x: number; y: number; w: number; h: number }) => ({
  x: component.x + control.x + control.w / 2,
  y: CALIB_TOP + component.y + control.y + control.h / 2,
});
const TURN_ON = at(CALIB.intro, CONTROL.turnOnCamera);
const IM_READY = at(CALIB.greenRoom, CONTROL.imReady);
const BACK_HOME = at(SUCCESS, CONTROL.backToHome);

export const Beat05Calibration: React.FC = () => {
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
   * settles as the cursor arrives — so the two movements in 5a never compete for the eye. The
   * pointer's own window was moved back eight frames to make that separation clean; the click
   * itself is untouched at f48.
   *
   * Motion only. It is not recoloured — see `IntroPrivacyEmphasis` for why that is a rule here
   * rather than a preference, and `geometry.ts` § INTRO_PRIVACY for the two clearances that say
   * 1.25× fits with 27px and 249px to spare.
   */
  const privacyEmphasis = useEmphasis([
    { frame: 0, up: 0 },
    { frame: 4, up: 0 },
    { frame: 18, up: 1 },
    { frame: 28, up: 1 },
    { frame: 42, up: 0 },
  ]);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // 5a · WIDE. The three icon rows are short and the intro reads without magnification,
          // so the old push-in onto "Turn on camera" was buying nothing.
          { frame: 0, shot: BEAT5_INTRO },
          { frame: 60, shot: BEAT5_INTRO },
          // 5b · the green room — the preview and the status card, both whole. The first sight
          // of his face gets a real hold.
          { frame: 96, shot: BEAT5_GREENROOM },
          { frame: 150, shot: BEAT5_GREENROOM },
          // 5c–5d · in on the preview for the countdown and the orb.
          { frame: 172, shot: BEAT5_PREVIEW },
          { frame: 240, shot: BEAT5_PREVIEW },
          // 5e · the uploading line replaces the capture stage.
          { frame: 268, shot: shot(W / 2, H / 2, 700) },
          { frame: 278, shot: shot(W / 2, H / 2, 700) },
          // 5f · OUT first, so the whole success state AND its ripple are in frame, and only
          // then the click. Register item 4.
          { frame: 306, shot: BEAT5_SUCCESS },
          { frame: 354, shot: BEAT5_SUCCESS },
          // …which lands on the dashboard.
          { frame: 372, shot: shot(W / 2, H / 2, W) },
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
          // One complete breath inside the compressed minute. See `useOrbBreath` for why the
          // orb's period is staged where the timer's is taken at 30× directly.
          breathCycle={T.uploading - T.recording}
          overlay={
            <>
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
              {/* 5a ends on the click of "Turn on camera". The pointer arrives after the privacy
                  line has settled, so the two movements never share the eye. */}
              <Hover
                selector="[data-probe='intro'] button"
                treatment="meadow"
                from={T.turnOnCamera - 6}
                to={T.greenRoom}
              />
              <Pointer
                path={[
                  { frame: 22, x: TURN_ON.x - 200, y: TURN_ON.y + 130 },
                  { frame: T.turnOnCamera - 6, x: TURN_ON.x, y: TURN_ON.y },
                ]}
                clicks={[T.turnOnCamera]}
                visible={{ from: 18, to: T.greenRoom }}
              />

              {/* 5b ends on "I'm ready" — the gate cleared at f96 and he acts on it. */}
              <Hover
                selector="[data-probe='greenroom'] button"
                treatment="meadow"
                from={T.imReady - 6}
                to={T.countdown}
              />
              <Pointer
                path={[
                  { frame: T.gateClear + 2, x: IM_READY.x - 180, y: IM_READY.y + 120 },
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
                  { frame: T.success + 26, x: BACK_HOME.x - 190, y: BACK_HOME.y + 120 },
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

/** Checked, not asserted — see the table in `framing.ts`. */
export const BEAT05_LEGIBILITY = PHONE.beat5Success;
