import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { Camera, frameRect, rect, union } from "../Camera";
import { AppHeader, Desktop } from "../chrome";
import { CAMERA_GATE } from "../copy";
import { GREY } from "../theme";
import { Box, Button, Cursor, Text, TextBlock } from "../ui";

/**
 * Beat 4 · Camera consent gate · 0:27–0:32 · 150 frames
 *
 * **The page is scrolled, because the real page does not fit.** ~230 words across
 * two bordered cards plus a heading, a badge and the CTA is about 890px of page in
 * a 583px viewport. Revision 2 shortened the content so it fitted one screen,
 * which quietly misrepresented the gate as a small thing. Scrolling it is the
 * honest behaviour, and it also happens to reinforce what the copy is saying:
 * this is long because it matters.
 *
 * The ~230 words are drawn as bars, not as copy — the sheet says not to try to
 * read them at any speed, and bars are honest about what the audience gets. Then
 * the camera lands on the key line's card and the CTA together, both whole.
 *
 * COST: 4s → 5s, all of it the scroll.
 */

// Page coordinates, before scrolling. The page is ~890 tall in a 583 viewport.
const BADGE = rect(578, 120, 44, 44);
const CARD_A = rect(324, 340, 552, 170);
const CARD_B = rect(324, 600, 552, 210);
const ALLOW = rect(350, 848, 500, 44);
const PAGE_TOP = rect(300, 92, 600, 470);

/** How far the page scrolls. Chosen so the landing frame clears CARD_A entirely. */
const SCROLL = 320;

export const Beat04CameraGate: React.FC = () => {
  const frame = useCurrentFrame();
  const scroll = interpolate(frame, [34, 96], [0, SCROLL], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // The landing target, in SCREEN coordinates — i.e. after the scroll.
  const target = union(
    rect(CARD_B.x, CARD_B.y - SCROLL, CARD_B.w, CARD_B.h),
    rect(ALLOW.x, ALLOW.y - SCROLL, ALLOW.w, ALLOW.h),
  );

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: frameRect(PAGE_TOP, 24) },
          // Held wide while the page scrolls, so the scroll reads as a scroll.
          { frame: 96, shot: frameRect(PAGE_TOP, 24) },
          { frame: 128, shot: frameRect(target, 30) },
          { frame: 150, shot: frameRect(target, 30) },
        ]}
      >
        <Desktop clock="10:24 AM" url="serenify.tech/app/consent/camera">
          <AppHeader />

          {/* Everything below the sticky header scrolls together. */}
          <div style={{ translate: `0px ${-scroll}px` }}>
            <Box x={BADGE.x} y={BADGE.y} w={BADGE.w} h={BADGE.h} radius={22} fill={GREY.panel} border={GREY.graphite} />
            <Text x={300} y={182} w={600} size={24} weight={700} align="center">
              {CAMERA_GATE.heading}
            </Text>

            <TextBlock x={340} y={232} w={520} lines={6} size={8} gap={14} />

            <Box x={CARD_A.x} y={CARD_A.y} w={CARD_A.w} h={CARD_A.h} fill={GREY.surface} border={GREY.border} radius={10} />
            <TextBlock x={CARD_A.x + 22} y={CARD_A.y + 22} w={508} lines={7} size={7} gap={11} />

            <Box x={CARD_B.x} y={CARD_B.y} w={CARD_B.w} h={CARD_B.h} fill={GREY.surface} border={GREY.graphite} radius={10} />
            <TextBlock x={CARD_B.x + 22} y={CARD_B.y + 20} w={508} lines={4} size={7} gap={11} />
            {/* The privacy pitch. The one line the whole beat exists to deliver. */}
            <Text x={CARD_B.x + 26} y={CARD_B.y + 100} w={500} size={16} weight={700} lineHeight={1.5}>
              {CAMERA_GATE.keyLine}
            </Text>

            <Button x={ALLOW.x} y={ALLOW.y} w={ALLOW.w} h={ALLOW.h} size={15}>
              {CAMERA_GATE.allow}
            </Button>
            <Cursor x={764} y={ALLOW.y + 14} clickAt={140} opacity={frame >= 120 ? 1 : 0} />
          </div>
        </Desktop>
      </Camera>
    </AbsoluteFill>
  );
};
