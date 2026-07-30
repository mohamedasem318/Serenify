import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

import { OfficeBackdrop } from "./character/backdrop";
import { CharacterBase, SHIRT } from "./character/base";
import { FACE, Features, Hands, Headphones, MusicNote } from "./character/features";

/**
 * ── THE CHARACTER RIG ───────────────────────────────────────────────────────
 *
 * **The art is real now.** The spike answered its question — a face made of primitives
 * does carry beat 8's fall — and this is the same rig with the crude drawing swapped for
 * a stripped Avataaars base (`character/av2-base.svg`, MIT; provenance in
 * `character/NOTICE.md`). What did not change is the thing the spike was proving: the
 * thirteen-number pose vector below is untouched, expressions are still points in it, and
 * transitions are still interpolations.
 *
 * The page around the viewfinder is still greybox. That is deliberate — real `apps/web`
 * components are a separate pass.
 *
 * ── WHAT THE BASE OWNS AND WHAT THE RIG OWNS ────────────────────────────────
 *
 * The base supplies skull, hair, ears, neck, nose and clothing. It ships with **no
 * brows, eyes or mouth** — a head with its features baked in cannot be posed — so the rig
 * draws those, in `character/features.tsx`, and the single most important constraint on
 * this pass lives there: **Avataaars has no sclera.** Every facial feature in that system
 * is `#000000` at an opacity. The crude rig's white eyeballs and dark pupils would have
 * produced the same cartoon on better art, which is the one outcome that makes the swap
 * pointless.
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
 * is ~50px on a phone and only three or four features can register at all. So: few
 * parts, each bold, each doing real work.
 *
 *   1 · head        position, tilt — carries the nod and the sink
 *   2 · brows       height, inner-end angle — the largest single carrier of the fall
 *   3 · eyes        aperture (upper lid descends, lower lid fixed) — blink + tension
 *   4 · pupils      gaze offset
 *   5 · mouth       one curvature scalar (+smile / −frown), width, openness, skew
 *   6 · shoulders   slump, and the typing motion
 *   7 · hands       two shapes at the frame edge, alternating — "still working"
 *   8 · headphones  an overlay on the ears, beat 11 only
 *
 * The hair, the ears and the neck are not animated. They come from the base, and the
 * ears are where the headphones attach — at the **measured** ear centres (71, 117) and
 * (193, 117), which are five pixels below the eye line. The handover file claimed no ear
 * geometry existed; it does, baked into the skin path, and `character/NOTICE.md` has the
 * derivation.
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

// ── The framing window ──────────────────────────────────────────────────────

/**
 * **The rig is sized against the viewfinder's inner box, never against absolute values.**
 *
 * The viewfinder this pass frames against is a real `apps/web` component
 * (`components/monitor/viewfinder.tsx` — `w-56`, `aspect-video`, i.e. 224 × 126, drawn
 * here at 320 × 180 under liberty L1). When the greybox page is replaced by real
 * components that box changes size, and any character geometry expressed in viewfinder
 * pixels would have to be re-registered by hand.
 *
 * So nothing below is in viewfinder pixels. The rig picks a **framing window** in the
 * base's own `0 0 264 280` coordinates, hands it to the SVG as a viewBox, and lets the
 * browser do the fitting. Change the box to any size or aspect and the character re-frames
 * itself: the window keeps its top and bottom, and only its width follows the box.
 *
 *   top 22      two units into the hair, which is what a laptop webcam does to a person
 *               sitting close. The chin lands at y 181 and the head fills ~68% of frame
 *               height.
 *   bottom 262  far enough below the collar (y 222) that a band of shirt is in frame at
 *               the sides. Above ~240 the shoulders leave the frame entirely and he reads
 *               as a floating head.
 *
 * At 16:9 that gives a 427-wide window against artwork only 264 wide — which is the whole
 * reason the shoulder extension below exists.
 */
const WINDOW = { top: 22, bottom: 262 } as const;
const WINDOW_H = WINDOW.bottom - WINDOW.top;

/** The head clip line, at the neck. The two halves overlap by 2 to absorb head motion. */
const NECK_SPLIT = 187;

