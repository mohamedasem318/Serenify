import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { useDrift } from "../actors";
import { Camera, frameRect, union } from "../Camera";
import { MailMark } from "../chrome";
import { TOAST } from "../copy";
import { CARD, MonitorSurface, SESSION_BASE, TOAST_BOX, VIEWFINDER } from "../surfaces";
import { GREY } from "../theme";
import { Box, Text } from "../ui";

/**
 * Beat 8 · The email · 0:42–0:48 · 180 frames
 *
 * The core beat, and the largest single allocation in the video. No cutaway, no
 * cut — one continuous camera move that goes in on the toast and his face, then
 * eases back out to catch the bloom drift and the stateline changes. Cutting
 * between those two framings would break the cause-and-effect that is the whole
 * point of the beat.
 *
 * The order is load-bearing, and is what the frame numbers below encode:
 *   the toast lands and is read  → f6–f78
 *   his face falls               → f78
 *   the bloom drifts             → f86 + 39 frames (1.3s ease — it drifts, it
 *                                  does not snap)
 *   the stateline steps twice    → f96, f132
 *   the trend climbs and recolours
 *
 * The toast stays up throughout.
 */

const Toast: React.FC<{ slide: number }> = ({ slide }) => (
  <div style={{ translate: `${(1 - slide) * 320}px 0px`, opacity: slide }}>
    <Box
      x={TOAST_BOX.x}
      y={TOAST_BOX.y}
      w={TOAST_BOX.w}
      h={TOAST_BOX.h}
      fill={GREY.surface}
      border={GREY.graphite}
      borderWidth={2}
      radius={10}
    />
    {/*
     * The disambiguator. A generic toast beside the Serenify viewfinder can read
     * as *Serenify* notifying him, which would invert the scene — so this is the
     * same <MailMark> established in 2e, at 30px rather than a subtler size,
     * because the sheet says to fix any ambiguity by growing the icon and never
     * by moving the toast (the adjacency is liberty L2 and is load-bearing).
     */}
    <div style={{ position: "absolute", left: TOAST_BOX.x + 12, top: TOAST_BOX.y + 12 }}>
      <MailMark size={30} />
    </div>
    <Text x={TOAST_BOX.x + 50} y={TOAST_BOX.y + 12} size={13} weight={700} color={GREY.body}>
      {TOAST.app} · {TOAST.when}
    </Text>
    <Text x={TOAST_BOX.x + 50} y={TOAST_BOX.y + 30} size={15} weight={700}>
      {TOAST.sender}
    </Text>
    <Text x={TOAST_BOX.x + 12} y={TOAST_BOX.y + 56} w={TOAST_BOX.w - 24} size={14} color={GREY.ink} lineHeight={1.3}>
      {TOAST.subject}
    </Text>
  </div>
);

export const Beat08Email: React.FC = () => {
  const frame = useCurrentFrame();

  const slide = interpolate(frame, [6, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // 1.3s at 30fps. The honest transition, and it looks better than a snap.
  const tension = useDrift(86, 39);
  const climb = useDrift(100, 60);
  const face = frame >= 96 ? "tense" : frame >= 78 ? "falling" : "content";
  const stateline = frame >= 132 ? "tense" : frame >= 96 ? "little" : "ease";

  const wide = frameRect(union(CARD, VIEWFINDER), 20);
  const tight = frameRect(union(TOAST_BOX, VIEWFINDER), 24);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // Continuity with beat 7's closing framing.
          { frame: 0, shot: wide },
          { frame: 18, shot: frameRect(union(TOAST_BOX, VIEWFINDER), 90) },
          { frame: 48, shot: tight },
          { frame: 96, shot: wide },
          { frame: 180, shot: frameRect(union(CARD, VIEWFINDER), 14) },
        ]}
      >
        <MonitorSurface
          clock={TOAST.clock}
          tension={tension}
          stateline={stateline}
          climb={climb}
          face={face}
          sessionFrom={SESSION_BASE + 4}
        >
          <Toast slide={slide} />
        </MonitorSurface>
      </Camera>
    </AbsoluteFill>
  );
};
