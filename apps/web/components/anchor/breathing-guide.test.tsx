import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BreathingOrb, BreathingPacer } from "./breathing-guide";

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

describe("BreathingOrb (FR-015/016 — focal graphic, not progress)", () => {
  it("is a graphic with no words and no progress role", () => {
    mockMatchMedia(false);
    const { container } = render(<BreathingOrb />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(container.textContent).toBe(""); // no words on the video
    expect(container.querySelector(".rounded-full")).not.toBeNull();
  });
});

describe("BreathingPacer (FR-015/016/048 — words in the card below)", () => {
  it("uses a stepped Breathe in / Breathe out cue with motion (starts on the inhale)", () => {
    mockMatchMedia(false);
    render(<BreathingPacer />);
    expect(screen.getByText("Breathe in")).toBeInTheDocument();
    // the old "with the light" line is gone — the orb carries that idea now
    expect(screen.queryByText(/with the light|in for four/i)).toBeNull();
  });

  it("uses the same stepped cue under reduced motion", () => {
    mockMatchMedia(true);
    render(<BreathingPacer />);
    expect(screen.getByText("Breathe in")).toBeInTheDocument();
  });
});
