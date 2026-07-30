import React from "react";

/**
 * ── THE OFFICE BACKDROP ─────────────────────────────────────────────────────
 *
 * It sits behind the character inside the viewfinder, and in the wide composite shots the
 * whole viewfinder is about 123 × 69px on a phone. So the brief is not "draw an office" —
 * it is **read as an office at very low fidelity**, where any real detail becomes noise
 * behind the character rather than context. Four shapes, all of them large.
 *
 * Authored rather than sourced. The timebox was one attempt at code before falling back to
 * unDraw, and it came together: at the size this actually plays, a wall, a horizon, one
 * framed rectangle and a door edge is *more* legible than an illustration would be, and it
 * needs no third-party licence entry. See `docs/DECISIONS.md`, 2026-07-30.
 *
 * ── THE PALETTE, WHICH IS A CONSTRAINT RATHER THAN A CHOICE ─────────────────
 *
 * **No red, no saturated green, no amber.** Those three carry stress-band meaning in this
 * product — attention is foggy, stress is amber, affirmative is meadow — and a backdrop
 * wearing one looks like it is asserting a reading. Every value below is a warm neutral at
 * 7–12% saturation, which is nowhere near amber's 72%.
 *
 * It also has to sit *back* from the `#25557C` shirt rather than compete with it. It does
 * that on two axes at once: everything here is lighter and desaturated, and the shirt is
 * the only saturated thing in the frame.
 *
 * **Static.** It never animates — nothing in it is a pacing event, and a moving background
 * behind a face that is doing the acting is a straight loss.
 *
 * Everything is expressed as a fraction of the framing window, so it re-fits whatever box
 * the viewfinder becomes — including beat 5's 3:4 portrait preview — with no second set of
 * coordinates to keep in sync.
 */

export const BACKDROP = {
  wall: "#CFC8BE",
  /** Below the horizon: a desk run and the floor beyond it, as one darker mass. */
  lower: "#BDB4A7",
  /**
   * Close to the wall on purpose. At its first value the frame was pale enough to pull
   * the eye off his face, which is the one thing a backdrop must not do — at the wide
   * composite framing there is barely any face to lose the competition with.
   */
  frameFill: "#D5CEC4",
  frameLine: "#B8AEA1",
  /** A door or column edge, off to one side so the room is not symmetrical behind him. */
  edge: "#C6BEB3",
} as const;

export const OfficeBackdrop: React.FC<{ x: number; y: number; w: number; h: number }> = ({
  x,
  y,
  w,
  h,
}) => {
  const fx = (f: number) => x + w * f;
  const fy = (f: number) => y + h * f;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={BACKDROP.wall} />

      {/* The horizon. Mostly behind his shoulders — what it does is give the two side
          margins somewhere for the eye to stop. */}
      <rect x={x} y={fy(0.66)} width={w} height={h * 0.34} fill={BACKDROP.lower} />

      {/* One framed thing on the wall, upper left, clear of his head. */}
      <rect
        x={fx(0.055)}
        y={fy(0.1)}
        width={w * 0.2}
        height={h * 0.38}
        fill={BACKDROP.frameFill}
        stroke={BACKDROP.frameLine}
        strokeWidth={Math.max(1, w * 0.004)}
      />

      {/* A vertical edge on the right. Asymmetry is what stops it reading as a backdrop. */}
      <rect x={fx(0.865)} y={y} width={w * 0.055} height={h} fill={BACKDROP.edge} />
    </g>
  );
};
