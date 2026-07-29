import { cn } from "@/lib/utils";

/**
 * Ren's avatar — the drawn mark (2026-07-29). Replaces the framed "R" that stood in
 * for it from feature 011 until now.
 *
 * ONE DEFINITION, AND NOW ONE COLOUR. The component was already the single definition
 * of the mark (lifted out of `chat-shell.tsx` on 2026-07-28 so the landing page could
 * consume it rather than restate it). What it was NOT was a single *appearance*: it
 * carried a `color` prop, and the two surfaces promptly diverged through it — meadow in
 * the app, `var(--color-foggy)` on the landing page. The prop is gone. Ren is foggy, in
 * both modes, everywhere, and a call site cannot say otherwise.
 *
 * WHY FOGGY, AND WHY IT IS NOW A RULE. `meadow`, `amber` and `crimson` all carry
 * stress-band or outcome meaning under Principle V, so a mark wearing one of them
 * encodes a reading it does not have — a meadow Ren beside a stress readout looks like
 * it is asserting that readout is calm. `foggy` is the only accent outside the band
 * scale, so Ren can sit beside any reading without being read as a state. This shipped
 * as an approved liberty on the landing page (FR-022) and was flagged for review at the
 * time; constitution Amendment 18 (v1.14.0) ratifies it as a rule and removes the
 * liberty framing. See docs/DECISIONS.md 2026-07-29.
 *
 * THE EYE COLOUR IS THE FILLED-ACCENT FOREGROUND PAIR. `fill-on-accent dark:fill-bg` is
 * the same pair `Button` uses for its filled meadow and foggy variants, and the same one
 * the old framed "R" used. Measured on filled foggy: 5.33:1 light, 8.34:1 dark — both
 * clear AA, and better than the meadow it replaces (4.78:1). Amendment 18 extends the
 * Principle V foreground rule to cover identity marks explicitly, so this is no longer
 * an unwritten precedent borrowed from the CTA rule.
 *
 * THE PATH DATA IS LOCKED. The three paths and the per-state transforms are measured
 * values from the signed-off design. They are not to be re-derived, rounded, or
 * "cleaned up". If one of them renders wrong, report it — do not adjust it.
 *
 * NEVER BELOW 24px. Under that the eyes close up and the mark reads as a smudge, so
 * `size` is clamped rather than trusted. No current call site is below it (28 is the
 * smallest, in the landing page's Ren panel); the clamp is a floor for future ones.
 */

/** Open eyes, per state. `idle` is the untransformed pair. */
const OPEN_EYE_TRANSFORMS = {
  idle: { left: undefined, right: undefined },
  attentive: {
    left: "translate(-11.17,-6.87) scale(1.22)",
    right: "translate(-15.66,-6.89) scale(1.22)",
  },
  thinking: {
    left: "translate(19.29,11.87) scale(0.62)",
    right: "translate(27.05,11.91) scale(0.62)",
  },
} as const;

export type RenState = "idle" | "attentive" | "thinking" | "warm";

const BODY_PATH =
  "M 54.78 3.41 c -3.74 0.77 -8.14 2.79 -11.31 5.19 -1.61 1.23 -1.58 1.23 -3.42 -0.46 -3.88 -3.55 -6.8 -4.73 -11.78 -4.73 -2.81 -0 -3.74 0.11 -5.25 0.6 -5.41 1.83 -9.32 5.82 -11.2 11.42 -0.63 1.91 -0.63 1.91 -0.63 34.43 0 26.26 0.08 32.74 0.36 33.61 1.64 4.92 3.44 7.71 6.48 9.97 9.51 7.08 22.52 3.91 27.35 -6.67 1.45 -3.14 1.58 -4.15 1.64 -11.86 0.03 -3.96 0.14 -7.62 0.25 -8.17 0.41 -2.19 2.08 -4.37 4.18 -5.49 1.64 -0.87 1.64 -0.87 5.96 -0.87 7.24 -0.03 11.48 -0.87 16.37 -3.33 6.45 -3.2 11.89 -9.73 13.99 -16.75 1.75 -5.79 1.72 -12.52 -0.08 -17.82 -2.79 -8.2 -10.17 -15.66 -17.98 -18.14 -4.34 -1.39 -10.63 -1.78 -14.92 -0.93z";

