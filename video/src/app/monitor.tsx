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
import {
  PROMPT,
  RAW,
  SCROLL,
  STATELINE_CONTROLS_GAP,
  SUB_MIN_HEIGHT,
  VF_SCALE,
  VIEWFINDER,
  emphasisCapFor,
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
 * stateline at `text-3xl`/`text-base`, the real Pause / End controls and the real FR-024
 * footnote), `<Viewfinder/>`, `<SessionTrend/>`. What the video supplies: the page scroll, the
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
 * ── THE IN-PLACE EMPHASIS, APPLIED FROM OUTSIDE THE COMPONENT ───────────────────────
 *
 * The stateline is two sibling `<p>`s inside `LiveStage`'s flex column
 * (`op-surfaces.tsx:299-306`), and their only common ancestor also holds the bloom and the
 * controls — so there is no single node to scale.
 *
 * Instead each paragraph is scaled about `top center` and translated by `(k − 1) × dy`, where
 * `dy` is its offset from the block's top. That is exactly equivalent to scaling the pair as
 * one block about the block's top edge, which is what L12 requires: **it grows downward from
 * its own top, so the bloom above it is untouchable by construction** — the constraint the
 * greybox met by moving the product's layout, and which register items 2 and 3 exist to undo.
 *
 * A transform does not affect layout, so the controls and the footnote below do not move. They
 * do not need to: at 1.25× the block finishes 11.1px clear of the controls (see `geometry.ts`).
 *
 * **`factor` is passed in rather than read from `EMPHASIS_FACTOR`, because it is not constant.**
 * L12's 1.25× was derived against a ONE-LINE sub; the `tense` copy wraps to two and does not fit
 * at any scroll (`emphasisCapFor()` in `geometry.ts` has the arithmetic). The beat interpolates
 * between the two caps so the collapse is a settle rather than a snap, and that settle is what
 * makes the second copy change carry movement — see `Beat08Email.tsx`.
 */
/**
 * ── THE TWO LAYOUT VALUES L14 SPENDS, AS A SCOPED STYLESHEET ────────────────────────
 *
 * The film cannot put a class on a shipped component's paragraph, and it must not fork one. So
 * the two arrangement changes L14 needs are declared here, by selector, against the same DOM the
 * measurement harness already addresses (`SwapProbe.tsx`) — the same mechanism `motion.tsx` uses
 * four times over and `hover.tsx` uses for every control in the film.
 *
 *  1. **The sub reserves two lines.** `min-height: 51` — two of its own 25.5px lines. Without it
 *     the stateline block, the controls, the footnote and every framing derived from them change
 *     size on the frame the copy changes, which is how the two-line `tense` sub came to be
 *     sliced by the viewport at rest in the one reading the film exists to deliver.
 *  2. **The stateline→controls gap goes 28 → 70.** This is the room L12's 1.25× grows into. With
 *     it the raised two-line block finishes **46.75px** clear of the Pause/End controls; without
 *     it the cap is 1.01× and the device is dead.
 *
 * Neither touches a colour, a size, a weight or a word. `geometry.ts` § SUB_MIN_HEIGHT holds the
 * numbers, because every framing above is derived from them and they must not drift apart.
 */
export const StageLayout: React.FC = () => (
  <style>{`
    [data-emph] p[aria-live="polite"] + p { min-height: ${SUB_MIN_HEIGHT}px; }
    [data-emph] div.mt-7 { margin-top: ${STATELINE_CONTROLS_GAP}px; }
  `}</style>
);

const Emphasis: React.FC<{ t: number; factor: number }> = ({ t, factor }) => {
  const k = 1 + (factor - 1) * t;
  const dySub = RAW.statelineSub.y - RAW.statelineHead.y; // 42px, measured
  return (
    <style>{`
      [data-emph] p[aria-live="polite"] {
        transform-origin: top center;
        scale: ${k};
      }
      [data-emph] p[aria-live="polite"] + p {
        transform-origin: top center;
        scale: ${k};
        translate: 0 ${(k - 1) * dySub}px;
      }
    `}</style>
  );
};

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
  /** 0 seated, 1 raised. Fires on every stateline copy change (L12). */
  emphasis?: number;
  /**
   * The factor a full raise reaches. Defaults to the one-line cap, which is L12's 1.25×. A beat
   * whose copy changes line count interpolates it (see `emphasisCapFor` in `geometry.ts`) so the
   * device never slices a line.
   */
  emphasisFactor?: number;
  /** Page scroll. `SCROLL.monitor` for beats 7–9; beat 11 travels to `SCROLL.trend`. */
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
  emphasis = 0,
  emphasisFactor = emphasisCapFor(1),
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
      <Emphasis t={emphasis} factor={emphasisFactor} />
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
              className="absolute inset-x-10 top-5 z-10 flex items-center gap-3"
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
          </div>

          <SessionTrend
            sessionId="video"
            active={false}
            load={async () => trendPoints({ climb, descend })}
            // Bumped every frame so the trend re-reads its (frame-derived) points. Without it
            // the component fetches once on mount and freezes: it looks correct in a STILL —
            // each still is a fresh page — and is static for the whole cut in a video render,
            // which is exactly the kind of defect that survives to the finished file.
            refreshSignal={frame}
            now={() => Date.UTC(2026, 6, 30, 10, 47, 0)}
          />
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
