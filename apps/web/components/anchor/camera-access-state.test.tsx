import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CameraAccessState } from "./camera-access-state";

describe("CameraAccessState (FR-031–035)", () => {
  it.each([
    ["blocked", /camera.s blocked/i, /address bar/i],
    ["busy", /camera.s in use/i, /video call/i],
    ["no-device", /no camera found/i, /connect or enable/i],
  ] as const)("names the problem and the fix for the %s state", (kind, title, body) => {
    render(<CameraAccessState kind={kind} onRetry={() => {}} onNotNow={() => {}} />);
    expect(screen.getByRole("heading")).toHaveTextContent(title);
    expect(screen.getByText(body)).toBeInTheDocument();
  });

  it("offers Try again and Not now", () => {
    const onRetry = vi.fn();
    const onNotNow = vi.fn();
    render(<CameraAccessState kind="busy" onRetry={onRetry} onNotNow={onNotNow} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    fireEvent.click(screen.getByRole("button", { name: /not now/i }));
    expect(onRetry).toHaveBeenCalled();
    expect(onNotNow).toHaveBeenCalled();
  });
});
