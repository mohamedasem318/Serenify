import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame as useRenderedFrame,
} from "remotion";

import { Beat01ColdOpen } from "./beats/Beat01ColdOpen";
import { Beat02Signup } from "./beats/Beat02Signup";
import { Beat03Dashboard } from "./beats/Beat03Dashboard";
import { Beat04CameraGate } from "./beats/Beat04CameraGate";
import { Beat05Calibration } from "./beats/Beat05Calibration";
import { Beat06Later } from "./beats/Beat06Later";
import { Beat07AtEase } from "./beats/Beat07AtEase";
import { Beat08Email } from "./beats/Beat08Email";
import { Beat09Questionnaire } from "./beats/Beat09Questionnaire";
import { Beat10Ren } from "./beats/Beat10Ren";
import { Beat11ReturnToEase } from "./beats/Beat11ReturnToEase";
import { Beat12Closing } from "./beats/Beat12Closing";
import { Beat13EndCard } from "./beats/Beat13EndCard";
import { Interstitial, INTERSTITIAL_FRAMES, veilAt } from "./beats/Interstitial";
import { INTERSTITIALS } from "./copy";
import {
  RETIMED_DURATION,
  SOURCE_DURATION,
  sourceFrameAt,
  SubFrameContext,
} from "../retime";
import { Settle } from "./settle";
import { FONT, GREY } from "./theme";

/**
 * The greybox cut — all thirteen beats of
 * `docs/video/serenify-launch-video-beat-sheet.md`, each at the duration the
 * sheet gives it.
 *
 * This pass answers one question: does the pacing work. It is deliberately ugly
 * — grey rectangles for every screen, panel and person — because the two things
 * being tested are the durations and the camera moves, and both are real here.
 * Everything else gets thrown away.
 *
 * **No cuts inside a beat.** Each beat is one `<Camera>` and one continuous scene;
 * the camera moves, holds and moves again. Beats 2 and 5 used to be six and five
 * sub-sequences with a camera each, which was eleven cuts inside two beats.
 *
 * Durations are inlined rather than derived from a table so they can be dragged
 * in Studio and read straight off the sheet.
 *
 *   1 cold open     180          7 at ease         72 (−48)
 *   2 signup        432          8 the email      184 (−16)
 *   3 dashboard     120          9 questionnaire   76 (−14)
 *   4 camera gate   120         10 Ren            310 (−22)
 *   5 calibration   422         11 return to ease 234
 *   6 later          36 (−24)   12 closing card    90
 *                               13 end card       172
 *                                       total   2448 = 81.6s @ 30fps
 *
 * ══ −124 FRAMES, ALL OF THEM IN THE SECOND HALF, AND NONE OF THEM A READ ════════════
 *
 * **The two halves were keeping different time from the "Start check-in" click onward, and the
 * measurement is the argument.** Two numbers, taken per camera landing across every beat:
 *
 *                              settled frames per landing       DEAD dwell per landing
 *                              mean      median                 mean      median
 *   1st half (f0 – f1296)      30.0      22                      6.2       6
 *   2nd half, before           60.9      49                     22.4      17
 *   2nd half, after            54.6      37                     17.0       9
 *
 * *Dead dwell* is the settled frames left in a landing **after its last authored event** — the
 * camera stopped, nothing on screen changing. It is the honest measure here, because the second
 * half's landings were not merely longer, they were emptier: the first half spends 21% of its
 * settled time with nothing happening, the second spent 37%.
 *
 * The AFTER column is still above the first half's, and it is entirely the four holds that are
 * not allowed to move: beat 10's two reads (36 on turn 1, 60 on turn 3), beat 11's protected
 * closing composite (64 after the tail settles) and beat 7's establish (36). **Excluding those
 * four, the second half's dead dwell is mean 6.3 / median 5 against the first half's 6.2 / 6** —
 * the same film, keeping the same time.
 *
 * What each cut was:
 *
 *   beat  6   60 → 36   38 dead frames of a locked-off dashboard after the click. The page does
 *                       not respond to the press; nothing was happening in any of them.
 *   beat  7  120 → 72   a 60-frame move on a 10% push, then a 60-frame hold on a beat whose one
 *                       device (L12's raise) L15 removed. Halved on both sides.
 *   beat  8  200 → 184  the fall finishes at f86 and `dismayed` is a constant pose after it; the
 *                       camera sat on it until f118. It leaves at f102, and the whole third act
 *                       shifts −16 with its spacing intact.
 *   beat  9   90 → 76   the prompt has no response state, so the 24 frames after the click were
 *                       a stopped camera on a stopped surface.
 *   beat 10  332 → 310  two typing indicators, 52 and 44 frames, cut to 38 and 36. An indicator
 *                       is looked at, not read.
 *
 * **Nothing that has to be READ lost a frame**, and that is checkable line by line: beat 8's
 * toast keeps its whole 38-frame hold at the clock framing and its second stateline change keeps
 * its 20 to the end of the beat; beat 9's prompt keeps its 60 frames before the click; beat 10's
 * turn 1 keeps 36 at 14.37px and turn 3 keeps its protected 60; beat 12's line keeps its 50.
 *
 * **And the invariants are intact.** Beat 11's closing composite still holds 136 frames from f98
 * to the end; beat 13's wordmark reveal is still 72 on `out(quad)`; the trend's band keys moved
 * with beat 8's copy changes by the same −16, so the crossings still land on the exact frames the
 * stateline steps; and no beat gained a cut — every one of these is a hold shortened or a move
 * shortened, never a new edit inside a beat.
 *
 * **The first half is untouched.** Beat 1's hero framing is the only change before the click, and
 * it is a framing rather than a timing — see `Beat01ColdOpen.tsx` § THE HERO BLOCK IS CENTRED.
 *
 * ── WHAT THE EARLIER PASSES PUT IN, AND KEPT ────────────────────────────────────────
 *
 *   beat 13  136 → 172   the reveal was *"still far too fast"* at 36 frames and needed
 *                        "considerably more than a touch". The wipe is 72 (2.40s) and the four
 *                        events after it shift by the same +42, so every gap between them is
 *                        unchanged and the held card keeps its 18 frames. It is the LAST beat, so
 *                        nothing is pushed by it. See `Beat13EndCard.tsx` § THE REVEAL IS DOUBLED.
 *
 * **Beat 11 gained a landing and did not gain a frame.** The punch-in onto the music player is
 * paid for out of its own establishing hold and out of the player window's close overlapping the
 * camera's departure; the closing composite still holds for 136 frames, f98 to the end.
 */
