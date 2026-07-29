import React from "react";
import { AbsoluteFill } from "remotion";

import { Camera, shot } from "../Camera";
import { END_CARD } from "../copy";
import { GREY, H, W } from "../theme";
import { Box, Text, useFade } from "../ui";

/**
 * Beat 12 · End card · 1:04–1:09 · 150 frames
 *
 * The wordmark, then the two lines, then hold. The VO lands its last line here,
 * so the hold is deliberately long and is not dead air — it is room in the cut.
 *
 * The wordmark is a labelled rectangle like everything else in this pass; the
 * real component already renders correctly in this project (PR #223) and gets
 * swapped in later.
 */
export const Beat12EndCard: React.FC = () => (
  <AbsoluteFill>
    <Camera keys={[{ frame: 0, shot: shot(W / 2, 310, 760) }]}>
      <Box x={0} y={0} w={W} h={H} fill={GREY.page} border={GREY.page} radius={0} />

      <div style={{ opacity: useFade(0, 18) }}>
        <Box x={490} y={216} w={220} h={56} label="wordmark" labelSize={11} fill={GREY.panelAlt} radius={8} />
      </div>

      <Text x={300} y={322} w={600} size={34} weight={700} align="center" opacity={useFade(28, 12)}>
        {END_CARD.line}
      </Text>
      <Text x={300} y={382} w={600} size={20} align="center" color={GREY.body} opacity={useFade(52, 12)} mono>
        {END_CARD.domain}
      </Text>
    </Camera>
  </AbsoluteFill>
);
