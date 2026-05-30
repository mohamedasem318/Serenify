import { describe, expect, it } from "vitest";

import { accumulate, dominantCause, emptyTelemetry } from "./cause-telemetry";
import { CENTRE_MAX, LUMA_MIN, type FramingSignal } from "./framing";

function sig(over: Partial<FramingSignal> = {}): FramingSignal {
  return { facePresent: true, centreDistance: 0, sizeRatio: 0.4, brightness: 200, at: 0, ...over };
}

describe("cause-telemetry — dominantCause (📌 DECISION-24)", () => {
  it("defaults to our-side when the detector never ran (no frames)", () => {
    const t = emptyTelemetry();
    expect(t.detectorAvailable).toBe(false);
    expect(dominantCause(t)).toBe("our-side");
  });

  it("stays our-side when frames were measured but nothing adverse dominates", () => {
    const t = emptyTelemetry();
    for (let i = 0; i < 10; i += 1) accumulate(t, sig({ at: i }));
    expect(t.detectorAvailable).toBe(true);
    expect(dominantCause(t)).toBe("our-side"); // we don't blame the user for a clean run
  });

  it("reports low-light when most frames are below the brightness floor", () => {
    const t = emptyTelemetry();
    for (let i = 0; i < 10; i += 1) accumulate(t, sig({ brightness: i < 6 ? LUMA_MIN - 10 : 200, at: i }));
    expect(dominantCause(t)).toBe("low-light");
  });

  it("reports out-of-frame when most frames are off-centre or absent", () => {
    const t = emptyTelemetry();
    for (let i = 0; i < 10; i += 1) {
      accumulate(t, sig({ facePresent: i >= 6, centreDistance: i < 6 ? CENTRE_MAX + 0.2 : 0, at: i }));
    }
    expect(dominantCause(t)).toBe("out-of-frame");
  });

  it("picks the dominant of the two when both adverse signals are present", () => {
    const t = emptyTelemetry();
    // 7 dark vs 4 off-centre → low-light dominates
    for (let i = 0; i < 10; i += 1) {
      accumulate(t, sig({ brightness: i < 7 ? 10 : 200, centreDistance: i < 4 ? CENTRE_MAX + 0.2 : 0, at: i }));
    }
    expect(dominantCause(t)).toBe("low-light");
  });

  it("does not claim a cause that affects fewer than the dominance threshold of frames", () => {
    const t = emptyTelemetry();
    // 3/10 dark (< 0.35) → not dominant → our-side
    for (let i = 0; i < 10; i += 1) accumulate(t, sig({ brightness: i < 3 ? 10 : 200, at: i }));
    expect(dominantCause(t)).toBe("our-side");
  });
});
