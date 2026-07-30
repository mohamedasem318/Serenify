import React from "react";
import { continueRender, delayRender, useCurrentFrame } from "remotion";

import { Header } from "@/components/header/header";
import type { Band } from "@/components/monitor/use-monitoring-session";
import { OpSurfaces } from "@/components/monitor/op-surfaces";
import { SessionTrend } from "@/components/monitor/session-trend";
import { Viewfinder } from "@/components/monitor/viewfinder";
import type { SessionTrendPoint } from "@/lib/api/monitoring-reads";

import { CharacterRig } from "../greybox/rig";
import type { Pose } from "../greybox/rig";
import { EMPHASIS_FACTOR, RAW, SCROLL, VF_SCALE, VIEWFINDER } from "./geometry";
import { useBloomColor } from "./motion";
import { AppShell, MONITOR_COL, MONITOR_STAGE, VIEWPORT_Y } from "./shell";

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
 */
const Emphasis: React.FC<{ t: number }> = ({ t }) => {
  const k = 1 + (EMPHASIS_FACTOR - 1) * t;
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

/** Drives `--bloom` per frame, overriding the component's inline value. See the header. */
const BloomDrift: React.FC<{ tension: number }> = ({ tension }) => {
  const color = useBloomColor(tension);
  return <style>{`[data-bloom] [data-testid="bloom"] { --bloom: ${color} !important; }`}</style>;
};

export const MonitorPage: React.FC<{
  clock: string;
  /** Which band's copy + stateline tone the real component shows. Changes discretely. */
  band: Band;
  /** 0 → meadow, 0.5 → the mid-gold, 1 → amber. Drifts continuously, independent of `band`. */
  tension: number;
  /** 0 seated, 1 raised. Fires on every stateline copy change (L12). */
  emphasis?: number;
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
      header={<Header fullName="Mohamed Asem" email="mohamed@serenify.tech" role="employee" />}
      overlay={overlay}
    >
      <BloomDrift tension={tension} />
      <Emphasis t={emphasis} />
      <TrendSettle />

      {/* The page scrolls under the sticky header. The real page is ~973px tall below the
          chrome against a 583px viewport, so it scrolls in the product too — this is the
          page's behaviour, not a video device. */}
      <div style={{ marginTop: -scroll }}>
        <div className={MONITOR_COL}>
          {/* `monitoring-session.tsx:784-799` — the readout is a ROW ABOVE the card, not a
              corner overlay. The greybox drew it floating at the card's right. */}
          <div className="mb-3 flex items-center gap-3 px-1">
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

          <div style={{ position: "relative" }}>
            <div data-bloom data-emph className={MONITOR_STAGE}>
              <OpSurfaces
                state={{ op: "active", band, skipCause: null }}
                onAllow={() => {}}
                onRetryBlocked={() => {}}
              />
            </div>

            {/*
             * ── THE VIEWFINDER IS A SIBLING OF THE CARD, NOT A CHILD, AND IT HAS TO BE ──
             *
             * In the app it is `absolute right-4 top-4 z-10` INSIDE the stage
             * (`monitoring-session.tsx:805`) — an overlay that happens to be parented there. The
             * stage also carries `overflow-hidden`, which is invisible at the app's own size
             * because the viewfinder fits, and fatal at L1's: the first render of this pass had
             * the enlarged viewfinder sliced clean off at the card's right edge.
             *
             * So it is parented one level out and placed at its MEASURED position. The component
             * is untouched and its appearance is identical — only its containing block differs,
             * which is a video-side decision about clipping, not a change to the product.
             *
             * ── AND IT GROWS FROM ITS TOP-LEFT ──
             *
             * L1 enlarges it from 224×126.9 to 320×181.3. Growing from the top-RIGHT (its anchor
             * in the app) pushes its left edge to 647, and the bloom's gradient is fully opaque
             * out to x 669 — so it would cover the bloom's solid core, and beat 7's entire job is
             * to plant bloom, stateline and viewfinder together. Growing from the top-LEFT keeps
             * its left edge at the real 743, one pixel clear of the bloom's box, and spends the
             * growth on the empty page to the card's right instead.
             */}
            {/*
             * `<Viewfinder/>` is ITSELF `absolute right-0 top-12` (`viewfinder.tsx:49`), so it
             * positions against whatever box it lands in. Dropped into a zero-width anchor — the
             * shape the app's own `absolute right-4 top-4` pill wrapper has — `right-0` pins its
             * RIGHT edge and L1's scale grows it leftward, straight over the bloom. That is what
             * the first attempt did, and it is worth stating because the failure looks like a
             * position bug rather than a growth-direction one.
             *
             * So it gets a real box of the component's own unscaled size plus its own `top-12`
             * offset, scaled about the box's TOP-LEFT. The component's offsets resolve inside a
             * box it can measure, and the growth goes right and down — onto the empty page beside
             * the card, never onto the bloom.
             */}
            <div
              style={{
                position: "absolute",
                // Offsets are relative to THE STAGE, which is what the `position: relative`
                // wrapper starts at — not the timer row above it. Measuring from the row put the
                // viewfinder 56px low, and the symptom was the beat-8 frame clipping its bottom
                // edge rather than anything that looked like a position bug.
                left: RAW.viewfinder.x - RAW.stage.x,
                top: RAW.viewfinder.y - 48 * VF_SCALE - RAW.stage.y,
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

      {children}
    </AppShell>
  );
};

export { VIEWPORT_Y };
