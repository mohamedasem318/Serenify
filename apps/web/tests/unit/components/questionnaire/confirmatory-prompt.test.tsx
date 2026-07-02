import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Notification reads useMediaQuery; pin it false (desktop, full motion) for a stable DOM.
vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

import { ConfirmatoryPrompt } from "@/components/questionnaire/confirmatory-prompt";

/**
 * T030 — the confirmatory prompt copy, ordering, color roles, icons, and 44px targets.
 * Calm-first (Principle V): amber on the stress-confirm affordance, meadow on the calm
 * "I'm okay", foggy on the talk option — and NO crimson anywhere on this surface.
 */

function renderPrompt(handlers: Partial<Parameters<typeof ConfirmatoryPrompt>[0]> = {}) {
  const onConfirm = vi.fn();
  const onFalseAlarm = vi.fn();
  const onOpenChat = vi.fn();
  render(
    <ConfirmatoryPrompt
      open
      onConfirm={onConfirm}
      onFalseAlarm={onFalseAlarm}
      onOpenChat={onOpenChat}
      {...handlers}
    />,
  );
  return { onConfirm, onFalseAlarm, onOpenChat };
}

describe("ConfirmatoryPrompt", () => {
  it("renders the exact heading and body copy", async () => {
    renderPrompt();
    expect(await screen.findByText("Checking in")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your signals have looked tense for a little while. Is that how you're feeling?",
      ),
    ).toBeInTheDocument();
  });

  it("renders the three answer options as native buttons in spec order", async () => {
    renderPrompt();
    await screen.findByText("Checking in");
    const labels = ["Yes, that's me", "No, I'm okay", "Maybe — talk about it"];
    const buttons = labels.map((l) => screen.getByRole("button", { name: l }));
    buttons.forEach((b) => expect(b.tagName).toBe("BUTTON"));
    // DOM order matches the spec order.
    const order = screen
      .getAllByRole("button")
      .filter((b) => labels.includes(b.textContent?.trim() ?? ""))
      .map((b) => b.textContent?.trim());
    expect(order).toEqual(labels);
  });

  it("has no close/dismiss button (answer-only)", async () => {
    renderPrompt();
    await screen.findByText("Checking in");
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });

  it("wires each option to its handler", async () => {
    const user = userEvent.setup();
    const { onConfirm, onFalseAlarm, onOpenChat } = renderPrompt();
    await screen.findByText("Checking in");
    await user.click(screen.getByRole("button", { name: "Yes, that's me" }));
    await user.click(screen.getByRole("button", { name: "No, I'm okay" }));
    await user.click(screen.getByRole("button", { name: "Maybe — talk about it" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onFalseAlarm).toHaveBeenCalledTimes(1);
    expect(onOpenChat).toHaveBeenCalledTimes(1);
  });

  it("applies calm-first color roles to the option icons (amber/meadow/foggy)", async () => {
    renderPrompt();
    await screen.findByText("Checking in");
    const iconClass = (name: string) =>
      screen.getByRole("button", { name }).querySelector("svg")?.getAttribute("class") ?? "";
    expect(iconClass("Yes, that's me")).toContain("text-amber");
    expect(iconClass("No, I'm okay")).toContain("text-meadow");
    expect(iconClass("Maybe — talk about it")).toContain("text-foggy");
  });

  it("keeps every option at a 44px minimum target", async () => {
    renderPrompt();
    await screen.findByText("Checking in");
    for (const name of ["Yes, that's me", "No, I'm okay", "Maybe — talk about it"]) {
      expect(screen.getByRole("button", { name }).className).toContain("min-h-11");
    }
  });

  it("uses NO crimson on this affective surface", async () => {
    const { container } = render(
      <ConfirmatoryPrompt open onConfirm={vi.fn()} onFalseAlarm={vi.fn()} onOpenChat={vi.fn()} />,
    );
    await screen.findByText("Checking in");
    expect(document.body.querySelector('[class*="crimson"]')).toBeNull();
    void container;
  });
});
