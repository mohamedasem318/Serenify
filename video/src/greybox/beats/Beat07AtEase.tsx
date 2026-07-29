import React from "react";
import { AbsoluteFill } from "remotion";

import { Camera, shot } from "../Camera";
import { MonitorSurface } from "../surfaces";

/**
 * Beat 7 · Working, at ease · 0:36–0:40 · 120 frames
 *
 * The "before". The audience needs the settled state registered or the fall in
 * beat 8 has nothing to fall from.
 *
 * TENSION IN THE SHEET, built as written and flagged rather than fixed: this
 * beat is specified as "wide enough to hold bloom, stateline and viewfinder
 * together", which puts it at odds with the governing rule that every readable
 * moment is a push-in. A framing that holds all three cannot be tighter than
 * ~1400px of world, and at that zoom the stateline's second line and the face
 * label sit below phone legibility. The gentle push below is as far in as the
 * composite allows.
 */
export const Beat07AtEase: React.FC = () => (
  <AbsoluteFill>
    <Camera
      keys={[
        { frame: 0, shot: shot(960, 500, 1760) },
        { frame: 120, shot: shot(960, 466, 1420) },
      ]}
    >
      <MonitorSurface clock="11:29 AM" tension={0} stateline="ease" climb={0} face="content" />
    </Camera>
  </AbsoluteFill>
);
