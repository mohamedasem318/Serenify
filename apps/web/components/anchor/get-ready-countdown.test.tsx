import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GetReadyCountdown } from "./get-ready-countdown";

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

describe("GetReadyCountdown (FR-012/014)", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("counts 3 → 2 → 1 then completes — numbers only, no draining ring", () => {
    const onComplete = vi.fn();
    const { container } = render(
      <GetReadyCountdown from={3} onComplete={onComplete} onCancel={() => {}} />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull(); // no draining ring (FR-012)

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("2")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1000));
    expect(onComplete).toHaveBeenCalled();
    expect(screen.queryByText("0")).toBeNull(); // never shows 0
  });

  it("offers a quiet Cancel during the countdown", () => {
    const onCancel = vi.fn();
    render(<GetReadyCountdown onComplete={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
