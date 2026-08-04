import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { useCurrentFrame } from "../../retime";

import { CARD, CARD_DISPLAY } from "../../app/furniture";
import { Camera, shot } from "../Camera";
import { H, W } from "../theme";

/*
 * Hallmark · component: roadmap-card · genre: editorial · theme: film-furniture (locked)
 * states: n/a — a non-interactive film frame; there is no hover, focus or active in a render
 * contrast: pass — CARD.ink #e8ebee on CARD.field #0b0c0e ≈ 17:1, CARD.muted #a6acb2 on
 * CARD.field #0b0c0e ≈ 8.9:1
 * pre-emit critique: not run — this beat transcribes beat sheet §8 verbatim rather than
 * exercising design judgement, so the checklist does not apply.
 */

/**
 * Beat R · The roadmap card · 240 frames (8s), between beat 11 and beat 12
 *
 * Spec: `docs/video/serenify-pitch-video-beat-sheet.md` §8. Transcribed, not redesigned.
 *
 * **Flush left, three rows, a two-column grid — NOT a centred sentence.** Beat 12's card is the
 * film's one claim and it is a centred sentence; a second centred sentence eight seconds before
 * it would compete with it and turn the closing card into the second of a pair. So this card is
 * a list: a short tense marker (`Next` / `Then` / `Then`) in one column, the item in the other.
 *
 * Same ground (`CARD.field`), same ink, same face (Outfit / `CARD_DISPLAY`), same weight (500),
 * same tracking (−0.01em), same 760 framing as beat 12 and the end card. Size is 27px world —
 * the size the four interstitials use, clear of the 14px floor and visibly under beat 12's 34px.
 * The `Next` / `Then` column is the same size at `CARD.muted`. Entry and exit are the
 * interstitials' own gesture, not the interstitials' composition — a fade with eight pixels of
 * rise, in over 12 frames, settled 216, out over 12 (12 + 216 + 12 = 240).
 *
 * ══ THIS COPY IS AUTHORED ═══════════════════════════════════════════════════════════
 *
 * Every other word in the film is verbatim from `apps/web` or from `lib/landing/copy.ts`. There
 * is no app copy about a roadmap, because a roadmap is not a product surface. This card is the
 * film's SECOND authored element, after the one authored hover treatment on the chat send
 * button. It must never be back-ported into `apps/web` and must never be mistaken for
 * `lib/landing/copy.ts` in a later pass.
 *
 * The rows name signals, not outcomes: no present-tense verb with Serenify as its subject, no
 * progressive ("we're building…"), no claim of accuracy or improvement. The `Next` / `Then` /
 * `Then` column carries the future tense structurally, so no row reads as a shipped capability
 * even out of context.
 *
 * Row 2 and row 3 diverge from the beat sheet's own example text (which predates the training
 * dataset's ECG/EDA/RESP channels being locked in and used "all three" while row 2 named only
 * two signals, making the count ambiguous): row 2 gained "breathing" and row 3 now names the
 * modalities directly — face, voice, body — rather than counting them.
 */

// Row 2's item wraps at 27px world inside the 760 framing with the beat sheet's own
// "Physiological signals — heart rate, breathing, skin conductance" — measured, not assumed:
// a still at frame 120 ran the full string off the right edge of the visible window. Fixed
// per the beat sheet's own fallback order: (1) shorten the label before the em-dash first.
// "Physiological signals" → "Physiology" recovers ~130 world px, which clears it with margin
// to spare; the list after the dash is untouched, so the fallback never reached step (2).
const ROW_TEXT: readonly { tense: string; item: string }[] = [
  { tense: "Next", item: "Voice — strain in how something is said" },
  { tense: "Then", item: "Physiology — heart rate, breathing, skin conductance" },
  { tense: "Then", item: "Face, voice and body read as one signal" },
];

// The grid, flush left. `TENSE_X` / `ITEM_X` are the two columns; `ROW_H` spaces the three rows.
// The block sits inside the 760 framing's visible window (world x ≈ 220–980) with margin on
// both sides, the same discipline beat 12's centred `LINE` box uses at this framing.
const GRID = { tenseX: 232, itemX: 330, itemW: 630, y0: 276, rowH: 58 } as const;
const ROW_CY = GRID.y0 + GRID.rowH + 14; // vertical centre of the three-row block, for framing

export const BeatRRoadmap: React.FC = () => {
  const frame = useCurrentFrame();

  const appear = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const leave = interpolate(frame, [228, 240], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const opacity = Math.min(appear, leave);
  const rise = interpolate(appear, [0, 1], [8, 0]);

  return (
    <AbsoluteFill>
      <Camera keys={[{ frame: 0, shot: shot(W / 2, ROW_CY, 760) }]}>
        <div
          style={{ position: "absolute", inset: 0, width: W, height: H, backgroundColor: CARD.field }}
        />

        {ROW_TEXT.map((row, i) => (
          <React.Fragment key={row.tense + i}>
            <div
              style={{
                position: "absolute",
                left: GRID.tenseX,
                top: GRID.y0 + i * GRID.rowH,
                opacity,
                translate: `0px ${rise}px`,
                fontFamily: CARD_DISPLAY,
                fontSize: 27,
                fontWeight: 500,
                lineHeight: 1.3,
                letterSpacing: "-0.01em",
                color: CARD.muted,
                whiteSpace: "nowrap",
              }}
            >
              {row.tense}
            </div>
            <div
              style={{
                position: "absolute",
                left: GRID.itemX,
                top: GRID.y0 + i * GRID.rowH,
                width: GRID.itemW,
                opacity,
                translate: `0px ${rise}px`,
                fontFamily: CARD_DISPLAY,
                fontSize: 27,
                fontWeight: 500,
                lineHeight: 1.3,
                letterSpacing: "-0.01em",
                color: CARD.ink,
                whiteSpace: "nowrap",
              }}
            >
              {row.item}
            </div>
          </React.Fragment>
        ))}
      </Camera>
    </AbsoluteFill>
  );
};
