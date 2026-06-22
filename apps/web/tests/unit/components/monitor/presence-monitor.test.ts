import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTO_END_AFTER_MS,
  createPresenceMonitor,
  OUT_OF_FRAME_AFTER_MS,
  type PresenceCallbacks,
} from "@/components/monitor/presence-monitor";

/**
 * Feature 008 / US2 — T041: the two absence timers (FR-005 / SC-006). Driven by REAL
 * `setTimeout`s under Vitest fake timers — the deterministic core the orchestrator wires
 * to the face-detection signal. No DOM, no React — pure timing.
 */

function setup() {
  const cb: PresenceCallbacks = {
    onOutOfFrame: vi.fn(),
    onReturn: vi.fn(),
    onAutoEnd: vi.fn(),
  };
  return { cb, m: createPresenceMonitor(cb) };
}

describe("createPresenceMonitor — 90 s auto-pause / 5 min auto-end", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("exposes the FR-005 thresholds (90 s / 5 min)", () => {
    expect(OUT_OF_FRAME_AFTER_MS).toBe(90_000);
    expect(AUTO_END_AFTER_MS).toBe(300_000);
  });

  it("fires onOutOfFrame after exactly 90 s of continuous no-face — not a tick before", () => {
    const { cb, m } = setup();
    m.faceLost();
    vi.advanceTimersByTime(OUT_OF_FRAME_AFTER_MS - 1);
    expect(cb.onOutOfFrame).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb.onOutOfFrame).toHaveBeenCalledTimes(1);
    expect(cb.onAutoEnd).not.toHaveBeenCalled();
  });

  it("fires onAutoEnd after 5 min of continuous absence (90 s out-of-frame, then 3.5 min more)", () => {
    const { cb, m } = setup();
    m.faceLost();
    vi.advanceTimersByTime(OUT_OF_FRAME_AFTER_MS);
    expect(cb.onOutOfFrame).toHaveBeenCalledTimes(1);
    expect(cb.onAutoEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(AUTO_END_AFTER_MS - OUT_OF_FRAME_AFTER_MS);
    expect(cb.onAutoEnd).toHaveBeenCalledTimes(1);
  });

  it("a return before 90 s cancels BOTH timers and fires onReturn (SC-006 auto-resume)", () => {
    const { cb, m } = setup();
    m.faceLost();
    vi.advanceTimersByTime(80_000);
    m.faceSeen();
    expect(cb.onReturn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(600_000);
    expect(cb.onOutOfFrame).not.toHaveBeenCalled();
    expect(cb.onAutoEnd).not.toHaveBeenCalled();
  });

  it("a return AFTER out-of-frame cancels the pending auto-end", () => {
    const { cb, m } = setup();
    m.faceLost();
    vi.advanceTimersByTime(OUT_OF_FRAME_AFTER_MS); // out-of-frame
    vi.advanceTimersByTime(60_000); // still absent at ~2.5 min
    m.faceSeen(); // they come back
    expect(cb.onReturn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(600_000);
    expect(cb.onAutoEnd).not.toHaveBeenCalled();
  });

  it("any face reappearance resets the continuous-absence clock (flicker → restart)", () => {
    const { cb, m } = setup();
    m.faceLost();
    vi.advanceTimersByTime(89_000);
    m.faceSeen(); // a single present frame resets the clock
    m.faceLost(); // gone again — the 90 s restarts from zero
    vi.advanceTimersByTime(89_000);
    expect(cb.onOutOfFrame).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(cb.onOutOfFrame).toHaveBeenCalledTimes(1);
  });

  it("repeated faceLost while already absent does not restart or stack the timers", () => {
    const { cb, m } = setup();
    m.faceLost();
    vi.advanceTimersByTime(50_000);
    m.faceLost();
    m.faceLost(); // no-ops — the continuous clock keeps running
    vi.advanceTimersByTime(40_000); // 90 s since the FIRST loss
    expect(cb.onOutOfFrame).toHaveBeenCalledTimes(1);
  });

  it("faceSeen with no prior absence is a no-op (no spurious onReturn)", () => {
    const { cb, m } = setup();
    m.faceSeen();
    m.faceSeen();
    expect(cb.onReturn).not.toHaveBeenCalled();
  });

  it("stop() cancels all pending timers (manual pause / end / unmount)", () => {
    const { cb, m } = setup();
    m.faceLost();
    m.stop();
    vi.advanceTimersByTime(600_000);
    expect(cb.onOutOfFrame).not.toHaveBeenCalled();
    expect(cb.onAutoEnd).not.toHaveBeenCalled();
  });
});
