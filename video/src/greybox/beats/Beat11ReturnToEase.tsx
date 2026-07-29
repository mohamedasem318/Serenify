import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { useDrift } from "../actors";
import { Camera, shot } from "../Camera";
import { PLAYER } from "../copy";
import { GREY } from "../theme";
import { MonitorSurface, SESSION_BASE } from "../surfaces";
import { Box, Text } from "../ui";

/**
 * Beat 11 · Return to ease · 0:57–1:03 · 180 frames
 *
 * He acts on it, in order: opens a music player and plays the track, puts
 * headphones on, and music notes drift around him while he starts moving with
 * it — small, a head nod, not a dance number. No audio; the cut must work
 * silent regardless, because the VO is Arabic narration laid on later.
 *
 * The track is named on screen. That naming is the evidence Ren knew him, and
 * under liberty L2b the player itself is generic while Billie Jean and Michael
 * Jackson are named.
 *
 * Meanwhile, on the Serenify surface: the bloom drifts amber → meadow over the
 * same 1.3s ease as the fall, the stateline returns, and the trend's tail walks
 * back down. His face is NOT the beat 7 expression — quieter, a bit amused at
 * itself, which the state label calls `easing`.
 */

const WIN = { x: 500, y: 300, w: 780, h: 380 } as const;

const MusicPlayer: React.FC<{ open: number; playing: boolean; progress: number }> = ({
  open,
  playing,
  progress,
}) => (
  <div style={{ opacity: open, scale: 0.94 + open * 0.06, transformOrigin: "50% 50%" }}>
    <Box x={WIN.x} y={WIN.y} w={WIN.w} h={WIN.h} fill={GREY.surface} border={GREY.graphite} borderWidth={2} radius={16} />
    <Box x={WIN.x} y={WIN.y} w={WIN.w} h={44} fill={GREY.panel} border={GREY.panel} radius={0} />
    <Text x={WIN.x + 20} y={WIN.y + 13} size={17} weight={700} color={GREY.body}>
      {PLAYER.app}
    </Text>

    <Box x={WIN.x + 32} y={WIN.y + 80} w={230} h={230} label="album art" fill={GREY.panelAlt} radius={10} />

    <Text x={WIN.x + 296} y={WIN.y + 96} w={440} size={40} weight={700}>
      {PLAYER.track}
    </Text>
    <Text x={WIN.x + 296} y={WIN.y + 154} w={440} size={26} color={GREY.body}>
      {PLAYER.artist}
    </Text>

    <Box x={WIN.x + 296} y={WIN.y + 216} w={430} h={6} radius={3} fill={GREY.ghost} border={GREY.ghost} />
    <Box
      x={WIN.x + 296}
      y={WIN.y + 216}
      w={430 * progress}
      h={6}
      radius={3}
      fill={GREY.graphite}
      border={GREY.graphite}
    />

    <Box x={WIN.x + 296} y={WIN.y + 254} w={44} h={44} radius={22} fill={GREY.panelAlt} />
    <Box x={WIN.x + 356} y={WIN.y + 248} w={56} h={56} radius={28} fill={GREY.graphite} border={GREY.graphite} />
    <Text x={WIN.x + 356} y={WIN.y + 262} w={56} size={22} align="center" color={GREY.white}>
      {playing ? "❚❚" : "▶"}
    </Text>
    <Box x={WIN.x + 428} y={WIN.y + 254} w={44} h={44} radius={22} fill={GREY.panelAlt} />
  </div>
);

export const Beat11ReturnToEase: React.FC = () => {
  const frame = useCurrentFrame();

  const open = interpolate(frame, [0, 14, 70, 84], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const trackProgress = interpolate(frame, [26, 84], [0, 0.22], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // amber → meadow, on the same 1.3s ease as the fall. Let it drift.
  const tension = 1 - useDrift(110, 39);
  const climb = 1 - useDrift(112, 55);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: shot(900, 470, 1160) },
          { frame: 22, shot: shot(890, 478, 820) },
          { frame: 64, shot: shot(890, 478, 820) },
          { frame: 96, shot: shot(1420, 380, 860) },
          { frame: 128, shot: shot(1420, 380, 860) },
          { frame: 180, shot: shot(1040, 452, 1570) },
        ]}
      >
        <MonitorSurface
          clock="11:33 AM"
          tension={tension}
          stateline={frame >= 126 ? "ease" : "tense"}
          climb={climb}
          face={frame >= 86 ? "easing" : "tense"}
          headphones={frame >= 86}
          nod={frame >= 120}
          notesFrom={96}
          sessionFrom={SESSION_BASE + 22}
        >
          <MusicPlayer open={open} playing={frame >= 26} progress={trackProgress} />
        </MonitorSurface>
      </Camera>
    </AbsoluteFill>
  );
};
