import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChatPill, CHAT_PILL_HEIGHT } from "@/components/chat-pill";

describe("ChatPill — rendering", () => {
  it("exports a 48px height constant matching FR-025's 44px touch-target floor", () => {
    expect(CHAT_PILL_HEIGHT).toBe(48);
    expect(CHAT_PILL_HEIGHT).toBeGreaterThanOrEqual(44);
  });

  it("renders a button with the 'Chat' accessible name", () => {
    render(<ChatPill />);
    expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
  });

  it("carries the data-testid hook for the Playwright employee-shell spec", () => {
    render(<ChatPill />);
    expect(screen.getByTestId("chat-pill")).toBeInTheDocument();
  });

  it("anchors itself bottom-right with the documented fixed-position classes", () => {
    render(<ChatPill />);
    const pill = screen.getByTestId("chat-pill");
    expect(pill.className).toMatch(/\bfixed\b/);
    expect(pill.className).toMatch(/\bbottom-4\b/);
    expect(pill.className).toMatch(/\bright-4\b/);
  });

  it("uses a button type=button so it cannot accidentally submit an enclosing form", () => {
    render(<ChatPill />);
    expect(screen.getByTestId("chat-pill")).toHaveAttribute("type", "button");
  });
});

describe("ChatPill — true no-op click (FR-024)", () => {
  it("does not throw, navigate, or spawn a popover when clicked", async () => {
    const user = userEvent.setup();
    render(<ChatPill />);
    const pill = screen.getByTestId("chat-pill");

    // baseline: capture the DOM size before the click.
    const beforeBodyChildren = document.body.childElementCount;
    const beforeDialogs = document.querySelectorAll(
      '[role="dialog"], [role="menu"], [data-state="open"]',
    ).length;

    await user.click(pill);

    // No popover, dialog, or open menu materialised.
    expect(
      document.querySelectorAll(
        '[role="dialog"], [role="menu"], [data-state="open"]',
      ).length,
    ).toBe(beforeDialogs);
    // No additional top-level nodes (no portal target added by a popover lib).
    expect(document.body.childElementCount).toBe(beforeBodyChildren);
    // The pill itself is still mounted - the click did not unmount it.
    expect(screen.getByTestId("chat-pill")).toBeInTheDocument();
  });
});

describe("ChatPill — --chat-pill-offset lifecycle (Decision H / DECISION-11)", () => {
  it("sets --chat-pill-offset to 48px on <html> on mount", () => {
    const before = document.documentElement.style.getPropertyValue(
      "--chat-pill-offset",
    );
    expect(before).toBe("");

    render(<ChatPill />);

    expect(
      document.documentElement.style.getPropertyValue("--chat-pill-offset"),
    ).toBe(`${CHAT_PILL_HEIGHT}px`);
    expect(
      document.documentElement.style.getPropertyValue("--chat-pill-offset"),
    ).toBe("48px");
  });

  it("removes --chat-pill-offset from <html> on unmount", () => {
    const { unmount } = render(<ChatPill />);
    // Sanity: set during mount.
    expect(
      document.documentElement.style.getPropertyValue("--chat-pill-offset"),
    ).toBe("48px");

    unmount();

    expect(
      document.documentElement.style.getPropertyValue("--chat-pill-offset"),
    ).toBe("");
  });

  it("cleans up between Vitest renders (no cross-test variable leak)", () => {
    render(<ChatPill />);
    expect(
      document.documentElement.style.getPropertyValue("--chat-pill-offset"),
    ).toBe("48px");
    cleanup();
    expect(
      document.documentElement.style.getPropertyValue("--chat-pill-offset"),
    ).toBe("");
  });
});
