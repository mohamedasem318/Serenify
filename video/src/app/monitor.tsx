import React from "react";
import { continueRender, delayRender, useCurrentFrame } from "remotion";

import { Header } from "@/components/header/header";
import type { Band } from "@/components/monitor/use-monitoring-session";
import { OpSurfaces } from "@/components/monitor/op-surfaces";
import { SessionTrend } from "@/components/monitor/session-trend";
import { Viewfinder } from "@/components/monitor/viewfinder";
import type { SessionTrendPoint } from "@/lib/api/monitoring-reads";

import type { Shot } from "../greybox/Camera";
import { CharacterRig } from "../greybox/rig";
import type { Pose } from "../greybox/rig";
import { PROTAGONIST } from "../greybox/copy";
import { projectWorld } from "./framing";
import { MEASURE_SCALE_ATTR } from "./measure-patch";
import {
  BLOOM_SIZE,
  CARD_PB,
  CARD_PT,
  PROMPT,
  RAW,
  SCROLL,
  SUB_MIN_HEIGHT,
  TREND,
  TREND_GAP,
  TREND_NATURAL_W,
  TREND_SCALE,
  VF_SCALE,
  VIEWFINDER,
} from "./geometry";
import { useBloomBreath, useBloomColor } from "./motion";
import { AppShell, MONITOR_COL, MONITOR_STAGE, VIEWPORT_Y, WORLD } from "./shell";

/**
 * ══ THE MONITORING PAGE, AS THE REAL COMPONENTS ═════════════════════════════════════
 *
 * Beats 7, 8, 9 and 11 are one continuous screen in story terms, so this is one component —
 * the bloom, the stateline, the trend and the viewfinder must be in exactly the same place
 * across all four or the fall in beat 8 and the recovery in beat 11 stop reading as the same
 * screen changing.
 *
 * What is real here: `<Header/>`, `<OpSurfaces/>` (which renders the real `<Bloom/>`, the real
 * stateline at `text-3xl`/`text-base`; its Pause / End controls and its FR-024 footnote are the
 * two things the film removes — see `<StageLayout/>`), `<Viewfinder/>` and `<SessionTrend/>`.
 * What the video supplies: the page scroll, the
 * character inside the viewfinder, and time.
 *
 * `<MonitoringSession/>` itself — the orchestrator — is deliberately NOT used. It owns
 * `getUserMedia`, a `MediaRecorder`, a face detector, Supabase auth and four network paths,
 * none of which can exist in a render and none of which is visual. Its **layout** is
 * reproduced from `monitoring-session.tsx:781-860` (class strings quoted in `shell.tsx`), and
 * every part of it with visual substance is the real component underneath.
 *
 * ── HOW THE BLOOM DRIFTS WITHOUT A CSS TRANSITION ───────────────────────────────────
 *
 * The real drift is `transition: background 1.3s ease` (`bloom.tsx:68,74`), and a CSS
 * transition cannot run in a frame-addressed render. `<Bloom/>` takes a `color` override, but
 * `OpSurfaces` renders it internally and does not forward one — so the drift is driven by a
 * scoped stylesheet that sets `--bloom` with `!important`, which beats the component's own
 * inline custom property.
 *
 * That is not a reimplementation: `--bloom` is the single variable every stop of both gradient
 * layers is derived from (`bloom.tsx:36-40`), so overriding it reproduces the whole drift —
 * core, halo and all — with no second copy of the gradient in the video.
 */

export type MonitorBand = Band;

