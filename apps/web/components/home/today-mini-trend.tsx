import type { ReactNode } from "react";

import { BAND_LINE, MINI_H, MINI_W, buildMini, type SessionSeq } from "@/lib/trend-geometry";

/**
 * Feature 009 — the collapsed today card's mini-trend: a wide-short CONNECTED step-line
 * carrying each session's peak band over the day (SC-003 / FR-003). Colour echoes the
 * headline via the band family (at ease = meadow, a little tense = soft amber, tense = amber).
 * A no-read session is a hollow muted marker on its own low lane — never on the calm line.
 *
 * This strip is a thin 1-D line, so the horizontal stretch of a `preserveAspectRatio="none"`
 * viewBox is fine here (it can't produce totem bars). The fixed-px discipline (DC-001) is the
 * EXPANDED lane plot's rule, not the mini's.
 */
export function TodayMiniTrend({ seqs }: { seqs: SessionSeq[] }) {
  const peaks = buildMini(seqs);
  const segW = peaks.length > 0 ? (MINI_W / peaks.length) * 0.32 : 0;

  const els: ReactNode[] = [];
  let prev: { x: number; y: number } | null = null;
  for (const p of peaks) {
    if (p.noRead) {
      els.push(
        <circle
          key={`n-${p.sessionId}`}
          data-testid={`mini-noread-${p.sessionId}`}
          cx={p.cx}
          cy={p.y}
          r={3}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />,
      );
      prev = null;
      continue;
    }
    const colour = BAND_LINE[p.tenor];
    if (prev) {
      els.push(
        <polyline
          key={`c-${p.sessionId}`}
          data-testid="mini-connector"
          points={`${prev.x},${prev.y} ${p.cx - segW},${prev.y} ${p.cx - segW},${p.y}`}
          fill="none"
          stroke={colour}
          strokeWidth={2}
          strokeOpacity={0.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />,
      );
    }
    els.push(
      <polyline
        key={`s-${p.sessionId}`}
        data-testid={`mini-seg-${p.sessionId}`}
        points={`${p.cx - segW},${p.y} ${p.cx + segW},${p.y}`}
        fill="none"
        stroke={colour}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />,
    );
    prev = { x: p.cx + segW, y: p.y };
  }

  return (
    <svg
      className="block h-12 w-full"
      viewBox={`0 0 ${MINI_W} ${MINI_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Today's shape across check-ins; each peak is a session's band, and gaps are windows without a clear read."
    >
      {els}
    </svg>
  );
}
