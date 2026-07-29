import React from "react";
import { AbsoluteFill } from "remotion";

import { Camera, frameRect, union } from "../Camera";
import { useLift } from "../lift";
import { CARD, MonitorSurface, VIEWFINDER } from "../surfaces";

/**
 * Beat 7 · Working, at ease · 0:46–0:50 · 120 frames
 *
 * The "before". The audience needs the settled state registered or the fall in
 * beat 8 has nothing to fall from.
 *
 * **The sub-line reads now, and the lift is why.** Revision 2 established that
 * holding bloom + stateline + viewfinder together means framing ~1056px of world,
 * at which the app's `text-base` (16px) sub is ~6px on a phone — and that the fix
 * was a separate landing on the stateline block, priced at ~1.5s. The lift is
 * cheaper because it needs no camera travel: the block grows 1.9× where it stands
 * while the camera holds the composite, which puts the 30px head at ~22px and the
 * 16px sub at ~12px. Cost: **zero seconds.** The lift and the settle both fit
 * inside the 4s the beat already had.
 *
 * This is the scale-in-place shape of the lift — see `lift.tsx`.
 */
export const Beat07AtEase: React.FC = () => {
  const lift = useLift(20, 16, 84, 16);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: frameRect(union(CARD, VIEWFINDER), 70) },
          { frame: 120, shot: frameRect(union(CARD, VIEWFINDER), 20) },
        ]}
      >
        <MonitorSurface
          clock="11:29 AM"
          tension={0}
          stateline="ease"
          climb={0}
          face="content"
          statelineLift={lift}
        />
      </Camera>
    </AbsoluteFill>
  );
};
