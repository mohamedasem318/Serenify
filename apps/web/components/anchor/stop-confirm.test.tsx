import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StopConfirm } from "./stop-confirm";

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

describe("StopConfirm (FR-021–024)", () => {
  it("frames stopping honestly — start over, nothing lost", () => {
    render(<StopConfirm onKeepGoing={() => {}} onConfirmStop={() => {}} />);
    expect(screen.getByText(/start the minute over\?/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing.s saved yet, so nothing.s lost/i)).toBeInTheDocument();
  });

  it("makes 'Keep going' available as the easy default", () => {
    const onKeepGoing = vi.fn();
    render(<StopConfirm onKeepGoing={onKeepGoing} onConfirmStop={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /keep going/i }));
    expect(onKeepGoing).toHaveBeenCalled();
  });

  it("confirms the stop without a destructive (crimson) action", () => {
    const onConfirmStop = vi.fn();
    render(<StopConfirm onKeepGoing={() => {}} onConfirmStop={onConfirmStop} />);
    const startOver = screen.getByRole("button", { name: /start over/i });
    fireEvent.click(startOver);
    expect(onConfirmStop).toHaveBeenCalled();
    expect(startOver.className).not.toMatch(/destructive|crimson/);
  });
});
