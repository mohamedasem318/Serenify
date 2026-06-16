import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnchorRecorder, type RecorderDeps } from "./anchor-recorder";

/**
 * Honest boundary-seam tests (📌 DECISION-26): inject ONLY at the unavoidable I/O
 * boundary (getUserMedia, MediaRecorder, postAnchor/checkHealth, the detector, and
 * the Supabase write) and run the REAL orchestration — the reducer, the /healthz
 * gate, the framing-guide bypass, the timer, and the write-gating all execute.
 *
 * The detector is injected as `null` so the framing guide reports `unavailable` and
 * the soft gate is bypassed (`ready`) — which also exercises the never-lock-out
 * guarantee (FR-011 / analyze C1) in the US1 slice. With reduced-motion forced on,
 * every animated surface renders static, so the timer-driven flow is deterministic.
 */

// happy-dom's <video>.srcObject setter rejects a non-MediaStream; use a real
// happy-dom MediaStream instance (with a no-op getTracks for the release path).
function makeFakeStream(): MediaStream {
  const RealMediaStream = (globalThis as { MediaStream?: typeof MediaStream }).MediaStream;
  const stream: MediaStream = RealMediaStream
    ? new RealMediaStream()
    : ({ getTracks: () => [] } as unknown as MediaStream);
  const api = stream as unknown as {
    getTracks: () => MediaStreamTrack[];
    getVideoTracks: () => MediaStreamTrack[];
  };
  api.getTracks = () => [];
  api.getVideoTracks = () => []; // no tagged device → orchestrator remembers nothing
  return stream;
}

// A fake stream that reports which device it came from (via getVideoTracks +
// getSettings), so the orchestrator's "already on this device?" guard can compare
// the live stream against the picker selection (Bug 1).
function makeFakeStreamWithDevice(deviceId: string): MediaStream {
  const track = { stop: () => {}, getSettings: () => ({ deviceId }) } as unknown as MediaStreamTrack;
  const RealMediaStream = (globalThis as { MediaStream?: typeof MediaStream }).MediaStream;
  const stream: MediaStream = RealMediaStream ? new RealMediaStream() : ({} as MediaStream);
  const api = stream as unknown as {
    getTracks: () => MediaStreamTrack[];
    getVideoTracks: () => MediaStreamTrack[];
  };
  api.getTracks = () => [track];
  api.getVideoTracks = () => [track];
  return stream;
}

const TWO_CAMERAS = [
  { deviceId: "cam-A", kind: "videoinput", label: "Front", groupId: "g", toJSON: () => ({}) },
  { deviceId: "cam-B", kind: "videoinput", label: "Back", groupId: "g", toJSON: () => ({}) },
] as unknown as MediaDeviceInfo[];

/** Mock the device-enumeration I/O seam, run `body`, and always restore navigator. */
async function withCameras(
  enumerate: () => Promise<MediaDeviceInfo[]>,
  body: () => Promise<void>,
): Promise<void> {
  const original = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { enumerateDevices: enumerate },
  });
  try {
    await body();
  } finally {
    if (original) Object.defineProperty(navigator, "mediaDevices", original);
    else Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "mediaDevices");
  }
}

// A MediaRecorder that succeeds: stop() emits one chunk, then fires onstop.
class FakeRecorder {
  state = "inactive";
  mimeType = "video/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType }) });
    this.onstop?.();
  }
}

