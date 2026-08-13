import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TodaysCheckinCard } from "@/components/home/todays-checkin-card";
import type { Band } from "@/lib/api/monitoring-client";
import { deriveRecap, type SessionRow, type TodayTrendRow } from "@/lib/api/monitoring-reads";

/**
 * Feature 008 / US4 — T049 (card-branch slice). The check-in card chooses its surface
 * from `has_anchor` + today's sessions (data-model E4 / FR-019): a no-anchor user is
 * routed to calibrate-first (never an empty recap), a calibrated user with no check-ins
 * today sees the empty state, and a calibrated user with check-ins sees the recap that
 * expands in place.
 *
 * Feature 009 / T024 (clean-swap audit) — the recap branch now drives the REDESIGNED
 * surfaces: the collapsed honest headline + wide-short mini step-line, expanding in place
 * to the fixed-px lane plot with a LEFT AXIS (four level labels, NO bottom legend). The
 * card→TodayView wiring is unchanged; this slice pins that the new surfaces actually mount.
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
const sess = (id: string, h: number, m: number, ended: string): SessionRow => ({
  id,
  started_at: iso(h, m),
  ended_at: ended,
  status: "ended",
});

const EMPTY = deriveRecap([], [], NOW);
const DAY_SESSIONS = [sess("m", 8, 40, iso(9, 30)), sess("a", 13, 30, iso(14, 18))];
const DAY_ROWS = [
  wr("m", "at_ease", 8, 45),
  wr("a", "at_ease", 13, 35),
  wr("a", "tense", 14, 10),
];
const DAY_RECAP = deriveRecap(DAY_SESSIONS, DAY_ROWS, NOW);

describe("TodaysCheckinCard — empty state (calibrated, no check-ins today)", () => {
  it("shows 'No check-ins yet today' with Start check-in", async () => {
    render(
      <TodaysCheckinCard
        userId="u1"
        hasAnchor
        deps={{ loadRecap: async () => EMPTY, loadTrend: async () => [] }}
      />,
    );
    expect(await screen.findByText(/no check-ins yet today/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start check-in/i })).toHaveAttribute(
      "href",
      "/app/monitor",
    );
  });
});

describe("TodaysCheckinCard — calibrate-first (no anchor; FR-019 / E4)", () => {
  it("routes a no-anchor user to calibration and never shows a recap or band", async () => {
    render(
      <TodaysCheckinCard
        userId="u1"
        hasAnchor={false}
        deps={{ loadRecap: async () => DAY_RECAP, loadTrend: async () => DAY_ROWS }}
      />,
    );
    const cta = await screen.findByRole("link", { name: /start calibration/i });
    expect(cta).toHaveAttribute("href", "/app/calibrate");
    expect(screen.queryByTestId("headline-hot")).toBeNull();
    expect(screen.queryByText(/no check-ins yet today/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /view today/i })).toBeNull();
  });
});

describe("TodaysCheckinCard — recap that expands in place (FR-028)", () => {
  it("renders the redesigned 009 surfaces: honest headline + mini-trend, expanding to the axis-labelled plot (no legend)", async () => {
    render(
      <TodaysCheckinCard
        userId="u1"
        hasAnchor
        deps={{ loadRecap: async () => DAY_RECAP, loadTrend: async () => DAY_ROWS }}
      />,
    );
    // collapsed: the honest headline keyword (DAY peaks at tense) + the wide-short mini step-line
    expect(await screen.findByTestId("headline-hot")).toHaveTextContent(/tense/i);
    expect(screen.getByTestId("today-mini-trend")).toBeInTheDocument();

    // expand in place → the fixed-px lane plot with FOUR left-axis labels and NO bottom legend
    fireEvent.click(screen.getByRole("button", { name: /view today/i }));
    expect(await screen.findByRole("button", { name: /hide today/i })).toBeInTheDocument();
    expect(screen.getByTestId("today-plot")).toBeInTheDocument();
    expect(
      screen.getAllByTestId("axis-label").map((n) => n.textContent?.trim().toLowerCase()),
    ).toEqual(["tense", "uneasy", "calm", "no read"]);
    expect(screen.queryByTestId("plot-legend")).toBeNull();
  });
});

describe("TodaysCheckinCard — preserved default (no userId)", () => {
  it("renders the static Start check-in entry without loading", () => {
    render(<TodaysCheckinCard />);
    expect(screen.getByRole("link", { name: /start check-in/i })).toHaveAttribute(
      "href",
      "/app/monitor",
    );
  });
});
