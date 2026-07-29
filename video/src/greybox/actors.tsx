import React from "react";
import { Easing, interpolate, interpolateColors, useCurrentFrame } from "remotion";

import { BAND, FONT, GREY, MONO } from "./theme";
import { Box } from "./ui";

/**
 * The three things in this video that are not rectangles standing still: his
 * face, the bloom, and the trend line.
 */

// ── The character ───────────────────────────────────────────────────────────

/**
 * His expression is a story beat, and its *timing* is what beat 8 lives or dies
 * on — the toast must land, then the face must fall, then the bloom moves. So
 * the face is a grey box with a state label that changes on cue. Crude is the
 * point; legible and correctly timed is not optional.
 *
 * States, in the order the video uses them:
 *   calm (5b, first sight) → content (7) → falling (8) → tense (8) → easing (11)
 */
export type FaceState = "calm" | "curious" | "content" | "falling" | "tense" | "easing";

export const FaceBox: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  state: FaceState;
  labelSize?: number;
  headphones?: boolean;
  /** Small idle sway, plus the head nod beat 11 asks for. */
  nod?: boolean;
}> = ({ x, y, w, h, state, labelSize = 30, headphones = false, nod = false }) => {
  const frame = useCurrentFrame();
  const sway = Math.sin(frame / 22) * 3;
  const bob = nod ? Math.sin(frame / 5) * 7 : 0;
  const headW = w * 0.42;
  const headH = h * 0.42;

  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h }}>
      {/* Shoulders */}
      <div
        style={{
          position: "absolute",
          left: w * 0.12,
          top: h * 0.66,
          width: w * 0.76,
          height: h * 0.34,
          borderRadius: `${w * 0.2}px ${w * 0.2}px 0 0`,
          backgroundColor: GREY.fill,
          translate: `${sway * 0.4}px 0px`,
        }}
      />
      {/* Head */}
      <div
        style={{
          position: "absolute",
          left: (w - headW) / 2,
          top: h * 0.2,
          width: headW,
          height: headH,
          borderRadius: headW * 0.34,
          backgroundColor: GREY.strong,
          translate: `${sway}px ${bob}px`,
        }}
      />
      {headphones ? (
        <div
          style={{
            position: "absolute",
            left: (w - headW) / 2 - w * 0.05,
            top: h * 0.2 - h * 0.05,
            width: headW + w * 0.1,
            height: headH * 0.66,
            borderRadius: `${headW * 0.5}px ${headW * 0.5}px 0 0`,
            border: `${Math.max(4, w * 0.028)}px solid ${GREY.graphite}`,
            borderBottom: "none",
            boxSizing: "border-box",
            translate: `${sway}px ${bob}px`,
          }}
        />
      ) : null}
      {/* The state label. This is the actual payload of the component. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: h * 0.04,
          width: w,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: labelSize,
          fontWeight: 700,
          letterSpacing: 1,
          color: GREY.ink,
          whiteSpace: "nowrap",
        }}
      >
        {`FACE: ${state}`}
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
              fontSize: h * 0.11,
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
 */
export const Viewfinder: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  state: FaceState;
  headphones?: boolean;
  nod?: boolean;
  notesFrom?: number;
  faceLabelSize?: number;
}> = ({ x, y, w, h, state, headphones, nod, notesFrom, faceLabelSize = 26 }) => (
  <>
    <Box x={x} y={y} w={w} h={h} fill={GREY.panelAlt} border={GREY.graphite} radius={10} label="viewfinder" labelSize={14} />
    <FaceBox
      x={x + w * 0.28}
      y={y + h * 0.1}
      w={w * 0.44}
      h={h * 0.85}
      state={state}
      labelSize={faceLabelSize}
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
  const scale = 1 + pulse * 0.045;

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
        scale,
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
      <polyline points={pts.join(" ")} fill="none" stroke={colour} strokeWidth={5} strokeLinejoin="round" />
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
