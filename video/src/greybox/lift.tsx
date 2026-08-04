import React from "react";
import { Easing, interpolate } from "remotion";
import { useCurrentFrame } from "../retime";

import { Rect } from "./Camera";
import { GREY } from "./theme";

/**
 * **TWO DEVICES, NOT ONE.** Revision 3 called both of these "the lift" and gave
 * them a single three-use budget, which hid the fact that they do different jobs
 * and want different rules.
 *
 * ── 1 · THE TRAVELLING LIFT (L10) — beats 1 and 3, and nowhere else ──────────
 *
 * Some elements cannot be made legible by any camera move, and the reason is
 * geometry rather than framing: a 1152×86 banner in a 1200px viewport cannot be
 * held whole *and* magnified in a 16:9 frame. The tightest shot that contains it
 * is the full frame, and at the full frame its `text-sm` copy is ~5px on a phone.
 *
 * The travelling lift solves that by staging the element instead of the shot. It
 * detaches from its layout, **travels** to centre frame at a narrower measure —
 * which the camera *can* frame tightly — is read at its real type size, and
 * settles back where it belongs. Content and type sizes stay real; only position
 * and measure are staged.
 *
 * **CAPPED AT TWO USES: beat 1's address bar and beat 3's calibration banner.** A
 * third candidate gets reported, not built. It is a strong move and three of them
 * across ~80 seconds would read as a template.
 *
 * ── 2 · THE IN-PLACE EMPHASIS (L12) — a rule, not a budget ──────────────────
 *
 * The stateline block grows where it stands, is read, and settles. Nothing travels
 * and the camera does not move, which is why it is free: camera travel is what
 * costs time.
 *
 * It is **not** capped. It fires on **every** stateline copy change — beat 7, beat
 * 8, beat 11 — because repetition is the point: the audience should learn that
 * when the block moves, the reading changed. That turns it from a flourish into
 * grammar. See `useEmphasis` for the one hard constraint (no yo-yo).
 *
 * Both are this one component; they differ only in what `lifted` is.
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
  /**
   * Overrides on the panel's own shape. Beat 1 needs this: the address bar is a
   * pill whose radius grows with the lift, and a panel drawn at a fixed radius 10
   * behind a 26-radius pill leaves the container's square-ish corners sitting
   * visibly outside the input at both ends. One shape, one radius.
   */
  panelStyle?: React.CSSProperties;
}> = ({ home, lifted, t, panel = true, seatedPanel = false, panelStyle, children }) => (
  <div
    style={{
      position: "absolute",
      /**
       * ── IT WAS PASSING BEHIND THE PAGE'S OWN NAVBAR ──
       *
       * Beat 1's "grey thing emerging from the nav bar" is this wrapper. `<PublicNavbar/>` is
       * `sticky top-0 z-50` (`public-navbar.tsx:88`) and this carried no `zIndex`, so a
       * positioned element at `z-index: auto` lost to `z-50` regardless of DOM order and the
       * lifted address bar was occluded for six frames on its way home — f63 cut by the navbar,
       * f65 gone entirely, f67 back above it inside the omnibox row. **A browser's address bar
       * can never be behind page content**, so this is a correction rather than a preference.
       *
       * 60 clears both sticky chromes in the film (`<PublicNavbar/>` and `<Header/>` are each
       * `z-50`) and stays under the drawn cursor. The only other call site is beat 3's
       * calibration banner, whose home (24, 188) and lifted (340, 283) rects both sit below the
       * header's bottom edge at 156 — it never crosses anything, so the change is inert there.
       */
      zIndex: 60,
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
          ...panelStyle,
        }}
      />
    ) : null}
    {children}
  </div>
);

/**
 * Scale a rect about its own centre. Kept because it is the obvious thing to
 * reach for, but the stateline emphasis does NOT use it: growing about the centre
 * sends the block's top edge up into the bloom, and beat 7's whole job is to plant
 * bloom, stateline and viewfinder together. `surfaces.tsx` anchors the emphasis at
 * the block's top edge instead and grows downward. See `STATELINE_EMPH`.
 */
export const grow = (r: Rect, factor: number): Rect => ({
  x: r.x - (r.w * (factor - 1)) / 2,
  y: r.y - (r.h * (factor - 1)) / 2,
  w: r.w * factor,
  h: r.h * factor,
});

/**
 * Travelling lift: out, hold, settle back. Eased at both ends — a linear lift
 * reads as a transform rather than as an object moving.
 */
export const useLift = (inAt: number, inOver: number, outAt: number, outOver: number) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [inAt, inAt + inOver, outAt, outAt + outOver], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
};

/**
 * In-place emphasis: rise, hold, and settle **only if a settle is asked for**.
 *
 * **THE ONE HARD CONSTRAINT IS NO YO-YO.** Beat 8's two stateline copy changes land
 * seconds apart, so the block goes up once and stays up across both, with the copy
 * changing while it is raised. That is why `outAt` is optional: beat 7 rises and
 * hands the raised block to beat 8 across the cut, beat 8 changes copy twice and
 * settles once at the end. Growing, settling and growing again would read as a
 * tic rather than as grammar.
 */
export const useEmphasis = (inAt: number, inOver: number, outAt?: number, outOver = 16) => {
  const frame = useCurrentFrame();
  const opts = {
    extrapolateLeft: "clamp" as const,
    extrapolateRight: "clamp" as const,
    easing: Easing.inOut(Easing.cubic),
  };
  if (outAt === undefined) return interpolate(frame, [inAt, inAt + inOver], [0, 1], opts);
  return interpolate(frame, [inAt, inAt + inOver, outAt, outAt + outOver], [0, 1, 1, 0], opts);
};
