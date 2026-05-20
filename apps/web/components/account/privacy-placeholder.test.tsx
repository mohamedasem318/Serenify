import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PrivacyPlaceholder } from "@/components/account/privacy-placeholder";

describe("PrivacyPlaceholder", () => {
  it("renders the Privacy heading", () => {
    render(<PrivacyPlaceholder />);
    expect(
      screen.getByRole("heading", { name: "Privacy", level: 2 }),
    ).toBeInTheDocument();
  });

  it("exposes a note landmark with the transparency-view copy", () => {
    render(<PrivacyPlaceholder />);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(/transparency view/i);
  });

  it("renders no live controls (no buttons, no inputs, no checkboxes)", () => {
    render(<PrivacyPlaceholder />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("contains no exclamation marks in the copy (calm voice)", () => {
    render(<PrivacyPlaceholder />);
    expect(document.body.textContent).not.toMatch(/!/);
  });
});
