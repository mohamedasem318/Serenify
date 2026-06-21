"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Band } from "@/lib/api/monitoring-client";
import type {
  ChipTone,
  RecapSession,
  SessionTenor,
  TodayRecap,
  TodayTrendRow,
} from "@/lib/api/monitoring-reads";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/**
 * Feature 008 / US4 — T048. The dashboard check-in card's **today** surface: the collapsed
 * recap (templated headline + mini-trend) and the in-place expanded today view (auto-fit
 * local-time plot, numbered session badges as HTML overlays, a peak marker, a per-session
 * timeline, and cross-highlight on hover + keyboard focus). Built to the v5 mock
 * (serenify-008-us4-inline-mock-v5.html) in the real Graphite design system.
 *
 * Principle V — calm recedes, the tense moment catches the eye: amber is reserved for the
 * stress bands; at-ease is meadow; read-less is muted ("no clear read", NEVER calm —
 * SC-011). The mini-trend and the expanded plot read the SAME `trendRows` (SC-008), and a
 * skipped/absent window is a GAP, never carried-forward (FR-029). No probability is ever
 * shown (FR-015); the digits that DO appear are clock times (FR-030), not a stress number.
 *
 * `expanded`/`onToggle` are lifted to the parent card; the toggle is keyboard-operable with
 * `aria-expanded`, and the expand animation + cross-highlight respect `prefers-reduced-motion`
 * via the repo `useMediaQuery`.
 */

const Y: Record<Band, number> = { at_ease: 32, a_little_tense: 20, tense: 8 };
const PROMINENCE: Record<SessionTenor, number> = {
  tense: 0,
  a_little_tense: 1,
  at_ease: 2,
  no_read: 3,
};

const msOf = (iso: string) => new Date(iso).getTime();
const clamp = (x: number) => Math.max(4, Math.min(96, x));

function clockLabel(ms: number, withMinutes: boolean): string {
  return new Date(ms)
    .toLocaleTimeString([], withMinutes ? { hour: "numeric", minute: "2-digit" } : { hour: "numeric" })
    .toLowerCase();
}

/** Token role for a chip/badge by tone (matches op-surfaces conventions). */
function chipClass(tone: ChipTone): string {
  if (tone === "meadow") return "text-meadow-text bg-meadow/10 border-transparent";
  if (tone === "amber") return "text-amber bg-amber/15 border-transparent";
  return "text-muted bg-transparent border-border";
}
function badgeClass(tenor: SessionTenor): string {
  if (tenor === "at_ease") return "border-meadow text-meadow-text";
  if (tenor === "a_little_tense" || tenor === "tense") return "border-amber text-amber";
  return "border-border text-muted";
}

