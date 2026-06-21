import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { MonitoringSession, type MonitoringDeps } from "@/components/monitor/monitoring-session";
import type { PresenceCallbacks } from "@/components/monitor/presence-monitor";
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
// MediaStream; our fake stream isn't one) and ships no real play(). Shim both for the test
// env — production assigns a genuine MediaStream and calls the real play().
beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
    configurable: true,
    get() {
      return null;
    },
    set() {},
  });
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    writable: true,
    value: () => Promise.resolve(),
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

  it("maps the getUserMedia rejection by err.name to honest copy (no generic block)", async () => {
    const cases = [
      { name: "NotReadableError", copy: /camera.s in use/i },
      { name: "NotFoundError", copy: /no camera found/i },
    ] as const;
    for (const { name, copy } of cases) {
      const { deps } = makeDeps([]);
      deps.getUserMedia = vi.fn(async () => {
        throw new DOMException(name, name);
      });
      const view = render(<MonitoringSession deps={deps} />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /allow camera access/i }));
      });
      expect(await screen.findByText(copy)).toBeInTheDocument();
      view.unmount();
    }
  });

  it("acquire-late: a no-anchor employee never triggers a camera prompt (getUserMedia not called)", async () => {
    const { deps } = makeDeps([]);
    // 409 no_anchor at create-session — BEFORE any getUserMedia (the camera must not open).
    deps.createSession = vi.fn(async () => ({ ok: false, kind: "no_anchor" }) as const);
    render(<MonitoringSession deps={deps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /allow camera access/i }));
    });

    expect(await screen.findByText(/calibrate first/i)).toBeInTheDocument();
    // The defining acquire-late property: the camera is never requested without a 201.
    expect(deps.getUserMedia).not.toHaveBeenCalled();
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

  it("routes a MID-SESSION 409 no_anchor (anchor vanished) to calibrate-first + releases the camera (US3 / T042 / SC-004)", async () => {
    // The create-time guard passed (anchor present at start) and the session warmed up, but
    // the anchor then vanished: a scored window returns 409 → kind "no_anchor". The
    // orchestrator must route to the SAME existing calibrate-first surface the create path
    // uses (reusing NO_ANCHOR — not a new surface) and stop capture per the standing
    // lifecycle — never a reading without the user's own anchor.
    const trackStop = vi.fn();
    const { deps, fireStride } = makeDeps([
      { ok: true, outcome: { outcome: "warming_up", capturedAt: "t" } },
      { ok: false, kind: "no_anchor" },
    ]);
    deps.getUserMedia = vi.fn(
      async () => ({ getTracks: () => [{ stop: trackStop }] }) as unknown as MediaStream,
    );
    render(<MonitoringSession deps={deps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /allow camera access/i }));
    });
    expect(await screen.findByText(/getting a read on things/i)).toBeInTheDocument();

    await act(async () => {
      fireStride(); // a warming window — still live
    });
    await act(async () => {
      fireStride(); // the mid-session 409 no_anchor window
    });

    // Routed to the EXISTING calibrate-first panel (NO_ANCHOR), with its calibration CTA.
    expect(await screen.findByText(/calibrate first/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start calibration/i })).toHaveAttribute(
      "href",
      "/app/calibrate",
    );
    // The standing release effect freed the camera once the op left the live set (no regress).
    expect(trackStop).toHaveBeenCalled();
  });

  it("creates exactly one session when acquire is triggered twice concurrently (single-create guard)", async () => {
    // The two-POST /monitoring/sessions bug: a near-simultaneous second acquire (double
    // click / re-trigger) used to pass the sessionIdRef reuse check before the first create
    // resolved → two sessions, a leaked second recorder. The in-flight guard must collapse
    // both triggers onto ONE create and ONE camera open.
    const { deps } = makeDeps([{ ok: true, outcome: { outcome: "warming_up", capturedAt: "t" } }]);
    render(<MonitoringSession deps={deps} />);
    const btn = screen.getByRole("button", { name: /allow camera access/i });

    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn); // fired before the first create resolves
    });

    expect(deps.createSession).toHaveBeenCalledTimes(1);
    expect(deps.getUserMedia).toHaveBeenCalledTimes(1); // exactly one camera opened
  });

  it("binds the self-view srcObject and plays on stream-ready (no focus event needed)", async () => {
    // The "pill stuck until alt-tab" bug: srcObject was bound only by the mount-time
    // callback ref and never played, so the preview didn't light up until a focus/visibility
    // event forced a re-render. The reactive effect must bind the acquired stream and call
    // play() as soon as the stream is ready.
    let bound: unknown;
    const originalSrcObject = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      "srcObject",
    );
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      configurable: true,
      get() {
        return bound;
      },
      set(v) {
        bound = v;
      },
    });
    const playSpy = vi.fn(() => Promise.resolve());
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      writable: true,
      value: playSpy,
    });

    const fakeStream = { getTracks: () => [{ stop: () => {} }] } as unknown as MediaStream;
    const { deps } = makeDeps([{ ok: true, outcome: { outcome: "warming_up", capturedAt: "t" } }]);
    deps.getUserMedia = vi.fn(async () => fakeStream);

    try {
      render(<MonitoringSession deps={deps} />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /allow camera access/i }));
      });

      expect(bound).toBe(fakeStream); // the exact acquired stream is bound to the <video>
      expect(playSpy).toHaveBeenCalled(); // and playback is started without a focus event
    } finally {
      if (originalSrcObject) {
        Object.defineProperty(HTMLMediaElement.prototype, "srcObject", originalSrcObject);
      }
      Object.defineProperty(HTMLMediaElement.prototype, "play", {
        configurable: true,
        writable: true,
        value: () => Promise.resolve(),
      });
    }
  });
});

