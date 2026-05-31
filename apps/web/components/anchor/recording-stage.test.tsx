import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecordingStage } from "./recording-stage";

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

describe("RecordingStage (FR-015–020)", () => {
  it("shows the breathing guide, the 60s timer, the reassurance, and a calm Stop", () => {
    const onStop = vi.fn();
    render(<RecordingStage remaining={45} onStop={onStop} />);
    expect(screen.getByText(/breathe in/i)).toBeInTheDocument(); // breathing pacer (stepped cue)
    expect(screen.getByText("0:45")).toBeInTheDocument(); // sole progress timer
    expect(screen.getByRole("timer")).toBeInTheDocument();
    expect(screen.getByText(/we.ve got you/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(onStop).toHaveBeenCalled();
  });

  it("surfaces the grace-gated drift nudge via the persistent framing overlay", () => {
    render(<RecordingStage remaining={30} drift="ease-back" onStop={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent(/ease back to centre/i);
  });

  it("keeps the breathing guide out of the progress role (timer is the sole progress)", () => {
    render(<RecordingStage remaining={10} onStop={() => {}} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
