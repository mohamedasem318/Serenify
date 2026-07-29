import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { FaceBox } from "../actors";
import { Camera, frameRect, rect, shot, union } from "../Camera";
import { AppHeader, Desktop } from "../chrome";
import { CALIBRATION, DASHBOARD } from "../copy";
import { COL_W, COL_X, GREY, H, MONO, W } from "../theme";
import { Box, Button, Cursor, Text, TextBlock } from "../ui";

/**
 * Beat 5 · Calibration · 0:32–0:44 · 360 frames
 *
 * **ONE TAKE**, and the ending is now the real one.
 *
 * Revision 2 covered the viewfinder with a success state and then cut to the
 * dashboard, skipping two real steps. The actual chain is: the capture stage is
 * replaced by the **uploading** line, then the **success state**, then the user
 * **clicks the button on it** and lands on the dashboard. All three are here, and
 * the click was the missing action.
 *
 * 5a also **stays wide**. The three guideline rows are short and the whole intro
 * screen reads without magnification, so the old push-in onto "Turn on camera"
 * was buying nothing.
 *
 * COST: 10s → 12s. The uploading line is 1.3s and the success state plus its
 * click is 2.7s, offset slightly by 5a getting simpler.
 */

/** The 3:4 portrait framing target. */
const PREVIEW = rect(480, 160, 240, 320);
const FACE = rect(522, 224, 156, 216);
const STATUS = rect(380, 498, 440, 24);
const GREEN_ROOM = union(PREVIEW, STATUS);
const UPLOADING = rect(400, 300, 400, 80);
/** `max-w-md` (448), the check at `size-24` (96), the button `h-12` `max-w-xs`. */
const SUCCESS = rect(376, 170, 448, 302);
const INTRO_CARD = rect(340, 160, 520, 380);
const TURN_ON = rect(450, 440, 300, 44);

const T = {
  turnOnCamera: 48,
  greenRoom: 60,
  gateClear: 108,
  countdown: 150,
  recording: 180,
  uploading: 240,
  success: 280,
  doneClick: 334,
  dashboard: 344,
} as const;

