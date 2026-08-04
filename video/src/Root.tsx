import { Composition, Folder } from "remotion";

// FIRST, and before any beat. `fonts.ts` registers Inter, Outfit and Geist Mono under the exact
// family names `apps/web/app/globals.css` asks for, each behind its own `delayRender` handle —
// so no frame can be screenshotted before the real faces are in. Without it every real component
// silently falls back to `system-ui`, which is most of why the film read as greybox even where it
// wasn't. See the header in `fonts.ts`.
import "./fonts";
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
import { Beat12Closing } from "./greybox/beats/Beat12Closing";
import { Beat13EndCard } from "./greybox/beats/Beat13EndCard";
import { CUT_DURATION, GreyboxVideo } from "./greybox/GreyboxVideo";
import { Interstitial, INTERSTITIAL_FRAMES } from "./greybox/beats/Interstitial";
import { INTERSTITIALS } from "./greybox/copy";
import { RigSpike } from "./greybox/RigSpike";
import { SwapProbe } from "./SwapProbe";
import { HelloWorld } from "./HelloWorld";
import { WebComponentProbe } from "./WebComponentProbe";
import "./tailwind.css";

/**
 * `Greybox` is the cut: all thirteen beats of
 * `docs/video/serenify-launch-video-beat-sheet.md`, **read at the rates of Mohamed's
 * Premiere re-cut** — 2261 frames of output over 2448 authored ones — plus the **four
 * interstitial cards**, which are not retimed at all and add 240 output frames on top, for
 * **2501**. The beats below are registered at their **authored** durations and are unretimed,
 * which is what makes one of them scrubbable on its own. See `retime.tsx` and
 * `GreyboxVideo.tsx`.
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
        durationInFrames={CUT_DURATION}
        fps={30}
        width={1920}
        height={1080}
      />

      <Folder name="Greybox-Beats">
        <Composition id="Beat01-ColdOpen" component={Beat01ColdOpen} durationInFrames={180} fps={30} width={1920} height={1080} />
        <Composition id="Beat02-Signup" component={Beat02Signup} durationInFrames={432} fps={30} width={1920} height={1080} />
        <Composition id="Beat03-Dashboard" component={Beat03Dashboard} durationInFrames={120} fps={30} width={1920} height={1080} />
        {/* 180 → 120: the privacy-line landing is gone. It made the film's privacy claim two
            beats before beat 5a makes it again, which turned the second into a repeat. */}
        <Composition id="Beat04-CameraGate" component={Beat04CameraGate} durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="Beat05-Calibration" component={Beat05Calibration} durationInFrames={422} fps={30} width={1920} height={1080} />
        {/* The time-jump line is gone entirely — only beat 7's session timer marks
            the jump now. See the flag in Beat06Later.tsx. */}
        <Composition id="Beat06-Later" component={Beat06Later} durationInFrames={36} fps={30} width={1920} height={1080} />
        <Composition id="Beat07-AtEase" component={Beat07AtEase} durationInFrames={72} fps={30} width={1920} height={1080} />
        <Composition id="Beat08-Email" component={Beat08Email} durationInFrames={184} fps={30} width={1920} height={1080} />
        <Composition id="Beat09-Questionnaire" component={Beat09Questionnaire} durationInFrames={76} fps={30} width={1920} height={1080} />
        <Composition id="Beat10-Ren" component={Beat10Ren} durationInFrames={310} fps={30} width={1920} height={1080} />
        <Composition id="Beat11-ReturnToEase" component={Beat11ReturnToEase} durationInFrames={234} fps={30} width={1920} height={1080} />
        <Composition id="Beat12-Closing" component={Beat12Closing} durationInFrames={90} fps={30} width={1920} height={1080} />
        <Composition id="Beat13-EndCard" component={Beat13EndCard} durationInFrames={172} fps={30} width={1920} height={1080} />
      </Folder>

      {/* The four interstitial cards, registered so each can be scrubbed on its own. They are
          OUTPUT-timeline material — not beats, never retimed — so unlike the beats above these
          run at exactly the duration the cut gives them. See `beats/Interstitial.tsx`. */}
      <Folder name="Greybox-Cards">
        <Composition id="Card1-Calm" component={Interstitial} defaultProps={{ line: INTERSTITIALS.calm }} durationInFrames={INTERSTITIAL_FRAMES} fps={30} width={1920} height={1080} />
        <Composition id="Card2-Quiet" component={Interstitial} defaultProps={{ line: INTERSTITIALS.quiet }} durationInFrames={INTERSTITIAL_FRAMES} fps={30} width={1920} height={1080} />
        <Composition id="Card3-Changes" component={Interstitial} defaultProps={{ line: INTERSTITIALS.changes }} durationInFrames={INTERSTITIAL_FRAMES} fps={30} width={1920} height={1080} />
        <Composition id="Card4-Down" component={Interstitial} defaultProps={{ line: INTERSTITIALS.down }} durationInFrames={INTERSTITIAL_FRAMES} fps={30} width={1920} height={1080} />
      </Folder>

      {/* The character rig's own bench. Not a beat, never in the cut — it shows the
          five poses static, and beat 8's fall at its real timings both large and at the
          viewfinder's real on-screen size. See RigSpike.tsx. */}
      <Folder name="Spikes">
        <Composition id="CharacterRig" component={RigSpike} durationInFrames={180} fps={30} width={1920} height={1080} />
      </Folder>

      <Folder name="Pipeline-Checks">
        <Composition
          id="SwapProbe"
          component={SwapProbe}
          durationInFrames={30}
          fps={30}
          width={1920}
          height={1400}
        />
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
