import React from "react";
import { AbsoluteFill } from "remotion";

import { Camera, frameRect, union } from "../Camera";
import { CARD, MonitorSurface, VIEWFINDER } from "../surfaces";

/**
 * Beat 7 · Working, at ease · 0:38–0:42 · 120 frames
 *
 * The "before". The audience needs the settled state registered or the fall in
 * beat 8 has nothing to fall from.
 *
 * THE SUB-LINE STILL DOES NOT READ, and at this framing it cannot.
 *
 * The narrower viewport helped a lot — the stateline head is `text-3xl` (30px)
 * and now lands at roughly 13px on a phone, comfortably legible where it was 7px
 * before. But the sub is `text-base` (16px), and the beat is specified as "wide
 * enough to hold bloom, stateline and viewfinder together". That composite spans
 * the reading card plus the right rail, about 1036px of world, so the tightest
 * framing that holds all three whole is ~1076 wide — and 16px at that framing is
 * about 6px on a phone.
 *
 * Reading it would need its own landing on the stateline block (the block is
 * only 400 wide, so a ~470 framing puts the sub at ~14px), which means a second
 * move and roughly 1.5s more. That is a beat-sheet decision, not a greybox one,
 * so the beat is built as written and this is the flag.
 */
export const Beat07AtEase: React.FC = () => (
  <AbsoluteFill>
    <Camera
      keys={[
        { frame: 0, shot: frameRect(union(CARD, VIEWFINDER), 70) },
        { frame: 120, shot: frameRect(union(CARD, VIEWFINDER), 20) },
      ]}
    >
      <MonitorSurface clock="11:29 AM" tension={0} stateline="ease" climb={0} face="content" />
    </Camera>
  </AbsoluteFill>
);
