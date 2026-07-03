"use client";

import { useEffect, useRef, useState } from "react";

import type { WindowOutcome } from "@/lib/api/monitoring-client";
import {
  CONFIRMATORY_LITTLE_TENSE_SUSTAINED_MS,
  CONFIRMATORY_PROMPT_MIN_DWELL_MS,
  CONFIRMATORY_TENSE_SUSTAINED_MS,
} from "@/lib/questionnaire/constants";
import type {
  ConfirmatoryExpiryReason,
  ConfirmatoryKind,
  ConfirmatoryOutcome,
} from "@/lib/questionnaire/types";

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
  /** The ACUTE (`tense`) trigger's sustained floor (~20s). */
  sustainedMs: number;
  /** #134 — the MILD (`a_little_tense`) trigger's sustained floor (~60s). */
  mildSustainedMs: number;
  dwellMs: number;
}

export const DEFAULT_TRIGGER_CONFIG: TriggerConfig = {
  sustainedMs: CONFIRMATORY_TENSE_SUSTAINED_MS,
  mildSustainedMs: CONFIRMATORY_LITTLE_TENSE_SUSTAINED_MS,
  dwellMs: CONFIRMATORY_PROMPT_MIN_DWELL_MS,
};

export interface TriggerState {
  /** When the current consecutive-`tense` (acute) run started (wall-clock ms); null when not tracking. */
  tenseRunStartMs: number | null;
  /** #134 — when the current consecutive-`a_little_tense` (mild) run started; null when not tracking. */
  littleRunStartMs: number | null;
  /** The prompt has been shown for this session (one-per-session guard). */
  shown: boolean;
  /** Which trigger produced the currently- (or most-recently-) shown prompt — decides which budget(s) an answer burns. */
  shownKind: ConfirmatoryKind | null;
  shownAtMs: number | null;
  /** Single-resolution guard for the currently (or most recently) shown prompt. */
  resolved: boolean;
  /**
   * The session's one-time ACUTE (`tense`) prompt budget — this IS the plan's `tenseBudgetConsumed`;
   * the field name is kept so the #127/#130/#132 guarantee tests stay byte-for-byte unchanged. Set
   * ONLY by an explicit answer to a TENSE prompt (which is senior and also burns the mild budget).
   * An auto-resolution (signal-drop expiry, session end) leaves it false so a later sustained-tense
   * episode can still prompt again this session. `budgetConsumed ⟹ mildBudgetConsumed`, always.
   */
  budgetConsumed: boolean;
  /**
   * #134 — the session's one-time MILD (`a_little_tense`) prompt budget. Set by an explicit answer
   * to EITHER a mild OR a tense prompt (a tense answer blocks any later down-tier mild nag).
   * Auto-resolutions never spend it.
   */
  mildBudgetConsumed: boolean;
  triggeredWindowCapturedAt: string | null;
  /** Whether the most recent processed outcome matched the SHOWN prompt's sustaining band. */
  lastOutcomeSustained: boolean;
}

export function initialTriggerState(): TriggerState {
  return {
    tenseRunStartMs: null,
    littleRunStartMs: null,
    shown: false,
    shownKind: null,
    shownAtMs: null,
    resolved: false,
    budgetConsumed: false,
    mildBudgetConsumed: false,
    triggeredWindowCapturedAt: null,
    lastOutcomeSustained: false,
  };
}

export type TriggerEffect =
  | { kind: "none" }
  | { kind: "show"; triggeredWindowCapturedAt: string }
  | { kind: "expire"; reason: "signal_drop" };

/** A `tense` band reading is the ONLY outcome that drives the ACUTE sustained clock. */
export function isTenseReading(
  outcome: WindowOutcome,
): outcome is { outcome: "reading"; band: "tense"; capturedAt: string } {
  return outcome.outcome === "reading" && outcome.band === "tense";
}

/**
 * #134 — an `a_little_tense` band reading is the ONLY outcome that drives the MILD sustained
 * clock. Exact-band match, deliberately parallel to `isTenseReading` — NOT a "≥ threshold" /
 * band-ordering test (the reducer has no band-ordering precedent, and must not gain one here).
 */
