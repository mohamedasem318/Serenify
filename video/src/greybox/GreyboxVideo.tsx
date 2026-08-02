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
 *   1 cold open     180          7 at ease         72 (−48)
 *   2 signup        432          8 the email      184 (−16)
 *   3 dashboard     120          9 questionnaire   76 (−14)
 *   4 camera gate   120         10 Ren            310 (−22)
 *   5 calibration   422         11 return to ease 234
 *   6 later          36 (−24)   12 closing card    90
 *                               13 end card       172
 *                                       total   2448 = 81.6s @ 30fps
 *
 * ══ −124 FRAMES, ALL OF THEM IN THE SECOND HALF, AND NONE OF THEM A READ ════════════
 *
 * **The two halves were keeping different time from the "Start check-in" click onward, and the
 * measurement is the argument.** Two numbers, taken per camera landing across every beat:
 *
 *                              settled frames per landing       DEAD dwell per landing
 *                              mean      median                 mean      median
 *   1st half (f0 – f1296)      30.0      22                      6.2       6
 *   2nd half, before           60.9      49                     22.4      17
 *   2nd half, after            54.6      37                     17.0       9
 *
 * *Dead dwell* is the settled frames left in a landing **after its last authored event** — the
 * camera stopped, nothing on screen changing. It is the honest measure here, because the second
 * half's landings were not merely longer, they were emptier: the first half spends 21% of its
 * settled time with nothing happening, the second spent 37%.
 *
 * The AFTER column is still above the first half's, and it is entirely the four holds that are
 * not allowed to move: beat 10's two reads (36 on turn 1, 60 on turn 3), beat 11's protected
 * closing composite (64 after the tail settles) and beat 7's establish (36). **Excluding those
 * four, the second half's dead dwell is mean 6.3 / median 5 against the first half's 6.2 / 6** —
 * the same film, keeping the same time.
 *
 * What each cut was:
 *
 *   beat  6   60 → 36   38 dead frames of a locked-off dashboard after the click. The page does
 *                       not respond to the press; nothing was happening in any of them.
 *   beat  7  120 → 72   a 60-frame move on a 10% push, then a 60-frame hold on a beat whose one
 *                       device (L12's raise) L15 removed. Halved on both sides.
 *   beat  8  200 → 184  the fall finishes at f86 and `dismayed` is a constant pose after it; the
 *                       camera sat on it until f118. It leaves at f102, and the whole third act
 *                       shifts −16 with its spacing intact.
 *   beat  9   90 → 76   the prompt has no response state, so the 24 frames after the click were
 *                       a stopped camera on a stopped surface.
 *   beat 10  332 → 310  two typing indicators, 52 and 44 frames, cut to 38 and 36. An indicator
 *                       is looked at, not read.
 *
 * **Nothing that has to be READ lost a frame**, and that is checkable line by line: beat 8's
 * toast keeps its whole 38-frame hold at the clock framing and its second stateline change keeps
 * its 20 to the end of the beat; beat 9's prompt keeps its 60 frames before the click; beat 10's
 * turn 1 keeps 36 at 14.37px and turn 3 keeps its protected 60; beat 12's line keeps its 50.
 *
 * **And the invariants are intact.** Beat 11's closing composite still holds 136 frames from f98
 * to the end; beat 13's wordmark reveal is still 72 on `out(quad)`; the trend's band keys moved
 * with beat 8's copy changes by the same −16, so the crossings still land on the exact frames the
 * stateline steps; and no beat gained a cut — every one of these is a hold shortened or a move
 * shortened, never a new edit inside a beat.
 *
 * **The first half is untouched.** Beat 1's hero framing is the only change before the click, and
 * it is a framing rather than a timing — see `Beat01ColdOpen.tsx` § THE HERO BLOCK IS CENTRED.
 *
 * ── WHAT THE EARLIER PASSES PUT IN, AND KEPT ────────────────────────────────────────
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
 */
export const GREYBOX_DURATION = 2448;

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
      <Series.Sequence durationInFrames={36} name="6 · later">
        <Beat06Later />
      </Series.Sequence>
      <Series.Sequence durationInFrames={72} name="7 · at ease">
        <Beat07AtEase />
      </Series.Sequence>
      <Series.Sequence durationInFrames={184} name="8 · the email">
        <Beat08Email />
      </Series.Sequence>
      <Series.Sequence durationInFrames={76} name="9 · questionnaire">
        <Beat09Questionnaire />
      </Series.Sequence>
      <Series.Sequence durationInFrames={310} name="10 · Ren">
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
