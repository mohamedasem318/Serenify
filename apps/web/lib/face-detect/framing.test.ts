import { describe, expect, it } from "vitest";

import {
  CENTRE_MAX,
  DRIFT_GRACE_MS,
  evaluateDrift,
  evaluateGate,
  initialDriftDebounce,
  initialGateDebounce,
  LUMA_MIN,
  SET_DEBOUNCE_MS,
  toFramingSignal,
  type DriftState,
  type FramingSignal,
  type GateVerdict,
} from "./framing";

// --- signal builders (all forgiving "good" values unless noted) ---
const good = (at: number): FramingSignal => ({
  facePresent: true,
  centreDistance: 0.05,
  sizeRatio: 0.4,
  brightness: 120,
  at,
});
const offCentre = (at: number): FramingSignal => ({ ...good(at), centreDistance: CENTRE_MAX + 0.2 });
const dark = (at: number): FramingSignal => ({ ...good(at), brightness: LUMA_MIN - 10 });
const absent = (at: number): FramingSignal => ({
  facePresent: false,
  centreDistance: 1,
  sizeRatio: 0,
  brightness: 120,
  at,
});

function runGate(signals: FramingSignal[]): { verdict: GateVerdict; ready: boolean }[] {
  let deb = initialGateDebounce;
  return signals.map((s) => {
    const r = evaluateGate(s, deb);
    deb = r.next;
    return { verdict: r.verdict, ready: r.ready };
  });
}

function runDrift(signals: FramingSignal[]): DriftState[] {
  let deb = initialDriftDebounce;
  return signals.map((s) => {
    const r = evaluateDrift(s, deb);
    deb = r.next;
    return r.drift;
  });
}

describe("toFramingSignal", () => {
  it("marks a confident, centred box present with a small centre-distance", () => {
    const s = toFramingSignal({ cx: 0.5, cy: 0.5, w: 0.3, h: 0.5, score: 0.9 }, 100, 0);
    expect(s.facePresent).toBe(true);
    expect(s.centreDistance).toBeCloseTo(0);
    expect(s.sizeRatio).toBe(0.5);
    expect(s.brightness).toBe(100);
  });

  it("treats a null box (or a low-score detection) as no face", () => {
    expect(toFramingSignal(null, 100, 0).facePresent).toBe(false);
    expect(toFramingSignal({ cx: 0.5, cy: 0.5, w: 0.3, h: 0.5, score: 0.2 }, 100, 0).facePresent).toBe(false);
  });
});

describe("evaluateGate (soft gate — forgiving)", () => {
  it("enables 'I'm ready' only after a clear frame is held for the set-debounce", () => {
    const out = runGate([good(0), good(SET_DEBOUNCE_MS - 1), good(SET_DEBOUNCE_MS), good(SET_DEBOUNCE_MS + 100)]);
    expect(out.map((o) => o.verdict)).toEqual(["ready", "ready", "ready", "ready"]);
    expect(out.map((o) => o.ready)).toEqual([false, false, true, true]);
  });

  it("holds the gate on the three obvious dealbreakers", () => {
    expect(evaluateGate(offCentre(0), initialGateDebounce).verdict).toBe("off-centre");
    expect(evaluateGate(dark(0), initialGateDebounce).verdict).toBe("too-dark");
    expect(evaluateGate(offCentre(0), initialGateDebounce).ready).toBe(false);
  });

  it("does not block a clearly-framed, adequately-lit face (zero false blocks)", () => {
    // a centred, lit face is never held by off-centre/too-dark
    const r = evaluateGate(good(0), initialGateDebounce);
    expect(r.verdict).toBe("ready");
  });

  it("reads a cold-start absence as no-face immediately", () => {
    expect(evaluateGate(absent(0), initialGateDebounce).verdict).toBe("no-face");
  });

  it("declares no-face only after NO_FACE_FRAMES, but rides a brief blip after a good frame", () => {
    // good (sets goodSince) then two absent frames (< K=3) keep 'ready' momentum,
    // the third sustained absence flips to no-face.
    const out = runGate([good(0), absent(100), absent(200), absent(300)]);
    expect(out.map((o) => o.verdict)).toEqual(["ready", "ready", "ready", "no-face"]);
  });
});

describe("evaluateDrift (grace-gated, never auto-stops)", () => {
  it("is quiet when the face is centred", () => {
    expect(runDrift([good(0), good(100)])).toEqual(["centred", "centred"]);
  });

  it("does NOT nudge on a wobble shorter than the grace window (FR-018)", () => {
    // off-target for < DRIFT_GRACE_MS, then back centred — never reaches 'ease-back'
    const out = runDrift([good(0), offCentre(500), offCentre(DRIFT_GRACE_MS - 1), good(DRIFT_GRACE_MS + 200)]);
    expect(out).toEqual(["centred", "centred", "centred", "centred"]);
  });

  it("shows 'ease back to centre' only after sustained off-target past the grace window", () => {
    const out = runDrift([good(0), offCentre(100), offCentre(100 + DRIFT_GRACE_MS)]);
    expect(out).toEqual(["centred", "centred", "ease-back"]);
  });

  it("shows 'we can't see you' when the face is absent past the grace window", () => {
    const out = runDrift([good(0), absent(100), absent(100 + DRIFT_GRACE_MS)]);
    expect(out).toEqual(["centred", "centred", "absent"]);
  });

  it("resets the grace timer when the face returns to centre", () => {
    const out = runDrift([
      offCentre(0),
      offCentre(DRIFT_GRACE_MS - 1), // still within grace
      good(DRIFT_GRACE_MS), // back centred → resets
      offCentre(DRIFT_GRACE_MS + 100), // off again, fresh window
    ]);
    expect(out).toEqual(["centred", "centred", "centred", "centred"]);
  });
});
