"use client";

import { Button } from "@/components/ui/button";
import { TodayMiniTrend } from "@/components/home/today-mini-trend";
import type { TodayRecap, TodayTrendRow } from "@/lib/api/monitoring-reads";
import { toSeqs } from "@/lib/trend-geometry";

/**
 * Feature 009 / US1 — the today check-in card's COLLAPSED (glanceable) surface: an honest
 * three-level headline + a wide-short mini step-line + a single in-place toggle.
 *
 * The headline keyword (`recap.headline.hot`) is rendered in `--amber-head` at weight 700 on
 * the CARD SURFACE — that is where #BC7A2A clears the 3:1 large-text bar (it would fail 2.95:1
 * on the page background, DC-007). `hot` is null on a calm day (no amber keyword); the
 * data-layer `deriveHeadline` only says "tense" when the tense band was actually reached
 * (FR-002), and "a little tense" otherwise.
 *
 * The EXPANDED detail (fixed-px lane plot + left axis + timeline + synced highlight) is User
 * Story 2/3 — for now the expand reveals a placeholder that keeps the `today-plot` contract.
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
  // One source of geometry for the mini-trend (and, in US2, the lane plot) — built from the
  // same per-session tenor the timeline chip uses, so the surfaces can never disagree (SC-004).
  const seqs = toSeqs(
    recap.sessions.map((s) => ({ sessionId: s.sessionId, tenor: s.tenor })),
    trendRows.map((r) => ({ sessionId: r.sessionId, band: r.band, capturedAt: r.capturedAt })),
  );

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

      {/* expanded detail — US2 builds the fixed-px lane plot + axis + timeline here */}
      {expanded && (
        <div id="today-full" className="mt-5 border-t border-border pt-5">
          <div data-testid="today-plot" className="text-sm text-muted">
            The detailed day view is coming next.
          </div>
        </div>
      )}
    </div>
  );
}
