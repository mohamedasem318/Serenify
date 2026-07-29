import React from "react";
import { AbsoluteFill, Easing, interpolate, Series, useCurrentFrame } from "remotion";

import { FaceBox } from "../actors";
import { Camera, frameRect, rect, union } from "../Camera";
import { AppHeader, Desktop } from "../chrome";
import { CALIBRATION } from "../copy";
import { GREY, MONO } from "../theme";
import { Box, Button, Cursor, Text, useFade } from "../ui";

/**
 * Beat 5 · Calibration · 0:26–0:36 · 300 frames
 *
 * Where the character first appears — here in the green room, not beat 7,
 * because that is where you genuinely first see yourself.
 *
 * 5a intro (60) · 5b green room (90) · 5c countdown (30) · 5d recording (60)
 * · 5e success (60).
 */

/** The 3:4 portrait framing target. */
const PREVIEW = rect(480, 160, 240, 320);
/** Head and shoulders, inside the framing target. */
const FACE = rect(522, 224, 156, 216);
const STATUS = rect(380, 498, 440, 24);
/** Preview + status line, framed together — both complete, both readable. */
const GREEN_ROOM = union(PREVIEW, STATUS);

const Brackets: React.FC<{ cleared: number }> = ({ cleared }) => {
  // Graphite until the gate clears; the sheet has them turn meadow, kept grey
  // here because only band colour is built in this pass.
  const colour = cleared > 0.5 ? GREY.ink : GREY.graphite;
  const len = 38;
  const inset = 16;
  const t = 4;
  const corners = [
    { x: PREVIEW.x + inset, y: PREVIEW.y + inset, sx: 1, sy: 1 },
    { x: PREVIEW.x + PREVIEW.w - inset, y: PREVIEW.y + inset, sx: -1, sy: 1 },
    { x: PREVIEW.x + inset, y: PREVIEW.y + PREVIEW.h - inset, sx: 1, sy: -1 },
    { x: PREVIEW.x + PREVIEW.w - inset, y: PREVIEW.y + PREVIEW.h - inset, sx: -1, sy: -1 },
  ];

  return (
    <>
      {corners.map((c, i) => (
        <React.Fragment key={i}>
          <div
            style={{
              position: "absolute",
              left: c.sx === 1 ? c.x : c.x - len,
              top: c.sy === 1 ? c.y : c.y - t,
              width: len,
              height: t,
              backgroundColor: colour,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: c.sx === 1 ? c.x : c.x - t,
              top: c.sy === 1 ? c.y : c.y - len,
              width: t,
              height: len,
              backgroundColor: colour,
            }}
          />
        </React.Fragment>
      ))}
      {/* The glow that blooms when the gate clears. */}
      <div
        style={{
          position: "absolute",
          left: PREVIEW.x,
          top: PREVIEW.y,
          width: PREVIEW.w,
          height: PREVIEW.h,
          borderRadius: 12,
          boxShadow: `0 0 ${48 * cleared}px ${15 * cleared}px ${GREY.white}`,
          opacity: cleared,
        }}
      />
    </>
  );
};

const Preview: React.FC<{ blur?: number; children?: React.ReactNode }> = ({ blur = 0, children }) => (
  <>
    <Box
      x={PREVIEW.x}
      y={PREVIEW.y}
      w={PREVIEW.w}
      h={PREVIEW.h}
      fill={GREY.panelAlt}
      border={GREY.border}
      radius={12}
      label="camera preview · 3:4"
      labelSize={10}
    />
    <div style={{ filter: blur > 0 ? `blur(${blur}px)` : undefined }}>{children}</div>
  </>
);

// ── 5a · intro ──────────────────────────────────────────────────────────────

const INTRO_CARD = rect(340, 160, 520, 380);
const TURN_ON = rect(450, 440, 300, 44);

