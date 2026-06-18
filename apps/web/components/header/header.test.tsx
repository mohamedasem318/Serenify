import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/header/center-nav", () => ({
  CenterNav: () => <div data-testid="center-nav" />,
}));
vi.mock("@/components/header/mobile-menu", () => ({
  MobileMenu: () => <div data-testid="mobile-menu" />,
}));
vi.mock("@/components/header/profile-dropdown", () => ({
  ProfileDropdown: () => <div data-testid="profile-dropdown" />,
}));
vi.mock("@/app/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

import { Header } from "@/components/header/header";

function renderHeader() {
  return render(
    <Header
      fullName="Jane Doe"
      email="jane@demo.serenify.local"
      role="employee"
    />,
  );
}

describe("Header", () => {
  it("renders the serenify wordmark linked to /app with an accessible label", () => {
    renderHeader();
    const link = screen.getByLabelText("Go to home");
    expect(link).toHaveAttribute("href", "/app");
    expect(link).toHaveTextContent("serenify");
  });

  it("renders the CenterNav and MobileMenu slots", () => {
    renderHeader();
    expect(screen.getByTestId("center-nav")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-menu")).toBeInTheDocument();
  });

  it("renders the right cluster with exactly two children: ThemeToggle then ProfileDropdown", () => {
    renderHeader();
    const themeToggle = screen.getByTestId("theme-toggle");
    const profileDropdown = screen.getByTestId("profile-dropdown");
    const rightCluster = themeToggle.parentElement!;
    expect(rightCluster).toBe(profileDropdown.parentElement);
    expect(rightCluster.childElementCount).toBe(2);
    expect(rightCluster.children[0]).toBe(themeToggle);
    expect(rightCluster.children[1]).toBe(profileDropdown);
  });

  it("renders inside a <header> landmark", () => {
    renderHeader();
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });
});