/** A trend that walks up into tense and, when `descend` is set, walks back down again. */
export const trendPoints = (opts: {
  /** 0 → flat meadow, 1 → fully climbed into tense. */
  climb: number;
  /** 0 → held, 1 → the tail has walked all the way back to at-ease (beat 11). */
  descend: number;
}): SessionTrendPoint[] => {
  const N = 22;
  const out: SessionTrendPoint[] = [];
  for (let i = 0; i < N; i++) {
    const p = i / (N - 1);
    // A rising edge that reaches `climb`, then a falling tail governed by `descend`.
    const up = Math.max(0, Math.min(1, (p - 0.35) / 0.45)) * opts.climb;
    const down = Math.max(0, Math.min(1, (p - 0.72) / 0.28)) * opts.descend;
    const v = Math.max(0, up - down);
    const band: Band = v > 0.66 ? "tense" : v > 0.28 ? "a_little_tense" : "at_ease";
    out.push({
      id: `w${i}`,
      // Fixed epoch — `Date.now()` is unavailable in a Remotion script and a moving clock
      // would make the trend non-reproducible between renders.
      capturedAt: new Date(Date.UTC(2026, 6, 30, 10, 43, 0) + i * 10_000).toISOString(),
      scored: true,
      band,
      skipCause: null,
    });
  }
  return out;
};

/**
 * ══ THE ARRANGEMENT L15 SPENDS, AS A SCOPED STYLESHEET ══════════════════════════════
 *
 * The film cannot put a class on a shipped component's paragraph, and it must not fork one. So
 * every arrangement change is declared here, by selector, against the same DOM the measurement
 * harness addresses (`SwapProbe.tsx`) — the same mechanism `motion.tsx` uses four times over and
 * `hover.tsx` uses for every control in the film. `geometry.ts` holds the numbers, because every
 * framing above is derived from them and they must not drift apart.
 *
 * **L14's problem was that the four things the monitoring act is about could not be in one
 * frame.** Bloom top to trend bottom was 985.9px against a 519px viewport, so the trend was a
 * separate landing 855px down the page and reaching it was a scroll. Six values fix it, and
 * four of the six are geometry:
 *
 *  1. **The orb comes down 288 → 176 → 96.** `sm:size-72` is the product's, and it is the single
 *     largest block of vertical page in the act. Its halo is `-inset-[28%]`, so the glow still
 *     spans 150px. L16 takes the second step, to buy the trend a home inside this card.
 *  2. **The card's top band goes 64 → 48 and its bottom pad 40 → 24.** The band exists to hold
 *     the `Session · MM:SS` row (L14 moved it there); at `top-1` the row's 44px box fits 48
 *     exactly, so nothing is crowded.
 *  3. **`min-height` is released.** `sm:min-h-[480px]` would hold the card at its old height and
 *     centre the shortened contents inside it, which would give back none of the page.
 *  4. **The sub still reserves two lines.** `min-height: 51` — two of its own 25.5px lines.
 *     Without it the stateline block, the trend and every framing derived from them change size
 *     on the frame the copy changes.
 *  5. **The Pause / End controls are REMOVED — a CONTENT liberty, not a geometric one (L15).**
 *  6. **FR-024's footnote is REMOVED — the same, and it is L16.** "Processed just for you —
 *     analyzed, then deleted." Everything else in this block resizes or repositions something
 *     the product ships; these two delete real content from a real surface, and the distinction
 *     is recorded rather than blurred, because a reader who finds it later must be able to tell a
 *     staging decision from a fidelity defect. The footnote's 18.2px plus its gap is part of what
 *     the trend now occupies, and the film states the same idea far more loudly twice: the camera
 *     consent gate is a whole beat, and beat 5a's privacy line takes the in-place emphasis.
 *
 * The stateline→controls gap L14 spent 70px on is gone with the controls, and so is the
 * emphasis it was buying room for: see `geometry.ts` § THE EMPHASIS LEAVES THE STATELINE.
 */
export const StageLayout: React.FC = () => (
  <style>{`
    [data-emph] {
      min-height: 0 !important;
      padding-top: ${CARD_PT}px !important;
      padding-bottom: ${CARD_PB}px !important;
    }
    [data-emph] [data-testid="bloom"] { width: ${BLOOM_SIZE}px; height: ${BLOOM_SIZE}px; }
    [data-emph] p[aria-live="polite"] + p { min-height: ${SUB_MIN_HEIGHT}px; }
    [data-emph] div.mt-7 { display: none; }
    [data-emph] p.mt-8 { display: none; }
    /* The trend section ships its own \`mt-5\` (session-trend.tsx:313) for the page flow it
       normally sits in, under the stage card. Inside the card its wrapper supplies the gap
       (\`TREND_GAP\`), so the component's margin would be 20 layout px of double-spacing pushing
       the card 9.6 screen px out through the bottom of its reserved box — which is exactly the
       5px sliver the recon still showed between the two card edges. Zeroed, the trend card's
       bottom sits \`CARD_PB\` above the stage card's, matching the air above it. */
    [data-emph] [data-testid="session-trend"] { margin-top: 0 !important; }
  `}</style>
);

