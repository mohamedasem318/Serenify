import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

import { OtpBoxes, type OtpBoxesHandle } from "@/components/ui/auth/otp-boxes";

import { EASE_OUT, EASE_STANDARD, sec } from "./motion";

/**
 * ══ THE OTP MERGE, FRAME-ADDRESSED ══════════════════════════════════════════════════
 *
 * The register called this the one component that could not be absorbed: an imperative
 * `setTimeout` machine whose merge writes inline transforms derived from measured layout, which
 * "cannot be frame-addressed as written". It can. The obstacle was never the timers — every
 * component in this film had timers — it was that this one expresses its state through
 * `useState` and its motion through CSS transitions, so there was no prop to drive and no
 * declared value sitting in the markup to interpolate.
 *
 * The technique is the same one used everywhere else, applied one level deeper: **take the
 * component's own shipped static variant as the base, then re-author its declared values per
 * frame.** What is new here is that the static variant has to be *asked for*.
 *
 * ── HOW THE BASE IS OBTAINED ────────────────────────────────────────────────────────
 *
 * `playSuccess()` has a reduced-motion branch (`otp-boxes.tsx:174-178`) that is not a
 * degradation but a **synchronous end state**: it calls `meltTogether()`, sets
 * `{lit: 6, merged: true, pill: true, instant: true}` in one commit, and returns. So the
 * component is driven to its finished frame once, on mount, through its own public handle — and
 * `instant: true` is what makes it usable, because it is the flag that strips the component's
 * own `transition-[…] duration-500` classes. Nothing of the video's then has to fight a CSS
 * transition it cannot seek.
 *
 * That end state is the right base for a second reason: it is the only state in which the
 * component RENDERS the pill's contents at all. `visual.pill && (<Check/> Verified)`
 * (`otp-boxes.tsx:301`) is a conditional child, not an opacity — so from `IDLE` there is no
 * check glyph and no word anywhere in the DOM to fade up, and any attempt to reveal one would
 * have meant re-drawing the pill in the video. From the end state it is present, and the video
 * only has to decide when it is visible.
 *
 * ── AND HOW EVERY VALUE IS PUT BACK ─────────────────────────────────────────────────
 *
 * A scoped stylesheet, per frame, per box — the same mechanism as the bloom's drift and the
 * stateline's emphasis. Every property below is the one the component's own classNames set, and
 * every colour is written as a `color-mix()` of the app's TOKENS rather than a resolved hex, so
 * the merge tracks the palette exactly as the component does and there is no second copy of the
 * theme in the video:
 *
 *   border-color       `border-border` → `border-meadow` (sweep) → `border-transparent` (merge)
 *   box-shadow         `ring-[3px] ring-meadow/40` on the swept box, `ring-0` once merged
 *   background-color   `bg-bg` → `bg-meadow`
 *   color              `text-ink` → `text-transparent`   (this is the digits clearing)
 *   border-radius      `rounded-card` (12) → `rounded-l-[28px]` / `rounded-r-[28px]` / none
 *   transform          `meltTogether()`'s translateX
 *
 * ── THE 1.5px OVERLAP, DERIVED RATHER THAN MEASURED ─────────────────────────────────
 *
 * `meltTogether()` measures the first box and the row and writes an absolute offset per box.
 * That measurement cannot be re-run per frame from outside without a `delayRender` round trip on
 * every frame — but it does not need to be, because **the offsets do not depend on the
 * measurement.** Working it through:
 *
 *   current left of box i, about the row centre    −T/2 + i·(w + g)      T = 6w + 5g
 *   target  left of box i, about the row centre    −B/2 + i·(w − 1.5)    B = 6w − 5·1.5
 *   translateX(i) = (T − B)/2 − i·(g + 1.5) = (g + 1.5)·(2.5 − i)
 *
 * The box width cancels completely; only the gap survives. At this world the row is
 * `gap-1.5 sm:gap-2`, so g = 8 and the offsets are ±23.75, ±14.25, ±4.75 — symmetric about the
 * centre, which is the check that the merged bar stays centred. **The 1.5px overlap is in that
 * expression**, and it is why it is `2.5 − i` against a 9.5px step rather than `2.5 − i` against
 * 8: six same-colour fills that merely abut expose a hairline of page background at fractional
 * widths, which is the defect `OVERLAP` exists to make impossible.
 *
 * ── THE TIMELINE IS THE COMPONENT'S OWN ─────────────────────────────────────────────
 *
 * Converted from `STEP` (`otp-boxes.tsx:71-78`) at 30fps, and the CSS transition duration —
 * 500ms on `cubic-bezier(.4,0,.2,1)`, `otp-boxes.tsx:277` — is a separate number from the
 * step it runs under. That distinction is load-bearing and is the thing an approximation gets
 * wrong: the merge STEP is 540ms of wall time, but the merge MOTION is the 500ms transition
 * inside it, followed by 40ms of settled hold.
 */

const COUNT = 6;
/** `otp-boxes.tsx:149` — a same-colour overlap, so a seam is impossible at any width. */
const OVERLAP = 1.5;
/** `otp-boxes.tsx:244` — `gap-1.5 sm:gap-2`. At a 1200px world the `sm` value applies. */
const GAP = 8;
/** `--radius-card`, which is what `rounded-card` resolves to. */
const RADIUS_IDLE = 12;
/** `rounded-l-[28px]` / `rounded-r-[28px]` on the merged bar's outer corners. */
const RADIUS_MERGED = 28;