const Brackets: React.FC<{ cleared: number }> = ({ cleared }) => {
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

export const Beat05Calibration: React.FC = () => {
  const frame = useCurrentFrame();

  const settle = interpolate(frame, [T.greenRoom, T.greenRoom + 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const cleared = interpolate(frame, [T.gateClear, T.gateClear + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const check = interpolate(frame, [T.gateClear + 8, T.gateClear + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const countdownLocal = frame - T.countdown;
  const n = countdownLocal < 10 ? 3 : countdownLocal < 20 ? 2 : 1;
  const countBeat = countdownLocal % 10;

  const recLocal = frame - T.recording;
  const progress = interpolate(recLocal, [0, 60], [0.08, 0.88], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const remaining = Math.round(60 * (1 - progress));
  const breathIn = Math.floor(recLocal / 20) % 2 === 0;
  const orb = 128 * (1 + Math.sin((recLocal / 40) * Math.PI * 2) * 0.09);

  const draw = interpolate(frame, [T.success + 8, T.success + 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const ripple = (delay: number) => {
    const t = interpolate(frame - T.success - delay, [0, 34], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    return { size: 70 + t * 300, opacity: (1 - t) * 0.45 };
  };

  const phase =
    frame >= T.dashboard
      ? "dashboard"
      : frame >= T.success
        ? "success"
        : frame >= T.uploading
          ? "uploading"
          : frame >= T.recording
            ? "recording"
            : frame >= T.countdown
              ? "countdown"
              : frame >= T.greenRoom
                ? "green"
                : "intro";
  const inPreview = phase === "green" || phase === "countdown" || phase === "recording";

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // 5a · wide. The intro reads without magnification.
          { frame: 0, shot: shot(W / 2, H / 2, W) },
          { frame: 60, shot: shot(W / 2, H / 2, W) },
          // 5b–5d · the green room, held through countdown and recording
          { frame: 96, shot: frameRect(GREEN_ROOM, 40) },
          { frame: 240, shot: frameRect(GREEN_ROOM, 40) },
          // 5e · the uploading line replaces the capture stage
          { frame: 268, shot: frameRect(UPLOADING, 40) },
          { frame: 288, shot: frameRect(UPLOADING, 40) },
          // 5f · the success state, and the click on its button
          { frame: 312, shot: frameRect(SUCCESS, 30) },
          { frame: 344, shot: frameRect(SUCCESS, 30) },
          // …which lands on the dashboard.
          { frame: 360, shot: shot(W / 2, H / 2, W) },
        ]}
      >
        <Desktop
          clock={frame >= T.recording ? "10:26 AM" : "10:25 AM"}
          url={phase === "dashboard" ? "serenify.tech/app" : "serenify.tech/app/calibrate"}
        >
          <AppHeader />

          {phase === "intro" ? (
            <>
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
              <Cursor x={660} y={454} clickAt={T.turnOnCamera} />
            </>
          ) : null}

          {inPreview ? (
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
              <div style={{ filter: phase === "green" ? undefined : "blur(6px)" }}>
                <div
                  style={{
                    translate: `${(1 - settle) * 38}px ${(1 - settle) * 24}px`,
                    scale: 0.86 + settle * 0.14,
                    transformOrigin: "50% 50%",
                  }}
                >
                  <FaceBox x={FACE.x} y={FACE.y} w={FACE.w} h={FACE.h} state="calm" labelSize={24} />
                </div>
              </div>
              {phase === "green" ? <Brackets cleared={cleared} /> : null}
            </>
          ) : null}

          {phase === "green" ? (
            <>
              <Text x={PREVIEW.x} y={PREVIEW.y + 28} w={PREVIEW.w} size={26} weight={700} align="center" opacity={check}>
                ✓
              </Text>
              <Text x={STATUS.x} y={STATUS.y} w={STATUS.w} size={18} align="center" color={GREY.body} opacity={cleared}>
                {CALIBRATION.ready}
              </Text>
            </>
          ) : null}

          {phase === "countdown" ? (
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
                opacity: interpolate(countBeat, [0, 2, 8, 10], [0, 1, 1, 0.2], { extrapolateRight: "clamp" }),
                textShadow: "0 0 24px rgba(0,0,0,0.35)",
              }}
            >
              {n}
            </div>
          ) : null}

          {phase === "recording" ? (
            <>
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
              <Box x={PREVIEW.x} y={494} w={PREVIEW.w} h={6} radius={3} fill={GREY.ghost} border={GREY.ghost} />
              <Box x={PREVIEW.x} y={494} w={PREVIEW.w * progress} h={6} radius={3} fill={GREY.ink} border={GREY.ink} />
              <Text x={STATUS.x} y={STATUS.y + 12} w={STATUS.w} size={16} align="center" color={GREY.body} mono>
                {`0:${String(remaining).padStart(2, "0")}`}
              </Text>
            </>
          ) : null}

          {/* 5e · the capture stage is REPLACED by this, verbatim from the app. */}
          {phase === "uploading" ? (
            <Text x={UPLOADING.x} y={UPLOADING.y + 30} w={UPLOADING.w} size={16} align="center" color={GREY.body}>
              {CALIBRATION.uploading}
            </Text>
          ) : null}

          {/* 5f · the success state, then the click that leaves it. */}
          {phase === "success" ? (
            <>
              {[0, 9, 18].map((d) => {
                const r = ripple(d);
                return (
                  <div
                    key={d}
                    style={{
                      position: "absolute",
                      left: 600 - r.size / 2,
                      top: 218 - r.size / 2,
                      width: r.size,
                      height: r.size,
                      borderRadius: r.size / 2,
                      border: `3px solid ${GREY.graphite}`,
                      opacity: r.opacity,
                    }}
                  />
                );
              })}
              <svg width={96} height={96} style={{ position: "absolute", left: 552, top: 170 }}>
                <path
                  d="M20 50 L39 69 L76 26"
                  fill="none"
                  stroke={GREY.graphite}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={116}
                  strokeDashoffset={116 * (1 - draw)}
                />
              </svg>
              <Text x={SUCCESS.x} y={292} w={SUCCESS.w} size={36} weight={700} align="center">
                {CALIBRATION.done}
              </Text>
              <Text x={SUCCESS.x} y={348} w={SUCCESS.w} size={16} align="center" color={GREY.body} lineHeight={1.5}>
                {CALIBRATION.doneBody}
              </Text>
              <Button x={440} y={424} w={320} h={48} size={16}>
                {CALIBRATION.doneCta}
              </Button>
              <Cursor x={640} y={438} clickAt={T.doneClick} />
            </>
          ) : null}

          {/* …and it lands here. Beat 6 continues from this frame. */}
          {phase === "dashboard" ? (
            <>
              <Box x={COL_X} y={166} w={COL_W} h={66} fill={GREY.surface} border={GREY.border} radius={10} />
              <Text x={COL_X + 24} y={178} size={24} weight={700}>
                {DASHBOARD.welcomeTitle}
              </Text>
              <Text x={COL_X + 24} y={210} size={14} color={GREY.body}>
                {DASHBOARD.welcomeBody}
              </Text>
              <Box x={COL_X} y={250} w={COL_W} h={150} label="today" fill={GREY.surface} />
              <TextBlock x={COL_X + 24} y={292} w={480} lines={3} />
              <Box x={COL_X} y={416} w={COL_W} h={140} label="trend" fill={GREY.surface} />
            </>
          ) : null}
        </Desktop>
      </Camera>
    </AbsoluteFill>
  );
};
