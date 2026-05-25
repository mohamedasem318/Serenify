import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { NotificationsPlaceholder } from "@/components/account/notifications-placeholder";

describe("NotificationsPlaceholder", () => {
  it("renders the Notifications heading", () => {
    render(<NotificationsPlaceholder />);
    expect(
      screen.getByRole("heading", { name: "Notifications", level: 2 }),
    ).toBeInTheDocument();
  });

  it("exposes a note landmark with the deferral copy", () => {
    render(<NotificationsPlaceholder />);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(/later release/i);
  });

  it("renders no live controls (no buttons, no inputs, no toggles)", () => {
    render(<NotificationsPlaceholder />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("contains no exclamation marks in the copy (calm voice)", () => {
    render(<NotificationsPlaceholder />);
    expect(document.body.textContent).not.toMatch(/!/);
  });
});
