import { describe, expect, it } from "vitest";

import {
  initialRecorderState,
  isEscapeVisible,
  isSkipVisible,
  recorderReducer,
  type RecorderAction,
  type RecorderState,
} from "./use-anchor-recorder";

function run(actions: RecorderAction[], from: RecorderState = initialRecorderState): RecorderState {
  return actions.reduce(recorderReducer, from);
}

describe("recorderReducer", () => {
  it("starts idle with no failures", () => {
    expect(initialRecorderState).toEqual({
      status: "idle",
      failureCount: 0,
      scrolledPastExplanation: false,
    });
  });

  it("walks the happy path idle → success", () => {
    const end = run([
      { type: "REQUEST_PERMISSION" },
      { type: "PERMISSION_GRANTED" },
      { type: "START_RECORDING" },
      { type: "RECORDING_COMPLETE" },
      { type: "UPLOAD_SUCCESS" },
    ]);
    expect(end.status).toBe("success");
    expect(end.failureCount).toBe(0);
  });

  it("treats a denied prompt as no strike", () => {
    const end = run([{ type: "REQUEST_PERMISSION" }, { type: "PERMISSION_DENIED" }]);
    expect(end.status).toBe("permission-denied");
    expect(end.failureCount).toBe(0);
  });

  it("leaves permissionBlocked false on a plain PERMISSION_DENIED (fresh deny, re-promptable)", () => {
    const end = run([{ type: "REQUEST_PERMISSION" }, { type: "PERMISSION_DENIED" }]);
    expect(end.permissionBlocked).toBe(false);
  });

  it("sets permissionBlocked when PERMISSION_DENIED carries blocked:true (hard block, browser will not re-prompt)", () => {
    const end = run([{ type: "PERMISSION_DENIED", blocked: true }]);
    expect(end.status).toBe("permission-denied");
    expect(end.permissionBlocked).toBe(true);
  });

  it("clears permissionBlocked once permission is granted (user fixed it in browser settings)", () => {
    const end = run(
      [{ type: "PERMISSION_GRANTED" }],
      { status: "permission-denied", failureCount: 0, scrolledPastExplanation: false, permissionBlocked: true },
    );
    expect(end.status).toBe("permission-granted");
    expect(end.permissionBlocked).toBe(false);
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

  it("counts only 422s when failures are interleaved with transport/permission errors", () => {
    const end = run([
      { type: "EXTRACT_FAILED" },
      { type: "UPLOAD_FAILED" },
      { type: "PERMISSION_DENIED" },
      { type: "EXTRACT_FAILED" },
    ]);
    expect(end.failureCount).toBe(2);
  });

  it("clears the error reason when re-recording", () => {
    const end = run([{ type: "EXTRACT_FAILED", reason: "no face" }, { type: "START_RECORDING" }]);
    expect(end.status).toBe("recording");
    expect(end.errorReason).toBeUndefined();
  });
});

describe("isSkipVisible (FR-004 / FR-007)", () => {
  it("is hidden on a fresh idle state", () => {
    expect(isSkipVisible(initialRecorderState)).toBe(false);
  });

  it("appears after scrolling past the explanation", () => {
    expect(isSkipVisible(run([{ type: "SCROLLED_PAST_EXPLANATION" }]))).toBe(true);
  });

  it("appears after the first extraction failure", () => {
    expect(isSkipVisible(run([{ type: "EXTRACT_FAILED" }]))).toBe(true);
  });

  it("is always available in the permission-denied state, even with no scroll/failure", () => {
    const denied = run([{ type: "REQUEST_PERMISSION" }, { type: "PERMISSION_DENIED" }]);
    expect(denied.scrolledPastExplanation).toBe(false);
    expect(isSkipVisible(denied)).toBe(true);
  });
});

describe("isEscapeVisible (FR-027/028)", () => {
  it("appears at exactly the third consecutive 422, not before", () => {
    let state = initialRecorderState;
    expect(isEscapeVisible(state)).toBe(false);
    state = run([{ type: "EXTRACT_FAILED" }], state);
    expect(isEscapeVisible(state)).toBe(false);
    state = run([{ type: "EXTRACT_FAILED" }], state);
    expect(isEscapeVisible(state)).toBe(false);
    state = run([{ type: "EXTRACT_FAILED" }], state);
    expect(isEscapeVisible(state)).toBe(true);
  });
});