const OPEN_LEFT_PATH =
  "M 48.06 22.46 c -1.09 0.74 -1.53 1.28 -2.4 3.09 -1.09 2.19 -1.09 2.19 -1.09 5.6 -0.03 4.67 0.87 7.1 3.28 8.94 0.9 0.66 1.26 0.77 2.87 0.77 2.35 -0 3.52 -0.82 4.84 -3.47 4.04 -7.98 -1.45 -18.94 -7.49 -14.92z";

const OPEN_RIGHT_PATH =
  "M 69.43 21.96 c -2.79 1.23 -4.54 4.97 -4.54 9.7 0 7.54 5.52 12 9.7 7.82 3.74 -3.74 3.85 -11.72 0.22 -15.96 -1.58 -1.89 -3.44 -2.4 -5.38 -1.56z";

const CLOSED_LEFT_PATH =
  "M 24.4 29.74 c -1.25 1.57 -0.27 5.04 2.14 7.72 4.93 5.5 13.84 4.28 17.15 -2.38 1.84 -3.68 1.38 -6.04 -1.16 -6.07 -1.33 -0 -2.11 0.68 -2.44 2.17 -0.16 0.68 -0.57 1.73 -0.95 2.38 -2.55 4.33 -9.62 3.03 -10.56 -1.95 -0.43 -2.44 -2.87 -3.49 -4.17 -1.87z";

const CLOSED_RIGHT_PATH =
  "M 54.74 29.74 c -1.52 1.92 0.76 7.12 4.06 9.43 3.12 2.14 7.59 2.33 11.27 0.46 2.44 -1.25 4.98 -5.04 5.2 -7.75 0.3 -3.52 -4.06 -4.04 -4.71 -0.54 -0.51 2.87 -2.76 4.71 -5.77 4.71 -3.14 -0 -5.31 -1.73 -5.82 -4.71 -0.41 -2.25 -2.95 -3.2 -4.23 -1.6z";

/** The measured transforms the closed pair always carries; they are part of the mark. */
const CLOSED_LEFT_TRANSFORM = "translate(27.85,7.93) scale(0.667)";
const CLOSED_RIGHT_TRANSFORM = "translate(27.98,8.03) scale(0.667)";

/** Below this the eyes close up and Ren reads as a smudge. */
const MIN_SIZE = 24;

export function RenAvatar({
  size = 34,
  state = "idle",
  className,
}: {
  size?: number;
  /**
   * `idle` · `attentive` · `thinking` use the open eyes; `warm` is the closed pair.
   * A `warm` avatar does not blink — it is already closed.
   */
  state?: RenState;
  className?: string;
}) {
  const rendered = Math.max(MIN_SIZE, size);
  const isWarm = state === "warm";
  const openEyes = isWarm ? null : OPEN_EYE_TRANSFORMS[state];

  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      width={rendered}
      height={rendered}
      // `block` keeps the SVG off the text baseline, so a flex row of avatar + label
      // aligns on the box rather than on a phantom descender.
      className={cn("block shrink-0", className)}
      data-ren-state={state}
    >
      <path d={BODY_PATH} className="fill-foggy" />

      {/*
        Both eye pairs are in the DOM whenever Ren can blink; the blink is an opacity
        swap between them, not a re-render. `ren-blink` and `ren-blink-closed` are exact
        inverses (app/globals.css) and are both `animation: none` under
        prefers-reduced-motion, which leaves the open pair at rest — silent, per brief.
      */}
      {openEyes && (
        <g className="ren-eyes-open fill-on-accent dark:fill-bg">
          <path d={OPEN_LEFT_PATH} transform={openEyes.left} />
          <path d={OPEN_RIGHT_PATH} transform={openEyes.right} />
        </g>
      )}

      <g
        className={cn(
          "fill-on-accent dark:fill-bg",
          // A warm Ren is closed permanently, so it takes no animation and no opacity
          // class — it is simply the only pair rendered.
          isWarm ? undefined : "ren-eyes-closed",
        )}
      >
        <path d={CLOSED_LEFT_PATH} transform={CLOSED_LEFT_TRANSFORM} />
        <path d={CLOSED_RIGHT_PATH} transform={CLOSED_RIGHT_TRANSFORM} />
      </g>
    </svg>
  );
}
