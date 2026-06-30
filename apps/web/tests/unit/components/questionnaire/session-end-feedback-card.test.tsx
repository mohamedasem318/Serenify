import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

import {
  SessionEndFeedbackCard,
  type SessionEndFeedbackCardProps,
} from "@/components/questionnaire/session-end-feedback-card";

type SaveFn = NonNullable<SessionEndFeedbackCardProps["save"]>;

/**
 * T039 — session-end card states, exact copy, free-text validation, tailored route actions,
 * and SC-007 (every path reaches its end state in ≤3 interactions after the card appears).
 */

function setup() {
  const save = vi.fn<SaveFn>(async () => ({ ok: true as const, data: { id: "f1" } }));
  const navigate = vi.fn();
  const onResolved = vi.fn();
  render(
    <SessionEndFeedbackCard
      userId="u1"
      monitoringSessionId="s1"
      save={save}
      navigate={navigate}
      onResolved={onResolved}
    />,
  );
  return { save, navigate, onResolved, user: userEvent.setup() };
}

describe("SessionEndFeedbackCard initial + endings", () => {
  it("shows the heading and the three initial actions", () => {
    setup();
    expect(screen.getByText("How did that check-in feel?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Good/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Something was off/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skip/ })).toBeInTheDocument();
  });

  it("Good → meadow smiley success in ONE interaction (SC-007)", async () => {
    const { save, user, onResolved } = setup();
    await user.click(screen.getByRole("button", { name: /Good/ }));
    expect(screen.getByText("Glad that helped.")).toBeInTheDocument();
    expect(screen.getByTestId("questionnaire-result")).toHaveAttribute("data-kind", "smiley");
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ status: "submitted", sentiment: "good", monitoringSessionId: "s1" }),
    );
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("Skip → muted wind in ONE interaction (SC-007)", async () => {
    const { save, user } = setup();
    await user.click(screen.getByRole("button", { name: /Skip/ }));
    expect(screen.getByText("No problem — another time.")).toBeInTheDocument();
    expect(screen.getByTestId("questionnaire-result")).toHaveAttribute("data-kind", "muted");
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ status: "skipped" }));
    const payload = save.mock.calls[0]![0];
    expect("sentiment" in payload).toBe(false);
  });

  it("exposes exactly the four negative reasons", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Something was off/ }));
    expect(screen.getByText("Got it. What felt off?")).toBeInTheDocument();
    for (const label of [
      "The suggestion didn't help",
      "I just needed quiet time",
      "The chatbot felt too robotic",
      "Something else",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(label.replace(/'/g, "."), "i") })).toBeInTheDocument();
    }
  });

  it("suggestion_didnt_help records in TWO interactions and offers the preferences route (SC-007)", async () => {
    const { save, navigate, user } = setup();
    await user.click(screen.getByRole("button", { name: /Something was off/ })); // 1
    await user.click(screen.getByRole("button", { name: /suggestion didn.t help/i })); // 2
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ status: "submitted", sentiment: "off", reason: "suggestion_didnt_help" }),
    );
    await user.click(screen.getByRole("button", { name: /Update preferences/i }));
    expect(navigate).toHaveBeenCalledWith("/app/account");
  });

  it("needed_quiet records and routes to the notifications anchor (SC-007)", async () => {
    const { save, navigate, user } = setup();
    await user.click(screen.getByRole("button", { name: /Something was off/ }));
    await user.click(screen.getByRole("button", { name: /needed quiet time/i }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ reason: "needed_quiet" }));
    await user.click(screen.getByRole("button", { name: /Notification settings/i }));
    expect(navigate).toHaveBeenCalledWith("/app/account#notifications");
  });

  it("ren_too_robotic shows the product-feedback note and never routes to Ren", async () => {
    const { save, navigate, user } = setup();
    await user.click(screen.getByRole("button", { name: /Something was off/ }));
    await user.click(screen.getByRole("button", { name: /too.robotic/i }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ reason: "ren_too_robotic" }));
    expect(screen.getByText(/not sent to\s+Ren/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("free text requires non-empty trimmed text, then records in THREE interactions (SC-007)", async () => {
    const { save, user } = setup();
    await user.click(screen.getByRole("button", { name: /Something was off/ })); // 1
    await user.click(screen.getByRole("button", { name: /Something else/i })); // 2
    const send = screen.getByRole("button", { name: /Send/i });
    expect(send).toBeDisabled(); // empty → no submit
    await user.type(screen.getByLabelText("Tell us what felt off"), "   ");
    expect(send).toBeDisabled(); // whitespace only → still no submit
    await user.clear(screen.getByLabelText("Tell us what felt off"));
    await user.type(screen.getByLabelText("Tell us what felt off"), "the timing felt random");
    await user.click(screen.getByRole("button", { name: /Send/i })); // 3
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "something_else", freeText: "the timing felt random" }),
    );
  });

  it("uses no crimson on this surface", () => {
    const { container } = render(
      <SessionEndFeedbackCard userId="u" monitoringSessionId="s" save={vi.fn()} navigate={vi.fn()} />,
    );
    expect(container.querySelector('[class*="crimson"]')).toBeNull();
  });
});
