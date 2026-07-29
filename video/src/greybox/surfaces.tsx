import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

import { Bloom, FaceState, Trend, Viewfinder } from "./actors";
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
 * L1 is applied here: the viewfinder is 480×270, not the app's real 224×126.
 * At true size his face is a smudge on a phone and beat 8 needs a readable one.
 */

export const STAGE = { x: 260, y: 200, w: 880, h: 720 } as const;
export const BLOOM = { cx: 700, cy: 420, size: 300 } as const;
export const RAIL_X = 1180;
export const VIEWFINDER = { x: RAIL_X, y: 250, w: 480, h: 270 } as const;
export const TOAST = { x: RAIL_X, y: 104, w: 480, h: 128 } as const;

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

      <Box x={STAGE.x} y={STAGE.y} w={STAGE.w} h={STAGE.h} fill={GREY.surface} border={GREY.border} radius={16} />
      <Bloom cx={BLOOM.cx} cy={BLOOM.cy} size={BLOOM.size} tension={tension} />

      <Text x={STAGE.x} y={588} w={STAGE.w} size={44} weight={700} align="center">
        {state.title}
      </Text>
      <Text x={STAGE.x + 100} y={650} w={STAGE.w - 200} size={26} align="center" color={GREY.body}>
        {state.body}
      </Text>

      <Trend x={300} y={764} w={800} h={132} climb={climb} tension={tension} />

      <Viewfinder
        x={VIEWFINDER.x}
        y={VIEWFINDER.y}
        w={VIEWFINDER.w}
        h={VIEWFINDER.h}
        state={face}
        headphones={headphones}
        nod={nod}
        notesFrom={notesFrom}
        faceLabelSize={36}
      />
      <SessionReadout x={RAIL_X} y={548} seconds={sessionFrom + frame / (fps || FPS)} size={28} />

      {children}
    </Desktop>
  );
};
