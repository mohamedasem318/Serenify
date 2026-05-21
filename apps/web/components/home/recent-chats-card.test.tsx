import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { RecentChatsCard } from "@/components/home/recent-chats-card";

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

describe("RecentChatsCard", () => {
  it("renders the 'Recent chats' heading", () => {
    render(<RecentChatsCard />);
    expect(screen.getByText(/Recent chats/i)).toBeInTheDocument();
  });

  it("uses no exclamation marks (calm-voice rubric)", () => {
    render(<RecentChatsCard />);
    expect(document.body.textContent ?? "").not.toMatch(/!/);
  });

  it("uses no words from the alarmist / clinical blocklist", () => {
    render(<RecentChatsCard />);
    const text = (document.body.textContent ?? "").toLowerCase();
    for (const word of ALARMIST_BLOCKLIST) {
      expect(text, `blocklist hit: "${word}"`).not.toMatch(
        new RegExp(`\\b${word}\\b`, "i"),
      );
    }
  });
});
