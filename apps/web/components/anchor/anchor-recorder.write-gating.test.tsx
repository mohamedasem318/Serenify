import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnchorRecorder, type RecorderDeps } from "./anchor-recorder";

/**
 * T027 — overwrite-on-success-only + mode-correct exits (📌 DECISION-22/23,
 * FR-053). The write IS the only thing that touches a user's stored baseline, so
 * this proves it at the REAL I/O boundary: the Supabase client is injected (via the
 * module mock below) and the orchestrator's REAL `getSession` + `writeAnchor` run
 * against it. Nothing about the write-gating itself is mocked — the real
 * orchestration decides whether `.update()` ever fires.
 *
 * The single write is an in-place `update("profiles", …anchor columns…).eq("id",
 * userId)` — the SAME row keyed by the owner's id, for first-time and recalibrate
 * alike. There is no insert and no history row: "first set" and "overwrite" are the
 * one update, which is why a recalibration that aborts or fails leaves the prior
 * baseline exactly as it was (FR-053). The asserted call below makes that visible.
 */

// The injected Supabase client. vi.hoisted runs before the vi.mock factory, so the
// factory can hand back this exact instance and the test can spy on every link of
// the `from(...).update(...).eq(...)` chain plus auth.getSession.
const supa = vi.hoisted(() => {
  // Typed call signatures (via the vi.fn generic) so `mock.calls` carries the real
  // argument types — no named params, so nothing reads as unused.
  const eq = vi.fn<(col: string, val: string) => Promise<{ error: null }>>(() =>
    Promise.resolve({ error: null }),
  );
  const update = vi.fn<(payload: Record<string, unknown>) => { eq: typeof eq }>(() => ({ eq }));
  const from = vi.fn<(table: string) => { update: typeof update }>(() => ({ update }));
  const getSession = vi.fn(() =>
    Promise.resolve({ data: { session: { access_token: "tok", user: { id: "user-1" } } } }),
  );
  return { client: { auth: { getSession }, from }, eq, update, from, getSession };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => supa.client,
}));

// happy-dom's <video>.srcObject setter rejects a non-MediaStream; use a real
// MediaStream with no-op track accessors (no tagged device → nothing remembered).
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
  api.getVideoTracks = () => [];
  return stream;
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

/**
 * Boundary deps with the REAL `getSession` + `writeAnchor` left intact (so they run
 * against the injected Supabase client). Everything that cannot run in happy-dom —
 * getUserMedia, MediaRecorder, the detector, postAnchor, checkHealth — is the
 * injected seam. The detector is null ⇒ the framing gate is bypassed (never locked
 * out), so the flow is timer-deterministic.
 */
function baseDeps(over: Partial<RecorderDeps> = {}): Partial<RecorderDeps> {
  return {
    getUserMedia: vi.fn().mockResolvedValue(makeFakeStream()) as RecorderDeps["getUserMedia"],
    createRecorder: () => new FakeRecorder(),
    postAnchor: vi
      .fn()
      .mockResolvedValue({ ok: true, vectorB64: "QUJD", modelVersion: "v1", dim: 2958 }) as RecorderDeps["postAnchor"],
    checkHealth: vi.fn().mockResolvedValue(true) as RecorderDeps["checkHealth"],
    createDetector: vi.fn().mockResolvedValue(null) as RecorderDeps["createDetector"],
    broadcastAnchorCaptured: vi.fn() as RecorderDeps["broadcastAnchorCaptured"],
    probeCameraPermission: vi.fn().mockResolvedValue("prompt") as RecorderDeps["probeCameraPermission"],
    // getSession + writeAnchor intentionally omitted → the real defaultDeps()
    // versions run against the mocked Supabase client.
    ...over,
  };
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function reachGreenRoom() {
  fireEvent.click(screen.getByRole("button", { name: /turn on camera/i }));
  await flush();
  await flush();
  await flush();
}

async function startRecording() {
  fireEvent.click(screen.getByRole("button", { name: /ready/i }));
  await flush(); // checkHealth → get-ready
  for (let i = 0; i < 6 && !screen.queryByRole("button", { name: /stop/i }); i += 1) {
    await flush(1000);
  }
}

/** From the green room: record the full minute (post → 422 by default deps). */
async function recordFullMinute() {
  await startRecording();
  await flush(61000);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Re-assert the injected client's behaviour every test (cleared counts, stable impl).
  supa.eq.mockReturnValue(Promise.resolve({ error: null }));
  supa.update.mockReturnValue({ eq: supa.eq });
  supa.from.mockReturnValue({ update: supa.update });
  supa.getSession.mockResolvedValue({
    data: { session: { access_token: "tok", user: { id: "user-1" } } },
  });
  vi.useFakeTimers();
  // reduced motion on ⇒ framer surfaces render static, so the fake-timer flow is deterministic.
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
  localStorage.clear();
});

