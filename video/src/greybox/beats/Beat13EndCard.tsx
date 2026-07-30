import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { Camera, shot } from "../Camera";
import { END_CARD } from "../copy";
import { GREY, H, MONO, W } from "../theme";
import { Box, Text } from "../ui";

/**
 * Beat 13 · End card · 1:16 – 1:22 · 180 frames
 *
 * Was beat 12 — the closing subtitle card is beat 12 now and this moved down one.
 *
 * **A sequence, not a static frame.** Three timed events:
 *
 *   1. the wordmark reveals   f0–46
 *   2. "take care of yourself" types on   f56–104
 *   3. "serenify.tech" types on   f114–146
 *
 * The wordmark's real animation gets designed later. It is a placeholder here — a
 * left-to-right wipe with a small settle — and what this pass tests is the *rhythm*
 * of the three events, not the reveal itself.
 *
 * Typing on rather than fading in, because it puts a readable pace on the two lines
 * and gives the VO something to land against.
 *
 * **+1s on the hold after "serenify.tech" types on**, as asked: 150 → 180 frames.
 * The hold runs f146–f180, 1.1s, and it is where the last narration line goes — room
 * in the cut rather than dead air.
 */

const REVEAL_FROM = 0;
const REVEAL_TO = 46;
const LINE_FROM = 56;
const LINE_TO = 104;
const DOMAIN_FROM = 114;
const DOMAIN_TO = 146;

/** Reveals a string left-to-right, one character at a time. */
const typeOn = (value: string, frame: number, from: number, to: number) =>
  value.slice(
    0,
    Math.round(
      interpolate(frame, [from, to], [0, value.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );

export const Beat13EndCard: React.FC = () => {
  const frame = useCurrentFrame();

  const wipe = interpolate(frame, [REVEAL_FROM, REVEAL_TO], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const settle = interpolate(frame, [REVEAL_TO - 10, REVEAL_TO + 8], [1.05, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const line = typeOn(END_CARD.line, frame, LINE_FROM, LINE_TO);
  const domain = typeOn(END_CARD.domain, frame, DOMAIN_FROM, DOMAIN_TO);
  const lineCaret = frame >= LINE_FROM && frame < DOMAIN_FROM - 4;
  const domainCaret = frame >= DOMAIN_FROM && frame < DOMAIN_TO + 10;

  return (
    <AbsoluteFill>
      <Camera keys={[{ frame: 0, shot: shot(W / 2, 310, 760) }]}>
        <Box x={0} y={0} w={W} h={H} fill={GREY.page} border={GREY.page} radius={0} />

        {/* 1 · the wordmark reveal — placeholder, timed. */}
        <div
          style={{
            position: "absolute",
            left: 490,
            top: 216,
            width: 220,
            height: 56,
            overflow: "hidden",
            scale: settle,
            transformOrigin: "50% 50%",
          }}
        >
          <div style={{ position: "absolute", left: 0, top: 0, width: 220 * wipe, height: 56, overflow: "hidden" }}>
            <Box x={0} y={0} w={220} h={56} label="wordmark reveal" labelSize={11} fill={GREY.panelAlt} radius={8} />
          </div>
        </div>

        {/* 2 · then this types on. */}
        <Text x={300} y={322} w={600} size={34} weight={700} align="center">
          {line}
          {lineCaret ? <span style={{ color: GREY.graphite }}>|</span> : null}
        </Text>

        {/* 3 · then this. */}
        <div
          style={{
            position: "absolute",
            left: 300,
            top: 382,
            width: 600,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 20,
            color: GREY.body,
          }}
        >
          {domain}
          {domainCaret ? <span style={{ color: GREY.graphite }}>|</span> : null}
        </div>
      </Camera>
    </AbsoluteFill>
  );
};
