import React from "react";
import { AbsoluteFill } from "remotion";

import { Camera } from "../Camera";
import { useEmphasis } from "../lift";
import { useExpression } from "../rig";
import { monitorWide, MonitorSurface } from "../surfaces";

/**
 * Beat 7 · Working, at ease · 0:46–0:50 · 120 frames
 *
 * The "before". The audience needs the settled state registered or the fall in
 * beat 8 has nothing to fall from.
 *
 * **The sub-line reads, and the in-place emphasis (L12) is why.** Holding bloom +
 * stateline + viewfinder together means framing ~1096px of world, at which the
 * app's `text-base` (16px) sub is ~6px on a phone. The alternative — a separate
 * landing on the block — was priced at ~1.5s. The emphasis is free because it needs
 * **no camera travel**: the block grows 1.65× where it stands while the camera holds
 * the composite, putting the 30px head at ~19px and the 16px sub at ~10px.
 *
 * **IT SETTLES HERE, AND BEAT 8 RAISES ITS OWN.** The intent was to hand the raised
 * block across the cut so it never yo-yos — but beat 8's push-in on the toast frames
 * from world x 708, and the raised block's right edge is at x 800, so a raised block
 * put 92px of panel and the sliced word "now" inside the beat's single most important
 * shot. The framing does not allow the join, so the join is not forced: this beat
 * raises and settles, beat 8 raises once and covers BOTH of its copy changes with
 * that one raise, which is the constraint that actually matters.
 *
 * The clock reads 11:30 (was 11:29). 10:43 + `47:12` is 11:30:12, so 11:29 was the
 * drift, not the session timer.
 */
export const Beat07AtEase: React.FC = () => {
  const emphasis = useEmphasis(20, 18, 86, 16);
  // Content throughout, and this is the face beat 8 has to fall FROM, so it is held
  // rather than played. He is working: hands going, gaze down at the keyboard.
  const pose = useExpression([{ frame: 0, state: "content" }]);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: monitorWide(70) },
          { frame: 120, shot: monitorWide(20) },
        ]}
      >
        <MonitorSurface
          clock="11:30 AM"
          tension={0}
          stateline="ease"
          climb={0}
          pose={pose}
          working
          emphasis={emphasis}
        />
      </Camera>
    </AbsoluteFill>
  );
};
