"use client";

import { useReducer } from "react";

/**
 * The calibration recorder state machine (feature 005 — 📌 DECISION-21; redesign of
 * the 004 reducer). Pure reducer + a tiny derived selector, so it is unit-testable
 * in isolation; the orchestrator (`anchor-recorder.tsx`) owns every side effect
 * (getUserMedia, the framing guide, MediaRecorder, the API call, the DB write).
 *
 * The 005 flow lets the user settle BEFORE anything records:
 *
 *   intro ──Turn on camera──▶ permission-requesting
 *     permission-requesting ─granted──▶ green-room
 *     permission-requesting ─error────▶ camera-blocked | camera-busy | camera-no-device
 *     green-room ─I'm ready (gate ready + /healthz ok)──▶ get-ready ─3·2·1──▶ recording
 *     recording  ─stop──▶ stop-confirming ─Keep going──▶ recording
 *     recording  ─stop──▶ stop-confirming ─Start over──▶ green-room   (nothing saved)
 *     recording  ─60 s──▶ uploading ─POST /anchor (upload + server extraction)
 *     uploading  ─200──▶ success
 *     uploading  ─422──▶ extract-failed   (++failureCount; cause chip; escape at ≥3)
 *     uploading  ─transport/401──▶ upload-failed   (retry, NOT a strike)
 *
 * `uploading` covers the single POST /anchor that both uploads the clip and
 * triggers server-side extraction (004 convention — no separate `extracting`
 * state; the result discriminates the two failure branches).
 *
 * Camera and transport errors are NEVER strikes — only a backend 422 increments
 * `failureCount`, and the "continue without calibration" escape appears at ≥3.
 */

export type RecorderStatus =
  | "intro"
  | "permission-requesting"
  | "camera-blocked"
  | "camera-busy"
  | "camera-no-device"
  | "camera-unsupported-format"
  | "green-room"
  | "get-ready"
  | "recording"
  | "stop-confirming"
  | "uploading"
  | "success"
  | "upload-failed"
  | "extract-failed";

/** The camera-access states, named for the reducer status they map to. */
export type CameraErrorStatus =
  | "camera-blocked"
  | "camera-busy"
  | "camera-no-device"
  // No container this browser can record usably — the camera is fine, the encoder is
  // not. Apple WebKit with no MP4 type available; WebM is deliberately not a fallback
  // there because it records "successfully" into undecodable output. Mirrors the
  // monitoring recorder's `unsupported-format` (lib/capture/constraints.ts).
  | "camera-unsupported-format";

export type RecorderMode = "first-time" | "recalibrate";

export interface RecorderState {
  status: RecorderStatus;
  /** Drives copy (set→update) and the exit destinations (FR-053). Fixed at mount. */
  mode: RecorderMode;
  /** Increments ONLY on a backend 422 (FR-027) — never on transport or camera errors. */
  failureCount: number;
  /** Practical-cause reason from the last 422, a secondary cause-chip input. */
  errorReason?: string;
}

export function makeInitialState(mode: RecorderMode = "first-time"): RecorderState {
  return { status: "intro", mode, failureCount: 0 };
}

export const initialRecorderState: RecorderState = makeInitialState("first-time");

export type RecorderAction =
  | { type: "TURN_ON_CAMERA" }
  | { type: "PERMISSION_GRANTED" }
  | { type: "CAMERA_ERROR"; kind: CameraErrorStatus }
  | { type: "READY" }
  | { type: "CANCEL_GET_READY" }
  | { type: "START_RECORDING" }
  | { type: "REQUEST_STOP" }
  | { type: "KEEP_GOING" }
  | { type: "CONFIRM_STOP" }
  | { type: "RECORDING_COMPLETE" }
  | { type: "UPLOAD_SUCCESS" }
  | { type: "UPLOAD_FAILED" }
  | { type: "EXTRACT_FAILED"; reason?: string };

export function recorderReducer(state: RecorderState, action: RecorderAction): RecorderState {
  switch (action.type) {
    case "TURN_ON_CAMERA":
      return { ...state, status: "permission-requesting", errorReason: undefined };
    case "PERMISSION_GRANTED":
      return { ...state, status: "green-room" };
    case "CAMERA_ERROR":
      // A camera problem is never a 3-fail strike — failureCount untouched (FR-031–035).
      return { ...state, status: action.kind };
    case "READY":
      // Gate cleared + /healthz ok (the orchestrator awaits both before dispatching).
      return { ...state, status: "get-ready" };
    case "CANCEL_GET_READY":
      return { ...state, status: "green-room" };
    case "START_RECORDING":
      return { ...state, status: "recording", errorReason: undefined };
    case "REQUEST_STOP":
      return { ...state, status: "stop-confirming" };
    case "KEEP_GOING":
      return { ...state, status: "recording" };
    case "CONFIRM_STOP":
      // "Start over" — nothing was saved, so nothing is lost; back to the green room.
      return { ...state, status: "green-room" };
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
    default:
      return state;
  }
}

/**
 * Map a `getUserMedia` rejection to one of the three calm camera-access states
 * (contracts/components.md §1). Pure, so the mapping is unit-tested directly.
 * Anything unrecognised (incl. `NotAllowedError`/`SecurityError`) reads as a block —
 * the most common cause and the one whose copy points at the address-bar control.
 */
export function cameraErrorKind(error: unknown): CameraErrorStatus {
  const name = typeof error === "object" && error !== null ? (error as { name?: string }).name : undefined;
  switch (name) {
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "camera-busy";
    case "NotFoundError":
    case "OverconstrainedError":
    case "DevicesNotFoundError":
      return "camera-no-device";
    default:
      return "camera-blocked";
  }
}

/** The "continue without calibration" escape — at the 3rd backend 422 (FR-027/028). */
export function isEscapeVisible(state: RecorderState): boolean {
  return state.failureCount >= 3;
}

export function useAnchorRecorder(mode: RecorderMode = "first-time") {
  const [state, dispatch] = useReducer(recorderReducer, mode, makeInitialState);
  return {
    state,
    dispatch,
    escapeVisible: isEscapeVisible(state),
  };
}
