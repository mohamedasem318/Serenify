import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { BEAT8_CLOCK, BEAT8_FACE, BEAT8_WIDE, COMPOSITE, PHONE } from "../../app/framing";
import { emphasisCapFor } from "../../app/geometry";
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
 *   the bloom drifts              f116 + 39   (1.3s ease — it drifts, it does not snap)
 *   the stateline steps twice     f138, f164  (the raise fires on the first, settles on the second)
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
 * **The emphasis raises ON the first copy change and settles as the second lands.** It never
 * grows twice, which is the hard constraint — see the note beside `emphasisFactor` for why the
 * settle is what makes the second change readable, and why the two-line `tense` copy cannot be
 * held raised at this layout.
 */
/**
 * ── THE ESCALATION IS TIGHTER, AND THE DRIFT IS NOW SEEN ────────────────────────────
 *
 * Two things were wrong with the old clock and they were the same thing twice: **the reading
 * changed while nobody could see it.**
 *
 * · The bloom's 1.3s drift ran f104–f143, and the bloom does not enter the frame until the
 *   camera has widened to about f128 — so the audience met an already-amber bloom and the
 *   sheet's "let it drift, don't snap" was spent off screen. It starts at f116 now and its last
 *   two thirds play in frame.
 * · The stateline changed at f150 and f176 while the beat header, and the sheet, both said f130
 *   and f156. The code had drifted twenty frames later than the plan and nobody had noticed,
 *   which put a dead second between the fall settling and anything else moving.
 *
 * f138 is the earliest the stateline is genuinely INSIDE the frame — checked against the camera
 * rather than assumed. The move to `BEAT8_WIDE` runs f118–f150 on an in-out cubic, and the
 * stateline block (y 581–648.5 at this scroll) first clears the frame's bottom edge at about
 * f135. So the changes land at **f138 and f164**, twelve frames earlier each, with the drift
 * beginning at f116.
 */
export const Beat08Email: React.FC = () => {
  const frame = useCurrentFrame();

  // 1.3s, the component's own `transition: background 1.3s ease`. It begins as the camera starts
  // widening, so the last two thirds of the drift play with the bloom in frame — which is the
  // whole point of the sheet keeping the drift rather than snapping the band.
  const tension = useDrift(0, 1, 116);
  const climb = useDrift(0, 1, 126);

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
    { frame: 104, state: "dismayed" },
    { frame: 140, state: "tense" },
  ]);

  // The real component's own bands and copy — `BAND_DISPLAY` in `use-monitoring-session.ts`.
  const band = frame >= 164 ? "tense" : frame >= 138 ? "a_little_tense" : "at_ease";

  /**
   * ── THE EMPHASIS FIRES ON EACH CHANGE, AND IT IS THE TIMING THAT REGRESSED ─────────
   *
   * The device's whole claim is that when the block moves, the reading changed — so the movement
   * has to be CAUSED by the change, not merely near it. The previous cut raised the block at
   * f142, eight frames before the first copy change and while the camera was still arriving, and
   * then never settled: one movement, attached to nothing, and the second change at f176 carried
   * no movement at all. That is what "it only fires on the first" was describing.
   *
   * The raise now begins **on** the first change, at f138.
   */
  const emphasis = useEmphasis([
    { frame: 0, up: 0 },
    { frame: 138, up: 0 },
    { frame: 154, up: 1 },
    { frame: 200, up: 1 },
  ]);

  /**
   * ── AND THE SECOND CHANGE CARRIES MOVEMENT BECAUSE THE FACTOR YIELDS ──────────────
   *
   * `tense`'s sub wraps to two lines, and a two-line block cannot be raised at this layout
   * without either leaving the viewport or landing on the Pause/End controls — the arithmetic is
   * scroll-invariant and is in `emphasisCapFor`. Rather than slicing a line or abandoning the
   * device, the factor is what yields: the cap for a one-line sub is L12's 1.25×, the cap for a
   * two-line one is 1.01×, and the block SETTLES into the tense reading as it lands.
   *
   * That is not the device failing quietly. Both copy changes now carry movement — a rise on the
   * first, a settle on the second — and it is not a yo-yo, because it never grows again. The
   * cost is that `tense` is read at its natural size, which is the honest consequence of the
   * layout and is the measured case for §7's Pass-B rearrangement.
   */
  const emphasisFactor = interpolate(frame, [164, 180], [emphasisCapFor(1), emphasisCapFor(2)], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

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
          emphasisFactor={emphasisFactor}
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
