import React from "react";
import { Easing, interpolate, interpolateColors, useCurrentFrame } from "remotion";

import { CharacterRig, Pose } from "./rig";
import { BAND, FONT, GREY, MONO } from "./theme";
import { Box } from "./ui";

/**
 * The four things in this video that are not rectangles standing still: his
 * face, Ren's face, the bloom, and the trend line.
 */

// ── The character ───────────────────────────────────────────────────────────
//
// His expression is a story beat and its *timing* is what beat 8 lives or dies on —
// the toast lands, then the face falls, then the bloom moves.
//
// It used to be a grey box with a `FACE: content` label, which timed the beats but
// could not answer whether the fall would ever read. It is now an actual rig; see
// `rig.tsx` for the pose vector, the part decomposition and the reasoning. The labels
// are gone deliberately: leaving them in would let the rig look like it works while
// the text carried the information.

// ── Ren ─────────────────────────────────────────────────────────────────────

/**
 * Ren's four avatar states, as labelled grey placeholders. The drawn face is
 * PR #221's and comes later; what this pass tests is *when* each state is on
 * screen and for how long.
 *
 * Drawn much larger than the app does — `RenAvatar` defaults to 34px and its
 * call sites use 38 and 54 — under a declared liberty, for the same reason the
 * viewfinder is enlarged: at true size it is a smudge on a phone, and beat 10
 * is the only place in the video where Ren's face is on screen long enough to
 * be read at all.
 */
export type RenState = "idle" | "attentive" | "thinking" | "warm";

export const RenAvatar: React.FC<{ x: number; y: number; size: number; state: RenState }> = ({
  x,
  y,
  size,
  state,
}) => {
  const frame = useCurrentFrame();
  // The states differ by eye shape in the real component; here they differ by a
  // label, plus a breath so the avatar is not a dead sticker on screen.
  const breath = 1 + Math.sin(frame / 30) * 0.012;

  return (
    <div style={{ position: "absolute", left: x, top: y, scale: breath, transformOrigin: "50% 50%" }}>
      <Box x={0} y={0} w={size} h={size} radius={size / 2} fill={GREY.panel} border={GREY.graphite} borderWidth={2} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size,
          height: size,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: size * 0.04,
          fontFamily: MONO,
          fontWeight: 700,
          color: GREY.label,
        }}
      >
        <span style={{ fontSize: size * 0.16 }}>REN</span>
        <span style={{ fontSize: size * 0.155, color: GREY.ink }}>{state}</span>
      </div>
    </div>
  );
};

/** Drifting music notes — beat 11 only. */
export const MusicNotes: React.FC<{ x: number; y: number; w: number; h: number; startFrame: number }> = ({
  x,
  y,
  w,
  h,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const notes = [0, 1, 2, 3, 4];

  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, overflow: "hidden" }}>
      {notes.map((i) => {
        const local = frame - startFrame - i * 13;
        if (local < 0) return null;
        const cycle = local % 70;
        const rise = interpolate(cycle, [0, 70], [h * 0.9, h * 0.08]);
        const fade = interpolate(cycle, [0, 10, 52, 70], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const drift = Math.sin(cycle / 9 + i) * w * 0.06;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: w * (0.14 + i * 0.18) + drift,
              top: rise,
              fontFamily: FONT,
              fontSize: h * 0.13,
              color: GREY.graphite,
              opacity: fade,
            }}
          >
            {i % 2 === 0 ? "♪" : "♫"}
          </div>
        );
      })}
    </div>
  );
};

/**
 * The viewfinder. Scaled up from the app's real 224×126 under liberty L1 —
 * at true size his face is a smudge on a phone and beat 8 needs a readable one.
 *
 * The rig fills the whole viewfinder rather than a 48%-wide box inside it. That is
 * both more honest (a webcam sees head, shoulders and a bit of backdrop, and people
 * sit close to laptops) and the only way the head is big enough to read: at the wide
 * composite framing it is ~40px on a phone, and at 48% width it was ~19px.
 */
export const Viewfinder: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  pose: Pose;
  working?: boolean;
  headphones?: boolean;
  nod?: boolean;
  notesFrom?: number;
}> = ({ x, y, w, h, pose, working, headphones, nod, notesFrom }) => (
  <>
    <Box x={x} y={y} w={w} h={h} fill={GREY.panelAlt} border={GREY.graphite} radius={8} label="viewfinder" labelSize={10} />
    <CharacterRig
      x={x}
      y={y}
      w={w}
      h={h}
      pose={pose}
      working={working}
      headphones={headphones}
      nod={nod}
    />
    {notesFrom === undefined ? null : <MusicNotes x={x} y={y} w={w} h={h} startFrame={notesFrom} />}
  </>
);

// ── The bloom ───────────────────────────────────────────────────────────────

/**
 * `tension` 0 = meadow, 1 = amber. The beat drives it across 1.3s of ease,
 * because a band change *drifts rather than snaps* in the real product and that
 * drift is a pacing event — the one place colour is built in this pass.
 *
 * No number is ever shown. The bloom carries no value (hard invariant).
 */
export const Bloom: React.FC<{ cx: number; cy: number; size: number; tension: number }> = ({
  cx,
  cy,
  size,
  tension,
}) => {
  const frame = useCurrentFrame();
  const colour = interpolateColors(tension, [0, 1], [BAND.meadow, BAND.amber]);
  // Breathing. Faster and shallower as tension rises — free, and it reads.
  const period = interpolate(tension, [0, 1], [58, 34]);
  const pulse = Math.sin((frame / period) * Math.PI * 2);

  return (
    <div
      style={{
        position: "absolute",
        left: cx - size / 2,
        top: cy - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colour,
        opacity: 0.9,
        scale: 1 + pulse * 0.045,
        boxShadow: `0 0 ${size * 0.34}px ${size * 0.1}px ${colour}55`,
      }}
    />
  );
};

// ── The session trend ───────────────────────────────────────────────────────

/**
 * A step-line that climbs and recolours in beat 8, then walks its tail back
 * down in beat 11. Steps rather than a curve because the real reading is a
 * banded value, not a continuous one.
 */
export const Trend: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0 = flat and settled, 1 = fully climbed. */
  climb: number;
  tension: number;
}> = ({ x, y, w, h, climb, tension }) => {
  const colour = interpolateColors(tension, [0, 1], [BAND.meadow, BAND.amber]);
  const steps = 14;
  const pts: string[] = [];

  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    // Settled for the first half, then rising by `climb` across the tail. Low y
    // is high stress, so climbing means the level goes down in SVG coordinates.
    const base = 0.74 + Math.sin(i * 1.7) * 0.035;
    const tail = Math.max(0, (t - 0.5) / 0.5);
    const level = base - tail * climb * 0.52;
    const py = level * h;
    pts.push(`${(i / steps) * w},${py}`);
    pts.push(`${((i + 1) / steps) * w},${py}`);
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: x, top: y }}>
      <polyline points={pts.join(" ")} fill="none" stroke={colour} strokeWidth={3} strokeLinejoin="round" />
    </svg>
  );
};

/** Eased 0→1 over `frames`, for band drifts. The sheet's drift is 1.3s. */
export const useDrift = (startFrame: number, frames: number) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + frames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
};
