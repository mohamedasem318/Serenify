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

/**
 * Consecutive `a_little_tense` must be sustained this long before the milder prompt shows —
 * the "slow simmer" that never spikes into `tense` (feature 012 / #134).
 *
 * PROVISIONAL: ~60s is a DESIGNED DEFAULT, not empirically calibrated. StressID's 60s stressor
 * clips can't validate a sustained-mild threshold under the 4×60s smoothing buffer (there is no
 * headroom to observe a full minute of *sustained* mild band inside a 60s clip), the same
 * limitation that leaves the 0.70 `tense` band uncalibrated (#128). Recover the real value from
 * live deployment data once sessions are running.
 */
export const CONFIRMATORY_LITTLE_TENSE_SUSTAINED_MS = 60_000;

/** A shown prompt must stay on screen at least this long before a signal-drop may expire it. */
export const CONFIRMATORY_PROMPT_MIN_DWELL_MS = 4_500;

/** A `false_alarm` answer suppresses the confirmatory prompt for exactly this many next sessions. */
export const CONFIRMATORY_FALSE_ALARM_SUPPRESS_NEXT_SESSIONS = 1;

/**
 * How long the weekly check-in's own "ending" screen (smiley/check/muted result + message)
 * stays visible before the card notifies the coordinator it is resolved. Without this dwell,
 * `onResolved` fires in the same React commit as the card's local ending state, so the
 * coordinator swaps surfaces before the ending screen ever paints — the acknowledgment is
 * never actually seen.
 */
export const QUESTIONNAIRE_RESULT_DWELL_MS = 2_500;