/**
 * ── HOLDING THE FRAME UNTIL THE TREND HAS SETTLED ───────────────────────────────────
 *
 * `<SessionTrend/>` reaches its render through two asynchronous settles: an injected `load`
 * that resolves a promise into `setPoints`, and a `ResizeObserver` that measures its own width
 * (it renders nothing at all until `width > 0` — `session-trend.tsx:330`). Neither has landed
 * on the first paint of a frame.
 *
 * Remotion's own mechanism for "this frame is not ready yet" is `delayRender`, so that is what
 * this uses — held across two animation frames, which is one for the promise's microtask and
 * the setState it commits, and one for the observer's measure and ITS setState. Without it the
 * screenshot can catch the empty state, and it would do so intermittently, which is the worst
 * possible failure: a render that is mostly right.
 *
 * Re-acquired every frame (the effect depends on `frame`) because beat 11 animates `descend`,
 * so the trend's data genuinely changes frame to frame and each change is a fresh async round.
 */
const TrendSettle: React.FC = () => {
  const frame = useCurrentFrame();
  React.useEffect(() => {
    const handle = delayRender(`trend-settle f${frame}`);
    let raf = 0;
    let tries = 0;
    // Waits for the SVG ITSELF rather than for a fixed number of ticks. The settle is a chain,
    // not a single await: the injected `load` resolves → `setPoints` → the non-empty branch
    // renders → only THEN does the measured container mount → its callback ref measures →
    // `setWidth` → and `session-trend.tsx:330` gates the `<svg>` on `width > 0`. A two-frame
    // wait cleared the first two links and screenshotted a card with a heading, a subtitle and
    // no plot — which looks like a design decision rather than a race.
    const wait = () => {
      const ready = document.querySelector('[data-testid="session-trend-svg"]');
      // Up to ~40 ticks: the measured probe needed close to 30 on a cold mount. The cost is
      // paid ONCE — on every later frame the SVG is already there and the first check exits.
      if (ready || tries++ > 40) {
        continueRender(handle);
        return;
      }
      raf = requestAnimationFrame(wait);
    };
    raf = requestAnimationFrame(wait);
    return () => {
      cancelAnimationFrame(raf);
      continueRender(handle);
    };
  }, [frame]);
  return null;
};

/**
 * Drives `--bloom` per frame, overriding the component's inline value (see the header) — and
 * puts the **breath** back, which nothing was doing.
 *
 * The bloom's two framer loops cannot run in a frame-addressed render, so under the forced
 * reduced-motion shim `<Bloom/>` renders its halo and core static (`bloom.tsx:87-91`). That is
 * the right base, but the loop was never re-authored over it, so the film's central graphic held
 * perfectly still through beats 7–11 while the sheet describes it as *pulsing*. The two layers
 * are the wrapper's two child `span`s in a fixed order (`bloom.tsx:65-76`), so each gets its own
 * declared amplitude rather than a shared approximation on the wrapper.
 */
const BloomDrift: React.FC<{ tension: number }> = ({ tension }) => {
  const color = useBloomColor(tension);
  const breath = useBloomBreath();
  return (
    <style>{`
      [data-bloom] [data-testid="bloom"] { --bloom: ${color} !important; }
      [data-bloom] [data-testid="bloom"] > span:first-child {
        scale: ${breath.halo.scale};
        opacity: ${breath.halo.opacity};
      }
      [data-bloom] [data-testid="bloom"] > span:last-child { scale: ${breath.core}; }
    `}</style>
  );
};

