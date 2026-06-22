import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SessionTrend } from "@/components/monitor/session-trend";
import type { SessionTrendPoint } from "@/lib/api/monitoring-reads";

/**
 * Feature 008 / US4 — T047 / T049. The monitor-page **this-session** live trend:
 * band→height, skipped = gap (never bridged/carried-forward, FR-029), n=1 = single dot.
 * `load` is injected and polling disabled so the assertions are deterministic.
 */

const pt = (
  id: string,
  band: SessionTrendPoint["band"],
  i: number,
  scored = band !== null,
  skipCause: SessionTrendPoint["skipCause"] = null,
): SessionTrendPoint => ({
  id,
  band,
  scored,
  skipCause,
  capturedAt: new Date(2026, 5, 21, 9, i).toISOString(),
});

const renderTrend = (points: SessionTrendPoint[]) =>
  render(<SessionTrend sessionId="s1" active={false} load={async () => points} />);

const NO_DIGIT = /[0-9]/;

describe("SessionTrend — band → height", () => {
  it("renders the 'This session' trend and draws a line for consecutive bands", async () => {
    renderTrend([pt("a", "at_ease", 0), pt("b", "a_little_tense", 1), pt("c", "tense", 2)]);
    expect(await screen.findByText(/this session/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("trend-seg").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId("session-trend-empty")).toBeNull();
  });

  it("renders no stress number anywhere (FR-015)", async () => {
    const { container } = renderTrend([pt("a", "at_ease", 0), pt("b", "tense", 1)]);
    await screen.findByText(/this session/i);
    expect(container.querySelector('[data-testid="session-trend"]')?.textContent ?? "").not.toMatch(
      NO_DIGIT,
    );
  });
});

describe("SessionTrend — skipped is a gap, never bridged (FR-029)", () => {
  it("breaks the line at a skipped window instead of carrying the last value across it", async () => {
    renderTrend([
      pt("a", "at_ease", 0),
      pt("b", "at_ease", 1),
      pt("c", null, 2, false, "low-light"), // skipped → a gap
      pt("d", "tense", 3),
      pt("e", "tense", 4),
    ]);
    await screen.findByText(/this session/i);
    // two separate segments (before and after the gap) — not one bridging line
    expect(screen.getAllByTestId("trend-seg")).toHaveLength(2);
  });
});

describe("SessionTrend — n=1 single point (FR-029)", () => {
  it("renders a single dot, not a line, for a one-reading session", async () => {
    renderTrend([pt("a", "tense", 0)]);
    await screen.findByText(/this session/i);
    expect(screen.getAllByTestId("trend-dot")).toHaveLength(1);
    expect(screen.queryByTestId("trend-seg")).toBeNull();
  });
});

describe("SessionTrend — empty (no readable band yet)", () => {
  it("shows a quiet building state when there are no confident bands", async () => {
    renderTrend([pt("a", null, 0, true), pt("b", null, 1, false, "low-light")]);
    expect(await screen.findByTestId("session-trend-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("trend-seg")).toBeNull();
    expect(screen.queryByTestId("trend-dot")).toBeNull();
  });
});
