import React from "react";
import { Easing, interpolate, interpolateColors, useCurrentFrame } from "remotion";

/**
 * ── RE-AUTHORED MOTION ──────────────────────────────────────────────────────────────
 *
 * `src/shims/use-media-query.ts` forces `prefers-reduced-motion` to true across the whole
 * bundle, so every `apps/web` component renders its shipped STATIC variant and no
 * framer-motion / CSS-transition / `setTimeout` animation ever runs. That is the only way a
 * Remotion render can be frame-exact — the renderer sets the frame and screenshots; it does not
 * advance the wall clock between frames.
 *
 * This file puts the motion back, per frame. **Every value here is READ OFF THE COMPONENT, not
 * invented**, and each helper cites the file and line it came from. That citation is the point:
 * it is what makes this a faithful replay of the product's designed motion rather than a video
 * person's impression of it. If a component's timing is ever retuned, the citation is where to
 * look, and a mismatch is a bug in this file — not a liberty.
 *
 * The helpers are all pure functions of the frame. None of them holds state, so none of them can
 * drift across a render or differ between a Studio scrub and a CLI render.
 */

/** The app's own motion easing for entrances. Matches `--ease-out` / framer's `easeOut`. */
export const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
/** framer-motion's `easeInOut`, used by the bloom's breathing and the OTP sway. */
export const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);
/** The app's shared control transition, `cubic-bezier(.4,0,.2,1)` — `otp-boxes.tsx:277`. */
export const EASE_STANDARD = Easing.bezier(0.4, 0, 0.2, 1);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Frames from seconds at the project's fixed 30fps. Keeps the citations readable as seconds. */
export const sec = (s: number) => Math.round(s * 30);

/**
 * ── THE BLOOM'S BAND DRIFT ──────────────────────────────────────────────────────────
 *
 * Source: `components/monitor/bloom.tsx:68,74` — `transition: "background 1.3s ease"`, over
 * `TONE_COLOR` (`:28`). The beat sheet is explicit that a band change must DRIFT rather than
 * snap, and calls the 1.3s ease "the honest behaviour" (beat 8, step 2).
 *
 * The real component reaches that drift with a CSS transition on a `radial-gradient` whose stops
 * are `color-mix()` of a CSS variable. A CSS transition cannot run in a render, and a gradient
 * interpolation is not something to hand-roll — so the drift is driven through the component's
 * OWN `color` prop instead (`bloom.tsx:57`), which overrides `--bloom` directly. Every gradient
 * stop is derived from that one variable, so interpolating it reproduces the whole drift exactly,
 * including the halo, with no second implementation of the gradient.
 *
 * `color` exists on the component already — it is not added for the video. It was built for the
 * landing page (feature 013, T082) precisely because `--bloom` is an inline style an ancestor
 * cannot override.
 *
 * Resolved hex rather than tokens: `interpolateColors` needs parseable colours, and the tokens
 * are `color-mix()` expressions. These are the `:root.dark` values from `globals.css:146-163`
 * and the mid-gold is `color-mix(in srgb, amber 55%, meadow)` (`bloom.tsx:32`) resolved at that
 * ratio. DARK VALUES — this pass is dark; the light ones are not used anywhere in the film.
 */
const BLOOM_DARK = {
  /** `--color-meadow` dark. */
  meadow: "#63B292",
  /** `color-mix(in srgb, #E4AE5C 55%, #63B292)` — the mock's mid-gold through the dark tokens. */
  little: "#B7A473",
  /** `--color-amber` dark. */
  amber: "#E4AE5C",
} as const;

/**
 * A band drift as a colour for `<Bloom color={…} />`.
 *
 * `at` is the frame the drift begins; it takes 1.3s, the component's own duration. `tension`
 * runs 0 (at ease) → 0.5 (a little tense) → 1 (tense), so the two-step escalation beat 8 needs
 * is one monotonic ramp through the same three colours the component would have used.
 */
