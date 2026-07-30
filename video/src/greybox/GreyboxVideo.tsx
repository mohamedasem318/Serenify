import React from "react";
import { AbsoluteFill, Series } from "remotion";

import { Beat01ColdOpen } from "./beats/Beat01ColdOpen";
import { Beat02Signup } from "./beats/Beat02Signup";
import { Beat03Dashboard } from "./beats/Beat03Dashboard";
import { Beat04CameraGate } from "./beats/Beat04CameraGate";
import { Beat05Calibration } from "./beats/Beat05Calibration";
import { Beat06Later } from "./beats/Beat06Later";
import { Beat07AtEase } from "./beats/Beat07AtEase";
import { Beat08Email } from "./beats/Beat08Email";
import { Beat09Questionnaire } from "./beats/Beat09Questionnaire";
import { Beat10Ren } from "./beats/Beat10Ren";
import { Beat11ReturnToEase } from "./beats/Beat11ReturnToEase";
import { Beat12Closing } from "./beats/Beat12Closing";
import { Beat13EndCard } from "./beats/Beat13EndCard";
import { FONT, GREY } from "./theme";

/**
 * The greybox cut — all thirteen beats of
 * `docs/video/serenify-launch-video-beat-sheet.md`, each at the duration the
 * sheet gives it.
 *
 * This pass answers one question: does the pacing work. It is deliberately ugly
 * — grey rectangles for every screen, panel and person — because the two things
 * being tested are the durations and the camera moves, and both are real here.
 * Everything else gets thrown away.
 *
 * **No cuts inside a beat.** Each beat is one `<Camera>` and one continuous scene;
 * the camera moves, holds and moves again. Beats 2 and 5 used to be six and five
 * sub-sequences with a camera each, which was eleven cuts inside two beats.
 *
 * Durations are inlined rather than derived from a table so they can be dragged
 * in Studio and read straight off the sheet.
 *
 *   1 cold open     180          7 at ease        120
 *   2 signup        468 (−12)    8 the email      180
 *   3 dashboard     120 (−30)    9 questionnaire   90
 *   4 camera gate   150         10 Ren            210
 *   5 calibration   372 (+12)   11 return to ease 210 (+30)
 *   6 later          60         12 closing card   90 (NEW)
 *                               13 end card      180 (+30)
 *                                       total   2430 = 81.0s @ 30fps
 *
 * +4s on revision 3's 77s. Where it went: beat 11 finally lands and holds its
 * pull-out (+1s), the closing subtitle card is new (+3s), the end card's hold is
 * longer (+1s), and beat 5f pays 0.4s for a success state that is no longer cropped
 * — against beat 3's travelling lift getting tightened (−1s) and beat 2's wide hold
 * on a sparse screen getting shorter (−0.4s).
 */
export const GREYBOX_DURATION = 2430;

export const GreyboxVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: GREY.black, fontFamily: FONT }}>
    <Series>
      <Series.Sequence durationInFrames={180} name="1 · cold open">
        <Beat01ColdOpen />
      </Series.Sequence>
      <Series.Sequence durationInFrames={468} name="2 · signup">
        <Beat02Signup />
      </Series.Sequence>
      <Series.Sequence durationInFrames={120} name="3 · dashboard">
        <Beat03Dashboard />
      </Series.Sequence>
      <Series.Sequence durationInFrames={150} name="4 · camera gate">
        <Beat04CameraGate />
      </Series.Sequence>
      <Series.Sequence durationInFrames={372} name="5 · calibration">
        <Beat05Calibration />
      </Series.Sequence>
      <Series.Sequence durationInFrames={60} name="6 · later">
        <Beat06Later />
      </Series.Sequence>
      <Series.Sequence durationInFrames={120} name="7 · at ease">
        <Beat07AtEase />
      </Series.Sequence>
      <Series.Sequence durationInFrames={180} name="8 · the email">
        <Beat08Email />
      </Series.Sequence>
      <Series.Sequence durationInFrames={90} name="9 · questionnaire">
        <Beat09Questionnaire />
      </Series.Sequence>
      <Series.Sequence durationInFrames={210} name="10 · Ren">
        <Beat10Ren />
      </Series.Sequence>
      <Series.Sequence durationInFrames={210} name="11 · return to ease">
        <Beat11ReturnToEase />
      </Series.Sequence>
      <Series.Sequence durationInFrames={90} name="12 · closing card">
        <Beat12Closing />
      </Series.Sequence>
      <Series.Sequence durationInFrames={180} name="13 · end card">
        <Beat13EndCard />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
