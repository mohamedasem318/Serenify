/**
 * Feature 012 — confirmatory prompt product tunables.
 *
 * These are PRODUCT prompt tunables layered over the existing coarse `Band` contract —
 * NOT stress-model thresholds, weights, or metadata (research.md R-8). They live in the
 * browser beside the monitoring loop; nothing here touches `packages/ml-video` or the
 * inference service.
 */

/** Consecutive `tense` must be sustained this long (wall-clock) before the prompt shows. */
export const CONFIRMATORY_TENSE_SUSTAINED_MS = 20_000;

/** A shown prompt must stay on screen at least this long before a signal-drop may expire it. */
export const CONFIRMATORY_PROMPT_MIN_DWELL_MS = 4_500;

/** A `false_alarm` answer suppresses the confirmatory prompt for exactly this many next sessions. */
export const CONFIRMATORY_FALSE_ALARM_SUPPRESS_NEXT_SESSIONS = 1;
