import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TodayTrendPlot } from "@/components/home/today-trend-plot";
import { LANE_MIN, PLOT_H, type SessionSeq } from "@/lib/trend-geometry";

/**
 * Feature 009 / US4 — busy-day overflow (FR-014 / SC-006). All of today's sessions render; lanes
 * hold LANE_MIN and never crush into bars. When the strip is wider than its wrapper it scrolls
 * horizontally, with a right edge-fade signalling "more →" and a left edge-fade once scrolled away
 * from the start. The fade opacity transitions also honor reduced motion (FR-015).
 */

// 11 sessions → a busy day. Two windows each so a lane is a run (exercises a real lane, not a dot).
const BUSY: SessionSeq[] = Array.from({ length: 11 }, (_, i) => ({
  sessionId: `s${i}`,
  tenor: i % 2 === 0 ? "at_ease" : "a_little_tense",
  bands: ["at_ease", "a_little_tense"],
}));

const svgOf = () => within(screen.getByTestId("today-plot")).getByTestId("plot-svg");
const scroller = () => screen.getByTestId("plot-scroll");
const fadeRight = () => screen.getByTestId("plot-fade-right");
const fadeLeft = () => screen.getByTestId("plot-fade-left");

describe("TodayTrendPlot — busy-day overflow (SC-006)", () => {
  it("renders every session at >= LANE_MIN (never crushed) and overflows the wrapper", () => {
    render(<TodayTrendPlot seqs={BUSY} availableWidth={420} />);
    const svg = svgOf();
    const W = Number(svg.getAttribute("width"));
    const laneWidth = W / BUSY.length;

    expect(laneWidth).toBeGreaterThanOrEqual(LANE_MIN); // 112 floor — never crushed
    expect(W).toBe(BUSY.length * LANE_MIN); // 11 × 112 = 1232
    expect(W).toBeGreaterThan(420); // wider than the wrapper → the strip scrolls
    // all 11 sessions are present in the DOM (one lane background each)
    expect(svg.querySelectorAll("[data-lane-bg]")).toHaveLength(BUSY.length);
  });

  it("shows the right edge-fade while overflowing, and the left fade only after scrolling", () => {
    render(<TodayTrendPlot seqs={BUSY} availableWidth={420} />);
    expect(fadeRight().className).toMatch(/is-on/);
    expect(fadeLeft().className).not.toMatch(/is-on/);

    const sc = scroller();
    Object.defineProperty(sc, "scrollLeft", { value: 80, configurable: true });
    fireEvent.scroll(sc);
    expect(fadeLeft().className).toMatch(/is-on/); // scrolled away from the start
  });

  it("shows no edge-fades when the lanes fit the wrapper", () => {
    render(<TodayTrendPlot seqs={BUSY.slice(0, 2)} availableWidth={1000} />);
    expect(fadeRight().className).not.toMatch(/is-on/);
    expect(fadeLeft().className).not.toMatch(/is-on/);
  });
});

describe("TodayTrendPlot — the strip height stays bounded to the plot (DC-002 / SC-003 — no dead space)", () => {
  it("pins the SVG to PLOT_H and keeps the edge-fades as out-of-flow overlays", () => {
    render(<TodayTrendPlot seqs={BUSY} availableWidth={420} />);

    // The drawing height is pinned to PLOT_H — the plot region can never balloon past ~200px.
    expect(svgOf().getAttribute("height")).toBe(String(PLOT_H));

    // REGRESSION (the dead-space bug): the fades carry their LOAD-BEARING positioning as
    // utilities (`absolute` + `pointer-events-none`), so even if the component-local
    // `.today-plot-fade` rule is absent/stale they stay ZERO-LAYOUT overlays — never two
    // in-flow PLOT_H blocks stacking below the strip (which ballooned the plot to ~3× height).
    for (const fade of [fadeLeft(), fadeRight()]) {
      expect(fade.className).toMatch(/(^|\s)absolute(\s|$)/);
      expect(fade.className).toMatch(/pointer-events-none/);
    }

    // The load-bearing horizontal scroll is a utility too (not only the styled-scrollbar rule),
    // so the fixed-px strip scrolls instead of spilling the page if that rule is missing.
    expect(scroller().className).toMatch(/overflow-x-auto/);
  });
});

describe("TodayTrendPlot — overflow fades honor reduced motion (FR-015)", () => {
  it("applies an opacity transition normally, none under reduced motion", () => {
    const { rerender } = render(<TodayTrendPlot seqs={BUSY} availableWidth={420} />);
    expect(fadeRight().className).toMatch(/transition/);

    rerender(<TodayTrendPlot seqs={BUSY} availableWidth={420} reduceMotion />);
    expect(fadeRight().className).not.toMatch(/transition/);
    expect(fadeLeft().className).not.toMatch(/transition/);
  });
});
