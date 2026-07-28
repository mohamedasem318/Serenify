import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { NeverCards } from "@/components/landing/never-cards";
import { StatusStatement } from "@/components/landing/status-statement";
import * as copy from "@/lib/landing/copy";

/**
 * T108 (feature 013, US1) — the landing page can actually be operated (SC-009).
 *
 * The landing page is the first thing a stranger meets and the only surface a signed-out
 * visitor has, so these assertions are about whether it can be used at all rather than
 * about how it looks: does every control have a name a screen reader can announce, does
 * anything depend on hover to convey meaning, and is the decorative orb kept decorative.
 */

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: vi.fn(() => true) }));

class NoopObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: readonly number[] = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
vi.stubGlobal("IntersectionObserver", NoopObserver);

/** The name a screen reader would announce: aria-label first, else the text content. */
function accessibleName(element: HTMLElement): string {
  return (element.getAttribute("aria-label") ?? element.textContent ?? "").trim();
}

function interactiveElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("a[href], button"));
}

describe("every interactive element is reachable and named", () => {
  it.each([
    ["Hero", <Hero key="hero" />],
    ["NeverCards", <NeverCards key="never" />],
    ["HowItWorks", <HowItWorks key="how" />],
    ["StatusStatement", <StatusStatement key="status" />],
  ])("%s", (_name, element) => {
    const { container } = render(element);
    for (const node of interactiveElements(container)) {
      expect(accessibleName(node), `${node.outerHTML.slice(0, 120)} has no accessible name`)
        .not.toBe("");
      // Nothing may be removed from the tab order on this page.
      expect(node.getAttribute("tabindex")).not.toBe("-1");
    }
  });
});

describe("the hero's two CTAs carry their exact FR-020 labels", () => {
  it("renders 'Get started' and 'See how it works', not re-worded", () => {
    render(<Hero />);
    expect(screen.getByRole("link", { name: copy.CTA_PRIMARY })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.CTA_SECONDARY })).toBeInTheDocument();
    expect(copy.CTA_PRIMARY).toBe("Get started");
    expect(copy.CTA_SECONDARY).toBe("See how it works");
  });
});

describe("the chapter markers", () => {
  it("sit in a named nav and expose aria-current on exactly the active one", () => {
    render(<Hero />);
    const nav = screen.getByRole("navigation", { name: copy.CHAPTER_NAV_LABEL });
    expect(nav).toBeInTheDocument();

    const markers = screen.getAllByRole("button");
    expect(markers).toHaveLength(copy.CHAPTER_NAMES.length);
    expect(markers.filter((m) => m.getAttribute("aria-current") === "true")).toHaveLength(1);
  });

  it("names each marker after its chapter, so the control says where it goes", () => {
    render(<Hero />);
    for (const name of copy.CHAPTER_NAMES) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });
});

describe("the orb stays decorative", () => {
  it("is aria-hidden and carries no number (FR-015, FR-021)", () => {
    render(<Hero />);
    for (const bloom of document.querySelectorAll('[data-testid="bloom"]')) {
      expect(bloom).toHaveAttribute("aria-hidden");
      expect(bloom.textContent ?? "").not.toMatch(/[0-9]/);
    }
  });
});

describe("nothing on the card depends on hover to convey information", () => {
  it("the inactive panels are hidden from assistive tech, the active one is not", () => {
    render(<Hero />);
    const panels = Array.from(document.querySelectorAll("[data-panel]"));
    const active = panels.filter((panel) => panel.hasAttribute("data-active"));
    expect(active).toHaveLength(1);
    for (const panel of panels) {
      const isActive = panel.hasAttribute("data-active");
      expect(panel.getAttribute("aria-hidden")).toBe(isActive ? "false" : "true");
    }
  });

  it("the prompt options are not controls, so nothing announces an action it cannot do", () => {
    // They illustrate a prompt. A real <button> here would take focus and then do nothing.
    render(<Hero />);
    for (const option of document.querySelectorAll("[data-option]")) {
      expect(option.tagName).not.toBe("BUTTON");
      expect(option.getAttribute("role")).not.toBe("button");
    }
  });
});

describe("headings form a single descending outline", () => {
  it("each section leads with an h2 and never skips to h4", () => {
    const { container } = render(
      <>
        <NeverCards />
        <HowItWorks />
        <StatusStatement />
      </>,
    );
    const levels = Array.from(container.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((heading) =>
      Number(heading.tagName.slice(1)),
    );
    expect(levels.length).toBeGreaterThan(0);
    expect(Math.min(...levels)).toBe(2);
    expect(Math.max(...levels)).toBe(3);
  });
});
