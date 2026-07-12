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

  it("announces and disables the action while Serenify wakes", () => {
    const onAllow = vi.fn();
    render(
      <OpSurfaces
        state={{ op: "permission", band: null, skipCause: null }}
        starting
        onAllow={onAllow}
        onRetryBlocked={noop}
      />,
    );

    const button = screen.getByRole("button", { name: /waking serenify/i });
    expect(button).toBeDisabled();
    expect(button.parentElement).toHaveAttribute("aria-live", "polite");
    expect(button.className).toContain("h-12");
    fireEvent.click(button);
    expect(onAllow).not.toHaveBeenCalled();
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

  it("sticky-denied camera: the exact 008-followups guidance copy", () => {
    render(
      <OpSurfaces state={{ op: "blocked", band: null, skipCause: null, cameraError: "blocked" }} onAllow={noop} onRetryBlocked={noop} />,
    );
    expect(screen.getByText("Camera access is blocked")).toBeInTheDocument();
    expect(
      screen.getByText("Turn it back on in your browser's site settings, then try again."),
    ).toBeInTheDocument();
  });

  it("insecure origin: its own surface, the exact https copy (not a generic block)", () => {
    render(
      <OpSurfaces state={{ op: "blocked", band: null, skipCause: null, cameraError: "insecure" }} onAllow={noop} onRetryBlocked={noop} />,
    );
    expect(
      screen.getByText("This page needs a secure (https) connection to use your camera."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/camera access is blocked/i)).toBeNull();
  });
});

