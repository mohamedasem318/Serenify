import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

import { GREY } from "./theme";

/**
 * ── THE CHARACTER RIG ───────────────────────────────────────────────────────
 *
 * A SPIKE, and its question is narrow: **can a face made of primitives fall
 * convincingly?** Two risks were travelling under one name — whether a rig can
 * produce the motion the beats require, and whether we can get good consistent art
 * — and the second was making the first look frightening. The first can be retired
 * with no art at all, which is what this is.
 *
 * It is deliberately ugly. Arcs, dots, ellipses, one quadratic for the mouth. Do not
 * refine it; the point is that if *this* carries beat 8, then art is a swap rather
 * than a dependency.
 *
 * ── THE ARCHITECTURAL CONSTRAINT ────────────────────────────────────────────
 *
 * **Expressions are transforms on separable parts, never separate drawings
 * cross-faded.** Beat 8 needs the face to *fall* and beat 11 needs a nod, and a
 * cross-fade between two finished drawings produces neither — on a face it reads as a
 * jump cut. So an expression here is not a picture, it is a **vector of numbers**
 * (`Pose`), every named expression is a point in that space, and every transition is
 * an `interpolate` between two points. The fall is 14 frames of continuous travel
 * through brow, lid, eye, mouth, head and shoulder simultaneously.
 *
 * This is the same model Ren's avatar uses, and it is what makes the art swap cheap:
 * replace the shapes, keep the vector.
 *
 * ── THE PART DECOMPOSITION ──────────────────────────────────────────────────
 *
 * Chosen for a webcam talking-head crop, where at the wide composite framing the head
 * is ~40px on a phone and only three or four features can register at all. So: few
 * parts, each bold, each doing real work.
 *
 *   1 · head        position, tilt — carries the nod and the sink
 *   2 · brows       height, inner-end angle — the largest single carrier of the fall
 *   3 · eyes        aperture (upper lid descends, lower lid fixed) — blink + tension
 *   4 · pupils      gaze offset
 *   5 · mouth       one curvature scalar (+smile / −frown), width, openness, skew
 *   6 · shoulders   slump, and the typing motion
 *   7 · hands       two blocks at the frame edge, alternating — "still working"
 *   8 · headphones  an overlay on the ears, beat 11 only
 *
 * The hair cap and the ears are not animated. They exist because they are where the
 * generated art's seams will be, and drawing them now proves the rig has somewhere to
 * attach them.
 */

// ── The pose vector ─────────────────────────────────────────────────────────

export interface Pose {
  /** + raises both brows, − lowers them. */
  browY: number;
  /** + lifts the INNER ends (distress), − pulls them down and together (tension). */
  browInner: number;
  /** Eye aperture multiplier. >1 widens (alarm), <1 narrows. */
  eyeOpen: number;
  /** 0 = open, 1 = shut. The upper lid descends; the lower lid does not move. */
  lidDrop: number;
  /** Pupils up (−) / down (+). Looking down at a keyboard is +. */
  gazeY: number;
  /** +1 full smile … 0 flat … −1 full frown. */
  mouthCurve: number;
  /** 1 = neutral. <1 presses the lips together. */
  mouthWidth: number;
  /** 0 = closed. Small values read as a slack jaw. */
  mouthOpen: number;
  /** One corner higher than the other — "amused at himself". */
  mouthSkew: number;
  /** Degrees. + tilts his head to his left. */
  headTilt: number;
  /** + sinks the head down into the shoulders. */
  headY: number;
  /** + slumps the shoulders. */
  shoulderY: number;
  /** Breath period multiplier. <1 is faster and shallower. */
  breathRate: number;
}

/**
 * The five expressions the beat sheet asks for, as points in the pose space.
 *
 *   5b  calm      first sight of him, settled — the audience learns this face here
 *   7   content   working, lightly smiling
 *   8   dismayed  THE FALL lands here. Not a state the beat sits in for long
 *   8   tense     and then it settles into this
 *   11  easing    quieter, relieved, a bit amused at itself
 *
 * `falling` and `curious` from the placeholder are gone on purpose: falling was never
 * a state (it is the travel between two of these) and curious was never used.
 */
