import { describe, expect, it } from "vitest";

import {
  cameraErrorKind,
  isEscapeVisible,
  makeInitialState,
  recorderReducer,
  type RecorderAction,
  type RecorderState,
} from "./use-anchor-recorder";

function run(actions: RecorderAction[], from: RecorderState = makeInitialState()): RecorderState {
  return actions.reduce(recorderReducer, from);
}

describe("recorderReducer (📌 DECISION-21)", () => {
  it("starts at the intro, first-time, with no failures", () => {
    expect(makeInitialState()).toEqual({ status: "intro", mode: "first-time", failureCount: 0 });
  });

  it("seeds the recalibrate mode when asked (FR-053)", () => {
    expect(makeInitialState("recalibrate").mode).toBe("recalibrate");
  });

  it("walks the happy path intro → success", () => {
    const end = run([
      { type: "TURN_ON_CAMERA" },
      { type: "PERMISSION_GRANTED" },
      { type: "READY" },
      { type: "START_RECORDING" },
      { type: "RECORDING_COMPLETE" },
      { type: "UPLOAD_SUCCESS" },
    ]);
    expect(end.status).toBe("success");
    expect(end.failureCount).toBe(0);
  });

  it("settles into the green room on permission granted (not straight to recording)", () => {
    const end = run([{ type: "TURN_ON_CAMERA" }, { type: "PERMISSION_GRANTED" }]);
    expect(end.status).toBe("green-room");
  });

  it("returns to the green room when the get-ready countdown is cancelled", () => {
    const end = run([
      { type: "TURN_ON_CAMERA" },
      { type: "PERMISSION_GRANTED" },
      { type: "READY" },
      { type: "CANCEL_GET_READY" },
    ]);
    expect(end.status).toBe("green-room");
  });

  it("stop → Keep going resumes the recording", () => {
    const end = run([{ type: "START_RECORDING" }, { type: "REQUEST_STOP" }, { type: "KEEP_GOING" }]);
    expect(end.status).toBe("recording");
  });

  it("stop → Start over returns to the green room with nothing saved (FR-021–024)", () => {
    const end = run([{ type: "START_RECORDING" }, { type: "REQUEST_STOP" }, { type: "CONFIRM_STOP" }]);
    expect(end.status).toBe("green-room");
    expect(end.failureCount).toBe(0);
  });

  it.each([
    ["camera-blocked" as const],
    ["camera-busy" as const],
    ["camera-no-device" as const],
  ])("routes a camera error to %s without a strike (FR-031–035)", (kind) => {
    const end = run([{ type: "TURN_ON_CAMERA" }, { type: "CAMERA_ERROR", kind }]);
    expect(end.status).toBe(kind);
    expect(end.failureCount).toBe(0);
  });

  it("treats a transport failure as a retry, not a strike (FR-027)", () => {
    const end = run([{ type: "RECORDING_COMPLETE" }, { type: "UPLOAD_FAILED" }]);
    expect(end.status).toBe("upload-failed");
    expect(end.failureCount).toBe(0);
  });

  it("increments failureCount only on a backend 422 and carries the reason", () => {
    const end = run([{ type: "EXTRACT_FAILED", reason: "no face" }]);
    expect(end.status).toBe("extract-failed");
    expect(end.failureCount).toBe(1);
    expect(end.errorReason).toBe("no face");
  });

  it("counts only 422s when failures are interleaved with transport/camera errors", () => {
    const end = run([
      { type: "EXTRACT_FAILED" },
      { type: "UPLOAD_FAILED" },
      { type: "CAMERA_ERROR", kind: "camera-busy" },
      { type: "EXTRACT_FAILED" },
    ]);
    expect(end.failureCount).toBe(2);
  });

  it("clears the 422 reason when re-recording", () => {
    const end = run([{ type: "EXTRACT_FAILED", reason: "no face" }, { type: "START_RECORDING" }]);
    expect(end.status).toBe("recording");
    expect(end.errorReason).toBeUndefined();
  });

  it("preserves the mode across the whole flow", () => {
    const end = run(
      [{ type: "TURN_ON_CAMERA" }, { type: "PERMISSION_GRANTED" }, { type: "READY" }],
      makeInitialState("recalibrate"),
    );
    expect(end.mode).toBe("recalibrate");
  });
});

describe("cameraErrorKind — getUserMedia error.name → the three states (contracts §1)", () => {
  it.each([
    ["NotAllowedError", "camera-blocked"],
    ["SecurityError", "camera-blocked"],
    ["NotReadableError", "camera-busy"],
    ["TrackStartError", "camera-busy"],
    ["AbortError", "camera-busy"],
    ["NotFoundError", "camera-no-device"],
    ["OverconstrainedError", "camera-no-device"],
    ["DevicesNotFoundError", "camera-no-device"],
  ] as const)("maps %s → %s", (name, expected) => {
    expect(cameraErrorKind({ name })).toBe(expected);
  });

  it("defaults an unrecognised or shapeless error to blocked", () => {
    expect(cameraErrorKind(new Error("boom"))).toBe("camera-blocked");
    expect(cameraErrorKind(null)).toBe("camera-blocked");
    expect(cameraErrorKind(undefined)).toBe("camera-blocked");
  });
});

describe("isEscapeVisible (FR-027/028)", () => {
  it("appears at exactly the third backend 422, not before", () => {
    let state = makeInitialState();
    expect(isEscapeVisible(state)).toBe(false);
    state = run([{ type: "EXTRACT_FAILED" }], state);
    expect(isEscapeVisible(state)).toBe(false);
    state = run([{ type: "EXTRACT_FAILED" }], state);
    expect(isEscapeVisible(state)).toBe(false);
    state = run([{ type: "EXTRACT_FAILED" }], state);
    expect(isEscapeVisible(state)).toBe(true);
  });
});
