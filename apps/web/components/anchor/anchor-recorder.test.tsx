import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkHealth, postAnchor } from "@/lib/api/anchor-client";

import { AnchorRecorder } from "./anchor-recorder";

// The recorder talks to the FastAPI client, the user's Supabase session, and the
// cross-tab broadcaster. Stub all three so the test exercises the component's own
// state transitions, not those collaborators.
vi.mock("@/lib/api/anchor-client", () => ({
  checkHealth: vi.fn(),
  postAnchor: vi.fn(),
}));
vi.mock("@/lib/auth-broadcast", () => ({ broadcastAnchorCaptured: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
  }),
}));

const mockedCheckHealth = vi.mocked(checkHealth);
const mockedPostAnchor = vi.mocked(postAnchor);

/**
 * A getUserMedia + MediaRecorder that actually SUCCEED, so the only thing that
 * can stop the recorder reaching the `recording` state (the preview + countdown)
 * is the health gate itself. Without working camera stubs, a regression test
 * could pass for the wrong reason — getUserMedia rejecting, not the health gate.
 */
function installWorkingCameraStubs() {
  // happy-dom's <video>.srcObject setter rejects anything that is not a real
  // MediaStream, and the recorder assigns the stream to the preview the moment
  // it reaches `recording`. Use happy-dom's own MediaStream so the pre-fix code
  // genuinely paints the preview + countdown (the regression) instead of
  // throwing — otherwise the test would fail for the wrong reason.
  const RealMediaStream = (globalThis as { MediaStream?: typeof MediaStream }).MediaStream;
  const fakeStream: MediaStream = RealMediaStream
    ? new RealMediaStream()
    : ({ getTracks: () => [] } as unknown as MediaStream);
  // happy-dom's MediaStream instance satisfies the srcObject instanceof check but
  // does not implement getTracks(); the recorder calls it when releasing the
  // camera on unmount, so give the instance a no-op tracks list.
  (fakeStream as unknown as { getTracks?: () => MediaStreamTrack[] }).getTracks = () => [];
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue(fakeStream),
      enumerateDevices: vi.fn().mockResolvedValue([]),
    },
  });

  class FakeMediaRecorder {
    state = "inactive";
    mimeType: string;
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    constructor(_s: MediaStream, opts?: { mimeType?: string }) {
      this.mimeType = opts?.mimeType ?? "video/webm";
    }
    static isTypeSupported() {
      return true;
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob([new Uint8Array([0])], { type: this.mimeType }) });
      this.onstop?.();
    }
  }
  Object.defineProperty(window, "MediaRecorder", {
    configurable: true,
    writable: true,
    value: FakeMediaRecorder,
  });

  // Countdown reads prefers-reduced-motion; happy-dom needs matchMedia stubbed.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  installWorkingCameraStubs();
  mockedPostAnchor.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const UNAVAILABLE = /temporarily unavailable/i;

describe("AnchorRecorder — health pre-check gates the recording UI (ST-18 / FR-048)", () => {
  it("never paints the preview + countdown when the backend dies after a healthy mount", async () => {
    // Mount probe succeeds (backend up); every later probe fails (backend died).
    mockedCheckHealth.mockResolvedValueOnce(true).mockResolvedValue(false);

    render(<AnchorRecorder onComplete={() => {}} onSkip={() => {}} />);

    // Health resolved up → the live Start button appears.
    const start = await screen.findByRole("button", { name: "Start recording" });

    fireEvent.click(start);

    // The Start re-check must surface the unavailable copy WITHOUT ever painting
    // the countdown. On the pre-fix recorder (no awaited re-check) the click
    // would optimistically reach `recording` and render the timer — the
    // assertion below catches exactly that regression.
    await waitFor(() => expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument());
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.queryByRole("button", { name: "Start recording" })).toBeNull();
    // Recording-state side effects must never have fired.
    expect(mockedPostAnchor).not.toHaveBeenCalled();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it("shows the unavailable copy and no Start button when the backend is down on mount (bonus)", async () => {
    mockedCheckHealth.mockResolvedValue(false);

    render(<AnchorRecorder onComplete={() => {}} onSkip={() => {}} />);

    await waitFor(() => expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Start recording" })).toBeNull();
    expect(screen.queryByRole("timer")).toBeNull();
    // Skip is always available in the unavailable state (FR-007/048).
    expect(screen.getByRole("button", { name: "Skip for now" })).toBeInTheDocument();
  });

  it("records normally when the backend is healthy on both the mount probe and the Start re-check", async () => {
    mockedCheckHealth.mockResolvedValue(true);

    render(<AnchorRecorder onComplete={() => {}} onSkip={() => {}} />);

    const start = await screen.findByRole("button", { name: "Start recording" });
    fireEvent.click(start);

    // Re-check passed → permission granted → recording: the countdown paints.
    await waitFor(() => expect(screen.getByRole("timer")).toBeInTheDocument());
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });
});
