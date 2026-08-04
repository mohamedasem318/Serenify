import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import { useCurrentFrame } from "../retime";

import { CAMERA, patchMeasurementForCamera } from "../app/measure-patch";
import { StillMotion } from "../app/motion";
import { H, W } from "./theme";

// One-time. See `measure-patch.ts`: the camera's CSS scale otherwise leaks into every real
// component that measures itself with `getBoundingClientRect`, which is how beat 11's trend
// ended up three times too wide with its descending tail off the plot.
patchMeasurementForCamera();

/**
 * The camera rig.
 *
 * The beat sheet's governing rule is that **every readable moment is a
 * push-in** — the camera work is not decoration, it is what makes the video
 * readable at all. That makes it the one part of a greybox that must NOT be
 * approximated: with the moves missing, the pass tests nothing.
 *
 * A `Shot` frames a rectangle of the 1200×675 world: `cx`/`cy` is its centre,
 * `w` is how wide a slice of world fills the frame. `w: 1200` is the whole
 * screen (and already 1.6×, since the output is 1920 wide); `w: 500` is a 3.8×
 * push-in. Height follows from 16:9, so a shot is three numbers and the maths
 * stays checkable by eye.
 *
 * Keyframes rather than a from/to pair because beat 8 needs a single
 * *continuous* move — in on the toast and his face, then back out to catch the
 * bloom drift — and cutting there would break the beat.
 */
export interface Shot {
  cx: number;
  cy: number;
  w: number;
}

export const shot = (cx: number, cy: number, w: number): Shot => ({ cx, cy, w });

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

/**
 * **The framing rule, as arithmetic.**
 *
 * A push-in must land on a *whole* element — a card, a panel, a message — with
 * all four of its edges inside the frame and margin around it. Landing
 * mid-layout, so the shot holds its target plus fragments of the elements above
 * and below, reads as a crop of something bigger rather than as a composed shot.
 *
 * `frameRect` returns the tightest shot that contains a rect with at least
 * `margin` world-pixels of clearance on every side, widening past the rect's own
 * width when the rect is tall enough that 16:9 demands it. Every landing in this
 * pass goes through here rather than through hand arithmetic — hand arithmetic
 * is exactly how revision 1 ended up with copy hanging off the frame edges.
 *
 * ONE DELIBERATE EXCEPTION, worth stating because it comes up constantly:
 * **full-bleed furniture may run off the left and right edges.** The public nav,
 * the app header, the omnibox, the calibration banner and the page background
 * all span the viewport by design, and 16:9 cannot hold a 1152×86 banner whole
 * and also magnify it — the geometry forbids it. Those read as background, not
 * as cropped objects. What must never bleed is a *content* element: a card, a
 * bubble, a prompt, a button, a field.
 */
export const frameRect = (r: Rect, margin = 24): Shot => ({
  cx: r.x + r.w / 2,
  cy: r.y + r.h / 2,
  w: Math.max(r.w + margin * 2, ((r.h + margin * 2) * 16) / 9),
});

/** Union of two rects — the "frame both entirely" case. */
export const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

export interface CameraKey {
  frame: number;
  shot: Shot;
  /**
   * Easing for the segment that STARTS at this key. Defaults to `CAMERA_EASING`.
   *
   * ── WHY A PER-SEGMENT OVERRIDE EXISTS ───────────────────────────────────────────────
   *
   * The default eases at both ends, which is right for a move that begins and finishes inside one
   * beat. It is wrong for a move that **crosses a beat boundary**, because each side gets its own
   * ease-in-out and the camera therefore comes to a full stop on the seam frame. Two segments that
   * each stop read as two moves, however tightly they abut — which is exactly the note on the push
   * into the camera consent gate ("the timing reads as two separate moves").
   *
   * A continuous gesture is one acceleration and one deceleration with the join at full speed:
   * `Easing.in(cubic)` on the first half, `Easing.out(cubic)` on the second, and the intermediate
   * shot placed where the two velocities match. See `framing.ts` § BEAT4_SEAM for that arithmetic.
   */
  ease?: (t: number) => number;
}

/**
 * Cinematic default: eased at both ends, so a push starts and settles rather
 * than snapping. A pure out-ease reads as a whip on a camera move.
 */
const CAMERA_EASING = Easing.inOut(Easing.cubic);

/** Accelerate away from rest and hand over at speed — the first half of a crossing move. */
export const EASE_DEPART = Easing.in(Easing.cubic);
/** Take over at speed and settle — the second half. */
export const EASE_ARRIVE = Easing.out(Easing.cubic);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The shot at a frame. Written out rather than left to three `interpolate` calls because the
 * easing is now a property of the SEGMENT rather than of the whole keyframe list, and
 * `interpolate` takes one easing for all of them.
 */
export const shotAt = (frame: number, keys: CameraKey[]): Shot => {
  if (keys.length < 2) return keys[0].shot;
  let i = 0;
  while (i < keys.length - 2 && frame >= keys[i + 1].frame) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const span = b.frame - a.frame;
  const raw = span <= 0 ? 1 : (frame - a.frame) / span;
  const t = Math.max(0, Math.min(1, raw));
  const e = (a.ease ?? CAMERA_EASING)(t);
  return {
    cx: lerp(a.shot.cx, b.shot.cx, e),
    cy: lerp(a.shot.cy, b.shot.cy, e),
    w: lerp(a.shot.w, b.shot.w, e),
  };
};

export const Camera: React.FC<{
  keys: CameraKey[];
  children: React.ReactNode;
}> = ({ keys, children }) => {
  const frame = useCurrentFrame();

  const { cx, cy, w } = shotAt(frame, keys);

  // The output is 1920 wide, so a full-world shot is already 1.6×.
  const zoom = 1920 / w;
  // Published so self-measuring components see LAYOUT pixels rather than screen pixels.
  // Written during render on purpose: a component's measuring effect runs after this render
  // commits, so the value it reads must already be this frame's.
  CAMERA.zoom = zoom;

  return (
    // The backdrop matches the PAGE, not black. Elements pinned to the right of the viewport —
    // the toast, the viewfinder — cannot be framed tightly AND centred without the frame
    // reaching past the world's edge, and a mismatched sliver there is far more visible than a
    // few pixels of page colour.
    //
    // DARK PASS: this was `GREY.page` (#e4e5e7), which put a bright band along every frame edge
    // that overshot the world — the beat-7 composite spills 5px past the bottom by design, and
    // it read as a light bar under a dark film. It is now the app's own dark `--color-bg`, so
    // the overshoot is invisible again exactly as it was meant to be.
    <AbsoluteFill style={{ backgroundColor: "#101214", overflow: "hidden" }}>
      {/* The CSS half of the reduced-motion answer. Mounted HERE, not per beat, because every
          one of the thirteen beats renders a camera and a beat that forgot it would render a
          live CSS transition against wall-clock time. See `motion.tsx` § StillMotion. */}
      <StillMotion />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: H,
          transformOrigin: "0 0",
          // With origin 0 0 the individual `translate`/`scale` properties compose
          // as translate ∘ scale, i.e. screen = translate + zoom · world. So
          // mapping world (cx, cy) to frame centre (960, 540) is this directly.
          translate: `${960 - zoom * cx}px ${540 - zoom * cy}px`,
          scale: zoom,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};
