import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

import { EASE_STANDARD, sec } from "./motion";

/**
 * ══ HOVER, AND WHY THE FILM HAD NONE ════════════════════════════════════════════════
 *
 * The cursor arrived at a control and the control did nothing until the click. **Real software
 * lights up under a pointer**, and the absence of that is why the clicks still read as
 * disconnected from the things they land on even now that there is a cursor: the pointer and the
 * interface were two layers that never acknowledged each other.
 *
 * The cause is structural rather than an oversight. `src/shims/use-media-query.ts` forces reduced
 * motion so every component renders its static variant, but `:hover` is a different problem
 * entirely — **a render has no pointer**. Remotion sets a frame and screenshots; nothing is ever
 * over anything, so no `:hover` rule in the bundle can ever match. Every `hover:` utility in
 * `apps/web` is dead code inside this film, and no amount of correct component usage brings it
 * back.
 *
 * ── SO THE RULE IS RE-DECLARED, NOT INVENTED ────────────────────────────────────────
 *
 * This is the same technique `motion.tsx` uses for animation, one layer over: **every value here
 * is read off the component and cited**, and the mechanism is a scoped stylesheet that applies
 * the component's own hover declaration to the component's own element, gated on the frame
 * instead of on a pointer.
 *
 * The treatments below are `button.tsx`'s variant table, transcribed. If a variant's hover is
 * ever retuned, this file is where it will disagree, and a disagreement here is a bug in this
 * file rather than a liberty.
 *
 * ── THE TRANSITION IS THE COMPONENT'S, INCLUDING WHERE THERE ISN'T ONE ──────────────
 *
 * `buttonVariants`' base class list carries **`transition-colors`** (`button.tsx:8`), whose
 * Tailwind default is 150ms. That covers `background-color`, `border-color`, `color`, `fill`,
 * `stroke` and `text-decoration-color` — and **not `opacity`**. So a `hover:bg-*` treatment eases
 * in over 150ms and a `hover:opacity-90` treatment *snaps*, in the product and therefore here.
 * Each entry declares which it is rather than smoothing everything to taste: a uniform 150ms
 * would look better and would be a different product.
 *
 * ── HOW A CONTROL IS ADDRESSED ──────────────────────────────────────────────────────
 *
 * By CSS selector, because the video cannot put a class on a shipped component's button. The
 * selectors are the same structural ones `SwapProbe.tsx` already uses to MEASURE these controls,
 * which means every one of them has been verified against the real DOM rather than guessed —
 * `geometry.ts`'s numbers came out of them.
 */

/**
 * The shipped hover treatments, from `apps/web/components/ui/button.tsx`.
 *
 * Each is a **function of `t`**, the 0→1 progress of the component's own transition, rather than
 * a fixed declaration — which is what lets the rule arrive over 150ms instead of on one frame.
 * A `bg-meadow/10` wash at `t` is genuinely that wash at `10·t %`, so the intermediate frames are
 * the colours the browser would have interpolated rather than a fade laid over the top.
 *
 * `snap` records whether `transition-colors` covers the property. Opacity is not a colour, so
 * `hover:opacity-90` has nothing to transition it, lands on one frame in the product, and lands
 * on one frame here — `t` is pinned to 1 for those and the function ignores it.
 */
