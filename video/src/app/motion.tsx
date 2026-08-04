import React from "react";
import { Easing, interpolate, interpolateColors } from "remotion";
import { useCurrentFrame } from "../retime";

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
 * ══ THE SHIM ANSWERS THE QUERY FOR JAVASCRIPT. THIS ANSWERS IT FOR CSS. ══════════════
 *
 * **`prefers-reduced-motion` was only ever forced on ONE of the two engines that read it**, and
 * that gap is the whole of the "the checkmark flashes" class of defect — including the
 * countdown's rewind, which was diagnosed as a `setTimeout` and was only half that story.
 *
 * `shims/use-media-query.ts` intercepts the JS **hook**, so any component that gates its motion
 * by a JS branch — `reducedMotion ? <span/> : <motion.span/>`, or a conditional class string —
 * takes its static variant correctly. `success-state.tsx`, `breathing-guide.tsx`,
 * `recording-timer.tsx`, `use-story-clock.ts` and `ren-thread.tsx` are all that shape and are all
 * genuinely silent in the film.
 *
 * **Nothing was answering it for the CSS engine.** Chromium evaluates `@media
 * (prefers-reduced-motion: reduce)` itself, against a media feature the render never sets, so
 * every `motion-reduce:` Tailwind variant in `apps/web` and every raw `transition:` in an inline
 * style stayed LIVE — and a live CSS transition inside a frame-addressed render is a second clock
 * on a value the film addresses by frame. Remotion keeps one browser page and steps the frame on
 * it, so those transitions run against real elapsed wall-clock time between screenshots: what
 * lands in a frame depends on how long the previous frame took to render.
 *
 * Three sites were confirmed, and the first is the film's central graphic:
 *
 *  · **`bloom.tsx:68,74`** — `transition: background 1.3s ease`, in the STATIC branch as well as
 *    the animated one. `<BloomDrift/>` writes a frame-derived `--bloom` every frame, and the
 *    component's own transition was chasing it. Sustained, across beats 8 and 11's ~39-frame
 *    drifts, on the bloom.
 *  · **`framing-overlay.tsx:32,82`** — `transition-colors duration-300` on the brackets and
 *    `transition-shadow duration-500` on the meadow glow, both guarded only by
 *    `motion-reduce:transition-none`. **This is the green-room checkmark flash.** The `<Check/>`
 *    glyph is a plain boolean mount and was never the problem; what popped was the glow it sits
 *    in, caught mid-transition at whatever wall-clock offset the capture happened to land on.
 *  · **`globals.css:320`** — Ren's blink, a 7s infinite CSS `animation` on two eye groups.
 *
 * **Every rule below is transcribed from `apps/web/app/globals.css`, not invented** — it is that
 * file's own `@media (prefers-reduced-motion: reduce)` blocks (`:209-216` and `:323-326`), stated
 * unconditionally. That is deliberate: the fix must be what the product does when a user asks for
 * less motion, or the film is rendering a state the product never ships. The `0.01ms` is the
 * product's number too, and so is the `animation-iteration-count: 1` — `globals.css:204-208`
 * explains why capping the count rather than the duration is load-bearing, and that reasoning
 * carries here unchanged.
 *
 * The two Ren rules are declared because they cannot be derived: both eye pairs sit in the DOM at
 * a base opacity of 1 and the blink is a crossfade *between* them, so a bare `animation: none`
 * leaves an open and a closed pair drawn on top of each other. `globals.css:324-325` states the
 * resting opacities for exactly this reason; they are quoted rather than re-reasoned.
 *
 * Mounted in `<Camera/>`, which every one of the thirteen beats renders — so this cannot be
 * forgotten by a new beat, which is the failure mode a per-beat mount would have.
 */
export const StillMotion: React.FC = () => (
  <style>{`
    /* globals.css:209-216, stated unconditionally. */
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
    /* globals.css:323-326. The resting face: open pair visible, closed pair hidden. */
    .ren-eyes-open   { animation: none !important; opacity: 1 !important; }
    .ren-eyes-closed { animation: none !important; opacity: 0 !important; }
  `}</style>
);

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
 * ── THE READING, AS ONE KEYFRAMED VALUE ─────────────────────────────────────────────
 *
 * The monitoring act's escalation and recovery, 0 (at ease) to 1 (fully tense). See `monitor.ts`
 * § ONE READING, READ TWICE for why it exists: the stateline's band and the trend's newest window
 * are both derived from this, so they cannot disagree at any frame.
 *
 * **A beat places its keyframes ON `LITTLE_AT` / `TENSE_AT`**, which is what makes the copy
 * changes land on the exact frames the sheet gives them while the value in between still moves
 * continuously — so the graph walks rather than stepping, and the two things step together.
 *
 * Linear between keys on purpose. The easing that matters is in the placement of the keys — a
 * curve applied on top would move the threshold crossings off the frames the beat pinned them to,
 * which is precisely the failure this replaces.
 */
