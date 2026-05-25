import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
}));

import { MobileMenu } from "@/components/header/mobile-menu";

describe("MobileMenu", () => {
  it("renders the menu trigger button with an accessible label", () => {
    render(<MobileMenu />);
    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
  });

  it("opens the sheet on click and reveals the Home destination", async () => {
    const user = userEvent.setup();
    render(<MobileMenu />);
    await user.click(screen.getByLabelText("Open menu"));
    const home = screen.getByRole("link", { name: "Home" });
    expect(home).toHaveAttribute("href", "/app");
  });

  it("does not render the workflow nav until the sheet is opened", () => {
    render(<MobileMenu />);
    expect(
      screen.queryByRole("link", { name: "Home" }),
    ).not.toBeInTheDocument();
  });
});
