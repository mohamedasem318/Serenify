import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TodayTimeline } from "@/components/home/today-timeline";
import type { ChipTone, RecapSession } from "@/lib/api/monitoring-reads";

/**
 * Feature 009 / US2 — the expanded timeline (FR-012 / FR-013). One row per session: number,
 * time identity, a state-coloured **pill** chip (meadow / amber-tint+amber-text / muted) from
 * the same `chipTone`/`chipLabel` the recap derives, and the local time range. The reassurance
 * line ("processed, then deleted") stays on the live monitor and MUST NOT appear here.
 */

const rs = (
  sessionId: string,
  number: number,
  timeIdentity: string,
  tenor: RecapSession["tenor"],
  chipLabel: string,
  chipTone: ChipTone,
  timeRange: string,
): RecapSession => ({
  sessionId,
  number,
  startedAt: new Date(2026, 5, 21, 9, 0).toISOString(),
  endedAt: new Date(2026, 5, 21, 9, 30).toISOString(),
  timeIdentity,
  timeRange,
  tenor,
  chipLabel,
  chipTone,
  phrase: "calm throughout",
  readLess: tenor === "no_read",
  bandCount: tenor === "no_read" ? 0 : 3,
});

const SESSIONS: RecapSession[] = [
  rs("m", 1, "Morning check-in", "at_ease", "at ease", "meadow", "8:40 – 9:30 am"),
  rs("a", 2, "Afternoon check-in", "tense", "ended tense", "amber", "1:30 – 1:52 pm"),
  rs("late", 3, "Late check-in", "no_read", "no clear read", "muted", "2:45 – 2:47 pm"),
];

describe("TodayTimeline — one state-coloured pill row per session (FR-012)", () => {
  it("renders exactly one row per session", () => {
    render(<TodayTimeline sessions={SESSIONS} />);
    expect(screen.getAllByTestId("timeline-row")).toHaveLength(SESSIONS.length);
  });

  it("each row carries its time identity, range, and a pill chip with the session's tone + label", () => {
    render(<TodayTimeline sessions={SESSIONS} />);
    const rows = screen.getAllByTestId("timeline-row");

    const amber = rows[1]!;
    expect(amber).toHaveTextContent("Afternoon check-in");
    expect(amber).toHaveTextContent("1:30 – 1:52 pm");
    const chip = within(amber).getByTestId("timeline-chip");
    expect(chip).toHaveTextContent("ended tense");
    expect(chip).toHaveAttribute("data-tone", "amber");
    // amber chip text uses the AA-safe --color-amber-text token (never the bright graphic amber)
    expect(chip.className).toMatch(/text-amber-text/);
  });

  it("maps the three tones to distinct chip roles", () => {
    render(<TodayTimeline sessions={SESSIONS} />);
    const tones = screen.getAllByTestId("timeline-chip").map((c) => c.getAttribute("data-tone"));
    expect(tones).toEqual(["meadow", "amber", "muted"]);
  });
});

describe("TodayTimeline — narrow-width rows never wrap the label mid-phrase (DC-005)", () => {
  it("keeps each session label on a single line via truncate (no mid-phrase wrap at any width)", () => {
    render(<TodayTimeline sessions={SESSIONS} />);
    // jsdom can't measure wrapping; `truncate` (white-space: nowrap + ellipsis) is the structural
    // guarantee that "Morning check-in" can never break across lines when the row is narrow. The
    // smoke confirms the stacked 2-line row by eye at 360px (number+label, then chip+time).
    for (const s of SESSIONS) {
      expect(screen.getByText(s.timeIdentity).className).toMatch(/truncate/);
    }
  });
});

describe("TodayTimeline — drops the live-monitor reassurance line (FR-013)", () => {
  it('renders no "processed, then deleted" copy', () => {
    const { container } = render(<TodayTimeline sessions={SESSIONS} />);
    expect(container.textContent?.toLowerCase()).not.toContain("processed");
    expect(container.textContent?.toLowerCase()).not.toContain("deleted");
  });
});
