import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { Camera, shot } from "../Camera";
import { CLOSING_LINE } from "../copy";
import { FONT, GREY, H, W } from "../theme";
import { Box, Text } from "../ui";

/**
 * Beat 12 · The closing subtitle card · 1:13 – 1:16 · 90 frames
 *
 * NEW IN REVISION 4. A short card between the demo resolving and the wordmark.
 *
 * **What it is for.** The reading came back down because *he was asked and he
 * answered.* The confirmatory step is the thesis of the whole project — the model
 * does not decide alone — and the video demonstrates it across beats 8, 9 and 11
 * without ever naming it. This names it, once, as the last idea the audience leaves
 * with.
 *
 * **It is its own beat, not a line inside the end card.** The end card already runs
 * three timed events plus a hold; a fourth makes it a wall of text.
 *
 * **The copy is a PLACEHOLDER at the right length** — see `CLOSING_LINE` in
 * `copy.ts` for the two constraints on the real line and why the candidates are in
 * the revision report rather than here. What this pass tests is the pacing into the
 * end card: does a single held line here land, or does it stall the ending.
 *
 * Deliberately NOT typed on. The end card types twice; a third typing effect in
 * eight seconds is a tic, and this line wants to arrive whole and be sat with.
 *
 * Framed at 760 so a 30px line reads at ~17px on a phone — the same framing as the
 * end card, so the two cards feel like one closing movement rather than two designs.
 */

const LINE = { x: 220, y: 300, w: 760 } as const;

export const Beat12Closing: React.FC = () => {
  const frame = useCurrentFrame();

  const appear = interpolate(frame, [4, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const leave = interpolate(frame, [70, 86], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  // A few pixels of rise with the fade. Enough that the line arrives rather than
  // switches on; not enough to read as a slide.
  const rise = interpolate(appear, [0, 1], [10, 0]);

  return (
    <AbsoluteFill>
      <Camera keys={[{ frame: 0, shot: shot(W / 2, LINE.y + 24, 760) }]}>
        <Box x={0} y={0} w={W} h={H} fill={GREY.page} border={GREY.page} radius={0} />

        <div style={{ opacity: Math.min(appear, leave), translate: `0px ${rise}px` }}>
          <Text
            x={LINE.x}
            y={LINE.y}
            w={LINE.w}
            size={30}
            weight={700}
            align="center"
            lineHeight={1.35}
            style={{ fontFamily: FONT }}
          >
            {CLOSING_LINE}
          </Text>
        </div>
      </Camera>
    </AbsoluteFill>
  );
};