interface Series {
  session: RecapSession;
  badgeX: number;
  runs: { x: number; y: number }[][];
  drawableCount: number;
}

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
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [hl, setHl] = useState<string | null>(null);

  const span = recap.daySpan;
  const xFor = (ms: number) => {
    if (!span) return 50;
    const d = span.endMs - span.startMs;
    return d <= 0 ? 50 : clamp(4 + ((ms - span.startMs) / d) * 92);
  };

  const rowsBySession = new Map<string, TodayTrendRow[]>();
  for (const r of trendRows) {
    const list = rowsBySession.get(r.sessionId) ?? [];
    list.push(r);
    rowsBySession.set(r.sessionId, list);
  }
  for (const list of rowsBySession.values()) list.sort((a, b) => msOf(a.capturedAt) - msOf(b.capturedAt));

  // One geometry per session, used by BOTH the mini-trend and the expanded plot (SC-008).
  const series: Series[] = recap.sessions.map((session) => {
    const rs = rowsBySession.get(session.sessionId) ?? [];
    const firstMs = rs[0] ? msOf(rs[0].capturedAt) : msOf(session.startedAt);
    const runs: { x: number; y: number }[][] = [];
    let cur: { x: number; y: number }[] = [];
    for (const r of rs) {
      if (r.band != null) cur.push({ x: xFor(msOf(r.capturedAt)), y: Y[r.band] });
      else if (cur.length) {
        runs.push(cur);
        cur = [];
      }
    }
    if (cur.length) runs.push(cur);
    return {
      session,
      badgeX: xFor(firstMs),
      runs,
      drawableCount: runs.reduce((a, r) => a + r.length, 0),
    };
  });

  const trendSessionCount = series.filter((s) => s.drawableCount > 0).length;

  // Peak marker — the tensest reading, positioned on the auto-fit axis.
  let peak: { x: number; y: number } | null = null;
  if (recap.peakSessionId && recap.peakAtMs != null) {
    const row = trendRows.find(
      (r) => r.sessionId === recap.peakSessionId && msOf(r.capturedAt) === recap.peakAtMs && r.band != null,
    );
    if (row && row.band) peak = { x: xFor(recap.peakAtMs), y: Y[row.band] };
  }

  // Axis ticks — auto-fit the day's first→last reading, local zone (FR-030).
  const ticks: { x: number; label: string }[] = span
    ? span.endMs === span.startMs
      ? [{ x: 50, label: clockLabel(span.startMs, true) }]
      : [0, 1, 2, 3].map((i) => ({
          x: 4 + (i / 3) * 92,
          label: clockLabel(span.startMs + (i / 3) * (span.endMs - span.startMs), false),
        }))
    : [];

  // Timeline order: the tensest session leads (un-dimmed), the rest recede (Principle V).
  const timeline = [...recap.sessions].sort(
    (a, b) => PROMINENCE[a.tenor] - PROMINENCE[b.tenor] || msOf(a.startedAt) - msOf(b.startedAt),
  );

  const onEnter = (id: string) => () => setHl(id);
  const onLeave = () => setHl(null);

  const renderRuns = (s: Series, prefix: string) =>
    s.runs.map((run, ri) =>
      run.length >= 2 ? (
        <path
          key={ri}
          data-testid={`${prefix}-seg-${s.session.sessionId}`}
          data-session={s.session.sessionId}
          d={`M ${run.map((q) => `${q.x},${q.y}`).join(" L ")}`}
          fill="none"
          stroke="var(--color-meadow)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className={cn(!reducedMotion && "transition-[stroke-width]")}
          style={hl === s.session.sessionId ? { strokeWidth: 4 } : undefined}
        />
      ) : (
        <circle
          key={ri}
          data-testid={`${prefix}-dot-${s.session.sessionId}`}
          data-session={s.session.sessionId}
          cx={run[0]!.x}
          cy={run[0]!.y}
          r={2.8}
          fill="var(--color-meadow)"
          vectorEffect="non-scaling-stroke"
        />
      ),
    );

  return (
    <div className="flex flex-col">
      {/* ── collapsed recap ───────────────────────────────────────────────────────── */}
      <div className={cn("flex flex-col gap-7 sm:flex-row sm:items-center", expanded && "sm:items-start")}>
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            Today&apos;s check-in
          </p>
          <p className="font-display text-[1.4rem] font-semibold leading-snug tracking-tight text-ink">
            {recap.headline.pre}
            {recap.headline.hot && (
              <span data-testid="headline-hot" className="text-amber">
                {recap.headline.hot}
              </span>
            )}
            {recap.headline.post}
          </p>
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
              className="rounded-control px-1 py-1.5 text-sm font-semibold text-foggy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {expanded ? "Hide today ▴" : "View today ▾"}
            </button>
          </div>
        </div>

        {/* mini-trend (kept mounted when expanded so the two surfaces share one source) */}
        <div
          data-testid="today-mini-trend"
          data-sessions={trendSessionCount}
          className={cn("w-full sm:w-[300px] sm:flex-none", expanded && "hidden")}
        >
          <div className="mb-1.5 flex justify-between text-xs text-muted">
            <span>
              {recap.checkinCount} {recap.checkinCount === 1 ? "check-in" : "check-ins"}
            </span>
            {recap.lastReadLabel && <span>{recap.lastReadLabel}</span>}
          </div>
          <svg
            className="block h-12 w-full"
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            role="img"
            aria-label="Today mini-trend: each check-in's band over the day; gaps are windows without a clear read."
          >
            {series.map((s) => (
              <g key={s.session.sessionId}>{renderRuns(s, "mini")}</g>
            ))}
          </svg>
        </div>
      </div>

      {/* ── in-place expanded today view (FR-028) ─────────────────────────────────── */}
      <div
        id="today-full"
        aria-hidden={!expanded}
        className="grid"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          transition: reducedMotion ? undefined : "grid-template-rows 320ms ease",
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-5 border-t border-border pt-5">
            {/* plot: SVG line + HTML badge overlays + peak marker */}
            <div data-testid="today-plot" data-sessions={trendSessionCount} className="relative h-[150px]">
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 100 40"
                preserveAspectRatio="none"
                role="img"
                aria-label="Today's trend across check-ins; higher means tenser, gaps are windows without a clear read."
              >
                <line
                  x1="4"
                  y1="32"
                  x2="96"
                  y2="32"
                  stroke="var(--color-border)"
                  vectorEffect="non-scaling-stroke"
                />
                {series.map((s) => (
                  <g key={s.session.sessionId}>{renderRuns(s, "plot")}</g>
                ))}
                {peak && (
                  <circle
                    data-testid="plot-peak"
                    cx={peak.x}
                    cy={peak.y}
                    r={3.2}
                    fill="var(--color-amber)"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>

              {series.map((s) => (
                <div
                  key={s.session.sessionId}
                  data-testid={`plot-badge-${s.session.sessionId}`}
                  data-session={s.session.sessionId}
                  data-hl={hl === s.session.sessionId ? "true" : "false"}
                  tabIndex={0}
                  onMouseEnter={onEnter(s.session.sessionId)}
                  onMouseLeave={onLeave}
                  onFocus={onEnter(s.session.sessionId)}
                  onBlur={onLeave}
                  aria-label={`${s.session.timeIdentity}, ${s.session.chipLabel}`}
                  className={cn(
                    "absolute top-0.5 grid size-6 -translate-x-1/2 place-items-center rounded-full border bg-surface font-display text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    badgeClass(s.session.tenor),
                    !reducedMotion && "transition-shadow",
                    hl === s.session.sessionId && "ring-2 ring-current ring-offset-1 ring-offset-surface",
                  )}
                  style={{ left: `${s.badgeX}%` }}
                >
                  {s.session.number}
                </div>
              ))}

              {peak && recap.peakAtMs != null && (
                <span
                  className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-amber"
                  style={{ left: `${peak.x}%`, top: "8%" }}
                >
                  tensest · around {clockLabel(recap.peakAtMs, false)}
                </span>
              )}
            </div>

            <div className="relative mt-0.5 h-5 border-t border-border">
              {ticks.map((t, i) => (
                <span
                  key={i}
                  className="absolute top-1 -translate-x-1/2 text-[11px] text-muted"
                  style={{ left: `${t.x}%` }}
                >
                  {t.label}
                </span>
              ))}
            </div>

            {/* per-session timeline (prominence order) */}
            <div className="mt-5 flex flex-col gap-1.5">
              {timeline.map((s, i) => (
                <div
                  key={s.sessionId}
                  data-testid={`tl-row-${s.sessionId}`}
                  data-session={s.sessionId}
                  data-hl={hl === s.sessionId ? "true" : "false"}
                  tabIndex={0}
                  onMouseEnter={onEnter(s.sessionId)}
                  onMouseLeave={onLeave}
                  onFocus={onEnter(s.sessionId)}
                  onBlur={onLeave}
                  className={cn(
                    "-mx-2 flex items-center gap-3 rounded-[10px] px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !reducedMotion && "transition-colors",
                    i > 0 && "opacity-80",
                    hl === s.sessionId && "bg-ink/5",
                  )}
                >
                  <div
                    className={cn(
                      "grid size-6 flex-none place-items-center rounded-full border font-display text-xs font-semibold",
                      badgeClass(s.tenor),
                    )}
                  >
                    {s.number}
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold text-ink">{s.timeIdentity}</span>
                    <span
                      data-testid="tl-chip"
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                        chipClass(s.chipTone),
                      )}
                    >
                      {s.chipLabel}
                    </span>
                    <span className="text-[13px] text-muted">{s.timeRange}</span>
                    <span className="text-[13px] text-muted">{s.phrase}</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-5 text-xs text-muted opacity-80">Processed just for you, then deleted.</p>
            <div className="mt-4">
              <button
                type="button"
                onClick={onToggle}
                className="rounded-control px-1 py-1.5 text-sm font-semibold text-foggy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Collapse
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