export const useBloomColor = (tension: number): string =>
  interpolateColors(tension, [0, 0.5, 1], [BLOOM_DARK.meadow, BLOOM_DARK.little, BLOOM_DARK.amber]);

/** The drift's own 1.3s ease, as a 0→1 progress you feed into `useBloomColor`. */
export const useDrift = (from: number, to: number, startFrame: number): number => {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + sec(1.3)], [from, to], {
    ...clamp,
    easing: EASE_IN_OUT,
  });
};

/**
 * ── THE BLOOM'S BREATHING ───────────────────────────────────────────────────────────
 *
 * Source: `components/monitor/bloom.tsx:97-104`. Two framer-motion loops on one 6.5s cycle,
 * `easeInOut`, `repeat: Infinity`:
 *   halo — scale [0.9, 1.06, 0.9], opacity [0.72, 1, 0.72]
 *   core — scale [0.94, 1.03, 0.94]
 *
 * Under forced reduced motion the component renders the two layers static (`bloom.tsx:87-91`),
 * which is the correct base to animate over. The breathing is re-applied here as a transform on
 * the component's WRAPPER rather than on its two inner layers, because the wrapper is what the
 * video can reach without touching `apps/web`.
 *
 * That is a small, declared divergence and it is worth naming: the real component breathes its
 * halo and core on slightly different amplitudes (1.06 vs 1.03), and a single wrapper transform
 * cannot. The visible difference at the framings the bloom appears at — 148px of world inside a
 * ~1050px frame — is well under a pixel of edge travel, and the alternative is a second copy of
 * the gradient stack in the video, which would be a real fidelity risk rather than a
 * sub-pixel one. The halo's opacity breath IS reproducible on the wrapper and is kept.
 */
export const useBreath = (): { scale: number; opacity: number } => {
  const frame = useCurrentFrame();
  const cycle = sec(6.5);
  // A full period as a 0→1→0 triangle, then eased — which is what a three-keyframe
  // framer `animate` array with `easeInOut` produces.
  const phase = (frame % cycle) / cycle;
  const tri = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  const t = EASE_IN_OUT(tri);
  return {
    // The mean of the component's two amplitudes, since one wrapper carries both layers.
    scale: interpolate(t, [0, 1], [0.92, 1.045]),
    opacity: interpolate(t, [0, 1], [0.86, 1]),
  };
};

/**
 * ── THE CALIBRATION SUCCESS RIPPLE ──────────────────────────────────────────────────
 *
 * Source: `components/anchor/success-state.tsx:30-36`.
 *   `bg-meadow/30`, `absolute inset-0 rounded-full` on a `size-24` (96px) box,
 *   `initial {scale: 0.8, opacity: 0.5}` → `animate {scale: 2.1, opacity: 0}`,
 *   `transition {duration: 1.1, ease: "easeOut"}`.
 *
 * **This is the measurement register item 4 turns on.** The ripple's terminal scale is 2.1 on a
 * 96px box, so its extent is 96 × 2.1 = 201.6px centred on a 96px badge — i.e. it reaches
 * (201.6 − 96) / 2 = **52.8px beyond the badge on every side**. The badge sits 24px below the
 * component's own top edge (`py-6`), so the ripple crosses the component's top edge by
 * 52.8 − 24 = **28.8px**. A bounding box measured off the component alone is 28.8px too short,
 * which is exactly why beat 5f has read as punched-in across three revisions.
 *
 * Under forced reduced motion the real ripple is not rendered at all (`:29` `!reducedMotion`),
 * so the video draws it — with these numbers, so it is the same ripple.
 */
export const RIPPLE = {
  badge: 96,
  fromScale: 0.8,
  toScale: 2.1,
  fromOpacity: 0.5,
  durationFrames: sec(1.1),
  /** How far the ripple reaches past the badge's edge at terminal scale. */
  overshootPx: (96 * 2.1 - 96) / 2,
  /** How far it reaches past the component's own top edge, given `py-6` above the badge. */
  aboveComponentPx: (96 * 2.1 - 96) / 2 - 24,
} as const;

