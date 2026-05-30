import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GreenRoom } from "./green-room";

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

beforeEach(() => mockMatchMedia(false));
afterEach(() => vi.restoreAllMocks());

const base = {
  gate: "ready" as const,
  ready: true,
  onReady: () => {},
  onNotNow: () => {},
};

describe("GreenRoom (FR-005–011)", () => {
  it("disables 'I'm ready' with a loading line while the guide loads", () => {
    render(<GreenRoom {...base} guide="loading" ready={false} gate="no-face" />);
    expect(screen.getByText(/getting your live guide ready/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /i.m ready/i })).toBeDisabled();
  });

  it("holds the gate with a calm, forgiving helper line when the user isn't set", () => {
    render(<GreenRoom {...base} guide="active" ready={false} gate="too-dark" />);
    expect(screen.getByText(/more light on your face/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /i.m ready/i })).toBeDisabled();
  });

  it("enables 'I'm ready' once the soft gate clears", () => {
    const onReady = vi.fn();
    render(<GreenRoom {...base} guide="active" ready gate="ready" onReady={onReady} />);
    const btn = screen.getByRole("button", { name: /i.m ready/i });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onReady).toHaveBeenCalled();
  });

  it("shows the affirmative in the status line (not on the video) when the live gate clears", () => {
    render(<GreenRoom {...base} guide="active" ready gate="ready" />);
    // the affirmative TEXT lives here, in the same slot as the hold/nudge copy
    expect(screen.getByText(/you.re all set/i)).toBeInTheDocument();
  });

  it("never locks the user out — the unavailable fallback still allows recording (FR-011)", () => {
    render(<GreenRoom {...base} guide="unavailable" ready gate="ready" />);
    expect(screen.getByText(/no live guide — you can still record/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /i.m ready/i })).toBeEnabled();
  });

  it("offers a calm 'Not now' exit and shows the device picker", () => {
    const onNotNow = vi.fn();
    render(
      <GreenRoom
        {...base}
        guide="active"
        devicePicker={<div data-testid="device-picker" />}
        onNotNow={onNotNow}
      />,
    );
    expect(screen.getByTestId("device-picker")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /not now/i }));
    expect(onNotNow).toHaveBeenCalled();
  });
});
