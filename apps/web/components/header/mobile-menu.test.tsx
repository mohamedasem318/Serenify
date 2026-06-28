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

describe("MobileMenu — employee-only Chat item (FR-016)", () => {
  it("reveals a Chat link to /app/chat for employees", async () => {
    const user = userEvent.setup();
    render(<MobileMenu role="employee" />);
    await user.click(screen.getByLabelText("Open menu"));
    expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute(
      "href",
      "/app/chat",
    );
  });

  it("hides the Chat link for team leads, admins, and when no role is given", async () => {
    const user = userEvent.setup();
    for (const role of ["team_lead", "admin"] as const) {
      const { unmount } = render(<MobileMenu role={role} />);
      await user.click(screen.getByLabelText("Open menu"));
      expect(screen.queryByRole("link", { name: "Chat" })).not.toBeInTheDocument();
      unmount();
    }
    render(<MobileMenu />);
    await user.click(screen.getByLabelText("Open menu"));
    expect(screen.queryByRole("link", { name: "Chat" })).not.toBeInTheDocument();
  });
});
