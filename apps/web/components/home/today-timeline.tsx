"use client";

import type { CSSProperties } from "react";

import type { ChipTone, RecapSession } from "@/lib/api/monitoring-reads";
import { HIGHLIGHT_FILL } from "@/lib/trend-geometry";

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
 * Visual source of truth: docs/mockups/serenify-008followups-trend-FINAL.html (`.trow` / `.chip`).
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
  /** The synced-highlight active session id (US3) — shared with the lane plot. */
  activeId?: string | null;
  /** Set/clear the active session on row hover (US3). Rows are NOT keyboard tab stops. */
  onActivate?: (id: string | null) => void;
  /** Drop the row's background transition when reduced motion is preferred (FR-015 / SC-005). */
  reduceMotion?: boolean;
}

export function TodayTimeline({
  sessions,
  activeId = null,
  onActivate,
  reduceMotion = false,
}: TodayTimelineProps) {
  return (
    <ul className="flex flex-col">
      {sessions.map((s) => {
        const chip = CHIP[s.chipTone];
        const active = activeId === s.sessionId;
        return (
          <li
            key={s.sessionId}
            data-testid="timeline-row"
            data-session-id={s.sessionId}
            data-active={active ? "true" : "false"}
            onMouseEnter={() => onActivate?.(s.sessionId)}
            onMouseLeave={() => onActivate?.(null)}
            // Mobile-first (DC-002/DC-005): stack number+label over chip+time so a narrow row never
            // crushes the label into a mid-phrase wrap. At sm: it collapses to the locked one-line
            // layout (number · label · chip · time-range). py-2 keeps the stacked row ≥44px.
            className={`flex flex-col gap-1.5 rounded-[10px] px-2 py-2 sm:flex-row sm:items-center sm:gap-3 sm:py-[7px] ${
              reduceMotion ? "" : "transition-colors duration-150"
            }`}
            style={{ backgroundColor: active ? HIGHLIGHT_FILL : undefined }}
          >
            {/* number + label — full width on mobile; `truncate` guarantees one line (no mid-phrase wrap) */}
            <div className="flex min-w-0 items-center gap-3 sm:flex-1">
              <span className="w-[18px] flex-none text-center text-[13px] text-muted">{s.number}</span>
              <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{s.timeIdentity}</span>
            </div>
            {/* chip + time-range — a second line under the label on mobile, inline-right on desktop */}
            <div className="flex items-center justify-between gap-3 pl-[30px] sm:flex-none sm:justify-end sm:pl-0">
              <span
                data-testid="timeline-chip"
                data-tone={s.chipTone}
                className={`flex-none whitespace-nowrap rounded-full px-3 py-[3px] text-[13px] font-semibold ${chip.className}`}
                style={chip.style}
              >
                {s.chipLabel}
              </span>
              <span className="flex-none whitespace-nowrap text-[13px] text-muted sm:w-[120px] sm:text-right">
                {s.timeRange}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
