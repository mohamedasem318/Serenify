import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

import { Rect } from "./Camera";
import { GREY } from "./theme";

/**
 * **The lift.**
 *
 * Some elements cannot be made legible by any camera move, and the reason is
 * geometry rather than framing: a 1152×86 banner in a 1200px viewport cannot be
 * held whole *and* magnified in a 16:9 frame. The tightest shot that contains it
 * is the full frame, and at the full frame its `text-sm` copy is ~5px on a phone.
 * Revision 2 found three of these — the omnibox, the calibration banner, the
 * monitoring stateline — and flagged all three as unsolvable with the camera.
 *
 * The lift solves them by staging the element instead of the shot. The element
 * detaches from its layout, reflows to a narrower and taller shape at centre
 * frame — which the camera *can* frame tightly — does its job, and settles back
 * where it belongs. The element is real and its content and type sizes are real;
 * only its position and measure are briefly staged.
 *
 * Because the lifted shape is narrow, the app's own type sizes become readable
 * without a type-scale liberty. The calibration banner is still 14px.
 *
 * USED IN EXACTLY THREE PLACES — beats 1, 3 and 7. Three uses across ~76 seconds
 * reads as a deliberate device; a fourth would make it a template gimmick.
 *
 * Two shapes of lift, both this component:
 *   · **reflow-and-travel** (beats 1, 3) — `home` and `lifted` differ in position
 *     and measure, and the camera pushes in on the lifted rect.
 *   · **scale-in-place** (beat 7) — `lifted` is `home` grown about its own centre,
 *     and the camera does not move at all. Cheaper: camera travel is what costs
 *     time, and beat 7 had none to spare.
 */
export const Lift: React.FC<{
  /** Where the element lives in the layout. */
  home: Rect;
  /** Where it goes, and what shape it takes, when lifted. */
  lifted: Rect;
  /** 0 = seated in the layout, 1 = fully lifted. */
  t: number;
  children: React.ReactNode;
  /** Draw the panel behind the children. */
  panel?: boolean;
  /**
   * True when the element already has a panel where it sits — the calibration
   * banner is a bordered banner in the layout, so its panel is fully opaque at
   * rest and only the shadow grows with the lift. False (the default) suits
   * beat 7's stateline, which has no panel of its own inside the reading card and
   * therefore has to grow one as it detaches.
   */
  seatedPanel?: boolean;
}> = ({ home, lifted, t, panel = true, seatedPanel = false, children }) => (
  <div
    style={{
      position: "absolute",
      left: home.x + (lifted.x - home.x) * t,
      top: home.y + (lifted.y - home.y) * t,
      width: home.w + (lifted.w - home.w) * t,
      height: home.h + (lifted.h - home.h) * t,
      boxSizing: "border-box",
    }}
  >
    {panel ? (
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: GREY.panelAlt,
          border: `1px solid ${GREY.graphite}`,
          borderRadius: 10,
          // The shadow is what says "detached" rather than "resized in place".
          boxShadow: `0 ${10 * t}px ${34 * t}px rgba(0,0,0,${0.22 * t})`,
          // Fades in with the lift unless the element already has a panel at rest.
          opacity: seatedPanel ? 1 : t,
        }}
      />
    ) : null}
    {children}
  </div>
);

/**
 * Scale a rect about its own centre — the beat-7 shape of lift, where the block
 * grows where it stands and the camera never moves.
 */
export const grow = (r: Rect, factor: number): Rect => ({
  x: r.x - (r.w * (factor - 1)) / 2,
  y: r.y - (r.h * (factor - 1)) / 2,
  w: r.w * factor,
  h: r.h * factor,
});

/**
 * Lift in, hold, settle back. Eased at both ends: a linear lift reads as a
 * transform rather than as an object moving.
 */
export const useLift = (inAt: number, inOver: number, outAt: number, outOver: number) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [inAt, inAt + inOver, outAt, outAt + outOver], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
};
