"use client";

import { useEffect, useRef, useState } from "react";

import type { WindowOutcome } from "@/lib/api/monitoring-client";
import {
  CONFIRMATORY_PROMPT_MIN_DWELL_MS,
  CONFIRMATORY_TENSE_SUSTAINED_MS,
} from "@/lib/questionnaire/constants";
import type { ConfirmatoryExpiryReason, ConfirmatoryOutcome } from "@/lib/questionnaire/types";

/**
 * Feature 012 / US1 — the confirmatory prompt trigger.
 *
 * The timing logic is a set of PURE reducers over an injected `now` (no clock, no React),
 * so every sustained-tense / dwell / one-per-session / single-resolution decision is
 * deterministically testable. `useConfirmatoryTrigger` wires those reducers to the live
 * monitoring `WindowOutcome` stream, the async persistence callbacks, the dwell timer, and
 * the next-session false-alarm suppression seam.
 *
 * Constraints honoured (research.md R-3): the trigger is BROWSER-LOCAL and per-session —
 * it keeps no `localStorage`/`sessionStorage`/global state and assumes no cross-worker or
 * server eligibility state (the inference service keeps its smoothing in memory). It also
 * NEVER consumes a Ren/chat-derived band — its only input is the monitoring window stream.
 */

export interface TriggerConfig {
  sustainedMs: number;
  dwellMs: number;
}

export const DEFAULT_TRIGGER_CONFIG: TriggerConfig = {
  sustainedMs: CONFIRMATORY_TENSE_SUSTAINED_MS,
  dwellMs: CONFIRMATORY_PROMPT_MIN_DWELL_MS,
};

export interface TriggerState {
  /** When the current consecutive-`tense` run started (wall-clock ms); null when not tracking. */
  tenseRunStartMs: number | null;
  /** The prompt has been shown for this session (one-per-session guard). */
  shown: boolean;
  shownAtMs: number | null;
  /** Single-resolution guard — true once answered or expired. */
  resolved: boolean;
  triggeredWindowCapturedAt: string | null;
  /** Whether the most recent processed outcome was a `tense` reading. */
  lastOutcomeTense: boolean;
}

export function initialTriggerState(): TriggerState {
  return {
    tenseRunStartMs: null,
    shown: false,
    shownAtMs: null,
    resolved: false,
    triggeredWindowCapturedAt: null,
    lastOutcomeTense: false,
  };
}

export type TriggerEffect =
  | { kind: "none" }
  | { kind: "show"; triggeredWindowCapturedAt: string }
  | { kind: "expire"; reason: "signal_drop" };

/** A `tense` band reading is the ONLY outcome that drives the sustained clock. */
export function isTenseReading(
  outcome: WindowOutcome,
): outcome is { outcome: "reading"; band: "tense"; capturedAt: string } {
  return outcome.outcome === "reading" && outcome.band === "tense";
}

/** Mark the state resolved (answered or expired) — no further prompt this session. */
export function markResolved(state: TriggerState): TriggerState {
  return { ...state, resolved: true };
}

/**
 * Fold one monitoring outcome into the trigger state, returning the next state and the
 * effect the host should run (show / expire / none).
 */