export const GREYBOX_DURATION = 2448;

/**
 * ══ AND THE CUT IS NOW THE PREMIERE ONE — 2448 AUTHORED FRAMES READ IN 2238 ═════════
 *
 * The durations above are the **authored** timeline and they are unchanged; every beat still
 * runs at its own rate when scrubbed on its own in Studio, and every keyframe inside every beat
 * is where it was. What changed is the rate at which the film reads them, taken frame for frame
 * off `serenify launch video.prproj` — see `../retime.tsx` for the segment table and for why the
 * cut is a time map rather than thirteen re-keyed beats.
 *
 *   beat                 authored    cut     Δ    what happens to it
 *   ──────────────────── ────────  ─────  ─────   ────────────────────────────────────────
 *    1 cold open              180    168    −12   1.30× across the omnibox lift
 *    2 signup                 432    432      0   untouched
 *    3 dashboard              120    120      0   untouched
 *    4 camera gate            120    120      0   untouched
 *    5 calibration            422    376    −46   2.00×, then 1.30×, then 1.40× on the tail
 *    6 later                   36     33     −3   the 1.40× tail runs into it
 *    7 at ease                 72     72      0   untouched
 *    8 the email              184    184      0   untouched
 *    9 questionnaire           76     76      0   untouched
 *   10 Ren                    310    236    −74   1.40× across the typing, the send and turn 3
 *   11 return to ease         234    203    −31   1.00×, and its LAST 31 FRAMES DELETED
 *   12 closing card            90     88     −2   untouched but for its last 3 frames
 *   13 end card               172    130    −42   2.60×, 1.70×, then its last 17f over 58
 *                          ──────  ─────  ─────
 *                            2448   2238   −210   81.6s → 74.6s
 *
 * **Two things have happened to that table since, and neither re-cuts it.** Beat 10's turn 1 got
 * its read back — `retime.tsx` splits the 1.400× segment so source 1680–1716 runs at 0.706×, so
 * beat 10 is 236 → **259** and the cut is 2238 → **2261** — and the four interstitial cards were
 * inserted into the OUTPUT timeline below, adding **240** frames the map knows nothing about.
 * The film is **2501 frames, 83.4s**. Every other rate and boundary in the map is untouched.
 *
 * **Beats 2, 3, 4, 7, 8 and 9 are at 1.00× and are not touched at any frame** — which is the
 * whole of the first act after the cold open, and the whole of the email and the questionnaire.
 * The reductions are the calibration, Ren, and the end card.
 *
 * ── ONE CUT, AND IT IS THE ONLY ONE ─────────────────────────────────────────────────
 *
 * Source 2155 → 2186: the last 31 frames of beat 11, immediately before the closing card. It is
 * a beat's **tail** being shortened, not an edit placed inside one, so the one-take invariant is
 * intact — the film still never cuts within a beat. Everything else here is a duration.
 *
 * ── AND THE SERIES IS GONE, BECAUSE A SERIES CANNOT HOLD A FRACTIONAL FRAME ─────────
 *
 * `<Series>` slices its children on integer frame boundaries, and the whole point of re-rendering
 * a retimed beat rather than resampling one is that the frame handed to it is fractional. So the
 * beat is dispatched directly and mounted under a `<Sequence>` whose offset carries the integer
 * part, with `SubFrameContext` carrying the remainder. `key` is the beat's own name, so a beat
 * mounts once and stays mounted for its whole run exactly as `<Series>` had it — the `delayRender`
 * gates in `landing.tsx` and `monitor.tsx` depend on that and would otherwise re-fire every frame.
 */
