import React from "react";
import { AbsoluteFill } from "remotion";

import { Camera, shot } from "../Camera";
import { AppHeader, Desktop } from "../chrome";
import { DASHBOARD } from "../copy";
import { COL_W, COL_X, GREY } from "../theme";
import { Box, Button, Cursor, Text, TextBlock, useFade } from "../ui";

/**
 * Beat 3 · Dashboard, first arrival · 0:16–0:20 · 120 frames
 *
 * Brief wide to establish the shell — sticky header, wordmark, the 1152px
 * column floating in wide gutters — then push in on the two banners.
 *
 * The calibration banner really does pop in post-hydration with no transition,
 * which the sheet flags as possibly reading like a glitch on video. It is faded
 * here over 6 frames: at 30fps an instant appearance genuinely does read as a
 * dropped frame rather than as an interface.
 */
export const Beat03Dashboard: React.FC = () => {
  const banner = useFade(14, 6);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: shot(960, 560, 1880) },
          { frame: 26, shot: shot(960, 560, 1880) },
          { frame: 96, shot: shot(960, 322, 800) },
        ]}
      >
        <Desktop clock="10:23 AM" url="serenify.tech/app">
          <AppHeader />

          {/*
           * Banner CONTENTS are centred, where the real banners are left-aligned
           * against the 1152px column. A greybox change, made for a reason worth
           * carrying into the real cut: at a framing tight enough to read a
           * 20px line on a phone, the camera sees ~800px of world, and copy
           * pinned to the left edge of a 1152px banner falls outside it. Either
           * the copy moves inward or the beat is unreadable.
           */}
          <Box x={COL_X} y={200} w={COL_W} h={80} fill={GREY.surface} border={GREY.border} radius={12} />
          <Text x={560} y={216} w={800} size={26} weight={700} align="center">
            {DASHBOARD.welcomeTitle}
          </Text>
          <Text x={560} y={252} w={800} size={17} align="center" color={GREY.body}>
            {DASHBOARD.welcomeBody}
          </Text>

          {/* Calibration banner — foggy-tinted in the app; a flatter grey here. */}
          <div style={{ opacity: banner }}>
            <Box
              x={COL_X}
              y={296}
              w={COL_W}
              h={148}
              fill={GREY.panelAlt}
              border={GREY.graphite}
              radius={12}
            />
            <Text x={610} y={316} w={700} size={20} align="center" color={GREY.ink} lineHeight={1.4}>
              {DASHBOARD.calibrationBanner}
            </Text>
            <Button x={860} y={382} w={200} h={44} size={16}>
              {DASHBOARD.setBaseline}
            </Button>
          </div>

          {/* The rest of the dashboard exists and is never read. */}
          <Box x={COL_X} y={476} w={560} h={280} label="today" fill={GREY.surface} />
          <TextBlock x={COL_X + 28} y={534} w={430} lines={4} />
          <Box x={COL_X + 592} y={476} w={560} h={280} label="trend" fill={GREY.surface} />
          <TextBlock x={COL_X + 620} y={534} w={430} lines={4} />

          <Cursor x={1022} y={398} clickAt={106} opacity={banner} />
        </Desktop>
      </Camera>
    </AbsoluteFill>
  );
};
