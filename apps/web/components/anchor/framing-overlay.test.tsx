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

describe("FramingOverlay (FR-017 — fixed target, calm drift nudge)", () => {
  it("stays quiet (no nudge) when the user is centred", () => {
    mockMatchMedia(false);
    render(<FramingOverlay drift="centred" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows a calm, foggy 'ease back to centre' nudge when the face drifts", () => {
    mockMatchMedia(false);
    render(<FramingOverlay drift="ease-back" />);
    const nudge = screen.getByRole("status");
    expect(nudge).toHaveTextContent(/ease back to centre/i);
    // foggy, never amber/crimson; text carries the meaning (color-not-only)
    expect(nudge.className).toMatch(/foggy/);
    expect(nudge.className).not.toMatch(/amber|crimson/);
  });

  it("shows a calm 'we can’t see you' nudge when the face is absent", () => {
    mockMatchMedia(false);
    render(<FramingOverlay drift="absent" />);
    expect(screen.getByRole("status")).toHaveTextContent(/can.t see you/i);
  });

  it("suppresses the nudge when showNudge is false", () => {
    mockMatchMedia(false);
    render(<FramingOverlay drift="ease-back" showNudge={false} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("affirms with meadow brackets + a calm check when the gate clears (FR-008)", () => {
    mockMatchMedia(false);
    const { container } = render(<FramingOverlay drift="centred" showNudge={false} gateReady />);
    // brackets turn meadow (never amber/crimson); the affirmation reads "you're set"
    expect(container.querySelector(".border-meadow")).not.toBeNull();
    expect(screen.getByText(/you.re set/i)).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/amber|crimson/);
  });

  it("does not affirm while a drift nudge is showing (the nudge wins)", () => {
    mockMatchMedia(false);
    render(<FramingOverlay drift="ease-back" gateReady />);
    expect(screen.queryByText(/you.re set/i)).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/ease back to centre/i);
  });
});
