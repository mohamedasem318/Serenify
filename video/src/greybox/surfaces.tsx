import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

import { Bloom, Trend, Viewfinder } from "./actors";
import { frameRect, Rect, rect, Shot, union } from "./Camera";
import { AppHeader, CLOCK, Desktop, SessionReadout } from "./chrome";
import { STATELINE } from "./copy";
import { Lift } from "./lift";
import { Pose } from "./rig";
import { FONT, FPS, GREY, VIEWPORT_Y } from "./theme";
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
export const CARD: Rect = rect(120, 164, 700, 476);
export const VIEWFINDER: Rect = rect(856, 200, 320, 180);
export const TOAST_BOX: Rect = rect(856, 96, 320, 92);
export const PROMPT: Rect = rect(856, 412, 320, 240);
/** The stateline head + sub. This is what the in-place emphasis raises. */
export const STATELINE_BLOCK: Rect = rect(270, 334, 400, 118);
export const TREND: Rect = rect(160, 548, 620, 84);

export const BLOOM = { cx: 470, cy: 252, size: 148 } as const;
export const READOUT = { x: 856, y: 390 } as const;

/** 47:12 — liberty L4. He has been heads-down a while. */
export const SESSION_BASE = 47 * 60 + 12;

/**
 * **THE EMPHASIS GROWS DOWNWARD, AND THE CARD WAS RELAID OUT SO IT CAN.**
 *
 * Revision 3 grew the block 1.8× about its own centre, which sent its top edge up
 * to y 289 and covered roughly the lower third of the bloom. That was a nitpick
 * when the emphasis fired once; now that it fires on every stateline change it is a
 * pattern, and beat 7's entire job is to plant bloom, stateline and viewfinder
 * together as the "before".
 *
 * So the emphasis is anchored at the block's **top** edge (y 334, eight pixels
 * below the bloom's bottom at 326) and grows down. That needs 195px of clear room
 * below, which the old layout did not have — the trend sat at y 472. The card is
 * 40px taller (436 → 476) and the trend moved down to 548, which buys the room
 * without touching the bloom, the viewfinder, the toast or the prompt.
 *
 *   bloom            y 178 – 326
 *   stateline        y 334 – 452   ← seated
 *   stateline raised y 334 – 529   ← 8px clear of the bloom, 19px clear of the trend
 *   trend            y 548 – 632
 *
 * The factor is 1.65, not 1.8: that is what makes the app's 16px sub land at ~10px
 * on a phone at the composite framing (~1096 world px), which is the floor and the
 * only thing the emphasis is for. Anything larger buys nothing and costs clearance.
 */
export const STATELINE_EMPH: Rect = rect(140, STATELINE_BLOCK.y, 660, 195);
export const STATELINE_EMPH_FACTOR = STATELINE_EMPH.w / STATELINE_BLOCK.w;

/**
 * The monitoring composite — card + viewfinder — framed so **the clock is in it**.
 *
 * `frameRect` centres on the composite, which put the frame's top edge inside the
 * browser chrome and sliced the clock horizontally. A sliced clock is the one thing
 * this video cannot have, since beat 8's payoff is reading it.
 *
 * The fix is not to push the frame down off the chrome but to pull it UP until the
 * clock is whole: the composite needs 1056 world px of width, which at 16:9 buys 594
 * of height against the 582 it takes to span the clock's top (58) to the card's
 * bottom (640). The room is there — `frameRect` was simply spending it below. So the
 * shot top-aligns two pixels above the clock and spills below the world instead,
 * which is free: backdrop and page are the same grey, so the world's bottom edge is
 * literally invisible. The tab strip ends at 54 and stays out of frame.
 *
 * Result: the clock reads in every monitoring beat, not only in beat 8's push-in.
 */
export const monitorWide = (margin: number): Shot => {
  const base = frameRect(union(CARD, VIEWFINDER), margin);
  const halfHeight = (base.w * 9) / 32;
  const cardBottom = CARD.y + CARD.h;
  return {
    cx: base.cx,
    // Top-align on the clock, unless that would clip the card's own bottom edge.
    cy: Math.max(CLOCK.y - 2 + halfHeight, cardBottom + 12 - halfHeight),
    w: base.w,
  };
};

export type StatelineKey = keyof typeof STATELINE;

export const MonitorSurface: React.FC<{
  clock: string;
  tension: number;
  stateline: StatelineKey;
  climb: number;
  /** A point in the rig's pose space, usually from `useExpression`. See `rig.tsx`. */
  pose: Pose;
  /** His hands are going. On in 7, 8 and 11 — he never stops working. */
  working?: boolean;
  headphones?: boolean;
  nod?: boolean;
  notesFrom?: number;
  /**
   * 0 = seated, 1 = raised. Driven by `useEmphasis` and fired on EVERY stateline
   * copy change — beats 7, 8 and 11. Not a budget; a rule.
   */
  emphasis?: number;
  /** Seconds already elapsed when this beat starts; the readout ticks on. */
  sessionFrom?: number;
  children?: React.ReactNode;
}> = ({
  clock,
  tension,
  stateline,
  climb,
  pose,
  working,
  headphones,
  nod,
  notesFrom,
  emphasis = 0,
  sessionFrom = SESSION_BASE,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const state = STATELINE[stateline];
  const t = emphasis;
  const k = 1 + (STATELINE_EMPH_FACTOR - 1) * t;

  return (
    <Desktop clock={clock} url="serenify.tech/app/monitor">
      <AppHeader />

      <Box x={CARD.x} y={CARD.y} w={CARD.w} h={CARD.h} fill={GREY.surface} border={GREY.border} radius={12} />
      <Bloom cx={BLOOM.cx} cy={BLOOM.cy} size={BLOOM.size} tension={tension} />

      {/*
       * text-3xl / text-base, exactly as the app sets them — and both scaled by
       * the emphasis factor while the block is raised, which is what makes the
       * 16px sub readable at a framing wide enough to hold the viewfinder.
       */}
      <Lift home={STATELINE_BLOCK} lifted={STATELINE_EMPH} t={t} panel>
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

      <Trend x={TREND.x} y={TREND.y} w={TREND.w} h={TREND.h} climb={climb} tension={tension} />

      <Viewfinder
        x={VIEWFINDER.x}
        y={VIEWFINDER.y}
        w={VIEWFINDER.w}
        h={VIEWFINDER.h}
        pose={pose}
        working={working}
        headphones={headphones}
        nod={nod}
        notesFrom={notesFrom}
      />
      <SessionReadout x={READOUT.x} y={READOUT.y} seconds={sessionFrom + frame / (fps || FPS)} size={17} />

      {children}
    </Desktop>
  );
};
