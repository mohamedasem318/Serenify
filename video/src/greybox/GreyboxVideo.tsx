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
import { Settle } from "./settle";
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
 *   2 signup        432          8 the email      200
 *   3 dashboard     120          9 questionnaire   90
 *   4 camera gate   120         10 Ren            332
 *   5 calibration   422          11 return to ease 234
 *   6 later          60         12 closing card   90
 *                               13 end card      172 (+36)
 *                                       total   2572 = 85.7s @ 30fps
 *
 * **+36 frames this pass, and all of it is the wordmark reveal.**
 *
 *   beat 13  136 → 172   the reveal was *"still far too fast"* at 36 frames and needed
 *                        "considerably more than a touch". The wipe is 72 (2.40s) and the four
 *                        events after it shift by the same +42, so every gap between them is
 *                        unchanged and the held card keeps its 18 frames. It is the LAST beat, so
 *                        nothing is pushed by it. See `Beat13EndCard.tsx` § THE REVEAL IS DOUBLED.
 *
 * **Beat 11 gained a landing and did not gain a frame.** The punch-in onto the music player is
 * paid for out of its own establishing hold and out of the player window's close overlapping the
 * camera's departure; the closing composite still holds for 136 frames, f98 to the end.
 *
 * Nothing was cut, and no protected hold moved.
 */
export const GREYBOX_DURATION = 2572;

export const GreyboxVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: GREY.black, fontFamily: FONT }}>
    {/* Outside the Series, so it is mounted exactly once for the whole cut and every beat gets
        the same hold. See `settle.tsx` — the renderer was emitting one wrong frame in a few
        hundred, and no beat could have known to guard against it. */}
    <Settle />
    <Series>
      <Series.Sequence durationInFrames={180} name="1 · cold open">
        <Beat01ColdOpen />
      </Series.Sequence>
      <Series.Sequence durationInFrames={432} name="2 · signup">
        <Beat02Signup />
      </Series.Sequence>
      <Series.Sequence durationInFrames={120} name="3 · dashboard">
        <Beat03Dashboard />
      </Series.Sequence>
      <Series.Sequence durationInFrames={120} name="4 · camera gate">
        <Beat04CameraGate />
      </Series.Sequence>
      <Series.Sequence durationInFrames={422} name="5 · calibration">
        <Beat05Calibration />
      </Series.Sequence>
      <Series.Sequence durationInFrames={60} name="6 · later">
        <Beat06Later />
      </Series.Sequence>
      <Series.Sequence durationInFrames={120} name="7 · at ease">
        <Beat07AtEase />
      </Series.Sequence>
      <Series.Sequence durationInFrames={200} name="8 · the email">
        <Beat08Email />
      </Series.Sequence>
      <Series.Sequence durationInFrames={90} name="9 · questionnaire">
        <Beat09Questionnaire />
      </Series.Sequence>
      <Series.Sequence durationInFrames={332} name="10 · Ren">
        <Beat10Ren />
      </Series.Sequence>
      <Series.Sequence durationInFrames={234} name="11 · return to ease">
        <Beat11ReturnToEase />
      </Series.Sequence>
      <Series.Sequence durationInFrames={90} name="12 · closing card">
        <Beat12Closing />
      </Series.Sequence>
      <Series.Sequence durationInFrames={172} name="13 · end card">
        <Beat13EndCard />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