function buildDeps(over: Partial<RecorderDeps> = {}): {
  deps: Partial<RecorderDeps>;
  spies: {
    getUserMedia: ReturnType<typeof vi.fn>;
    postAnchor: ReturnType<typeof vi.fn>;
    writeAnchor: ReturnType<typeof vi.fn>;
    checkHealth: ReturnType<typeof vi.fn>;
    broadcastAnchorCaptured: ReturnType<typeof vi.fn>;
  };
} {
  const spies = {
    getUserMedia: vi.fn().mockResolvedValue(makeFakeStream()),
    postAnchor: vi.fn().mockResolvedValue({ ok: true, vectorB64: "QUJD", modelVersion: "v1", dim: 2958 }),
    writeAnchor: vi.fn().mockResolvedValue({ ok: true }),
    checkHealth: vi.fn().mockResolvedValue(true),
    broadcastAnchorCaptured: vi.fn(),
  };
  const deps: Partial<RecorderDeps> = {
    getUserMedia: spies.getUserMedia as RecorderDeps["getUserMedia"],
    createRecorder: () => new FakeRecorder(),
    postAnchor: spies.postAnchor as RecorderDeps["postAnchor"],
    checkHealth: spies.checkHealth as RecorderDeps["checkHealth"],
    createDetector: vi.fn().mockResolvedValue(null) as RecorderDeps["createDetector"],
    getSession: vi.fn().mockResolvedValue({ accessToken: "tok", userId: "user-1" }) as RecorderDeps["getSession"],
    writeAnchor: spies.writeAnchor as RecorderDeps["writeAnchor"],
    broadcastAnchorCaptured: spies.broadcastAnchorCaptured as RecorderDeps["broadcastAnchorCaptured"],
    probeCameraPermission: vi.fn().mockResolvedValue("prompt") as RecorderDeps["probeCameraPermission"],
    ...over,
  };
  return { deps, spies };
}

/** Advance fake timers AND flush the awaited I/O promises in between, inside act. */
async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  // Force reduced motion so framer-driven surfaces render static (no animation
  // loop competing with the fake-timer flow).
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

async function reachGreenRoom() {
  fireEvent.click(screen.getByRole("button", { name: /turn on camera/i }));
  await flush(); // probe + getUserMedia + PERMISSION_GRANTED
  await flush(); // <video> mounts → detector(null) → guide unavailable → gate bypassed
  await flush();
}

/**
 * From the green room: clear the /healthz gate and drain the 3·2·1 countdown into
 * recording. The countdown re-schedules each tick through a React passive effect,
 * which only flushes at each `act()` boundary — so advance ONE second per flush and
 * stop the moment the recording stage (its Stop control) appears.
 */
async function startRecording() {
  fireEvent.click(screen.getByRole("button", { name: /ready/i }));
  await flush(); // checkHealth → get-ready
  for (let i = 0; i < 6 && !screen.queryByRole("button", { name: /stop/i }); i += 1) {
    await flush(1000);
  }
}

