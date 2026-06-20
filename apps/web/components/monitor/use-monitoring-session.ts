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
 * US1 operational states only (the locked list — no invented states):
 *
 *   permission ──camera granted + session created──▶ warming-up
 *   permission ──camera blocked / unavailable─────▶ blocked
 *   permission ──no anchor (409)──────────────────▶ calibrate-first (the no-anchor panel; op-surfaces)
 *   warming-up ──server still "warming_up"────────▶ warming-up   (HELD until the server stops)
 *   warming-up ──first "reading"──────────────────▶ active (band shown)
 *   active     ──"reading"────────────────────────▶ active (band updates)
 *   any-live   ──"skipped"────────────────────────▶ (op unchanged) + transient skip note over the last band
 *
 * Paused / out-of-frame / ended are US2 (T036+) and are deliberately NOT modelled here.
 * There is NO numeric field anywhere — the band is the only stress signal (FR-015).
 */

export type { Band } from "@/lib/api/monitoring-client";

export type MonitorOp =
  | "permission" // need camera access (initial; and after a blocked retry)
  | "warming-up" // recording, no confident band yet (held until the server stops)
  | "active" // a smoothed band is showing
  | "blocked" // camera blocked / busy / no device
  | "calibrate-first"; // no_anchor → the calibrate-first panel routes to /app/calibrate (op-surfaces)

export interface MonitorState {
  op: MonitorOp;
  /** The last smoothed band (kept across a skip so the bloom holds it). Null until the first reading. */
  band: Band | null;
  /** Transient skipped-read cause (refined client-side); cleared on the next reading/warming. */
  skipCause: FailureCause | null;
}

export const initialMonitorState: MonitorState = { op: "permission", band: null, skipCause: null };

export type MonitorAction =
  | { type: "REQUEST_PERMISSION" }
  | { type: "CAMERA_GRANTED" } // camera live AND session created → start warming up
  | { type: "CAMERA_BLOCKED" }
  | { type: "NO_ANCHOR" }
  | { type: "WINDOW_OUTCOME"; outcome: WindowOutcome }
  | { type: "WINDOW_SKIPPED"; cause: FailureCause };

export function monitorReducer(state: MonitorState, action: MonitorAction): MonitorState {
  switch (action.type) {
    case "REQUEST_PERMISSION":
      return { ...state, op: "permission" };
    case "CAMERA_GRANTED":
      return { ...state, op: "warming-up" };
    case "CAMERA_BLOCKED":
      return { ...state, op: "blocked" };
    case "NO_ANCHOR":
      return { ...state, op: "calibrate-first" };
    case "WINDOW_SKIPPED":
      // A skipped window keeps the last band (bloom holds) and shows the foggy skip
      // note; op is unchanged (still warming-up, or still active).
      return { ...state, skipCause: action.cause };
    case "WINDOW_OUTCOME": {
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
      // cause from on-device telemetry) via WINDOW_SKIPPED; treated as a no-op here.
      return state;
    }
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

/** Copy traces verbatim to the mock STATES map (serenify-008-monitoring-mock.html). */
export const BAND_DISPLAY: Record<Band, BandDisplay> = {
  at_ease: {
    tone: "ease",
    statelineTone: "meadow",
    head: "You're at ease right now",
    sub: "Steady and settled — nothing to do.",
  },
  a_little_tense: {
    tone: "little",
    statelineTone: "amber",
    head: "You're a little tense",
    sub: "A bit of an edge lately. Maybe a slow breath.",
  },
  tense: {
    tone: "tense",
    statelineTone: "amber",
    head: "You're feeling tense",
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

export function useMonitoringSession() {
  const [state, dispatch] = useReducer(monitorReducer, initialMonitorState);
  return { state, dispatch };
}