export const POSE = {
  calm: {
    browY: 0,
    browInner: 0,
    eyeOpen: 1,
    lidDrop: 0.04,
    gazeY: 0,
    mouthCurve: 0.18,
    mouthWidth: 1,
    mouthOpen: 0,
    mouthSkew: 0,
    headTilt: 0,
    headY: 0,
    shoulderY: 0,
    breathRate: 1,
  },
  content: {
    browY: 0.1,
    browInner: 0,
    eyeOpen: 1,
    lidDrop: 0.08,
    gazeY: 0.35,
    mouthCurve: 0.6,
    mouthWidth: 1.02,
    mouthOpen: 0,
    mouthSkew: 0,
    headTilt: -1.5,
    headY: 0,
    shoulderY: 0,
    breathRate: 1,
  },
  dismayed: {
    // The distress shape: inner brow ends UP, brows overall a little down, eyes
    // widened, jaw slack, head and shoulders dropping. Every one of these moves at
    // once over 14 frames, which is what makes it a fall rather than a face swap.
    browY: -0.15,
    browInner: 1,
    eyeOpen: 1.16,
    lidDrop: 0,
    gazeY: -0.25,
    mouthCurve: -0.7,
    mouthWidth: 0.94,
    mouthOpen: 0.3,
    mouthSkew: 0,
    headTilt: 0.5,
    headY: 2.6,
    shoulderY: 2,
    breathRate: 0.8,
  },
  tense: {
    // Brows down and drawn together, eyes narrowed, lips pressed. Held, not falling.
    browY: -0.75,
    browInner: -0.55,
    eyeOpen: 0.88,
    lidDrop: 0.2,
    gazeY: 0.15,
    mouthCurve: -0.3,
    mouthWidth: 0.84,
    mouthOpen: 0,
    mouthSkew: 0,
    headTilt: -0.5,
    headY: 1.8,
    shoulderY: 3.2,
    breathRate: 0.66,
  },
  easing: {
    // Not the beat-7 expression. Softer lids, a smaller and slightly lopsided smile.
    browY: 0.05,
    browInner: 0.12,
    eyeOpen: 0.94,
    lidDrop: 0.18,
    gazeY: 0.3,
    mouthCurve: 0.42,
    mouthWidth: 0.98,
    mouthOpen: 0,
    mouthSkew: 0.5,
    headTilt: 2,
    headY: -0.4,
    shoulderY: -0.6,
    breathRate: 1.15,
  },
} as const satisfies Record<string, Pose>;

export type Expression = keyof typeof POSE;

const KEYS = Object.keys(POSE.calm) as (keyof Pose)[];

export const lerpPose = (a: Pose, b: Pose, t: number): Pose => {
  const out = {} as Pose;
  for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
};

export interface ExpressionKey {
  frame: number;
  state: Expression;
}

/**
 * **Expressions as keyframes**, exactly like `Camera` does with shots — which is what
 * makes a transition the default and a cut impossible to write by accident.
 *
 *   useExpression([
 *     { frame: 0,  state: "content"  },
 *     { frame: 78, state: "content"  },   // holds
 *     { frame: 92, state: "dismayed" },   // ← THE FALL, 14 frames of travel
 *     { frame: 140, state: "tense"   },
 *   ])
 *
 * Eased at both ends: a linear pose lerp reads as a slider being dragged. A face
 * starts and settles.
 */