export function isLittleTenseReading(
  outcome: WindowOutcome,
): outcome is { outcome: "reading"; band: "a_little_tense"; capturedAt: string } {
  return outcome.outcome === "reading" && outcome.band === "a_little_tense";
}

/** Whether an outcome is the sustaining band for a shown prompt of `kind` — the reused dwell /
 *  signal-drop machinery keys off this so a mild prompt is kept alive by `a_little_tense` and a
 *  tense prompt by `tense`, unchanged otherwise. */
function isSustainingReading(outcome: WindowOutcome, kind: ConfirmatoryKind | null): boolean {
  if (kind === "tense") return isTenseReading(outcome);
  if (kind === "mild") return isLittleTenseReading(outcome);
  return false;
}

/** Apply an AUTO-resolution (signal-drop expiry / session end) — does NOT consume either budget;
 *  rearms the trigger so a fresh sustained episode can prompt again this session. The
 *  single-resolution guard for the just-finished prompt is implicit: `shown` resets to `false`,
 *  so any stale expiry check for it (`reduceDwellElapsed`) is a no-op. */
export function markResolvedRearm(state: TriggerState): TriggerState {
  return {
    ...initialTriggerState(),
    budgetConsumed: state.budgetConsumed,
    mildBudgetConsumed: state.mildBudgetConsumed,
  };
}

/** Apply an EXPLICIT user answer (confirmed / false_alarm / opened_chat), then rearm. Consumes
 *  the one-time budget for the KIND that was shown: a MILD answer burns ONLY the mild budget (a
 *  later sustained-tense episode keeps its shot); a TENSE answer is senior and burns BOTH (no
 *  down-tier mild nag after an acute answer). Rearming (resetting shown/runs/resolved) is what
 *  lets the session's still-open OTHER budget prompt again; the per-kind budget gate — not a
 *  latched flag — is what prevents a repeat of the SAME kind this session. */
export function markResolvedConsumingBudget(state: TriggerState): TriggerState {
  const tenseAnswer = state.shownKind === "tense";
  return {
    ...markResolvedRearm(state),
    mildBudgetConsumed: true,
    budgetConsumed: tenseAnswer ? true : state.budgetConsumed,
  };
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
  // A TENSE answer ends all prompting for the session (it burns BOTH budgets, so
  // budgetConsumed ⟹ mildBudgetConsumed). A MILD answer leaves budgetConsumed false, so
  // processing continues below and a later sustained-tense episode can still prompt.
  if (state.budgetConsumed) return { state, effect: { kind: "none" } };

  if (!state.shown) {
    // ── Pre-show: two independent sustained clocks under a per-band reset matrix ──
    const feedsTense = active && isTenseReading(outcome);
    const feedsLittle = active && isLittleTenseReading(outcome);
    // Matrix: a `tense` reading feeds the acute run and zeroes the mild run; an `a_little_tense`
    // reading feeds the mild run and zeroes the acute run; anything else / inactive zeroes both.
    // Climbing `a_little_tense` → `tense` therefore abandons the mild run and hands off to acute.
    const nextTense = feedsTense ? (state.tenseRunStartMs ?? nowMs) : null;
    const nextLittle = feedsLittle ? (state.littleRunStartMs ?? nowMs) : null;

    // ── Arbitration: the ACUTE (`tense`) condition is SENIOR and evaluated FIRST. If both runs
    // ever qualify in one reduce, tense wins. (The matrix makes the two mutually exclusive per
    // real reading; this ordering is an explicit, load-bearing guard against a later reorder.)
    if (feedsTense && nextTense != null && nowMs - nextTense >= config.sustainedMs) {
      return {
        state: {
          ...state,
          tenseRunStartMs: null,
          littleRunStartMs: null,
          shown: true,
          shownKind: "tense",
          shownAtMs: nowMs,
          triggeredWindowCapturedAt: outcome.capturedAt,
          lastOutcomeSustained: true,
        },
        effect: { kind: "show", triggeredWindowCapturedAt: outcome.capturedAt },
      };
    }
    // The MILD condition — reached only when the acute one did not fire, and only while the mild
    // budget is still open (a tense answer would have short-circuited above via budgetConsumed).
    if (
      feedsLittle &&
      !state.mildBudgetConsumed &&
      nextLittle != null &&
      nowMs - nextLittle >= config.mildSustainedMs
    ) {
      return {
        state: {
          ...state,
          tenseRunStartMs: null,
          littleRunStartMs: null,
          shown: true,
          shownKind: "mild",
          shownAtMs: nowMs,
          triggeredWindowCapturedAt: outcome.capturedAt,
          lastOutcomeSustained: true,
        },
        effect: { kind: "show", triggeredWindowCapturedAt: outcome.capturedAt },
      };
    }
    // No show — advance/reset both runs per the matrix.
    return {
      state: { ...state, tenseRunStartMs: nextTense, littleRunStartMs: nextLittle, lastOutcomeSustained: false },
      effect: { kind: "none" },
    };
  }

  // ── Shown, not resolved: reuse the dwell / signal-drop machinery, keyed to the shown kind's band ──
  if (isSustainingReading(outcome, state.shownKind)) {
    // sustaining band still present — no expiry, cancel any pending drop
    return { state: { ...state, lastOutcomeSustained: true }, effect: { kind: "none" } };
  }
  const onScreen = nowMs - (state.shownAtMs ?? nowMs);
  if (onScreen >= config.dwellMs) {
    return { state: markResolvedRearm(state), effect: { kind: "expire", reason: "signal_drop" } };
  }
  // dropped before the dwell floor — remember it; the dwell timer finalises it
  return { state: { ...state, lastOutcomeSustained: false }, effect: { kind: "none" } };
}

