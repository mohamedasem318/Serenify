import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FramingOverlay } from "./framing-overlay";

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

describe("FramingOverlay (FR-017 — fixed target, obvious two-colour drift signal)", () => {
  it("marks a centred recording frame with STEADY meadow brackets — no check, no blink", () => {
    mockMatchMedia(false);
    // showNudge defaults true = recording (drift-feedback) mode
    const { container } = render(<FramingOverlay drift="centred" />);
    expect(container.querySelector(".border-meadow")).not.toBeNull();
    expect(container.querySelector(".border-foggy")).toBeNull();
    expect(container.querySelector(".bg-meadow")).toBeNull(); // no check on the recording screen
    expect(container.querySelector(".animate-pulse")).toBeNull(); // steady
    expect(screen.queryByRole("status")).toBeNull(); // words live in the card below
  });

  it("blinks FOGGY brackets when the face drifts — never amber/crimson, no on-video text", () => {
    mockMatchMedia(false);
    const { container } = render(<FramingOverlay drift="ease-back" />);
    expect(container.querySelector(".border-foggy")).not.toBeNull();
    expect(container.querySelector(".animate-pulse")).not.toBeNull(); // blinking = come back
    expect(container.querySelector(".border-meadow")).toBeNull();
    expect(container.innerHTML).not.toMatch(/amber|crimson/);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("blinks the same foggy brackets when the face is absent", () => {
    mockMatchMedia(false);
    const { container } = render(<FramingOverlay drift="absent" />);
    expect(container.querySelector(".border-foggy")).not.toBeNull();
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("drops the blink under reduced motion but keeps the foggy hue", () => {
    mockMatchMedia(true);
    const { container } = render(<FramingOverlay drift="ease-back" />);
    expect(container.querySelector(".border-foggy")).not.toBeNull();
    expect(container.querySelector(".animate-pulse")).toBeNull(); // no motion
  });

  it("keeps the brackets quiet (white) in the green room, even off-centre, until the gate clears", () => {
    mockMatchMedia(false);
    const { container } = render(<FramingOverlay drift="ease-back" showNudge={false} />);
    expect(container.querySelector(".border-foggy")).toBeNull();
    expect(container.querySelector(".border-meadow")).toBeNull();
  });

  it("affirms with meadow brackets + a visual check (green room only) when the gate clears (FR-008)", () => {
    mockMatchMedia(false);
    const { container } = render(<FramingOverlay drift="centred" showNudge={false} gateReady />);
    expect(container.querySelector(".border-meadow")).not.toBeNull();
    expect(container.querySelector(".bg-meadow")).not.toBeNull(); // the check badge
    expect(container.innerHTML).not.toMatch(/amber|crimson/);
    expect(screen.queryByText(/you.re set/i)).toBeNull();
  });

  it("does not affirm while drifting — the foggy blink wins", () => {
    mockMatchMedia(false);
    const { container } = render(<FramingOverlay drift="ease-back" gateReady />);
    expect(container.querySelector(".bg-meadow")).toBeNull(); // no affirmative check
    expect(container.querySelector(".border-meadow")).toBeNull(); // brackets stay foggy
    expect(container.querySelector(".border-foggy")).not.toBeNull();
  });
});
