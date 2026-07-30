import React from "react";

import type { Pose } from "../rig";
import { SKIN } from "./base";

/**
 * ── THE AUTHORED PRIMITIVES ─────────────────────────────────────────────────
 *
 * Brows, eyes, pupils and mouth. The base ships without them by design — a head with
 * its features baked in cannot be posed — so everything the expression vector moves is
 * drawn here.
 *
 * ── THE GRAMMAR, WHICH IS THE POINT OF THIS FILE ────────────────────────────
 *
 * **Avataaars has no sclera.** Not "small whites" — none. `Eyes/Default` is two filled
 * `r=6` circles at `fill-opacity` 0.6 and nothing else, and *every* facial feature in the
 * system is `#000000` at an opacity. There is no palette.
 *
 * The crude rig drew large white sclera with small dark pupils, which is the vocabulary
 * of a different kind of cartoon. Porting that design onto this base would produce the
 * same cartoonish face on better art, which is the one outcome that makes swapping the
 * art pointless. So these are redrawn in the base's own language:
 *
 *   · black at an opacity, never a stroke, never a fill colour, never a white
 *   · filled shapes with tapered ends, not lines with round caps
 *   · the export's own registration — pupils at (106,112) / (158,112) r 6, brow spine
 *     y ≈ 92, mouth band y 149–163, all at face centre x 132
 *
 * `expression-reference.json` is the shape reference and is **reference only**. Those
 * presets are discrete separate drawings; cross-fading them is exactly the jump cut the
 * rig exists to prevent. What they are good for is the construction, and two of them are
 * load-bearing here: `Eyebrow/Natural/Default-Natural` is a filled leaf rather than a
 * stroked line, and `Eyes/Squint` is a lens *plus* a pupil circle — which is where the
 * clipped iris below comes from.
 */

/** Registration, straight off the export. Face centre is x 132. See `NOTICE.md`. */
export const FACE = {
  cx: 132,
  /** Eye line. Pupils sit at cx ± 26. */
  eyeY: 112,
  eyeDx: 26,
  /** The brow leaf's spine at rest. The export's brow band is y 88–100. */
  browY: 92,
  browDx: 29.5,
  browHalfLen: 15,
  /** Centre of the export's mouth band (149–163). */
  mouthY: 156,
  mouthHalfW: 14,
  /** Ear centres — five pixels BELOW the eye line, which is where headphones attach. */
  earY: 117,
  earDx: 61,
} as const;

/** The export's own feature opacities. Nothing here invents a value. */
const OP = { brow: 0.6, eye: 0.6, mouth: 0.7 } as const;

const INK = "#000000";

/**
 * A brow, as a filled leaf — pointed at both ends, thickest in the middle, arched.
 *
 * That is what `Eyebrow/Natural/Default-Natural` is: its path runs from an outer end at
 * (12, 17.9) up over an arch and back down to an inner end at (41.8, 10.0), with about
 * six units of thickness at the middle and none at either tip. A stroked line with round
 * caps — which is what the crude rig drew — reads as a marker stroke next to it.
 *
 * The inner end carries the meaning: `browInner` +1 lifts it (distress, the shape that
 * does most of beat 8's fall), −1 drags it down and in (tension).
 */
const Brow: React.FC<{ side: -1 | 1; pose: Pose }> = ({ side, pose }) => {
  const cx = FACE.cx + side * FACE.browDx;
  const y = FACE.browY - pose.browY * 6;

  // Inner is toward the face centre; outer is away from it.
  const innerX = cx - side * FACE.browHalfLen;
  const outerX = cx + side * FACE.browHalfLen;
  const innerY = y - pose.browInner * 5.5;
  // The outer tail sits lower than the spine even at rest, as the Natural family has it.
  const outerY = y + pose.browInner * 1.5 + 3.4;

  const mid = (innerY + outerY) / 2;
  // Arch height, then half the leaf's thickness either side of the arched spine.
  const arch = 3.6;
  const half = 3.1;

  return (
    <path
      d={
        `M ${outerX} ${outerY} ` +
        `Q ${cx} ${mid - arch - half} ${innerX} ${innerY} ` +
        `Q ${cx} ${mid - arch + half} ${outerX} ${outerY} Z`
      }
      fill={INK}
      fillOpacity={OP.brow}
    />
  );
};

