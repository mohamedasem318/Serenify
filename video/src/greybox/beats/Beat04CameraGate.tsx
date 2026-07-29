import React from "react";
import { AbsoluteFill } from "remotion";

import { Camera, frameRect, rect, union } from "../Camera";
import { AppHeader, Desktop } from "../chrome";
import { CAMERA_GATE } from "../copy";
import { GREY } from "../theme";
import { Box, Button, Cursor, Text, TextBlock } from "../ui";

/**
 * Beat 4 · Camera consent gate · 0:22–0:26 · 120 frames
 *
 * ~230 words, unreadable at any speed — so the block is drawn as bars rather
 * than as copy, which is honest about what the audience gets from it. Establish
 * the shape (the 44px circular badge, the heading, two bordered cards), then
 * push in on exactly one line and hold it long enough to read. That one line
 * does more work than the other 220 words combined.
 *
 * THE PREDICTED EXTRA MOVE WAS NOT NEEDED. At a 1920 viewport the gate's cards
 * were 840 wide, so a framing that made the key line legible could not also
 * hold the CTA. At 1200 the cards are 552 wide and one framing holds the key
 * line's card AND the button, both complete, with the upper card entirely out of
 * frame. Beat 4 stays at 4s.
 *
 * The gate is rendered as page-level content rather than inside one tall outer
 * card: a 500px-tall container cannot be framed whole at any useful zoom, so
 * wrapping this content in one would guarantee a cropped element in every shot.
 */

const CARD_A = rect(324, 236, 552, 80);
const CARD_B = rect(324, 400, 552, 110);
const ALLOW = rect(350, 548, 500, 44);
const PAGE = rect(300, 92, 600, 500);

export const Beat04CameraGate: React.FC = () => (
  <AbsoluteFill>
    <Camera
      keys={[
        { frame: 0, shot: frameRect(PAGE, 24) },
        { frame: 28, shot: frameRect(PAGE, 24) },
        { frame: 88, shot: frameRect(union(CARD_B, ALLOW), 40) },
        { frame: 120, shot: frameRect(union(CARD_B, ALLOW), 40) },
      ]}
    >
      <Desktop clock="10:24 AM" url="serenify.tech/app/consent/camera">
        <AppHeader />

        {/* The 44px circular camera badge. */}
        <Box x={578} y={100} w={44} h={44} radius={22} fill={GREY.panel} border={GREY.graphite} />
        <Text x={300} y={158} w={600} size={24} weight={700} align="center">
          {CAMERA_GATE.heading}
        </Text>

        <TextBlock x={340} y={194} w={520} lines={4} size={8} gap={12} />

        <Box x={CARD_A.x} y={CARD_A.y} w={CARD_A.w} h={CARD_A.h} fill={GREY.surface} border={GREY.border} radius={10} />
        <TextBlock x={CARD_A.x + 20} y={CARD_A.y + 18} w={510} lines={3} size={7} gap={10} />

        <Box x={CARD_B.x} y={CARD_B.y} w={CARD_B.w} h={CARD_B.h} fill={GREY.surface} border={GREY.graphite} radius={10} />
        {/* The privacy pitch. The one line the whole beat exists to deliver. */}
        <Text x={CARD_B.x + 26} y={CARD_B.y + 24} w={500} size={16} weight={700} lineHeight={1.5}>
          {CAMERA_GATE.keyLine}
        </Text>

        <Button x={ALLOW.x} y={ALLOW.y} w={ALLOW.w} h={ALLOW.h} size={15}>
          {CAMERA_GATE.allow}
        </Button>
        <Cursor x={764} y={562} clickAt={110} />
      </Desktop>
    </Camera>
  </AbsoluteFill>
);
