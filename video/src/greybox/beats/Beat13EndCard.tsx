import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { Camera, shot } from "../Camera";
import { END_CARD } from "../copy";
import { GREY, H, MONO, W } from "../theme";
import { Box, Text } from "../ui";

/**
 * Beat 13 · End card · 1:14.6 – 1:19.1 · 136 frames
 *
 * Was beat 12 — the closing subtitle card is beat 12 now and this moved down one.
 *
 * **A sequence, not a static frame.** Three timed events:
 *
 *   1. the wordmark reveals            f0–30
 *   2. "take care of yourself" appears f38–56
 *   3. the wordmark DUPLICATES and the copy travels down to the domain line f66–88,
 *      then ".tech" types onto the end of it   f90–102
 *
 * The wordmark's real animation gets designed later. It is a placeholder here — a
 * left-to-right wipe with a small settle — and what this pass tests is the *rhythm*
 * of the three events, not the reveal itself.
 *
 * ── WHY THE TYPEWRITER IS NOW USED ONCE, AND ON A URL ───────────────────────
 *
 * All three elements used to type on, which made typing the card's house style rather
 * than a gesture. It is now the opposite: the only thing that types in this beat is a
 * **domain**, and beat 1 opens the film by typing a domain into an omnibox. The film is
 * bookended by the same action, and the typewriter comes to mean *the things a person
 * types* rather than "here is some text".
 *
 * That is also why **"take care of yourself" no longer types.** It is the sentimental
 * line and it should not be competing with a mechanical effect — so it simply appears,
 * on a fade and a short rise. A wipe was the alternative and was rejected for being the
 * same kind of effect: the point is to isolate the typewriter, and a wipe would have left
 * three mechanical reveals in eight seconds.
 *
 * And **`serenify.tech` derives from the wordmark** rather than being typed whole: the
 * wordmark duplicates on screen, the copy shrinks and travels to the domain line, and
 * only `.tech` types after it. The domain is then visibly *made of* the brand instead of
 * being a caption underneath it.
 *
 * **This move is on probation, and the fallback is one flag away.** It is charming
 * described and it is the last thing the audience sees, so if it reads fussy in the
 * render, set `DERIVE` to false: the domain then types whole from f78, which is exactly
 * the previous treatment. Two things to watch — whether the travel reads as *derivation*
 * or as a stray box moving, and whether the two-colour seren/ify split survives at domain
 * size, which cannot be judged until the real wordmark replaces this placeholder.
 *
 * **THE TYPING IS FASTER, THE HOLD IS NOT.** The typing was what felt slow, not the
 * hold: the reveal took 1.53s, and the two lines typed at ~13 and ~12 characters a
 * second, which is a deliberate pace at best and a stall at worst. The hold after the
 * domain lands is unchanged at 34 frames (~1.13s) — including the second added in
 * revision 4 — because that is where the VO lands its last line and it is room in the cut
 * rather than dead air.
 *
 * The beat is 180 → 136 frames and stays there; this revision moved events inside it
 * without changing its length.
 */

/** Set false to fall back to typing `serenify.tech` whole. See the header. */
const DERIVE = true;

const REVEAL_FROM = 0;
const REVEAL_TO = 30;
const LINE_FROM = 38;
const LINE_TO = 56;
/** The duplicate detaches, shrinks and travels to the domain line. */
const DUP_FROM = 66;
const DUP_TO = 88;
/** ~12 c/s for five characters. Slower than a word would be typed, which reads deliberate. */
const TECH_FROM = 90;
const TECH_TO = 102;
/** The whole-domain fallback, at the treatment this beat used to have. */
const DOMAIN_FROM = 78;
const DOMAIN_TO = 102;