/**
 * **The shoulder extension**, and it is not the scale transform the handover suggested.
 *
 * The base's shoulders span x 32–232 inside a 264-wide box — about 12% padding a side —
 * against a framing spec that wants them running off both edges. A plain x-scale would
 * fix that and wreck the crew neck with it: the neck opening is part of the same path, so
 * scaling the shirt 2× scales the collar 2× and he ends up in a boat neck.
 *
 * So this draws a quadratic behind the base instead, in the shirt's exact `#25557C`.
 *
 * ── WHY IT TAKES OVER AT THE COLLAR AND NOT FURTHER OUT ─────────────────────
 *
 * The first version pinned the apex at y 228, safely below the collar notch, and it left a
 * **visible step**: the base's own shoulder arc drops steeply — from (99, 199) to (32,
 * 271), where it is already vertical — so a curve flat enough to reach the frame edges
 * crossed it around x 45, at which point the two silhouettes met at about a 35° angle. He
 * looked like he was wearing shoulder pads over a second shirt.
 *
 * The fix is to stop having two silhouettes. The apex sits at **y 199, level with the
 * shirt's own shoulder tops**, so the extension emerges from behind the base right at the
 * collar and every visible pixel of shoulder outboard of that is the extension's. The base
 * shirt is then entirely *inside* it and contributes nothing to the outline — which is why
 * there is no longer a crossing to hide.
 *
 * That apex would fill the crew neck, so the extension is clipped out of a box around it
 * (x 96–170, above y 226). All three of that box's edges are behind solid shirt: at x 96
 * and x 170 the shirt is solid from y ≈ 200 down — the neck opening only spans x 99–166 —
 * and the notch bottoms out at y 222, above the box's floor.
 *
 * `edgeY` is then solved rather than chosen, from the requirement that the curve passes
 * through the shirt's shoulder top at x 96. At 16:9 the curve is so flat there that the
 * solution barely constrains it — thirteen units of `edgeY` move it four tenths of one —
 * so it is clamped to keep a proper band of shirt in the bottom corners. At the 3:4
 * portrait preview the half-width is small, the constraint bites, and the clamp does not
 * apply: he simply shows more torso, which is what a portrait framing should do.
 */
const SHOULDER_APEX = 199;
/** The base shirt's own top edge at x 96, which is where the extension has to meet it. */
const SHOULDER_MEET = 200.5;

const ShoulderExtension: React.FC<{ winX: number; winW: number; uid: string }> = ({
  winX,
  winW,
  uid,
}) => {
  const a = winW / 2;
  // Solving y(96) = SHOULDER_MEET for a symmetric quadratic gives exactly this. The
  // clamp keeps at least 26 units of shirt in the bottom corners at wide aspects.
  const edgeY = Math.min(
    SHOULDER_APEX + (a * a * (SHOULDER_MEET - SHOULDER_APEX)) / 1296,
    WINDOW.bottom - 26,
  );
  const x0 = winX - 2;
  const x1 = winX + winW + 2;
  // A quadratic sits at half its control's offset at the midpoint, so this puts the apex
  // exactly on SHOULDER_APEX whatever the ends are doing.
  const ctrlY = 2 * SHOULDER_APEX - edgeY;
  const floor = WINDOW.bottom + 60;

  return (
    <>
      <defs>
        {/* Everything except the collar box, as the union of three rectangles. */}
        <clipPath id={`${uid}-shoulder`}>
          <rect x={x0 - 40} y={0} width={96 - x0 + 40} height={floor} />
          <rect x={170} y={0} width={x1 - 170 + 40} height={floor} />
          <rect x={x0 - 40} y={226} width={winW + 160} height={floor} />
        </clipPath>
      </defs>
      <path
        d={`M ${x0} ${edgeY} Q ${FACE.cx} ${ctrlY} ${x1} ${edgeY} L ${x1} ${floor} L ${x0} ${floor} Z`}
        fill={SHIRT}
        clipPath={`url(#${uid}-shoulder)`}
      />
    </>
  );
};

// ── The drawing ─────────────────────────────────────────────────────────────

/**
 * Drifting notes, in the character's own coordinates so they hold their size against his
 * head at any framing. Beat 11 only. The drift and the fade are the greybox's, unchanged
 * — that read is liked; only the glyphs moved into the base's vocabulary.
 */
