"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import {
  BAND_LINE,
  BAND_Y,
  FOCUS_RING,
  HIGHLIGHT_FILL,
  STROKE,
  buildLanePlot,
  type Lane,
  type SessionSeq,
  type Tenor,
} from "@/lib/trend-geometry";

/**
 * Feature 009 / US2 — the expanded today card's lane plot + left axis.
 *
 * THE LOAD-BEARING RULE (DC-001 / SC-002 — the totem fix): this renders at FIXED PIXEL SCALE.
 * The geometry sets the SVG `width` AND a matching `viewBox` width to `nLanes × laneWidth`
 * (1 unit = 1 px). There is NO `preserveAspectRatio="none"` stretch of a small viewBox — that
 * stretch was the prior build's totem bug. A few sessions FILL the width; many CLAMP to
 * LANE_MIN and overflow (the strip scrolls — styled scrollbar + edge fades are US4).
 *
 * Height AND colour encode the band (axis on the left, never a bottom legend). Confident runs
 * are solid step lines; warm-up and lost-read stretches are FADED (never a solid bridge at a
 * fixed level, FR-007); a fully read-less session is a hollow marker on its own low lane; a
 * single confident reading is a filled dot. Each lane's peak == its `tenor` (the chip value),
 * so the plot and the timeline can never disagree (SC-004).
 *
 * Visual source of truth: serenify-008followups-trend-FINAL.html.
 *
 * SMOKE-AUTHOR CARRY-FORWARD (T026): the no-stretch rule is asserted here only at the SVG
 * attribute level (jsdom has no layout). A browser could still visually stretch via CSS, which
 * a unit test can't catch — so smoke-tests.md MUST include a human check that at 360px the plot
 * renders at its intrinsic width and SCROLLS (never stretches/crushes) with an edge-fade.
 */

const AXIS_W = 96;
// ~max-w-6xl (1152) − 2×24px card padding − 96px axis ≈ 1008; used until the wrapper is measured.
const DEFAULT_AVAIL = 1008;
const LANE_BG_Y = 14;
const LANE_BG_H = 172;

const AXIS_LABELS: { key: Tenor; text: string; className: string }[] = [
  { key: "tense", text: "tense", className: "text-amber-text" },
  { key: "a_little_tense", text: "a little tense", className: "text-amber-text opacity-90" },
  { key: "at_ease", text: "at ease", className: "text-meadow-text" },
  { key: "no_read", text: "no read", className: "text-muted" },
];

/** Spoken tenor for the per-session keyboard target's aria-label (FR-011). */
const TENOR_PHRASE: Record<Tenor, string> = {
  tense: "tense",
  a_little_tense: "a little tense",
  at_ease: "at ease",
  no_read: "no clear read",
};

const bandAtY = (y: number): Tenor =>
  y === BAND_Y.tense
    ? "tense"
    : y === BAND_Y.a_little_tense
      ? "a_little_tense"
      : y === BAND_Y.at_ease
        ? "at_ease"
        : "no_read";

const near = (a: number, b: number) => Math.abs(a - b) < 0.5;

