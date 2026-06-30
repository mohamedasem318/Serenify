import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

import {
  WeeklyCheckInCard,
  type WeeklyCheckInCardProps,
} from "@/components/questionnaire/weekly-check-in-card";

type SubmitFn = NonNullable<WeeklyCheckInCardProps["submit"]>;
type CadenceFn = NonNullable<WeeklyCheckInCardProps["recordCadence"]>;

/**
 * T047 — weekly card: Good, Skip, could-be-better entry, exact Q1/Q2 options, Back, disabled
 * Done, Done completion, and NO contribution on skip / abandoned Q2.
 */

function setup() {
  const submit = vi.fn<SubmitFn>(async () => ({ ok: true as const, data: null }));
  const recordCadence = vi.fn<CadenceFn>(async () => ({ ok: true as const, data: null }));
  const onResolved = vi.fn();
  render(
    <WeeklyCheckInCard
      userId="u1"
      isoWeekStart="2026-06-29"
      cadence={null}
      submit={submit}
      recordCadence={recordCadence}
      onResolved={onResolved}
    />,
  );
  return { submit, recordCadence, onResolved, user: userEvent.setup() };
}

describe("WeeklyCheckInCard", () => {
  it("shows the heading and initial actions", () => {
    setup();
    expect(screen.getByText("How has the work environment felt lately?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Good/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Could be better/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skip/ })).toBeInTheDocument();
  });

  it("Good submits sentiment=good and shows the meadow smiley", async () => {
    const { submit, user } = setup();
    await user.click(screen.getByRole("button", { name: /^Good/ }));
    expect(submit).toHaveBeenCalledWith({ isoWeekStart: "2026-06-29", sentiment: "good" });
    expect(screen.getByText("Glad the week's been good.")).toBeInTheDocument();
    expect(screen.getByTestId("questionnaire-result")).toHaveAttribute("data-kind", "smiley");
  });

  it("Skip records cadence only — NO contribution — and shows the muted wind", async () => {
    const { submit, recordCadence, user } = setup();
    await user.click(screen.getByRole("button", { name: /Skip/ }));
    expect(recordCadence).toHaveBeenCalledTimes(1);
    expect(recordCadence.mock.calls[0]![0]).toMatchObject({ skippedCount: 1, isoWeekStart: "2026-06-29" });
    expect(submit).not.toHaveBeenCalled(); // no aggregate contribution on skip
    expect(screen.getByText("All good — we'll ask again next week.")).toBeInTheDocument();
    expect(screen.getByTestId("questionnaire-result")).toHaveAttribute("data-kind", "muted");
  });

  it("Could be better opens Q1 with exactly three roadblocks", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Could be better/ }));
    expect(screen.getByText("What was your biggest roadblock?")).toBeInTheDocument();
    for (const label of [
      "Unclear instructions or goals",
      "Waiting on other team members",
      "Software or tools crashing",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(label, "i") })).toBeInTheDocument();
    }
  });

  it("Q1 auto-advances to Q2 with exactly four support options", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Could be better/ }));
    await user.click(screen.getByRole("button", { name: /Unclear instructions/i }));
    expect(screen.getByText("What support would have made this week better?")).toBeInTheDocument();
    for (const label of [
      "Deadline flexibility",
      "Better team alignment or communication",
      "A quieter workspace",
      "Better technical equipment",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(label, "i") })).toBeInTheDocument();
    }
  });

  it("Back returns to Q1 without submitting", async () => {
    const { submit, user } = setup();
    await user.click(screen.getByRole("button", { name: /Could be better/ }));
    await user.click(screen.getByRole("button", { name: /Unclear instructions/i }));
    await user.click(screen.getByRole("button", { name: /^Back/ }));
    expect(screen.getByText("What was your biggest roadblock?")).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("Done is disabled until a support is chosen, then submits the identity-stripped contribution", async () => {
    const { submit, user } = setup();
    await user.click(screen.getByRole("button", { name: /Could be better/ }));
    await user.click(screen.getByRole("button", { name: /Waiting on other team members/i }));
    const done = screen.getByRole("button", { name: /^Done/ });
    expect(done).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /quieter workspace/i }));
    expect(done).toBeEnabled();
    await user.click(done);
    expect(submit).toHaveBeenCalledWith({
      isoWeekStart: "2026-06-29",
      sentiment: "could_be_better",
      roadblock: "waiting_on_other_team_members",
      support: "quieter_workspace",
    });
    expect(screen.getByText("Heard — thanks for speaking up.")).toBeInTheDocument();
    expect(screen.getByTestId("questionnaire-result")).toHaveAttribute("data-kind", "check");
  });

  it("an abandoned Q2 (no Done) creates no contribution", async () => {
    const { submit, user } = setup();
    await user.click(screen.getByRole("button", { name: /Could be better/ }));
    await user.click(screen.getByRole("button", { name: /Software or tools crashing/i }));
    // user leaves without pressing Done → nothing submitted
    expect(submit).not.toHaveBeenCalled();
  });

  it("shows the manager-aggregate privacy footer", () => {
    setup();
    expect(
      screen.getByText(/Only an anonymized team-level summary reaches your manager/i),
    ).toBeInTheDocument();
  });

  it("uses no crimson on this surface", () => {
    const { container } = render(
      <WeeklyCheckInCard userId="u" isoWeekStart="2026-06-29" submit={vi.fn()} recordCadence={vi.fn()} />,
    );
    expect(container.querySelector('[class*="crimson"]')).toBeNull();
  });
});
