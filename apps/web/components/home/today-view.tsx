"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TodayMiniTrend } from "@/components/home/today-mini-trend";
import { TodayTimeline } from "@/components/home/today-timeline";
import { TodayTrendPlot } from "@/components/home/today-trend-plot";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { TodayRecap, TodayTrendRow } from "@/lib/api/monitoring-reads";
import { toSeqs } from "@/lib/trend-geometry";

/**
 * Feature 009 — the today check-in card orchestrator.
 *
 * COLLAPSED (US1, glanceable): an honest three-level headline + a wide-short mini step-line +
 * a single in-place toggle. The headline keyword (`recap.headline.hot`) renders in
 * `--amber-head` at weight 700 on the CARD SURFACE — that is where #BC7A2A clears the 3:1
 * large-text bar (it would fail 2.95:1 on the page background, DC-007). `hot` is null on a calm
 * day; `deriveHeadline` only says "tense" when the tense band was actually reached (FR-002).
 *
 * EXPANDED (US2, in place): the fixed-px lane plot + left axis (no legend) and the
 * state-coloured timeline, revealed by a reduced-motion-gated height transition (the card grows
 * in place — no route change). The plot and the timeline read ONE source of geometry (`seqs`,
 * built from the same per-session tenor), so they can never disagree (SC-004). Synced highlight
 * between a lane and its row is User Story 3.
 */

export interface TodayViewProps {
  recap: TodayRecap;
  trendRows: TodayTrendRow[];
  expanded: boolean;
  onToggle: () => void;
  startHref?: string;
}

export function TodayView({
  recap,
  trendRows,
  expanded,
  onToggle,
  startHref = "/app/monitor",
}: TodayViewProps) {
  // One source of geometry for the mini-trend AND the expanded lane plot — built from the same
  // per-session tenor the timeline chip uses, so the surfaces can never disagree (SC-004).
  const seqs = toSeqs(
    recap.sessions.map((s) => ({ sessionId: s.sessionId, tenor: s.tenor })),
    trendRows.map((r) => ({ sessionId: r.sessionId, band: r.band, capturedAt: r.capturedAt })),
  );

  // The in-place expand grows the card height; honor the user's reduced-motion preference.
  // The same flag gates every highlight/fade transition in the children (US3/US4 / FR-015).
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // One active-session id for the bidirectional synced highlight (US3): a lane hover/focus and
  // a row hover both write here, and both the plot lane bg and the timeline row read it — so a
  // lane and its row can never highlight out of step.
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div className="flex flex-col">
      {/* eyebrow */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-xs font-semibold uppercase tracking-wide text-muted">
          Today&apos;s check-in
        </p>
        <p className="whitespace-nowrap text-[13px] text-muted">
          {recap.checkinCount} {recap.checkinCount === 1 ? "check-in" : "check-ins"}
          {recap.lastReadLabel ? ` · ${recap.lastReadLabel}` : ""}
        </p>
      </div>

      {/* honest headline — keyword in --amber-head (weight 700) on the card surface */}
      <p className="mt-1.5 font-display text-[1.375rem] font-semibold leading-snug tracking-tight text-ink">
        {recap.headline.pre}
        {recap.headline.hot && (
          <span data-testid="headline-hot" className="font-bold" style={{ color: "var(--amber-head)" }}>
            {recap.headline.hot}
          </span>
        )}
        {recap.headline.post}
      </p>

      {/* wide-short mini step-line */}
      <div data-testid="today-mini-trend" className="mt-3">
        <TodayMiniTrend seqs={seqs} />
      </div>

      {/* actions */}
      <div className="mt-4 flex flex-wrap items-center gap-3.5">
        <Button asChild variant="meadow">
          {/* Full-document nav so /app/monitor loads under its own camera Permissions-Policy. */}
          <a href={startHref}>Start check-in</a>
        </Button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls="today-full"
          className="inline-flex min-h-11 items-center rounded-control px-1 text-sm font-semibold text-foggy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {expanded ? "Hide today ▴" : "View today ▾"}
        </button>
      </div>

      {/* expanded detail — a reduced-motion-gated height transition (grid 0fr → 1fr grows the
          card in place, no measurement). Content stays mounted; it's collapsed + hidden when
          closed. Synced highlight (US3) will make the plot's lanes focusable. */}
      <div
        id="today-full"
        aria-hidden={!expanded}
        className={`grid ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} ${
          reduceMotion ? "" : "transition-[grid-template-rows] duration-300 ease-out"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-5 border-t border-border pt-5">
            <p className="text-xs text-muted">
              Each check-in&apos;s shape across today — height and colour show the level.
            </p>
            <TodayTrendPlot
              seqs={seqs}
              activeId={activeId}
              onActivate={setActiveId}
              reduceMotion={reduceMotion}
              interactive={expanded}
            />
            <div className="mt-4 border-t border-border" />
            <div className="mt-2">
              <TodayTimeline
                sessions={recap.sessions}
                activeId={activeId}
                onActivate={setActiveId}
                reduceMotion={reduceMotion}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
