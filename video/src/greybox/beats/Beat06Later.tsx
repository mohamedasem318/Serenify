import React from "react";
import { AbsoluteFill } from "remotion";

import { Camera, shot } from "../Camera";
import { AppHeader, Desktop } from "../chrome";
import { DASHBOARD, LATER } from "../copy";
import { COL_W, COL_X, GREY } from "../theme";
import { Box, Button, Cursor, Text, TextBlock, useFade } from "../ui";

/**
 * Beat 6 · "Later" · 0:34–0:36 · 60 frames
 *
 * Back on `/app` with the calibration banner gone, then the time jump.
 *
 * The sheet's open question is whether the "later that morning" line earns its
 * place or whether the `47:12` timer in beat 7 does the work on its own. Both
 * are buildable from here: `showLaterText` is registered as a second
 * composition (`Beat06-NoText`) so the two can be scrubbed back to back rather
 * than argued about.
 */
export const Beat06Later: React.FC<{ showLaterText?: boolean }> = ({ showLaterText = true }) => {
  const later = useFade(28, 10);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: shot(960, 430, 1260) },
          { frame: 60, shot: shot(960, 500, 1160) },
        ]}
      >
        <Desktop clock="10:43 AM" url="serenify.tech/app">
          <AppHeader />

          <Box x={COL_X} y={200} w={COL_W} h={80} fill={GREY.surface} border={GREY.border} radius={12} />
          <Text x={COL_X + 28} y={218} size={26} weight={700}>
            {DASHBOARD.welcomeTitle}
          </Text>
          <Text x={COL_X + 28} y={252} size={17} color={GREY.body}>
            {DASHBOARD.welcomeBody}
          </Text>

          {/* No calibration banner — it is gone, and its absence is the point. */}
          <Box x={COL_X} y={310} w={COL_W} h={250} label="today" fill={GREY.surface} />
          <TextBlock x={COL_X + 28} y={368} w={520} lines={3} />
          <Button x={COL_X + COL_W - 220} y={462} w={192} h={48} size={17}>
            {DASHBOARD.startCheckIn}
          </Button>
          <Cursor x={COL_X + COL_W - 48} y={480} clickAt={16} />

          {/* Trend card is short here so the lower third stays clear for the
              time-jump line — it is set in the app's own type, small and low,
              rather than as a title card. */}
          <Box x={COL_X} y={592} w={COL_W} h={140} label="trend" fill={GREY.surface} />

          {showLaterText ? (
            <Text
              x={COL_X}
              y={764}
              w={COL_W}
              size={34}
              align="center"
              color={GREY.label}
              opacity={later}
              style={{ letterSpacing: 0.5 }}
            >
              {LATER}
            </Text>
          ) : null}
        </Desktop>
      </Camera>
    </AbsoluteFill>
  );
};
