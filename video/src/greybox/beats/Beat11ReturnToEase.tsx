import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { useDrift } from "../actors";
import { Camera, frameRect, rect, union } from "../Camera";
import { PLAYER } from "../copy";
import { CARD, MonitorSurface, SESSION_BASE, VIEWFINDER } from "../surfaces";
import { GREY, H, W } from "../theme";
import { Box, Text } from "../ui";

/**
 * Beat 11 · Return to ease · 0:58–1:04 · 180 frames
 *
 * He acts on it, in order: opens a music player and plays the track, puts
 * headphones on, and music notes drift around him while he starts moving with it
 * — small, a head nod, not a dance number. No audio; the cut must work silent
 * regardless, because the VO is Arabic narration laid on later.
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

const WIN = rect(300, 220, 600, 280);

const MusicPlayer: React.FC<{ open: number; playing: boolean; progress: number }> = ({
  open,
  playing,
  progress,
}) => (
  <div style={{ opacity: open, scale: 0.94 + open * 0.06, transformOrigin: "50% 50%" }}>
    <Box x={WIN.x} y={WIN.y} w={WIN.w} h={WIN.h} fill={GREY.surface} border={GREY.graphite} borderWidth={2} radius={12} />
    <Box x={WIN.x} y={WIN.y} w={WIN.w} h={32} fill={GREY.panel} border={GREY.panel} radius={0} />
    <Text x={WIN.x + 14} y={WIN.y + 9} size={14} weight={700} color={GREY.body}>
      {PLAYER.app}
    </Text>

    <Box x={WIN.x + 24} y={WIN.y + 52} w={160} h={160} label="album art" labelSize={10} fill={GREY.panelAlt} radius={8} />

    <Text x={WIN.x + 208} y={WIN.y + 62} w={360} size={26} weight={700}>
      {PLAYER.track}
    </Text>
    <Text x={WIN.x + 208} y={WIN.y + 102} w={360} size={17} color={GREY.body}>
      {PLAYER.artist}
    </Text>

    <Box x={WIN.x + 208} y={WIN.y + 152} w={360} h={5} radius={3} fill={GREY.ghost} border={GREY.ghost} />
    <Box
      x={WIN.x + 208}
      y={WIN.y + 152}
      w={360 * progress}
      h={5}
      radius={3}
      fill={GREY.graphite}
      border={GREY.graphite}
    />

    <Box x={WIN.x + 208} y={WIN.y + 182} w={34} h={34} radius={17} fill={GREY.panelAlt} />
    <Box x={WIN.x + 254} y={WIN.y + 177} w={44} h={44} radius={22} fill={GREY.graphite} border={GREY.graphite} />
    <Text x={WIN.x + 254} y={WIN.y + 188} w={44} size={17} align="center" color={GREY.white}>
      {playing ? "❚❚" : "▶"}
    </Text>
    <Box x={WIN.x + 310} y={WIN.y + 182} w={34} h={34} radius={17} fill={GREY.panelAlt} />
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
          { frame: 0, shot: { cx: W / 2, cy: H / 2, w: W } },
          { frame: 22, shot: frameRect(WIN, 24) },
          { frame: 64, shot: frameRect(WIN, 24) },
          // Wide on the viewfinder, not tight on it: the headphones, the drifting
          // notes and his head nod all need room, and cropping to the face loses
          // the thing that makes the beat work. Margin 100, not 24.
          { frame: 96, shot: frameRect(VIEWFINDER, 100) },
          { frame: 128, shot: frameRect(VIEWFINDER, 100) },
          { frame: 180, shot: frameRect(union(CARD, VIEWFINDER), 20) },
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
