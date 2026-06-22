import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TodayView } from "@/components/home/today-view";
import type { Band } from "@/lib/api/monitoring-client";
import {
  RECAP_SESSION_COLUMNS,
  SESSION_TREND_COLUMNS,
  TODAY_TREND_COLUMNS,
  deriveRecap,
  type SessionRow,
  type TodayTrendRow,
} from "@/lib/api/monitoring-reads";

/**
 * Feature 009 / US2 — privacy by architecture (FR-017 / SC-008 / SC-009). The expanded day
 * view is a pure projection of band + clock time. No stress probability may reach the client:
 * not in the rendered DOM (no value, no attribute, no "%"), and not in the consumed reader
 * SELECTs (the column whitelists never name `stress_probability` or `label`). This feature adds
 * no new read — it consumes the existing owner-scoped RLS reads unchanged.
 */

const iso = (h: number, m: number) => new Date(2026, 5, 21, h, m).toISOString();
const NOW = new Date(2026, 5, 21, 17, 40);
const wr = (sessionId: string, band: Band | null, h: number, m: number): TodayTrendRow => ({
  sessionId,
  band,
  capturedAt: iso(h, m),
  scored: band !== null,
  skipCause: null,
});
const sess = (id: string, h: number, m: number, ended: string | null = null): SessionRow => ({
  id,
  started_at: iso(h, m),
  ended_at: ended,
  status: ended ? "ended" : "active",
});

const SESSIONS = [sess("m", 8, 40, iso(9, 30)), sess("a", 13, 30, iso(14, 18)), sess("late", 16, 50)];
const ROWS: TodayTrendRow[] = [
  wr("m", "at_ease", 8, 45),
  wr("a", "at_ease", 13, 35),
  wr("a", "tense", 14, 10),
  wr("late", null, 16, 55),
];

describe("TodayView (expanded) — no probability reaches the client (SC-008)", () => {
  it("renders no percentage sign and no probability-bearing attribute", () => {
    const recap = deriveRecap(SESSIONS, ROWS, NOW);
    const { container } = render(
      <TodayView recap={recap} trendRows={ROWS} expanded onToggle={vi.fn()} />,
    );

    expect(container.textContent).not.toContain("%");

    for (const el of Array.from(container.querySelectorAll("*"))) {
      for (const attr of Array.from(el.attributes)) {
        expect(attr.name.toLowerCase()).not.toContain("probability");
        expect(String(attr.value).toLowerCase()).not.toContain("probability");
      }
    }
  });
});

describe("consumed reader whitelists — owner columns only (SC-009)", () => {
  it("never select stress_probability or label", () => {
    for (const cols of [SESSION_TREND_COLUMNS, TODAY_TREND_COLUMNS, RECAP_SESSION_COLUMNS]) {
      expect(cols).not.toContain("stress_probability");
      expect(cols).not.toContain("label");
    }
  });
});
