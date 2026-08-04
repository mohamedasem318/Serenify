import React from "react";
import { useCurrentFrame as useRenderedFrame } from "remotion";

/**
 * ══ THE PREMIERE CUT, REPRODUCED AS A TIME MAP ══════════════════════════════════════
 *
 * The greybox render `out/greybox-2026-08-02.mp4` — 2448 frames, 81.6s — was taken into
 * Premiere Pro and re-cut by hand. **That cut is the approved timing**, and this file is it:
 * the fourteen segments of `serenify launch video.prproj`, transcribed, mapping every output
 * frame of the film onto a source frame of the authored timeline.
 *
 * The project file is the spec, not the recollection of it. Three things were described —
 * *mostly speed changes*, *a few frames removed before the closing card*, *the final
 * `serenify.tech` moment slowed* — and all three are here. What the file also carries and the
 * description did not: **seven** speed-ups rather than a few, two of them large (2.0× and 2.6×);
 * the frames removed before the closing card are **31**, a full second; and the end card is
 * compressed at 2.6× and 1.7× before its last 17 frames are stretched over 58.
 *
 * ── WHY A TIME MAP AND NOT THIRTEEN RETIMED BEATS ───────────────────────────────────
 *
 * Six of the thirteen beats change speed **inside themselves** — beat 5 has five different rates
 * across its 422 frames, beat 13 has three. Re-authoring those as edited keyframes would mean
 * splitting every beat's internal timeline at arbitrary frames and scaling each piece by hand,
 * across dozens of keys, with the trend's band keys (L18) having to move in step with the
 * stateline's copy changes at every one of them. That has broken twice before.
 *
 * A time map cannot break it. The stateline and the graph are the same number read two ways
 * (L18), both read from the same remapped frame, so they move together by construction — there
 * is no second place for a key to be forgotten. Every beat's authored timeline is **untouched**;
 * what changes is the rate at which the film reads it.
 *
 * ── AND THE MAP IS CONTINUOUS, WHICH IS THE WHOLE QUALITY ARGUMENT ──────────────────
 *
 * Premiere resamples an **already rendered** clip: at 2.6× it drops frames, and at 0.29× it has
 * nothing to put between the ones it has, so it repeats them. Remotion re-renders, so a slowed
 * beat can be genuinely drawn at the in-between positions — but only if the frame handed to the
 * components is **fractional**. Rounding to the nearest source frame would reproduce Premiere's
 * sampling exactly and give the film nothing.
 *
 * So the map is split in two. The integer part rides a `<Sequence from={…}>` in
 * `GreyboxVideo.tsx`, which is what keeps Remotion's own sequence bookkeeping honest; the
 * fractional remainder is carried in `SubFrameContext` and added by the `useCurrentFrame` below,
 * which every component inside a beat imports **instead of** Remotion's. The two always sum to
 * the exact source position.
 *
 * The failure mode is deliberately gentle: a file that keeps importing Remotion's hook directly
 * gets the integer frame and degrades to Premiere-grade sampling. It does not break.
 *
 * `<Settle/>`, the probes and the per-beat compositions have no provider above them, so the
 * remainder is 0 and the hook is Remotion's own. A beat scrubbed on its own in Studio still runs
 * at its authored rate, which is what makes it re-timeable.
 */

export type Segment = {
  /** First output frame of the segment. */
  readonly out0: number;
  /** One past the last output frame. */
  readonly out1: number;
  /** Source frame at `out0`. */
  readonly src0: number;
  /** Source frame at `out1`. */
  readonly src1: number;
};

