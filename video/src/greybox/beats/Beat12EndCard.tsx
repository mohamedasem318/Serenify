import React from "react";
import { AbsoluteFill } from "remotion";

import { Camera, shot } from "../Camera";
import { END_CARD } from "../copy";
import { GREY } from "../theme";
import { Box, Text, useFade } from "../ui";

/**
 * Beat 12 · End card · 1:03–1:08 · 150 frames
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
    <Camera keys={[{ frame: 0, shot: shot(960, 520, 1200) }]}>
      <Box x={0} y={0} w={1920} h={1080} fill={GREY.page} border={GREY.page} radius={0} />

      <div style={{ opacity: useFade(0, 18) }}>
        <Box x={780} y={352} w={360} h={92} label="wordmark" labelSize={16} fill={GREY.panelAlt} radius={10} />
      </div>

      <Text x={460} y={548} w={1000} size={54} weight={700} align="center" opacity={useFade(28, 12)}>
        {END_CARD.line}
      </Text>
      <Text
        x={460}
        y={648}
        w={1000}
        size={34}
        align="center"
        color={GREY.body}
        opacity={useFade(52, 12)}
        mono
      >
        {END_CARD.domain}
      </Text>
    </Camera>
  </AbsoluteFill>
);
