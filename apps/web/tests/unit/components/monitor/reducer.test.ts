import { describe, expect, it } from "vitest";

import {
  BAND_DISPLAY,
  initialMonitorState,
  liveDisplay,
  monitorReducer,
  WARMING_DISPLAY,
  type MonitorState,
} from "@/components/monitor/use-monitoring-session";

/** Feature 008 / US1 — T035: the monitoring state machine + band→display mapping. */

describe("monitorReducer — state transitions (US1 op-states)", () => {
  it("starts at permission with no band", () => {
    expect(initialMonitorState).toEqual({
      op: "permission",
      band: null,
      skipCause: null,
      cameraError: null,
    });
  });

  it("camera granted → warming-up; blocked → blocked; no-anchor → calibrate-first", () => {
    expect(monitorReducer(initialMonitorState, { type: "CAMERA_GRANTED" }).op).toBe("warming-up");
    expect(monitorReducer(initialMonitorState, { type: "CAMERA_BLOCKED" }).op).toBe("blocked");
    expect(monitorReducer(initialMonitorState, { type: "NO_ANCHOR" }).op).toBe("calibrate-first");
  });

  it("CAMERA_ERROR carries the mapped camera-access kind onto the blocked surface", () => {
    // The mapped getUserMedia rejection (busy / no-device / blocked) drives honest copy —
    // no generic "blocked" catch-all (FR-022).
    for (const kind of ["blocked", "busy", "no-device"] as const) {
      const s = monitorReducer(initialMonitorState, { type: "CAMERA_ERROR", kind });
      expect(s.op).toBe("blocked");
      expect(s.cameraError).toBe(kind);
    }
    // CAMERA_BLOCKED (secure-context / session-create failure) is the generic "blocked" kind.
    expect(monitorReducer(initialMonitorState, { type: "CAMERA_BLOCKED" }).cameraError).toBe("blocked");
    // Re-requesting permission clears the prior camera error.
    const blocked = monitorReducer(initialMonitorState, { type: "CAMERA_ERROR", kind: "busy" });
    expect(monitorReducer(blocked, { type: "REQUEST_PERMISSION" }).cameraError).toBeNull();
  });

  it("HOLDS warming-up while the server keeps returning warming_up (no band yet)", () => {
    let s: MonitorState = { op: "warming-up", band: null, skipCause: null };
    for (let i = 0; i < 3; i += 1) {
      s = monitorReducer(s, { type: "WINDOW_OUTCOME", outcome: { outcome: "warming_up", capturedAt: "t" } });
      expect(s.op).toBe("warming-up");
      expect(s.band).toBeNull();
    }
  });

  it("a reading promotes warming-up → active with the band", () => {
    const s = monitorReducer(
      { op: "warming-up", band: null, skipCause: null },
      { type: "WINDOW_OUTCOME", outcome: { outcome: "reading", band: "a_little_tense", capturedAt: "t" } },
    );
    expect(s.op).toBe("active");
    expect(s.band).toBe("a_little_tense");
    expect(s.skipCause).toBeNull();
  });

  it("a skip keeps the last band (bloom holds) and sets a transient skip cause", () => {
    const active: MonitorState = { op: "active", band: "at_ease", skipCause: null };
    const skipped = monitorReducer(active, { type: "WINDOW_SKIPPED", cause: "low-light" });
    expect(skipped.op).toBe("active"); // unchanged
    expect(skipped.band).toBe("at_ease"); // last band kept
    expect(skipped.skipCause).toBe("low-light");

    // the next reading clears the skip note and updates the band
    const next = monitorReducer(skipped, {
      type: "WINDOW_OUTCOME",
      outcome: { outcome: "reading", band: "tense", capturedAt: "t" },
    });
    expect(next.band).toBe("tense");
    expect(next.skipCause).toBeNull();
  });
});

describe("band → display mapping", () => {
  it("maps each band to its bloom tone + stateline colour role", () => {
    expect(BAND_DISPLAY.at_ease.tone).toBe("ease");
    expect(BAND_DISPLAY.at_ease.statelineTone).toBe("meadow");
    expect(BAND_DISPLAY.a_little_tense.tone).toBe("little");
    expect(BAND_DISPLAY.a_little_tense.statelineTone).toBe("amber");
    expect(BAND_DISPLAY.tense.tone).toBe("tense");
    expect(BAND_DISPLAY.tense.statelineTone).toBe("amber");
  });

  it("liveDisplay: warming-up is the muted meadow warming copy; active uses its band", () => {
    const warming = liveDisplay({ op: "warming-up", band: null, skipCause: null });
    expect(warming).toBe(WARMING_DISPLAY);
    expect(warming.tone).toBe("warming");
    expect(warming.statelineTone).toBe("muted");
    expect(warming.head).toBe("Getting a read on things");

    const active = liveDisplay({ op: "active", band: "tense", skipCause: null });
    expect(active).toBe(BAND_DISPLAY.tense);
  });
});
