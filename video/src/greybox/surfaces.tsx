import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

import { Bloom, FaceState, Trend, Viewfinder } from "./actors";
import { Rect, rect } from "./Camera";
import { AppHeader, Desktop, SessionReadout } from "./chrome";
import { STATELINE } from "./copy";
import { grow, Lift } from "./lift";
import { FONT, FPS, GREY } from "./theme";
import { Box } from "./ui";

/**
 * The monitoring surface — shared by beats 7, 8, 9 and 11.
 *
 * It is one component rather than four copies because those four beats are a
 * single continuous shot in story terms: the bloom, the stateline, the trend and
 * the viewfinder must be in exactly the same place across all of them or the fall
 * in beat 8 and the recovery in beat 11 stop reading as the same screen changing.
 *
 * The stack matches the real surface (`components/monitor/op-surfaces.tsx`): a
 * centred column — bloom, then the stateline head at `text-3xl` (30px), then the
 * sub at `text-base` (16px) capped at `max-w-[42ch]`. Those sizes are the app's.
 *
 * **The toast and the viewfinder share an x and a width.** That is the whole
 * point of liberty L2 — you watch his face fall *while the toast is up*, so the
 * two must sit together in one framing. Revision 2 widened the toast to fit the
 * boss's subject line on one line and broke the alignment; both are 320 wide at
 * x 856 now, and the reading card was narrowed to 700 to make room.
 *
 * L1 is applied to the viewfinder: 320×180, not the app's real 224×126.
 */

/** Every rect a beat might want to frame. Beats pass these to `frameRect`. */
export const CARD: Rect = rect(120, 164, 700, 436);
export const VIEWFINDER: Rect = rect(856, 200, 320, 180);
export const TOAST_BOX: Rect = rect(856, 96, 320, 92);
export const PROMPT: Rect = rect(856, 412, 320, 240);
/** The stateline head + sub. Beat 7 lifts this. */
export const STATELINE_BLOCK: Rect = rect(270, 336, 400, 118);

export const BLOOM = { cx: 470, cy: 262, size: 148 } as const;
export const READOUT = { x: 856, y: 390 } as const;

/** 47:12 — liberty L4. He has been heads-down a while. */
export const SESSION_BASE = 47 * 60 + 12;

/**
 * Beat 7's lift: the block grows about its own centre by this much and the camera
 * does not move. 1.8 is the largest factor whose lifted panel still sits inside
 * the composite framing — at 1.9 its left edge lands at world x 90 and the frame
 * starts at 100, so the panel was clipped.
 */
export const STATELINE_LIFT_FACTOR = 1.8;

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
  /** 0 = seated, 1 = lifted. Beat 7 only. */
  statelineLift?: number;
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
  statelineLift = 0,
  sessionFrom = SESSION_BASE,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const state = STATELINE[stateline];
  const t = statelineLift;
  const k = 1 + (STATELINE_LIFT_FACTOR - 1) * t;

  return (
    <Desktop clock={clock} url="serenify.tech/app/monitor">
      <AppHeader />

      <Box x={CARD.x} y={CARD.y} w={CARD.w} h={CARD.h} fill={GREY.surface} border={GREY.border} radius={12} />
      <Bloom cx={BLOOM.cx} cy={BLOOM.cy} size={BLOOM.size} tension={tension} />

      {/*
       * text-3xl / text-base, exactly as the app sets them — and both scaled by
       * the lift factor when beat 7 lifts the block, which is what finally makes
       * the 16px sub readable at a framing wide enough to hold the viewfinder.
       */}
      <Lift home={STATELINE_BLOCK} lifted={grow(STATELINE_BLOCK, STATELINE_LIFT_FACTOR)} t={t} panel>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14 * k,
            fontFamily: FONT,
            textAlign: "center",
            padding: `0 ${18 * k}px`,
          }}
        >
          <div style={{ fontSize: 30 * k, fontWeight: 700, color: GREY.ink, lineHeight: 1.15 }}>
            {state.title}
          </div>
          <div style={{ fontSize: 16 * k, color: GREY.body, lineHeight: 1.45 }}>{state.body}</div>
        </div>
      </Lift>

      <Trend x={160} y={472} w={620} h={90} climb={climb} tension={tension} />

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
