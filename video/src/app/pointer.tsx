import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

/**
 * ══ THE CURSOR ══════════════════════════════════════════════════════════════════════
 *
 * **A click has to have a cause on screen.** The one-take invariant says a click and its
 * consequence share a shot; what the component pass lost is the click itself. Focus rings
 * appeared, forms advanced and pages navigated with nothing touching them, which turns a film
 * about *someone using software* into a sequence of screenshots of software. The confirmatory
 * prompt was the clearest case — a focus ring arriving on "Yes, that's me" with no pointer reads
 * as a stray keyboard focus rather than as a person deciding.
 *
 * ── IT TRAVELS. THAT IS THE WHOLE POINT ─────────────────────────────────────────────
 *
 * The previous cursor was a static glyph whose position was switched between frames, so it
 * teleported — present, but never seen going anywhere. A pointer that arrives is what makes the
 * click read as intended rather than as something that happened to the page. So this takes a
 * PATH: waypoints in world coordinates, interpolated with the same eased-at-both-ends curve the
 * camera uses, so a hand move and a camera move feel like the same film.
 *
 * The travel is eased per LEG rather than across the whole path. A single interpolation over
 * three waypoints accelerates out of the first and decelerates into the last, gliding through
 * the middle one at speed — which reads as a swoop past a control rather than as stopping at it.
 * A hand stops at each thing it touches.
 *
 * ── IT IS DRAWN IN WORLD COORDINATES, SO THE CAMERA MAGNIFIES IT ────────────────────
 *
 * Deliberate, and it is the honest behaviour: the film is a screen recording of a 1200px screen
 * blown up (L7), and a magnified recording magnifies its cursor. Holding the glyph at a constant
 * screen size would mean the pointer shrinking as the camera pushed in, which is the one thing
 * no real recording does.
 *
 * ── WORLD, NOT VIEWPORT ─────────────────────────────────────────────────────────────
 *
 * Every consumer passes this through an `overlay` prop, which `Desktop` renders over the chrome
 * AND the page. A pointer placed inside `children` would resolve against the viewport div and
 * land 92px low — the same bug the mail toast had, and it is invisible until you measure it
 * against a control you already know the position of.
 */

export interface Waypoint {
  frame: number;
  x: number;
  y: number;
}

/** Matches `Camera`'s own easing, so the hand and the lens move in the same idiom. */
const TRAVEL_EASING = Easing.inOut(Easing.cubic);

/**
 * Where the pointer is at `frame`, eased per leg.
 *
 * Before the first waypoint it sits at the first; after the last, at the last. A cursor that
 * exists before it has anywhere to be is what `visible` is for.
 */
const positionAt = (path: Waypoint[], frame: number): { x: number; y: number } => {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1 || frame <= path[0].frame) return { x: path[0].x, y: path[0].y };
  const last = path[path.length - 1];
  if (frame >= last.frame) return { x: last.x, y: last.y };
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const opts = {
        extrapolateLeft: "clamp" as const,
        extrapolateRight: "clamp" as const,
        easing: TRAVEL_EASING,
      };
      return {
        x: interpolate(frame, [a.frame, b.frame], [a.x, b.x], opts),
        y: interpolate(frame, [a.frame, b.frame], [a.y, b.y], opts),
      };
    }
  }
  return { x: last.x, y: last.y };
};

/** How long the click ring lives, and how long the press dips the glyph. */
const RING_FRAMES = 14;
const PRESS_FRAMES = 5;

export const Pointer: React.FC<{
  /** World-coordinate waypoints, in ascending frame order. The tip lands on `(x, y)`. */
  path: Waypoint[];
  /** Frames a click lands on. Each draws a ring and dips the glyph. */
  clicks?: number[];
  /** Frames the pointer is on screen. Omit for "the whole beat". */
  visible?: { from?: number; to?: number };
  opacity?: number;
}> = ({ path, clicks = [], visible, opacity = 1 }) => {
  const frame = useCurrentFrame();
  const from = visible?.from ?? -Infinity;
  const to = visible?.to ?? Infinity;
  if (frame < from || frame >= to) return null;

  const { x, y } = positionAt(path, frame);

  // The most recent click that has already happened, so a ring finishes rather than being
  // cancelled by the next one being scheduled.
  const active = clicks.filter((c) => frame >= c && frame < c + RING_FRAMES).pop();
  const since = active === undefined ? -1 : frame - active;
  // A press is a small dip toward the target — the glyph acknowledging contact. Without it the
  // ring reads as an effect placed near the cursor rather than as something the cursor did.
  const press =
    since >= 0 && since < PRESS_FRAMES
      ? interpolate(since, [0, PRESS_FRAMES], [1, 0], { extrapolateRight: "clamp" })
      : 0;

  return (
    <div style={{ position: "absolute", left: x, top: y, opacity, zIndex: 90 }}>
      {since >= 0 ? (
        <div
          style={{
            position: "absolute",
            left: -26,
            top: -26,
            width: 52,
            height: 52,
            borderRadius: 26,
            // Colourless on purpose. Meadow and amber both carry band meaning in this product,
            // and a click ring wearing one would look like it was asserting a stress reading.
            border: "3px solid rgba(255, 255, 255, 0.85)",
            opacity: interpolate(since, [0, RING_FRAMES], [0.9, 0], { extrapolateRight: "clamp" }),
            scale: interpolate(since, [0, RING_FRAMES], [0.28, 1], {
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            }),
          }}
        />
      ) : null}
      <svg
        width={26}
        height={34}
        viewBox="0 0 26 34"
        style={{
          display: "block",
          scale: 1 - press * 0.12,
          transformOrigin: "0 0",
          // A macOS pointer has a soft drop shadow, which is also what keeps it legible over
          // both the near-black page and the bright viewfinder.
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.55))",
        }}
      >
        <path
          d="M2 2 L2 26 L8.5 20 L13 31 L18 29 L13.5 18.5 L22 18 Z"
          fill="#f2f4f6"
          stroke="#101214"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
