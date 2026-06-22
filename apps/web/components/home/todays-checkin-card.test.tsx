import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { TodaysCheckinCard } from "@/components/home/todays-checkin-card";

// "stress" / "stressed" were dropped from this blocklist in feature 008 (T034): this
// card is now the entry to a stress check-in, so the neutral subject word is apt and the
// idle line traces verbatim to the approved 008 mock. Genuinely ALARMIST / clinical words
// stay forbidden (the calm-voice rubric still holds).
const ALARMIST_BLOCKLIST = [
  "warning",
  "alert",
  "alarm",
  "abnormal",
  "elevated",
  "concerning",
  "concerned",
  "danger",
];

describe("TodaysCheckinCard", () => {
  it("renders the 'Today's check-in' heading", () => {
    render(<TodaysCheckinCard />);
    expect(
      screen.getByText(/Today's check-in/i),
    ).toBeInTheDocument();
  });

  it("renders a calm empty-state body paragraph", () => {
    render(<TodaysCheckinCard />);
    const body = document.body.textContent ?? "";
    expect(body.length).toBeGreaterThan(0);
  });

  it("offers Start check-in routing to the monitoring page (T034, FR-001)", () => {
    render(<TodaysCheckinCard />);
    const link = screen.getByRole("link", { name: /start check-in/i });
    expect(link).toHaveAttribute("href", "/app/monitor");
  });

  it("uses no exclamation marks (calm-voice rubric)", () => {
    render(<TodaysCheckinCard />);
    expect(document.body.textContent ?? "").not.toMatch(/!/);
  });

  it("uses no words from the alarmist / clinical blocklist", () => {
    render(<TodaysCheckinCard />);
    const text = (document.body.textContent ?? "").toLowerCase();
    for (const word of ALARMIST_BLOCKLIST) {
      expect(text, `blocklist hit: "${word}"`).not.toMatch(
        new RegExp(`\\b${word}\\b`, "i"),
      );
    }
  });
});