describe("OpSurfaces — service-unavailable (backend down, NOT the camera)", () => {
  it("points at the connection/service, never the camera, and retries", () => {
    const onRetry = vi.fn();
    const { container } = render(
      <OpSurfaces
        state={{ op: "service-unavailable", band: null, skipCause: null }}
        onAllow={noop}
        onRetryBlocked={onRetry}
      />,
    );
    // Honest copy: the SERVICE is unreachable…
    expect(screen.getByText(/can.t reach serenify right now/i)).toBeInTheDocument();
    expect(screen.getByText(/reach the check-in service/i)).toBeInTheDocument();
    // …and crucially NOT the misleading camera-blocked copy.
    expect(screen.queryByText(/camera access is blocked/i)).toBeNull();
    expect(screen.queryByText(/browser.s site settings/i)).toBeNull();
    // FOGGY attention, never amber (a connectivity blip is not a stress signal).
    expect(container.querySelector(".text-amber, .bg-amber, .border-amber")).toBeNull();
    // Retry re-attempts the create (same handler the blocked surface uses).
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
    expect(container.textContent ?? "").not.toMatch(NO_DIGIT);
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

describe("OpSurfaces — FR-024 reassurance footnote (active reading card)", () => {
  // The in-product reassurance line (resolves /speckit-analyze U1: FR-024 had no
  // authoritative placement). Quiet, muted footnote on the live reading card only.
  const REASSURANCE = /processed just for you\s*—\s*analyzed, then deleted/i;

  it("shows the muted reassurance footnote on every active band and while warming up", () => {
    for (const state of [
      { op: "warming-up", band: null, skipCause: null },
      { op: "active", band: "at_ease", skipCause: null },
      { op: "active", band: "a_little_tense", skipCause: null },
      { op: "active", band: "tense", skipCause: null },
    ] as MonitorState[]) {
      const { unmount } = render0(state);
      const line = screen.getByText(REASSURANCE);
      expect(line).toBeInTheDocument();
      // The muted/secondary token — NOT a semantic alert colour (amber/foggy/meadow/crimson).
      expect(line.className).toContain("text-muted");
      expect(line.className).not.toMatch(/amber|foggy|meadow|crimson|red/);
      unmount();
    }
  });

  it("is absent on the calibrate-first and permission panels", () => {
    const { rerender } = render0({ op: "calibrate-first", band: null, skipCause: null });
    expect(screen.queryByText(REASSURANCE)).toBeNull();
    rerender(
      <OpSurfaces state={{ op: "permission", band: null, skipCause: null }} onAllow={noop} onRetryBlocked={noop} />,
    );
    expect(screen.queryByText(REASSURANCE)).toBeNull();
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

  it("renders NO stress band on the no_anchor surface — never a reading (SC-004 / T045)", () => {
    // The whole point of calibrate-first: a no-anchor user is NEVER shown a stress band.
    // No bloom (the band's only visual), and none of the band statelines, ever render here.
    render0({ op: "calibrate-first", band: null, skipCause: null });
    expect(screen.queryByTestId("bloom")).toBeNull();
    expect(screen.queryByText(/at ease right now/i)).toBeNull();
    expect(screen.queryByText(/a little tense/i)).toBeNull();
    expect(screen.queryByText(/feeling tense/i)).toBeNull();
  });
});

/* ── US2 (T039) — out-of-frame + paused surfaces, both FOGGY/neutral, never amber ── */

describe("OpSurfaces — out-of-frame (FOGGY attention, never amber: FR-007/FR-022)", () => {
  const render1 = (onPause = noop, onEnd = noop) =>
    render(
      <OpSurfaces
        state={{ op: "out-of-frame", band: "tense", skipCause: null }}
        onAllow={noop}
        onRetryBlocked={noop}
        onPause={onPause}
        onEnd={onEnd}
      />,
    );

  it("shows the foggy lost-sight prompt + the dimmed held bloom, with Pause/End controls", () => {
    const onPause = vi.fn();
    const onEnd = vi.fn();
    const { container } = render1(onPause, onEnd);

    expect(screen.getByText(/waiting for you/i)).toBeInTheDocument();
    expect(screen.getByText(/lost sight of you/i)).toBeInTheDocument();
    expect(screen.getByText(/move back into frame/i)).toBeInTheDocument();

    // FOGGY stateline — never amber, even though the HELD band is tense (a presence cue is
    // not a stress signal; FR-022).
    const stateline = screen.getByText(/waiting for you/i);
    expect(stateline.className).toContain("text-foggy");
    expect(stateline.className).not.toMatch(/amber/);

    // The bloom dims but holds the last (tense) colour (mock `.bloom.dim`).
    const bloom = screen.getByTestId("bloom");
    expect(bloom).toHaveAttribute("data-tone", "tense");
    expect(bloom.className).toContain("opacity-40");

    fireEvent.click(screen.getByRole("button", { name: /^pause$/i }));
    expect(onPause).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /end session/i }));
    expect(onEnd).toHaveBeenCalled();

    expect(container.textContent ?? "").not.toMatch(NO_DIGIT);
  });

  it("uses NO amber colour token anywhere on the out-of-frame surface (foggy only)", () => {
    const { container } = render1();
    expect(container.querySelector(".text-amber, .bg-amber, .border-amber")).toBeNull();
    // the prompt box is foggy-tinted
    expect(container.querySelector(".bg-foggy\\/10, .border-foggy\\/40")).not.toBeNull();
  });
});

describe("OpSurfaces — paused (calm, neutral; camera off)", () => {
  it("shows the paused copy with a meadow Resume + End, no amber/foggy stateline", () => {
    const onResume = vi.fn();
    const onEnd = vi.fn();
    render(
      <OpSurfaces
        state={{ op: "paused", band: "at_ease", skipCause: null }}
        onAllow={noop}
        onRetryBlocked={noop}
        onResume={onResume}
        onEnd={onEnd}
      />,
    );
    expect(screen.getByText(/paused — taking a break/i)).toBeInTheDocument();
    expect(screen.getByText(/your camera is off/i)).toBeInTheDocument();
    const stateline = screen.getByText(/paused — taking a break/i);
    expect(stateline.className).toContain("text-ink"); // neutral — not a stress/attention colour
    expect(stateline.className).not.toMatch(/amber|foggy/);

    fireEvent.click(screen.getByRole("button", { name: /resume/i }));
    expect(onResume).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /end session/i }));
    expect(onEnd).toHaveBeenCalled();
  });

  it("ended renders nothing — the orchestrator navigates to the dashboard (mock-gap #6)", () => {
    const { container } = render0({ op: "ended", band: null, skipCause: null });
    expect(container.textContent ?? "").toBe("");
  });
});