/** Map one lane's geometry to SVG marks — solid runs, rounded step risers, faded fades. */
function laneMarks(lane: Lane, laneWidth: number): ReactNode[] {
  const els: ReactNode[] = [];

  // a fully read-less session → a hollow muted marker on its OWN low lane, never the calm line
  if (lane.noRead) {
    els.push(
      <circle
        key="noread"
        data-testid="noread-marker"
        cx={lane.x0 + laneWidth / 2}
        cy={BAND_Y.no_read}
        r={4}
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth={1.2}
      />,
    );
    return els;
  }

  // a single confident reading → a filled dot in its band colour (≠ the hollow no-read ring)
  if (lane.singleDot && lane.dot) {
    els.push(
      <circle
        key="dot"
        data-testid="dot"
        cx={lane.dot.x}
        cy={lane.dot.y}
        r={4}
        fill={BAND_LINE[bandAtY(lane.dot.y)]}
      />,
    );
    return els;
  }

  // warm-up (leading absent reads) — a faded eased lead-in at the first band's level
  if (lane.warmup) {
    els.push(
      <line
        key="warmup"
        data-testid="warmup"
        x1={lane.warmup.x1}
        y1={lane.warmup.y}
        x2={lane.warmup.x2}
        y2={lane.warmup.y}
        stroke={BAND_LINE[bandAtY(lane.warmup.y)]}
        strokeWidth={STROKE}
        strokeOpacity={0.4}
        strokeLinecap="round"
      />,
    );
  }

  // solid confident runs + a rounded right-angle step into the next run (FR-002 corners),
  // unless a lost-read stretch separates them (then the faded span below carries the gap).
  lane.runs.forEach((run, i) => {
    els.push(
      <line
        key={`run-${i}`}
        data-testid="run"
        data-band={run.band}
        x1={run.x1}
        y1={run.y}
        x2={run.x2}
        y2={run.y}
        stroke={BAND_LINE[run.band]}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />,
    );
    const next = lane.runs[i + 1];
    if (next) {
      const bridgedByFade = lane.lostReads.some((f) => near(f.x1, run.x2) && near(f.x2, next.x1));
      if (!bridgedByFade) {
        els.push(
          <polyline
            key={`step-${i}`}
            data-testid="step"
            points={`${run.x2},${run.y} ${next.x1},${run.y} ${next.x1},${next.y}`}
            fill="none"
            stroke={BAND_LINE[next.band]}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />,
        );
      }
    }
  });

  // lost reads (interior / trailing absent stretches) — faded at the last-known level, then a
  // faded riser into the next confident run (never a solid bridge across the gap).
  lane.lostReads.forEach((f, i) => {
    els.push(
      <line
        key={`lost-${i}`}
        data-testid="lostread"
        x1={f.x1}
        y1={f.y}
        x2={f.x2}
        y2={f.y}
        stroke={BAND_LINE[bandAtY(f.y)]}
        strokeWidth={STROKE}
        strokeOpacity={0.4}
        strokeLinecap="round"
      />,
    );
    const after = lane.runs.find((r) => near(r.x1, f.x2));
    if (after && after.y !== f.y) {
      els.push(
        <line
          key={`lost-riser-${i}`}
          data-testid="lostread-riser"
          x1={f.x2}
          y1={f.y}
          x2={f.x2}
          y2={after.y}
          stroke={BAND_LINE[after.band]}
          strokeWidth={STROKE}
          strokeOpacity={0.4}
          strokeLinecap="round"
        />,
      );
    }
  });

  return els;
}

export interface TodayTrendPlotProps {
  /** One source of geometry — same per-session tenor the timeline chip uses (SC-004). */
  seqs: SessionSeq[];
  /** Explicit lane-area width (px). Tests pass this; the live app measures the wrapper. */
  availableWidth?: number;
  /** The synced-highlight active session id (US3) — lifted to TodayView, shared with the timeline. */
  activeId?: string | null;
  /** Set/clear the active session on hover + focus (US3). */
  onActivate?: (id: string | null) => void;
  /** Drop transition classes when the user prefers reduced motion (FR-015 / SC-005). */
  reduceMotion?: boolean;
  /** Whether the per-session targets are in the tab order — false while the card is collapsed. */
  interactive?: boolean;
}

