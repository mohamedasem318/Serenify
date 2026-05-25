import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ThingsThatMightHelpCard } from "@/components/home/things-that-might-help-card";

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

describe("ThingsThatMightHelpCard", () => {
  it("renders the 'Things that might help' heading", () => {
    render(<ThingsThatMightHelpCard />);
    expect(screen.getByText(/Things that might help/i)).toBeInTheDocument();
  });

  it("uses no exclamation marks (calm-voice rubric)", () => {
    render(<ThingsThatMightHelpCard />);
    expect(document.body.textContent ?? "").not.toMatch(/!/);
  });

  it("uses no words from the alarmist / clinical blocklist", () => {
    render(<ThingsThatMightHelpCard />);
    const text = (document.body.textContent ?? "").toLowerCase();
    for (const word of ALARMIST_BLOCKLIST) {
      expect(text, `blocklist hit: "${word}"`).not.toMatch(
        new RegExp(`\\b${word}\\b`, "i"),
      );
    }
  });
});