export function reduceOutcome(
  state: TriggerState,
  outcome: WindowOutcome,
  nowMs: number,
  active: boolean,
  config: TriggerConfig,
): { state: TriggerState; effect: TriggerEffect } {
  if (state.resolved) return { state, effect: { kind: "none" } };

  const tense = isTenseReading(outcome);

  if (!state.shown) {
    // ── Pre-show: track consecutive tense ──
    if (active && isTenseReading(outcome)) {
      if (state.tenseRunStartMs == null) {
        return {
          state: { ...state, tenseRunStartMs: nowMs, lastOutcomeTense: true },
          effect: { kind: "none" },
        };
      }
      const elapsed = nowMs - state.tenseRunStartMs;
      if (elapsed >= config.sustainedMs) {
        return {
          state: {
            ...state,
            shown: true,
            shownAtMs: nowMs,
            triggeredWindowCapturedAt: outcome.capturedAt,
            lastOutcomeTense: true,
          },
          effect: { kind: "show", triggeredWindowCapturedAt: outcome.capturedAt },
        };
      }
      return { state: { ...state, lastOutcomeTense: true }, effect: { kind: "none" } };
    }
    // any lower band / non-reading / inactive resets the run
    return { state: { ...state, tenseRunStartMs: null, lastOutcomeTense: false }, effect: { kind: "none" } };
  }

  // ── Shown, not resolved: handle signal-drop expiry past the dwell floor ──
  if (tense) {
    // signal returned to tense — no expiry, cancel any pending drop
    return { state: { ...state, lastOutcomeTense: true }, effect: { kind: "none" } };
  }
  const onScreen = nowMs - (state.shownAtMs ?? nowMs);
  if (onScreen >= config.dwellMs) {
    return { state: { ...markResolved(state), lastOutcomeTense: false }, effect: { kind: "expire", reason: "signal_drop" } };
  }
  // dropped before the dwell floor — remember it; the dwell timer finalises it
  return { state: { ...state, lastOutcomeTense: false }, effect: { kind: "none" } };
}

/**
 * The dwell timer fired (`CONFIRMATORY_PROMPT_MIN_DWELL_MS` after show). If the signal is
 * currently dropped, expire by signal_drop; if it returned to tense, wait for the next drop.
 */
export function reduceDwellElapsed(state: TriggerState): { state: TriggerState; effect: TriggerEffect } {
  if (state.resolved || !state.shown) return { state, effect: { kind: "none" } };
  if (!state.lastOutcomeTense) {
    return { state: markResolved(state), effect: { kind: "expire", reason: "signal_drop" } };
  }
  return { state, effect: { kind: "none" } };
}

// ── Hook ──────────────────────────────────────────────────────────────────────────────

export type PromptResolution =
  | { type: "answered"; outcome: ConfirmatoryOutcome }
  | { type: "expired"; reason: ConfirmatoryExpiryReason };

export interface ConfirmatoryTriggerDeps {
  /** Active monitoring session id; the trigger fully resets when this changes. */
  sessionId: string | null;
  /** Whether the monitoring session is actively recording (not paused/ended). */
  active: boolean;
  /** The latest monitoring window outcome (the ONLY trigger input — never a chat band). */
  latestOutcome: WindowOutcome | null;
  /** Persist a freshly-shown prompt row; resolves to the new row id (or null on failure). */
  createPrompt: (input: {
    triggeredWindowCapturedAt: string;
    triggerWindowReadingId: string | null;
  }) => Promise<string | null>;
  /** Resolve the shown prompt exactly once (answered outcome or expiry reason). */
  resolvePrompt: (promptId: string, resolution: PromptResolution) => Promise<void> | void;
  /** Optional owner-visible `window_readings.id` lookup by (session, captured_at). */
  resolveWindowReadingId?: (sessionId: string, capturedAt: string) => Promise<string | null>;
  /** True when THIS session inherits a previous session's false-alarm suppression. */
  hasFalseAlarmNextSessionSuppression: () => boolean;
  /** Consume the inherited suppression so it applies to one session only. */
  consumeFalseAlarmNextSessionSuppression: () => void;
  /** Arm suppression for the NEXT session after a false alarm. */
  armFalseAlarmNextSessionSuppression: () => void;
  /** Open Ren with the confirmatory handoff seam (no recommendation cards). */
  openRen: (handoff: "confirmatory_yes" | "confirmatory_maybe") => void;
  config?: TriggerConfig;
}

export interface ConfirmatoryTriggerApi {
  visible: boolean;
  onConfirm: () => void;
  onFalseAlarm: () => void;
  onOpenChat: () => void;
  /**
   * Force-expire the visible prompt (reason=session_end). Returns a promise that settles once
   * the resolve has been issued, so the host can AWAIT it before session-end navigation.
   */
  resolveForSessionEnd: () => Promise<void>;
}

