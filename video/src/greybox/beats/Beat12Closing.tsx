import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { CARD, CARD_DISPLAY } from "../../app/furniture";
import { Camera, shot } from "../Camera";
import { CLOSING_LINE } from "../copy";
import { H, W } from "../theme";

/*
 * Hallmark · component: closing-subtitle-card · genre: editorial · theme: film-furniture (locked)
 * states: n/a — a non-interactive film frame; there is no hover, focus or active in a render
 * contrast: pass — CARD.ink #e8ebee on CARD.field #0b0c0e ≈ 17:1
 * pre-emit critique: P5 H5 E4 S5 R5 V4
 */

/**
 * Beat 12 · The closing subtitle card · 1:13.5 – 1:16.5 · 90 frames
 *
 * A short card between the demo resolving and the wordmark reveal. The reading came back down
 * because *he was asked and he answered* — the confirmatory step is the thesis of the whole
 * project, the video demonstrates it across beats 8, 9 and 11 without ever naming it, and this
 * names it once as the last idea the audience leaves with.
 *
 * **The copy is DECIDED** — "A detection is a question, not a verdict.", verbatim from
 * `NEVER_CARD_DECIDE_BODY`. See `CLOSING_LINE` in `copy.ts` for why the alternative was rejected
 * on a factual ground rather than a taste one.
 *
 * ══ WHAT THIS PASS FINISHED ═════════════════════════════════════════════════════════
 *
 * The card was three defaults wearing a beat's name, and all three read as unfinished:
 *
 *  · **It set in the fallback face at weight 700.** The film's one editorial statement was
 *    bold system-sans. It is Outfit now — the app's own display face, which is what makes this
 *    card and the end card read as the same voice as the product they follow.
 *  · **It sat on `GREY.page` (#101214), the app's own background.** `furniture.ts` defines
 *    `CARD.field` at #0b0c0e — three points deeper — precisely so the two closing cards say "we
 *    have stepped outside the product" with no transition, no rule and no label. The beats were
 *    not using it, so the cheapest signal in the film was being paid for and not spent.
 *  · **Weight 700 was doing the work that size and space should do.** A line this short at this
 *    framing does not need bold; bold reads as a headline, and this is a statement. It is 500 —
 *    enough to hold the frame, not enough to shout — with `-0.01em` of tracking, which is what
 *    Outfit wants at display sizes and what the app's own `tracking-tight` headings use.
 *
 * ── NO ORNAMENT, AND THAT IS THE DESIGN ─────────────────────────────────────────────
 *
 * No eyebrow, no rule, no quotation marks, no mark. The line arrives, is held, and leaves. The
 * only two things that move are its opacity and eight pixels of rise, because a statement that
 * slides reads as a slide and a statement that fades in reads as an idea arriving.
 *
 * Deliberately **not** typed on: the end card types exactly once, on a domain, and that is the
 * film's bookend with beat 1. A third typing effect inside eight seconds would make typing the
 * house style rather than a gesture.
 *
 * Framed at 760, the same as the end card, so the two read as one closing movement.
 */

const LINE = { x: 160, y: 290, w: 880 } as const;

export const Beat12Closing: React.FC = () => {
  const frame = useCurrentFrame();

  const appear = interpolate(frame, [4, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const leave = interpolate(frame, [70, 86], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  // A few pixels of rise with the fade. Enough that the line arrives rather than switches on;
  // not enough to read as a slide.
  const rise = interpolate(appear, [0, 1], [8, 0]);

  return (
    <AbsoluteFill>
      <Camera keys={[{ frame: 0, shot: shot(W / 2, LINE.y + 26, 760) }]}>
        <div
          style={{ position: "absolute", inset: 0, width: W, height: H, backgroundColor: CARD.field }}
        />

        <div
          style={{
            position: "absolute",
            left: LINE.x,
            top: LINE.y,
            width: LINE.w,
            opacity: Math.min(appear, leave),
            translate: `0px ${rise}px`,
            fontFamily: CARD_DISPLAY,
            fontSize: 34,
            fontWeight: 500,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
            textAlign: "center",
            color: CARD.ink,
          }}
        >
          {CLOSING_LINE}
        </div>
      </Camera>
    </AbsoluteFill>
  );
};
