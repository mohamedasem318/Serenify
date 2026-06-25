import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SessionTrend } from "@/components/monitor/session-trend";
import type { SessionTrendPoint } from "@/lib/api/monitoring-reads";
import type { Band } from "@/lib/api/monitoring-client";

/**
 * Feature 010 / 009b — US1 (T013). The redesigned live "This session" trend:
 *   SC-001/SC-002 fixed-px (svg width === viewBox width; no preserveAspectRatio stretch → a
 *                 TRUE circle) at 360px AND ~768px; fills the measured container.
 *   SC-003 step-line colour = band.
 *   SC-011 (live) the now marker recolours to the current band.
 *   FR-017 no number anywhere.
 * happy-dom has no layout engine, so the container width is stubbed via getBoundingClientRect.
 */

// happy-dom may not define ResizeObserver; the component's initial measure() covers the width.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

const origRect = HTMLElement.prototype.getBoundingClientRect;
afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = origRect;
});

const NOW = Date.UTC(2026, 5, 25, 12, 0, 0);
const at = (secsAgo: number) => new Date(NOW - secsAgo * 1000).toISOString();
const pt = (
  id: string,
  band: Band | null,
  secsAgo: number,
  skipCause: SessionTrendPoint["skipCause"] = null,
): SessionTrendPoint => ({ id, band, scored: band !== null, skipCause, capturedAt: at(secsAgo) });

const renderTrend = (points: SessionTrendPoint[], width = 768) => {
  HTMLElement.prototype.getBoundingClientRect = function () {
    return { width, height: 210, top: 0, left: 0, right: width, bottom: 210, x: 0, y: 0, toJSON() {} } as DOMRect;
  };
  return render(<SessionTrend sessionId="s1" active={false} load={async () => points} now={() => NOW} />);
};

const NO_DIGIT = /[0-9]/;

describe("SessionTrend — fixed-px, true circle (SC-001/SC-002)", () => {
  it("sets svg width === viewBox width with NO preserveAspectRatio stretch (~768px)", async () => {
    renderTrend([pt("a", "at_ease", 20), pt("b", "tense", 0)], 768);
    const svg = await screen.findByTestId("session-trend-svg");
    expect(svg.getAttribute("width")).toBe("768");
    expect(svg.getAttribute("viewBox")).toBe("0 0 768 210");
    expect(svg.getAttribute("preserveAspectRatio")).toBeNull();
  });

  it("holds the matched-pair width at the 360px floor too", async () => {
    renderTrend([pt("a", "at_ease", 20), pt("b", "tense", 0)], 360);
    const svg = await screen.findByTestId("session-trend-svg");
    expect(svg.getAttribute("width")).toBe("360");
    expect(svg.getAttribute("viewBox")).toBe("0 0 360 210");
  });

  it("the now marker is a true <circle> element (1:1, no oval)", async () => {
    renderTrend([pt("a", "at_ease", 10), pt("b", "tense", 0)]);
    const dot = await screen.findByTestId("now-dot");
    expect(dot.tagName.toLowerCase()).toBe("circle");
  });
});

describe("SessionTrend — step-line colour encodes band (SC-003)", () => {
  it("draws coloured segments for a multi-band run", async () => {
    renderTrend([pt("a", "at_ease", 30), pt("b", "at_ease", 20), pt("c", "a_little_tense", 10), pt("d", "tense", 0)]);
    await screen.findByTestId("session-trend-svg");
    const segs = screen.getAllByTestId("trend-seg");
    expect(segs.length).toBeGreaterThanOrEqual(1);
    expect(segs.some((s) => s.getAttribute("stroke") === "var(--color-amber)")).toBe(true);
  });
});

describe("SessionTrend — now marker recolours to the current band (SC-011 live)", () => {
  it("amber on a tense live edge", async () => {
    renderTrend([pt("a", "at_ease", 10), pt("b", "tense", 0)]);
    const dot = await screen.findByTestId("now-dot");
    expect(dot.getAttribute("fill")).toBe("var(--color-amber)");
  });
  it("meadow on an at-ease live edge", async () => {
    renderTrend([pt("a", "tense", 10), pt("b", "at_ease", 0)]);
    const dot = await screen.findByTestId("now-dot");
    expect(dot.getAttribute("fill")).toBe("var(--color-meadow)");
  });
});

describe("SessionTrend — no number anywhere (FR-017)", () => {
  it("renders zero digits in the card text", async () => {
    renderTrend([pt("a", "at_ease", 10), pt("b", "tense", 0)]);
    await screen.findByTestId("session-trend-svg");
    expect(screen.getByTestId("session-trend").textContent ?? "").not.toMatch(NO_DIGIT);
  });
});

describe("SessionTrend — empty (zero trend points, FR-018)", () => {
  it("shows the text-only building state and no svg", async () => {
    renderTrend([]);
    expect(await screen.findByTestId("session-trend-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("session-trend-svg")).toBeNull();
  });
});