const SubA: React.FC = () => (
  <Camera
    keys={[
      { frame: 0, shot: frameRect(INTRO_CARD, 24) },
      { frame: 60, shot: frameRect(TURN_ON, 60) },
    ]}
  >
    <Desktop clock="10:25 AM" url="serenify.tech/app/calibrate">
      <AppHeader />
      <Box
        x={INTRO_CARD.x}
        y={INTRO_CARD.y}
        w={INTRO_CARD.w}
        h={INTRO_CARD.h}
        fill={GREY.surface}
        border={GREY.border}
        radius={12}
      />
      <Text x={INTRO_CARD.x + 20} y={INTRO_CARD.y + 22} w={480} size={24} weight={700} align="center">
        {CALIBRATION.heading}
      </Text>
      {/* Texture, not information — the camera pushes past these fast. */}
      {CALIBRATION.rows.map((row, i) => (
        <React.Fragment key={row}>
          <Box x={410} y={232 + i * 40} w={30} h={30} radius={8} fill={GREY.panel} />
          <Text x={454} y={239 + i * 40} size={15} color={GREY.body}>
            {row}
          </Text>
        </React.Fragment>
      ))}
      <Button x={TURN_ON.x} y={TURN_ON.y} w={TURN_ON.w} h={TURN_ON.h} size={15}>
        {CALIBRATION.turnOnCamera}
      </Button>
      <Cursor x={660} y={454} clickAt={54} />
    </Desktop>
  </Camera>
);

// ── 5b · green room, first sight of him ─────────────────────────────────────
/**
 * The audience's first look at the protagonist. Everything in beats 7–11 depends
 * on them having learned this face while it was calm, so it gets a real hold and
 * the slowest push in the video.
 */
