import type { ReactNode } from "react";

import { BAND_LINE, MINI_H, MINI_W, buildMini, type SessionSeq } from "@/lib/trend-geometry";

/**
 * Feature 009 — the collapsed today card's mini-trend: a wide-short CONNECTED step-line
 * carrying each session's peak band over the day (SC-003 / FR-003). Colour echoes the
 * headline via the band family (calm = meadow, uneasy = soft amber, tense = amber).
 * A no-read session is a hollow muted marker on its own low lane — never on the calm line.
 *
 * This strip is a thin 1-D line, so the horizontal stretch of a `preserveAspectRatio="none"`
 * viewBox is fine for the LINES (a stretched line is still a line). It is NOT fine for a
 * round marker: a `<circle>` under non-uniform scale becomes a squished ellipse and a lone
 * hollow ring reads as a stray "0" — so the no-read marker is a short muted dash on the low
 * lane (a horizontal segment, distortion-proof), not a circle. The hollow-circle treatment
 * belongs to the EXPANDED lane plot, which is fixed-px (DC-001) and so doesn't distort.
 */
export function TodayMiniTrend({ seqs }: { seqs: SessionSeq[] }) {
  const peaks = buildMini(seqs);
  const segW = peaks.length > 0 ? (MINI_W / peaks.length) * 0.32 : 0;

  const els: ReactNode[] = [];
  let prev: { x: number; y: number } | null = null;
  for (const p of peaks) {
    if (p.noRead) {
      // a short, muted, faded dash on the low no-read lane — never a (distorting) ring
      const half = segW * 0.4;
      els.push(
        <polyline
          key={`n-${p.sessionId}`}
          data-testid={`mini-noread-${p.sessionId}`}
          points={`${p.cx - half},${p.y} ${p.cx + half},${p.y}`}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={2.4}
          strokeOpacity={0.5}
          strokeLinecap="round"
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
