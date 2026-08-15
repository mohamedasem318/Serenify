import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PickItem } from "@/components/recommendations/pick-item";
import { DURATION_OPENED_LABEL } from "@/lib/recommendations/card-strings";
import { RECOMMENDATION_LIBRARY, type LibraryItem } from "@/lib/recommendations/library";

/**
 * Feature 014 / T011 — the one shared item block.
 *
 * The load-bearing claim is FR-004: titles and instructions render VERBATIM. So these
 * assertions compare against `RECOMMENDATION_LIBRARY` itself rather than restating any
 * copy — a test that retyped the strings would pass while the component quietly truncated,
 * re-cased or re-wrapped them.
 *
 * The second claim is negative and just as load-bearing: **no band chip** (FR-013). The
 * check-in card above already stated the band; this card must not restate it.
 */

const item = RECOMMENDATION_LIBRARY[0]!;
const withoutFootNote: LibraryItem = { ...item, footNote: undefined };

describe("PickItem — verbatim library copy (FR-004)", () => {
  it("renders a real library item's title, why-line and duration exactly as authored", () => {
    render(<PickItem item={item} />);
    expect(screen.getByTestId("pick-item-title")).toHaveTextContent(item.title);
    expect(screen.getByTestId("pick-item-why")).toHaveTextContent(item.whyLine);
    expect(screen.getByTestId("pick-item-duration")).toHaveTextContent(item.durationLabel);
  });

  it("renders every step verbatim, in the library's declared order, when expanded", () => {
    render(<PickItem item={item} expanded />);
    const steps = screen.getByTestId("pick-item-steps").querySelectorAll("li");
    expect(steps).toHaveLength(item.steps.length);
    item.steps.forEach((step, index) => {
      // The numeral is a decorative sibling; the step text itself is compared byte for byte.
      expect(steps[index]!.textContent).toBe(`${index + 1}${step}`);
    });
    expect(screen.getByTestId("pick-item-footnote")).toHaveTextContent(item.footNote!);
  });

  it("renders every one of the fifteen reviewed items without dropping a word", () => {
    for (const entry of RECOMMENDATION_LIBRARY) {
      const { unmount } = render(<PickItem item={entry} expanded />);
      expect(screen.getByTestId("pick-item-title")).toHaveTextContent(entry.title);
      const text = screen.getByTestId("pick-item").textContent ?? "";
      for (const step of entry.steps) expect(text).toContain(step);
      unmount();
    }
  });

  it("omits the foot-note when the item has none", () => {
    render(<PickItem item={withoutFootNote} expanded />);
    expect(screen.queryByTestId("pick-item-footnote")).toBeNull();
  });

  it("shows no steps until it is expanded — opening them is the engagement record", () => {
    render(<PickItem item={item} />);
    expect(screen.queryByTestId("pick-item-steps")).toBeNull();
  });
});

describe("PickItem — the band is never restated (FR-013)", () => {
  it("renders no band chip in either the quiet or the prominent treatment", () => {
    for (const prominent of [false, true]) {
      const { unmount } = render(<PickItem item={item} prominent={prominent} expanded />);
      const text = screen.getByTestId("pick-item").textContent ?? "";
      for (const band of ["Calm", "Uneasy", "Tense"]) expect(text).not.toContain(band);
      unmount();
    }
  });
});

describe("PickItem — prominence is the mock's five small moves (state 4)", () => {
  it("adds the amber rail, the warm tile and the 19px title, and nothing louder", () => {
    render(<PickItem item={item} prominent />);
    expect(screen.getByTestId("pick-item-rail")).toBeInTheDocument();
    // jsdom/happy-dom has no stylesheet, so the assertion is on the class, not on paint.
    expect(screen.getByTestId("pick-item-title").className).toContain("text-[19px]");
    expect(screen.getByTestId("pick-item-tile").className).toContain("amber-tint");
    expect(screen.getByTestId("pick-item").className).not.toContain("crimson");
  });

  it("keeps the quiet treatment railless and neutral by default", () => {
    render(<PickItem item={item} />);
    expect(screen.queryByTestId("pick-item-rail")).toBeNull();
    expect(screen.getByTestId("pick-item-title").className).toContain("text-[17px]");
  });
});

describe("PickItem — the duration pill records use without a badge", () => {
  it("swaps the duration for the opened label once the item has been opened", () => {
    render(<PickItem item={item} opened />);
    expect(screen.getByTestId("pick-item-duration")).toHaveTextContent(DURATION_OPENED_LABEL);
  });
});
