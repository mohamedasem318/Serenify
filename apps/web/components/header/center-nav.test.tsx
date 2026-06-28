import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let mockPathname = "/app";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import { CenterNav } from "@/components/header/center-nav";

describe("CenterNav", () => {
  beforeEach(() => {
    mockPathname = "/app";
  });

  it("renders the Home destination linking to /app", () => {
    render(<CenterNav />);
    const home = screen.getByRole("link", { name: "Home" });
    expect(home).toHaveAttribute("href", "/app");
  });

  it("renders a single nav landmark labelled 'Workflow destinations'", () => {
    render(<CenterNav />);
    expect(
      screen.getByRole("navigation", { name: "Workflow destinations" }),
    ).toBeInTheDocument();
  });

  it("marks Home as the current page when pathname is /app", () => {
    mockPathname = "/app";
    render(<CenterNav />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not mark Home as current on the /app/account sub-route", () => {
    // ST-6 regression: account is reached via the profile dropdown, not the
    // Home nav pill, so Home must not light up there. Home is the root of the
    // /app namespace and uses exact matching (see DESTINATIONS `exact` flag).
    mockPathname = "/app/account";
    render(<CenterNav />);
    expect(
      screen.getByRole("link", { name: "Home" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("does not mark Home as current on a nested /app sub-route", () => {
    mockPathname = "/app/insights/overview";
    render(<CenterNav />);
    expect(
      screen.getByRole("link", { name: "Home" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("does not mark Home as current when pathname is unrelated", () => {
    mockPathname = "/onboarding";
    render(<CenterNav />);
    expect(
      screen.getByRole("link", { name: "Home" }),
    ).not.toHaveAttribute("aria-current");
  });
});

describe("CenterNav — employee-only Chat item (FR-016)", () => {
  beforeEach(() => {
    mockPathname = "/app";
  });

  it("shows a Chat link to /app/chat for employees", () => {
    render(<CenterNav role="employee" />);
    expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute("href", "/app/chat");
  });

  it("hides the Chat link for team leads and admins", () => {
    render(<CenterNav role="team_lead" />);
    expect(screen.queryByRole("link", { name: "Chat" })).not.toBeInTheDocument();
    render(<CenterNav role="admin" />);
    expect(screen.queryByRole("link", { name: "Chat" })).not.toBeInTheDocument();
  });

  it("hides the Chat link when no role is provided", () => {
    render(<CenterNav />);
    expect(screen.queryByRole("link", { name: "Chat" })).not.toBeInTheDocument();
  });

  it("marks Chat as current on /app/chat", () => {
    mockPathname = "/app/chat";
    render(<CenterNav role="employee" />);
    expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute("aria-current", "page");
  });
});
