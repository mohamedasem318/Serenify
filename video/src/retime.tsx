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
 * The fourteen track items of the sequence, in order, read out of the project file's
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
 * The one discontinuity that is **not** an artifact is before segment 11: source 2155 → 2186,
 * **31 frames deleted**, the tail of beat 11 immediately before the closing card.
 */
export const SEGMENTS: readonly Segment[] = [
  { out0: 0, out1: 123, src0: 0, src1: 123 }, //             1.000×   beat 1
  { out0: 123, out1: 161, src0: 123, src1: 172.4 }, //       1.300×   beat 1
  { out0: 161, out1: 953, src0: 173, src1: 965 }, //         1.000×   beats 1–5
  { out0: 953, out1: 970, src0: 965, src1: 999 }, //         2.000×   beat 5
  { out0: 970, out1: 1005, src0: 999, src1: 1044.5 }, //     1.300×   beat 5
  { out0: 1005, out1: 1171, src0: 1045, src1: 1211 }, //     1.000×   beat 5
  { out0: 1171, out1: 1224, src0: 1211, src1: 1285.2 }, //   1.400×   beats 5–6
  { out0: 1224, out1: 1628, src0: 1285, src1: 1689 }, //     1.000×   beats 6–10
  { out0: 1628, out1: 1813, src0: 1689, src1: 1948 }, //     1.400×   beat 10
  { out0: 1813, out1: 2020, src0: 1948, src1: 2155 }, //     1.000×   beats 10–11
  { out0: 2020, out1: 2107, src0: 2186, src1: 2273 }, //     1.000×   beat 12   ← 31f CUT above
  { out0: 2107, out1: 2145, src0: 2273, src1: 2371.8 }, //   2.600×   beats 12–13
  { out0: 2145, out1: 2180, src0: 2371.5437, src1: 2431.0097 }, // 1.699×   beat 13
  { out0: 2180, out1: 2238, src0: 2431.0097, src1: 2447.8097 }, // 0.290×   beat 13
];

/** The authored timeline the map reads from — `GREYBOX_DURATION` before the re-cut. */
export const SOURCE_DURATION = 2448;

/** The cut's own length. 74.6s at 30fps, against the source's 81.6s. */
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