export const MonitorPage: React.FC<{
  clock: string;
  /** Which band's copy + stateline tone the real component shows. Changes discretely. */
  band: Band;
  /** 0 → meadow, 0.5 → the mid-gold, 1 → amber. Drifts continuously, independent of `band`. */
  tension: number;
  /**
   * Page scroll. **It is 0 for every monitoring beat now** — at L15's arrangement the whole act
   * fits inside the page's own 519px viewport, which is what removes the travel down to the
   * trend. Kept as a prop because the page is still a page and a future beat may need it.
   */
  scroll?: number;
  pose: Pose;
  working?: boolean;
  headphones?: boolean;
  nod?: boolean;
  notesFrom?: number;
  climb?: number;
  descend?: number;
  /** Seconds elapsed when the beat starts; the readout ticks on from there. */
  sessionFrom?: number;
  /** World-coordinate layer — the mail toast lives here, not in the page. */
  overlay?: React.ReactNode;
  children?: React.ReactNode;
}> = ({
  clock,
  band,
  tension,
  scroll = SCROLL.monitor,
  pose,
  working,
  headphones,
  nod,
  notesFrom,
  climb = 0,
  descend = 0,
  sessionFrom = 47 * 60 + 12,
  overlay,
  children,
}) => {
  const frame = useCurrentFrame();
  const seconds = sessionFrom + frame / 30;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(Math.floor(seconds % 60)).padStart(2, "0");

  return (
    <AppShell
      clock={clock}
      url="serenify.tech/app/monitor"
      header={
        <Header fullName={PROTAGONIST.fullName} email={PROTAGONIST.email} role="employee" />
      }
      overlay={overlay}
    >
      <BloomDrift tension={tension} />
      <StageLayout />
      <TrendSettle />

      {/* The page scrolls under the sticky header. The real page is ~1100px tall below the
          chrome against a 583px viewport, so it scrolls in the product too — this is the
          page's behaviour, not a video device. Beats 7–9 hold ONE offset; only beat 11 moves. */}
      <div style={{ marginTop: -scroll }}>
        <div className={MONITOR_COL}>
          <div data-bloom data-emph className={MONITOR_STAGE}>
            {/*
             * ── THE READOUT MOVES INTO THE CARD'S OWN `pt-16` BAND (L14) ──
             *
             * `monitoring-session.tsx:784-799` puts this row ABOVE the card. That row is the
             * single thing that used to pin the page scroll: it sits at raw y 188–232 under a
             * sticky header ending at 156, so any scroll past ~41 hid the `Session · MM:SS`
             * readout that beat 7 lists as required content — while the two-line `tense` sub
             * needed a scroll of at least 39 to clear the viewport bottom. A 2.5px window, and
             * inside it the emphasis had no room at all.
             *
             * The card's `pt-16` is 64px of empty space directly above the bloom, and the row is
             * 44 tall. So the row moves into it — absolutely positioned, so the card's own
             * `justify-center` layout is untouched and the bloom does not move a pixel. Nothing
             * is restyled: the same two spans, the same classes, the same words.
             *
             * **`top-5`, not `top-3`, and that was found on a render rather than derived.** The
             * composite's frame top lands at raw y 210, and at `top-3` the row's text cleared it
             * by 3px — not sliced, but the kind of clearance that becomes a slice the next time
             * anything moves. At `top-5` the row occupies raw 209–253, its text clears the frame
             * by 11px, and its box finishes exactly on the bloom's top edge (253) — which costs
             * nothing, since the row has no background and its text ends 12px above it.
             */}
            <div
              data-probe="timerrow"
              className="absolute inset-x-10 top-1 z-10 flex items-center gap-3"
            >
              <span className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm text-muted">
                <span aria-hidden>←</span> Dashboard
              </span>
              <span className="ml-auto text-sm tabular-nums text-muted">
                Session ·{" "}
                <b data-testid="session-timer" className="font-semibold text-ink">
                  {mm}:{ss}
                </b>
              </span>
            </div>

            <OpSurfaces
              state={{ op: "active", band, skipCause: null }}
              onAllow={() => {}}
              onRetryBlocked={() => {}}
            />

            {/*
             * ══ THE TREND, UNDER THE READING IT IS THE HISTORY OF (L16) ══════════════
             *
             * It was the next card down the scrolling column (pre-L15), then the second occupant
             * of the pinned right column (L15). Both were arrangements the geometry forced rather
             * than arrangements anybody wanted: in the column it shared a y with the confirmatory
             * prompt, so beat 9 covered a graph with a notification, and the right column changed
             * occupants three times across four beats.
             *
             * Here it is simply the last thing in the reading card — the session's history
             * directly beneath the session's stateline, which is where it belongs and is what the
             * product's own page does with it, only closer. What it costs is the orb (176 → 96)
             * and FR-024's footnote; see `<StageLayout/>` above, where both are declared.
             *
             * ── DRAWN WIDE, THEN SCALED ──────────────────────────────────────────────
             *
             * The card's height is very nearly independent of its width
             * (`session-trend-geometry.ts:53` fixes the plot's viewBox at `H = 210`), so a card
             * rendered directly at 368 would still be ~350 tall and nothing would fit. Rendered
             * at `TREND_NATURAL_W` and scaled, the same card arrives at 368 × 170.4 with every
             * pixel of its shape intact.
             *
             * `data-measure-scale` is what makes the plot the width of the card it is in. The
             * component measures its own container with `getBoundingClientRect`, which returns
             * SCREEN pixels — so the scale on this wrapper was landing in the measurement exactly
             * as the camera's zoom used to, and the plot was drawing at 42% of its box. The
             * attribute declares the factor and `measure-patch.ts` divides it out; see its § AND
             * THE CAMERA WAS NOT THE ONLY SCALE IN THE CHAIN.
             *
             * A transform does not affect layout, so the outer box reserves the SCALED size and
             * the card's own bottom padding sits under it.
             */}
            <div
              style={{
                width: TREND.w,
                height: TREND.h,
                marginTop: TREND_GAP,
                flexShrink: 0,
              }}
            >
              <div
                {...{ [MEASURE_SCALE_ATTR]: TREND_SCALE }}
                style={{ width: TREND_NATURAL_W, transformOrigin: "top left", scale: TREND_SCALE }}
              >
                <SessionTrend
                  sessionId="video"
                  active={false}
                  load={async () => trendPoints({ climb, descend })}
                  // Bumped every frame so the trend re-reads its (frame-derived) points. Without
                  // it the component fetches once on mount and freezes: it looks correct in a
                  // STILL — each still is a fresh page — and is static for the whole cut in a
                  // video render, which is exactly the kind of defect that survives to the
                  // finished file.
                  refreshSignal={frame}
                  now={() => Date.UTC(2026, 6, 30, 10, 47, 0)}
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/*
       * ══ THE PINNED RIGHT COLUMN — THE VIEWFINDER (L14) ═══════════════════════════
       *
       * In the app the viewfinder is `absolute right-4 top-4 z-10` INSIDE the stage
       * (`monitoring-session.tsx:805`) — an overlay that happens to be parented there. The stage
       * also carries `overflow-hidden`, which is invisible at the app's own size because the
       * viewfinder fits, and fatal at L1's: an early render of this pass had the enlarged
       * viewfinder sliced clean off at the card's right edge.
       *
       * **It is now a sibling of the SCROLL CONTAINER, not of the card**, and that is the fix for
       * the defect this pass was opened on. Laid out inside the scrolling column its top landed
       * at 269 at `SCROLL.monitor` = 40, against the mail toast's bottom at 291 — a **22px
       * overlap**, which is the "the notification covers the viewfinder in beats 8 and 9"
       * complaint. The old 18px gap had been computed against the UNSCROLLED position, so the
       * arithmetic was right about a page nobody was rendering. Neither element scrolls now.
       *
       * ── AND ITS TOP EDGE IS THE ORB'S TOP EDGE (L16) ──
       *
       * `VIEWFINDER.y` is `RAW.bloom.y` — 237 — so the two columns begin on one line. Purely
       * visual: the orb and the face are the composition's two pictures and they now share a
       * horizontal. The toast moves down with it and keeps `PINNED_GAP` above the panel; see
       * `geometry.ts` § TOAST for why the stage card's top edge was the wrong line to take, and
       * what beat 8 would have paid for it.
       *
       * ── AND IT GROWS FROM ITS TOP-LEFT ──
       *
       * `<Viewfinder/>` is ITSELF `absolute right-0 top-12` (`viewfinder.tsx:49`), so it
       * positions against whatever box it lands in. Dropped into a zero-width anchor — the shape
       * the app's own `absolute right-4 top-4` pill wrapper has — `right-0` pins its RIGHT edge
       * and L1's scale grows it leftward. So it gets a real box of the component's own unscaled
       * size plus its own `top-12` offset, scaled about the box's TOP-LEFT; the component's
       * offsets resolve inside a box it can measure, and `VIEWFINDER` is where the visible panel
       * lands. The `- 48 · VF_SCALE` is that `top-12`, scaled.
       *
       * The offsets are relative to `Desktop`'s viewport div (the nearest positioned ancestor),
       * which starts at `VIEWPORT_Y` — so world y minus 92. A pointer or a panel placed without
       * that subtraction lands 92px low, which is the bug the mail toast had before `overlay`
       * existed.
       */}
      <div
        style={{
          position: "absolute",
          left: VIEWFINDER.x,
          top: VIEWFINDER.y - 48 * VF_SCALE - VIEWPORT_Y,
          width: RAW.viewfinder.w,
          height: RAW.viewfinder.h + 48,
          zIndex: 10,
          transformOrigin: "top left",
          scale: VF_SCALE,
        }}
      >
        <Viewfinder pinned>
          {/* The rig sizes itself off the box's ASPECT, never its pixels, so it re-fits
              whatever inner box the real component turns out to have — which is the case
              it was built for. Unscaled dims; the wrapper carries L1. */}
          <CharacterRig
            x={0}
            y={0}
            w={RAW.viewfinder.w}
            h={RAW.viewfinder.h}
            pose={pose}
            working={working}
            headphones={headphones}
            nod={nod}
            notesFrom={notesFrom}
          />
        </Viewfinder>
      </div>

      {children}
    </AppShell>
  );
};

