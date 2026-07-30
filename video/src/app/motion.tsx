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
 * which is the correct base to animate over — and **nothing was putting the loop back**. That is
 * this pass's finding rather than a declared liberty: the film's central graphic, which the
 * sheet describes in beat 7 as "the bloom **pulsing** meadow", was a still circle for its entire
 * time on screen. The greybox's stand-in pulsed; the real component replaced it with a
 * photograph of itself. `useBreath` existed, was written against the right numbers, and was
 * wired to the CALIBRATION preview instead, where it scaled the whole webcam box at the wrong
 * period (see `useOrbBreath` above — two components' motions had been crossed).
 *
 * It is reproduced on the two layers SEPARATELY rather than on the wrapper. They are separately
 * addressable — `bloom.tsx:65-76` renders them as the wrapper's two child `span`s, halo first —
 * and the component genuinely breathes them at different amplitudes (1.06 against 1.03) with an
 * opacity breath on the halo alone. A wrapper transform cannot express that and there is no
 * reason to settle for one.
 */
const BREATH_CYCLE = sec(6.5);

/** A three-keyframe framer `animate` array with `easeInOut` is a 0→1→0 triangle, eased. */
const breathPhase = (frame: number): number => {
  const phase = (frame % BREATH_CYCLE) / BREATH_CYCLE;
  const tri = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  return EASE_IN_OUT(tri);
};

export const useBloomBreath = (): { halo: { scale: number; opacity: number }; core: number } => {
  const t = breathPhase(useCurrentFrame());
  return {
    halo: {
      scale: interpolate(t, [0, 1], [0.9, 1.06]),
      opacity: interpolate(t, [0, 1], [0.72, 1]),
    },
    core: interpolate(t, [0, 1], [0.94, 1.03]),
  };
};

/**
 * ── THE CALIBRATION BREATHING ORB, AND THE COPY THAT WAS WRONG ──────────────────────
 *
 * Source: `components/anchor/breathing-guide.tsx`.
 *
 * **The film was showing the reduced-motion variant and calling it the product.** The orb has
 * two behaviours, and the shim that forces `prefers-reduced-motion` picks the wrong one:
 *
 *   full motion   discs `scale: [0.84, 1.12, 0.84]` on an 8s `easeInOut` loop (`:93-95`), and
 *                 the pacer label ALTERNATES "Breathe in" / "Breathe out" on a 4s interval
 *                 (`:31`, `:55-61`) — a 4s inhale and a 4s exhale, which is the 8s cycle
 *   reduced       the discs hold still and the label is a single static **"Breathe gently"**
 *                 (`STATIC_LABEL`, `:32`), which is FR-032's accessibility behaviour
 *
 * "Breathe gently" is not invented copy — it is real, shipped, and it is the wrong one. It is
 * what a user who has asked their OS for less motion sees, and the film is not that user. The
 * beat sheet asked for the alternation all along (5d: 'label alternating "Breathe in" /
 * "Breathe out"'), and the greybox was faithful to it; the component swap silently replaced it.
 *
 * Both halves are put back here from the frame, on the component's own declared numbers.
 *
 * ── AND THE BREATH WAS ON THE WRONG ELEMENT ─────────────────────────────────────────
 *
 * The previous pass drove the calibration preview with `useBreath()`, which is the MONITORING
 * bloom's loop (`bloom.tsx`: 6.5s, 0.92→1.045) applied to the whole 512×288 preview box — so the
 * entire webcam feed, the character and the framing brackets pulsed together, at the wrong
 * period, while the orb that is supposed to be breathing sat still. Two different components'
 * motions had been crossed. `useOrbBreath` is the orb's own, and it is applied to the orb's own
 * discs layer.
 */
/** `breathing-guide.tsx:95` — `duration: 8`, one inhale + one exhale. */
export const ORB_CYCLE_REAL = sec(8);
/** `breathing-guide.tsx:93` — `animate={{ scale: [0.84, 1.12, 0.84] }}`. */
const ORB_SCALE = { min: 0.84, max: 1.12 } as const;

/**
 * ── THE ONE COMPRESSION IN THIS, AND WHY IT IS NOT A THIRTIETH ──────────────────────
 *
 * Beat 5d shows ~2 seconds of a 60-second capture, which the sheet calls the most aggressive
 * compression in the video. The timer and the progress bar take that 30× directly — they are
 * counters, and a counter running fast reads as a counter running fast.
 *
 * **The breath cannot.** At 30× the discs would flutter four times a second and the pacer would
 * strobe, which reads as a glitch rather than as breathing and would be the one thing on screen
 * contradicting the word "calm". At the real 8s cycle the opposite happens: a 2s window shows a
 * quarter of one breath, the discs barely move, and the label never changes — so the pacer's
 * whole nature, that it alternates, is invisible.
 *
 * So the cycle is a parameter, and beat 5d passes the length of its own window: **one complete
 * breath, in and out, inside the compressed minute.** The audience sees the orb fill and empty
 * once and reads "this is a breathing exercise", which is what the beat is for. The shape,
 * amplitude, easing and copy are all the component's; only the period is staged.
 */
export const useOrbBreath = (from = 0, cycleFrames = ORB_CYCLE_REAL): number => {
  const frame = useCurrentFrame();
  const phase = (((frame - from) % cycleFrames) + cycleFrames) % cycleFrames / cycleFrames;
  const tri = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  return interpolate(EASE_IN_OUT(tri), [0, 1], [ORB_SCALE.min, ORB_SCALE.max]);
};

/**
 * The pacer label, put back.
 *
 * The component holds its label in React state, so it cannot be driven from outside — the only
 * reachable seam is the DOM. So the component's own static label is hidden and the alternating
 * one is drawn over it **with that element's className quoted character-for-character**
 * (`breathing-guide.tsx:106`), which makes the result identical in every respect except the two
 * words that were wrong. The `scale` goes on the component's own static-bloom layer by its
 * `data-testid`, so the discs, their gradients and their opacities stay the component's.
 *
 * `visibility: hidden` rather than `display: none`: the label is `relative z-10` inside a grid
 * that centres it, and removing it from layout would move the box it is centred in.
 *
 * The label follows the same clock as the discs — half a cycle each, inhale first — which is
 * what `breathing-guide.tsx` does with a `setInterval` at half its `duration`. Tying them to one
 * parameter also makes it impossible for the words and the motion to drift apart, which they
 * would if the label kept a hard-coded 4s while the cycle was staged.
 */
export const BreathPacer: React.FC<{
  scopeAttr: string;
  /** The frame the capture starts on, so the first half-cycle is an inhale. */
  from?: number;
  cycleFrames?: number;
}> = ({ scopeAttr, from = 0, cycleFrames = ORB_CYCLE_REAL }) => {
  const frame = useCurrentFrame();
  const scale = useOrbBreath(from, cycleFrames);
  const half = cycleFrames / 2;
  const label = Math.floor(Math.max(0, frame - from) / half) % 2 === 0 ? "Breathe in" : "Breathe out";
  return (
    <>
      <style>{`
        [data-${scopeAttr}] [data-testid="breath-bloom-static"] { scale: ${scale}; }
        [data-${scopeAttr}] p[aria-live="polite"] { visibility: hidden; }
      `}</style>
      <p
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 grid place-items-center text-center text-sm font-medium tracking-wide text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]"
      >
        {label}
      </p>
    </>
  );
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
