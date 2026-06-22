import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CameraPill } from "@/components/monitor/camera-pill";

/** Feature 008 / US2 — T041: the state-driven camera pill (recording / out-of-frame /
 *  paused / off). Out-of-frame is FOGGY (attention), never amber (FR-022). */

const dotOf = (container: HTMLElement) => container.querySelector("span[aria-hidden]");

describe("CameraPill — state-driven dot + label", () => {
  it("recording: meadow pulsing dot, peekable pin hint", () => {
    const { container } = render(<CameraPill status="recording" pinned={false} onTogglePin={() => {}} />);
    expect(screen.getByText("Recording")).toBeInTheDocument();
    expect(screen.getByText(/hover to peek/i)).toBeInTheDocument();
    expect(dotOf(container)?.className).toContain("bg-meadow");
    expect(dotOf(container)?.className).toContain("animate-pulse");
  });

  it("recording: pinned shows the pinned hint and presses the toggle", () => {
    const { container } = render(<CameraPill status="recording" pinned onTogglePin={() => {}} />);
    expect(screen.getByText(/· pinned/i)).toBeInTheDocument();
    expect(container.querySelector("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("out-of-frame: FOGGY dot, no pulse, no amber", () => {
    const { container } = render(<CameraPill status="out-of-frame" pinned={false} onTogglePin={() => {}} />);
    expect(screen.getByText("Out of frame")).toBeInTheDocument();
    const dot = dotOf(container);
    expect(dot?.className).toContain("bg-foggy");
    expect(dot?.className).not.toContain("animate-pulse");
    expect(dot?.className).not.toMatch(/amber/);
    // not peekable → no pin hint
    expect(screen.queryByText(/peek|pinned/i)).toBeNull();
  });

  it("paused / off: muted dot, no pin hint", () => {
    const { container, rerender } = render(<CameraPill status="paused" pinned={false} onTogglePin={() => {}} />);
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(dotOf(container)?.className).toContain("bg-muted");
    expect(screen.queryByText(/peek|pinned/i)).toBeNull();

    rerender(<CameraPill status="off" pinned={false} onTogglePin={() => {}} />);
    expect(screen.getByText("Camera off")).toBeInTheDocument();
    expect(dotOf(container)?.className).toContain("bg-muted");
  });

  it("toggles the pin on click and meets the 44px touch target", () => {
    const onTogglePin = vi.fn();
    render(<CameraPill status="recording" pinned={false} onTogglePin={onTogglePin} />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("min-h-11"); // ≥44px touch target
    fireEvent.click(btn);
    expect(onTogglePin).toHaveBeenCalled();
  });
});
