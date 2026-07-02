import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

import { WeeklyCheckInCard } from "@/components/questionnaire/weekly-check-in-card";

/**
 * T048 — weekly stepper accessibility: focus moves to Q2 on Q1 selection, the progress bar
 * exposes correct `role="progressbar"` ARIA, the step is announced via a polite live region,
 * and Back / Done are native, keyboard-reachable buttons.
 */

function setup() {
  render(
    <WeeklyCheckInCard userId="u" isoWeekStart="2026-06-29" submit={vi.fn()} recordCadence={vi.fn()} />,
  );
  return userEvent.setup();
}

describe("weekly stepper accessibility", () => {
  it("moves focus to the Q2 heading after a Q1 selection", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /Could be better/ }));
    await user.click(screen.getByRole("button", { name: /Unclear instructions/i }));
    expect(screen.getByText("What support would have made this week better?")).toHaveFocus();
  });

  it("exposes a progressbar with min/max/now and step text", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /Could be better/ }));
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemin", "1");
    expect(bar).toHaveAttribute("aria-valuemax", "2");
    expect(bar).toHaveAttribute("aria-valuenow", "1");
    expect(bar).toHaveAttribute("aria-valuetext", "Step 1 of 2");
    // advancing updates the step
    await user.click(screen.getByRole("button", { name: /Unclear instructions/i }));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "Step 2 of 2");
  });

  it("announces the current step through a polite live region", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /Could be better/ }));
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Step 1 of 2");
    await user.click(screen.getByRole("button", { name: /Unclear instructions/i }));
    expect(screen.getByRole("status")).toHaveTextContent("Step 2 of 2");
  });

  it("Back and Done are native, keyboard-focusable buttons", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /Could be better/ }));
    await user.click(screen.getByRole("button", { name: /Unclear instructions/i }));
    const back = screen.getByRole("button", { name: /^Back/ });
    const done = screen.getByRole("button", { name: /^Done/ });
    expect(back.tagName).toBe("BUTTON");
    expect(done.tagName).toBe("BUTTON");
    back.focus();
    expect(back).toHaveFocus();
  });
});
