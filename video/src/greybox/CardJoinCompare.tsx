import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";

import { Interstitial, INTERSTITIAL_FRAMES, veilAt } from "./beats/Interstitial";
import { INTERSTITIALS } from "./copy";
import { CARD_JOIN_SECTION, FilmFrame } from "./GreyboxVideo";
import { Settle } from "./settle";
import { FONT, GREY } from "./theme";

/**
 * ══ THE 7 → 8 JOIN, THREE WAYS, BACK TO BACK ════════════════════════════════════════
 *
 * Not a beat and never in the cut — a comparison bench, the same category as `RigSpike`. It
 * exists because the 7 → 8 card is the one of the four with no discontinuity under it, and a
 * single option cannot be judged in isolation: what is on screen now has to be beside what
 * replaces it.
 *
 * Each version plays **the whole of beat 7 and the whole of beat 8** with the card between them,
 * at the film's own rates, and they are separated by twenty frames of black so the eye resets.
 *
 *   version                          frames        starts at
 *   ──────────────────────────────  ──────────  ────────────
 *   1 · as it is now — hard cut, 60      316            0     0.00s
 *   2 · the DISSOLVE, 60                 316          336    11.20s
 *   3 · the dissolve, 45                 301          672    22.40s
 *
 * **Version 1 is the reference, not a candidate** — it is exactly what `out/greybox-…-cards.mp4`
 * shipped. Version 2 is the change. Version 3 varies only the duration on top of version 2, to
 * answer whether a card that *pauses* a continuous shot needs the same hold as one that covers a
 * scene change; it is **not shippable as it stands** — at 45 the settled window is 18 frames
 * (0.60s), under the 1s floor the cards are sized by — and it is here to be looked at, not
 * chosen.
 */

const { start: SEG_START, end: SEG_END, cardAt: CARD_AT } = CARD_JOIN_SECTION;
/** Frames of film before the card, and after it. */
const LEAD = CARD_AT - SEG_START;
const TAIL = SEG_END - CARD_AT;
const GAP = 20;

type Version = { frames: number; dissolve: boolean };

const VERSIONS: readonly Version[] = [
  { frames: INTERSTITIAL_FRAMES, dissolve: false },
  { frames: INTERSTITIAL_FRAMES, dissolve: true },
  { frames: 45, dissolve: true },
];

const STARTS = VERSIONS.reduce<number[]>((acc, v, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + LEAD + VERSIONS[i - 1].frames + TAIL + GAP);
  return acc;
}, []);

export const CARD_JOIN_COMPARE_DURATION =
  STARTS[VERSIONS.length - 1] + LEAD + VERSIONS[VERSIONS.length - 1].frames + TAIL;

export const CardJoinCompare: React.FC = () => {
  const out = useCurrentFrame();

  let v = -1;
  let rel = 0;
  for (let i = VERSIONS.length - 1; i >= 0; i--) {
    if (out >= STARTS[i]) {
      v = i;
      rel = out - STARTS[i];
      break;
    }
  }

  const version = VERSIONS[v];
  const body = (
    <AbsoluteFill style={{ backgroundColor: GREY.black, fontFamily: FONT }}>
      <Settle />
      {rel < LEAD ? (
        <FilmFrame out={out} film={SEG_START + rel} />
      ) : rel < LEAD + version.frames ? (
        <>
          {version.dissolve ? <FilmFrame out={out} film={CARD_AT - 1} /> : null}
          <AbsoluteFill
            style={{
              opacity: version.dissolve ? veilAt(rel - LEAD, version.frames) : 1,
            }}
          >
            <Sequence
              key={`compare-card-${v}`}
              layout="none"
              from={STARTS[v] + LEAD}
              durationInFrames={version.frames}
            >
              <Interstitial
                line={INTERSTITIALS.changes}
                frames={version.frames}
                dissolve={version.dissolve}
              />
            </Sequence>
          </AbsoluteFill>
        </>
      ) : rel < LEAD + version.frames + TAIL ? (
        <FilmFrame out={out} film={CARD_AT + (rel - LEAD - version.frames)} />
      ) : null}
    </AbsoluteFill>
  );

  return body;
};
