import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

import { Bloom, FaceState, Trend, Viewfinder } from "./actors";
import { Rect, rect } from "./Camera";
import { AppHeader, Desktop, SessionReadout } from "./chrome";
import { STATELINE } from "./copy";
import { FPS, GREY } from "./theme";
import { Box, Text } from "./ui";

/**
 * The monitoring surface — shared by beats 7, 8, 9 and 11.
 *
 * It is one component rather than four copies because those four beats are a
 * single continuous shot in story terms: the bloom, the stateline, the trend
 * and the viewfinder must be in exactly the same place across all of them or
 * the fall in beat 8 and the recovery in beat 11 stop reading as the same
 * screen changing.
 *
 * The stack matches the real surface (`components/monitor/op-surfaces.tsx`):
 * a centred column — bloom, then the stateline head at `text-3xl` (30px), then
 * the sub at `text-base` (16px) capped at `max-w-[42ch]`. Those two sizes are
 * the app's, not chosen here, and the 16px sub is why beat 7 reads the way it
 * does.
 *
 * L1 is applied to the viewfinder: 292×164, not the app's real 224×126. At true
 * size his face is a smudge on a phone and beat 8 needs a readable one.
 */

/** Every rect a beat might want to frame. Beats pass these to `frameRect`. */
export const CARD: Rect = rect(140, 164, 720, 436);
export const VIEWFINDER: Rect = rect(884, 200, 292, 164);
/** Wider than the viewfinder so the boss's subject line fits on one line. */
export const TOAST_BOX: Rect = rect(856, 96, 320, 92);
export const PROMPT: Rect = rect(884, 396, 292, 244);
export const STATELINE_BLOCK: Rect = rect(300, 340, 400, 118);

export const BLOOM = { cx: 500, cy: 262, size: 148 } as const;
export const READOUT = { x: 884, y: 374 } as const;

/** 47:12 — liberty L4. He has been heads-down a while. */
export const SESSION_BASE = 47 * 60 + 12;

export type StatelineKey = keyof typeof STATELINE;

export const MonitorSurface: React.FC<{
  clock: string;
  tension: number;
  stateline: StatelineKey;
  climb: number;
  face: FaceState;
  headphones?: boolean;
  nod?: boolean;
  notesFrom?: number;
  /** Seconds already elapsed when this beat starts; the readout ticks on. */
  sessionFrom?: number;
  children?: React.ReactNode;
}> = ({
  clock,
  tension,
  stateline,
  climb,
  face,
  headphones,
  nod,
  notesFrom,
  sessionFrom = SESSION_BASE,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const state = STATELINE[stateline];

  return (
    <Desktop clock={clock} url="serenify.tech/app/monitor">
      <AppHeader />

      <Box x={CARD.x} y={CARD.y} w={CARD.w} h={CARD.h} fill={GREY.surface} border={GREY.border} radius={12} />
      <Bloom cx={BLOOM.cx} cy={BLOOM.cy} size={BLOOM.size} tension={tension} />

      {/* text-3xl / text-base, exactly as the app sets them. */}
      <Text x={CARD.x} y={STATELINE_BLOCK.y} w={CARD.w} size={30} weight={700} align="center">
        {state.title}
      </Text>
      <Text
        x={STATELINE_BLOCK.x}
        y={STATELINE_BLOCK.y + 44}
        w={STATELINE_BLOCK.w}
        size={16}
        align="center"
        color={GREY.body}
      >
        {state.body}
      </Text>

      <Trend x={180} y={470} w={640} h={92} climb={climb} tension={tension} />

      <Viewfinder
        x={VIEWFINDER.x}
        y={VIEWFINDER.y}
        w={VIEWFINDER.w}
        h={VIEWFINDER.h}
        state={face}
        headphones={headphones}
        nod={nod}
        notesFrom={notesFrom}
        faceLabelSize={20}
      />
      <SessionReadout x={READOUT.x} y={READOUT.y} seconds={sessionFrom + frame / (fps || FPS)} size={17} />

      {children}
    </Desktop>
  );
};
