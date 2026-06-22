"use client";

import type { CSSProperties } from "react";

import type { ChipTone, RecapSession } from "@/lib/api/monitoring-reads";

/**
 * Feature 009 / US2 — the expanded today card's session timeline (FR-012 / FR-013).
 *
 * One row per retrospective session: ordinal number, time identity, a state-coloured **pill**
 * chip, and the local time range. The chip's tone + label come straight from the recap
 * (`chipTone` / `chipLabel`) — the SAME values the lane plot's peak derives from — so the graph
 * and the timeline can never disagree (SC-004). Chip TEXT always uses the AA-safe
 * `--color-amber-text` / `--color-meadow-text` / `--color-muted` tokens, never the bright
 * graphic amber. The live monitor's "processed, then deleted" reassurance line is intentionally
 * NOT shown here (FR-013) — it stays on the monitor.
 *
 * Visual source of truth: serenify-008followups-trend-FINAL.html (`.trow` / `.chip`).
 */

const CHIP: Record<ChipTone, { className: string; style: CSSProperties }> = {
  meadow: {
    className: "text-meadow-text",
    style: { backgroundColor: "color-mix(in srgb, var(--color-meadow) 15%, transparent)" },
  },
  amber: {
    className: "text-amber-text",
    style: { backgroundColor: "var(--amber-tint)" },
  },
  muted: {
    className: "text-muted",
    style: { backgroundColor: "color-mix(in srgb, var(--color-muted) 14%, transparent)" },
  },
};

export interface TodayTimelineProps {
  sessions: RecapSession[];
}

export function TodayTimeline({ sessions }: TodayTimelineProps) {
  return (
    <ul className="flex flex-col">
      {sessions.map((s) => {
        const chip = CHIP[s.chipTone];
        return (
          <li
            key={s.sessionId}
            data-testid="timeline-row"
            data-session-id={s.sessionId}
            className="flex items-center gap-3 rounded-[10px] px-2 py-[7px]"
          >
            <span className="w-[18px] flex-none text-center text-[13px] text-muted">{s.number}</span>
            <span className="flex-1 text-[15px] text-ink">{s.timeIdentity}</span>
            <span
              data-testid="timeline-chip"
              data-tone={s.chipTone}
              className={`flex-none whitespace-nowrap rounded-full px-3 py-[3px] text-[13px] font-semibold ${chip.className}`}
              style={chip.style}
            >
              {s.chipLabel}
            </span>
            <span className="w-[120px] flex-none text-right text-[13px] text-muted">{s.timeRange}</span>
          </li>
        );
      })}
    </ul>
  );
}