export const Ripple: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [startFrame, startFrame + RIPPLE.durationFrames], [0, 1], {
    ...clamp,
    easing: EASE_OUT,
  });
  if (frame < startFrame) return null;
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "9999px",
        // `bg-meadow/30` at the dark meadow. Kept as a resolved value because this element is
        // authored by the video, not the app — see the note in `furniture.ts`.
        backgroundColor: "rgba(99, 178, 146, 0.3)",
        scale: interpolate(t, [0, 1], [RIPPLE.fromScale, RIPPLE.toScale]),
        opacity: interpolate(t, [0, 1], [RIPPLE.fromOpacity, 0]),
      }}
    />
  );
};

/**
 * ── THE SUCCESS CHECK'S PATH DRAW ───────────────────────────────────────────────────
 *
 * Source: `components/anchor/success-state.tsx:40-49` — `motion.path` on
 * `d="M14 25 L21 32 L35 17"`, `pathLength 0 → 1`, `duration 0.5, easeOut, delay 0.1`.
 *
 * Under forced reduced motion the path renders complete (`initial={false}`), which is the right
 * static base. The draw is re-applied from OUTSIDE the component with a scoped stylesheet that
 * sets `stroke-dasharray` / `stroke-dashoffset` on that path — the same mechanism framer's
 * `pathLength` compiles down to. That keeps the check the component's check: same `d`, same
 * stroke, same cap, same colour token.
 *
 * The path's length is 9.90 + 20.52 = 30.42 user units (two segments, by Pythagoras on the `d`
 * above). Rounded up to 31 so the dash never leaves a hairline tail at t=1.
 */
const CHECK_PATH_LEN = 31;

export const CheckDraw: React.FC<{ scopeAttr: string; startFrame: number }> = ({
  scopeAttr,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(
    frame,
    [startFrame + sec(0.1), startFrame + sec(0.1) + sec(0.5)],
    [0, 1],
    { ...clamp, easing: EASE_OUT },
  );
  return (
    <style>{`[data-${scopeAttr}] svg path {
      stroke-dasharray: ${CHECK_PATH_LEN};
      stroke-dashoffset: ${(1 - t) * CHECK_PATH_LEN};
    }`}</style>
  );
};

/**
 * ── THE NOTIFICATION'S ENTRANCE ─────────────────────────────────────────────────────
 *
 * Source: `components/notification.tsx` desktop variant — a framer `AnimatePresence` slide from
 * the right with a fade. The real component's own numbers are used where the video renders a
 * real `Notification` (beat 9's confirmatory prompt); the authored mail toast in beat 8 is NOT
 * a Serenify component and takes the same curve deliberately, because both are macOS-style
 * toasts on the same screen and two different entrance curves would read as two different
 * operating systems.
 */
export const useToastIn = (startFrame: number): { x: number; opacity: number } => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [startFrame, startFrame + sec(0.42)], [0, 1], {
    ...clamp,
    easing: EASE_OUT,
  });
  return { x: interpolate(t, [0, 1], [28, 0]), opacity: t };
};

/**
 * ── THE IN-PLACE EMPHASIS (L12) ─────────────────────────────────────────────────────
 *
 * Not a component's motion — this one is the video's own device, and the only reason it lives
 * here is that it must share the easing vocabulary with everything above so a raise and a
 * camera move feel like the same film.
 *
 * It is a RULE, not a budget: it fires on every stateline copy change (beats 7, 8, 11). The one
 * hard constraint is **no yo-yo** — beat 8's two copy changes are covered by a single raise, so
 * this returns a value that can be held across both rather than a per-change pulse.
 */
export const useEmphasis = (keys: { frame: number; up: number }[]): number => {
  const frame = useCurrentFrame();
  if (keys.length < 2) return keys[0]?.up ?? 0;
  return interpolate(
    frame,
    keys.map((k) => k.frame),
    keys.map((k) => k.up),
    { ...clamp, easing: EASE_IN_OUT },
  );
};
