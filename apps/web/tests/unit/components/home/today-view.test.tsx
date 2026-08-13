import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TodayView } from "@/components/home/today-view";
import type { Band } from "@/lib/api/monitoring-client";
import { deriveRecap, type SessionRow, type TodayTrendRow } from "@/lib/api/monitoring-reads";

/**
 * Feature 009 / US1 (collapsed surface). The glanceable today card: an honest THREE-LEVEL
 * headline (the amber `--amber-head` keyword, weight 700, only when the day reached that
 * tension level) on the card surface, plus the wide-short mini step-line, plus a single
 * "View today" toggle. The expanded plot + timeline are US2 (not asserted here).
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

// a calm morning (1), a tense afternoon (2), a read-less late session (3)
const DAY_SESSIONS = [sess("m", 8, 40, iso(9, 30)), sess("a", 13, 30, iso(14, 18)), sess("late", 16, 50)];
const DAY_ROWS: TodayTrendRow[] = [
  wr("m", "at_ease", 8, 45),
  wr("a", "at_ease", 13, 35),
  wr("a", "tense", 14, 10),
  wr("late", null, 16, 55),
];

const renderDay = (expanded = false, onToggle = vi.fn()) => {
  const recap = deriveRecap(DAY_SESSIONS, DAY_ROWS, NOW);
  return {
    onToggle,
    ...render(<TodayView recap={recap} trendRows={DAY_ROWS} expanded={expanded} onToggle={onToggle} />),
  };
};

describe("TodayView — collapsed glance (US1)", () => {
  it("renders the eyebrow, the headline keyword in --amber-head (weight 700), Start + the toggle", () => {
    renderDay(false);
    const hot = screen.getByTestId("headline-hot");
    expect(hot).toHaveTextContent(/tense/i);
    expect(hot.getAttribute("style")).toContain("--amber-head"); // surface-safe amber, not text-amber
    expect(hot.className).toMatch(/font-bold/); // weight 700 → the 3:1 large-text basis

    expect(screen.getByRole("link", { name: /start check-in/i })).toHaveAttribute("href", "/app/monitor");

    const toggle = screen.getByRole("button", { name: /view today/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("renders the mini step-line (a connected line, not floating dots)", () => {
    renderDay(false);
    expect(screen.getByTestId("today-mini-trend")).toBeInTheDocument();
    expect(screen.getAllByTestId("mini-connector").length).toBeGreaterThanOrEqual(1);
  });

  it("the toggle is keyboard-operable and reports onToggle", () => {
    const { onToggle } = renderDay(false);
    fireEvent.click(screen.getByRole("button", { name: /view today/i }));
    expect(onToggle).toHaveBeenCalled();
  });
});

describe("TodayView — honest three-level headline render (FR-002)", () => {
  it("an uneasy-only day shows the amber keyword with the exact 'uneasy' word", () => {
    const sessions = [sess("a", 13, 30, iso(14, 18))];
    const rows = [wr("a", "at_ease", 13, 35), wr("a", "a_little_tense", 14, 10)];
    const recap = deriveRecap(sessions, rows, NOW);
    render(<TodayView recap={recap} trendRows={rows} expanded={false} onToggle={vi.fn()} />);
    const hot = screen.getByTestId("headline-hot");
    expect(hot.textContent?.toLowerCase()).toContain("uneasy");
    expect(hot.getAttribute("style")).toContain("--amber-head");
  });

  it("an all-calm day renders no amber keyword", () => {
    const sessions = [sess("m", 8, 40, iso(9, 30))];
    const rows = [wr("m", "at_ease", 8, 45), wr("m", "at_ease", 9, 20)];
    const recap = deriveRecap(sessions, rows, NOW);
    render(<TodayView recap={recap} trendRows={rows} expanded={false} onToggle={vi.fn()} />);
    expect(screen.queryByTestId("headline-hot")).toBeNull();
  });
});

describe("TodayView — expanded toggle state", () => {
  it("reports aria-expanded=true and a Hide today affordance when expanded", () => {
    renderDay(true);
    expect(screen.getByRole("button", { name: /hide today/i })).toHaveAttribute("aria-expanded", "true");
  });
});
