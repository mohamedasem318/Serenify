import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FailureState } from "./failure-state";

const noop = () => {};

describe("FailureState (FR-027–030)", () => {
  it("shows the adaptive cause chip per cause, owning our-side failures", () => {
    const { rerender } = render(
      <FailureState cause="low-light" escapeVisible={false} onRetry={noop} onNotNow={noop} onPause={noop} />,
    );
    expect(screen.getByText(/more light/i)).toBeInTheDocument();
    rerender(
      <FailureState cause="out-of-frame" escapeVisible={false} onRetry={noop} onNotNow={noop} onPause={noop} />,
    );
    expect(screen.getByText(/roughly centred and still/i)).toBeInTheDocument();
    rerender(
      <FailureState cause="our-side" escapeVisible={false} onRetry={noop} onNotNow={noop} onPause={noop} />,
    );
    expect(screen.getByText(/on our side/i)).toBeInTheDocument();
  });

  it("offers Try again / Not now before the escape threshold", () => {
    const onRetry = vi.fn();
    const onNotNow = vi.fn();
    render(
      <FailureState cause="low-light" escapeVisible={false} onRetry={onRetry} onNotNow={onNotNow} onPause={noop} />,
    );
    expect(screen.queryByText(/maybe later/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    fireEvent.click(screen.getByRole("button", { name: /not now/i }));
    expect(onRetry).toHaveBeenCalled();
    expect(onNotNow).toHaveBeenCalled();
  });

  it("offers the gentle escape after the threshold", () => {
    const onRetry = vi.fn();
    const onPause = vi.fn();
    render(
      <FailureState cause="our-side" escapeVisible onRetry={onRetry} onNotNow={noop} onPause={onPause} />,
    );
    expect(screen.getByText(/pause this for now/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try once more/i }));
    fireEvent.click(screen.getByRole("button", { name: /maybe later/i }));
    expect(onRetry).toHaveBeenCalled();
    expect(onPause).toHaveBeenCalled();
  });

  // feature 006 — the new face-absence chip (DECISION-30 / FR-012).
  it("renders the face-absence chip for the insufficient-face cause (006)", () => {
    render(
      <FailureState
        cause="insufficient-face"
        escapeVisible={false}
        onRetry={noop}
        onNotNow={noop}
        onPause={noop}
      />,
    );
    expect(
      screen.getByText(/couldn.t see your face for enough of that recording/i),
    ).toBeInTheDocument();
  });

  it("pins the exact rendered copy of the three existing cause chips", () => {
    const { rerender } = render(
      <FailureState cause="low-light" escapeVisible={false} onRetry={noop} onNotNow={noop} onPause={noop} />,
    );
    expect(screen.getByText("Facing a little more light usually helps.")).toBeInTheDocument();
    rerender(
      <FailureState cause="out-of-frame" escapeVisible={false} onRetry={noop} onNotNow={noop} onPause={noop} />,
    );
    expect(screen.getByText("Staying roughly centred and still helps.")).toBeInTheDocument();
    rerender(
      <FailureState cause="our-side" escapeVisible={false} onRetry={noop} onNotNow={noop} onPause={noop} />,
    );
    expect(
      screen.getByText("This one was on our side."),
    ).toBeInTheDocument();
  });
});
