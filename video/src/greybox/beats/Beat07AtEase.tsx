import React from "react";
import { AbsoluteFill } from "remotion";

import { COMPOSITE, PHONE } from "../../app/framing";
import { MonitorPage } from "../../app/monitor";
import { useEmphasis } from "../../app/motion";
import { Camera } from "../Camera";
import { useExpression } from "../rig";

/**
 * Beat 7 · Working, at ease · 120 frames
 *
 * The "before". The audience needs the settled state registered or the fall in beat 8 has
 * nothing to fall from.
 *
 * ── WHAT THE COMPONENT SWAP CHANGED HERE ────────────────────────────────────────────
 *
 * The greybox framed **~1096 world px** to hold bloom + stateline + viewfinder together,
 * because it drew the viewfinder as a separate 320-wide panel 300px to the right of a
 * 700-wide card. The real viewfinder is an `absolute … z-10` overlay INSIDE the stage card
 * (`monitoring-session.tsx:805`), so the three things sit in a far tighter union and the
 * composite is **{@link COMPOSITE}.w = 760** — a 1.58× push-in rather than a 1.09× one.
 *
 * Everything follows from that, and all of it is an improvement:
 *
 *  · The 17px sub lands at 9.4px on a phone instead of 6.5px.
 *  · **The emphasis therefore yields from 1.65× to 1.25×** — register item 3. At the real
 *    spacing (register item 2 — nothing is padded here, the card is the product's own
 *    `min-h-[480px] … px-10 pb-10 pt-16`) a 1.65× block would run through the Pause/End
 *    controls at y 684.5 and out of the frame's bottom edge. At 1.25× it finishes 11.1px
 *    clear of the controls, and the sub reads at 11.8px — better than the greybox managed
 *    with the larger factor. The device survives as grammar; only its amplitude yields.
 *  · His head is ~66px on a phone here, against the ~50px the sheet recorded.
 *
 * **The emphasis still cannot cover the bloom, and now it cannot by construction rather than
 * by arrangement.** It grows downward from the stateline block's own top edge, so the top
 * never moves; the real `mt-6` puts 24px between the bloom's bottom and that edge and nothing
 * in the video is allowed to spend it.
 *
 * The page sits at `SCROLL.monitor` = 32px. That is not a device — the real monitoring page is
 * ~973px tall below the chrome against a 583px viewport, so it scrolls in the product too. 32
 * is the intersection of two measured constraints: below it the stateline's sub is clipped by
 * the viewport bottom, above it the sticky header swallows the `Session · 47:12` readout.
 */
export const Beat07AtEase: React.FC = () => {
  // The block goes up, is read, and settles HERE — beat 8 raises its own, once, covering both
  // of its copy changes. The join was tried and the framing does not allow it.
  const emphasis = useEmphasis([
    { frame: 0, up: 0 },
    { frame: 18, up: 0 },
    { frame: 36, up: 1 },
    { frame: 96, up: 1 },
    { frame: 114, up: 0 },
  ]);

  // Content throughout. This is the face beat 8 has to fall FROM, so it is held rather than
  // played. He is working — gaze down at the keyboard, the shoulders carrying the typing.
  const pose = useExpression([{ frame: 0, state: "content" }]);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: { ...COMPOSITE, w: COMPOSITE.w + 90 } },
          { frame: 120, shot: COMPOSITE },
        ]}
      >
        <MonitorPage
          clock="11:30 AM"
          band="at_ease"
          tension={0}
          climb={0}
          pose={pose}
          working
          emphasis={emphasis}
        />
      </Camera>
    </AbsoluteFill>
  );
};

/** Legibility, checked rather than asserted. See `framing.ts` for the table this feeds. */
export const BEAT07_LEGIBILITY = PHONE.composite;