const ms = (v: number) => (v * 30) / 1000;

/**
 * The component's `STEP` table, in frames. Named exactly as it is there so a retune upstream is
 * a one-line diff here rather than an archaeology exercise.
 */
export const OTP_TIMELINE = {
  /** Box j lights at j × 130ms. */
  sweepPerBox: ms(130),
  /** The sweep ends (six boxes × 130ms). */
  sweepEnd: ms(130 * COUNT),
  /** `beforeMerge` — the hold before the boxes move. */
  mergeAt: ms(130 * COUNT + 360),
  /** The pill's contents resolve. */
  pillAt: ms(130 * COUNT + 360 + 540),
  /** `SUCCESS_NOTE_DELAY_MS` — when the panel's muted note enters. */
  noteAt: ms(130 * COUNT + 360 + 540 + 400),
  /** playSuccess() returns; the panel navigates. */
  endAt: ms(130 * COUNT + 360 + 540 + 560 + 700),
  /** `transition-… duration-500` — the MOTION inside each step. */
  transition: ms(500),
} as const;

/** `translateX` for box `i` at full merge. See the derivation in the header. */
export const mergeOffset = (i: number): number => (GAP + OVERLAP) * (COUNT / 2 - 0.5 - i);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Drives the real `<OtpBoxes/>` to its end state once, then re-authors every declared value from
 * the frame. `startFrame` is the frame `playSuccess()` would have been called on.
 */
export const OtpChoreography: React.FC<{
  digits: string[];
  startFrame: number;
}> = ({ digits, startFrame }) => {
  const frame = useCurrentFrame();
  const t = frame - startFrame;
  const ref = React.useRef<OtpBoxesHandle>(null);

  /**
   * One call, on mount, through the component's own handle. `reducedMotion` is true so the
   * branch taken is the synchronous one — see the header. It is fire-and-forget: the promise
   * resolves after a 650ms `wait()` that nothing depends on, and the state it sets lands in the
   * same commit as the call.
   */
  React.useEffect(() => {
    void ref.current?.playSuccess();
  }, []);

  /** Box j's halo, on its own 500ms transition starting at j × 130ms. */
  const litAt = (j: number) =>
    interpolate(
      t,
      [j * OTP_TIMELINE.sweepPerBox, j * OTP_TIMELINE.sweepPerBox + OTP_TIMELINE.transition],
      [0, 1],
      { ...clamp, easing: EASE_STANDARD },
    );

  const merge = interpolate(
    t,
    [OTP_TIMELINE.mergeAt, OTP_TIMELINE.mergeAt + OTP_TIMELINE.transition],
    [0, 1],
    { ...clamp, easing: EASE_STANDARD },
  );

  const pill = interpolate(
    t,
    [OTP_TIMELINE.pillAt, OTP_TIMELINE.pillAt + OTP_TIMELINE.transition],
    [0, 1],
    { ...clamp, easing: EASE_OUT },
  );

  /**
   * The digits land ON the sweep, which is what the product does anyway — the halo tracks each
   * arriving digit — and 2f has no room to enter them first.
   */
  const shown = digits.map((d, j) => (t >= j * OTP_TIMELINE.sweepPerBox ? d : ""));

  const rules = digits
    .map((_, i) => {
      const lit = litAt(i);
      const ring = 40 * lit * (1 - merge);
      // `border-border` → `border-meadow` on the sweep → `border-transparent` on the merge.
      const swept = `color-mix(in srgb, var(--color-meadow) ${(lit * 100).toFixed(2)}%, var(--color-border))`;
      const border = `color-mix(in srgb, transparent ${(merge * 100).toFixed(2)}%, ${swept})`;
      const outer = RADIUS_IDLE + (RADIUS_MERGED - RADIUS_IDLE) * merge;
      const inner = RADIUS_IDLE * (1 - merge);
      const tl = i === 0 ? outer : inner;
      const tr = i === COUNT - 1 ? outer : inner;
      return `
        [data-otp] input:nth-child(${i + 1}) {
          transform: translateX(${(merge * mergeOffset(i)).toFixed(3)}px) !important;
          border-color: ${border} !important;
          background-color: color-mix(in srgb, var(--color-meadow) ${(merge * 100).toFixed(2)}%, var(--color-bg)) !important;
          color: color-mix(in srgb, transparent ${(merge * 100).toFixed(2)}%, var(--color-ink)) !important;
          border-radius: ${tl.toFixed(2)}px ${tr.toFixed(2)}px ${tr.toFixed(2)}px ${tl.toFixed(2)}px !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-meadow) ${ring.toFixed(2)}%, transparent) !important;
        }`;
    })
    .join("");

  return (
    <div data-otp>
      <style>{`${rules}
        /* The pill. Its CONTENTS are the component's — the check glyph and the word —
           and only its opacity is the video's, which is the one property the component
           itself animates here: transition-opacity duration-500 ease-out. */
        [data-otp] div[aria-live="polite"] { opacity: ${pill.toFixed(3)} !important; }
      `}</style>
      <OtpBoxes ref={ref} digits={shown} onDigitsChange={() => {}} disabled reducedMotion />
    </div>
  );
};
