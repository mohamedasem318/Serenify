import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecordingTimer } from "./recording-timer";

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

describe("RecordingTimer (FR-016 — the sole progress indicator)", () => {
  it("renders remaining mm:ss and an accessible timer label", () => {
    mockMatchMedia(false);
    render(<RecordingTimer remaining={43} total={60} />);
    expect(screen.getByText("0:43")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveAttribute("aria-label", "43 seconds remaining");
  });

  it("uses a singular label at one second", () => {
    mockMatchMedia(false);
    render(<RecordingTimer remaining={1} total={60} />);
    expect(screen.getByRole("timer")).toHaveAttribute("aria-label", "1 second remaining");
    expect(screen.getByText("0:01")).toBeInTheDocument();
  });

  it("shows 1:00 at the full minute", () => {
    mockMatchMedia(false);
    render(<RecordingTimer remaining={60} total={60} />);
    expect(screen.getByText("1:00")).toBeInTheDocument();
  });
});
