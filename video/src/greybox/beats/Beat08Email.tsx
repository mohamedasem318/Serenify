import React from "react";
import { AbsoluteFill } from "remotion";
import { useCurrentFrame } from "../../retime";

import { BEAT8_CLOCK, BEAT8_FACE, BEAT8_WIDE, COMPOSITE, PHONE } from "../../app/framing";
import { LITTLE_AT, MonitorPage, TENSE_AT } from "../../app/monitor";
import { useDrift, useReading } from "../../app/motion";
import { MailToast } from "../../app/toast";
import { Camera } from "../Camera";
import { TOAST } from "../copy";
import { useExpression } from "../rig";

/**
 * Beat 8 · The email · 184 frames
 *
 * The core beat and the largest single allocation in the video. No cutaway, no cut — one
 * continuous camera move. The order is load-bearing and is what the frame numbers encode:
 *
 *   the toast lands and is read   f6 – f70    (at the CLOCK framing)
 *   HIS FACE FALLS                f70 – f86   (at the FACE framing, toast still up)
 *   the toast dismisses           f104 + 13   (a slide-out, as the camera widens off it)
 *   the bloom drifts              f120 + 39   (1.3s ease — it drifts, it does not snap)
 *   the stateline steps twice     f142, f164  (inside the wide hold, camera stopped)
 *   the trend climbs and recolours
 *
 * ── THE FACE HELD FOR 32 FRAMES AFTER THE FALL HAD FINISHED ─────────────────────────
 *
 * The only cut in this beat, and it is the one place the beat sat still with nothing changing:
 * the fall finishes at f86, `dismayed` is then a **constant** pose until f140, and the camera did
 * not leave `BEAT8_FACE` until f118. So there were 32 settled frames on a face that had already
 * arrived, against a first half whose dead dwell runs 6 frames at the median. The camera leaves
 * at **f102** now — 16 frames of settle on the fall, which is the beat's own hold band — and
 * everything after it shifts by the same **−16**, so every gap in the third act is unchanged and
 * the drift, both copy changes and the trend's crossings keep their exact spacing.
 *
 * **Nothing that has to be READ is touched.** The toast keeps its whole 38-frame hold at the
 * clock framing — that is the film's only piece of arithmetic — and the second stateline change
 * keeps its 20 frames to the end of the beat.
 *
 * ══ THREE LANDINGS, ONE MOVE, AND THE CLOCK IS FINALLY WHOLE ════════════════════════
 *
 * The sheet holds **clock + toast + face in one tight shot** and falls there. The clock is
 * browser chrome at y 58 and the viewfinder is at y 212, so any shot holding both spans 335px of
 * height and 16:9 charges ~683px of width for it — at which the head falls at 74px on a phone,
 * under the ~80 the register accepted. So the beat's tight→wide move gains one more position
 * rather than losing the clock. Three landings, one continuous move, still no cut:
 *
 *   · **clock** (368 wide, f30–f68) — clock + toast. The toast is READ here.
 *   · **face**  (614 wide, f80–f102) — the toast still up, and his face. THE FALL happens here.
 *   · **wide**  (777 wide, f134 on) — the reading and his face. Both stateline changes happen
 *     here, on a camera that has stopped.
 *
 * ── THE CLOCK WAS BEING SLICED, AND IT IS THE DEFECT THIS BEAT TURNS ON ─────────────
 *
 * `geometry.ts` said the clock was at x 923–1063; `shell.tsx:84` **draws** it at 1036–1176. So
 * `BEAT8_CLOCK` framed 673–1133 and the render read **"11:30 A"** — the meridiem cut off the
 * number the entire beat asks the audience to subtract from. Geometry follows the drawing now,
 * and the whole right-hand stack (clock, toast, viewfinder) shares 1176 again, which is the
 * sheet's own relationship and makes the first two landings one vertical stack rather than
 * three unrelated things.
 *
 * The numbers both improve: **the clock reads at 32.1px on a phone (was 25.7, and sliced), and
 * the face falls at 82.3px** (was 88.7).
 *
 * ── AND THE TOAST LEAVES RATHER THAN RIDING INTO THE WIDE SHOT ──────────────────────
 *
 * Pinned at y 96–200, the toast in the wide phase's union would push that shot from 777 to 1033
 * world px, taking the stateline's sub from 9.2px on a phone to 6.9 — under the floor, in the
 * shot the beat exists to deliver. A macOS banner auto-dismisses, so it does: a real slide-out
 * on the entrance's own curve, at f120, as the camera widens off it. **L2 is not spent by this**
 * — L2 is "you watch his face fall while the toast is up", and the fall is over at f86.
 */
