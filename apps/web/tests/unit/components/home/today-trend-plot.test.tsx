import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TodayTrendPlot } from "@/components/home/today-trend-plot";
import { BAND_LINE, BAND_Y, LANE_MIN, STROKE, type SessionSeq } from "@/lib/trend-geometry";

/**
 * Feature 009 / US2 — the expanded fixed-px lane plot (DC-001 / SC-002). The load-bearing
 * anti-totem assertions live here: the SVG renders at 1 unit = 1 px (width === viewBox width
 * === nLanes × laneWidth), it never stretches a small viewBox, no `<rect>` encodes a band
 * height (bars are the rejected approach), and lanes never crush below LANE_MIN. The left axis
 * carries the four level labels (NO bottom legend). Warm-up / lost-read render faded (never a
 * solid bridge); a fully read-less session is a hollow marker on its own low lane; a single
 * confident reading is a dot. Each lane's peak colour echoes its tenor (== the timeline chip).
 */

// A day that exercises every branch: warm-up + 3 runs + 2 transitions (tense),
// an interior lost read (a little tense), a fully read-less session, and a single dot (calm).
const DAY: SessionSeq[] = [
  { sessionId: "tense", tenor: "tense", bands: [null, "at_ease", "at_ease", "a_little_tense", "tense", "tense"] },
  { sessionId: "little", tenor: "a_little_tense", bands: ["a_little_tense", null, "a_little_tense"] },
  { sessionId: "noread", tenor: "no_read", bands: [null, null] },
  { sessionId: "calm", tenor: "at_ease", bands: ["at_ease"] },
];

const svgOf = (testid = "today-plot") => within(screen.getByTestId(testid)).getByTestId("plot-svg");

describe("TodayTrendPlot — fixed-px, no totem (DC-001 / SC-002)", () => {
  it("at a desktop width: svg width === viewBox width === nLanes × laneWidth, no stretch", () => {
    render(<TodayTrendPlot seqs={DAY} availableWidth={1000} />);
    const svg = svgOf();
    // 4 lanes, 1000 / 4 = 250 ≥ 112 → fills; W = 4 × 250 = 1000. The input (1000) is deliberately
    // NOT DEFAULT_AVAIL (1008), so a width of 1000 proves the prop drives the geometry, not the fallback.
    expect(svg.getAttribute("width")).toBe("1000");
    expect(svg.getAttribute("viewBox")).toBe("0 0 1000 200");
    expect(svg.getAttribute("preserveAspectRatio")).not.toBe("none");
  });

  it("at the 360px floor: lanes clamp to LANE_MIN and overflow (never crushed)", () => {
    // a 360px phone minus the ~96px axis ≈ 264px of lane area; 264 / 4 = 66 < 112 → clamp to 112
    render(<TodayTrendPlot seqs={DAY} availableWidth={264} />);
    const svg = svgOf();
    const width = Number(svg.getAttribute("width"));
    const laneWidth = width / DAY.length;
    expect(laneWidth).toBeGreaterThanOrEqual(LANE_MIN);
    expect(width).toBe(DAY.length * LANE_MIN); // 4 × 112 = 448, wider than 264 → scrolls
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${width} 200`);
    expect(svg.getAttribute("preserveAspectRatio")).not.toBe("none");
  });

  it("no <rect> encodes a band height — lane backgrounds span the full plot, carry no band meaning", () => {
    render(<TodayTrendPlot seqs={DAY} availableWidth={1000} />);
    const rects = svgOf().querySelectorAll("rect");
    expect(rects.length).toBeGreaterThan(0); // highlight surfaces exist…
    rects.forEach((r) => expect(r.getAttribute("height")).toBe("172")); // …but none is a band-tall bar
  });
});

describe("TodayTrendPlot — axis, not legend (SC-001)", () => {
  it("renders exactly four left-axis level labels and zero legend swatches", () => {
    render(<TodayTrendPlot seqs={DAY} availableWidth={1000} />);
    const labels = screen.getAllByTestId("axis-label").map((n) => n.textContent?.trim().toLowerCase());
    expect(labels).toEqual(["tense", "a little tense", "at ease", "no read"]);
    expect(screen.queryByTestId("plot-legend")).toBeNull();
  });
});

describe("TodayTrendPlot — height + colour per band (SC-004 / SC-010)", () => {
  it("each confident run draws a ~3px line at its band Y in the band's token colour", () => {
    render(<TodayTrendPlot seqs={DAY} availableWidth={1000} />);
    const runs = screen.getAllByTestId("run");
    const byBand = (b: string) => runs.find((r) => r.getAttribute("data-band") === b)!;

    const ease = byBand("at_ease");
    expect(ease.getAttribute("stroke")).toBe(BAND_LINE.at_ease);
    expect(ease.getAttribute("y1")).toBe(String(BAND_Y.at_ease));
    expect(ease.getAttribute("stroke-width")).toBe(String(STROKE));

    expect(byBand("a_little_tense").getAttribute("stroke")).toBe(BAND_LINE.a_little_tense);
    expect(byBand("a_little_tense").getAttribute("y1")).toBe(String(BAND_Y.a_little_tense));

    // the tense lane's peak colour == the tense token (the same value the chip uses)
    expect(byBand("tense").getAttribute("stroke")).toBe(BAND_LINE.tense);
    expect(byBand("tense").getAttribute("y1")).toBe(String(BAND_Y.tense));
  });

  it("warm-up and lost-read render faded — never a solid bridge at a fixed level", () => {
    render(<TodayTrendPlot seqs={DAY} availableWidth={1000} />);
    const warmup = screen.getByTestId("warmup");
    const lost = screen.getByTestId("lostread");
    expect(Number(warmup.getAttribute("stroke-opacity"))).toBeLessThan(1);
    expect(Number(lost.getAttribute("stroke-opacity"))).toBeLessThan(1);
  });

  it("a fully read-less session is a hollow marker on its own low lane (no_read), never the calm line", () => {
    render(<TodayTrendPlot seqs={DAY} availableWidth={1000} />);
    const marker = screen.getByTestId("noread-marker");
    expect(marker.tagName.toLowerCase()).toBe("circle");
    expect(marker.getAttribute("fill")).toBe("none"); // hollow
    expect(marker.getAttribute("cy")).toBe(String(BAND_Y.no_read));
    expect(marker.getAttribute("cy")).not.toBe(String(BAND_Y.at_ease));
  });

  it("a single confident reading is a filled dot in its band colour, not a line", () => {
    render(<TodayTrendPlot seqs={DAY} availableWidth={1000} />);
    const dot = screen.getByTestId("dot");
    expect(dot.tagName.toLowerCase()).toBe("circle");
    expect(dot.getAttribute("fill")).toBe(BAND_LINE.at_ease); // calm dot, filled (≠ hollow no-read)
    expect(dot.getAttribute("cy")).toBe(String(BAND_Y.at_ease));
  });
});