export const useReading = (keys: { frame: number; level: number }[]): number => {
  const frame = useCurrentFrame();
  if (keys.length < 2) return keys[0].level;
  return interpolate(
    frame,
    keys.map((k) => k.frame),
    keys.map((k) => k.level),
    clamp,
  );
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
 * So the cycle is a parameter — and what beat 5d passes it is derived from a **phase count**,
 * not from the window.
 *
 * **ONE BREATH WAS NOT ENOUGH, AND THE REASON IS THAT THE POINT IS THE ALTERNATION.** Passing the
 * window's own length gave exactly one breath: two phases, 22.5 frames each. Two phases do not
 * read as a rhythm — they read as a label that changed once, too briefly to be read at all, which
 * loses the whole reason for showing the minute. The audience has to see it alternate: in, out,
 * in. Beat 5d passes `(window / 3) × 2` for **three phases at 15 frames each**, half a second
 * apiece. Four would be 375ms, which is the strobe this note warns about two paragraphs up; three
 * is the only count that satisfies both ends, and the third phase gets its full fifteen frames
 * before the cut. The shape, amplitude, easing and copy are all the component's; only the period
 * is staged, and the discs follow the same parameter so the rise and fall stay locked to the words.
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
 * ── THE GET-READY COUNTDOWN, WHICH WAS NOT COUNTING ─────────────────────────────────
 *
 * Source: `components/anchor/get-ready-countdown.tsx`.
 *
 * ⚠️ **"A FRAME-ADDRESSED RENDERER MEANS NO TIMER EVER FIRES" IS FALSE, AND BELIEVING IT WAS THE
 * BUG.** This comment used to assert it as a fact about the medium. **Remotion keeps ONE live
 * browser page and steps the frame on it**, so wall-clock time keeps passing between frames and
 * `setTimeout` fires exactly as it would anywhere else. The reduced-motion shim does not help
 * either: it changes which *variant* a component renders and stops no timers.
 *
 * `GetReadyCountdown` holds its number in `useState` and decrements it with a
 * `setTimeout(…, 1000)` that is **not** gated on reduced motion (`get-ready-countdown.tsx:29-33`).
 * So two clocks drove one numeral — the component's, ticking once a real second, and this hook's,
 * stepping every fifteen frames — and the numeral painted was the component's. Worse, `from` only
 * seeds `useState` on mount, so remounting per value with a `key` **re-seeded the internal count
 * back up** every time the frame clock stepped. On screen: `3 · 2 · 1 · 2 · 1 · 1`, with blanks
 * where the component had counted itself down to 0 and returned `null`. It was **non-deterministic**
 * — the same frame rendered different numerals depending on how fast the page had been driven.
 *
 * So the number is driven from the frame and the component's own numeral is **suppressed** rather
 * than out-run: `calibrate.tsx`'s `Countdown` hides it with a scoped `visibility: hidden` (not
 * `display`, so the grid keeps its layout) and draws the frame-derived digit over it, carrying
 * `get-ready-countdown.tsx:49`'s className character-for-character. Moving the `key` onto the
 * frame would have fixed rendered frames and left the second clock alive for any frame held longer
 * than a second. That is the same seam `<BreathPacer/>` and `chat.tsx` use, and it keeps the
 * numeral the component's own: its `font-display text-8xl leading-none tabular-nums text-white`
 * and its drop shadow, not a redraw.
 *
 * **The general rule, which is larger than 5c:** a value this film addresses by frame must have
 * exactly one source, and where a component supplies its own it has to be suppressed. "Timers do
 * not fire" is not available as an assumption anywhere in this project.
 *
 * **And it is given real time.** Three seconds of story in thirty frames is a third of a second
 * per number, which is below the threshold at which a digit reads as a beat rather than a flicker
 * — the sheet's compression was set when nothing in 5c was moving, so nothing was lost by it.
 * `COUNTDOWN_FRAMES` is 45, so each numeral holds **15 frames, half a second**. That is a 2×
 * compression of a real countdown rather than the 3× the beat was nominally claiming, and it is
 * the point at which a digit reads as having landed. Where the fifteen frames come from — 5d, not
 * the camera — is argued at the top of `Beat05Calibration.tsx`.
 *
 * The component's own entrance — `animate-in fade-in zoom-in-75 duration-300`, gated off by the
 * reduced-motion branch — is re-authored on the same 300ms, so each number arrives the way the
 * product's does instead of appearing whole.
 */
/** 15 frames a number. Long enough to read as a beat settling, still 2× real time. */
export const COUNTDOWN_FRAMES = 45;

export const useCountdown = (
  startFrame: number,
  totalFrames = COUNTDOWN_FRAMES,
): { value: number; enter: number } => {
  const frame = useCurrentFrame();
  const per = totalFrames / 3;
  const elapsed = Math.max(0, frame - startFrame);
  const value = Math.max(1, 3 - Math.floor(elapsed / per));
  // `get-ready-countdown.tsx:44` — `duration-300` on the zoom/fade, keyed per number.
  const sinceStep = elapsed - Math.floor(elapsed / per) * per;
  const enter = interpolate(sinceStep, [0, sec(0.3)], [0, 1], { ...clamp, easing: EASE_OUT });
  return { value, enter };
};