const BEATS = [
  { name: "1 · cold open", frames: 180, Beat: Beat01ColdOpen },
  { name: "2 · signup", frames: 432, Beat: Beat02Signup },
  { name: "3 · dashboard", frames: 120, Beat: Beat03Dashboard },
  { name: "4 · camera gate", frames: 120, Beat: Beat04CameraGate },
  { name: "5 · calibration", frames: 422, Beat: Beat05Calibration },
  { name: "6 · later", frames: 36, Beat: Beat06Later },
  { name: "7 · at ease", frames: 72, Beat: Beat07AtEase },
  { name: "8 · the email", frames: 184, Beat: Beat08Email },
  { name: "9 · questionnaire", frames: 76, Beat: Beat09Questionnaire },
  { name: "10 · Ren", frames: 310, Beat: Beat10Ren },
  { name: "11 · return to ease", frames: 234, Beat: Beat11ReturnToEase },
  { name: "12 · closing card", frames: 90, Beat: Beat12Closing },
  { name: "13 · end card", frames: 172, Beat: Beat13EndCard },
] as const;

/** First authored frame of each beat. */
const BEAT_STARTS = BEATS.reduce<number[]>((acc, b, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + BEATS[i - 1].frames);
  return acc;
}, []);

if (BEAT_STARTS[BEATS.length - 1] + BEATS[BEATS.length - 1].frames !== SOURCE_DURATION) {
  throw new Error("the beat table and the retime map disagree about the authored length");
}

const beatIndexAt = (authored: number): number => {
  for (let i = BEATS.length - 1; i > 0; i--) {
    if (authored >= BEAT_STARTS[i]) return i;
  }
  return 0;
};

