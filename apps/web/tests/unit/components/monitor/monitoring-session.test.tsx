import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { MonitoringSession, type MonitoringDeps } from "@/components/monitor/monitoring-session";
import type { SubmitWindowResult } from "@/lib/api/monitoring-client";
import type { MinimalWindowRecorder } from "@/components/monitor/window-recorder";

/**
 * Feature 008 / US1 — T035: the orchestrator wiring, end-to-end against fakes
 * (DECISION-26 seam). The face-detector hook is mocked (happy-dom has no camera/canvas);
 * `guide: "unavailable"` means the no-face gate is bypassed so uploads proceed and the
 * server decides — exactly the production fallback.
 */

vi.mock("@/lib/face-detect/use-framing-guide", () => ({
  useFramingGuide: () => ({ guide: "unavailable", gate: "ready", ready: true, drift: "centred" }),
}));

// happy-dom type-validates HTMLMediaElement.srcObject (a real browser accepts a real
// MediaStream; our fake stream isn't one). Shim the setter to a no-op for the test env —
// production assigns a genuine MediaStream and is unaffected.
beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
    configurable: true,
    get() {
      return null;
    },
    set() {},
  });
});

function makeDeps(outcomes: SubmitWindowResult[]) {
  let rec: MinimalWindowRecorder | null = null;
  let i = 0;
  const deps: Partial<MonitoringDeps> = {
    isSecureContext: () => true,
    getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: () => {} }] }) as unknown as MediaStream),
    getSession: vi.fn(async () => ({ accessToken: "tok" })),
    createSession: vi.fn(async () => ({ ok: true, sessionId: "sid", modelVersion: "m" }) as const),
    submitWindow: vi.fn(
      async (): Promise<SubmitWindowResult> =>
        outcomes[Math.min(i++, outcomes.length - 1)] ?? { ok: false, kind: "unknown" },
    ),
    createRecorder: () => {
      rec = {
        state: "inactive",
        mimeType: "video/webm",
        ondataavailable: null,
        onstop: null,
        start() {
          this.state = "recording";
        },
        stop() {
          this.state = "inactive";
        },
      };
      return rec;
    },
    createDetector: async () => null,
    strideMs: 10_000,
  };
  return { deps, fireStride: () => rec?.ondataavailable?.({ data: new Blob(["x"]) }) };
}

describe("MonitoringSession orchestrator", () => {
  it("progresses permission → warming-up → reading as windows score", async () => {
    const { deps, fireStride } = makeDeps([
      { ok: true, outcome: { outcome: "warming_up", capturedAt: "t" } },
      { ok: true, outcome: { outcome: "reading", band: "at_ease", capturedAt: "t" } },
    ]);
    render(<MonitoringSession deps={deps} />);

    // permission first — we never assume camera access
    expect(screen.getByText(/serenify needs your camera/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /allow camera access/i }));
    });

    // camera granted + session created → warming-up (held while the server warms)
    expect(await screen.findByText(/getting a read on things/i)).toBeInTheDocument();

    await act(async () => {
      fireStride(); // a window that the server is still warming on
    });
    expect(screen.getByText(/getting a read on things/i)).toBeInTheDocument(); // still held

    await act(async () => {
      fireStride(); // the first real reading
    });
    expect(await screen.findByText(/at ease right now/i)).toBeInTheDocument();
    expect(screen.getByTestId("bloom")).toHaveAttribute("data-tone", "ease");
  });

  it("routes a blocked camera to the foggy blocked surface", async () => {
    const { deps } = makeDeps([]);
    deps.getUserMedia = vi.fn(async () => {
      throw new DOMException("denied", "NotAllowedError");
    });
    render(<MonitoringSession deps={deps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /allow camera access/i }));
    });
    expect(await screen.findByText(/camera access is blocked/i)).toBeInTheDocument();
  });

  it("routes a no-anchor employee (create-session 409) to the calibrate-first panel", async () => {
    const { deps } = makeDeps([]);
    // The backend runs the calibrate-first guard UP FRONT: an uncalibrated employee gets
    // 409 no_anchor on create-session, before any window is recorded (SC-004).
    deps.createSession = vi.fn(async () => ({ ok: false, kind: "no_anchor" }) as const);
    const { container } = render(<MonitoringSession deps={deps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /allow camera access/i }));
    });

    // The seam now renders the panel instead of dead-ending on a blank stage.
    expect(await screen.findByText(/calibrate first/i)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /start calibration/i });
    expect(cta).toHaveAttribute("href", "/app/calibrate");
    // FR-015 holds here too — no number/gauge anywhere on the dead-end recovery.
    expect(container.textContent ?? "").not.toMatch(/[0-9]/);
  });
});
