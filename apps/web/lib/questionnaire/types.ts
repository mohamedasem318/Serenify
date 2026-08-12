/**
 * Feature 012 — shared questionnaire domain types + enum guards.
 *
 * This module is the single client-side mirror of the `data-model.md` enumerations and
 * the migration CHECK constraints in `20260630000000_questionnaire_feedback.sql`. The
 * value lists below are the source of truth the UI and the typed client both import, so
 * a value can never drift from the DB (a drift would be a Principle VII / persistence
 * failure). Pure module — no Supabase, no React, no `server-only` binding — so it is
 * trivially unit-testable (T025).
 */

// ── Confirmatory prompt (questionnaire_confirmatory_prompts) ─────────────────────────

/**
 * Which trigger produced a confirmatory prompt (#134). `tense` = the ~20s sustained-`tense`
 * acute spike; `mild` = the ~60s sustained-`a_little_tense` slow simmer. Mirrors the migration's
 * `kind` CHECK — the DB caps ANSWERED rows at one per (session, kind).
 */
export const CONFIRMATORY_KINDS = ["mild", "tense"] as const;
export type ConfirmatoryKind = (typeof CONFIRMATORY_KINDS)[number];

export const CONFIRMATORY_OUTCOMES = ["confirmed", "false_alarm", "opened_chat"] as const;
export type ConfirmatoryOutcome = (typeof CONFIRMATORY_OUTCOMES)[number];

export const CONFIRMATORY_LIFECYCLES = ["visible", "answered", "expired"] as const;
export type ConfirmatoryLifecycle = (typeof CONFIRMATORY_LIFECYCLES)[number];

export const CONFIRMATORY_EXPIRY_REASONS = ["signal_drop", "session_end"] as const;
export type ConfirmatoryExpiryReason = (typeof CONFIRMATORY_EXPIRY_REASONS)[number];

export const CONFIRMATORY_AGGREGATE_TREATMENTS = ["none", "exclude_or_down_weight"] as const;
export type ConfirmatoryAggregateTreatment = (typeof CONFIRMATORY_AGGREGATE_TREATMENTS)[number];

// ── Session-end product feedback (questionnaire_session_feedback) ─────────────────────

export const SESSION_FEEDBACK_STATUSES = ["submitted", "skipped"] as const;
export type SessionFeedbackStatus = (typeof SESSION_FEEDBACK_STATUSES)[number];

export const SESSION_FEEDBACK_SENTIMENTS = ["good", "off"] as const;
export type SessionFeedbackSentiment = (typeof SESSION_FEEDBACK_SENTIMENTS)[number];

export const SESSION_FEEDBACK_REASONS = [
  "suggestion_didnt_help",
  "needed_quiet",
  "ren_too_robotic",
  "something_else",
] as const;
export type SessionFeedbackReason = (typeof SESSION_FEEDBACK_REASONS)[number];

export const SESSION_FEEDBACK_ACTION_TARGETS = ["preferences", "notifications", "ack_only"] as const;
export type SessionFeedbackActionTarget = (typeof SESSION_FEEDBACK_ACTION_TARGETS)[number];

export const SESSION_FEEDBACK_SAMPLING_POLICIES = ["every_session"] as const;
export type SessionFeedbackSamplingPolicy = (typeof SESSION_FEEDBACK_SAMPLING_POLICIES)[number];

// ── Weekly work-environment survey ────────────────────────────────────────────────────

export const WEEKLY_SENTIMENTS = ["good", "could_be_better"] as const;
export type WeeklySentiment = (typeof WEEKLY_SENTIMENTS)[number];

export const WEEKLY_ROADBLOCKS = [
  "unclear_instructions_or_goals",
  "waiting_on_other_team_members",
  "software_or_tools_crashing",
] as const;
export type WeeklyRoadblock = (typeof WEEKLY_ROADBLOCKS)[number];

export const WEEKLY_SUPPORTS = [
  "deadline_flexibility",
  "better_team_alignment_or_communication",
  "quieter_workspace",
  "better_technical_equipment",
] as const;
export type WeeklySupport = (typeof WEEKLY_SUPPORTS)[number];

// ── Guards (narrow `unknown` from the wire / DOM to a domain union) ──────────────────

function makeGuard<T extends string>(values: readonly T[]) {
  const set = new Set<string>(values);
  return (value: unknown): value is T => typeof value === "string" && set.has(value);
}

export const isConfirmatoryKind = makeGuard(CONFIRMATORY_KINDS);
export const isConfirmatoryOutcome = makeGuard(CONFIRMATORY_OUTCOMES);
export const isConfirmatoryLifecycle = makeGuard(CONFIRMATORY_LIFECYCLES);
export const isConfirmatoryExpiryReason = makeGuard(CONFIRMATORY_EXPIRY_REASONS);
export const isSessionFeedbackStatus = makeGuard(SESSION_FEEDBACK_STATUSES);
export const isSessionFeedbackSentiment = makeGuard(SESSION_FEEDBACK_SENTIMENTS);
export const isSessionFeedbackReason = makeGuard(SESSION_FEEDBACK_REASONS);
export const isWeeklySentiment = makeGuard(WEEKLY_SENTIMENTS);
export const isWeeklyRoadblock = makeGuard(WEEKLY_ROADBLOCKS);
export const isWeeklySupport = makeGuard(WEEKLY_SUPPORTS);

// ── Derivations (kept here so the client AND the UI agree on the same mapping) ────────

/**
 * The forward aggregate marker for feature 017: ONLY a `false_alarm` answer is marked
 * `exclude_or_down_weight`; every other outcome stays `none`. Mirrors the migration's
 * `qcp_false_alarm_treatment` CHECK so the client never writes a row the DB would reject.
 */
export function aggregateTreatmentFor(outcome: ConfirmatoryOutcome): ConfirmatoryAggregateTreatment {
  return outcome === "false_alarm" ? "exclude_or_down_weight" : "none";
}

/**
 * The account route a negative session-end reason maps to. `suggestion_didnt_help` →
 * preferences seam (`/app/account`), `needed_quiet` → notifications section, and the
 * employee-private signals (`ren_too_robotic`, `something_else` free text) acknowledge
 * only — they are never routed to Ren or a manager surface.
 */
export function actionTargetForReason(reason: SessionFeedbackReason): SessionFeedbackActionTarget {
  switch (reason) {
    case "suggestion_didnt_help":
      return "preferences";
    case "needed_quiet":
      return "notifications";
    case "ren_too_robotic":
    case "something_else":
      return "ack_only";
  }
}
