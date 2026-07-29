import React from "react";
import { AbsoluteFill } from "remotion";

import { Camera, shot } from "../Camera";
import { AppHeader, Desktop } from "../chrome";
import { DASHBOARD } from "../copy";
import { COL_W, COL_X, GREY, H, W } from "../theme";
import { Box, Button, Cursor, Text, TextBlock } from "../ui";

/**
 * Beat 6 · "Later" · 0:44–0:46 · 60 frames
 *
 * Continues straight from beat 5, which now lands on the dashboard itself. The
 * calibration banner is gone — that absence is the beat's visible content — and
 * he clicks **"Start check-in"**.
 *
 * **The "later that morning" line is gone.** No replacement text.
 *
 * ⚠️ FLAGGING, NOT FIXING: with the text removed, the only thing marking the time
 * jump is beat 7's session timer reading `47:12`. Two beats ago the dashboard clock
 * said 10:25 and beat 7's menu bar says 11:29, so the information is on screen —
 * but it is in a menu bar and a corner readout, neither of which the eye is on. My
 * read is that it will not register as a jump, and that the cut from this beat into
 * beat 7 will play as continuous time. Built as asked; yours to judge.
 */
export const Beat06Later: React.FC = () => (
  <AbsoluteFill>
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

        {/* No calibration banner. Its absence is the point. */}
        <Box x={COL_X} y={250} w={COL_W} h={150} label="today" fill={GREY.surface} />
        <TextBlock x={COL_X + 24} y={292} w={480} lines={3} />
        <Button x={COL_X + COL_W - 176} y={336} w={152} h={44} size={15}>
          {DASHBOARD.startCheckIn}
        </Button>
        <Cursor x={COL_X + COL_W - 44} y={350} clickAt={22} />

        <Box x={COL_X} y={416} w={COL_W} h={140} label="trend" fill={GREY.surface} />
      </Desktop>
    </Camera>
  </AbsoluteFill>
);