export const HOVER = {
  /** `default: "bg-ink text-bg hover:opacity-90"` — `button.tsx:19`. */
  default: { css: () => "opacity: 0.9;", snap: true },
  /** `meadow: "bg-meadow text-on-accent hover:opacity-90 dark:text-bg"` — `button.tsx:47`. */
  meadow: { css: () => "opacity: 0.9;", snap: true },
  /** `foggy: "bg-foggy text-on-accent hover:opacity-90 dark:text-bg"` — `button.tsx:56`. */
  foggy: { css: () => "opacity: 0.9;", snap: true },
  /**
   * `outline: "border border-input bg-background hover:bg-accent dark:hover:text-bg"` —
   * `button.tsx:29`. `accent` is foggy, and the dark-mode text override is **part of the shipped
   * treatment rather than a nicety**: without it this is light-on-light at ~1.5:1, which is a
   * reported and fixed bug that reproducing half the rule would re-introduce.
   *
   * The fill crosses from the button's resting `background` to `accent`, and the text from `ink`
   * to `bg` — both interpolated, because both are colours and `transition-colors` covers both.
   */
  outline: {
    css: (t: number) =>
      `background-color: color-mix(in srgb, var(--color-accent) ${100 * t}%, var(--color-background));
       color: color-mix(in srgb, var(--color-bg) ${100 * t}%, var(--color-ink));`,
    snap: false,
  },
  /** `secondary: "bg-surface text-ink border border-meadow hover:bg-meadow/10"` — `button.tsx:63`. */
  secondary: {
    css: (t: number) =>
      `background-color: color-mix(in srgb, var(--color-meadow) ${10 * t}%, var(--color-surface));`,
    snap: false,
  },
  /** `ghost: "hover:bg-foggy/15"` — `button.tsx:66`. Transparent at rest, so it mixes to that. */
  ghost: {
    css: (t: number) =>
      `background-color: color-mix(in srgb, var(--color-foggy) ${15 * t}%, transparent);`,
    snap: false,
  },
  /**
   * The confirmatory prompt's options — `OPTION` in `confirmatory-prompt.tsx:27`, which is its
   * own control rather than a `<Button/>`:
   * `hover:bg-[color-mix(in_srgb,var(--color-foggy)_8%,var(--color-surface))]`, over the same
   * `transition-colors` the buttons carry. It rests on `bg-bg`, so the mix runs from there.
   */
  promptOption: {
    css: (t: number) =>
      `background-color: color-mix(in srgb,
         color-mix(in srgb, var(--color-foggy) 8%, var(--color-surface)) ${100 * t}%,
         var(--color-bg));`,
    snap: false,
  },
  /**
   * A bare interactive row — the chat list, the header's icon buttons. `hover:bg-bg`, the idiom
   * at `chat-shell.tsx:442,511,615`. Rests transparent over `surface`.
   */
  row: {
    css: (t: number) =>
      `background-color: color-mix(in srgb, var(--color-bg) ${100 * t}%, transparent);`,
    snap: false,
  },
  /**
   * The `(auth)` submit — "Create account". `signup-form.tsx:255` is
   * `bg-ink … text-bg transition-opacity hover:opacity-90`, and it is the one hover in the film
   * that the product genuinely **eases**: it carries `transition-opacity` rather than the
   * `<Button/>` base's `transition-colors`, so the property being changed is the property being
   * transitioned. Everywhere else `hover:opacity-90` snaps for exactly the opposite reason.
   */
  submitAuth: {
    css: (t: number) => `opacity: ${1 - 0.1 * t};`,
    snap: false,
  },
  /**
   * ── THE ONE AUTHORED TREATMENT, DECLARED AS SUCH ──────────────────────────────────
   *
   * **The chat send button ships no hover at all.** `chat-shell.tsx:388` is
   * `bg-foggy text-on-accent transition-opacity disabled:opacity-50` — a disabled state and an
   * opacity transition with nothing to trigger it. There is no shipped rule to reproduce, so this
   * one is authored, and it is authored as the house idiom rather than as an invention: every
   * filled `<Button/>` variant in the product hovers to `opacity-90`, and the element already
   * carries `transition-opacity`, so this is the treatment the control would have if it had one.
   *
   * It is listed separately from `HOVER.foggy` — which is the identical declaration — so that
   * this note travels with the call site and nobody later reads the film as evidence that the
   * control ships a hover. **It is the only entry in this table that is not transcribed.**
   */
  sendAuthored: { css: () => "opacity: 0.9;", snap: true },
} as const;

export type HoverTreatment = keyof typeof HOVER;

/** `transition-colors`' Tailwind default. `button.tsx:8` carries it on every variant. */
const TRANSITION_FRAMES = sec(0.15);

/**
 * Lights a control for a window of frames.
 *
 * `from` is the frame the pointer arrives; `to` is where it leaves. **A click sits inside that
 * window**, not at its end — a real pointer is still over a button while it presses it, and a
 * control that un-hovered on the press would read as the cursor jumping off the thing it just
 * clicked.
 */
export const Hover: React.FC<{
  /** A CSS selector for the control. Prefer one `SwapProbe.tsx` already measures. */
  selector: string;
  treatment: HoverTreatment;
  from: number;
  to: number;
}> = ({ selector, treatment, from, to }) => {
  const frame = useCurrentFrame();
  const { css, snap } = HOVER[treatment];

  if (frame < from || frame >= to) return null;

  const t = snap
    ? 1
    : interpolate(frame, [from, from + TRANSITION_FRAMES], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: EASE_STANDARD,
      });

  // `!important` because these compete with the element's own utility classes, which are equally
  // specific and later in the cascade. Nothing else in the film needs it; a hover rule losing to
  // the resting rule is silent, and a silent no-op is the failure mode this whole file exists to
  // end.
  const declarations = css(t)
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => `${d} !important;`)
    .join("\n      ");

  return <style>{`${selector} {\n      ${declarations}\n    }`}</style>;
};

/**
 * A 0→1 hover ramp for the AUTHORED surfaces — the mail list row, the player's transport — which
 * take a number rather than a stylesheet because the video owns their markup and can style them
 * directly. Same 150ms, so a drawn control and a shipped one light at the same rate and the two
 * kinds of software on screen behave alike.
 */
export const useHover = (from: number, to: number): number => {
  const frame = useCurrentFrame();
  if (frame >= to) return 0;
  return interpolate(frame, [from, from + TRANSITION_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_STANDARD,
  });
};