/**
 * An eye: a dark iris **clipped by the lids**, which is both how an eye works and how
 * `Eyes/Squint` is built in the export — a lens shape with a pupil circle inside it.
 *
 * At rest the lens is taller than the iris, so what shows is the whole iris: a filled
 * dark ellipse at 0.6, i.e. `Eyes/Default`. Narrowing (`lidDrop`, and the blink) shrinks
 * the lens from the top, so the iris is cut down to a lens — `Eyes/Squint`. Neither state
 * needs a white, and the two are the same shape at two values, so they interpolate.
 *
 * `eyeOpen` scales the iris rather than the lens. With no sclera there is nothing for a
 * wider aperture to reveal, so a wider *eye* is a bigger dark shape — which is what the
 * export does across its own presets, where the eye's drawn size varies by several units.
 */
const Eye: React.FC<{ side: -1 | 1; pose: Pose; blink: number; uid: string }> = ({
  side,
  pose,
  blink,
  uid,
}) => {
  const cx = FACE.cx + side * FACE.eyeDx;
  // r 6 is the export's. Very slightly wide, so a squint keeps its width.
  const irisRx = 6.6 * pose.eyeOpen;
  const irisRy = 6.0 * pose.eyeOpen;

  const drop = Math.min(1, pose.lidDrop + blink);
  const lidRy = Math.max(0.15, irisRy * (1 - drop));
  // The UPPER lid descends and the lower one does not, which is what a blink is.
  const lidCy = FACE.eyeY + (irisRy - lidRy) * 0.9;
  const lidRx = irisRx * 1.4;

  // A quadratic reaches half its control offset at the midpoint, so 2× gives the radius.
  const lens =
    `M ${cx - lidRx} ${lidCy} ` +
    `Q ${cx} ${lidCy - lidRy * 2} ${cx + lidRx} ${lidCy} ` +
    `Q ${cx} ${lidCy + lidRy * 2} ${cx - lidRx} ${lidCy} Z`;
  const clip = `${uid}-lid-${side === -1 ? "l" : "r"}`;

  return (
    <>
      <defs>
        <clipPath id={clip}>
          <path d={lens} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <ellipse
          cx={cx}
          cy={FACE.eyeY + pose.gazeY * 2.2}
          rx={irisRx}
          ry={irisRy}
          fill={INK}
          fillOpacity={OP.eye}
        />
      </g>
    </>
  );
};

/**
 * The mouth: one filled shape between two arcs, which is what `Mouth/Default` is — an
 * unclosed curve filled against its own chord, i.e. a crescent, at 0.7.
 *
 * `mouthCurve` drives both arcs' control point together. Positive pulls the belly below
 * the corners and the shape reads as a smile; negative pushes it above them and the
 * corners become the low points, which is a frown. One scalar, both directions, so the
 * fall interpolates through flat rather than swapping a smile for a frown.
 */
const Mouth: React.FC<{ pose: Pose }> = ({ pose }) => {
  const halfW = FACE.mouthHalfW * pose.mouthWidth;
  const x1 = FACE.cx - halfW;
  const x2 = FACE.cx + halfW;
  const y1 = FACE.mouthY - pose.mouthSkew * 2.5;
  const y2 = FACE.mouthY + pose.mouthSkew * 2.5;

  const belly = FACE.mouthY + pose.mouthCurve * 14;
  // Lip thickness at rest, opening downward as the jaw goes slack.
  const half = 2.7;
  const open = pose.mouthOpen * 13;

  return (
    <path
      d={
        `M ${x1} ${y1} ` +
        `Q ${FACE.cx} ${belly - half} ${x2} ${y2} ` +
        `Q ${FACE.cx} ${belly + half + open} ${x1} ${y1} Z`
      }
      fill={INK}
      fillOpacity={OP.mouth}
    />
  );
};

/** Brows, eyes and mouth as one group, so the head transform carries all of them. */
export const Features: React.FC<{ pose: Pose; blink: number; uid: string }> = ({
  pose,
  blink,
  uid,
}) => (
  <>
    <Brow side={-1} pose={pose} />
    <Brow side={1} pose={pose} />
    <Eye side={-1} pose={pose} blink={blink} uid={uid} />
    <Eye side={1} pose={pose} blink={blink} uid={uid} />
    <Mouth pose={pose} />
  </>
);

