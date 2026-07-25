import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { Wordmark } from "@/components/brand/wordmark";

/**
 * The shared wordmark — constitution v1.13.0 Amendment 17 (Principle V,
 * Wordmark) and specs/013-public-surface-and-legal/contracts/wordmark.md §8.
 *
 * The cross-boundary obligation (the next/og card and the Supabase email
 * templates) is a different test: tests/unit/brand/wordmark-sync.test.ts.
 * This one is about the component's own rendered shape.
 */
describe("Wordmark", () => {
  function renderWordmark(className?: string) {
    const { container } = render(<Wordmark className={className} />);
    const wrapper = container.firstElementChild;
    if (!(wrapper instanceof HTMLElement)) {
      throw new Error("Wordmark rendered no element");
    }
    return wrapper;
  }

  it("splits into exactly two halves, in the ink and meadow-text tokens", () => {
    const halves = Array.from(renderWordmark().children);

    expect(halves).toHaveLength(2);
    const [seren, ify] = halves as [Element, Element];
    expect(seren.textContent).toBe("seren");
    expect(seren).toHaveClass("text-ink");
    expect(ify.textContent).toBe("ify");
    expect(ify).toHaveClass("text-meadow-text");
  });

  it("reads as exactly `serenify`", () => {
    // Two elements, one word: this is what keeps the app header's
    // existing `toHaveTextContent("serenify")` assertion passing
    // unchanged across the split.
    expect(renderWordmark().textContent).toBe("serenify");
  });

  it("owns the casing rather than leaving it to each caller", () => {
    expect(renderWordmark()).toHaveClass("lowercase");
  });

  it("takes size and spacing from the caller's className", () => {
    // The five in-tree sites differ, so the component carries no size
    // class of its own and the caller's classes must reach the wrapper.
    const wrapper = renderWordmark("text-4xl leading-none sm:text-5xl");

    expect(wrapper).toHaveClass("text-4xl", "leading-none", "sm:text-5xl");
    expect(wrapper).toHaveClass("font-display", "tracking-tight");
  });

  it("carries no dot or other terminal punctuation (FR-030)", () => {
    // Asserted over the rendered text rather than the markup, which
    // legitimately contains `.` inside class names like `sm:text-5xl`.
    expect(renderWordmark("text-2xl").textContent).not.toMatch(
      /[.!?…·•,;:]/,
    );
  });
});
