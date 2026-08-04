import React from "react";
import { Easing, interpolate } from "remotion";
import { useCurrentFrame } from "../retime";

import { FONT, GREY, MONO } from "./theme";

/**
 * Greybox primitives: a labelled rectangle, a run of text, a stand-in for copy
 * that is not meant to be read, and a cursor.
 *
 * Everything a beat draws is one of these. Positions are absolute world
 * coordinates so a beat file reads as a layout table, which is what makes the
 * sizes checkable against the app.
 */

export interface BoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Stands in for what this rectangle *is*. Kept short; it is not copy. */
  label?: string;
  labelSize?: number;
  fill?: string;
  border?: string;
  borderWidth?: number;
  radius?: number;
  opacity?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** A labelled grey rectangle. The unit of this entire pass. */
export const Box: React.FC<BoxProps> = ({
  x,
  y,
  w,
  h,
  label,
  labelSize = 13,
  fill = GREY.panel,
  border = GREY.border,
  borderWidth = 1,
  radius = 6,
  opacity = 1,
  style,
  children,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      backgroundColor: fill,
      border: `${borderWidth}px solid ${border}`,
      borderRadius: radius,
      boxSizing: "border-box",
      opacity,
      ...style,
    }}
  >
    {label ? (
      <span
        style={{
          position: "absolute",
          left: 7,
          top: 5,
          fontFamily: MONO,
          fontSize: labelSize,
          lineHeight: 1,
          letterSpacing: 0.4,
          color: GREY.label,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    ) : null}
    {children}
  </div>
);

export interface TextProps {
  x: number;
  y: number;
  w?: number;
  size?: number;
  weight?: number | string;
  color?: string;
  align?: React.CSSProperties["textAlign"];
  lineHeight?: number;
  opacity?: number;
  mono?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Real copy. Where the beat sheet gives verbatim app text it goes through here
 * at roughly its real size — several beats are sized around how long a line
 * takes to read on a phone, so placeholder text of the wrong length would give
 * a false read on the exact thing this pass is testing.
 */
export const Text: React.FC<TextProps> = ({
  x,
  y,
  w,
  size = 16,
  weight = 400,
  color = GREY.ink,
  align = "left",
  lineHeight = 1.45,
  opacity = 1,
  mono = false,
  style,
  children,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      fontFamily: mono ? MONO : FONT,
      fontSize: size,
      fontWeight: weight,
      color,
      textAlign: align,
      lineHeight,
      opacity,
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * Copy that is deliberately NOT readable — beat 4's ~230 words of consent text,
 * for instance, which the sheet says not to try to read at any speed. Drawing
 * it as bars rather than lorem keeps the eye from trying, and keeps the block's
 * real bulk on screen so the push-in has something to push past.
 */
export const TextBlock: React.FC<{
  x: number;
  y: number;
  w: number;
  lines: number;
  size?: number;
  gap?: number;
  lastLineRatio?: number;
  color?: string;
  opacity?: number;
}> = ({ x, y, w, lines, size = 9, gap = 13, lastLineRatio = 0.55, color = GREY.fill, opacity = 1 }) => (
  <div style={{ position: "absolute", left: x, top: y, width: w, opacity }}>
    {Array.from({ length: lines }, (_, i) => (
      <div
        key={i}
        style={{
          height: size,
          marginBottom: gap,
          borderRadius: size / 2,
          backgroundColor: color,
          width: i === lines - 1 ? `${lastLineRatio * 100}%` : "100%",
        }}
      />
    ))}
  </div>
);

/** A stand-in button. Label is real where the sheet gives it. */
export const Button: React.FC<{
  x: number;
  y: number;
  w: number;
  h?: number;
  size?: number;
  filled?: boolean;
  opacity?: number;
  children: React.ReactNode;
}> = ({ x, y, w, h = 48, size = 17, filled = true, opacity = 1, children }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      borderRadius: 8,
      boxSizing: "border-box",
      backgroundColor: filled ? GREY.graphite : "transparent",
      border: `1px solid ${filled ? GREY.graphite : GREY.border}`,
      color: filled ? GREY.white : GREY.ink,
      fontFamily: FONT,
      fontSize: size,
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity,
    }}
  >
    {children}
  </div>
);

/**
 * The pointer. Clicks are a pacing signal — a beat that "ends on the click on
 * Set baseline" needs the click to be visible at the moment the sheet puts it,
 * or the beat looks like it just ran out.
 */
export const Cursor: React.FC<{ x: number; y: number; clickAt?: number; opacity?: number }> = ({
  x,
  y,
  clickAt,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const since = clickAt === undefined ? -1 : frame - clickAt;
  const ringOn = since >= 0 && since < 14;

  return (
    <div style={{ position: "absolute", left: x, top: y, opacity }}>
      {ringOn ? (
        <div
          style={{
            position: "absolute",
            left: -30,
            top: -30,
            width: 60,
            height: 60,
            borderRadius: 30,
            border: `3px solid ${GREY.graphite}`,
            opacity: interpolate(since, [0, 14], [0.85, 0], { extrapolateRight: "clamp" }),
            scale: interpolate(since, [0, 14], [0.3, 1], {
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            }),
          }}
        />
      ) : null}
      <svg width={26} height={34} viewBox="0 0 26 34" style={{ display: "block" }}>
        <path
          d="M2 2 L2 26 L8.5 20 L13 31 L18 29 L13.5 18.5 L22 18 Z"
          fill={GREY.ink}
          stroke={GREY.white}
          strokeWidth={1.5}
        />
      </svg>
    </div>
  );
};

/** Fade helper — used constantly, and always the same three lines otherwise. */
export const useFade = (inAt: number, inOver = 8, outAt?: number, outOver = 8) => {
  const frame = useCurrentFrame();
  const up = interpolate(frame, [inAt, inAt + inOver], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (outAt === undefined) return up;
  const down = interpolate(frame, [outAt, outAt + outOver], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return Math.min(up, down);
};
