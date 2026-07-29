import React from "react";
import { AbsoluteFill } from "remotion";

import { Camera, shot } from "../Camera";
import { Desktop, PublicNav } from "../chrome";
import { LANDING } from "../copy";
import { COL_X, GREY, VIEWPORT_Y } from "../theme";
import { Box, Button, Text, TextBlock } from "../ui";

/**
 * Beat 1 · Cold open — `serenify.tech` · 0:00–0:04 · 120 frames
 *
 * The only job is *this is deployed*: a real site at a real domain. So the
 * address bar is the payload of the wide, and the push toward the hero is slow
 * — hold the wide just long enough to register, then move.
 */
export const Beat01ColdOpen: React.FC = () => (
  <AbsoluteFill>
    <Camera
      keys={[
        { frame: 0, shot: shot(960, 560, 1900) },
        { frame: 34, shot: shot(960, 560, 1900) },
        { frame: 118, shot: shot(960, 462, 1160) },
      ]}
    >
      <Desktop clock="10:20 AM" url="serenify.tech">
        <PublicNav />

        <Text x={480} y={VIEWPORT_Y + 176} w={960} size={58} weight={700} align="center" lineHeight={1.16}>
          {LANDING.headlineLead}
          <br />
          <span style={{ color: GREY.graphite }}>{LANDING.headlineAccent}</span>
        </Text>

        <Text x={550} y={VIEWPORT_Y + 330} w={820} size={21} align="center" color={GREY.body}>
          {LANDING.lede}
        </Text>

        <Text x={610} y={VIEWPORT_Y + 428} w={700} size={16} align="center" color={GREY.label}>
          {LANDING.dataLine}
        </Text>

        <Button x={760} y={VIEWPORT_Y + 486} w={200}>
          {LANDING.ctaPrimary}
        </Button>
        <Button x={980} y={VIEWPORT_Y + 486} w={230} filled={false}>
          {LANDING.ctaSecondary}
        </Button>

        {/* Below the fold: the rest of the page exists, is never read. */}
        <Box x={COL_X} y={VIEWPORT_Y + 590} w={1152} h={340} label="hero product shot" fill={GREY.panelAlt} />
        <TextBlock x={COL_X + 60} y={VIEWPORT_Y + 660} w={520} lines={5} />
      </Desktop>
    </Camera>
  </AbsoluteFill>
);