/** The wordmark placeholder, and where its duplicate lands. */
const MARK = { x: 490, y: 216, w: 220, h: 56 } as const;
const DERIVED = { w: 86, h: 22 } as const;
const TECH = ".tech";
/** `serenify` + `.tech` as one centred unit: 86px of derived mark plus five mono chars. */
const ROW_W = DERIVED.w + 55;
const ROW_X = W / 2 - ROW_W / 2;
const ROW_Y = 380;

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
  const settle = interpolate(frame, [REVEAL_TO - 8, REVEAL_TO + 6], [1.05, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  /** 2 · it appears rather than types. Fade plus a short rise, and nothing else. */
  const lineIn = interpolate(frame, [LINE_FROM, LINE_TO], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  /** 3 · the duplicate's travel, as one eased parameter driving all four edges. */
  const travel = interpolate(frame, [DUP_FROM, DUP_TO], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const dupW = MARK.w + (DERIVED.w - MARK.w) * travel;
  const dupH = MARK.h + (DERIVED.h - MARK.h) * travel;
  const dupX = MARK.x + (ROW_X - MARK.x) * travel;
  const dupY = MARK.y + (ROW_Y - MARK.y) * travel;

  const tech = typeOn(TECH, frame, TECH_FROM, TECH_TO);
  const techCaret = frame >= TECH_FROM && frame < TECH_TO + 10;

  const domain = typeOn(END_CARD.domain, frame, DOMAIN_FROM, DOMAIN_TO);
  const domainCaret = frame >= DOMAIN_FROM && frame < DOMAIN_TO + 10;

  return (
    <AbsoluteFill>
      <Camera keys={[{ frame: 0, shot: shot(W / 2, 310, 760) }]}>
        <Box x={0} y={0} w={W} h={H} fill={GREY.page} border={GREY.page} radius={0} />

        {/* 1 · the wordmark reveal — placeholder, timed. */}
        <div
          style={{
            position: "absolute",
            left: MARK.x,
            top: MARK.y,
            width: MARK.w,
            height: MARK.h,
            overflow: "hidden",
            scale: settle,
            transformOrigin: "50% 50%",
          }}
        >
          <div style={{ position: "absolute", left: 0, top: 0, width: MARK.w * wipe, height: MARK.h, overflow: "hidden" }}>
            <Box x={0} y={0} w={MARK.w} h={MARK.h} label="wordmark reveal" labelSize={11} fill={GREY.panelAlt} radius={8} />
          </div>
        </div>

        {/*
         * 3a · the duplicate, and it is drawn BEFORE the line so it passes **behind** it.
         *
         * The travel from the wordmark to the domain row is almost vertical and the line
         * sits across the middle of it, so on its first pass an opaque box slid straight
         * through "take care of yourself" and blanked half of it for most of the move.
         * Behind the text and dipped to under half opacity while it is in transit, the
         * line stays readable throughout and the mark reads as settling rather than as a
         * rectangle barrelling past.
         */}
        {DERIVE && frame >= DUP_FROM ? (
          <Box
            x={dupX}
            y={dupY}
            w={dupW}
            h={dupH}
            fill={GREY.panelAlt}
            radius={8 * (dupH / MARK.h)}
            opacity={interpolate(travel, [0, 0.18, 0.82, 1], [1, 0.45, 0.45, 1])}
          />
        ) : null}

        {/* 2 · then this appears. No typing, no wipe — see the header. */}
        <Text
          x={300}
          y={322}
          w={600}
          size={34}
          weight={700}
          align="center"
          opacity={lineIn}
          style={{ translate: `0px ${(1 - lineIn) * 8}px` }}
        >
          {END_CARD.line}
        </Text>

        {/* 3b · …and `.tech` types onto the end of it. The only typing in the beat. */}
        {DERIVE ? (
          <>
            <div
              style={{
                position: "absolute",
                left: ROW_X + DERIVED.w + 2,
                top: ROW_Y - 3,
                fontFamily: MONO,
                fontSize: 20,
                color: GREY.body,
              }}
            >
              {tech}
              {techCaret ? <span style={{ color: GREY.graphite }}>|</span> : null}
            </div>
          </>
        ) : (
          <div
            style={{
              position: "absolute",
              left: 300,
              top: ROW_Y - 3,
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
        )}
      </Camera>
    </AbsoluteFill>
  );
};