/**
 * ══ THE FOUR CARDS ══════════════════════════════════════════════════════════════════
 *
 * The Egyptian Arabic VO is dropped and LinkedIn autoplays muted, so **on-screen text is the
 * film's only narration** — on cards, not overlaid. The three reasons and the treatment are in
 * `beats/Interstitial.tsx`; the copy and the landing-copy check are in `copy.ts`.
 *
 * ── WHY THESE FOUR SEAMS AND NO OTHERS ──────────────────────────────────────────────
 *
 * A card earns its place where the film jumps in time or changes who is acting, or where the run
 * of lines needs a premise. **And the card is the transition**: where one sits, it covers the
 * change of composition, which is why they are at seams rather than inside beats.
 *
 *   4 → 5    "First it learns what calm looks like."     states what the film is about to show,
 *                                                        and gives the three that follow
 *                                                        something to continue from
 *   5 → 6    "Then it stays quiet."                      covers the film's only unexplained
 *                                                        time jump
 *   7 → 8    "Until something changes."                  the inciting incident
 *   9 → 10   "Then it helps you come back down."         the app stops measuring and starts
 *                                                        talking
 *
 * Every other seam is a chain where each screen causes the next and the UI narrates itself.
 *
 * **The first card does not go earlier than beat 4.** Between beats 3 and 4 it would land
 * immediately before the camera gate's own heading — "Before the camera turns on" — which is text
 * stacked on text. After the gate resolves, the screen is clear.
 *
 * ── THE CARDS RIDE THE OUTPUT TIMELINE, NOT THE AUTHORED ONE ────────────────────────
 *
 * A card is **new material**, not a retimed beat, so it is inserted after `sourceFrameAt` has been
 * read and it runs at exactly its own 60 frames. The alternative — giving each card a slot in the
 * authored timeline — would have shifted every source frame in `retime.tsx`'s segment table
 * downstream of each of the four insertions: thirteen hand-moved numbers reproducing a cut that
 * is already approved, for no gain. Nothing in the segment table knows these exist.
 *
 * `at` is therefore an **output** frame of the film, and each is the first output frame of the
 * beat the card precedes: 840 is beat 5's f0, 1216 is beat 6's, 1321 is beat 8's, 1581 is beat
 * 10's. All four sit before the turn-1 split at out 1619, so none of them moved when it landed.
 *
 * ── ONE CARD IS JOINED DIFFERENTLY, AND ONLY THE JOIN DIFFERS ───────────────────────
 *
 * **The 7 → 8 card is the one of the four with no discontinuity to cover.** Beats 7 and 8 join on
 * the *identical* shot on the *identical* surface — beat 7 lands on `COMPOSITE` at its f36 and
 * holds there, and beat 8 opens on `COMPOSITE` — so a hard cut to a card and a hard cut back is
 * the grammar of a scene change placed where there is no scene change. It read as **cutting away
 * and cutting back**; what it has to read as is **the film pausing to say something and then
 * resuming.**
 *
 * So that card **dissolves**. The outgoing frame is held underneath — film frame `at − 1`, which
 * is beat 7's f71, a genuinely static frame at the identical framing beat 8 opens on — and the
 * whole card, ground and line together, fades up over it in **14 frames**, holds, and fades back
 * down over 12 into the frame the shot left. The picture gives way and returns; nothing cuts.
 *
 * **The card itself is untouched, and that is the constraint that shaped this.** Same typeface,
 * weight, size, ground, framing and 60-frame duration treatment as the other three — settled and
 * static f15–f48 either way. All that differs is how it is arrived at and departed from, which is
 * the only thing that may differ: giving one card its own *look* would break the device the other
 * three depend on, which is a worse trade than leaving the seam as it was. **The other three keep
 * the hard cut, because each of them genuinely covers a change of composition** and a dissolve
 * there would soften a join whose job is to be invisible.
 *
 * Not the typewriter, not the end card's wipe.
 */
const CARDS = [
  { at: 840, line: INTERSTITIALS.calm, dissolve: false },
  { at: 1216, line: INTERSTITIALS.quiet, dissolve: false },
  { at: 1321, line: INTERSTITIALS.changes, dissolve: true },
  { at: 1581, line: INTERSTITIALS.down, dissolve: false },
] as const;

/**
 * The dissolving card's own veil: 0 → 1 over 14 frames, 1 → 0 over the last 12. The card's
 * internal ramp (f3–f15 in, f48–f60 out) is left exactly as the other three have it, so the line
 * is settled across the same f15–f48 and the two ramps only ever compound at the edges.
 */