export function useConfirmatoryTrigger(deps: ConfirmatoryTriggerDeps): ConfirmatoryTriggerApi {
  // Keep the latest deps in a ref so the event handlers / effects below read current
  // callbacks without re-subscribing. Updated in an effect (never during render) so the
  // session-keyed effects, declared after, observe the fresh value.
  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  });

  const [visible, setVisible] = useState(false);
  const stateRef = useRef<TriggerState>(initialTriggerState());
  const promptIdRef = useRef<string | null>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressedRef = useRef(false);
  const resolvedRef = useRef(false);
  const processedRef = useRef<WindowOutcome | null>(null);

  const { sessionId, active, latestOutcome } = deps;
  const config = deps.config ?? DEFAULT_TRIGGER_CONFIG;

  function clearDwell() {
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  }

  function finalize(resolution: PromptResolution): Promise<void> {
    if (resolvedRef.current) return Promise.resolve(); // single-resolution guard across all races
    resolvedRef.current = true;
    stateRef.current = markResolved(stateRef.current);
    clearDwell();
    setVisible(false);
    const id = promptIdRef.current;
    return id ? Promise.resolve(depsRef.current.resolvePrompt(id, resolution)) : Promise.resolve();
  }

  // Answer that opens Ren: persist the outcome BEFORE navigating, so a full-page nav can't
  // abort the resolve request and leave the row stuck `visible`.
  async function answerThenOpen(
    outcome: ConfirmatoryOutcome,
    handoff: "confirmatory_yes" | "confirmatory_maybe",
  ) {
    await finalize({ type: "answered", outcome });
    depsRef.current.openRen(handoff);
  }

  async function handleShow(capturedAt: string) {
    const d = depsRef.current;
    const sid = d.sessionId;
    let readingId: string | null = null;
    if (d.resolveWindowReadingId && sid) {
      readingId = await d.resolveWindowReadingId(sid, capturedAt);
    }
    const id = await d.createPrompt({ triggeredWindowCapturedAt: capturedAt, triggerWindowReadingId: readingId });
    if (!id) return;
    if (resolvedRef.current) {
      // Resolved (e.g. the session ended) while the insert was in flight — the row was created
      // but never shown, so resolve it as expired so it never sticks at lifecycle='visible'.
      void Promise.resolve(d.resolvePrompt(id, { type: "expired", reason: "session_end" }));
      return;
    }
    promptIdRef.current = id;
    setVisible(true);
    clearDwell();
    dwellTimerRef.current = setTimeout(() => {
      const { state, effect } = reduceDwellElapsed(stateRef.current);
      stateRef.current = state;
      if (effect.kind === "expire") finalize({ type: "expired", reason: effect.reason });
    }, config.dwellMs);
  }

  // Reset on new session and consume any inherited false-alarm suppression.
  useEffect(() => {
    stateRef.current = initialTriggerState();
    promptIdRef.current = null;
    processedRef.current = null;
    resolvedRef.current = false;
    suppressedRef.current = false;
    clearDwell();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time reset of the visible flag when the monitoring session changes (not a render cascade)
    setVisible(false);
    const d = depsRef.current;
    if (sessionId && d.hasFalseAlarmNextSessionSuppression()) {
      d.consumeFalseAlarmNextSessionSuppression();
      suppressedRef.current = true;
    }
    return () => clearDwell();
  }, [sessionId]);

  // Fold each new monitoring outcome into the trigger.
  useEffect(() => {
    if (suppressedRef.current || !sessionId || !latestOutcome) return;
    if (processedRef.current === latestOutcome) return;
    processedRef.current = latestOutcome;
    const { state, effect } = reduceOutcome(stateRef.current, latestOutcome, Date.now(), active, config);
    stateRef.current = state;
    if (effect.kind === "show") void handleShow(effect.triggeredWindowCapturedAt);
    else if (effect.kind === "expire") finalize({ type: "expired", reason: effect.reason });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks read from depsRef; effect keyed to the outcome/active/session
  }, [latestOutcome, active, sessionId]);

  return {
    visible,
    onConfirm: () => void answerThenOpen("confirmed", "confirmatory_yes"),
    onOpenChat: () => void answerThenOpen("opened_chat", "confirmatory_maybe"),
    onFalseAlarm: () => {
      void finalize({ type: "answered", outcome: "false_alarm" });
      depsRef.current.armFalseAlarmNextSessionSuppression();
    },
    resolveForSessionEnd: () => finalize({ type: "expired", reason: "session_end" }),
  };
}
