import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { Camera, shot } from "../Camera";
import { AppHeader, Desktop } from "../chrome";
import { REN } from "../copy";
import { GREY } from "../theme";
import { Box, Text } from "../ui";

/**
 * Beat 10 · Ren · 0:50–0:57 · 210 frames
 *
 * A real three-turn exchange, each message legible, appearing one at a time
 * with a real beat between them — not all at once.
 *
 * TWO THINGS THE SHEET UNDERSPECIFIES, both handled here:
 *
 * 1. It asks for three legible messages but only one push-in (on turn 3). At a
 *    framing wide enough to hold the whole thread, 20px chat text is well below
 *    phone legibility, so turns 1 and 2 would be unreadable. The camera
 *    therefore *tracks* — it settles on each message as it arrives and pushes
 *    in further on turn 3. That is a change to the camera plan, not to the beat.
 *
 * 2. The copy is placeholder: `014-recommendations` does not exist. Length is
 *    what is being tested. Turn 3 has to read as personal knowledge rather than
 *    a canned tip — if the audience reads it as generic, the beat is dead, and
 *    that is a copy problem to catch here rather than after art.
 */

const PANEL = { x: 520, y: 180, w: 880, h: 780 } as const;

// Laid out by hand rather than measured: fixed geometry keeps the camera
// keyframes below checkable against the bubbles they are supposed to frame.
const BUBBLES = [
  { y: 320, h: 74, w: 560, side: "left" as const },
  { y: 424, h: 104, w: 520, side: "right" as const },
  { y: 558, h: 138, w: 620, side: "left" as const },
];

const APPEAR_AT = [10, 68, 128];

const RenAvatar: React.FC<{ x: number; y: number; size: number }> = ({ x, y, size }) => (
  <Box x={x} y={y} w={size} h={size} radius={size / 2} fill={GREY.panel} border={GREY.graphite}>
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Consolas, monospace",
        fontSize: size * 0.2,
        fontWeight: 700,
        color: GREY.label,
        textAlign: "center",
        lineHeight: 1.2,
      }}
    >
      REN
      <br />
      warm
    </div>
  </Box>
);

const TypingDots: React.FC<{ x: number; y: number; on: boolean }> = ({ x, y, on }) => {
  const frame = useCurrentFrame();
  if (!on) return null;
  return (
    <>
      <Box x={x} y={y} w={96} h={48} radius={14} fill={GREY.panelAlt} border={GREY.border} />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x + 24 + i * 20,
            top: y + 20,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: GREY.graphite,
            opacity: 0.35 + 0.65 * Math.abs(Math.sin((frame - i * 3) / 6)),
          }}
        />
      ))}
    </>
  );
};

export const Beat10Ren: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: shot(940, 386, 800) },
          { frame: 56, shot: shot(940, 386, 800) },
          { frame: 74, shot: shot(960, 484, 800) },
          { frame: 122, shot: shot(960, 484, 800) },
          { frame: 146, shot: shot(920, 630, 640) },
          { frame: 210, shot: shot(920, 630, 640) },
        ]}
      >
        <Desktop clock="11:31 AM" url="serenify.tech/app/chat">
          <AppHeader />

          <Box x={PANEL.x} y={PANEL.y} w={PANEL.w} h={PANEL.h} fill={GREY.surface} border={GREY.border} radius={16} />
          <RenAvatar x={PANEL.x + 28} y={PANEL.y + 24} size={64} />
          <Text x={PANEL.x + 108} y={PANEL.y + 42} size={26} weight={700}>
            Ren
          </Text>

          {REN.turns.map((turn, i) => {
            const b = BUBBLES[i];
            const appear = interpolate(frame, [APPEAR_AT[i], APPEAR_AT[i] + 9], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            });
            const x = b.side === "left" ? PANEL.x + 108 : PANEL.x + PANEL.w - 40 - b.w;

            return (
              <div key={i} style={{ opacity: appear, translate: `0px ${(1 - appear) * 14}px` }}>
                {b.side === "left" ? <RenAvatar x={PANEL.x + 28} y={b.y} size={60} /> : null}
                <Box
                  x={x}
                  y={b.y}
                  w={b.w}
                  h={b.h}
                  radius={16}
                  fill={b.side === "left" ? GREY.panelAlt : GREY.graphite}
                  border={b.side === "left" ? GREY.border : GREY.graphite}
                />
                <Text
                  x={x + 22}
                  y={b.y + 20}
                  w={b.w - 44}
                  size={20}
                  lineHeight={1.5}
                  color={b.side === "left" ? GREY.ink : GREY.white}
                >
                  {turn.text}
                </Text>
              </div>
            );
          })}

          {/* Ren composing, before each of its turns. Cheap, and it is real
              pacing information — it is what makes the gap between messages
              read as a pause rather than as dead air. */}
          <TypingDots x={PANEL.x + 108} y={324} on={frame < APPEAR_AT[0]} />
          <TypingDots x={PANEL.x + 108} y={562} on={frame >= 112 && frame < APPEAR_AT[2]} />
        </Desktop>
      </Camera>
    </AbsoluteFill>
  );
};
