import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Countdown } from "./countdown";

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

describe("Countdown", () => {
  it("renders an animated ring and the remaining seconds by default", () => {
    mockMatchMedia(false);
    const { container } = render(<Countdown remaining={42} total={60} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveAttribute("aria-label", "42 seconds remaining");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("collapses to a numeric tick under prefers-reduced-motion (no ring)", async () => {
    mockMatchMedia(true);
    const { container } = render(<Countdown remaining={5} total={60} />);
    await waitFor(() => expect(container.querySelector("svg")).toBeNull());
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("uses a singular label at one second", () => {
    mockMatchMedia(false);
    render(<Countdown remaining={1} total={60} />);
    expect(screen.getByRole("timer")).toHaveAttribute("aria-label", "1 second remaining");
  });
});