/**
 * The film at one output frame, mounted the way the cut mounts it: the beat dispatched by the
 * retime map, its integer part on the `<Sequence>` offset and its remainder in `SubFrameContext`.
 *
 * `film` is deliberately a separate argument from `out`. Passing a FIXED `film` while `out`
 * advances holds the picture still — which is what puts beat 7's last frame under the dissolving
 * card for all sixty of its frames. `key` is the beat's own name either way, so the beat stays
 * mounted across the card exactly as it stays mounted across its own run.
 */
export const FilmFrame: React.FC<{ out: number; film: number }> = ({ out, film }) => {
  const source = sourceFrameAt(film);
  const authored = Math.min(Math.floor(source), SOURCE_DURATION - 1);
  const subFrame = source - authored;

  const i = beatIndexAt(authored);
  const { name, frames, Beat } = BEATS[i];
  const local = authored - BEAT_STARTS[i];

  return (
    <SubFrameContext.Provider value={subFrame}>
      {/* `from` is solved so the child sees `local`: it reads `out - from`. */}
      <Sequence key={name} layout="none" from={out - local} durationInFrames={frames}>
        <Beat />
      </Sequence>
    </SubFrameContext.Provider>
  );
};

/**
 * The stretch `CardJoinCompare` renders: the whole of beat 7 and the whole of beat 8, in FILM
 * output frames, with the 7 → 8 card's insertion point in the middle. Beat 7 opens at authored
 * 1310 and beat 8 closes at authored 1566; both beats are read at 1.000×, so the film frames are
 * these. Stated here rather than in the bench so the two cannot drift apart.
 */
export const CARD_JOIN_SECTION = { start: 1249, cardAt: 1321, end: 1505 } as const;

/** Each card's first frame in the FINAL output, i.e. with the cards before it already inserted. */
const CARD_STARTS = CARDS.map((c, i) => c.at + i * INTERSTITIAL_FRAMES);

/** The film's own length, cards included. */
export const CUT_DURATION = RETIMED_DURATION + CARDS.length * INTERSTITIAL_FRAMES;

/**
 * Where an output frame lands: on one of the four cards, or on the film at the film frame the
 * retime map should be asked about.
 */
const resolve = (out: number): { card: number; local: number } | { film: number } => {
  for (let i = 0; i < CARD_STARTS.length; i++) {
    if (out < CARD_STARTS[i]) return { film: out - i * INTERSTITIAL_FRAMES };
    if (out < CARD_STARTS[i] + INTERSTITIAL_FRAMES) {
      return { card: i, local: out - CARD_STARTS[i] };
    }
  }
  return { film: out - CARDS.length * INTERSTITIAL_FRAMES };
};

export const GreyboxVideo: React.FC = () => {
  // Remotion's own frame, deliberately — this is the OUTPUT frame the renderer is producing, and
  // it is the only place in the composition that wants it rather than the source frame.
  const out = useRenderedFrame();
  const at = resolve(out);

  if ("card" in at) {
    const card = CARDS[at.card];
    return (
      <AbsoluteFill style={{ backgroundColor: GREY.black, fontFamily: FONT }}>
        <Settle />
        {/* The held outgoing frame, under the dissolve. Only the 7 → 8 card has one. */}
        {card.dissolve ? <FilmFrame out={out} film={card.at - 1} /> : null}
        <AbsoluteFill style={{ opacity: card.dissolve ? veilAt(at.local) : 1 }}>
          {/* No `SubFrameContext` — a card is output-timeline material and is never retimed, so
              it reads Remotion's own frame and runs at exactly its authored 60. */}
          <Sequence
            key={`card-${at.card}`}
            layout="none"
            from={CARD_STARTS[at.card]}
            durationInFrames={INTERSTITIAL_FRAMES}
          >
            <Interstitial line={card.line} dissolve={card.dissolve} />
          </Sequence>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: GREY.black, fontFamily: FONT }}>
      {/* Outside the beat, so it is mounted exactly once for the whole cut and every beat gets
          the same hold — and outside the provider, because it keys on the frame being RENDERED
          rather than on the frame being read. See `settle.tsx` — the renderer was emitting one
          wrong frame in a few hundred, and no beat could have known to guard against it. */}
      <Settle />
      <FilmFrame out={out} film={at.film} />
    </AbsoluteFill>
  );
};

export { RETIMED_DURATION };

