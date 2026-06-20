import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OpSurfaces } from "@/components/monitor/op-surfaces";
import type { MonitorState } from "@/components/monitor/use-monitoring-session";

/** Feature 008 / US1 — T035: the op-surfaces (US1 subset) — warming gating, band→colour,
 *  the panels, the foggy skip note, and the "no number, ever" guarantee (FR-015). */

const noop = () => {};
const render0 = (state: MonitorState) =>
  render(<OpSurfaces state={state} onAllow={noop} onRetryBlocked={noop} />);

const NO_DIGIT = /[0-9]/;

describe("OpSurfaces — warming-up gating", () => {
  it("shows the warming copy and NO band before the first reading", () => {
    const { container } = render0({ op: "warming-up", band: null, skipCause: null });
    expect(screen.getByText(/getting a read on things/i)).toBeInTheDocument();
    expect(screen.queryByText(/at ease right now/i)).toBeNull();
    expect(screen.queryByText(/feeling tense/i)).toBeNull();
    expect(screen.getByTestId("bloom")).toHaveAttribute("data-tone", "warming");
    expect(container.textContent ?? "").not.toMatch(NO_DIGIT);
  });
});

describe("OpSurfaces — band → colour + copy (active)", () => {
  it("at-ease → meadow bloom + meadow stateline", () => {
    render0({ op: "active", band: "at_ease", skipCause: null });
    expect(screen.getByTestId("bloom")).toHaveAttribute("data-tone", "ease");
    expect(screen.getByText(/at ease right now/i).className).toContain("text-meadow-text");
  });

  it("a-little-tense → mid-gold bloom + amber stateline (a stress band)", () => {
    render0({ op: "active", band: "a_little_tense", skipCause: null });
    expect(screen.getByTestId("bloom")).toHaveAttribute("data-tone", "little");
    expect(screen.getByText(/a little tense/i).className).toContain("text-amber");
  });

  it("tense → amber bloom + amber stateline", () => {
    render0({ op: "active", band: "tense", skipCause: null });
    expect(screen.getByTestId("bloom")).toHaveAttribute("data-tone", "tense");
    expect(screen.getByText(/feeling tense/i).className).toContain("text-amber");
  });

  it("renders NO number / gauge on any band (FR-015)", () => {
    for (const band of ["at_ease", "a_little_tense", "tense"] as const) {
      const { container, unmount } = render0({ op: "active", band, skipCause: null });
      expect(container.textContent ?? "").not.toMatch(NO_DIGIT);
      unmount();
    }
  });
});

describe("OpSurfaces — permission (meadow affirmative invitation, FR-024 reassurance)", () => {
  it("invites camera access and carries the manager-privacy reassurance line", () => {
    const onAllow = vi.fn();
    render(<OpSurfaces state={{ op: "permission", band: null, skipCause: null }} onAllow={onAllow} onRetryBlocked={noop} />);
    expect(screen.getByText(/serenify needs your camera/i)).toBeInTheDocument();
    expect(screen.getByText(/manager never sees your video/i)).toBeInTheDocument(); // FR-024
    fireEvent.click(screen.getByRole("button", { name: /allow camera access/i }));
    expect(onAllow).toHaveBeenCalled();
  });
});

describe("OpSurfaces — blocked (foggy attention)", () => {
  it("explains the block and retries", () => {
    const onRetry = vi.fn();
    render(<OpSurfaces state={{ op: "blocked", band: null, skipCause: null }} onAllow={noop} onRetryBlocked={onRetry} />);
    expect(screen.getByText(/camera access is blocked/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows honest per-cause copy — no generic 'blocked' catch-all (FR-022)", () => {
    const { rerender } = render(
      <OpSurfaces state={{ op: "blocked", band: null, skipCause: null, cameraError: "busy" }} onAllow={noop} onRetryBlocked={noop} />,
    );
    expect(screen.getByText(/camera.s in use/i)).toBeInTheDocument();
    expect(screen.queryByText(/camera access is blocked/i)).toBeNull();

    rerender(
      <OpSurfaces state={{ op: "blocked", band: null, skipCause: null, cameraError: "no-device" }} onAllow={noop} onRetryBlocked={noop} />,
    );
    expect(screen.getByText(/no camera found/i)).toBeInTheDocument();
  });
});

describe("OpSurfaces — skipped read (foggy note, keeps the last band)", () => {
  it("keeps the band and names a likely cause + fix via CauseChip", () => {
    const { container } = render0({ op: "active", band: "at_ease", skipCause: "low-light" });
    // last band still shown (bloom holds)
    expect(screen.getByText(/at ease right now/i)).toBeInTheDocument();
    // the foggy skip note + the shared cause line
    expect(screen.getByText(/couldn.t get a clear read/i)).toBeInTheDocument();
    expect(screen.getByText(/facing a little more light usually helps/i)).toBeInTheDocument();
    expect(container.textContent ?? "").not.toMatch(NO_DIGIT);
  });
});

describe("OpSurfaces — calibrate-first (no-anchor): foggy attention + meadow 'Start calibration'", () => {
  it("renders the calibrate-first panel and routes its CTA to the calibration entry, no number", () => {
    const { container } = render0({ op: "calibrate-first", band: null, skipCause: null });
    expect(screen.getByText(/calibrate first/i)).toBeInTheDocument();
    expect(screen.getByText(/one-minute baseline/i)).toBeInTheDocument();
    // The CTA is the existing calibration entry — a plain <a> (full-document nav for the
    // /app/calibrate camera Permissions-Policy), so it surfaces as a link, not a button.
    const cta = screen.getByRole("link", { name: /start calibration/i });
    expect(cta).toHaveAttribute("href", "/app/calibrate");
    expect(container.textContent ?? "").not.toMatch(NO_DIGIT);
  });
});