/**
 * ══ BRINGING THE PORTALLED PROMPT INTO THE WORLD (L14) ══════════════════════════════
 *
 * `<ConfirmatoryPrompt/>` wraps `<Notification/>`, which is a Radix dialog: it renders through
 * `DialogPrimitive.Portal` into `document.body` and is `fixed right-4 w-80 bottom-[calc(…)]`
 * (`notification.tsx:186`). Three consequences, and all three had to be answered:
 *
 *  · **The portal escapes any wrapper.** Beat 9 used to wrap the prompt in a translated div and
 *    the div moved nothing — the node is not inside it. `Notification` forwards no `container`
 *    prop, so there is no supported way to portal it somewhere else, and forking the component
 *    is not available (the film renders the product, not a copy of it).
 *  · **`fixed` resolves against the 1920×1080 OUTPUT frame**, not the world, so the prompt sat
 *    bottom-right of the frame regardless of where the camera was looking. The camera could not
 *    push in on the one surface beat 9 exists to show, and the cursor had to be drawn in screen
 *    space to reach it. That is the beat's known framing complaint.
 *  · Being a body child, it is **outside `Desktop`'s `overflow: hidden`** — which is the one
 *    thing the portal is good for here, and is why the panel may hang 20px past the world's
 *    bottom edge onto the camera backdrop.
 *
 * So the node is projected rather than moved: a scoped stylesheet re-states `left` / `top` /
 * `transform` as **the camera's own transform applied to `PROMPT.panel`'s world coordinates**.
 * `right`/`bottom` are neutralised so the component's own `right-4 bottom-[…]` stop competing;
 * everything else about it — `w-80`, `p-6`, `rounded-card`, `bg-surface`, every word — is the
 * product's. `!important` is required because framer-motion writes `transform` and `opacity`
 * into `element.style` on every frame and an inline declaration outranks a plain rule.
 *
 * The result is a prompt that behaves as if it had been laid out in the world: it enters, moves
 * and magnifies with the camera, and `PROMPT.yes` is a world rect the pointer can travel to.
 *
 * ══ AND THE FOCUS RING IS SUPPRESSED — A FIDELITY CORRECTION, NOT A LIBERTY ═════════
 *
 * A meadow ring arrived on "Yes, that's me" the moment the prompt opened and was still there
 * under the cursor's click. **It is `:focus-visible`, and `:focus-visible` cannot fire on a mouse
 * click in a real browser** — `confirmatory-prompt.tsx:27` is
 * `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow …`, which is a
 * keyboard-navigation affordance and nothing else. Two things conspire to draw it here anyway:
 * Radix's `<Dialog.Content>` moves focus to its first focusable child on open, and Chromium's
 * focus-visible heuristic treats programmatic focus as keyboard-ish when no pointer input has
 * ever happened — and in a render, none ever has. So the film was drawing a state **the product
 * never shows to a mouse user**, on the one beat whose entire subject is *he was asked and he
 * answered*.
 *
 * Removing it therefore makes the film MORE faithful rather than less, and it is recorded as a
 * correction rather than in the liberties table. What remains on the control is what a real click
 * genuinely produces: the cursor, its press dip and click ring (`pointer.tsx`), and the option's
 * own shipped `hover:bg-[…]` easing over `transition-colors` (`hover.tsx` § promptOption).
 *
 * It is scoped to the prompt on purpose. Beat 2's signup ring is drawn deliberately by
 * `auth.tsx`, which applies the component's own focus-visible declaration by selector because a
 * render cannot provoke one — the opposite problem, at a site where a ring is genuinely what the
 * product shows.
 */
