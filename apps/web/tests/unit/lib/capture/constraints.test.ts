import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CAPTURE_VIDEO_CONSTRAINTS,
  captureVideoConstraints,
  isAppleWebKit,
  pickCaptureMimeType,
} from "@/lib/capture/constraints";

/**
 * The shared capture settings (Phase 2, docs/triage/mobile-capture-diagnosis.md).
 * Guards the three load-bearing properties: ideal-only caps at the training operating
 * point (1280×720@15), engine-aware container negotiation (fMP4-first on Apple WebKit
 * — Safari's webm claim routes into the #89 server decode death), and the deviceId
 * pin staying a pick, not a capability constraint.
 */

function stubEngine(vendor: string, supported: (type: string) => boolean) {
  vi.stubGlobal("navigator", { vendor });
  vi.stubGlobal(
    "MediaRecorder",
    class {
      static isTypeSupported = supported;
    },
  );
}

afterEach(() => vi.unstubAllGlobals());

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

describe("isAppleWebKit", () => {
  it("true on the frozen Apple vendor string, false on Chromium's and Firefox's", () => {
    vi.stubGlobal("navigator", { vendor: "Apple Computer, Inc." });
    expect(isAppleWebKit()).toBe(true);
    vi.stubGlobal("navigator", { vendor: "Google Inc." });
    expect(isAppleWebKit()).toBe(false);
    vi.stubGlobal("navigator", { vendor: "" });
    expect(isAppleWebKit()).toBe(false);
  });
});

describe("pickCaptureMimeType — non-Apple engines (unchanged behavior)", () => {
  it("everything supported picks webm/vp9 (the shipped healthy path)", () => {
    stubEngine("Google Inc.", () => true);
    expect(pickCaptureMimeType()).toEqual({ ok: true, mimeType: "video/webm;codecs=vp9" });
  });

  it("falls through the webm ladder vp9 → vp8 → generic", () => {
    stubEngine("Google Inc.", (t) => t === "video/webm;codecs=vp8" || t === "video/webm");
    expect(pickCaptureMimeType()).toEqual({ ok: true, mimeType: "video/webm;codecs=vp8" });
    stubEngine("Google Inc.", (t) => t === "video/webm");
    expect(pickCaptureMimeType()).toEqual({ ok: true, mimeType: "video/webm" });
  });

  it("keeps fMP4 as the trailing fallback when no webm is supported", () => {
    // The T009/T026 posture on non-Apple engines: never hard-code one container.
    stubEngine("Google Inc.", (t) => t.startsWith("video/mp4"));
    expect(pickCaptureMimeType()).toEqual({ ok: true, mimeType: "video/mp4;codecs=avc1.42E01E" });
  });

  it("nothing supported → ok with no mimeType (browser default recorder)", () => {
    stubEngine("Google Inc.", () => false);
    expect(pickCaptureMimeType()).toEqual({ ok: true, mimeType: undefined });
  });

  it("no MediaRecorder at all → ok with no mimeType", () => {
    vi.stubGlobal("navigator", { vendor: "Google Inc." });
    vi.stubGlobal("MediaRecorder", undefined);
    expect(pickCaptureMimeType()).toEqual({ ok: true, mimeType: undefined });
  });
});

describe("pickCaptureMimeType — Apple WebKit records fMP4 or nothing", () => {
  it("everything supported picks explicit-codec fMP4 — the webm claim must lose", () => {
    // Safari 26 reports true for ALL webm types (the exact condition that routed iOS
    // into #89 under webm-first negotiation); fMP4 must still win on Apple engines.
    stubEngine("Apple Computer, Inc.", () => true);
    expect(pickCaptureMimeType()).toEqual({ ok: true, mimeType: "video/mp4;codecs=avc1.42E01E" });
  });

  it("without the explicit avc1 profile falls to bare video/mp4", () => {
    stubEngine("Apple Computer, Inc.", (t) => !t.includes("avc1"));
    expect(pickCaptureMimeType()).toEqual({ ok: true, mimeType: "video/mp4" });
  });

  it("NEVER falls back to webm, even when webm is the only thing claimed supported", () => {
    // The load-bearing case, and the exact three-iPhone condition: every webm type
    // reports supported, and recording one produces ~45 MB of undecodable video. So a
    // claimed-supported webm is not a fallback here — it is the failure we are avoiding.
    // Inverted 2026-08-07: this previously asserted a webm fallback.
    stubEngine("Apple Computer, Inc.", (t) => t.startsWith("video/webm"));
    expect(pickCaptureMimeType()).toEqual({ ok: false, reason: "no-supported-container" });
  });

  it("never returns a webm mimeType under ANY support matrix", () => {
    // Exhaustive over every subset of the candidate types: whatever Apple WebKit claims,
    // the negotiation either yields an mp4 or fails. No support matrix can produce webm.
    const ALL = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4;codecs=avc1.42E01E",
      "video/mp4",
    ];
    for (let mask = 0; mask < 1 << ALL.length; mask += 1) {
      const supported = new Set(ALL.filter((_, i) => mask & (1 << i)));
      stubEngine("Apple Computer, Inc.", (t) => supported.has(t));
      const choice = pickCaptureMimeType();
      if (choice.ok) expect(choice.mimeType).toMatch(/^video\/mp4/);
      else expect(choice.reason).toBe("no-supported-container");
    }
  });

  it("nothing supported at all → fails rather than the browser default", () => {
    // Browser-default is ruled out on Apple too: the default container is chosen by the
    // same engine whose self-report we just established we cannot trust.
    stubEngine("Apple Computer, Inc.", () => false);
    expect(pickCaptureMimeType()).toEqual({ ok: false, reason: "no-supported-container" });
  });

  it("no MediaRecorder at all → fails (we cannot claim an mp4 we never confirmed)", () => {
    vi.stubGlobal("navigator", { vendor: "Apple Computer, Inc." });
    vi.stubGlobal("MediaRecorder", undefined);
    expect(pickCaptureMimeType()).toEqual({ ok: false, reason: "no-supported-container" });
  });
});