export function TodayTrendPlot({
  seqs,
  availableWidth,
  activeId = null,
  onActivate,
  reduceMotion = false,
  interactive = true,
}: TodayTrendPlotProps) {
  const [measured, setMeasured] = useState<number | null>(null);
  // Focus ring shows on keyboard focus only (US3); the lane/row wash shows on hover OR focus.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // Whether the strip has been scrolled away from the start — drives the LEFT edge-fade (US4).
  const [scrolled, setScrolled] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Measure the scroll wrapper so lanes fill a wide screen and clamp on a narrow one. The ref
  // callback seeds it on mount (lint-safe vs setState-in-effect); a ResizeObserver tracks resize.
  const attachWrap = useCallback(
    (el: HTMLDivElement | null) => {
      wrapRef.current = el;
      if (el && availableWidth == null) {
        const w = el.clientWidth;
        setMeasured((prev) => (prev === w ? prev : w));
      }
    },
    [availableWidth],
  );

  useEffect(() => {
    if (availableWidth != null) return;
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setMeasured((prev) => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [availableWidth]);

  // Measure-then-render gate (T031): the live app only knows the true lane width AFTER the wrapper
  // is measured. Until then `avail` falls back to DEFAULT_AVAIL and the fixed-px SVG would paint
  // wide (overflowing a phone) for the first paint(s) before measurement snaps it — so we render
  // the SVG only once the width is known (an explicit `availableWidth` from tests counts as known)
  // and hold the slot with a height-reserving placeholder meanwhile.
  const ready = availableWidth != null || measured != null;
  const avail = availableWidth ?? measured ?? DEFAULT_AVAIL;
  const { width: W, height: H, laneWidth, lanes } = buildLanePlot(seqs, avail);
  const bandKeys: Tenor[] = ["tense", "a_little_tense", "at_ease", "no_read"];

  // Overflow is a property of the GEOMETRY, not a DOM read: the lanes hold LANE_MIN, so once the
  // fixed-px width exceeds the lane area the strip MUST scroll (DC-001 — never crush). Deriving it
  // here keeps it correct at the same instant the SVG renders (no measure-after-paint lag) and
  // unit-testable in jsdom. The right fade signals more-to-the-right; the left fade appears once
  // the user has scrolled off the start.
  const overflowing = W > avail;
  const fadeTransition = reduceMotion ? "" : " transition-opacity duration-150";

  return (
    <div data-testid="today-plot" className="mt-4 flex">
      {/* fixed left axis — the four level labels (NO bottom legend) */}
      <div className="relative flex-none" style={{ width: AXIS_W, height: H }} aria-hidden="true">
        {AXIS_LABELS.map((l) => (
          <span
            key={l.key}
            data-testid="axis-label"
            className={`absolute right-2.5 -translate-y-1/2 whitespace-nowrap text-[11px] leading-none ${l.className}`}
            style={{ top: BAND_Y[l.key] }}
          >
            {l.text}
          </span>
        ))}
      </div>

      {/* scrollable lane strip — fixed-px; component-local styled scrollbar + edge fades (US4).
          The wrapper ALWAYS mounts so `attachWrap` can measure it; only its CONTENTS wait (T031). */}
      <div ref={attachWrap} className="relative min-w-0 flex-1">
        {ready ? (
          <>
        {/* The LOAD-BEARING `overflow-x: auto` lives in a Tailwind utility (not only the
            component-local `.today-plot-scroll` rule): if that rule is ever absent/stale, the
            fixed-px SVG must STILL scroll within the strip rather than spill the page. The
            `today-plot-scroll` class then only carries the styled-scrollbar cosmetics. */}
        <div
          data-testid="plot-scroll"
          className="today-plot-scroll overflow-x-auto overflow-y-hidden"
          onScroll={(e) => {
            const next = e.currentTarget.scrollLeft > 4;
            setScrolled((prev) => (prev === next ? prev : next));
          }}
        >
          <svg
            data-testid="plot-svg"
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="block"
            role="img"
            aria-label={`${seqs.length} ${seqs.length === 1 ? "session" : "sessions"} as step shapes by stress level`}
          >
            {/* lane highlight surfaces — full plot height, carry NO band meaning. Toggled by the
                synced highlight (US3): a faint neutral wash when the lane (or its row) is active. */}
            {lanes.map((lane) => {
              const active = activeId === lane.sessionId;
              return (
                <rect
                  key={`bg-${lane.sessionId}`}
                  data-lane-bg=""
                  data-session-id={lane.sessionId}
                  data-active={active ? "true" : "false"}
                  className={reduceMotion ? undefined : "transition-[fill] duration-150"}
                  x={lane.x0 + 2}
                  y={LANE_BG_Y}
                  width={laneWidth - 4}
                  height={LANE_BG_H}
                  rx={9}
                  fill={active ? HIGHLIGHT_FILL : "transparent"}
                />
              );
            })}
            {/* faint band gridlines */}
            {bandKeys.map((k) => (
              <line
                key={`grid-${k}`}
                x1={6}
                y1={BAND_Y[k]}
                x2={W - 6}
                y2={BAND_Y[k]}
                stroke="var(--color-border)"
                strokeWidth={0.5}
              />
            ))}
            {/* session ordinal numbers */}
            {lanes.map((lane) => (
              <text
                key={`num-${lane.sessionId}`}
                x={lane.x0 + laneWidth / 2}
                y={10}
                fontSize={10}
                fill="var(--color-muted)"
                textAnchor="middle"
              >
                {lane.index + 1}
              </text>
            ))}
            {/* the step shapes */}
            {lanes.map((lane) => (
              <g key={`lane-${lane.sessionId}`}>{laneMarks(lane, laneWidth)}</g>
            ))}
            {/* focus rings — visible only on keyboard focus of the matching lane target (US3) */}
            {lanes.map((lane) => {
              const visible = focusedId === lane.sessionId;
              return (
                <rect
                  key={`ring-${lane.sessionId}`}
                  data-lane-focusring=""
                  data-session-id={lane.sessionId}
                  data-visible={visible ? "true" : "false"}
                  className={reduceMotion ? undefined : "transition-opacity duration-150"}
                  x={lane.x0 + 2}
                  y={LANE_BG_Y}
                  width={laneWidth - 4}
                  height={LANE_BG_H}
                  rx={9}
                  fill="none"
                  stroke={FOCUS_RING}
                  strokeWidth={1.5}
                  opacity={visible ? 1 : 0}
                  pointerEvents="none"
                />
              );
            })}
            {/* per-session keyboard + pointer targets, on top so they catch the events. A lane is
                a button-roled hit (FR-011): hover OR focus sets the shared active id (lane bg +
                row wash), focus additionally raises the ring. Rows are NOT tab stops. */}
            {lanes.map((lane) => (
              <rect
                key={`hit-${lane.sessionId}`}
                data-lane-hit=""
                data-session-id={lane.sessionId}
                role="button"
                tabIndex={interactive ? 0 : -1}
                aria-label={`Session ${lane.index + 1}, ${TENOR_PHRASE[lane.tenor]}`}
                x={lane.x0}
                y={LANE_BG_Y}
                width={laneWidth}
                height={LANE_BG_H}
                fill="transparent"
                className="cursor-pointer outline-none"
                onMouseEnter={() => onActivate?.(lane.sessionId)}
                onMouseLeave={() => onActivate?.(null)}
                onFocus={() => {
                  onActivate?.(lane.sessionId);
                  setFocusedId(lane.sessionId);
                }}
                onBlur={() => {
                  onActivate?.(null);
                  setFocusedId(null);
                }}
              />
            ))}
          </svg>
        </div>
        {/* edge-fade affordances — purely decorative, never intercept pointer/scroll. Left appears
            once scrolled off the start; right appears whenever there's more strip to the right.
            The LOAD-BEARING `absolute` (overlay, zero layout cost) + edge offset + width live in
            Tailwind utilities, NOT only in the component-local `.today-plot-fade` rule. If that
            rule is ever absent/stale, each fade must STILL be an out-of-flow overlay — otherwise
            two 200px in-flow blocks stack below the strip and balloon the plot region (the
            dead-space bug). `.today-plot-fade*` then only carries the gradient + the is-on opacity. */}
        <div
          data-testid="plot-fade-left"
          aria-hidden="true"
          className={`today-plot-fade today-plot-fade--left pointer-events-none absolute left-0 top-0 w-9${
            overflowing && scrolled ? " is-on" : ""
          }${fadeTransition}`}
          style={{ height: H }}
        />
        <div
          data-testid="plot-fade-right"
          aria-hidden="true"
          className={`today-plot-fade today-plot-fade--right pointer-events-none absolute right-0 top-0 w-9${overflowing ? " is-on" : ""}${fadeTransition}`}
          style={{ height: H }}
        />
          </>
        ) : (
          // height-reserving placeholder (T031): reserves exactly H (= PLOT_H) so swapping in the
          // measured SVG causes NO vertical layout shift; deliberately static — no spinner/shimmer
          // (calm per Graphite), just a held slot.
          <div data-testid="plot-placeholder" aria-hidden="true" style={{ height: H }} />
        )}
      </div>
    </div>
  );
}
