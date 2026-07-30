import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { CalibratePage, type CalibPhase } from "../../app/calibrate";
import {
  BEAT5_GREENROOM,
  BEAT5_INTRO,
  BEAT5_PREVIEW,
  BEAT5_SUCCESS,
  PHONE,
} from "../../app/framing";
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

const T = {
  turnOnCamera: 48,
  greenRoom: 60,
  gateClear: 108,
  countdown: 150,
  recording: 180,
  uploading: 240,
  success: 282,
  doneClick: 344,
  dashboard: 354,
} as const;

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

  // The real 60s capture, compressed: ~2s of screen time for a 60s process. The most aggressive
  // compression in the video, and it is fine — the orb's rhythm sells the idea instantly.
  const remaining = Math.round(60 * (1 - (frame - T.recording) / 60));

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
          successFrom={T.success}
          countdownFrom={T.countdown}
        />
      </Camera>
    </AbsoluteFill>
  );
};

/** Checked, not asserted — see the table in `framing.ts`. */
export const BEAT05_LEGIBILITY = PHONE.beat5Success;
