import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { RenAvatar, RenState } from "../actors";
import { Camera, frameRect, rect, union } from "../Camera";
import { AppHeader, Desktop } from "../chrome";
import { REN } from "../copy";
import { GREY } from "../theme";
import { Box, Text } from "../ui";

/**
 * Beat 10 · Ren · 0:56–1:03 · 210 frames
 *
 * A real three-turn exchange, each message legible, appearing one at a time with a
 * real beat between them.
 *
 * **THE AVATAR IS A CHAT AVATAR NOW.** Revision 2 parked one ~300px circle between
 * the two bubbles, belonging to neither, so nothing on screen said which side of
 * the conversation was Ren — the one thing this beat cannot afford to be unclear
 * about. It is now attached to each of Ren's own bubbles, and the app's real
 * conventions do the work they are there to do
 * (`components/chat/chat-shell.tsx` `MessageBubble`):
 *
 *   Ren  → `self-start`, bordered `bg-surface`, `rounded-bl-sm` (left)
 *   him  → `self-end`, filled `bg-foggy`, `rounded-br-sm` (right)
 *
 * Both at `text-[15px]`, `max-w-[74%]`. The squared bottom-left corner on Ren's
 * bubbles is exactly where the avatar sits, so the pairing reads without help.
 *
 * The enlargement liberty (L8) stands: 96px against `RenAvatar`'s 34px default and
 * its 38/54px call sites. The app draws no avatar beside messages at all, so
 * attaching one is part of the same liberty.
 *
 * All four states are timed: `idle` before the exchange opens, `attentive` while he
 * types his complaint, `thinking` while Ren composes the suggestion (with the
 * typing indicator the app does not have — L9), `warm` from turn 3 into beat 11.
 *
 * The copy is placeholder — `014-recommendations` does not exist, and length is
 * what this beat tests. Turn 3 must read as personal knowledge, not a canned tip.
 */

const PANEL = rect(280, 130, 640, 520);

/** Ren's bubbles carry an avatar; his own do not. Sides are the app's. */
const A1 = rect(300, 168, 96, 96);
const B1 = rect(408, 190, 400, 52);
const B2 = rect(452, 286, 420, 74);
const A3 = rect(300, 384, 96, 96);
const B3 = rect(408, 376, 440, 112);

const APPEAR_AT = [20, 92, 138];
const renState = (frame: number): RenState =>
  frame >= 138 ? "warm" : frame >= 96 ? "thinking" : frame >= 44 ? "attentive" : "idle";

const TypingDots: React.FC<{ x: number; y: number; on: boolean }> = ({ x, y, on }) => {
  const frame = useCurrentFrame();
  if (!on) return null;
  return (
    <>
      <Box x={x} y={y} w={72} h={38} radius={12} fill={GREY.surface} border={GREY.border} />
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

/** `rounded-2xl` with the corner nearest the speaker squared off. */
const Bubble: React.FC<{ r: typeof B1; mine: boolean; text: string; opacity: number }> = ({
  r,
  mine,
  text,
  opacity,
}) => (
  <div style={{ opacity }}>
    <div
      style={{
        position: "absolute",
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        boxSizing: "border-box",
        backgroundColor: mine ? GREY.graphite : GREY.surface,
        border: `1px solid ${mine ? GREY.graphite : GREY.border}`,
        borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
      }}
    />
    <Text x={r.x + 14} y={r.y + 14} w={r.w - 28} size={15} lineHeight={1.5} color={mine ? GREY.white : GREY.ink}>
      {text}
    </Text>
  </div>
);

export const Beat10Ren: React.FC = () => {
  const frame = useCurrentFrame();
  const state = renState(frame);
  const appear = (i: number) =>
    interpolate(frame, [APPEAR_AT[i], APPEAR_AT[i] + 9], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });

  return (
    <AbsoluteFill>
      <Camera
        keys={[
          // Each landing holds a Ren avatar and the message being read, so Ren is
          // never off screen and never ambiguous.
          { frame: 0, shot: frameRect(union(A1, B1), 26) },
          { frame: 40, shot: frameRect(union(A1, B1), 26) },
          { frame: 58, shot: frameRect(union(A1, B2), 26) },
          { frame: 124, shot: frameRect(union(A1, B2), 26) },
          { frame: 146, shot: frameRect(union(A3, B3), 26) },
          { frame: 210, shot: frameRect(union(A3, B3), 26) },
        ]}
      >
        <Desktop clock="11:31 AM" url="serenify.tech/app/chat">
          <AppHeader />

          <Box x={PANEL.x} y={PANEL.y} w={PANEL.w} h={PANEL.h} fill={GREY.page} border={GREY.border} radius={12} />
          <Text x={PANEL.x + 24} y={PANEL.y + 12} size={18} weight={700}>
            Ren
          </Text>

          {/* Turn 1 — Ren. Avatar attached. */}
          <div style={{ opacity: appear(0) }}>
            <RenAvatar x={A1.x} y={A1.y} size={A1.w} state={state} />
          </div>
          <Bubble r={B1} mine={false} text={REN.turns[0].text} opacity={appear(0)} />

          {/* Turn 2 — him. Right side, filled, no avatar. */}
          <Bubble r={B2} mine text={REN.turns[1].text} opacity={appear(1)} />

          {/* Turn 3 — Ren. Avatar attached. */}
          <div style={{ opacity: appear(2) }}>
            <RenAvatar x={A3.x} y={A3.y} size={A3.w} state={state} />
          </div>
          <Bubble r={B3} mine={false} text={REN.turns[2].text} opacity={appear(2)} />

          {/* Ren composing, before each of its turns (L9). */}
          <TypingDots x={B1.x} y={B1.y + 6} on={frame >= 6 && frame < APPEAR_AT[0]} />
          <TypingDots x={B3.x} y={B3.y + 24} on={state === "thinking"} />

          <Box x={PANEL.x + 20} y={566} w={590} h={40} label="message Ren" labelSize={10} fill={GREY.field} radius={12} />
        </Desktop>
      </Camera>
    </AbsoluteFill>
  );
};
