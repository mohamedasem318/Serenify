import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TodayTrendPlot } from "@/components/home/today-trend-plot";
import { LANE_MIN, type SessionSeq } from "@/lib/trend-geometry";

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
    render(<TodayTrendPlot seqs={BUSY.slice(0, 2)} availableWidth={1008} />);
    expect(fadeRight().className).not.toMatch(/is-on/);
    expect(fadeLeft().className).not.toMatch(/is-on/);
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