/**
 * The fourteen track items of the sequence, in order — **now fifteen entries, one of them split
 * after the fact; see the note at the foot of this comment** — read out of the project file's
 * `VideoClipTrackItem` → `SubClip` → `VideoClip` chain. Output bounds come from `TrackItem`'s
 * `Start`/`End`, source bounds from the clip's `InPoint`/`OutPoint`, both in Premiere's
 * 254016000000-ticks-per-second units at 30fps.
 *
 * **Segments are stated as ranges rather than as speeds, deliberately.** The last two clips carry
 * `PlaybackSpeed` values of 1.6990291262135921 and 0.2896551724117568 — nobody types those. They
 * are rate-stretch artifacts: the clip edge was dragged and Premiere solved for whatever speed
 * landed it there. So the **durations** are the authored decision and the speed is the
 * consequence, and reproducing the ranges reproduces the cut with no rounding of its own.
 *
 * The sub-frame discontinuities between segments (0.6f before segment 3, 0.2f overlaps before 8
 * and 13) are the same tick arithmetic and are reproduced as they stand rather than snapped.
 * They are Premiere's, they are under a frame, and inventing a correction would be inventing a
 * timing the cut does not have.
 *
 * The one discontinuity that is **not** an artifact is before segment 12: source 2155 → 2186,
 * **31 frames deleted**, the tail of beat 11 immediately before the closing card.
 *
 * ── ONE SEGMENT WAS SPLIT AFTERWARDS, AND IT IS THE ONE READ THE CUT DID NOT AFFORD ──
 *
 * The cut ran beat 10 at 1.400× from its f47, which took Ren's opener — *"Something shifted just
 * now. What happened?"* — to **0.94s**. Seven words at a typical silent reading rate need about
 * **1.7s**. The previous pass flagged it, left it as cut because the decision was Mohamed's, and
 * recorded both sets of numbers so they could never be confused; **the decision is now made and
 * the read gets its time back.**
 *
 * So the 1.400× segment is split at the read rather than the whole beat being slowed. Source
 * **1680 → 1716** is beat 10's own f38 → f74: the frame turn 1 lands on, to the frame the camera
 * leaves on. It runs at **0.706×** over 51 output frames — **1.70s**, from 28.3 frames — and the
 * remainder of the beat keeps its rate (1.398× against the cut's 1.400×; the endpoints are exact
 * and the 0.17% is a rounding to whole output frames, worth about a tenth of a frame mid-segment).
 *
 * **Slowing below the authored rate is safe here and would not be everywhere.** The camera is
 * static across those 36 authored frames, the message has landed, and the only things moving are
 * Ren's blink and his `thinking` pose — all frame-derived, so Remotion genuinely draws the
 * in-between positions rather than repeating frames, which is the whole argument for a time map
 * over a resample. **Turn 3's protected hold is untouched** (still inside the 1.398× stretch at
 * 44 output frames) and beat 10's typing stays at 35.6 c/s, both of which were signed off as cut.
 *
 * Everything after the split shifts **+23 output frames**; no other rate, boundary or source
 * frame in the table moved.
 */
export const SEGMENTS: readonly Segment[] = [
  { out0: 0, out1: 123, src0: 0, src1: 123 }, //             1.000×   beat 1
  { out0: 123, out1: 161, src0: 123, src1: 172.4 }, //       1.300×   beat 1
  { out0: 161, out1: 953, src0: 173, src1: 965 }, //         1.000×   beats 1–5
  { out0: 953, out1: 970, src0: 965, src1: 999 }, //         2.000×   beat 5
  { out0: 970, out1: 1005, src0: 999, src1: 1044.5 }, //     1.300×   beat 5
  { out0: 1005, out1: 1171, src0: 1045, src1: 1211 }, //     1.000×   beat 5
  { out0: 1171, out1: 1224, src0: 1211, src1: 1285.2 }, //   1.400×   beats 5–6
  { out0: 1224, out1: 1619, src0: 1285, src1: 1680 }, //     1.000×   beats 6–10
  { out0: 1619, out1: 1670, src0: 1680, src1: 1716 }, //     0.706×   beat 10 · TURN 1'S READ
  { out0: 1670, out1: 1836, src0: 1716, src1: 1948 }, //     1.398×   beat 10
  { out0: 1836, out1: 2043, src0: 1948, src1: 2155 }, //     1.000×   beats 10–11
  { out0: 2043, out1: 2130, src0: 2186, src1: 2273 }, //     1.000×   beat 12   ← 31f CUT above
  { out0: 2130, out1: 2168, src0: 2273, src1: 2371.8 }, //   2.600×   beats 12–13
  { out0: 2168, out1: 2203, src0: 2371.5437, src1: 2431.0097 }, // 1.699×   beat 13
  { out0: 2203, out1: 2261, src0: 2431.0097, src1: 2447.8097 }, // 0.290×   beat 13
];

