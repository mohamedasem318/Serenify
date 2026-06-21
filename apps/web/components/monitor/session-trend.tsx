"use client";

import { useEffect, useRef, useState } from "react";

import { getSessionTrend, type SessionTrendPoint } from "@/lib/api/monitoring-reads";

/**
 * The monitor-page **this-session** live trend (feature 008, US4 — T047). The mock's
 * "This session" card (serenify-008-monitoring-mock.html): band → height, a meadow line,
 * the three-band legend. Reads through the shared `getSessionTrend` RLS reader (FR-018:
 * where this session also appears in the dashboard today trend, the two agree because
 * both read the SAME persisted rows). It carries NO number (FR-015).
 *
 * Honesty rules (FR-029): a skipped/warming window (no confident band) is a GAP — the
 * line breaks across it, never carried-forward or fabricated. A session with a single
 * confident reading renders as a single dot, not a line.
 *
 * `load` + `active` + `pollMs` are injectable so the rules are unit-testable without a
 * Supabase round-trip and without real timers.
 */

const Y: Record<NonNullable<SessionTrendPoint["band"]>, number> = {
  at_ease: 32,
  a_little_tense: 20,
  tense: 8,
};
const RANK: Record<NonNullable<SessionTrendPoint["band"]>, number> = {
  at_ease: 0,
  a_little_tense: 1,
  tense: 2,
};

export interface SessionTrendProps {
  sessionId: string;
  /** Keep polling while the session is live (default true). */
  active?: boolean;
  /** Injectable reader (defaults to the shared RLS reader). */
  load?: (sessionId: string) => Promise<SessionTrendPoint[]>;
  /** Poll cadence in ms (default ≈ one stride). */
  pollMs?: number;
}

export function SessionTrend({
  sessionId,
  active = true,
  load = getSessionTrend,
  pollMs = 12_000,
}: SessionTrendProps) {
  const [points, setPoints] = useState<SessionTrendPoint[]>([]);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const next = await loadRef.current(sessionId);
        if (alive) setPoints(next);
      } catch {
        /* a transient read failure just leaves the last trend in place */
      }
    };
    void tick();
    if (!active) return () => void (alive = false);
    const id = setInterval(tick, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [sessionId, active, pollMs]);

  const n = points.length;
  const xAt = (i: number) => (n <= 1 ? 50 : 4 + (i / (n - 1)) * 92);

  // Runs of CONSECUTIVE confident-band points; a gap (skip/warming) ends a run.
  const runs: { x: number; y: number }[][] = [];
  let cur: { x: number; y: number }[] = [];
  points.forEach((p, i) => {
    if (p.band != null) {
      cur.push({ x: xAt(i), y: Y[p.band] });
    } else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  });
  if (cur.length) runs.push(cur);

  const drawableCount = runs.reduce((sum, r) => sum + r.length, 0);

  // Peak (tensest) point — an amber marker, only when stress was actually reached.
  let peakIdx = -1;
  let peakRank = 0;
  points.forEach((p, i) => {
    if (p.band == null) return;
    const r = RANK[p.band];
    if (r > peakRank) {
      peakRank = r;
      peakIdx = i;
    }
  });
  const peakPoint = peakIdx >= 0 ? points[peakIdx] : undefined;
  const peak =
    peakRank >= 1 && peakPoint?.band != null
      ? { x: xAt(peakIdx), y: Y[peakPoint.band] }
      : null;

  const subtitle =
    peakRank >= 2
      ? "A tense stretch in here."
      : peakRank === 1
        ? "A little tension creeping in."
        : "Settled so far.";

  return (
    <section
      data-testid="session-trend"
      className="mt-5 rounded-2xl border border-border bg-surface p-5 shadow-soft sm:p-6"
      aria-label="This session's trend"
    >
      <h3 className="font-display text-base font-semibold text-ink">This session</h3>

      {drawableCount === 0 ? (
        <p data-testid="session-trend-empty" className="mt-1.5 text-sm text-muted">
          Your trend builds as readings come in.
        </p>
      ) : (
        <>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
          <svg
            className="mt-3.5 block h-[88px] w-full"
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            role="img"
            aria-label="Band trend for this check-in: higher means tenser; gaps are windows without a clear read."
          >
            <line
              x1="4"
              y1="32"
              x2="96"
              y2="32"
              stroke="var(--color-border)"
              vectorEffect="non-scaling-stroke"
            />
            {runs.map((run, ri) =>
              run.length >= 2 ? (
                <path
                  key={ri}
                  data-testid="trend-seg"
                  d={`M ${run.map((q) => `${q.x},${q.y}`).join(" L ")}`}
                  fill="none"
                  stroke="var(--color-meadow)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : (
                <circle
                  key={ri}
                  data-testid="trend-dot"
                  cx={run[0]!.x}
                  cy={run[0]!.y}
                  r={2.6}
                  fill="var(--color-meadow)"
                  vectorEffect="non-scaling-stroke"
                />
              ),
            )}
            {peak && (
              <circle
                data-testid="trend-peak"
                cx={peak.x}
                cy={peak.y}
                r={3.2}
                fill="var(--color-amber)"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          <ul className="mt-3 flex flex-wrap gap-4 text-xs text-muted" aria-hidden>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-meadow" /> At ease
            </li>
            <li className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-sm"
                style={{ background: "color-mix(in srgb, var(--color-amber) 55%, var(--color-meadow))" }}
              />{" "}
              A little tense
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-amber" /> Tense
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
