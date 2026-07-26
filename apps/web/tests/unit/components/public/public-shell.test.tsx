import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

// The theme toggle is the app header's component, reused here so the two bars match
// (FR-018). It owns its own accessible name and has its own coverage; stubbing it keeps
// this suite about the public shell rather than about next-themes' hydration dance.
vi.mock("@/app/theme-toggle", () => ({
  ThemeToggle: () => (
    <button type="button" aria-label="Switch to dark mode" data-testid="theme-toggle" />
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/terms",
}));

import { PUBLIC_DESTINATIONS } from "@/components/public/destinations";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicMobileNav } from "@/components/public/public-mobile-nav";
import { PublicNavbar } from "@/components/public/public-navbar";

/**
 * T034 — the public shell's accessibility and its one approved copy string
 * (SC-008/SC-009 for the shell; FR-018, FR-019, FR-023).
 *
 * The shell is the first thing a stranger meets and the only navigation a signed-out
 * visitor has, so the assertions here are about whether it can be operated at all: does
 * every control have a name a screen reader can announce, and is there anything on this
 * signed-out surface that points into the application?
 */

/** Every element a keyboard or screen reader would land on, in DOM order. */
function interactiveElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("a[href], button"));
}

/** The name a screen reader would announce: aria-label first, else the text content. */
function accessibleName(element: HTMLElement): string {
  return (element.getAttribute("aria-label") ?? element.textContent ?? "").trim();
}

describe("PublicNavbar", () => {
  it("gives every interactive element an accessible name", () => {
    const { container } = render(<PublicNavbar />);
    const elements = interactiveElements(container);

    expect(elements.length).toBeGreaterThan(0);
    for (const element of elements) {
      expect(
        accessibleName(element),
        `an interactive element in the navbar has no accessible name: ${element.outerHTML}`,
      ).not.toBe("");
    }
  });

  it("links the wordmark to / with a label that says where it goes", () => {
    render(<PublicNavbar />);
    const home = screen.getByLabelText("Serenify home");
    expect(home).toHaveAttribute("href", "/");
    expect(home).toHaveTextContent("serenify");
  });

  it("gives the wordmark link a 44 px tap target (FR-053)", () => {
    // Regression. The T036 walk measured this link at 81×24 in a real browser: the app
    // header's equivalent has the same gap, so copying the app header faithfully — which
    // FR-018 requires — reproduced the defect rather than avoiding it.
    render(<PublicNavbar />);
    expect(screen.getByLabelText("Serenify home").className).toMatch(/\bmin-h-11\b/);
  });

  it("exposes every public destination", () => {
    const { container } = render(<PublicNavbar />);
    const hrefs = Array.from(container.querySelectorAll("a[href]")).map((a) =>
      a.getAttribute("href"),
    );
    for (const { href } of PUBLIC_DESTINATIONS) {
      expect(hrefs).toContain(href);
    }
  });

  it("exposes NO dashboard or authed link anywhere (FR-018)", () => {
    // The single assertion this component exists to satisfy. The public navbar looks
    // identical to the app header, and the failure mode is somebody "de-duplicating" the
    // two into one component that takes an optional session — at which point an authed
    // destination reaches a signed-out page. This is what would catch that.
    const { container } = render(<PublicNavbar />);
    const hrefs = Array.from(container.querySelectorAll("a[href]")).map(
      (a) => a.getAttribute("href") ?? "",
    );

    for (const href of hrefs) {
      expect(href, `authed destination on the public navbar: ${href}`).not.toMatch(
        /^\/app(\/|$)|^\/onboarding(\/|$)|^\/auth(\/|$)/,
      );
    }
    expect(container.textContent).not.toMatch(/\b(dashboard|sign out|my account|profile)\b/i);
  });

  it("renders the theme toggle, matching the app header's placement", () => {
    render(<PublicNavbar />);
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });
});

describe("PublicMobileNav", () => {
  it("labels the trigger exactly 'Open menu' (FR-019)", () => {
    render(<PublicMobileNav />);
    // Exact string: the app's own hamburger uses it, and a visitor who later signs in
    // should meet the same control with the same name.
    const trigger = screen.getByLabelText("Open menu");
    expect(trigger).toBeInTheDocument();
    expect(trigger.tagName).toBe("BUTTON");
  });

  it("gives the trigger a 44 px tap target (FR-053)", () => {
    render(<PublicMobileNav />);
    const trigger = screen.getByLabelText("Open menu");
    expect(trigger.className).toMatch(/\bh-11\b/);
    expect(trigger.className).toMatch(/\bw-11\b/);
  });

  it("carries a visible focus indicator (FR-055)", () => {
    render(<PublicMobileNav />);
    expect(screen.getByLabelText("Open menu").className).toMatch(/focus-visible:ring-2/);
  });
});

describe("PublicFooter", () => {
  it("links to both /terms and /privacy (FR-023)", () => {
    const { container } = render(<PublicFooter />);
    const hrefs = Array.from(container.querySelectorAll("a[href]")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toContain("/terms");
    expect(hrefs).toContain("/privacy");
  });

  it("renders the approved copyright line EXACTLY (plan.md §10.3)", () => {
    render(<PublicFooter />);
    // Asserted as an exact string, so a re-worded copyright line fails CI rather than
    // shipping. `© 2026 Serenify` is the only approved-copy string in this phase and it
    // is fixed character for character — no institutional attribution, no em-dash suffix.
    expect(screen.getByText("© 2026 Serenify")).toBeInTheDocument();
  });

  it("carries no institutional attribution (plan.md §0.6)", () => {
    const { container } = render(<PublicFooter />);
    // §0.6's resolution: the Privacy Policy names Mohamed Asem as the individual data
    // controller, so a footer naming a university reads as a contradicting entity claim.
    expect(container.textContent).not.toMatch(/university|capital|inc\.|ltd|llc|©.*—/i);
  });

  it("renders the wordmark", () => {
    const { container } = render(<PublicFooter />);
    expect(container.textContent).toContain("serenify");
  });

  it("gives every footer link an accessible name and a 44 px target", () => {
    const { container } = render(<PublicFooter />);
    const nav = container.querySelector<HTMLElement>("nav[aria-label='Legal']");
    expect(nav).not.toBeNull();

    const links = within(nav as HTMLElement).getAllByRole("link");
    expect(links.length).toBe(PUBLIC_DESTINATIONS.length);
    for (const link of links) {
      expect(accessibleName(link)).not.toBe("");
      expect(link.className).toMatch(/min-h-11/);
      // Regression, both axes. The T036 walk measured "Terms" at 41 px WIDE while it
      // passed the height floor — a short label makes an inline-flex link narrower than
      // the 44 px target even when its height is right.
      expect(link.className).toMatch(/min-w-11/);
      // FR-053: a tap target's label must not wrap to two lines.
      expect(link.className).toMatch(/whitespace-nowrap/);
    }
  });
});
