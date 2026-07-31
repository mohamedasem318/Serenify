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
 *   HIS FACE FALLS                f70 – f86   (at the FACE framing, toast still up)
 *   the toast dismisses           f120 + 13   (a slide-out, as the camera widens off it)
 *   the bloom drifts              f136 + 39   (1.3s ease — it drifts, it does not snap)
 *   the stateline steps twice     f158, f180  (the raise fires on the first, settles on the second)
 *   the trend climbs and recolours
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
 *   · **face**  (614 wide, f80–f118) — the toast still up, and his face. THE FALL happens here.
 *   · **wide**  (777 wide, f150 on) — the reading and his face. Both stateline changes happen
 *     here, under one raise, on a camera that has stopped.
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
 *   f118 – f150  the move out to `BEAT8_WIDE`. The toast slides out at f120 (see below).
 *   f150         the camera STOPS, and does not move again in this beat.
 *   f136 – f175  the bloom's 1.3s drift. The bloom is fully framed from ~f141, so five sixths
 *                of it plays in shot; starting it after the camera settles would put the
 *                escalation's first move a full second after the fall's last.
 *   f158         "A bit of an edge lately" — and the raise begins ON it.
 *   f180         "This has held a while…" — and the raise SETTLES as it lands.
 *
 * ── AND THE RAISE IS A FULL 1.25× ON BOTH COPIES NOW ────────────────────────────────
 *
 * This is what L14 was for. The `tense` sub wraps to two lines, and at the old layout a two-line
 * block had 94px of room for 93px of block: `emphasisCapFor(2)` returned **1.01**, so the film's
 * most important reading got no device at all, and the beat had to dress the collapse up as the
 * firing. With the sub reserving two lines and the controls 70px below it, the cap is **1.25 on
 * every band** — so the factor is a constant and the interpolation that used to hide the
 * shortfall is gone.
 *
 * The rule the raise obeys is unchanged and is the whole reason the device is grammar rather
 * than decoration: **it begins on a copy change, it grows once, and it never yo-yos.** It rises
 * on the first change and settles on the second, so both changes carry movement and neither
 * carries a second growth.
 */
export const Beat08Email: React.FC = () => {
  const frame = useCurrentFrame();

  // 1.3s, the component's own `transition: background 1.3s ease`. It begins as the camera is
  // arriving, so nearly all of the drift plays with the bloom in frame — which is the whole
  // point of the sheet keeping the drift rather than snapping the band.
  const tension = useDrift(0, 1, 136);
  const climb = useDrift(0, 1, 146);

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
    { frame: 140, state: "dismayed" },
    // The settle into `tense` finishes under the second stateline change, which is what makes
    // the copy and the face read as one event rather than two.
    { frame: 180, state: "tense" },
  ]);

  // The real component's own bands and copy — `BAND_DISPLAY` in `use-monitoring-session.ts`.
  // Both changes land INSIDE the camera's third hold (f150 on), which is the retiming.
  const band = frame >= 180 ? "tense" : frame >= 158 ? "a_little_tense" : "at_ease";

  /**
   * The raise begins **on** the first copy change at f158, reaches full at f174, holds through
   * the second change at f180 and settles by f196. One growth, two changes, no yo-yo — and both
   * at the full 1.25×, which is what L14 bought back.
   */
  const emphasis = useEmphasis([
    { frame: 0, up: 0 },
    { frame: 158, up: 0 },
    { frame: 174, up: 1 },
    { frame: 180, up: 1 },
    { frame: 196, up: 0 },
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
          // HOLD. The whole fall (f70–f86) and its settle play inside this one.
          { frame: 118, shot: BEAT8_FACE },
          { frame: 150, shot: BEAT8_WIDE },
          // HOLD, to the end. Drift, both copy changes and the raise all happen here.
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
          //
          // It leaves at f120, as the camera starts widening, and is gone by f133 — see
          // `toast.tsx` § dismissFrom. The fall is over; keeping it would cost the stateline
          // 2.3px of phone legibility in the shot the beat exists to deliver.
          overlay={<MailToast startFrame={6} dismissFrom={120} />}
        />
      </Camera>
    </AbsoluteFill>
  );
};

/** Checked, not asserted — see the table in `framing.ts`. */
export const BEAT08_LEGIBILITY = { clock: PHONE.beat8Clock, face: PHONE.beat8Face };