/**
 * ── THE ESCALATION HAPPENS ON A HELD FRAME, WHICH IS L14's RETIMING ─────────────────
 *
 * Everything the beat's third act does — the drift, both stateline changes, the raise — used to
 * happen while the camera was still travelling, or before it had arrived:
 *
 * · the drift ran f116–f155 and the bloom did not enter the frame until ~f141;
 * · the first copy change landed at f138, twelve frames before the camera stopped at f150;
 * · **the raise fired while the shot was still pushing in**, so the block growing and the frame
 *   tightening cancelled and the film's central device read as softer than it is.
 *
 * The camera's three landings are unchanged in shape and unchanged in duration. What moved is
 * everything that happens at the third one, twenty frames later, so that it happens *inside the
 * hold*:
 *
 *   f102 – f134  the move out to `BEAT8_WIDE`. The toast slides out at f104 (see below).
 *   f134         the camera STOPS, and does not move again in this beat.
 *   f120 – f159  the bloom's 1.3s drift. The bloom is fully framed from ~f125, so five sixths
 *                of it plays in shot; starting it after the camera settles would put the
 *                escalation's first move a full second after the fall's last.
 *   f142         "A bit of an edge lately".
 *   f164         "This has held a while…".
 *
 * ── AND THE RAISE IS GONE — L15 ─────────────────────────────────────────────────────
 *
 * The stateline emphasis fired here on the first copy change and settled on the second, and its
 * justification was legibility: at the old 884.8-wide composite the 17px sub read at 8.11px on a
 * phone and the raise carried it to 10.13. At L16's 927 composite the HEAD reads at 16.4px and
 * the sub at 7.74, and the device would be growing a line that is already as legible as the shot
 * can make it — while costing 70px of card the trend now uses.
 *
 * **The one thing this beat loses with it is worth naming.** The raise was also directing the eye
 * at the moment the reading changed, and both of this beat's changes happen inside a static wide
 * hold on copy that differs by a few words. What carries them instead is the order the beat
 * already had: the bloom drifts first, then the head changes, then it changes again — three
 * separate movements in a frame where nothing else is moving. If the escalation ever reads as
 * easy to miss, the emphasis is the fix and it comes back for THIS transition only.
 */
export const Beat08Email: React.FC = () => {
  const frame = useCurrentFrame();

  // 1.3s, the component's own `transition: background 1.3s ease`. It begins as the camera is
  // arriving, so nearly all of the drift plays with the bloom in frame — which is the whole
  // point of the sheet keeping the drift rather than snapping the band.
  const tension = useDrift(0, 1, 120);

  /**
   * ── THE READING, AND IT IS ONE NUMBER NOW ──────────────────────────────────────────
   *
   * The stateline's two copy changes and the trend's climb used to be two separate authorings —
   * `frame >= 158 / >= 180` against `useDrift(0, 1, 146)` — and they did not agree: the trend's
   * own band crossings landed at ≈f162 and ≈f169, seven frames apart, so the graph crossed both
   * thresholds in a quarter of a second while the copy was still on its first change. That is the
   * *"starts already elevated and steps once"* reading. Full account in `monitor.tsx` § ONE
   * READING, READ TWICE.
   *
   * The keys are placed **on** the band thresholds, so the crossings ARE the sheet's frames. They
   * moved with the beat's third act (−16) and their spacing is untouched, which is what keeps the
   * sync the retime is not allowed to spend:
   *
   *   f120        0.00          the escalation starts as the bloom does
   *   f141        just under    still "at ease" — the graph is climbing inside the band
   *   f142        LITTLE_AT     → "A bit of an edge lately", on the exact frame
   *   f163        just under    still "a bit of an edge" — still climbing
   *   f164        TENSE_AT      → "This has held a while…", on the exact frame
   *   f184        1.00          the beat ends at the top of the reading
   *
   * So the graph WALKS at ease → a little tense → tense and arrives at each band on the frame the
   * copy does, instead of jumping two bands between them.
   */
  const level = useReading([
    { frame: 120, level: 0 },
    { frame: 141, level: LITTLE_AT - 0.01 },
    { frame: 142, level: LITTLE_AT },
    { frame: 163, level: TENSE_AT - 0.02 },
    { frame: 164, level: TENSE_AT },
    { frame: 184, level: 1 },
  ]);

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
    { frame: 124, state: "dismayed" },
    // The settle into `tense` finishes under the second stateline change, which is what makes
    // the copy and the face read as one event rather than two.
    { frame: 164, state: "tense" },
  ]);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // Continuity with beat 7's closing framing — the beats join on the same shot.
          { frame: 0, shot: COMPOSITE },
          { frame: 30, shot: BEAT8_CLOCK },
          // HOLD. The toast lands and is read, with the clock beside it — whole, this time.
          { frame: 68, shot: BEAT8_CLOCK },
          { frame: 80, shot: BEAT8_FACE },
          // HOLD. The whole fall (f70–f86) plays inside this one, with 16 frames of settle on it.
          { frame: 102, shot: BEAT8_FACE },
          { frame: 134, shot: BEAT8_WIDE },
          // HOLD, to the end. The drift and both copy changes all happen here.
          { frame: 184, shot: BEAT8_WIDE },
        ]}
      >
        <MonitorPage
          clock={TOAST.clock}
          // `peak` defaults to `level`, which is right here: the session is at its highest the
          // whole way up. Beat 11 is where the two part company.
          level={level}
          tension={tension}
          pose={pose}
          working={frame < 70}
          sessionFrom={47 * 60 + 16}
          // WORLD coordinates — an OS notification floats over the chrome and the page alike,
          // and the framing in `framing.ts` is derived from its world rect.
          //
          // It leaves at f104, as the camera starts widening, and is gone by f117 — see
          // `toast.tsx` § dismissFrom. The fall is over; keeping it would cost the stateline
          // 2.3px of phone legibility in the shot the beat exists to deliver.
          overlay={<MailToast startFrame={6} dismissFrom={104} />}
        />
      </Camera>
    </AbsoluteFill>
  );
};

/** Checked, not asserted — see the table in `framing.ts`. */
export const BEAT08_LEGIBILITY = { clock: PHONE.beat8Clock, face: PHONE.beat8Face };