export const useExpression = (keys: ExpressionKey[]): Pose => {
  const frame = useCurrentFrame();
  if (keys.length === 0) return POSE.calm;
  if (keys.length === 1) return POSE[keys[0].state];

  let i = 0;
  while (i < keys.length - 2 && frame >= keys[i + 1].frame) i += 1;
  const from = keys[i];
  const to = keys[i + 1];
  const t = interpolate(frame, [from.frame, to.frame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  return lerpPose(POSE[from.state], POSE[to.state], t);
};

// ── Blink ───────────────────────────────────────────────────────────────────

/**
 * A blink every ~3.2s with a deterministic jitter, because `Math.random()` throws in
 * this project (it would break resume) and a metronomic blink reads as a machine.
 * Five frames: shut in two, open in three.
 */
const BLINK_PERIOD = 96;
const blinkFrame = (i: number) => i * BLINK_PERIOD + ((i * 37) % 43);

const useBlink = (): number => {
  const frame = useCurrentFrame();
  const i = Math.floor(frame / BLINK_PERIOD);
  let shut = 0;
  for (const n of [i - 1, i, i + 1]) {
    if (n < 0) continue;
    const at = blinkFrame(n);
    shut = Math.max(
      shut,
      interpolate(frame, [at, at + 2, at + 5], [0, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
  }
  return shut;
};

// ── The drawing ─────────────────────────────────────────────────────────────

/** Head geometry, in the 0–100 square the head SVG is drawn in. */
const EYE = { dx: 13.5, cy: 51, rx: 7.2, ry: 8 } as const;
const BROW = { dx: 13.5, y: 36, halfW: 9, weight: 5.6 } as const;
const MOUTH = { cy: 71, halfW: 12 } as const;

const Brow: React.FC<{ side: -1 | 1; pose: Pose }> = ({ side, pose }) => {
  // The inner end moves and the outer end barely does, which is what gives a brow its
  // meaning. `browInner` +1 lifts the inner end (distress); −1 drops it (tension).
  const cx = 50 + side * BROW.dx;
  const y = BROW.y - pose.browY * 4;
  const innerX = cx - side * BROW.halfW;
  const outerX = cx + side * BROW.halfW;
  const innerY = y - pose.browInner * 4.2;
  const outerY = y + pose.browInner * 1.1;

  return (
    <line
      x1={innerX}
      y1={innerY}
      x2={outerX}
      y2={outerY}
      stroke={GREY.ink}
      strokeWidth={BROW.weight}
      strokeLinecap="round"
    />
  );
};

const Eye: React.FC<{ side: -1 | 1; pose: Pose; blink: number }> = ({ side, pose, blink }) => {
  const cx = 50 + side * EYE.dx;
  const openRy = EYE.ry * pose.eyeOpen;
  // The lower lid is fixed and the upper lid descends — that is what a blink is, and
  // it is why this needs no clip path.
  const drop = Math.min(1, pose.lidDrop + blink);
  const ry = Math.max(0.5, openRy * (1 - drop));
  const cy = EYE.cy + openRy - ry;
  const pupilR = Math.min(3.4, ry * 0.8);

  return (
    <>
      <ellipse cx={cx} cy={cy} rx={EYE.rx * pose.eyeOpen} ry={ry} fill={GREY.white} />
      <ellipse
        cx={cx}
        cy={cy + pose.gazeY * 1.6}
        rx={pupilR}
        ry={pupilR}
        fill={GREY.ink}
        opacity={ry < 1.2 ? 0 : 1}
      />
    </>
  );
};

const Mouth: React.FC<{ pose: Pose }> = ({ pose }) => {
  const halfW = MOUTH.halfW * pose.mouthWidth;
  const x1 = 50 - halfW;
  const x2 = 50 + halfW;
  // One scalar drives the whole mouth: the quadratic's control point. Positive curve
  // pulls it below the corners (a smile), negative above it (a frown).
  const ctrlY = MOUTH.cy + pose.mouthCurve * 13;
  const y1 = MOUTH.cy - pose.mouthCurve * 1.5 - pose.mouthSkew * 2;
  const y2 = MOUTH.cy - pose.mouthCurve * 1.5 + pose.mouthSkew * 2;

  return (
    <>
      {pose.mouthOpen > 0.04 ? (
        <ellipse
          cx={50}
          cy={MOUTH.cy + pose.mouthCurve * 4}
          rx={halfW * 0.62}
          ry={pose.mouthOpen * 6.5}
          fill={GREY.black}
          opacity={0.55}
        />
      ) : null}
      <path
        d={`M ${x1} ${y1} Q 50 ${ctrlY} ${x2} ${y2}`}
        fill="none"
        stroke={GREY.ink}
        strokeWidth={4.4}
        strokeLinecap="round"
      />
    </>
  );
};

/**
 * The head, drawn into a square. Everything is in 0–100 units so the whole thing
 * scales with one number, which is also the property an art swap has to preserve.
 */
const Head: React.FC<{ pose: Pose; blink: number; headphones: boolean }> = ({
  pose,
  blink,
  headphones,
}) => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
    {/* Ears. Not animated — they are where the headphones attach. */}
    <ellipse cx={20} cy={55} rx={4.6} ry={7} fill={GREY.strong} />
    <ellipse cx={80} cy={55} rx={4.6} ry={7} fill={GREY.strong} />

    {/* Skull. */}
    <ellipse cx={50} cy={54} rx={29} ry={33} fill={GREY.strong} />

    {/* Hair cap. Not animated either; it exists to mark the seam the generated
        drawing has to land on, and to stop the head reading as an egg. */}
    <path
      d="M 21 46 C 21 22 79 22 79 46 C 74 34 66 30 50 30 C 34 30 26 34 21 46 Z"
      fill={GREY.graphite}
    />

    <Brow side={-1} pose={pose} />
    <Brow side={1} pose={pose} />
    <Eye side={-1} pose={pose} blink={blink} />
    <Eye side={1} pose={pose} blink={blink} />

    {/* Nose. A tick, and it never moves — it is the fixed reference the rest reads
        against, which is most of why a crude face reads at all. */}
    <line x1={50} y1={58} x2={50} y2={64} stroke={GREY.graphite} strokeWidth={3.6} strokeLinecap="round" />

    <Mouth pose={pose} />

    {headphones ? (
      <>
        {/* The band clears the brows. At its first pass it crossed them at y 36 and
            ate the one feature carrying most of the expression. */}
        <path
          d="M 12 54 C 12 17 88 17 88 54"
          fill="none"
          stroke={GREY.graphite}
          strokeWidth={5.5}
          strokeLinecap="round"
        />
        <rect x={7} y={46} width={12} height={20} rx={6} fill={GREY.graphite} />
        <rect x={81} y={46} width={12} height={20} rx={6} fill={GREY.graphite} />
      </>
    ) : null}
  </svg>
);

/**
 * The character, in a webcam crop. Head and shoulders, front on.
 *
 * The shoulders deliberately bleed past the box on both sides — that is what a webcam
 * frame looks like, and a person whose shoulders end inside the frame reads as a
 * cut-out sticker.
 */
export const CharacterRig: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  pose: Pose;
  /**
   * He is at his keyboard and his hands are going. Beats 7, 8 and 11 — and beat 11
   * especially, where the whole point is that the reading comes down **over** the
   * work rather than instead of it.
   */
  working?: boolean;
  headphones?: boolean;
  /** The music nod. Timed to ~117bpm, which is what Billie Jean actually is. */
  nod?: boolean;
}> = ({ x, y, w, h, pose, working = false, headphones = false, nod = false }) => {
  const frame = useCurrentFrame();
  const blink = useBlink();

  const breath = Math.sin((frame / (26 * pose.breathRate)) * Math.PI * 2);
  const sway = Math.sin(frame / 34) * 1.1;
  // 15.4 frames per beat at 30fps is 117bpm. A nod on the beat rather than a wobble.
  const nodPhase = nod ? Math.sin((frame / 15.4) * Math.PI * 2) : 0;
  // Two-finger typing, crudely: the hands alternate and the shoulders take a little
  // of it. Small — it should read as busy, not as agitated.
  const typing = working ? Math.sin(frame / 3.1) : 0;

  /**
   * The head is sized off BOTH dimensions, because the rig has to work in a 16:9
   * viewfinder and in beat 5's 3:4 calibration preview, and a head sized off height
   * alone is wider than the portrait box.
   *
   * Everything below the head is then positioned FROM the head rather than from the
   * box: the neck hangs off the chin and the shoulders overlap it. Placing the
   * shoulders at a fixed fraction of the box left a 15px band of backdrop between the
   * chin and the collar at 16:9, and a floating head is the one thing a talking-head
   * crop cannot survive.
   */
  const headSize = Math.min(h * 0.82, w * 0.9);
  const headLeft = (w - headSize) / 2 + sway;
  const headTop = h * 0.03 + pose.headY + nodPhase * 2.6 + breath * 0.5;
  // 0.87 of the head square is the bottom of the skull; see the ellipse in <Head>.
  const chin = headTop + headSize * 0.87;
  const shoulderTop = chin - headSize * 0.07 + pose.shoulderY + breath * 0.4 + Math.abs(typing) * 0.5;

  const HAND_W = w * 0.18;
  const handTop = h - HAND_W * 0.5;

  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, overflow: "hidden" }}>
      {/* Neck. Drawn first so the shoulders cover its bottom and the head its top. */}
      <div
        style={{
          position: "absolute",
          left: (w - headSize * 0.3) / 2 + sway * 0.7,
          top: chin - headSize * 0.16,
          width: headSize * 0.3,
          height: headSize * 0.34,
          backgroundColor: GREY.strong,
        }}
      />

      {/* Shoulders, bleeding both sides. A person whose shoulders end inside the
          frame reads as a cut-out sticker rather than as someone at a desk. */}
      <div
        style={{
          position: "absolute",
          left: -w * 0.08,
          top: shoulderTop,
          width: w * 1.16,
          height: Math.max(0, h - shoulderTop) + h * 0.1,
          borderRadius: `${w * 0.2}px ${w * 0.2}px 0 0`,
          backgroundColor: GREY.fill,
          translate: `${sway * 0.4}px 0px`,
        }}
      />

      {/* Hands, rising over the desk edge at the bottom of the crop. Crude, and the
          read comes from the alternation rather than the shape — but it is the only
          unambiguous way to say "he never stopped working", which beat 11 needs it to
          say. They are skin-coloured, not panel-coloured: at panel grey they matched
          the viewfinder backdrop and read as two notches cut out of his shoulders. */}
      {working
        ? ([-1, 1] as const).map((side) => (
            <div
              key={side}
              style={{
                position: "absolute",
                left: side === -1 ? w * 0.13 : w * 0.69,
                top: handTop - Math.max(0, typing * side) * w * 0.032,
                width: HAND_W,
                height: HAND_W * 0.95,
                borderRadius: `${HAND_W * 0.45}px ${HAND_W * 0.45}px 0 0`,
                backgroundColor: GREY.strong,
              }}
            />
          ))
        : null}

      {/* Head. */}
      <div
        style={{
          position: "absolute",
          left: headLeft,
          top: headTop,
          width: headSize,
          height: headSize,
          rotate: `${pose.headTilt + nodPhase * 1.1}deg`,
          transformOrigin: "50% 100%",
        }}
      >
        <Head pose={pose} blink={blink} headphones={headphones} />
      </div>
    </div>
  );
};
