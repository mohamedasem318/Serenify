import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SuccessState } from "./success-state";

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

describe("SuccessState (FR-025/026)", () => {
  it("confirms a set baseline with readable copy and returns home", () => {
    mockMatchMedia(true); // reduced motion → deterministic, no bloom/draw
    const onDone = vi.fn();
    render(<SuccessState onDone={onDone} />);
    expect(screen.getByRole("heading", { name: "Your baseline is set" })).toBeInTheDocument();
    expect(screen.getByText(/what calm looks like for you/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to home" }));
    expect(onDone).toHaveBeenCalled();
  });

  it("reads 'updated' and returns to the account in the recalibrate path", () => {
    mockMatchMedia(true);
    render(<SuccessState mode="recalibrate" onDone={() => {}} />);
    expect(screen.getByRole("heading", { name: "Your baseline is updated" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to account" })).toBeInTheDocument();
  });
});
