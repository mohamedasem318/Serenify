import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TodayMiniTrend } from "@/components/home/today-mini-trend";
import { MINI_Y, type SessionSeq } from "@/lib/trend-geometry";

/**
 * Feature 009 — SC-003 / FR-003. The collapsed mini-trend is a CONNECTED step-line (carrying
 * each session's peak band over the day), never a row of floating dots. A no-read session is a
 * hollow marker on its own low lane, never on the calm line.
 */

const seq = (sessionId: string, tenor: SessionSeq["tenor"]): SessionSeq => ({
  sessionId,
  tenor,
  bands: tenor === "no_read" ? [null] : [tenor],
});

const DAY: SessionSeq[] = [seq("m", "at_ease"), seq("a", "tense"), seq("late", "no_read")];

describe("TodayMiniTrend — connected step-line, not floating dots (SC-003)", () => {
  it("draws at least one connector segment between session peaks", () => {
    render(<TodayMiniTrend seqs={DAY} />);
    expect(screen.getAllByTestId("mini-connector").length).toBeGreaterThanOrEqual(1);
  });

  it("each readable session is a peak segment (a line), not a bare dot", () => {
    render(<TodayMiniTrend seqs={DAY} />);
    expect(screen.getByTestId("mini-seg-m").tagName.toLowerCase()).toBe("polyline");
    expect(screen.getByTestId("mini-seg-a").tagName.toLowerCase()).toBe("polyline");
  });
});

describe("TodayMiniTrend — no-read honesty (SC-010: never the calm line)", () => {
  it("a no-read session is a hollow marker on the low lane, never on the calm line", () => {
    render(<TodayMiniTrend seqs={DAY} />);
    const marker = screen.getByTestId("mini-noread-late");
    expect(marker.getAttribute("fill")).toBe("none"); // hollow
    expect(Number(marker.getAttribute("cy"))).toBe(MINI_Y.no_read); // its own low lane
    expect(Number(marker.getAttribute("cy"))).not.toBe(MINI_Y.at_ease);
    expect(screen.queryByTestId("mini-seg-late")).toBeNull(); // not on the calm line
  });
});
