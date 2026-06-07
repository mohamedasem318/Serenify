import { describe, expect, it } from "vitest";

import { calibrateExit, resolveCalibrateMode } from "./calibrate-mode";

/**
 * The REAL mode-vs-has_anchor reconciliation (T026, clarification #3, FR-038/053).
 * No mocking — this is the calibrate route's load-bearing decision, exercised
 * directly across the full matrix so neither the recalibrate-redirect suppression
 * nor the stray-param fallback can silently regress.
 */
describe("resolveCalibrateMode — mode vs has_anchor reconciliation", () => {
  it("recalibrate WITH a baseline → recalibrate, redirect suppressed", () => {
    expect(resolveCalibrateMode({ paramMode: "recalibrate", hasAnchor: true })).toEqual({
      mode: "recalibrate",
      redirectToApp: false,
    });
  });

  it("recalibrate WITHOUT a baseline → first-time semantics, stays to calibrate", () => {
    // a stray ?mode=recalibrate never manufactures a recalibration (clarification #3)
    expect(resolveCalibrateMode({ paramMode: "recalibrate", hasAnchor: false })).toEqual({
      mode: "first-time",
      redirectToApp: false,
    });
  });

  it("bare /app/calibrate WITH a baseline → first-time + ST-17 redirect to /app", () => {
    expect(resolveCalibrateMode({ paramMode: undefined, hasAnchor: true })).toEqual({
      mode: "first-time",
      redirectToApp: true,
    });
  });

  it("bare /app/calibrate WITHOUT a baseline → first-time, stays to calibrate", () => {
    expect(resolveCalibrateMode({ paramMode: undefined, hasAnchor: false })).toEqual({
      mode: "first-time",
      redirectToApp: false,
    });
  });

  it("is conservative when has_anchor is null/undefined (RPC failure): never redirects, never recalibrates", () => {
    expect(resolveCalibrateMode({ paramMode: "recalibrate", hasAnchor: null })).toEqual({
      mode: "first-time",
      redirectToApp: false,
    });
    expect(resolveCalibrateMode({ paramMode: undefined, hasAnchor: undefined })).toEqual({
      mode: "first-time",
      redirectToApp: false,
    });
  });

  it("ignores non-'recalibrate' values and repeated array params", () => {
    expect(resolveCalibrateMode({ paramMode: "first-time", hasAnchor: true }).mode).toBe("first-time");
    expect(resolveCalibrateMode({ paramMode: "", hasAnchor: true }).mode).toBe("first-time");
    expect(resolveCalibrateMode({ paramMode: ["recalibrate", "x"], hasAnchor: true }).mode).toBe(
      "first-time",
    );
  });
});

describe("calibrateExit — mode-correct exit destinations (FR-053)", () => {
  it("first-time returns to /app (with the not-yet-calibrated banner)", () => {
    expect(calibrateExit("first-time")).toBe("/app");
  });

  it("recalibrate returns to /app/account (existing baseline intact)", () => {
    expect(calibrateExit("recalibrate")).toBe("/app/account");
  });
});
