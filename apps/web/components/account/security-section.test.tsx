import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SecuritySection } from "@/components/account/security-section";

describe("SecuritySection", () => {
  it("renders the Security heading", () => {
    render(<SecuritySection />);
    expect(
      screen.getByRole("heading", { name: "Security", level: 2 }),
    ).toBeInTheDocument();
  });

  it("links 'Change password' to /forgot-password", () => {
    render(<SecuritySection />);
    const link = screen.getByRole("link", { name: "Change password" });
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  it("does not render an inline password form", () => {
    render(<SecuritySection />);
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /password/i }),
    ).not.toBeInTheDocument();
  });
});