/**
 * ── THE COMPRESSED MINUTE, PACED SO IT READS AS TIME PASSING ────────────────────────
 *
 * Source: the beat's own 30× compression, plus `recording-timer.tsx`.
 *
 * 5d shows ~2 seconds of a 60-second capture, and the timer used to take that compression
 * **linearly** — `remaining = 60 · (1 − elapsed/60)`, one story-second per frame. Two problems,
 * and they compound:
 *
 *  · At thirty distinct values a second the digits are noise. Nothing is read; the readout is a
 *    flickering texture, which is worse than no readout because it looks like a fault.
 *  · A linear ramp between two still moments has no shape, so the minute reads as a **jump cut
 *    with a bar over it** rather than as time being sped through.
 *
 * Both are fixed by pacing rather than by slowing down, which the beat cannot afford:
 *
 *  · **The compression is eased in and out.** The minute starts at something close to real time,
 *    accelerates through the middle, and settles as it lands — the shape of every time-lapse ever
 *    cut, and the reason one reads as elapsed time rather than as a skip.
 *  · **The displayed numeral is held.** `HOLD_FRAMES` of 4 gives ~7 readouts a second, each on
 *    screen for 133ms, so the digits are legibly racing instead of strobing.
 *
 * The BAR is not quantised — it takes the eased value continuously, which is what a progress bar
 * does and is smoother than the product's own once-a-second `transition-[width]`. The bar and the
 * numeral can therefore disagree by up to four story-seconds mid-run, which is 6.7% of the bar's
 * width; at 133ms per readout that is not a comparison anybody can make, and the alternative —
 * stepping the bar too — turns a smooth fill into fifteen visible jumps.
 */
const HOLD_FRAMES = 4;

export const useCaptureMinute = (
  startFrame: number,
  windowFrames: number,
  totalSeconds = 60,
): { remaining: number; shown: number } => {
  const frame = useCurrentFrame();
  const eased = interpolate(frame, [startFrame, startFrame + windowFrames], [0, 1], {
    ...clamp,
    easing: EASE_IN_OUT,
  });
  const remaining = totalSeconds * (1 - eased);

  // The held numeral: sample the same eased curve at the last multiple of HOLD_FRAMES, so the
  // readout is always a value the bar genuinely passed through rather than a rounding of the
  // current one.
  const held = startFrame + Math.floor((frame - startFrame) / HOLD_FRAMES) * HOLD_FRAMES;
  const easedHeld = interpolate(held, [startFrame, startFrame + windowFrames], [0, 1], {
    ...clamp,
    easing: EASE_IN_OUT,
  });

  return { remaining, shown: Math.round(totalSeconds * (1 - easedHeld)) };
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

/**
 * ── THE SAME DEVICE, ON BEAT 5a'S PRIVACY LINE ──────────────────────────────────────
 *
 * "Your video isn't stored — only the calm reading it produces." (`intro.tsx:52`). It is the
 * single most important sentence in the film for a privacy-first product and it was reading as a
 * small grey line among four other small grey lines.
 *
 * It takes **the in-place emphasis, not the travelling lift** — the same grow-and-settle the
 * stateline uses, at the same 1.25×, on the same easing. That matters for two separate reasons:
 *
 *  · The lift (L10) is capped at two uses and both are spent (beat 1's address bar, beat 3's
 *    calibration banner). The in-place device is **a rule rather than a budget**, so this costs
 *    nothing against that cap — it is grammar the audience has already been taught by beats 7, 8
 *    and 11.
 *  · The lift needs camera travel and a settle; this needs neither, so it fits inside 5a's
 *    existing wide hold without moving a keyframe. **Beat 5a's framing is untouched.**
 *
 * ── MOTION ONLY. IT IS NOT RECOLOURED, AND THAT IS DELIBERATE ───────────────────────
 *
 * Everything else this film adapts is geometry — a lifted banner, a raised block, an enlarged
 * viewfinder. Recolouring a **privacy claim** would be a different kind of change: it would make
 * the sentence more prominent in the video than it is in the product, which is a claim about the
 * product rather than a staging of it. The `text-muted` grey and the meadow shield stay exactly
 * as `intro.tsx` sets them; only the size moves, and the movement carries the emphasis on its own.
 *
 * The mechanism is `monitor.tsx`'s `<Emphasis/>` one file over: a scoped stylesheet on the
 * element, `transform-origin: top center` so it grows downward and outward from where it already
 * is. The component is not touched and the intro is not re-laid-out — at 1.25× the raised line
 * finishes 27px clear of the "Turn on camera" block and 249px clear of the frame (`geometry.ts`
 * § INTRO_PRIVACY has the arithmetic).
 */
export const IntroPrivacyEmphasis: React.FC<{ t: number; factor?: number }> = ({
  t,
  factor = 1.25,
}) => {
  const k = 1 + (factor - 1) * t;
  if (t <= 0) return null;
  return (
    <style>{`
      [data-intro] > div > p {
        transform-origin: top center;
        scale: ${k};
      }
    `}</style>
  );
};
