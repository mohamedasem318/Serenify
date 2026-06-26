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

  it("SERVICE_UNAVAILABLE → service-unavailable (a backend-down state, distinct from blocked)", () => {
    // The backend being unreachable on create is its OWN state — NOT the camera-blocked
    // surface (which carries the wrong "turn your camera back on" instruction).
    const s = monitorReducer(initialMonitorState, { type: "SERVICE_UNAVAILABLE" });
    expect(s.op).toBe("service-unavailable");
    expect(s.cameraError).toBeNull(); // not a camera-access failure
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

  it("a superseded outcome is a no-op — the active band holds, never regresses to warming-up", () => {
    // The server scoring gate sheds a stale window (drop-stale back-pressure). The client must
    // treat it as a pure no-op: the held band stays put and the op never falls back to warming.
    const active: MonitorState = { op: "active", band: "a_little_tense", skipCause: null };
    const after = monitorReducer(active, {
      type: "WINDOW_OUTCOME",
      outcome: { outcome: "superseded" },
    });
    expect(after).toEqual(active); // unchanged — band held, still active (not warming-up)
  });
});

describe("monitorReducer — US2 presence + lifecycle transitions", () => {
  const active: MonitorState = { op: "active", band: "at_ease", skipCause: null };

  it("auto-pause: a live op → out-of-frame, HOLDING the last band (for the dimmed bloom)", () => {
    const s = monitorReducer(active, { type: "GO_OUT_OF_FRAME" });
    expect(s.op).toBe("out-of-frame");
    expect(s.band).toBe("at_ease");
    // also valid from warming-up (no band yet)
    const warming = monitorReducer({ op: "warming-up", band: null, skipCause: null }, { type: "GO_OUT_OF_FRAME" });
    expect(warming.op).toBe("out-of-frame");
  });

  it("GO_OUT_OF_FRAME is ignored from a non-live op (paused / ended / permission)", () => {
    for (const op of ["paused", "ended", "permission"] as const) {
      const s: MonitorState = { op, band: null, skipCause: null };
      expect(monitorReducer(s, { type: "GO_OUT_OF_FRAME" }).op).toBe(op);
    }
  });

  it("auto-resume: out-of-frame → active when a band was showing, warming-up when not", () => {
    const withBand = monitorReducer(
      { op: "out-of-frame", band: "tense", skipCause: null },
      { type: "RETURN_TO_FRAME" },
    );
    expect(withBand.op).toBe("active");
    const noBand = monitorReducer(
      { op: "out-of-frame", band: null, skipCause: null },
      { type: "RETURN_TO_FRAME" },
    );
    expect(noBand.op).toBe("warming-up");
    // RETURN_TO_FRAME only acts from out-of-frame
    expect(monitorReducer(active, { type: "RETURN_TO_FRAME" }).op).toBe("active");
  });

  it("manual Pause → paused (from any live-ish op); Resume → warming-up (fresh recording)", () => {
    expect(monitorReducer(active, { type: "PAUSE" }).op).toBe("paused");
    expect(
      monitorReducer({ op: "out-of-frame", band: "tense", skipCause: null }, { type: "PAUSE" }).op,
    ).toBe("paused");
    const resumed = monitorReducer({ op: "paused", band: "tense", skipCause: null }, { type: "RESUME" });
    expect(resumed.op).toBe("warming-up"); // a fresh recording warms up again (T036)
    // RESUME only acts from paused; PAUSE is a no-op once ended
    expect(monitorReducer(active, { type: "RESUME" }).op).toBe("active");
    expect(monitorReducer({ op: "ended", band: null, skipCause: null }, { type: "PAUSE" }).op).toBe("ended");
  });

  it("END is terminal from anywhere (manual End / auto-end)", () => {
    for (const op of ["warming-up", "active", "out-of-frame", "paused"] as const) {
      expect(monitorReducer({ op, band: null, skipCause: null }, { type: "END" }).op).toBe("ended");
    }
  });

  it("a late in-flight reading never flips a paused / out-of-frame / ended session live (FR-016)", () => {
    const reading = { type: "WINDOW_OUTCOME", outcome: { outcome: "reading", band: "tense", capturedAt: "t" } } as const;
    const paused: MonitorState = { op: "paused", band: "at_ease", skipCause: null };
    expect(monitorReducer(paused, reading)).toEqual(paused); // unchanged — band held, op paused
    expect(monitorReducer({ op: "out-of-frame", band: "at_ease", skipCause: null }, reading).op).toBe("out-of-frame");
    expect(monitorReducer({ op: "ended", band: null, skipCause: null }, reading).op).toBe("ended");
    // a late skip note also cannot paint over a paused surface
    expect(monitorReducer(paused, { type: "WINDOW_SKIPPED", cause: "low-light" }).skipCause).toBeNull();
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