/**
 * ── HEADPHONES ──────────────────────────────────────────────────────────────
 *
 * Authored rather than sourced, for three reasons: they have to animate (they appear,
 * and they sit with the nod), there is no ear *path* to attach to so they need placing
 * against measured coordinates, and a sourced flat asset would not match the base.
 *
 * **They attach at the measured ear centres — (71, 117) and (193, 117).** The handover
 * said no ear geometry existed and a coordinate had to be invented; it does exist, baked
 * into the skin path, and `NOTICE.md` has the derivation. The ear centre is five pixels
 * *below* the eye line, and cups hung on the eye line ride visibly high.
 *
 * Flat fills in the base's language, no gradients and no strokes on the cups. The band
 * **rests on the hair rather than arcing over it**: an arc that clears the hair puts its
 * apex above the framing window's top edge at y 22, and a band sliced off by the top of
 * the viewfinder reads as a mistake rather than as a crop. Its apex is at y ≈ 34, eight
 * units clear of the frame, and real over-ear bands press into hair anyway.
 */
export const Headphones: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const cupW = 26;
  const cupH = 44;
  return (
    <g opacity={opacity}>
      {/* The band, tucked under the cups at both ends. */}
      <path
        d={`M ${FACE.cx - FACE.earDx} 102 C ${FACE.cx - FACE.earDx} 12 ${FACE.cx + FACE.earDx} 12 ${FACE.cx + FACE.earDx} 102`}
        fill="none"
        stroke="#2E3338"
        strokeWidth={8}
        strokeLinecap="round"
      />
      {([-1, 1] as const).map((side) => {
        const cx = FACE.cx + side * FACE.earDx;
        return (
          <React.Fragment key={side}>
            <rect
              x={cx - cupW / 2}
              y={FACE.earY - cupH / 2}
              width={cupW}
              height={cupH}
              rx={11}
              fill="#2E3338"
            />
            {/* The pad. A lighter neutral, flat — it is what stops the cup reading as a hole. */}
            <ellipse cx={cx} cy={FACE.earY} rx={7.5} ry={14} fill="#525A62" />
          </React.Fragment>
        );
      })}
    </g>
  );
};

/**
 * Drifting music notes — beat 11 only, and the read is well liked, so the drift and the
 * fade are unchanged. What changed is the vocabulary: they were grey glyphs in the page's
 * typeface and are now filled dark shapes at an opacity, like everything else on him.
 *
 * They live in the character's own coordinate space rather than over the viewfinder box,
 * so they scale with the framing window and stay the same size relative to his head at
 * every aspect ratio.
 */
export const MusicNote: React.FC<{ x: number; y: number; scale: number; opacity: number; beamed: boolean }> = ({
  x,
  y,
  scale,
  opacity,
  beamed,
}) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity} fill={INK} fillOpacity={0.5}>
    <ellipse cx={0} cy={0} rx={4.2} ry={3.2} transform="rotate(-20 0 0)" />
    <rect x={3.2} y={-17} width={1.9} height={17} />
    {beamed ? (
      <>
        <ellipse cx={13} cy={-3} rx={4.2} ry={3.2} transform="rotate(-20 13 -3)" />
        <rect x={16.2} y={-20} width={1.9} height={17} />
        <path d="M 3.2 -17 L 18.1 -20 L 18.1 -15.6 L 3.2 -12.6 Z" />
      </>
    ) : (
      <path d="M 5.1 -17 C 9.5 -14.4 10.4 -10.6 8.6 -6.4 C 9.6 -11.2 8.2 -13.2 5.1 -14.6 Z" />
    )}
  </g>
);

/**
 * Hands at the desk edge, rising into the bottom of the frame and alternating.
 *
 * Crude on purpose, and the read comes from the alternation rather than the shape — but
 * it is the only unambiguous way to say "he never stopped working", which beat 11 needs
 * it to say. Skin, not panel grey: at panel grey they matched the backdrop and read as
 * two notches cut out of his shoulders.
 *
 * **They sit at the very bottom edge and inboard of the shoulder line**, and both of those
 * are corrections. Sized like the crude rig's — square-ish, half a head wide — and placed
 * at the shoulders' own height, they landed exactly on the shoulder curve and read as
 * epaulettes. Wide, shallow and in front of the chest, they read as forearms at a
 * keyboard, which is the only thing they have to say.
 */
export const Hands: React.FC<{ bottom: number; typing: number }> = ({ bottom, typing }) => (
  <>
    {([-1, 1] as const).map((side) => (
      <rect
        key={side}
        x={FACE.cx + side * 74 - 29}
        y={bottom - 18 - Math.max(0, typing * side) * 4}
        width={58}
        height={44}
        rx={15}
        fill={SKIN}
      />
    ))}
  </>
);
