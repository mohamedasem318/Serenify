import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { TodaysCheckinCard } from "@/components/home/todays-checkin-card";

const ALARMIST_BLOCKLIST = [
  "stress",
  "stressed",
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
