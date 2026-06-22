import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TodayView } from "@/components/home/today-view";
import type { Band } from "@/lib/api/monitoring-client";
import { deriveRecap, type SessionRow, type TodayTrendRow } from "@/lib/api/monitoring-reads";

/**
 * Feature 008 / US4 — T048 / T049 (presentational slice). The collapsed recap + the
 * in-place expanded "today" view. Bound to the v5 mock (serenify-008-us4-inline-mock-v5)
 * and the locked read-rules: read-less never reads as calm (SC-011), n=1 is a single dot,
 * the mini-trend and the expanded plot come from one source (SC-008), cross-highlight on
 * hover AND keyboard focus, and a keyboard-operable expand toggle with aria-expanded.
 */

const iso = (h: number, m: number) => new Date(2026, 5, 21, h, m).toISOString();
const NOW = new Date(2026, 5, 21, 17, 40);

const wr = (
  sessionId: string,
  band: Band | null,
  h: number,
  m: number,
  scored = band !== null,
  skipCause: TodayTrendRow["skipCause"] = null,
): TodayTrendRow => ({ sessionId, band, capturedAt: iso(h, m), scored, skipCause });

const sess = (
  id: string,
  startH: number,
  startM: number,
  status: SessionRow["status"],
  endedAt: string | null = null,
): SessionRow => ({ id, started_at: iso(startH, startM), ended_at: endedAt, status });

// The mock day: a calm morning (1), a tense afternoon (2), a read-less late session (3).
const DAY_SESSIONS = [
  sess("m", 8, 40, "ended", iso(9, 30)),
  sess("a", 13, 30, "ended", iso(14, 18)),
  sess("late", 16, 50, "active"),
];
const DAY_ROWS: TodayTrendRow[] = [
  wr("m", "at_ease", 8, 45),
  wr("m", "at_ease", 9, 20),
  wr("a", "at_ease", 13, 35),
  wr("a", "a_little_tense", 13, 50),
  wr("a", "tense", 14, 10),
  wr("late", null, 16, 55, false, "low-light"),
  wr("late", null, 17, 0, false, "low-light"),
];

const renderDay = (expanded: boolean, onToggle = vi.fn()) => {
  const recap = deriveRecap(DAY_SESSIONS, DAY_ROWS, NOW);
  return {
    onToggle,
    ...render(
      <TodayView recap={recap} trendRows={DAY_ROWS} expanded={expanded} onToggle={onToggle} />,
    ),
  };
};

describe("TodayView — collapsed recap", () => {
  it("renders the templated headline with the tense clause in amber, plus Start check-in + the toggle", () => {
    renderDay(false);
    const hot = screen.getByTestId("headline-hot");
    expect(hot).toHaveTextContent(/tense/i);
    expect(hot.className).toMatch(/amber/);

    const start = screen.getByRole("link", { name: /start check-in/i });
    expect(start).toHaveAttribute("href", "/app/monitor");

    const toggle = screen.getByRole("button", { name: /view today/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("the toggle is keyboard-operable and reports onToggle", () => {
    const { onToggle } = renderDay(false);
    fireEvent.click(screen.getByRole("button", { name: /view today/i }));
    expect(onToggle).toHaveBeenCalled();
  });
});

describe("TodayView — SC-008 consistency (mini-trend and expanded plot share one source)", () => {
  it("the mini-trend and the expanded plot plot the same session set", () => {
    renderDay(true);
    const mini = screen.getByTestId("today-mini-trend");
    const plot = screen.getByTestId("today-plot");
    expect(mini.getAttribute("data-sessions")).toBe(plot.getAttribute("data-sessions"));
    expect(Number(plot.getAttribute("data-sessions"))).toBeGreaterThan(0);
  });
});

describe("TodayView — read-less honesty (SC-011: never calm)", () => {
  it("the read-less session reads 'no clear read', muted — never 'at ease'", () => {
    renderDay(true);
    const row = screen.getByTestId("tl-row-late");
    expect(within(row).getByText(/no clear read/i)).toBeInTheDocument();
    expect(within(row).queryByText(/at ease/i)).toBeNull();
    const chip = within(row).getByTestId("tl-chip");
    expect(chip.className).toContain("text-muted");
    expect(chip.className).not.toMatch(/amber|meadow/);
  });

  it("amber is reserved for the tense session; the calm session chip is meadow", () => {
    renderDay(true);
    const tenseChip = within(screen.getByTestId("tl-row-a")).getByTestId("tl-chip");
    const calmChip = within(screen.getByTestId("tl-row-m")).getByTestId("tl-chip");
    expect(tenseChip.className).toMatch(/amber/);
    expect(calmChip.className).toContain("text-meadow-text");
    // a peak marker sits on the tensest stretch
    expect(screen.getByTestId("plot-peak")).toBeInTheDocument();
  });
});

describe("TodayView — n=1 single dot (FR-029)", () => {
  it("a single-reading session renders a dot, not a line", () => {
    const sessions = [sess("one", 10, 0, "ended", iso(10, 12))];
    const rows = [wr("one", "a_little_tense", 10, 5)];
    const recap = deriveRecap(sessions, rows, NOW);
    render(<TodayView recap={recap} trendRows={rows} expanded onToggle={vi.fn()} />);
    expect(screen.getByTestId("plot-dot-one")).toBeInTheDocument();
    expect(screen.queryByTestId("plot-seg-one")).toBeNull();
  });
});

describe("TodayView — cross-highlight (hover AND keyboard focus, additive)", () => {
  it("hovering a plot badge highlights the matching timeline row", () => {
    renderDay(true);
    const badge = screen.getByTestId("plot-badge-a");
    const row = screen.getByTestId("tl-row-a");
    expect(row).toHaveAttribute("data-hl", "false");
    fireEvent.mouseEnter(badge);
    expect(row).toHaveAttribute("data-hl", "true");
    fireEvent.mouseLeave(badge);
    expect(row).toHaveAttribute("data-hl", "false");
  });

  it("focusing a timeline row highlights the matching plot badge (keyboard parity)", () => {
    renderDay(true);
    const badge = screen.getByTestId("plot-badge-a");
    const row = screen.getByTestId("tl-row-a");
    expect(badge).toHaveAttribute("data-hl", "false");
    fireEvent.focus(row);
    expect(badge).toHaveAttribute("data-hl", "true");
    fireEvent.blur(row);
    expect(badge).toHaveAttribute("data-hl", "false");
  });
});

describe("TodayView — expanded toggle state", () => {
  it("reports aria-expanded=true and a Hide today affordance when expanded", () => {
    renderDay(true);
    expect(screen.getByRole("button", { name: /hide today/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
