import { Composition, Folder } from "remotion";

import { Beat01ColdOpen } from "./greybox/beats/Beat01ColdOpen";
import { Beat02Signup } from "./greybox/beats/Beat02Signup";
import { Beat03Dashboard } from "./greybox/beats/Beat03Dashboard";
import { Beat04CameraGate } from "./greybox/beats/Beat04CameraGate";
import { Beat05Calibration } from "./greybox/beats/Beat05Calibration";
import { Beat06Later } from "./greybox/beats/Beat06Later";
import { Beat07AtEase } from "./greybox/beats/Beat07AtEase";
import { Beat08Email } from "./greybox/beats/Beat08Email";
import { Beat09Questionnaire } from "./greybox/beats/Beat09Questionnaire";
import { Beat10Ren } from "./greybox/beats/Beat10Ren";
import { Beat11ReturnToEase } from "./greybox/beats/Beat11ReturnToEase";
import { Beat12EndCard } from "./greybox/beats/Beat12EndCard";
import { GREYBOX_DURATION, GreyboxVideo } from "./greybox/GreyboxVideo";
import { HelloWorld } from "./HelloWorld";
import { WebComponentProbe } from "./WebComponentProbe";
import "./tailwind.css";

/**
 * `Greybox` is the cut: all twelve beats of
 * `docs/video/serenify-launch-video-beat-sheet.md` at their sheet durations, in
 * grey rectangles, with real camera moves.
 *
 * Every beat is ALSO registered on its own under `Greybox-Beats`, so a single
 * beat can be scrubbed and re-timed without playing the sixty seconds in front
 * of it — and because the same component is registered twice, double-clicking a
 * sequence in the main composition jumps straight to that beat's own timeline.
 *
 * `HelloWorld` and `WebComponentProbe` stay. They are the pipeline checks, not
 * beats, and they are what tells you whether a failure is Remotion's or the
 * app bridge's.
 */
export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Greybox"
        component={GreyboxVideo}
        durationInFrames={GREYBOX_DURATION}
        fps={30}
        width={1920}
        height={1080}
      />

      <Folder name="Greybox-Beats">
        <Composition id="Beat01-ColdOpen" component={Beat01ColdOpen} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="Beat02-Signup" component={Beat02Signup} durationInFrames={360} fps={30} width={1920} height={1080} />
        <Composition id="Beat03-Dashboard" component={Beat03Dashboard} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="Beat04-CameraGate" component={Beat04CameraGate} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="Beat05-Calibration" component={Beat05Calibration} durationInFrames={300} fps={30} width={1920} height={1080} />
        <Composition id="Beat06-Later" component={Beat06Later} durationInFrames={60} fps={30} width={1920} height={1080} />
        {/*
         * The sheet's own open question, made scrubbable rather than argued
         * about: does "later that morning" earn its place, or does beat 7's
         * 47:12 timer communicate the jump on its own? Same beat, text off.
         */}
        <Composition
          id="Beat06-Later-NoText"
          component={Beat06Later}
          durationInFrames={60}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ showLaterText: false }}
        />
        <Composition id="Beat07-AtEase" component={Beat07AtEase} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="Beat08-Email" component={Beat08Email} durationInFrames={180} fps={30} width={1920} height={1080} />
        <Composition id="Beat09-Questionnaire" component={Beat09Questionnaire} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="Beat10-Ren" component={Beat10Ren} durationInFrames={210} fps={30} width={1920} height={1080} />
        <Composition id="Beat11-ReturnToEase" component={Beat11ReturnToEase} durationInFrames={180} fps={30} width={1920} height={1080} />
        <Composition id="Beat12-EndCard" component={Beat12EndCard} durationInFrames={150} fps={30} width={1920} height={1080} />
      </Folder>

      <Folder name="Pipeline-Checks">
        <Composition
          id="HelloWorld"
          component={HelloWorld}
          durationInFrames={90}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="WebComponentProbe"
          component={WebComponentProbe}
          durationInFrames={90}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
    </>
  );
}
