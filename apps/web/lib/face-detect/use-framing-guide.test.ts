import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DetectorHandle } from "./detector";
import { useFramingGuide } from "./use-framing-guide";

function makeVideo(): HTMLVideoElement {
  return document.createElement("video");
}

describe("useFramingGuide lifecycle (📌 DECISION-26 — real wiring, injected detector)", () => {
  it("starts in 'loading' while no video is attached", () => {
    const { result } = renderHook(() =>
      useFramingGuide({ video: null, phase: "green-room", createDetector: vi.fn() }),
    );
    expect(result.current.guide).toBe("loading");
    expect(result.current.ready).toBe(false);
  });

  it("falls back to 'unavailable' and BYPASSES the gate when the detector cannot run (FR-011)", async () => {
    const createDetector = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() =>
      useFramingGuide({ video: makeVideo(), phase: "green-room", createDetector }),
    );
    await waitFor(() => expect(result.current.guide).toBe("unavailable"));
    // never locked out: gate cleared + ready so "I'm ready" is available
    expect(result.current.gate).toBe("ready");
    expect(result.current.ready).toBe(true);
    expect(createDetector).toHaveBeenCalled();
  });

  it("goes 'active' once the detector resolves", async () => {
    const handle: DetectorHandle = { detect: () => null, close: vi.fn() };
    const createDetector = vi.fn().mockResolvedValue(handle);
    const { result } = renderHook(() =>
      useFramingGuide({ video: makeVideo(), phase: "green-room", createDetector }),
    );
    await waitFor(() => expect(result.current.guide).toBe("active"));
  });

  it("closes the detector handle on unmount", async () => {
    const handle: DetectorHandle = { detect: () => null, close: vi.fn() };
    const createDetector = vi.fn().mockResolvedValue(handle);
    const { result, unmount } = renderHook(() =>
      useFramingGuide({ video: makeVideo(), phase: "green-room", createDetector }),
    );
    await waitFor(() => expect(result.current.guide).toBe("active"));
    unmount();
    expect(handle.close).toHaveBeenCalled();
  });
});
