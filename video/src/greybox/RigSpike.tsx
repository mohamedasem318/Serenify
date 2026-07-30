import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { CharacterRig, Expression, POSE, useExpression } from "./rig";
import { FONT, GREY, MONO } from "./theme";

/**
 * **The rig spike's own bench. Not a beat, and it never appears in the cut.**
 *
 * It exists to answer one question at a size where the answer is visible: *can a face
 * made of primitives fall convincingly?* The cut can only be watched at the framings
 * the beats give it, which is exactly where a broken rig hides — so this shows the
 * same rig three ways at once:
 *
 *   · the five named poses, static and large, so each can be read on its own terms
 *   · the beat-8 fall at its **real timings**, large — content, then 14 frames of
 *     travel into dismayed at f78, then the settle into tense at f118
 *   · the same fall at the viewfinder's **real on-screen size** (512×288, i.e. the
 *     320×180 viewfinder scaled by L7's 1.6×), which is the honest test
 *
 * If the fall reads in the middle panel but not the right one, the rig works and the
 * problem is the viewfinder's size. If it fails in both, the finding is that authored
 * primitives cannot carry beat 8 — which is the more valuable answer and the reason
 * this is a spike rather than an art task.
 */

const NAMES = Object.keys(POSE) as Expression[];

const Label: React.FC<{ x: number; y: number; w: number; text: string; size?: number }> = ({
  x,
  y,
  w,
  text,
  size = 20,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      textAlign: "center",
      fontFamily: MONO,
      fontSize: size,
      fontWeight: 700,
      letterSpacing: 1,
      color: GREY.label,
      textTransform: "uppercase",
    }}
  >
    {text}
  </div>
);

const Plate: React.FC<{ x: number; y: number; w: number; h: number; children?: React.ReactNode }> = ({
  x,
  y,
  w,
  h,
  children,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      backgroundColor: GREY.panelAlt,
      border: `2px solid ${GREY.graphite}`,
      borderRadius: 10,
      overflow: "hidden",
    }}
  >
    {children}
  </div>
);

/** One static pose, so the five can be compared against each other. */
const Still: React.FC<{ state: Expression; x: number; y: number }> = ({ state, x, y }) => {
  const pose = useExpression([{ frame: 0, state }]);
  return (
    <>
      <Plate x={x} y={y} w={280} h={280} />
      <CharacterRig x={x} y={y} w={280} h={280} pose={pose} working={state !== "calm"} uid={`still-${state}`} />
      <Label x={x} y={y + 292} w={280} text={state} />
    </>
  );
};

/** Beat 8's keyframes, verbatim. Changing these here would defeat the point. */
const FALL: { frame: number; state: Expression }[] = [
  { frame: 0, state: "content" },
  { frame: 78, state: "content" },
  { frame: 92, state: "dismayed" },
  { frame: 118, state: "dismayed" },
  { frame: 146, state: "tense" },
];

export const RigSpike: React.FC = () => {
  const frame = useCurrentFrame();
  const fall = useExpression(FALL);
  const working = frame < 78;

  const phase =
    frame >= 146 ? "tense" : frame >= 118 ? "settling → tense" : frame >= 92 ? "dismayed" : frame >= 78 ? "FALLING" : "content";

  return (
    <AbsoluteFill style={{ backgroundColor: GREY.page, fontFamily: FONT }}>
      <Label x={0} y={36} w={1920} text="character rig · spike bench · not a beat" size={22} />

      {/* The five poses, static. */}
      {NAMES.map((state, i) => (
        <Still key={state} state={state} x={168 + i * 320} y={92} />
      ))}

      {/* The fall, large. */}
      <Label x={200} y={438} w={520} text="beat 8's fall · real timings · large" size={18} />
      <Plate x={200} y={470} w={520} h={520} />
      <CharacterRig x={200} y={470} w={520} h={520} pose={fall} working={working} uid="fall-large" />

      {/* The fall, at the size it actually plays at in the cut. */}
      <Label x={840} y={438} w={512} text="the same fall at real viewfinder size (512 × 288)" size={18} />
      <Plate x={840} y={470} w={512} h={288} />
      <CharacterRig x={840} y={470} w={512} h={288} pose={fall} working={working} uid="fall-real" />

      {/* And at beat 11: headphones, nod, still working. */}
      <Label x={840} y={790} w={512} text="beat 11 · easing · headphones · nod · still working" size={18} />
      <Plate x={840} y={822} w={512} h={288} />
      <Beat11Sample x={840} y={822} />

      {/* A frame readout, so a still frame says where in the transition it is. */}
      <div
        style={{
          position: "absolute",
          left: 1420,
          top: 470,
          width: 340,
          fontFamily: MONO,
          fontSize: 26,
          fontWeight: 700,
          color: GREY.ink,
          lineHeight: 2,
        }}
      >
        <div>{`frame ${String(frame).padStart(3, "0")}`}</div>
        <div style={{ color: GREY.body }}>{phase}</div>
        <div style={{ fontSize: 17, color: GREY.label, lineHeight: 1.6, marginTop: 18 }}>
          brow inner {fall.browInner.toFixed(2)}
          <br />
          mouth curve {fall.mouthCurve.toFixed(2)}
          <br />
          eye open {fall.eyeOpen.toFixed(2)}
          <br />
          head y {fall.headY.toFixed(2)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Beat11Sample: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const frame = useCurrentFrame();
  const pose = useExpression([
    { frame: 0, state: "tense" },
    { frame: 74, state: "tense" },
    { frame: 104, state: "easing" },
  ]);
  return (
    <CharacterRig
      x={x}
      y={y}
      w={512}
      h={288}
      pose={pose}
      working={frame >= 62}
      headphones={frame >= 74}
      nod={frame >= 108}
      notesFrom={84}
      uid="beat11"
    />
  );
};
