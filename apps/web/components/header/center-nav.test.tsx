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

/**
 * The pill treatment, asserted as CONCRETE PROPERTIES rather than by comparing this
 * component's class string to `PublicDesktopNav`'s.
 *
 * A string comparison between the two components would pass whenever both drift together,
 * which is the failure mode that matters here — the two are meant to stay identical, so a
 * change is overwhelmingly likely to be applied to both at once. The mirror-image block in
 * `tests/unit/components/public/public-shell.test.tsx` asserts the same three facts
 * independently, so either file fails on its own if either component moves.
 */
describe("CenterNav — the pill treatment (2026-07-29)", () => {
  beforeEach(() => {
    mockPathname = "/app";
  });

  function pill(name: string): HTMLElement {
    return screen.getByRole("link", { name });
  }

  it("gives every destination a 44 px tap target", () => {
    // Raised from h-9 (36 px) on 2026-07-29. This row was the only sub-44px interactive
    // element in the header — the avatar button beside it has always been 44. FR-053
    // requires 44 px on the public surface and its one exception is spent, so parity with
    // that row had to be reached by raising this one.
    render(<CenterNav role="employee" />);
    for (const label of ["Home", "Chat"]) {
      expect(pill(label).className).toMatch(/\bh-11\b/);
      expect(pill(label).className).not.toMatch(/\bh-9\b/);
    }
  });

  it("marks the current destination with bg-surface", () => {
    render(<CenterNav role="employee" />);
    expect(pill("Home").className).toMatch(/\bbg-surface\b/);
  });

  it("leaves non-current destinations without the active fill", () => {
    render(<CenterNav role="employee" />);
    const chat = pill("Chat").className;
    // `hover:bg-surface` is present on every pill and must not be mistaken for the
    // active fill, so match the bare utility rather than a substring.
    expect(chat.split(/\s+/)).not.toContain("bg-surface");
  });

  it("carries no underline on any destination, current or not", () => {
    // The public nav's underline was dropped on 2026-07-29 so the two bars render
    // identically; this asserts the app nav never grows one either, which would
    // re-open the divergence from the other side.
    render(<CenterNav role="employee" />);
    for (const label of ["Home", "Chat"]) {
      expect(pill(label).className).not.toMatch(/\bunderline\b/);
    }
  });

  it("uses rounded-md and the ink resting colour", () => {
    render(<CenterNav role="employee" />);
    for (const label of ["Home", "Chat"]) {
      expect(pill(label).className).toMatch(/\brounded-md\b/);
      expect(pill(label).className).toMatch(/\btext-ink\b/);
    }
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