/**
 * Feature 008 / US2 — T041: the presence + lifecycle wiring, driven through the orchestrator
 * against fakes. The absence timing itself is unit-tested in presence-monitor.test.ts; here
 * we inject a FAKE presence monitor that captures its callbacks, so we can fire the
 * out-of-frame / return / auto-end EDGES and assert the orchestrator's response (the right
 * PATCH/end + surface), without a real clock.
 */
function makeUs2Deps() {
  let rec: MinimalWindowRecorder | null = null;
  let presenceCb: PresenceCallbacks | null = null;
  const trackStop = vi.fn();
  const patchStatus = vi.fn(async () => ({ ok: true }));
  const endSession = vi.fn(async () => ({ ok: true }));
  const navigate = vi.fn();
  const presenceStub = { faceSeen: vi.fn(), faceLost: vi.fn(), stop: vi.fn() };

  const deps: Partial<MonitoringDeps> = {
    isSecureContext: () => true,
    getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: trackStop }] }) as unknown as MediaStream),
    getSession: vi.fn(async () => ({ accessToken: "tok" })),
    createSession: vi.fn(async () => ({ ok: true, sessionId: "sid", modelVersion: "m" }) as const),
    submitWindow: vi.fn(
      async (): Promise<SubmitWindowResult> => ({ ok: true, outcome: { outcome: "warming_up", capturedAt: "t" } }),
    ),
    patchStatus,
    endSession,
    navigate,
    createPresenceMonitor: (cb) => {
      presenceCb = cb;
      return presenceStub;
    },
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
  return {
    deps,
    patchStatus,
    endSession,
    navigate,
    trackStop,
    presence: () => presenceCb as PresenceCallbacks,
  };
}

async function startSession(deps: Partial<MonitoringDeps>) {
  render(<MonitoringSession deps={deps} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /allow camera access/i }));
  });
}

describe("MonitoringSession — US2 presence + lifecycle", () => {
  it("manual Pause releases the camera and PATCHes paused (FR-006)", async () => {
    const h = makeUs2Deps();
    await startSession(h.deps);
    expect(screen.getByText(/getting a read on things/i)).toBeInTheDocument(); // warming-up

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^pause$/i }));
    });

    expect(h.patchStatus).toHaveBeenCalledWith("sid", "paused", "tok");
    expect(h.trackStop).toHaveBeenCalled(); // camera released on a manual pause
    expect(screen.getByText(/paused — taking a break/i)).toBeInTheDocument();
  });

  it("Resume re-acquires the camera and PATCHes active (a fresh recording warms up again)", async () => {
    const h = makeUs2Deps();
    await startSession(h.deps);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^pause$/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /resume/i }));
    });

    expect(h.deps.getUserMedia).toHaveBeenCalledTimes(2); // re-acquired
    expect(h.patchStatus).toHaveBeenCalledWith("sid", "active", "tok");
    expect(screen.getByText(/getting a read on things/i)).toBeInTheDocument(); // warming again
  });

  it("manual End releases the camera, ends reason=user, and navigates to the dashboard", async () => {
    const h = makeUs2Deps();
    await startSession(h.deps);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /end session/i }));
    });

    expect(h.endSession).toHaveBeenCalledWith("sid", "user", "tok");
    expect(h.trackStop).toHaveBeenCalled(); // End releases the camera
    expect(h.navigate).toHaveBeenCalledWith("/app");
  });

  it("out-of-frame auto-pause: 90 s no-face → PATCH out_of_frame + foggy surface, camera KEPT on", async () => {
    const h = makeUs2Deps();
    await startSession(h.deps);
    h.trackStop.mockClear();

    await act(async () => {
      h.presence().onOutOfFrame(); // the 90 s timer firing
    });

    expect(h.patchStatus).toHaveBeenCalledWith("sid", "out_of_frame", "tok");
    expect(screen.getByText(/waiting for you/i)).toBeInTheDocument();
    // The camera STAYS on for the self-view + return detection (unlike a manual pause/end).
    expect(h.trackStop).not.toHaveBeenCalled();
  });

  it("auto-resume: a return from out-of-frame PATCHes active and warms up again (SC-006)", async () => {
    const h = makeUs2Deps();
    await startSession(h.deps);
    await act(async () => {
      h.presence().onOutOfFrame();
    });

    await act(async () => {
      h.presence().onReturn(); // face came back
    });

    expect(h.patchStatus).toHaveBeenCalledWith("sid", "active", "tok");
    expect(screen.getByText(/getting a read on things/i)).toBeInTheDocument();
  });

  it("auto-end: 5 min absence → end reason=auto_absence + navigate", async () => {
    const h = makeUs2Deps();
    await startSession(h.deps);

    await act(async () => {
      h.presence().onAutoEnd();
    });

    expect(h.endSession).toHaveBeenCalledWith("sid", "auto_absence", "tok");
    expect(h.navigate).toHaveBeenCalledWith("/app");
  });

  it("re-end race: a manual End and a racing auto-end end + navigate EXACTLY ONCE", async () => {
    const h = makeUs2Deps();
    await startSession(h.deps);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /end session/i })); // reason=user
      h.presence().onAutoEnd(); // the 5-min timer firing in the same tick
    });

    // The single-end guard collapses the race onto the first caller; the loser is a no-op
    // (and even if both POSTs went out, the client maps the backend's 409 to success).
    expect(h.endSession).toHaveBeenCalledTimes(1);
    expect(h.endSession).toHaveBeenCalledWith("sid", "user", "tok");
    expect(h.navigate).toHaveBeenCalledTimes(1);
  });
});