/** The authored timeline the map reads from — `GREYBOX_DURATION` before the re-cut. */
export const SOURCE_DURATION = 2448;

/**
 * The cut's own length, **before the four interstitial cards**. 75.4s at 30fps, against the
 * source's 81.6s — 74.6s before turn 1's read was given its 23 frames back.
 *
 * The cards are not in this number: they are inserted into the *output* timeline downstream of
 * this map, in `GreyboxVideo.tsx`, which is what publishes the film's real duration.
 */
export const RETIMED_DURATION = SEGMENTS[SEGMENTS.length - 1].out1;

/**
 * The source frame an output frame reads, **fractional**. Linear inside each segment, which is
 * what a Premiere speed change is.
 */
export const sourceFrameAt = (out: number): number => {
  const f = Math.min(Math.max(out, 0), RETIMED_DURATION - 1);
  const last = SEGMENTS.length - 1;
  for (let i = 0; i <= last; i++) {
    const s = SEGMENTS[i];
    if (f < s.out1 || i === last) {
      return s.src0 + ((f - s.out0) / (s.out1 - s.out0)) * (s.src1 - s.src0);
    }
  }
  return 0;
};

/**
 * The fractional remainder of the current source frame. The integer part is already carried by
 * the `<Sequence>` offset, so this is only ever in [0, 1) — and it is 0 wherever no provider is
 * mounted, which is every composition except the cut.
 */
export const SubFrameContext = React.createContext(0);

/**
 * **Import this, not Remotion's.** Returns the frame the film is actually at, including the
 * fraction a speed change puts it between two authored frames. Identical to Remotion's hook
 * anywhere outside the retimed cut.
 */
export const useCurrentFrame = (): number =>
  useRenderedFrame() + React.useContext(SubFrameContext);

/**
 * ══ AND ONE THING A BEAT SOMETIMES NEEDS THAT IS *NOT* ITS AUTHORED FRAME ═══════════
 *
 * How many **output** frames into the beat we are. Null wherever no cut is mounted.
 *
 * Everything a beat draws is a function of its authored frame, and that is correct for every
 * *animation* — the whole point of a time map is that a move re-renders at the in-between
 * positions. It is wrong for a **clock**. A clock is a real rate, and a beat whose segments run
 * at 0.90× then 0.31× then 0.49× is a beat in which any value derived from the authored frame
 * changes speed twice.
 *
 * That is the launch sheet's `CLOCK` bug in its third form and it is what beat 11's music player
 * hit: the scrubber and the elapsed readout are one `progress` value, authored across the beat's
 * own f24–f70, and the pitch cut stretches that span unevenly — so the track ran at 31× real
 * time, then 10.7×, then 16.8×, with the sharpest change landing on the exact frame the camera
 * settles onto the window. Nothing about it is a rendering race (see `player.tsx`, which fixed a
 * genuine one): two independent renders of the whole window are MSE 0.00.
 *
 * So a clock inside a retimed beat reads THIS, and the rate it runs at is a rate in the film the
 * audience is watching rather than a rate in a timeline nobody sees. **Beat-relative, not
 * absolute**, so a beat still needs to know nothing about where it sits in the cut.
 *
 * `null` is the launch cut and every per-beat composition, where the two frames are the same
 * number and the distinction does not exist.
 */
export const BeatOutFrameContext = React.createContext<number | null>(null);

/** See `BeatOutFrameContext`. Null outside a cut that retimes beats. */
export const useBeatOutFrame = (): number | null => React.useContext(BeatOutFrameContext);