describe("T027 — the write fires ONLY on a successful capture (the actual UPDATE)", () => {
  it("first-time success → exactly one in-place update of the owner's anchor columns", async () => {
    const onComplete = vi.fn();
    render(<AnchorRecorder mode="first-time" onComplete={onComplete} onSkip={() => {}} deps={baseDeps()} />);

    await reachGreenRoom();
    expect(supa.update).not.toHaveBeenCalled(); // nothing written before success
    await recordFullMinute();

    expect(screen.getByText(/your baseline is set/i)).toBeInTheDocument();
    // THE write call — one UPDATE of the profiles row, keyed by the owner's id.
    expect(supa.from).toHaveBeenCalledWith("profiles");
    expect(supa.update).toHaveBeenCalledTimes(1);
    expect(supa.update.mock.calls[0]?.[0]).toMatchObject({
      anchor_vector: "\\x414243", // decode(QUJD) → bytea hex literal
      anchor_model_version: "v1",
    });
    expect(supa.update.mock.calls[0]?.[0]).toHaveProperty("anchor_captured_at");
    expect(supa.eq).toHaveBeenCalledWith("id", "user-1"); // same row → overwrite, not insert

    fireEvent.click(screen.getByRole("button", { name: /back to home/i }));
    expect(onComplete).toHaveBeenCalledTimes(1); // first-time exit
  });

  it("recalibrate success → overwrites the SAME row in place (no insert, no history)", async () => {
    const onComplete = vi.fn();
    render(<AnchorRecorder mode="recalibrate" onComplete={onComplete} onSkip={() => {}} deps={baseDeps()} />);

    await reachGreenRoom();
    await recordFullMinute();

    expect(screen.getByText(/your baseline is updated/i)).toBeInTheDocument();
    expect(supa.update).toHaveBeenCalledTimes(1); // overwrite is the same single update
    expect(supa.eq).toHaveBeenCalledWith("id", "user-1");

    fireEvent.click(screen.getByRole("button", { name: /back to account/i }));
    expect(onComplete).toHaveBeenCalledTimes(1); // recalibrate exit
  });
});

describe("T027 — the write does NOT fire on any abort or defer (baseline untouched)", () => {
  it("stop → 'Start over' returns to the green room and writes nothing", async () => {
    render(<AnchorRecorder mode="recalibrate" onComplete={() => {}} onSkip={() => {}} deps={baseDeps()} />);

    await reachGreenRoom();
    await startRecording();
    fireEvent.click(screen.getByRole("button", { name: /stop/i })); // → stop-confirming
    fireEvent.click(screen.getByRole("button", { name: /start over/i })); // → green room

    expect(screen.getByRole("button", { name: /ready/i })).toBeInTheDocument(); // re-situating
    expect(supa.update).not.toHaveBeenCalled();
  });

  it("processing failure (422) shows the failure state and writes nothing", async () => {
    const deps = baseDeps({
      postAnchor: vi
        .fn()
        .mockResolvedValue({ ok: false, kind: "extraction_failed", reason: "no_face" }) as RecorderDeps["postAnchor"],
    });
    render(<AnchorRecorder mode="recalibrate" onComplete={() => {}} onSkip={() => {}} deps={deps} />);

    await reachGreenRoom();
    await recordFullMinute();

    expect(screen.getByText(/couldn.t set your baseline/i)).toBeInTheDocument();
    expect(supa.update).not.toHaveBeenCalled(); // prior baseline untouched on failure
  });

  it("'Not now' from the green room defers without writing, exiting per mode", async () => {
    const onSkip = vi.fn();
    render(<AnchorRecorder mode="recalibrate" onComplete={() => {}} onSkip={onSkip} deps={baseDeps()} />);

    await reachGreenRoom();
    fireEvent.click(screen.getByRole("button", { name: /not now/i }));

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(supa.update).not.toHaveBeenCalled();
  });

  it("'Maybe later' at the failure escape defers without writing", async () => {
    const onSkip = vi.fn();
    const deps = baseDeps({
      postAnchor: vi
        .fn()
        .mockResolvedValue({ ok: false, kind: "extraction_failed", reason: "no_face" }) as RecorderDeps["postAnchor"],
    });
    render(<AnchorRecorder mode="recalibrate" onComplete={() => {}} onSkip={onSkip} deps={deps} />);

    // three consecutive 422s reach the gentle escape (failureCount ≥ 3, FR-030).
    await reachGreenRoom();
    await recordFullMinute(); // strike 1
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await flush();
    await flush();
    await flush();
    await recordFullMinute(); // strike 2
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await flush();
    await flush();
    await flush();
    await recordFullMinute(); // strike 3 → escape

    const maybeLater = screen.getByRole("button", { name: /maybe later/i });
    fireEvent.click(maybeLater);

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(supa.update).not.toHaveBeenCalled(); // never written across three failed minutes
  });
});