export const WorldPrompt: React.FC<{
  /** The camera's shot THIS frame — `useShotAt(keys)` in `framing.ts`. */
  shot: Shot;
  /** The entrance: `x` in WORLD px (the component's own 24px slide), `opacity` 0→1. */
  enter: { x: number; opacity: number };
  children: React.ReactNode;
}> = ({ shot, enter, children }) => {
  const p = projectWorld(shot, PROMPT.panel.x + enter.x, PROMPT.panel.y);
  return (
    <>
      <style>{`
        [data-testid="notification"] {
          right: auto !important;
          bottom: auto !important;
          left: ${p.left.toFixed(3)}px !important;
          top: ${p.top.toFixed(3)}px !important;
          transform-origin: 0 0 !important;
          transform: scale(${p.zoom.toFixed(6)}) !important;
          opacity: ${enter.opacity.toFixed(4)} !important;
        }
        /* See § AND THE FOCUS RING IS SUPPRESSED. Tailwind's ring is a box-shadow, so both it
           and the outline have to go. Plain :focus is left alone — the component styles only
           :focus-visible. */
        [data-testid="notification"] button:focus-visible {
          box-shadow: none !important;
          outline: none !important;
        }
      `}</style>
      {children}
    </>
  );
};

/**
 * ── A SECOND CAMERA, FOR THE ONE LAYER THAT CANNOT LIVE INSIDE THE FIRST ────────────
 *
 * The portalled prompt is a child of `document.body` with `z-index: 50`, and `<Camera>`'s inner
 * div carries a transform — which makes it a stacking context. **Anything rendered inside
 * `<Camera>` is therefore trapped below the prompt**, cursor included, and a cursor that
 * disappears behind the button it is pressing is worse than no cursor at all.
 *
 * So beat 9's pointer is drawn in a sibling layer that carries the SAME transform the camera
 * does, at a z-index above the prompt's. Its children are authored in ordinary world
 * coordinates and are magnified by the camera exactly as they would be inside it — which is what
 * `pointer.tsx` requires ("the film is a screen recording of a 1200px screen blown up, and a
 * magnified recording magnifies its cursor").
 */
export const WorldOverlay: React.FC<{
  shot: Shot;
  zIndex?: number;
  children: React.ReactNode;
}> = ({ shot, zIndex = 95, children }) => {
  const zoom = 1920 / shot.w;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: WORLD.w,
        height: WORLD.h,
        transformOrigin: "0 0",
        translate: `${960 - zoom * shot.cx}px ${540 - zoom * shot.cy}px`,
        scale: zoom,
        zIndex,
      }}
    >
      {children}
    </div>
  );
};

export { VIEWPORT_Y };
