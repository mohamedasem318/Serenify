import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TodayView } from "@/components/home/today-view";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { Band } from "@/lib/api/monitoring-client";
import { deriveRecap, type SessionRow, type TodayTrendRow } from "@/lib/api/monitoring-reads";

/**
 * Feature 009 / US3 — the bidirectional synced highlight (FR-011 / SC-005). One active-session
 * id is lifted to TodayView and shared by the plot and the timeline:
 *   • hover a lane  → its lane bg AND its timeline row highlight (lane → row)
 *   • hover a row   → its row AND its lane highlight              (row → lane)
 *   • focus a lane's per-session target (role=button, tabindex=0, aria-label naming the tenor)
 *                   → a visible focus ring + its row highlights
 *   • rows are NOT separate tab stops (the resolved FR-011 — no per-row tab bloat)
 *   • reduced motion → every highlight transition is dropped (no transition class), state is
 *     instant (SC-005). useMediaQuery is mocked so the gate is asserted, not the browser's.
 */

// useMediaQuery is read once by TodayView and passed down as `reduceMotion`; default = no preference.
vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: vi.fn(() => false) }));

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

// a calm morning (at_ease), a tense afternoon (tense), a read-less late session (no_read)
const DAY_SESSIONS = [sess("m", 8, 40, iso(9, 30)), sess("a", 13, 30, iso(14, 18)), sess("late", 16, 50)];
const DAY_ROWS: TodayTrendRow[] = [
  wr("m", "at_ease", 8, 45),
  wr("a", "at_ease", 13, 35),
  wr("a", "tense", 14, 10),
  wr("late", null, 16, 55),
];

const renderExpanded = () => {
  const recap = deriveRecap(DAY_SESSIONS, DAY_ROWS, NOW);
  return render(<TodayView recap={recap} trendRows={DAY_ROWS} expanded onToggle={vi.fn()} />);
};

const laneBg = (c: HTMLElement, id: string) =>
  c.querySelector(`[data-lane-bg][data-session-id="${id}"]`);
const laneHit = (c: HTMLElement, id: string) =>
  c.querySelector(`[data-lane-hit][data-session-id="${id}"]`);
const ring = (c: HTMLElement, id: string) =>
  c.querySelector(`[data-lane-focusring][data-session-id="${id}"]`);
const row = (c: HTMLElement, id: string) =>
  c.querySelector(`[data-testid="timeline-row"][data-session-id="${id}"]`);

afterEach(() => {
  vi.mocked(useMediaQuery).mockReturnValue(false);
});

describe("US3 — per-session keyboard target in the plot (FR-011)", () => {
  it("each lane has a focusable hit: role=button, tabindex=0, aria-label naming the tenor", () => {
    const { container } = renderExpanded();
    const hit = laneHit(container, "a"); // the afternoon, tense session
    expect(hit).not.toBeNull();
    expect(hit).toHaveAttribute("role", "button");
    expect(hit).toHaveAttribute("tabindex", "0");
    expect(hit!.getAttribute("aria-label")?.toLowerCase()).toContain("tense");
  });

  it("timeline rows are NOT separate tab stops", () => {
    const { container } = renderExpanded();
    const rows = container.querySelectorAll('[data-testid="timeline-row"]');
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((r) => expect(r).not.toHaveAttribute("tabindex"));
  });
});

describe("US3 — bidirectional synced highlight (SC-005)", () => {
  it("hovering a lane highlights that lane AND its timeline row (lane → row)", () => {
    const { container } = renderExpanded();
    fireEvent.mouseEnter(laneHit(container, "a")!);
    expect(laneBg(container, "a")).toHaveAttribute("data-active", "true");
    expect(row(container, "a")).toHaveAttribute("data-active", "true");
    // other sessions stay inactive
    expect(laneBg(container, "m")).toHaveAttribute("data-active", "false");
    expect(row(container, "m")).toHaveAttribute("data-active", "false");

    fireEvent.mouseLeave(laneHit(container, "a")!);
    expect(laneBg(container, "a")).toHaveAttribute("data-active", "false");
    expect(row(container, "a")).toHaveAttribute("data-active", "false");
  });

  it("hovering a timeline row highlights that row AND its lane (row → lane)", () => {
    const { container } = renderExpanded();
    fireEvent.mouseEnter(row(container, "m")!);
    expect(row(container, "m")).toHaveAttribute("data-active", "true");
    expect(laneBg(container, "m")).toHaveAttribute("data-active", "true");

    fireEvent.mouseLeave(row(container, "m")!);
    expect(laneBg(container, "m")).toHaveAttribute("data-active", "false");
  });

  it("focusing a lane hit shows its focus ring and highlights its row", () => {
    const { container } = renderExpanded();
    fireEvent.focus(laneHit(container, "a")!);
    expect(ring(container, "a")).toHaveAttribute("data-visible", "true");
    expect(row(container, "a")).toHaveAttribute("data-active", "true");

    fireEvent.blur(laneHit(container, "a")!);
    expect(ring(container, "a")).toHaveAttribute("data-visible", "false");
    expect(row(container, "a")).toHaveAttribute("data-active", "false");
  });
});

describe("US3 — reduced motion gates every highlight transition (FR-015 / SC-005)", () => {
  it("applies transition classes normally, none under reduced motion", () => {
    const normal = renderExpanded();
    expect(laneBg(normal.container, "a")?.getAttribute("class") ?? "").toMatch(/transition/);
    expect(ring(normal.container, "a")?.getAttribute("class") ?? "").toMatch(/transition/);
    expect(row(normal.container, "a")?.getAttribute("class") ?? "").toMatch(/transition/);
    normal.unmount();

    vi.mocked(useMediaQuery).mockReturnValue(true);
    const reduced = renderExpanded();
    expect(laneBg(reduced.container, "a")?.getAttribute("class") ?? "").not.toMatch(/transition/);
    expect(ring(reduced.container, "a")?.getAttribute("class") ?? "").not.toMatch(/transition/);
    expect(row(reduced.container, "a")?.getAttribute("class") ?? "").not.toMatch(/transition/);
  });
});
