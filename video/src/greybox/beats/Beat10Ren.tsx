import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { RenAvatar, RenState } from "../actors";
import { Camera, frameRect, rect, union } from "../Camera";
import { AppHeader, Desktop } from "../chrome";
import { REN } from "../copy";
import { GREY } from "../theme";
import { Box, Text } from "../ui";

/**
 * Beat 10 · Ren · 0:51–0:58 · 210 frames
 *
 * A real three-turn exchange, each message legible, appearing one at a time with
 * a real beat between them — not all at once.
 *
 * THREE THINGS ARE NEW IN THIS REVISION:
 *
 * 1. **Ren's avatar is in frame for the entire exchange.** Revision 1 let the
 *    camera follow the messages, so the avatar left frame after turn 1 — which
 *    is a poor use of a character drawn specifically for this. Every landing here
 *    is a union of the avatar and the message being read, so the avatar never
 *    leaves. The avatar is parked at the vertical middle of the thread so all
 *    three unions stay tight.
 *
 * 2. **The avatar is drawn far larger than the app draws it** — 110px against
 *    `RenAvatar`'s 34px default and its 38/54px call sites — under a declared
 *    liberty, for the same reason the viewfinder is enlarged. This is the only
 *    place in the video where Ren's face is on screen long enough to be read.
 *
 * 3. **All four avatar states are timed:** `idle` before the exchange opens,
 *    `attentive` while he types his complaint, `thinking` while Ren composes the
 *    suggestion, `warm` from turn 3 onward (and held through beat 11).
 *
 * The `thinking` state is accompanied by a typing indicator, which **the app
 * does not have**. That is a declared liberty, not an oversight: the video shows
 * a feature that will be built later.
 *
 * The copy is placeholder — `014-recommendations` does not exist, and length is
 * what this beat tests. Turn 3 has to read as personal knowledge rather than a
 * canned tip; if the audience reads it as generic, the beat is dead, and that is
 * a copy problem to catch here rather than after art.
 */

const PANEL = rect(280, 130, 640, 520);
const AVATAR = rect(306, 250, 110, 110);
const T1 = rect(436, 186, 400, 54);
const T2 = rect(516, 262, 380, 72);
const T3 = rect(436, 366, 440, 96);

const APPEAR_AT = [20, 92, 138];
/** idle → attentive (he types) → thinking (Ren composes) → warm (held on). */
const renState = (frame: number): RenState =>
  frame >= 138 ? "warm" : frame >= 96 ? "thinking" : frame >= 44 ? "attentive" : "idle";

const TypingDots: React.FC<{ x: number; y: number; on: boolean }> = ({ x, y, on }) => {
  const frame = useCurrentFrame();
  if (!on) return null;
  return (
    <>
      <Box x={x} y={y} w={72} h={38} radius={11} fill={GREY.panelAlt} border={GREY.border} />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x + 18 + i * 15,
            top: y + 16,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: GREY.graphite,
            opacity: 0.35 + 0.65 * Math.abs(Math.sin((frame - i * 3) / 6)),
          }}
        />
      ))}
    </>
  );
};

export const Beat10Ren: React.FC = () => {
  const frame = useCurrentFrame();
  const state = renState(frame);

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          { frame: 0, shot: frameRect(union(AVATAR, T1), 24) },
          { frame: 40, shot: frameRect(union(AVATAR, T1), 24) },
          { frame: 58, shot: frameRect(union(AVATAR, T2), 24) },
          { frame: 104, shot: frameRect(union(AVATAR, T2), 24) },
          { frame: 124, shot: frameRect(union(AVATAR, T3), 24) },
          { frame: 210, shot: frameRect(union(AVATAR, T3), 24) },
        ]}
      >
        <Desktop clock="11:31 AM" url="serenify.tech/app/chat">
          <AppHeader />

          <Box x={PANEL.x} y={PANEL.y} w={PANEL.w} h={PANEL.h} fill={GREY.surface} border={GREY.border} radius={12} />
          <Text x={PANEL.x + 24} y={PANEL.y + 20} size={18} weight={700}>
            Ren
          </Text>

          {/* Parked, enlarged, and never out of frame. */}
          <RenAvatar x={AVATAR.x} y={AVATAR.y} size={AVATAR.w} state={state} />

          {[T1, T2, T3].map((b, i) => {
            const turn = REN.turns[i];
            const appear = interpolate(frame, [APPEAR_AT[i], APPEAR_AT[i] + 9], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            });
            const mine = turn.who === "him";

            return (
              <div key={i} style={{ opacity: appear, translate: `0px ${(1 - appear) * 12}px` }}>
                <Box
                  x={b.x}
                  y={b.y}
                  w={b.w}
                  h={b.h}
                  radius={12}
                  fill={mine ? GREY.graphite : GREY.panelAlt}
                  border={mine ? GREY.graphite : GREY.border}
                />
                <Text
                  x={b.x + 18}
                  y={b.y + 15}
                  w={b.w - 36}
                  size={16}
                  lineHeight={1.5}
                  color={mine ? GREY.white : GREY.ink}
                >
                  {turn.text}
                </Text>
              </div>
            );
          })}

          {/*
           * Ren composing. The app has NO typing indicator — showing one is the
           * declared liberty that makes the `thinking` state legible at all.
           */}
          <TypingDots x={T1.x} y={T1.y + 8} on={frame >= 6 && frame < APPEAR_AT[0]} />
          <TypingDots x={T3.x} y={T3.y + 20} on={state === "thinking"} />

          <Box x={AVATAR.x} y={580} w={590} h={40} label="message Ren" labelSize={10} fill={GREY.field} radius={10} />
        </Desktop>
      </Camera>
    </AbsoluteFill>
  );
};
