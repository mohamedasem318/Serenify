import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BreathingOrb } from "./breathing-guide";

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

describe("BreathingOrb (FR-015/016/048 — focal graphic carrying the breath pacer)", () => {
  it("carries the stepped Breathe in / Breathe out cue ON the orb, not a progress role", () => {
    mockMatchMedia(false);
    render(<BreathingOrb />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText("Breathe in")).toBeInTheDocument(); // starts on the inhale
    // the old "with the light" line is gone — the orb itself carries the idea now
    expect(screen.queryByText(/with the light|in for four/i)).toBeNull();
  });

  it("uses the same stepped cue under reduced motion (static orb, label still swaps)", () => {
    mockMatchMedia(true);
    render(<BreathingOrb />);
    expect(screen.getByText("Breathe in")).toBeInTheDocument();
  });
});
