"use client";

import { useReducer } from "react";

/**
 * The anchor recorder state machine (📌 DECISION-13). Pure reducer + derived
 * selectors so it is unit-testable in isolation (T039); the orchestrator
 * (anchor-recorder.tsx) owns all side effects (getUserMedia, MediaRecorder,
 * the API call, the DB write).
 *
 *   idle → permission-requesting → permission-granted → recording
 *        → uploading → success
 *   permission-requesting ─denied→ permission-denied        (no strike)
 *   uploading ─transport→ upload-failed                     (retry; no strike)
 *   uploading ─422→ extract-failed                          (retry; ++failureCount)
 *
 * `uploading` covers the single POST /anchor request that both uploads the clip
 * and triggers server-side extraction; the result discriminates the two failure
 * branches.
 */

export type RecorderStatus =
  | "idle"
  | "permission-requesting"
  | "permission-denied"
  | "permission-granted"
  | "recording"
  | "uploading"
  | "success"
  | "upload-failed"
  | "extract-failed";

export interface RecorderState {
  status: RecorderStatus;
  /** Increments ONLY on a backend 422 (FR-027) — never on transport or permission. */
  failureCount: number;
  /** Set once the user scrolls past the explanation copy (FR-004). */
  scrolledPastExplanation: boolean;
  /** Practical-cause reason from the last 422, surfaced in the retry copy. */
  errorReason?: string;
  /**
   * True when the OS/browser has hard-blocked the camera for this origin
   * (navigator.permissions.query → "denied"): the prompt will not reappear
   * on retry, so copy must point the user to their browser settings.
   * False/undefined for a fresh deny that can still be re-prompted.
   */
  permissionBlocked?: boolean;
}

export const initialRecorderState: RecorderState = {
  status: "idle",
  failureCount: 0,
  scrolledPastExplanation: false,
};

export type RecorderAction =
  | { type: "REQUEST_PERMISSION" }
  | { type: "PERMISSION_GRANTED" }
  | { type: "PERMISSION_DENIED"; blocked?: boolean }
  | { type: "START_RECORDING" }
  | { type: "RECORDING_COMPLETE" }
  | { type: "UPLOAD_SUCCESS" }
  | { type: "UPLOAD_FAILED" }
  | { type: "EXTRACT_FAILED"; reason?: string }
  | { type: "SCROLLED_PAST_EXPLANATION" };

export function recorderReducer(state: RecorderState, action: RecorderAction): RecorderState {
  switch (action.type) {
    case "REQUEST_PERMISSION":
      return { ...state, status: "permission-requesting", errorReason: undefined };
    case "PERMISSION_GRANTED":
      return { ...state, status: "permission-granted", permissionBlocked: false };
    case "PERMISSION_DENIED":
      // FR-027: a declined prompt is not a 3-fail strike — failureCount untouched.
      return { ...state, status: "permission-denied", permissionBlocked: action.blocked === true };
    case "START_RECORDING":
      return { ...state, status: "recording", errorReason: undefined };
    case "RECORDING_COMPLETE":
      return { ...state, status: "uploading" };
    case "UPLOAD_SUCCESS":
      return { ...state, status: "success" };
    case "UPLOAD_FAILED":
      // Transport error (offline / unreachable / 401) — retry, NOT a strike (FR-027).
      return { ...state, status: "upload-failed" };
    case "EXTRACT_FAILED":
      // Backend 422 — the only event that increments failureCount (FR-027).
      return {
        ...state,
        status: "extract-failed",
        failureCount: state.failureCount + 1,
        errorReason: action.reason,
      };
    case "SCROLLED_PAST_EXPLANATION":
      return { ...state, scrolledPastExplanation: true };
    default:
      return state;
  }
}

/** "Skip for now" visibility — FR-004 (scroll/first failure) + FR-007 (always in denied). */
export function isSkipVisible(state: RecorderState): boolean {
  if (state.status === "permission-denied") return true; // FR-007
  return state.failureCount >= 1 || state.scrolledPastExplanation; // FR-004
}

/** The "skip and continue without calibration" escape — at exactly the 3rd 422 (FR-027/028). */
export function isEscapeVisible(state: RecorderState): boolean {
  return state.failureCount >= 3;
}

export function useAnchorRecorder() {
  const [state, dispatch] = useReducer(recorderReducer, initialRecorderState);
  return {
    state,
    dispatch,
    skipVisible: isSkipVisible(state),
    escapeVisible: isEscapeVisible(state),
  };
}