const SubB: React.FC = () => {
  const frame = useCurrentFrame();
  const settle = interpolate(frame, [0, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const cleared = interpolate(frame, [42, 54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const check = useFade(50, 8);

  return (
    <Camera
      keys={[
        { frame: 0, shot: frameRect(GREEN_ROOM, 40) },
        { frame: 90, shot: frameRect(GREEN_ROOM, 20) },
      ]}
    >
      <Desktop clock="10:25 AM" url="serenify.tech/app/calibrate">
        <AppHeader />
        <Preview>
          <div
            style={{
              translate: `${(1 - settle) * 38}px ${(1 - settle) * 24}px`,
              scale: 0.86 + settle * 0.14,
              transformOrigin: "50% 50%",
            }}
          >
            <FaceBox x={FACE.x} y={FACE.y} w={FACE.w} h={FACE.h} state="calm" labelSize={24} />
          </div>
        </Preview>
        <Brackets cleared={cleared} />

        {/* Small check, top-centre. */}
        <Text x={PREVIEW.x} y={PREVIEW.y + 28} w={PREVIEW.w} size={26} weight={700} align="center" opacity={check}>
          ✓
        </Text>

        <Text x={STATUS.x} y={STATUS.y} w={STATUS.w} size={18} align="center" color={GREY.body} opacity={cleared}>
          {CALIBRATION.ready}
        </Text>
      </Desktop>
    </Camera>
  );
};

// ── 5c · countdown ──────────────────────────────────────────────────────────
// 3 → 2 → 1 compressed into one second, not three.

const SubC: React.FC = () => {
  const frame = useCurrentFrame();
  const n = frame < 10 ? 3 : frame < 20 ? 2 : 1;
  const beat = frame % 10;

  return (
    <Camera keys={[{ frame: 0, shot: frameRect(GREEN_ROOM, 20) }]}>
      <Desktop clock="10:26 AM" url="serenify.tech/app/calibrate">
        <AppHeader />
        <Preview blur={6}>
          <FaceBox x={FACE.x} y={FACE.y} w={FACE.w} h={FACE.h} state="calm" labelSize={24} />
        </Preview>
        <div
          style={{
            position: "absolute",
            left: PREVIEW.x,
            top: PREVIEW.y + 108,
            width: PREVIEW.w,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 110,
            fontWeight: 700,
            color: GREY.white,
            opacity: interpolate(beat, [0, 2, 8, 10], [0, 1, 1, 0.2], { extrapolateRight: "clamp" }),
            textShadow: "0 0 24px rgba(0,0,0,0.35)",
          }}
        >
          {n}
        </div>
      </Desktop>
    </Camera>
  );
};

// ── 5d · recording ──────────────────────────────────────────────────────────
/**
 * ~2s of a 60s process — the most aggressive compression in the video, and the
 * sheet is right that the orb's rhythm sells the idea instantly. The timer and
 * the 6px progress bar are ramped together so they stay consistent with each
 * other even though neither runs at wall-clock speed.
 */
const SubD: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 60], [0.08, 0.88], { extrapolateRight: "clamp" });
  const remaining = Math.round(60 * (1 - progress));
  const breathIn = Math.floor(frame / 20) % 2 === 0;
  const orb = 128 * (1 + Math.sin((frame / 40) * Math.PI * 2) * 0.09);

  return (
    <Camera keys={[{ frame: 0, shot: frameRect(GREEN_ROOM, 20) }]}>
      <Desktop clock="10:26 AM" url="serenify.tech/app/calibrate">
        <AppHeader />
        <Preview blur={5}>
          <FaceBox x={FACE.x} y={FACE.y} w={FACE.w} h={FACE.h} state="calm" labelSize={24} />
        </Preview>

        {/* The breathing orb. */}
        <div
          style={{
            position: "absolute",
            left: 600 - orb / 2,
            top: 276 - orb / 2,
            width: orb,
            height: orb,
            borderRadius: orb / 2,
            backgroundColor: GREY.white,
            opacity: 0.82,
            boxShadow: `0 0 40px 10px ${GREY.white}`,
          }}
        />
        <Text x={PREVIEW.x} y={370} w={PREVIEW.w} size={18} weight={700} align="center" color={GREY.ink}>
          {breathIn ? CALIBRATION.breatheIn : CALIBRATION.breatheOut}
        </Text>

        {/* 6px progress bar. */}
        <Box x={PREVIEW.x} y={494} w={PREVIEW.w} h={6} radius={3} fill={GREY.ghost} border={GREY.ghost} />
        <Box x={PREVIEW.x} y={494} w={PREVIEW.w * progress} h={6} radius={3} fill={GREY.ink} border={GREY.ink} />
        <Text x={STATUS.x} y={STATUS.y + 12} w={STATUS.w} size={16} align="center" color={GREY.body} mono>
          {`0:${String(remaining).padStart(2, "0")}`}
        </Text>
      </Desktop>
    </Camera>
  );
};

// ── 5e · success ────────────────────────────────────────────────────────────

const SubE: React.FC = () => {
  const frame = useCurrentFrame();
  const ripple = (delay: number) => {
    const t = interpolate(frame - delay, [0, 34], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    return { size: 70 + t * 300, opacity: (1 - t) * 0.5 };
  };
  const draw = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const done = useFade(24, 10);

  return (
    <Camera keys={[{ frame: 0, shot: frameRect(GREEN_ROOM, 20) }]}>
      <Desktop clock="10:27 AM" url="serenify.tech/app/calibrate">
        <AppHeader />
        <Preview blur={4}>
          <FaceBox x={FACE.x} y={FACE.y} w={FACE.w} h={FACE.h} state="calm" labelSize={24} />
        </Preview>

        {[0, 9, 18].map((d) => {
          const r = ripple(d);
          return (
            <div
              key={d}
              style={{
                position: "absolute",
                left: 600 - r.size / 2,
                top: 272 - r.size / 2,
                width: r.size,
                height: r.size,
                borderRadius: r.size / 2,
                // Graphite, not white: white rings on a light-grey page were
                // invisible in the render even though they were animating.
                border: `3px solid ${GREY.graphite}`,
                opacity: r.opacity,
              }}
            />
          );
        })}

        {/* The check draws itself. */}
        <svg width={100} height={100} style={{ position: "absolute", left: 550, top: 222 }}>
          <path
            d="M20 52 L41 72 L80 27"
            fill="none"
            stroke={GREY.white}
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={120}
            strokeDashoffset={120 * (1 - draw)}
          />
        </svg>

        <Text x={STATUS.x} y={STATUS.y - 4} w={STATUS.w} size={22} weight={700} align="center" opacity={done}>
          {CALIBRATION.done}
        </Text>
      </Desktop>
    </Camera>
  );
};

export const Beat05Calibration: React.FC = () => (
  <AbsoluteFill>
    <Series>
      <Series.Sequence durationInFrames={60} name="5a intro">
        <SubA />
      </Series.Sequence>
      <Series.Sequence durationInFrames={90} name="5b green room">
        <SubB />
      </Series.Sequence>
      <Series.Sequence durationInFrames={30} name="5c countdown">
        <SubC />
      </Series.Sequence>
      <Series.Sequence durationInFrames={60} name="5d recording">
        <SubD />
      </Series.Sequence>
      <Series.Sequence durationInFrames={60} name="5e success">
        <SubE />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
