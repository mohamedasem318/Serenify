import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { useDrift } from "../actors";
import { Camera, frameRect, rect } from "../Camera";
import { PLAYER } from "../copy";
import { monitorWide, MonitorSurface, SESSION_BASE, VIEWFINDER } from "../surfaces";
import { useEmphasis } from "../lift";
import { GREY, H, W } from "../theme";
import { Box, Text } from "../ui";

/**
 * Beat 11 · Return to ease · 1:06 – 1:13 · 210 frames
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
 * **THE BEAT NOW HAS ITS PAYOFF.** It used to end still tight on the viewfinder: the
 * pull-out began at f128 and arrived at f180, the last frame, so it never landed and
 * never held. The trend's tail walking back down and the stateline returning to ease
 * are *the reason the beat exists* and both were off screen.
 *
 * The order is now: player → headphones → notes → head nod → **pull out and hold**,
 * and everything that resolves resolves in that wide shot, in causal order —
 *
 *   f108  he nods
 *   f130  the camera starts back out; f160 it lands on the whole composite
 *   f144  the bloom drifts amber → meadow (1.3s ease — let it drift)
 *   f146  the trend's tail walks back down (55f)
 *   f150  the stateline emphasis rises; f158 the copy returns to "at ease"
 *   f160–210  held wide. 1.7s of the reading actually coming down.
 *
 * COST: 6s → 7s. The music player gives back ~0.4s (the track name reads in well
 * under two seconds at that framing) and the payoff takes 1.4s.
 *
 * His face is NOT the beat 7 expression — quieter, a bit amused at itself, which the
 * state label calls `easing`.
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

  const open = interpolate(frame, [0, 14, 58, 72], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const trackProgress = interpolate(frame, [24, 72], [0, 0.18], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // amber → meadow, on the same 1.3s ease as the fall. Let it drift — and let it
  // drift where it can be SEEN, which is after the camera starts back out.
  const tension = 1 - useDrift(144, 39);
  const climb = 1 - useDrift(146, 55);
  // The third firing of the emphasis rule. Rises as the camera lands, holds while the
  // returned reading is read, settles into the closing beat.
  const emphasis = useEmphasis(150, 18, 196, 14);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: { cx: W / 2, cy: H / 2, w: W } },
          { frame: 20, shot: frameRect(WIN, 24) },
          { frame: 52, shot: frameRect(WIN, 24) },
          // Wide on the viewfinder, not tight on it: the headphones, the drifting
          // notes and his head nod all need room, and cropping to the face loses
          // the thing that makes the beat work. Margin 100, not 24.
          { frame: 84, shot: frameRect(VIEWFINDER, 100) },
          { frame: 130, shot: frameRect(VIEWFINDER, 100) },
          // …and OUT, landing with 50 frames still to run. This is the payoff.
          { frame: 160, shot: monitorWide(20) },
          { frame: 210, shot: monitorWide(20) },
        ]}
      >
        <MonitorSurface
          clock="11:30 AM"
          tension={tension}
          stateline={frame >= 158 ? "ease" : "tense"}
          climb={climb}
          face={frame >= 74 ? "easing" : "tense"}
          headphones={frame >= 74}
          nod={frame >= 108}
          notesFrom={84}
          emphasis={emphasis}
          sessionFrom={SESSION_BASE + 20}
        >
          <MusicPlayer open={open} playing={frame >= 24} progress={trackProgress} />
        </MonitorSurface>
      </Camera>
    </AbsoluteFill>
  );
};
