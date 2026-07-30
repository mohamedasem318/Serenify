import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { BEAT8_CLOCK, BEAT8_FACE, BEAT8_WIDE, COMPOSITE, PHONE } from "../../app/framing";
import { MonitorPage } from "../../app/monitor";
import { useDrift, useEmphasis } from "../../app/motion";
import { MailToast } from "../../app/toast";
import { Camera } from "../Camera";
import { TOAST } from "../copy";
import { useExpression } from "../rig";

/**
 * Beat 8 · The email · 200 frames
 *
 * The core beat and the largest single allocation in the video. No cutaway, no cut — one
 * continuous camera move. The order is load-bearing and is what the frame numbers encode:
 *
 *   the toast lands and is read   f6 – f70    (at the CLOCK framing)
 *   HIS FACE FALLS                f70 – f86   (at the FACE framing)
 *   the bloom drifts              f104 + 39   (1.3s ease — it drifts, it does not snap)
 *   the stateline steps twice     f130, f156  (both under ONE raise)
 *   the trend climbs and recolours
 *
 * The toast stays up throughout.
 *
 * ══ THE ONE THING THE COMPONENT SWAP FORCED ═════════════════════════════════════════
 *
 * The sheet holds **clock + toast + face in one tight shot** and falls there. At the real
 * geometry that shot is 794.7 world px wide and his head lands at **63px** on a phone — against
 * the ~80px the register accepted and the ~100px the sheet quotes for the fall. The cause is
 * pure geometry and nothing to do with craft:
 *
 *   the clock is browser chrome at        y  58
 *   the real viewfinder is a card overlay at y 277   (the greybox drew it at y 200)
 *
 * Any shot holding both spans 399px of height, and 16:9 charges ~795px of width for it. Those
 * 77px are the entire difference, and they exist because the real page has a 64px app header, a
 * 32px main pad, a 44px session-readout row and the card's own 64px `pt-16` above the
 * viewfinder — all of which the greybox compressed.
 *
 * **So the beat's existing tight→wide move gains one more position rather than losing the
 * clock.** Three landings, one continuous move, still no cut — which is the sheet's own remedy
 * for exactly this class of problem, applied once more:
 *
 *   · **clock** (460.4 wide, f30–f68) — clock + toast. The toast is READ here.
 *   · **face**  (565.3 wide, f80–f118) — the toast still up, and his face. THE FALL happens here.
 *   · **wide**  (f150 on) — the whole card, the viewfinder, the toast still present. Both
 *     stateline changes happen here under one raise.
 *
 * It is strictly better than the greybox on both numbers the beat cares about:
 * **the clock reads at 25.7px instead of ~19, and the face falls at 88.7px instead of ~80.**
 * The clock, the toast and the viewfinder still share a right edge (1063 rather than 1176), so
 * the first two landings frame one vertical stack rather than three unrelated things.
 *
 * What is given up is unchanged from the sheet: at the wide framing the toast is present but
 * not readable. That is the right thing to lose — it was read seconds earlier at 4.2×, and
 * after that its only job is to still be up while the reading falls.
 *
 * **The emphasis raises ONCE**, at f142 as the camera lands wide, and that one raise carries
 * both copy changes (f150, f176) before settling at f194. No yo-yo — the hard constraint.
 */
export const Beat08Email: React.FC = () => {
  const frame = useCurrentFrame();

  // 1.3s, the component's own `transition: background 1.3s ease`. It starts as the camera
  // begins pulling out, so the drift is seen rather than spent behind a tight shot — the bloom
  // is not in either of the first two framings at all.
  const tension = useDrift(0, 1, 104);
  const climb = useDrift(0, 1, 116);

  /**
   * **THE FALL, as a keyframed transition rather than a state flip.** `falling` used to be a
   * *state* the face switched into, which is the thing the rig exists to make impossible: on a
   * face, a switch reads as a jump cut. It is 16 frames of continuous travel through the whole
   * pose vector at once — inner brow ends lifting, eyes widening, jaw slackening, head and
   * shoulders sinking — then a slower settle into `tense` under the second stateline change.
   *
   * He stops typing at f70 and does not start again in this beat. That is what makes beat 11's
   * "he never stopped working" land: there has to be something to resume.
   */
  const pose = useExpression([
    { frame: 0, state: "content" },
    { frame: 70, state: "content" },
    { frame: 86, state: "dismayed" },
    { frame: 110, state: "dismayed" },
    { frame: 148, state: "tense" },
  ]);

  // The real component's own bands and copy — `BAND_DISPLAY` in `use-monitoring-session.ts`.
  const band = frame >= 176 ? "tense" : frame >= 150 ? "a_little_tense" : "at_ease";

  const emphasis = useEmphasis([
    { frame: 0, up: 0 },
    { frame: 142, up: 0 },
    { frame: 158, up: 1 },
    { frame: 194, up: 1 },
    { frame: 200, up: 1 },
  ]);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // Continuity with beat 7's closing framing — the beats join on the same shot.
          { frame: 0, shot: COMPOSITE },
          { frame: 30, shot: BEAT8_CLOCK },
          // HOLD. The toast lands and is read, with the clock beside it.
          { frame: 68, shot: BEAT8_CLOCK },
          { frame: 80, shot: BEAT8_FACE },
          // HOLD. The whole fall (f70–f86) and its settle play inside this one.
          { frame: 118, shot: BEAT8_FACE },
          { frame: 150, shot: BEAT8_WIDE },
          { frame: 200, shot: BEAT8_WIDE },
        ]}
      >
        <MonitorPage
          clock={TOAST.clock}
          band={band}
          tension={tension}
          climb={climb}
          pose={pose}
          working={frame < 70}
          emphasis={emphasis}
          sessionFrom={47 * 60 + 16}
          // WORLD coordinates — an OS notification floats over the chrome and the page alike,
          // and the framing in `framing.ts` is derived from its world rect.
          overlay={<MailToast startFrame={6} />}
        />
      </Camera>
    </AbsoluteFill>
  );
};

/** Checked, not asserted — see the table in `framing.ts`. */
export const BEAT08_LEGIBILITY = { clock: PHONE.beat8Clock, face: PHONE.beat8Face };
