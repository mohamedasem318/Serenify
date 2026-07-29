import React from "react";
import { AbsoluteFill, Easing, interpolate, Series, useCurrentFrame } from "remotion";

import { FaceBox } from "../actors";
import { Camera, shot } from "../Camera";
import { AppHeader, Desktop } from "../chrome";
import { CALIBRATION } from "../copy";
import { GREY, MONO } from "../theme";
import { Box, Button, Cursor, Text, useFade } from "../ui";

/**
 * Beat 5 · Calibration · 0:24–0:34 · 300 frames
 *
 * Where the character first appears — here in the green room, not beat 7,
 * because that is where you genuinely first see yourself.
 *
 * 5a intro (60) · 5b green room (90) · 5c countdown (30) · 5d recording (60)
 * · 5e success (60).
 */

/**
 * The 3:4 portrait framing target.
 *
 * Sized 480×640 rather than 540×720 for a camera reason, not a design one: the
 * beat has to hold the whole preview AND the status line beneath it, and at
 * 720px tall that composite forces the camera out past the point where his face
 * and the status line stay readable on a phone. Same ratio, same framing target,
 * ~90px less vertical extent to cover.
 */
const PREVIEW = { x: 720, y: 200, w: 480, h: 640 } as const;
/** Head-and-shoulders, inside the framing target. */
const FACE = { x: PREVIEW.x + 95, y: PREVIEW.y + 100, w: 290, h: 420 } as const;
const STATUS_Y = 858;

const Brackets: React.FC<{ cleared: number }> = ({ cleared }) => {
  // Graphite until the gate clears; the sheet has them turn meadow, kept grey
  // here because only band colour is built in this pass.
  const colour = cleared > 0.5 ? GREY.ink : GREY.graphite;
  const len = 56;
  const inset = 22;
  const t = 5;
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
          borderRadius: 14,
          boxShadow: `0 0 ${70 * cleared}px ${22 * cleared}px ${GREY.white}`,
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
      radius={14}
      label="camera preview · 3:4"
      labelSize={15}
    />
    <div style={{ filter: blur > 0 ? `blur(${blur}px)` : undefined }}>{children}</div>
  </>
);

// ── 5a · intro ──────────────────────────────────────────────────────────────

const SubA: React.FC = () => (
  <Camera
    keys={[
      { frame: 0, shot: shot(960, 540, 1420) },
      { frame: 60, shot: shot(960, 706, 760) },
    ]}
  >
    <Desktop clock="10:25 AM" url="serenify.tech/app/calibrate">
      <AppHeader />
      <Box x={560} y={200} w={800} h={700} fill={GREY.surface} border={GREY.border} radius={16} />
      <Text x={600} y={244} w={720} size={30} weight={700} align="center">
        {CALIBRATION.heading}
      </Text>
      {CALIBRATION.rows.map((row, i) => (
        <React.Fragment key={row}>
          <Box x={640} y={336 + i * 76} w={44} h={44} radius={10} fill={GREY.panel} />
          <Text x={704} y={348 + i * 76} size={19} color={GREY.body}>
            {row}
          </Text>
        </React.Fragment>
      ))}
      <Button x={810} y={682} w={300} h={50} size={18}>
        {CALIBRATION.turnOnCamera}
      </Button>
      <Cursor x={1058} y={702} clickAt={54} />
    </Desktop>
  </Camera>
);

// ── 5b · green room, first sight of him ─────────────────────────────────────
/**
 * The audience's first look at the protagonist. Everything in beats 7–11
 * depends on them having learned this face while it was calm, so it gets a real
 * hold and the slowest push in the video.
 */
