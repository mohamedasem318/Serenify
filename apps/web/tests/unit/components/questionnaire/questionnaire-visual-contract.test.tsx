import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

import { ConfirmatoryPrompt } from "@/components/questionnaire/confirmatory-prompt";
import { SessionEndFeedbackCard } from "@/components/questionnaire/session-end-feedback-card";
import { WeeklyCheckInCard } from "@/components/questionnaire/weekly-check-in-card";

/**
 * T057 — the Graphite visual contract: amber ONLY on the confirmatory (stress-confirm)
 * surface, meadow on affirmative/success, foggy on neutral, NO crimson on any questionnaire
 * surface, and lucide-only icons (SVG, never emoji).
 */

afterEach(cleanup);

const hasClass = (root: ParentNode, token: string) =>
  root.querySelector(`[class*="${token}"]`) !== null;

const EMOJI = /\p{Extended_Pictographic}/u;

describe("confirmatory prompt (stress-confirm surface)", () => {
  it("uses amber (confirm), meadow (calm), foggy (talk) and no crimson", () => {
    render(<ConfirmatoryPrompt open onConfirm={vi.fn()} onFalseAlarm={vi.fn()} onOpenChat={vi.fn()} />);
    // Notification renders into a portal on <body>.
    const body = document.body;
    expect(hasClass(body, "text-amber")).toBe(true);
    expect(hasClass(body, "text-meadow")).toBe(true);
    expect(hasClass(body, "text-foggy")).toBe(true);
    expect(hasClass(body, "crimson")).toBe(false);
    // lucide icons only — SVGs present, no emoji glyphs, no <img>.
    expect(body.querySelector("svg")).not.toBeNull();
    expect(body.querySelector("img")).toBeNull();
    expect(EMOJI.test(body.textContent ?? "")).toBe(false);
  });
});

describe("session-end card (calm/neutral surface)", () => {
  it("uses meadow but NO amber and NO crimson", () => {
    const { container } = render(
      <SessionEndFeedbackCard userId="u" monitoringSessionId="s" save={vi.fn()} navigate={vi.fn()} />,
    );
    expect(hasClass(container, "text-meadow")).toBe(true); // affirmative "Good"
    expect(hasClass(container, "amber")).toBe(false); // amber is reserved for stress-confirm
    expect(hasClass(container, "crimson")).toBe(false);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(EMOJI.test(container.textContent ?? "")).toBe(false);
  });
});

describe("weekly check-in card (manager-aggregate surface)", () => {
  it("uses meadow but NO amber and NO crimson", () => {
    const { container } = render(
      <WeeklyCheckInCard userId="u" isoWeekStart="2026-06-29" submit={vi.fn()} recordCadence={vi.fn()} />,
    );
    expect(hasClass(container, "text-meadow")).toBe(true);
    expect(hasClass(container, "amber")).toBe(false);
    expect(hasClass(container, "crimson")).toBe(false);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(EMOJI.test(container.textContent ?? "")).toBe(false);
  });
});
