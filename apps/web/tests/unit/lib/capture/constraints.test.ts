import { describe, expect, it } from "vitest";

import {
  CAPTURE_VIDEO_CONSTRAINTS,
  captureVideoConstraints,
} from "@/lib/capture/constraints";

/**
 * The shared capture settings. Guards the two load-bearing properties: ideal-only
 * caps at the training operating point (1280×720@15 — docs/MODELS.md), and the
 * deviceId pin staying a pick, not a capability constraint.
 */

describe("CAPTURE_VIDEO_CONSTRAINTS", () => {
  it("targets the StressID training operating point, ideal-only", () => {
    expect(CAPTURE_VIDEO_CONSTRAINTS).toEqual({
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 15 },
    });
  });

  it("never uses exact on a capability constraint (Safari rejects exact readily)", () => {
    expect(JSON.stringify(CAPTURE_VIDEO_CONSTRAINTS)).not.toContain("exact");
  });
});

describe("captureVideoConstraints", () => {
  it("without a device: the shared caps, no deviceId key", () => {
    const c = captureVideoConstraints();
    expect(c).toEqual(CAPTURE_VIDEO_CONSTRAINTS);
    expect("deviceId" in c).toBe(false);
  });

  it("with a device: same caps plus an exact deviceId pin (a pick, with caller fallback)", () => {
    expect(captureVideoConstraints("cam-1")).toEqual({
      ...CAPTURE_VIDEO_CONSTRAINTS,
      deviceId: { exact: "cam-1" },
    });
  });

  it("returns a fresh object each call (callers may merge into it)", () => {
    expect(captureVideoConstraints()).not.toBe(CAPTURE_VIDEO_CONSTRAINTS);
  });
});
