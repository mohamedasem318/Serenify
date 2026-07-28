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

  /**
   * 2026-07-29 — the app header is sticky, matching the public navbar in both directions.
   *
   * ASSERTED ON THE CLASS LIST, and that is a deliberate limitation rather than a shortcut.
   * happy-dom does not run the Tailwind build, so there is no computed `position` to read;
   * the class list is the honest thing available here. The rendered behaviour — what
   * actually passes underneath, and at which viewport heights — was measured in real
   * Chromium and is recorded in `header.tsx`'s comment and in docs/DECISIONS.md, because
   * this route is authed and `playwright.layout.config.ts` cannot reach it.
   */
  describe("stickiness (2026-07-29)", () => {
    function bannerClass(): string {
      renderHeader();
      return screen.getByRole("banner").className;
    }

    it("pins to the top of the viewport", () => {
      const cls = bannerClass();
      expect(cls).toMatch(/\bsticky\b/);
      expect(cls).toMatch(/\btop-0\b/);
    });

    it("sits at z-50, the same layer as the public navbar", () => {
      expect(bannerClass()).toMatch(/\bz-50\b/);
    });

    it("keeps an OPAQUE background — a sticky bar must cover, not veil", () => {
      // The public navbar's translucency was dropped in the same change for this reason.
      // `bg-bg` was already here; this asserts nobody swaps it for a tinted or
      // alpha-composited value later.
      const cls = bannerClass();
      expect(cls).toMatch(/\bbg-bg\b/);
      expect(cls).not.toMatch(/backdrop-blur/);
      expect(cls).not.toMatch(/\/\d{1,2}\b/); // no `bg-bg/80`-style alpha suffix
    });

    it("keeps the 64 px height the public navbar matches", () => {
      expect(bannerClass()).toMatch(/\bh-16\b/);
    });
  });
});