describe("AnchorRecorder — US1 happy path (T017, FR-001–026)", () => {
  it("runs intro → green room → countdown → 60 s → success, writing the anchor only at the end", async () => {
    const onComplete = vi.fn();
    const { deps, spies } = buildDeps();
    render(<AnchorRecorder mode="first-time" onComplete={onComplete} onSkip={() => {}} deps={deps} />);

    // Intro → green room (camera acquired; never auto-records).
    await reachGreenRoom();
    expect(spies.getUserMedia).toHaveBeenCalledTimes(1);

    // Never locked out: detector unavailable ⇒ "I'm ready" is available (FR-011/C1).
    const ready = screen.getByRole("button", { name: /ready/i });
    expect(ready).toBeEnabled();
    // Nothing has touched the baseline yet.
    expect(spies.writeAnchor).not.toHaveBeenCalled();

    // "I'm ready" → /healthz ok → get-ready (3·2·1) → recording.
    await startRecording();
    expect(spies.checkHealth).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();

    // The full minute elapses → upload → write → success.
    await flush(61000);

    expect(screen.getByText(/your baseline is set/i)).toBeInTheDocument();
    // The ONLY clip egress is the single final POST on success; the write follows it.
    // (The network-level proof across BOTH framing phases is T031 / FR-050.)
    expect(spies.postAnchor).toHaveBeenCalledTimes(1);
    expect(spies.postAnchor.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(spies.writeAnchor).toHaveBeenCalledTimes(1);
    expect(spies.writeAnchor.mock.calls[0]?.[0]).toMatchObject({ userId: "user-1", vectorB64: "QUJD" });
    expect(spies.broadcastAnchorCaptured).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /back to home/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("AnchorRecorder — /healthz gate before the countdown (T016, FR-056)", () => {
  it("blocks the countdown and shows the calm gate copy when the backend is down", async () => {
    const { deps, spies } = buildDeps({
      checkHealth: vi.fn().mockResolvedValue(false) as RecorderDeps["checkHealth"],
    });
    render(<AnchorRecorder onComplete={() => {}} onSkip={() => {}} deps={deps} />);

    await reachGreenRoom();
    fireEvent.click(screen.getByRole("button", { name: /ready/i }));
    await flush();

    // Calm, foggy gate copy — and the countdown never started.
    expect(screen.getByText(/quiet moment/i)).toBeInTheDocument();
    expect(screen.queryByRole("timer")).toBeNull();
    expect(spies.postAnchor).not.toHaveBeenCalled();
    expect(spies.writeAnchor).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("recovers when the backend returns — the modal 'Try again' re-probes and advances", async () => {
    const checkHealth = vi
      .fn()
      .mockResolvedValueOnce(false) // first gate check → down (blocking modal)
      .mockResolvedValue(true); //     re-probe → healthy → advance
    const { deps } = buildDeps({ checkHealth: checkHealth as RecorderDeps["checkHealth"] });
    render(<AnchorRecorder onComplete={() => {}} onSkip={() => {}} deps={deps} />);

    await reachGreenRoom();
    fireEvent.click(screen.getByRole("button", { name: /ready/i }));
    await flush(); // → down, the blocking modal is up
    expect(screen.getByText(/quiet moment/i)).toBeInTheDocument();

    // The modal's foggy "Try again" re-probes /healthz; on success it dismisses and
    // the get-ready countdown begins (no dismiss path left "I'm ready" live).
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    for (let i = 0; i < 6 && !screen.queryByRole("button", { name: /stop/i }); i += 1) {
      await flush(1000);
    }
    expect(checkHealth).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
  });
});

describe("AnchorRecorder — overwrite-on-success-only (FR-053 / DECISION-22)", () => {
  it("does NOT write the anchor when extraction fails (422)", async () => {
    const postAnchor = vi.fn().mockResolvedValue({ ok: false, kind: "extraction_failed", reason: "no face" });
    const { deps, spies } = buildDeps({ postAnchor: postAnchor as RecorderDeps["postAnchor"] });
    render(<AnchorRecorder onComplete={() => {}} onSkip={() => {}} deps={deps} />);

    await reachGreenRoom();
    await startRecording();
    await flush(61000);

    expect(screen.getByText(/couldn.t set your baseline/i)).toBeInTheDocument();
    expect(postAnchor).toHaveBeenCalledTimes(1);
    expect(spies.writeAnchor).not.toHaveBeenCalled(); // baseline untouched on failure
  });
});

describe("AnchorRecorder — server reason drives the failure chip (006, T021/DECISION-30)", () => {
  it("shows the face-absence chip when the server reason is insufficient_face_frames", async () => {
    const postAnchor = vi
      .fn()
      .mockResolvedValue({ ok: false, kind: "extraction_failed", reason: "insufficient_face_frames" });
    const { deps } = buildDeps({ postAnchor: postAnchor as RecorderDeps["postAnchor"] });
    render(<AnchorRecorder onComplete={() => {}} onSkip={() => {}} deps={deps} />);

    await reachGreenRoom();
    await startRecording();
    await flush(61000);

    // Server-reason precedence: the face-absence chip overrides the empty-telemetry
    // (detector-unavailable → our-side) default — even though the detector was null.
    expect(
      screen.getByText(/couldn.t see your face for enough of that recording/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/on our side/i)).toBeNull();
  });

  it("still selects via dominantCause for any other reason (our-side when detector unavailable)", async () => {
    const postAnchor = vi
      .fn()
      .mockResolvedValue({ ok: false, kind: "extraction_failed", reason: "some other reason" });
    const { deps } = buildDeps({ postAnchor: postAnchor as RecorderDeps["postAnchor"] });
    render(<AnchorRecorder onComplete={() => {}} onSkip={() => {}} deps={deps} />);

    await reachGreenRoom();
    await startRecording();
    await flush(61000);

    // Unchanged: detector unavailable → empty telemetry → dominantCause → our-side.
    expect(screen.getByText(/on our side/i)).toBeInTheDocument();
    expect(screen.queryByText(/couldn.t see your face for enough/i)).toBeNull();
  });
});

describe("AnchorRecorder — getUserMedia error → the three calm states (FR-031–035)", () => {
  it("routes a busy camera to the camera-in-use state without a strike", async () => {
    const busy = Object.assign(new Error("in use"), { name: "NotReadableError" });
    const { deps, spies } = buildDeps({
      getUserMedia: vi.fn().mockRejectedValue(busy) as RecorderDeps["getUserMedia"],
    });
    render(<AnchorRecorder onComplete={() => {}} onSkip={() => {}} deps={deps} />);

    fireEvent.click(screen.getByRole("button", { name: /turn on camera/i }));
    await flush();
    await flush();

    expect(screen.getByRole("heading", { name: /camera.s in use/i })).toBeInTheDocument();
    expect(spies.writeAnchor).not.toHaveBeenCalled();
  });
});

describe("AnchorRecorder — switching camera re-acquires the live preview (Bug 1)", () => {
  it("stops the old tracks and re-calls getUserMedia with the new deviceId", async () => {
    await withCameras(
      () => Promise.resolve(TWO_CAMERAS),
      async () => {
        // getUserMedia returns a stream tagged with the device it was asked for
        // (video:true → the default, cam-A), so the live-device guard can compare.
        const getUserMedia = vi.fn().mockImplementation((c: MediaStreamConstraints) =>
          Promise.resolve(
            makeFakeStreamWithDevice(
              (c.video as { deviceId?: { exact?: string } })?.deviceId?.exact ?? "cam-A",
            ),
          ),
        );
        const { deps } = buildDeps({ getUserMedia: getUserMedia as RecorderDeps["getUserMedia"] });
        render(<AnchorRecorder onComplete={() => {}} onSkip={() => {}} deps={deps} />);

        await reachGreenRoom();
        // initial acquire only — the picker's echo of the ACTIVE camera is a no-op
        expect(getUserMedia).toHaveBeenCalledTimes(1);

        const select = screen.getByLabelText(/camera/i);
        await act(async () => {
          fireEvent.change(select, { target: { value: "cam-B" } });
          await flush();
        });

        // the preview follows the choice: re-acquired with the NEW deviceId
        expect(getUserMedia).toHaveBeenCalledTimes(2);
        expect(getUserMedia.mock.calls[1]?.[0]).toMatchObject({
          video: { deviceId: { exact: "cam-B" } },
        });
      },
    );
  });

  it("surfaces the camera-in-use state when the newly picked device is busy", async () => {
    await withCameras(
      () => Promise.resolve(TWO_CAMERAS),
      async () => {
        const getUserMedia = vi.fn().mockImplementation((c: MediaStreamConstraints) => {
          const id = (c.video as { deviceId?: { exact?: string } })?.deviceId?.exact;
          if (id === "cam-B") {
            return Promise.reject(Object.assign(new Error("busy"), { name: "NotReadableError" }));
          }
          return Promise.resolve(makeFakeStreamWithDevice(id ?? "cam-A"));
        });
        const { deps } = buildDeps({ getUserMedia: getUserMedia as RecorderDeps["getUserMedia"] });
        render(<AnchorRecorder onComplete={() => {}} onSkip={() => {}} deps={deps} />);

        await reachGreenRoom();
        const select = screen.getByLabelText(/camera/i);
        await act(async () => {
          fireEvent.change(select, { target: { value: "cam-B" } });
          await flush();
        });

        // picking a busy device makes the busy state reachable (Bug 1 secondary goal)
        expect(screen.getByRole("heading", { name: /camera.s in use/i })).toBeInTheDocument();
      },
    );
  });
});

describe("AnchorRecorder — busy/dead camera never locks the user out (Task 1)", () => {
  const CAMERA_KEY = "serenify-anchor-camera";

  it("falls back to the default when the remembered camera is busy on entry — no lockout", async () => {
    localStorage.setItem(CAMERA_KEY, "cam-A"); // remembered from a prior session, now busy
    const busy = Object.assign(new Error("in use"), { name: "NotReadableError" });
    const getUserMedia = vi.fn().mockImplementation((c: MediaStreamConstraints) => {
      const exact = (c.video as { deviceId?: { exact?: string } })?.deviceId?.exact;
      if (exact === "cam-A") return Promise.reject(busy); // the remembered device is busy
      return Promise.resolve(makeFakeStreamWithDevice(exact ?? "cam-default")); // default works
    });
    const { deps } = buildDeps({ getUserMedia: getUserMedia as RecorderDeps["getUserMedia"] });
    render(<AnchorRecorder onComplete={() => {}} onSkip={() => {}} deps={deps} />);

    fireEvent.click(screen.getByRole("button", { name: /turn on camera/i }));
    await flush();
    await flush();
    await flush();

    // recovered into the green room on the default — NOT stuck on the busy screen
    expect(screen.queryByRole("heading", { name: /camera.s in use/i })).toBeNull();
    expect(screen.getByRole("button", { name: /ready/i })).toBeInTheDocument();
    // tried the remembered device, then fell back to the default
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    // the dead key is repaired to the device that actually started
    expect(localStorage.getItem(CAMERA_KEY)).not.toBe("cam-A");
  });

  it("never remembers a device that failed to acquire (a busy pick keeps the prior good camera)", async () => {
    await withCameras(
      () => Promise.resolve(TWO_CAMERAS),
      async () => {
        const getUserMedia = vi.fn().mockImplementation((c: MediaStreamConstraints) => {
          const exact = (c.video as { deviceId?: { exact?: string } })?.deviceId?.exact;
          if (exact === "cam-B") {
            return Promise.reject(Object.assign(new Error("busy"), { name: "NotReadableError" }));
          }
          return Promise.resolve(makeFakeStreamWithDevice(exact ?? "cam-A"));
        });
        const { deps } = buildDeps({ getUserMedia: getUserMedia as RecorderDeps["getUserMedia"] });
        render(<AnchorRecorder onComplete={() => {}} onSkip={() => {}} deps={deps} />);

        await reachGreenRoom(); // acquires the default (cam-A) → cam-A remembered
        expect(localStorage.getItem(CAMERA_KEY)).toBe("cam-A");

        const select = screen.getByLabelText(/camera/i);
        await act(async () => {
          fireEvent.change(select, { target: { value: "cam-B" } });
          await flush();
        });

        // cam-B failed → it must NOT be remembered; cam-A (the last good one) stays
        expect(screen.getByRole("heading", { name: /camera.s in use/i })).toBeInTheDocument();
        expect(localStorage.getItem(CAMERA_KEY)).toBe("cam-A");
      },
    );
  });

  it("'Try again' after a busy state reaches a working camera once it's freed (not re-trapped)", async () => {
    const busy = Object.assign(new Error("in use"), { name: "NotReadableError" });
    let freed = false;
    const getUserMedia = vi.fn().mockImplementation(() =>
      freed ? Promise.resolve(makeFakeStreamWithDevice("cam-A")) : Promise.reject(busy),
    );
    const { deps } = buildDeps({ getUserMedia: getUserMedia as RecorderDeps["getUserMedia"] });
    render(<AnchorRecorder onComplete={() => {}} onSkip={() => {}} deps={deps} />);

    fireEvent.click(screen.getByRole("button", { name: /turn on camera/i }));
    await flush();
    await flush();
    expect(screen.getByRole("heading", { name: /camera.s in use/i })).toBeInTheDocument();

    // the user frees the camera, then taps Try again → reaches the green room
    freed = true;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await flush();
    await flush();
    await flush();

    expect(screen.queryByRole("heading", { name: /camera.s in use/i })).toBeNull();
    expect(screen.getByRole("button", { name: /ready/i })).toBeInTheDocument();
  });
});
