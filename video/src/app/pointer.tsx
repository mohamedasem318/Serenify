import React from "react";
import { Easing, interpolate } from "remotion";
import { useCurrentFrame } from "../retime";

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

/**
 * ── THE GLYPH IS macOS-SIZED, AND IT WAS HALF AGAIN TOO BIG ─────────────────────────
 *
 * It was drawn at 26 × 34 world px. A real macOS arrow is **about 12 × 19 points** at its tip-to-
 * tail extent, and at a 1200px world standing in for a desktop screen that is the size to use —
 * the film is a screen recording of a 1200px screen (L7), so the cursor should be the size a
 * cursor is on that screen. At 26 wide it was reading as a prop rather than as a pointer, and it
 * was worst exactly where it mattered most: in a tight push-in the camera magnifies it with
 * everything else, so beat 9's 3.4× shot was drawing a 90px arrow over a 320px prompt.
 *
 * The shape is macOS's rather than Windows', which is a consistency call the film had already
 * made elsewhere — the notification is a macOS toast and the browser sits under a macOS menu bar,
 * so a Windows arrow would be the one object on screen from a different operating system. The
 * two differ in ways that read at this size: the macOS arrow is **narrower**, its tail is
 * **straight-cut rather than notched**, and it carries a white outline around a black fill in
 * light contexts. Inverted here — light fill, dark outline — because every surface it crosses in
 * this film is dark, which is what macOS itself does under its "invert cursor" behaviour and is
 * the only way it stays visible over both the near-black page and the bright viewfinder.
 *
 * The ring scales with the glyph for the same reason: a 52px ring around a 19px arrow is a
 * target reticle, not a click.
 */
const GLYPH = { w: 13, h: 20 } as const;

/**
 * ── THE HOTSPOT, NAMED RATHER THAN LEFT IMPLICIT ────────────────────────────────────
 *
 * The path's tip sits at (1, 1) in the glyph's own coordinates (see the path below), but the
 * glyph was positioned as a plain flow child of the `left`/`top`-positioned wrapper — so the
 * wrapper's origin, `(x, y)`, landed on the SVG's `(0, 0)` corner, and the tip rendered one
 * glyph-unit down-and-right of the click point instead of on it. A single glyph-unit is small
 * next to a 26px ring, but "the glyph's hotspot IS its tip" (the comment on the path below)
 * was aspirational rather than true, and it is exactly the kind of drift a real cursor never
 * has — a real hotspot is a single pixel, not "close to one".
 *
 * So the SVG is pulled back by the tip's own offset, making `(TIP.x, TIP.y)` in the path's
 * coordinates coincide with the wrapper's `(0, 0)` — which is `(x, y)`, the click point — and
 * the ring (already centred on the wrapper's origin) stays concentric with the tip rather than
 * with the box.
 */
const TIP = { x: 1, y: 1 } as const;

/** How long the click ring lives, and how long the press dips the glyph. */
const RING_FRAMES = 14;
const PRESS_FRAMES = 5;
/** The ring's terminal radius. Scaled with the glyph — it used to be 26 against a 26-wide arrow. */
const RING_R = 13;

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
            left: -RING_R,
            top: -RING_R,
            width: RING_R * 2,
            height: RING_R * 2,
            borderRadius: RING_R,
            // Colourless on purpose. Meadow and amber both carry band meaning in this product,
            // and a click ring wearing one would look like it was asserting a stress reading.
            border: "1.5px solid rgba(255, 255, 255, 0.85)",
            opacity: interpolate(since, [0, RING_FRAMES], [0.9, 0], { extrapolateRight: "clamp" }),
            scale: interpolate(since, [0, RING_FRAMES], [0.28, 1], {
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            }),
          }}
        />
      ) : null}
      <svg
        width={GLYPH.w}
        height={GLYPH.h}
        viewBox="0 0 13 20"
        style={{
          position: "absolute",
          // Pulled back by the tip's own offset so (TIP.x, TIP.y) — not (0, 0) — lands on the
          // wrapper's origin, which is the click point. See TIP's own comment above.
          left: -TIP.x,
          top: -TIP.y,
          display: "block",
          scale: 1 - press * 0.12,
          transformOrigin: `${TIP.x}px ${TIP.y}px`,
          // A macOS pointer has a soft drop shadow, which is also what keeps it legible over
          // both the near-black page and the bright viewfinder.
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.55))",
        }}
      >
        {/*
         * The macOS arrow: tip at the origin, a straight-cut tail, and a narrow tang. The tip is
         * at (1,1) rather than (0,0) so the stroke's own half-width does not push the visible
         * point off the control the pointer is aimed at — the glyph's hotspot IS its tip, and
         * every waypoint in every beat is a control's measured centre. (TIP mirrors this (1,1)
         * so the wrapper — not just the path — agrees with it.)
         */}
        <path
          d="M1 1 L1 15.2 L4.7 11.7 L7.2 17.6 L9.9 16.5 L7.4 10.7 L12 10.4 Z"
          fill="#f2f4f6"
          stroke="#101214"
          strokeWidth={1}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
