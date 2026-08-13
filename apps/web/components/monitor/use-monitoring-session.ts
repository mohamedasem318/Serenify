"use client";

import { useReducer } from "react";

import type { FailureCause } from "@/components/anchor/failure-state";
import type { Band, WindowOutcome } from "@/lib/api/monitoring-client";

/**
 * The monitoring session state machine (feature 008, US1 — T027). Pure reducer + a
 * small band→display derivation, unit-testable in isolation; the orchestrator
 * (`monitoring-session.tsx`) owns every side effect (camera, recorder, the API calls,
 * the face-detector gate). Mirrors the calibration reducer's shape (DECISION-21).
 *
 * Operational states (the locked list — no invented states):
 *
 *   permission ──camera granted + session created──▶ warming-up
 *   permission ──camera blocked / unavailable─────▶ blocked
 *   permission ──no anchor (409)──────────────────▶ calibrate-first (the no-anchor panel; op-surfaces)
 *   warming-up ──server still "warming_up"────────▶ warming-up   (HELD until the server stops)
 *   warming-up ──first "reading"──────────────────▶ active (band shown)
 *   active     ──"reading"────────────────────────▶ active (band updates)
 *   any-live   ──"skipped"────────────────────────▶ (op unchanged) + transient skip note over the last band
 *
 * US2 (T038) adds the presence + lifecycle states — the orchestrator owns their side effects
 * (the 90 s / 5 min absence timers, camera acquire/release, the PATCH/end calls):
 *
 *   active|warming-up ──90 s no-face (auto)───────▶ out-of-frame (self-view + foggy prompt; camera STAYS on)
 *   out-of-frame      ──face returns (auto)───────▶ active|warming-up (auto-resume)
 *   any-live          ──manual Pause─────────────▶ paused (camera RELEASED)
 *   paused            ──manual Resume────────────▶ warming-up (fresh recording → warms up again)
 *   any              ──manual End / 5 min absence─▶ ended (camera released → dashboard)
 *   any-live         ──upload 401 / un-refreshable─▶ signed-out (scoring stops, re-auth needed; camera released)
 *
 * There is NO numeric field anywhere — the band is the only stress signal (FR-015).
 */

export type { Band } from "@/lib/api/monitoring-client";

export type MonitorOp =
  | "permission" // need camera access (initial; and after a blocked retry)
  | "warming-up" // recording, no confident band yet (held until the server stops)
  | "active" // a smoothed band is showing
  | "out-of-frame" // auto-paused on 90 s no-face — self-view + foggy prompt, camera still on (US2)
  | "paused" // manual break — camera released, resumable (US2)
  | "ended" // session ended (manual End / auto-end) — orchestrator navigates to the dashboard (US2)
  | "blocked" // camera blocked / busy / no device
  | "signed-out" // the sign-in expired and couldn't be refreshed → scoring stops, re-auth needed
  | "service-unavailable" // couldn't reach the backend to start (network / 5xx) — the SERVICE is down, NOT the camera
  | "calibrate-first"; // no_anchor → the calibrate-first panel routes to /app/calibrate (op-surfaces)

/** The live capture ops (recorder running, a band may show). */
const LIVE_OPS: ReadonlySet<MonitorOp> = new Set(["warming-up", "active"]);

/**
 * Which camera-access failure the blocked surface explains — mapped from the
 * getUserMedia rejection's `err.name` (mirrors `use-anchor-recorder.cameraErrorKind`,
 * minus the `camera-` prefix). No generic "blocked" catch-all: each cause gets honest
 * copy (FR-022). `"insecure"` is the non-secure-origin case (needs https), surfaced with
 * its own copy; any other non-getUserMedia block (session-create failure) stays `"blocked"`.
 */
export type CameraErrorKind =
  | "blocked"
  | "busy"
  | "no-device"
  | "insecure"
  // No container this browser can record usably. Distinct from the four access
  // failures above: the camera is fine, the *encoder* is the problem. Reached on Apple
  // WebKit when no MP4 type is available, where WebM is not a fallback because it
  // records successfully and produces undecodable output (lib/capture/constraints.ts).
  | "unsupported-format";

