import React from "react";
import { AbsoluteFill } from "remotion";

import { Camera, shot } from "../Camera";
import { AppHeader, Desktop } from "../chrome";
import { DASHBOARD, LATER } from "../copy";
import { COL_W, COL_X, GREY, H, W } from "../theme";
import { Box, Button, Cursor, Text, TextBlock, useFade } from "../ui";

/**
 * Beat 6 · "Later" · 0:36–0:38 · 60 frames
 *
 * Back on `/app` with the calibration banner gone, then the time jump.
 *
 * THE TIME-JUMP LINE IS NOW LOUD. Revision 1 set it small, low-contrast and
 * lower-third, in the app's own type, and it was easy to miss entirely — which
 * defeats the only thing it exists to do. It is now 44px, ink-on-page, and sits
 * in the lower third of the *frame* rather than the bottom of the page.
 *
 * This is not a caption system. On-screen text gets a proper treatment in a
 * later pass, once the framing has settled; this is one line made visible.
 *
 * The text/no-text variants are gone — the text version is the one that stays.
 */
export const Beat06Later: React.FC = () => {
  const later = useFade(26, 10);

  return (
    <AbsoluteFill>
      {/*
       * Locked on the full frame. Any tighter framing slices the welcome
       * banner's copy at the left edge — it is 1152 wide inside a 1200 viewport,
       * so there is nothing to push to. At full frame the 44px time-jump line
       * still lands at ~15px on a phone, which is the point of making it loud.
       */}
      <Camera keys={[{ frame: 0, shot: shot(W / 2, H / 2, W) }]}>
        <Desktop clock="10:43 AM" url="serenify.tech/app">
          <AppHeader />

          <Box x={COL_X} y={166} w={COL_W} h={66} fill={GREY.surface} border={GREY.border} radius={10} />
          <Text x={COL_X + 24} y={178} size={24} weight={700}>
            {DASHBOARD.welcomeTitle}
          </Text>
          <Text x={COL_X + 24} y={210} size={14} color={GREY.body}>
            {DASHBOARD.welcomeBody}
          </Text>

          {/* No calibration banner — it is gone, and its absence is the point. */}
          <Box x={COL_X} y={250} w={COL_W} h={150} label="today" fill={GREY.surface} />
          <TextBlock x={COL_X + 24} y={292} w={480} lines={3} />
          <Button x={COL_X + COL_W - 176} y={336} w={152} h={44} size={15}>
            {DASHBOARD.startCheckIn}
          </Button>
          <Cursor x={COL_X + COL_W - 44} y={350} clickAt={14} />

          <Box x={COL_X} y={416} w={COL_W} h={84} label="trend" fill={GREY.surface} />

          <Text
            x={COL_X}
            y={552}
            w={COL_W}
            size={44}
            weight={700}
            align="center"
            color={GREY.ink}
            opacity={later}
            style={{ letterSpacing: 0.5 }}
          >
            {LATER}
          </Text>
        </Desktop>
      </Camera>
    </AbsoluteFill>
  );
};
