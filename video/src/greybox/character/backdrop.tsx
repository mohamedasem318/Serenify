import React from "react";

/**
 * ── THE OFFICE BACKDROP ─────────────────────────────────────────────────────
 *
 * It sits behind the character inside the viewfinder, and in the wide composite shots the
 * whole viewfinder is about 123 × 69px on a phone. So the brief is not "draw an office" —
 * it is **read as an office at very low fidelity**, where any real detail becomes noise
 * behind the character rather than context. A handful of large shapes, nothing else.
 *
 * Authored rather than sourced. The timebox was one attempt at code before falling back to
 * unDraw, and it came together, so no third-party licence entry is incurred. See
 * `docs/DECISIONS.md`, 2026-07-30.
 *
 * ── OFFICE-CODED, NOT ROOM-CODED ────────────────────────────────────────────
 *
 * Revision 6 was a wall, a mid-height horizontal band, a large uniform field below it and
 * a framed picture — and that combination reads as **headboard and mattress**. Every
 * element was generic-room, and generic-room defaults to bedroom. A picture frame does no
 * work here; it hangs in any room ever built.
 *
 * So the three objects are all things that only exist in a workplace:
 *
 *   · a **window with venetian blinds**, running off the top edge on the left
 *   · the **back of a monitor** on its stand, off to the right, running off that edge
 *   · a **desk line** low in the frame, which the monitor sits on
 *
 * The horizontal band is gone. The desk sits at 79% of the window height, low enough that
 * his shoulders carry most of it and it only shows in the outer columns, which is where
 * context belongs.
 *
 * ── THE PALETTE AND THE BLUR, WHICH ARE BOTH CONSTRAINTS ────────────────────
 *
 * **No red, no saturated green, no amber.** Those three carry stress-band meaning in this
 * product — attention is foggy, stress is amber, affirmative is meadow — and a backdrop
 * wearing one looks like it is asserting a reading. Every value below is a warm neutral at
 * 6–11% saturation, which is nowhere near amber's 72%.
 *
 * **It has to recede**, and revision 6's did not: it competed with the face at the tight
 * framing, which is exactly where the face has to win. Two levers, applied together:
 *
 *   · the whole palette is inside ten points of lightness, so no edge in it is stronger
 *     than the edges on him — the hair is at L 21 and the shirt at L 35 against a wall at
 *     L 78, and nothing back here comes close to that
 *   · everything except the wall is **blurred**, which is what a webcam actually does to
 *     a background two metres behind the subject. It is depth of field, not a softening
 *     effect, and it is the reason the blinds can be drawn at all without becoming noise
 *
 * The wall itself is drawn sharp and full-bleed underneath, so the blur has something to
 * feather into and never opens a soft halo at the frame's edge.
 *
 * **Static.** It never animates — nothing in it is a pacing event, and a moving background
 * behind a face that is doing the acting is a straight loss.
 *
 * Everything is expressed as a fraction of the framing window, so it re-fits whatever box
 * the viewfinder becomes — including beat 5's 3:4 portrait preview — with no second set of
 * coordinates to keep in sync.
 */

/**
 * ── RE-TINTED FOR DARK MODE, AND IT NEEDED IT ───────────────────────────────────────
 *
 * These values were tuned against LIGHT app chrome, where a wall at L 78 sat comfortably below
 * a page at L 90. In a dark page (`--color-bg` dark is `#101214`, L 7) the viewfinder becomes
 * the brightest object on screen by a wide margin — which is exactly what a real webcam feed
 * looks like, and on its own that is an improvement rather than a problem.
 *
 * What did not survive the swap is the relationship INSIDE the viewfinder. The old wall sat at
 * **L 78 and the skin sits at L 78**, so against light chrome they read as a lit room with a
 * face in it, and against dark chrome the whole rectangle reads as one bright slab with the
 * face fighting its own background for attention. The brief for this backdrop has always been
 * "it has to recede, because the face has to win"; at equal lightness it stops receding.
 *
 * So the whole ramp drops ~15 points of lightness — the wall to **L 61** — which puts the skin
 * a clear 17 points above everything behind it and makes the face the brightest thing in the
 * frame again. Saturation also comes down from ~8% to ~6%: at the old chroma the panel read
 * distinctly tan against cool dark chrome, which is the "warm neutrals against a cool dark UI
 * can look wrong" failure. It is still warm — a cool-grey office would look like a morgue —
 * just no longer yellow.
 *
 * Both original constraints are unchanged and still hold: **no red, no saturated green, no
 * amber** (all three carry band meaning), and the whole palette stays inside a ~13-point
 * lightness band so no edge back here is stronger than the hair's or the shirt's.
 */
export const BACKDROP = {
  wall: "#A49D95",
  /** Daylight, barely. A window much brighter than the wall pulls the eye. */
  glass: "#AFA8A0",
  slat: "#9C958D",
  sash: "#979089",
  /** The monitor's back shell, a shade under the wall so it sits behind him. */
  shell: "#958E87",
  stand: "#8D8780",
  deskTop: "#9F988F",
  deskFront: "#948D86",
} as const;

export const OfficeBackdrop: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  uid: string;
}> = ({ x, y, w, h, uid }) => {
  const fx = (f: number) => x + w * f;
  const fy = (f: number) => y + h * f;

  /** Window, upper left. It runs off the top edge, as a real one does. */
  const winL = fx(0.02);
  const winR = fx(0.28);
  const winB = fy(0.5);
  const slats = 5;

  /** Monitor, right, seen from behind and running off that edge. */
  const monL = fx(0.76);
  const monT = fy(0.28);
  const monB = fy(0.62);

  const desk = fy(0.79);

  return (
    <g>
      {/* Sharp, full-bleed, and slightly over-sized so nothing below can feather out. */}
      <rect x={x - w} y={y - h} width={w * 3} height={h * 3} fill={BACKDROP.wall} />

      <defs>
        {/* Depth of field. He is at the camera; the room is not. */}
        <filter id={`${uid}-far`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={h * 0.01} />
        </filter>
      </defs>

      <g filter={`url(#${uid}-far)`}>
        {/* The desk, and the shadowed space under it. Both run past the frame. */}
        <rect x={x - w} y={desk} width={w * 3} height={h * 0.06} fill={BACKDROP.deskTop} />
        <rect x={x - w} y={desk + h * 0.06} width={w * 3} height={h} fill={BACKDROP.deskFront} />

        {/* Window: glass, slats, sash. */}
        <rect x={winL} y={y - h * 0.2} width={winR - winL} height={winB - y + h * 0.2} fill={BACKDROP.glass} />
        {Array.from({ length: slats }, (_, i) => (
          <rect
            key={i}
            x={winL}
            y={y - h * 0.12 + ((i + 0.5) * (winB - y + h * 0.12)) / slats}
            width={winR - winL}
            height={h * 0.022}
            fill={BACKDROP.slat}
          />
        ))}
        <rect x={winL} y={winB} width={winR - winL} height={h * 0.028} fill={BACKDROP.sash} />

        {/* Monitor: shell, neck, foot. */}
        <rect
          x={monL}
          y={monT}
          width={fx(1.04) - monL}
          height={monB - monT}
          rx={h * 0.02}
          fill={BACKDROP.shell}
        />
        <rect x={fx(0.885)} y={monB} width={w * 0.05} height={desk - monB} fill={BACKDROP.stand} />
        <rect x={fx(0.83)} y={desk - h * 0.018} width={w * 0.16} height={h * 0.022} fill={BACKDROP.stand} />
      </g>
    </g>
  );
};
