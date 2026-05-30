import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BreathingGuide } from "./breathing-guide";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => vi.restoreAllMocks());

describe("BreathingGuide (FR-015/016 — focal point, not progress)", () => {
  it("is NOT a progress indicator", () => {
    mockMatchMedia(false);
    render(<BreathingGuide />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText(/in for four, out for six/i)).toBeInTheDocument();
  });

  it("gives a true motion-free textual cue under reduced motion", () => {
    mockMatchMedia(true);
    render(<BreathingGuide />);
    expect(screen.getByText("Breathe in for four, out for six.")).toBeInTheDocument();
  });
});
