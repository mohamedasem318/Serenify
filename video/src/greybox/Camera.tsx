import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { GREY, H, W } from "./theme";

/**
 * The camera rig.
 *
 * The beat sheet's governing rule is that **every readable moment is a
 * push-in** — at 1920×1080 in a phone-sized feed a wide shot is illegible, so
 * the camera work is not decoration, it is the thing that makes the video
 * readable at all. That makes it the one part of a greybox that must NOT be
 * approximated: with the moves missing, the pass tests nothing.
 *
 * A `Shot` frames a rectangle of the 1920×1080 world: `cx`/`cy` is its centre,
 * `w` is how wide a slice of world fills the frame. `w: 1920` is the full
 * screen; `w: 560` is a 3.4× push-in. Height follows from 16:9, so a shot is
 * three numbers and the maths stays checkable by eye.
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

export interface CameraKey {
  frame: number;
  shot: Shot;
}

/**
 * Cinematic default: eased at both ends, so a push starts and settles rather
 * than snapping. A pure out-ease reads as a whip on a camera move.
 */
const CAMERA_EASING = Easing.inOut(Easing.cubic);

export const Camera: React.FC<{
  keys: CameraKey[];
  children: React.ReactNode;
}> = ({ keys, children }) => {
  const frame = useCurrentFrame();

  // `interpolate` needs at least two strictly increasing inputs; a locked-off
  // shot is one key, which is the common case for the 2f choreography.
  const locked = keys.length < 2;
  const at = keys.map((k) => k.frame);
  const opts = {
    extrapolateLeft: "clamp" as const,
    extrapolateRight: "clamp" as const,
    easing: CAMERA_EASING,
  };

  const cx = locked ? keys[0].shot.cx : interpolate(frame, at, keys.map((k) => k.shot.cx), opts);
  const cy = locked ? keys[0].shot.cy : interpolate(frame, at, keys.map((k) => k.shot.cy), opts);
  const w = locked ? keys[0].shot.w : interpolate(frame, at, keys.map((k) => k.shot.w), opts);

  const zoom = W / w;

  return (
    <AbsoluteFill style={{ backgroundColor: GREY.black, overflow: "hidden" }}>
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
          translate: `${W / 2 - zoom * cx}px ${H / 2 - zoom * cy}px`,
          scale: zoom,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};
