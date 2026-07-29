import React from "react";
import { AbsoluteFill } from "remotion";

import { Camera, shot } from "../Camera";
import { AppHeader, Desktop } from "../chrome";
import { CAMERA_GATE } from "../copy";
import { GREY } from "../theme";
import { Box, Button, Cursor, Text, TextBlock } from "../ui";

/**
 * Beat 4 · Camera consent gate · 0:20–0:24 · 120 frames
 *
 * ~230 words, unreadable at any speed — so the block is drawn as bars rather
 * than as copy, which is honest about what the audience gets from it. Establish
 * the shape (the 56px circular badge, the heading, two bordered cards), then
 * push in on exactly one line and hold it long enough to read. That one line
 * does more work than the other 220 words combined.
 *
 * LAYOUT NOTE — a real conflict in the sheet, resolved here rather than
 * flagged-and-skipped: the beat is specified to push in on the key line AND to
 * end on the "Allow camera and inference" button, and 4s does not contain a
 * push-in, a readable hold, and a pull-out. So the key line is placed in the
 * lower card, directly above the button, and one framing holds both.
 */
export const Beat04CameraGate: React.FC = () => (
  <AbsoluteFill>
    <Camera
      keys={[
        { frame: 0, shot: shot(960, 560, 1320) },
        { frame: 30, shot: shot(960, 560, 1320) },
        { frame: 86, shot: shot(960, 786, 620) },
      ]}
    >
      <Desktop clock="10:24 AM" url="serenify.tech/app/consent/camera">
        <AppHeader />

        <Box x={540} y={190} w={840} h={760} fill={GREY.surface} border={GREY.border} radius={16} />

        {/* The 56px circular camera badge. */}
        <Box x={932} y={218} w={56} h={56} radius={28} fill={GREY.panel} border={GREY.graphite} />
        <Text x={640} y={296} w={640} size={30} weight={700} align="center">
          {CAMERA_GATE.heading}
        </Text>

        <TextBlock x={640} y={356} w={640} lines={6} />

        <Box x={600} y={490} w={720} h={140} fill={GREY.page} border={GREY.border} radius={12} />
        <TextBlock x={628} y={520} w={620} lines={4} size={8} gap={11} />

        <Box x={600} y={654} w={720} h={154} fill={GREY.page} border={GREY.graphite} radius={12} />
        {/*
         * The privacy pitch. Held to 520px of world width so it fits inside the
         * ~620px framing that makes 20px type readable on a phone — a wider
         * measure would read fine on a monitor and be clipped in the shot.
         */}
        <Text x={700} y={682} w={520} size={20} weight={700} lineHeight={1.5}>
          {CAMERA_GATE.keyLine}
        </Text>

        <Button x={700} y={840} w={520} h={52} size={18}>
          {CAMERA_GATE.allow}
        </Button>
        <Cursor x={1128} y={860} clickAt={112} />
      </Desktop>
    </Camera>
  </AbsoluteFill>
);