export interface MonitorState {
  op: MonitorOp;
  /** The last smoothed band (kept across a skip so the bloom holds it). Null until the first reading. */
  band: Band | null;
  /** Transient skipped-read cause (refined client-side); cleared on the next reading/warming. */
  skipCause: FailureCause | null;
  /** Which camera-access failure to explain on the blocked surface; null when not blocked. */
  cameraError?: CameraErrorKind | null;
}

export const initialMonitorState: MonitorState = {
  op: "permission",
  band: null,
  skipCause: null,
  cameraError: null,
};

export type MonitorAction =
  | { type: "REQUEST_PERMISSION" }
  | { type: "CAMERA_GRANTED" } // camera live AND session created → start warming up
  | { type: "CAMERA_BLOCKED" } // generic block (secure-context / session-create failure)
  | { type: "CAMERA_ERROR"; kind: CameraErrorKind } // mapped getUserMedia rejection (err.name)
  | { type: "NO_ANCHOR" }
  | { type: "SESSION_EXPIRED" } // upload/create couldn't carry a valid token (401 / un-refreshable) — never silent
  | { type: "SERVICE_UNAVAILABLE" } // create couldn't reach the backend (network / 5xx) — the service is down, not the camera
  | { type: "WINDOW_OUTCOME"; outcome: WindowOutcome }
  | { type: "WINDOW_SKIPPED"; cause: FailureCause }
  // US2 (T038) — presence + lifecycle
  | { type: "GO_OUT_OF_FRAME" } // 90 s no-face (auto) — from a live op only
  | { type: "RETURN_TO_FRAME" } // face returned (auto) — resume from out-of-frame
  | { type: "PAUSE" } // manual Pause — camera released
  | { type: "RESUME" } // manual Resume — fresh recording warms up again
  | { type: "END" }; // manual End or auto-end — terminal

export function monitorReducer(state: MonitorState, action: MonitorAction): MonitorState {
  switch (action.type) {
    case "REQUEST_PERMISSION":
      return { ...state, op: "permission", cameraError: null };
    case "CAMERA_GRANTED":
      return { ...state, op: "warming-up", cameraError: null };
    case "CAMERA_BLOCKED":
      return { ...state, op: "blocked", cameraError: "blocked" };
    case "CAMERA_ERROR":
      return { ...state, op: "blocked", cameraError: action.kind };
    case "NO_ANCHOR":
      return { ...state, op: "calibrate-first", cameraError: null };
    case "SESSION_EXPIRED":
      // The upload path could not carry a valid token (a 401, or the browser session could
      // not be refreshed). Scoring cannot continue as the user, so we STOP on an honest
      // surface (the standing release effect then frees the camera) — never a silent frozen
      // band. The orchestrator guards on a live op before dispatching, mirroring NO_ANCHOR.
      return { ...state, op: "signed-out", cameraError: null, skipCause: null };
    case "SERVICE_UNAVAILABLE":
      // The create call couldn't reach the backend (the fetch threw → network, or a 5xx).
      // The camera is fine — the SERVICE is down — so this must NOT route to the blocked
      // "turn the camera back on" surface. Distinct, honest surface with a "Try again" retry.
      return { ...state, op: "service-unavailable", cameraError: null, skipCause: null };
    case "WINDOW_SKIPPED":
      // A skipped window keeps the last band (bloom holds) and shows the foggy skip
      // note; op is unchanged (still warming-up, or still active). Ignored once the
      // session is no longer live (paused / out-of-frame / ended) — a late in-flight
      // window must not paint a skip note over a paused/ended surface.
      if (!LIVE_OPS.has(state.op)) return state;
      return { ...state, skipCause: action.cause };
    case "WINDOW_OUTCOME": {
      // A reading/warming outcome only acts while live; a window that lands after a
      // pause/out-of-frame/end (uploads are gated, but one may be in flight) is dropped
      // so it can't flip a paused/ended session back to active (FR-016 non-blocking).
      if (!LIVE_OPS.has(state.op)) return state;
      const { outcome } = action;
      if (outcome.outcome === "reading") {
        return { op: "active", band: outcome.band, skipCause: null };
      }
      if (outcome.outcome === "warming_up") {
        // HELD: stay warming-up until the server stops returning warming_up. A reading
        // is the only thing that promotes to active.
        return { ...state, op: "warming-up", skipCause: null };
      }
      // outcome.outcome === "skipped" — handled by the orchestrator (which refines the
      // cause from on-device telemetry) via WINDOW_SKIPPED — OR "superseded" (a window the
      // server scoring gate shed as stale; drop-stale back-pressure). Both are a deliberate
      // NO-OP here: the held band stays put, and a superseded window must NOT regress an
      // active band to warming-up (so it is never folded into the warming_up branch above).
      return state;
    }
    case "GO_OUT_OF_FRAME":
      // Auto-pause only from a live op (the orchestrator also guards on op before the
      // PATCH); the held band stays so the dimmed bloom keeps the last colour. Clearing
      // the skip note so the out-of-frame prompt is the only foggy surface.
      if (!LIVE_OPS.has(state.op)) return state;
      return { ...state, op: "out-of-frame", skipCause: null };
    case "RETURN_TO_FRAME":
      // Auto-resume: back to active if a band was already showing, else keep warming.
      if (state.op !== "out-of-frame") return state;
      return { ...state, op: state.band ? "active" : "warming-up", skipCause: null };
    case "PAUSE":
      // Manual break from any live-ish op; terminal states are not pausable.
      if (state.op === "ended") return state;
      return { ...state, op: "paused", skipCause: null };
    case "RESUME":
      // Fresh recording → warm up again (T036: client restarts the recorder on resume).
      if (state.op !== "paused") return state;
      return { ...state, op: "warming-up", skipCause: null };
    case "END":
      return { ...state, op: "ended", skipCause: null };
    default:
      return state;
  }
}