const SubB: React.FC = () => {
  const frame = useCurrentFrame();
  // He settles into the framing target.
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
        { frame: 0, shot: shot(960, 545, 1420) },
        { frame: 90, shot: shot(960, 545, 1300) },
      ]}
    >
      <Desktop clock="10:25 AM" url="serenify.tech/app/calibrate">
        <AppHeader />
        <Preview>
          <div
            style={{
              translate: `${(1 - settle) * 74}px ${(1 - settle) * 46}px`,
              scale: 0.86 + settle * 0.14,
              transformOrigin: "50% 50%",
            }}
          >
            <FaceBox x={FACE.x} y={FACE.y} w={FACE.w} h={FACE.h} state="calm" labelSize={34} />
          </div>
        </Preview>
        <Brackets cleared={cleared} />

        {/* Small check, top-centre. */}
        <Text
          x={PREVIEW.x}
          y={PREVIEW.y + 36}
          w={PREVIEW.w}
          size={38}
          weight={700}
          align="center"
          opacity={check}
        >
          ✓
        </Text>

        <Text x={560} y={STATUS_Y} w={800} size={26} align="center" color={GREY.body} opacity={cleared}>
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
    <Camera keys={[{ frame: 0, shot: shot(960, 545, 1300) }]}>
      <Desktop clock="10:26 AM" url="serenify.tech/app/calibrate">
        <AppHeader />
        <Preview blur={8}>
          <FaceBox x={FACE.x} y={FACE.y} w={FACE.w} h={FACE.h} state="calm" labelSize={34} />
        </Preview>
        <div
          style={{
            position: "absolute",
            left: PREVIEW.x,
            top: PREVIEW.y + 210,
            width: PREVIEW.w,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 170,
            fontWeight: 700,
            color: GREY.white,
            opacity: interpolate(beat, [0, 2, 8, 10], [0, 1, 1, 0.2], { extrapolateRight: "clamp" }),
            textShadow: "0 0 40px rgba(0,0,0,0.35)",
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
 * other even though neither is running at wall-clock speed.
 */
const SubD: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 60], [0.08, 0.88], { extrapolateRight: "clamp" });
  const remaining = Math.round(60 * (1 - progress));
  const breathIn = Math.floor(frame / 20) % 2 === 0;
  const orb = 210 * (1 + Math.sin((frame / 40) * Math.PI * 2) * 0.09);

  return (
    <Camera
      keys={[
        { frame: 0, shot: shot(960, 566, 1360) },
        { frame: 60, shot: shot(960, 560, 1300) },
      ]}
    >
      <Desktop clock="10:26 AM" url="serenify.tech/app/calibrate">
        <AppHeader />
        <Preview blur={6}>
          <FaceBox x={FACE.x} y={FACE.y} w={FACE.w} h={FACE.h} state="calm" labelSize={34} />
        </Preview>

        {/* The breathing orb. */}
        <div
          style={{
            position: "absolute",
            left: 960 - orb / 2,
            top: 450 - orb / 2,
            width: orb,
            height: orb,
            borderRadius: orb / 2,
            backgroundColor: GREY.white,
            opacity: 0.82,
            boxShadow: `0 0 60px 16px ${GREY.white}`,
          }}
        />
        <Text x={690} y={606} w={540} size={30} weight={700} align="center" color={GREY.ink}>
          {breathIn ? CALIBRATION.breatheIn : CALIBRATION.breatheOut}
        </Text>

        {/* 6px progress bar. */}
        <Box x={PREVIEW.x} y={862} w={PREVIEW.w} h={6} radius={3} fill={GREY.ghost} border={GREY.ghost} />
        <Box
          x={PREVIEW.x}
          y={862}
          w={PREVIEW.w * progress}
          h={6}
          radius={3}
          fill={GREY.ink}
          border={GREY.ink}
        />
        <Text x={PREVIEW.x} y={884} w={PREVIEW.w} size={26} align="center" color={GREY.body} mono>
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
    return { size: 120 + t * 520, opacity: (1 - t) * 0.5 };
  };
  const draw = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <Camera
      keys={[
        { frame: 0, shot: shot(960, 540, 1260) },
        { frame: 60, shot: shot(960, 548, 1160) },
      ]}
    >
      <Desktop clock="10:27 AM" url="serenify.tech/app/calibrate">
        <AppHeader />
        <Preview blur={4}>
          <FaceBox x={FACE.x} y={FACE.y} w={FACE.w} h={FACE.h} state="calm" labelSize={34} />
        </Preview>

        {[0, 9, 18].map((d) => {
          const r = ripple(d);
          return (
            <div
              key={d}
              style={{
                position: "absolute",
                left: 960 - r.size / 2,
                top: 440 - r.size / 2,
                width: r.size,
                height: r.size,
                borderRadius: r.size / 2,
                // Graphite, not white: white rings on a light-grey page were
                // invisible in the render even though they were animating.
                border: `5px solid ${GREY.graphite}`,
                opacity: r.opacity,
              }}
            />
          );
        })}

        {/* The check draws itself. */}
        <svg width={160} height={160} style={{ position: "absolute", left: 880, top: 360 }}>
          <path
            d="M32 84 L66 116 L128 44"
            fill="none"
            stroke={GREY.white}
            strokeWidth={13}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={190}
            strokeDashoffset={190 * (1 - draw)}
          />
        </svg>

        <Text x={660} y={606} w={600} size={36} weight={700} align="center" opacity={useFade(24, 10)}>
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
