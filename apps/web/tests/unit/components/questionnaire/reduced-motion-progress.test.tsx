import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mq } = vi.hoisted(() => ({ mq: vi.fn(() => true) }));
vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => mq() }));

import { WeeklyCheckInCard } from "@/components/questionnaire/weekly-check-in-card";

/** T055 — the weekly progress fill updates WITHOUT a transition under reduced motion. */

afterEach(cleanup);

async function openStepper() {
  const user = userEvent.setup();
  render(<WeeklyCheckInCard userId="u" isoWeekStart="2026-06-29" submit={vi.fn()} recordCadence={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: /Could be better/ }));
  return user;
}

describe("weekly progress fill reduced-motion", () => {
  it("omits the width transition class when reduced motion is preferred", async () => {
    mq.mockReturnValue(true);
    await openStepper();
    const fill = screen.getByTestId("weekly-progress-fill");
    expect(fill.getAttribute("class") ?? "").not.toContain("qprogress-fill");
  });

  it("applies the width transition class when motion is allowed", async () => {
    mq.mockReturnValue(false);
    await openStepper();
    const fill = screen.getByTestId("weekly-progress-fill");
    expect(fill.getAttribute("class") ?? "").toContain("qprogress-fill");
  });
});