/**
 * The dwell timer fired (`CONFIRMATORY_PROMPT_MIN_DWELL_MS` after show). If the shown prompt's
 * sustaining band is currently dropped, expire by signal_drop; if it returned, wait for the next
 * drop. (The sustaining band is `tense` for an acute prompt, `a_little_tense` for a mild one.)
 */
export function reduceDwellElapsed(state: TriggerState): { state: TriggerState; effect: TriggerEffect } {
  if (state.budgetConsumed || !state.shown) return { state, effect: { kind: "none" } };
  if (!state.lastOutcomeSustained) {
    return { state: markResolvedRearm(state), effect: { kind: "expire", reason: "signal_drop" } };
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
    /** #134 — which trigger fired (`mild` = sustained a_little_tense, `tense` = sustained tense). */
    kind: ConfirmatoryKind;
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
    clearDwell();
    setVisible(false);
    const id = promptIdRef.current;
    if (resolution.type === "answered") {
      // Explicit user answer — consumes the shown kind's one-time budget (a tense answer burns
      // both; a mild answer burns only mild). Capture the kind BEFORE the reducer rearms it.
      const answeredKind = stateRef.current.shownKind;
      stateRef.current = markResolvedConsumingBudget(stateRef.current);
      // A MILD answer leaves the session's tense budget open, so rearm the per-prompt refs to let
      // a later sustained-tense episode show and resolve. A TENSE answer burns both budgets — keep
      // the refs latched exactly as before (#127/#130): the budget gate blocks any further prompt.
      if (answeredKind === "mild") {
        promptIdRef.current = null;
        resolvedRef.current = false;
      }
    } else {
      // Auto-resolution (signal-drop / session-end) never spends a budget — rearm so a
      // later sustained episode can still prompt again this session.
      stateRef.current = markResolvedRearm(stateRef.current);
      promptIdRef.current = null;
      resolvedRef.current = false;
    }
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

  async function handleShow(capturedAt: string, kind: ConfirmatoryKind) {
    const d = depsRef.current;
    const sid = d.sessionId;
    let readingId: string | null = null;
    if (d.resolveWindowReadingId && sid) {
      readingId = await d.resolveWindowReadingId(sid, capturedAt);
    }
    const id = await d.createPrompt({ triggeredWindowCapturedAt: capturedAt, triggerWindowReadingId: readingId, kind });
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
    // The show effect carries the trigger time; the KIND rides on the reduced state (`shownKind`),
    // set atomically with the show transition — kept off the effect so the effect shape (and the
    // #127/#130/#132 reducer tests that pin it) stays unchanged.
    if (effect.kind === "show" && state.shownKind) void handleShow(effect.triggeredWindowCapturedAt, state.shownKind);
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