// ── band → display (copy + tone), traced to the approved mock's STATES map ──────────

/** The bloom colour role for a state (meadow / mid-gold / amber / warming-meadow). */
export type BloomTone = "ease" | "little" | "tense" | "warming";

/** The stateline text colour role: meadow for calm, amber for the stress bands, muted while warming. */
export type StatelineTone = "meadow" | "amber" | "muted";

export interface BandDisplay {
  tone: BloomTone;
  statelineTone: StatelineTone;
  head: string;
  sub: string;
}

/** Copy traced to the mock STATES map (serenify-008-monitoring-mock.html); band heads
 * renamed 2026-08-13 (Calm / Uneasy / Tense) and moved to observational wording 2026-08-14
 * ("Looking …" — the model reads a face, so the head says what it sees, not what the person
 * feels; each head now matches its chip label). The mock keeps the signed-off wording. */
export const BAND_DISPLAY: Record<Band, BandDisplay> = {
  at_ease: {
    tone: "ease",
    statelineTone: "meadow",
    head: "Looking calm",
    sub: "Steady and settled — nothing to do.",
  },
  a_little_tense: {
    tone: "little",
    statelineTone: "amber",
    head: "Looking uneasy",
    sub: "A bit of an edge lately. Maybe a slow breath.",
  },
  tense: {
    tone: "tense",
    statelineTone: "amber",
    head: "Looking tense",
    sub: "This has held a while. Serenify can check in when you're ready.",
  },
};

/** The warming-up display (meadow bloom, muted text) — mock warmup copy. */
export const WARMING_DISPLAY: BandDisplay = {
  tone: "warming",
  statelineTone: "muted",
  head: "Getting a read on things",
  sub: "Your first reading lands in a moment. Sit comfortably.",
};

/** Resolve the display for a live state: warming-up → WARMING_DISPLAY; active → its band. */
export function liveDisplay(state: MonitorState): BandDisplay {
  if (state.op === "active" && state.band) return BAND_DISPLAY[state.band];
  return WARMING_DISPLAY;
}

/**
 * The bloom tone the out-of-frame / paused surfaces hold while dimmed: the LAST band's
 * colour if one was showing, else the warming meadow. (The mock dims the bloom but keeps
 * its colour — it never resets to neutral on a pause/out-of-frame.)
 */
export function heldBloomTone(state: MonitorState): BloomTone {
  return state.band ? BAND_DISPLAY[state.band].tone : "warming";
}

export function useMonitoringSession() {
  const [state, dispatch] = useReducer(monitorReducer, initialMonitorState);
  return { state, dispatch };
}
