import { act, render, screen } from "@testing-library/react";
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

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("BreathingOrb (FR-028/032/033 — layered bloom carrying the breath pacer)", () => {
  it("carries the stepped Breathe in / Breathe out cue ON the orb, not a progress role", () => {
    mockMatchMedia(false);
    render(<BreathingOrb />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText("Breathe in")).toBeInTheDocument(); // starts on the inhale
    // with motion on, the animated bloom layer renders
    expect(screen.getByTestId("breath-bloom-animated")).toBeInTheDocument();
    // the old "with the light" line is gone — the orb itself carries the idea now
    expect(screen.queryByText(/with the light|in for four/i)).toBeNull();
  });

  it("swaps the breathe label on the in/out cadence with motion on", () => {
    // Fake only the interval timers so framer-motion's rAF loop is untouched.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    mockMatchMedia(false);
    render(<BreathingOrb />);

    expect(screen.getByText("Breathe in")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText("Breathe out")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText("Breathe in")).toBeInTheDocument();
  });

  it("is static under reduced motion — no animating bloom, static label that never swaps", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    mockMatchMedia(true);
    render(<BreathingOrb />);

    // the static bloom renders; the animated (motion) layer does not
    expect(screen.getByTestId("breath-bloom-static")).toBeInTheDocument();
    expect(screen.queryByTestId("breath-bloom-animated")).toBeNull();

    // a single static label, and it does NOT cycle even as time passes
    expect(screen.getByText("Breathe gently")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(12000));
    expect(screen.getByText("Breathe gently")).toBeInTheDocument();
    expect(screen.queryByText("Breathe in")).toBeNull();
    expect(screen.queryByText("Breathe out")).toBeNull();
  });
});