const Notes: React.FC<{ startFrame: number; winX: number; winW: number }> = ({
  startFrame,
  winX,
  winW,
}) => {
  const frame = useCurrentFrame();
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => {
        const local = frame - startFrame - i * 13;
        if (local < 0) return null;
        const cycle = local % 70;
        const y = interpolate(cycle, [0, 70], [WINDOW.bottom - 20, WINDOW.top + 24]);
        const fade = interpolate(cycle, [0, 10, 52, 70], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const drift = Math.sin(cycle / 9 + i) * winW * 0.05;
        return (
          <MusicNote
            key={i}
            x={winX + winW * (0.12 + i * 0.18) + drift}
            y={y}
            scale={1.15}
            opacity={fade}
            beamed={i % 2 === 1}
          />
        );
      })}
    </>
  );
};

/**
 * The character, in a webcam crop: office behind him, head and shoulders, front on, and
 * the shoulders running off both sides of the frame.
 *
 * **Nothing here is in viewfinder pixels.** The box only decides the framing window's
 * aspect; everything inside is in the base's own coordinates. So the same component fills
 * beat 5's 3:4 calibration preview and the 16:9 viewfinder without a second set of
 * numbers, and it will re-fit whatever inner box the real `apps/web` viewfinder turns out
 * to have.
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
  /** Frame the drifting notes start at. Beat 11 only. */
  notesFrom?: number;
  /** Disambiguates SVG ids when more than one rig is on screen (the spike bench). */
  uid?: string;
}> = ({ x, y, w, h, pose, working = false, headphones = false, nod = false, notesFrom, uid = "rig" }) => {
  const frame = useCurrentFrame();
  const blink = useBlink();

  const breath = Math.sin((frame / (26 * pose.breathRate)) * Math.PI * 2);
  const sway = Math.sin(frame / 34) * 1.4;
  // 15.4 frames per beat at 30fps is 117bpm. A nod on the beat rather than a wobble.
  const nodPhase = nod ? Math.sin((frame / 15.4) * Math.PI * 2) : 0;
  // Two-finger typing, crudely: the hands alternate and the shoulders take a little
  // of it. Small — it should read as busy, not as agitated.
  const typing = working ? Math.sin(frame / 3.1) : 0;

  // The window keeps its top and bottom; only its width follows the box's aspect.
  const winW = (WINDOW_H * w) / h;
  const winX = FACE.cx - winW / 2;

  // The head pivots at the base of the neck, so a tilt swings the chin and not the collar.
  const headDx = sway;
  const headDy = pose.headY + nodPhase * 2.6 + breath * 0.5;
  const headRot = pose.headTilt + nodPhase * 1.1;
  const bodyDx = sway * 0.4;
  const bodyDy = pose.shoulderY + breath * 0.4 + Math.abs(typing) * 0.5;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        overflow: "hidden",
      }}
    >
      <svg
        viewBox={`${winX} ${WINDOW.top} ${winW} ${WINDOW_H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: "block" }}
      >
        <defs>
          {/* The two halves of him, split at the neck and overlapping by two units so the
              head's whole range of motion never opens a gap. */}
          <clipPath id={`${uid}-head`}>
            <rect x={winX - 60} y={WINDOW.top - 120} width={winW + 120} height={NECK_SPLIT + 1 - (WINDOW.top - 120)} />
          </clipPath>
          <clipPath id={`${uid}-body`}>
            <rect x={winX - 60} y={NECK_SPLIT - 1} width={winW + 120} height={400} />
          </clipPath>
        </defs>

        <OfficeBackdrop x={winX} y={WINDOW.top} w={winW} h={WINDOW_H} />
        <ShoulderExtension winX={winX} winW={winW} uid={uid} />

        {/* Shoulders and clothing. */}
        <g transform={`translate(${bodyDx} ${bodyDy})`} clipPath={`url(#${uid}-body)`}>
          <CharacterBase uid={`${uid}-b`} part="body" />
        </g>

        {/* Head, and everything the expression vector moves. */}
        <g transform={`rotate(${headRot} ${FACE.cx} 190) translate(${headDx} ${headDy})`}>
          <g clipPath={`url(#${uid}-head)`}>
            <CharacterBase uid={`${uid}-h`} part="head" />
          </g>
          <Features pose={pose} blink={blink} uid={uid} />
          {headphones ? <Headphones /> : null}
        </g>

        {working ? <Hands bottom={WINDOW.bottom} typing={typing} /> : null}
        {notesFrom === undefined ? null : <Notes startFrame={notesFrom} winX={winX} winW={winW} />}
      </svg>
    </div>
  );
};
