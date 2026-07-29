import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { useDrift } from "../actors";
import { Camera, shot } from "../Camera";
import { MailMark } from "../chrome";
import { TOAST } from "../copy";
import { GREY } from "../theme";
import { MonitorSurface, SESSION_BASE, TOAST as TOAST_BOX } from "../surfaces";
import { Box, Text } from "../ui";

/**
 * Beat 8 · The email · 0:40–0:46 · 180 frames
 *
 * The core beat, and the largest single allocation in the video. No cutaway,
 * no cut — one continuous camera move that goes in on the toast and his face,
 * then eases back out to catch the bloom drift and the stateline changes.
 * Cutting between those two framings would break the cause-and-effect that is
 * the whole point.
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
  <div style={{ translate: `${(1 - slide) * 520}px 0px`, opacity: slide }}>
    <Box
      x={TOAST_BOX.x}
      y={TOAST_BOX.y}
      w={TOAST_BOX.w}
      h={TOAST_BOX.h}
      fill={GREY.surface}
      border={GREY.graphite}
      borderWidth={2}
      radius={14}
    />
    {/*
     * The disambiguator. A generic toast beside the Serenify viewfinder can read
     * as *Serenify* notifying him, which would invert the scene — so this is the
     * same <MailMark> established in 2e, at 44px rather than a subtler size,
     * because the sheet says to fix any ambiguity by growing the icon and never
     * by moving the toast (the adjacency is liberty L2 and is load-bearing).
     */}
    <div style={{ position: "absolute", left: TOAST_BOX.x + 16, top: TOAST_BOX.y + 16 }}>
      <MailMark size={44} />
    </div>
    <Text x={TOAST_BOX.x + 72} y={TOAST_BOX.y + 18} size={19} weight={700} color={GREY.body}>
      {TOAST.app} · {TOAST.when}
    </Text>
    <Text x={TOAST_BOX.x + 72} y={TOAST_BOX.y + 46} size={22} weight={700}>
      {TOAST.sender}
    </Text>
    <Text x={TOAST_BOX.x + 16} y={TOAST_BOX.y + 82} w={TOAST_BOX.w - 32} size={21} color={GREY.ink}>
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

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // Continuity with beat 7's closing framing.
          { frame: 0, shot: shot(960, 466, 1420) },
          { frame: 18, shot: shot(1420, 318, 980) },
          { frame: 48, shot: shot(1420, 318, 760) },
          { frame: 96, shot: shot(1060, 452, 1580) },
          { frame: 180, shot: shot(1030, 462, 1490) },
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
