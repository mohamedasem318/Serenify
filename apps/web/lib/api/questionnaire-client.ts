import { createClient } from "@/lib/supabase/client";
import {
  aggregateTreatmentFor,
  actionTargetForReason,
  type ConfirmatoryExpiryReason,
  type ConfirmatoryKind,
  type ConfirmatoryOutcome,
  type SessionFeedbackReason,
  type SessionFeedbackSentiment,
  type SessionFeedbackStatus,
  type WeeklyRoadblock,
  type WeeklySentiment,
  type WeeklySupport,
} from "@/lib/questionnaire/types";

/**
 * Feature 012 — the typed, **browser-side Supabase RLS** questionnaire data client.
 *
 * Like `monitoring-reads.ts` (its sibling read layer), every call here runs as the
 * signed-in employee through `createClient()` (the `@supabase/ssr` browser client), so
 * RLS scopes each row to `auth.uid()`. There is deliberately:
 *   • NO admin / service-role client import (Principle IX). Imports `@/lib/supabase/client`
 *     ONLY — never `@/lib/supabase/admin`.
 *   • NO direct `weekly_work_environment_contributions` access — the identity-stripped
 *     aggregate table is reachable ONLY through the two SECURITY DEFINER RPCs, so this
 *     client never names that table. Employee writes go through `submit_…`; the manager
 *     aggregate read (future feature 017) goes through `get_…` and returns grouped counts.
 *   • NO manager individual-row read path of any kind.
 *
 * The Supabase client is injectable (`opts.client`) so each call is unit-testable against
 * a recording mock with zero network (T024) — the exact pattern `monitoring-reads` uses.
 */

export type QuestionnaireClient = ReturnType<typeof createClient>;

export type QResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export interface QClientOpts {
  /** Injectable Supabase client (defaults to the browser RLS client). */
  client?: QuestionnaireClient;
  /** Injectable clock (defaults to `new Date()`) — keeps the answered/skip timestamps testable. */
  now?: Date;
}

function db(opts?: QClientOpts): QuestionnaireClient {
  return opts?.client ?? createClient();
}

function nowIso(opts?: QClientOpts): string {
  return (opts?.now ?? new Date()).toISOString();
}

function fail(error: unknown): { ok: false; error: string } {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  return { ok: false, error: message };
}

// ── Confirmatory prompt lifecycle ─────────────────────────────────────────────────────

export interface NewConfirmatoryPrompt {
  userId: string;
  monitoringSessionId: string;
  /** From the live `WindowOutcome.capturedAt` that crossed the trigger's sustained floor. */
  triggeredWindowCapturedAt: string;
  /** #134 — which trigger fired: `mild` (sustained a_little_tense) or `tense` (sustained tense). */
  kind: ConfirmatoryKind;
  /** Optional owner-visible `window_readings.id`, resolved by (session, captured_at). */
  triggerWindowReadingId?: string | null;
}

/**
 * Insert the prompt row the moment it becomes visible: `lifecycle='visible'`, the trigger `kind`
 * (#134), `trigger_band='tense'` (the existing constrained column, unchanged), owner + owned-session
 * linkage. A session may hold several visible/expired rows (one per re-arm episode); the DB caps
 * ANSWERED rows at one per (session, kind) — `qcp_one_answered_per_session_per_kind`, a partial
 * unique index. Returns the new row id for the later resolve.
 */
export async function createConfirmatoryPrompt(
  input: NewConfirmatoryPrompt,
  opts?: QClientOpts,
): Promise<QResult<{ id: string }>> {
  const payload: Record<string, unknown> = {
    user_id: input.userId,
    monitoring_session_id: input.monitoringSessionId,
    triggered_window_captured_at: input.triggeredWindowCapturedAt,
    kind: input.kind,
    trigger_band: "tense",
    lifecycle: "visible",
  };
  if (input.triggerWindowReadingId) {
    payload.trigger_window_reading_id = input.triggerWindowReadingId;
  }
  const { data, error } = await db(opts)
    .from("questionnaire_confirmatory_prompts")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) {
    const result = fail(error ?? "no row returned");
    console.error("[questionnaire] confirmatory prompt create failed:", result.error);
    return result;
  }
  return { ok: true, data: { id: (data as { id: string }).id } };
}

/**
 * Resolve a visible prompt to `answered` with exactly one outcome. The forward
 * aggregate marker is derived from the outcome (`false_alarm` → `exclude_or_down_weight`).
 */
export async function resolveConfirmatoryAnswered(
  promptId: string,
  outcome: ConfirmatoryOutcome,
  opts?: QClientOpts,
): Promise<QResult> {
  const { error } = await db(opts)
    .from("questionnaire_confirmatory_prompts")
    .update({
      lifecycle: "answered",
      outcome,
      answered_at: nowIso(opts),
      aggregate_treatment: aggregateTreatmentFor(outcome),
    })
    .eq("id", promptId);
  if (error) return fail(error);
  return { ok: true, data: null };
}

/** Resolve a visible prompt to `expired` (signal_drop after dwell, or session_end). */
export async function resolveConfirmatoryExpired(
  promptId: string,
  reason: ConfirmatoryExpiryReason,
  opts?: QClientOpts,
): Promise<QResult> {
  const { error } = await db(opts)
    .from("questionnaire_confirmatory_prompts")
    .update({ lifecycle: "expired", expiry_reason: reason })
    .eq("id", promptId);
  if (error) return fail(error);
  return { ok: true, data: null };
}

// ── Session-end product feedback ──────────────────────────────────────────────────────

export interface SessionFeedbackInput {
  userId: string;
  monitoringSessionId: string;
  status: SessionFeedbackStatus;
  sentiment?: SessionFeedbackSentiment;
  reason?: SessionFeedbackReason;
  /** Raw free text for `something_else`; trimmed here and dropped if empty. */
  freeText?: string;
}

/**
 * Persist one employee-private session-end feedback row. Skip stores nothing but the
 * status; a submitted `off` row carries its reason and a derived `action_target`. Free
 * text is trimmed and kept ONLY for `something_else`. This row never reaches Ren or a
 * manager surface — it is owner-only by RLS.
 */
export async function saveSessionFeedback(
  input: SessionFeedbackInput,
  opts?: QClientOpts,
): Promise<QResult<{ id: string }>> {
  const sentiment = input.status === "submitted" ? (input.sentiment ?? null) : null;
  const isOff = sentiment === "off";
  const reason = isOff ? (input.reason ?? null) : null;
  const actionTarget = isOff && input.reason ? actionTargetForReason(input.reason) : null;
  const trimmedFreeText =
    isOff && input.reason === "something_else" ? (input.freeText ?? "").trim() : "";
  // Every nullable column is set explicitly, never merely omitted: this is an upsert (a
  // reason switch on the same session overwrites the row), and PostgREST's ON CONFLICT DO
  // UPDATE only touches columns present in the payload. An omitted key would keep its
  // previous value from an earlier reason and could violate qsf_free_text_scope /
  // qsf_good_no_reason / qsf_skip_is_empty on the overwrite.
  const payload = {
    user_id: input.userId,
    monitoring_session_id: input.monitoringSessionId,
    status: input.status,
    sentiment,
    reason,
    action_target: actionTarget,
    free_text: trimmedFreeText ? trimmedFreeText : null,
  };
  const { data, error } = await db(opts)
    .from("questionnaire_session_feedback")
    .upsert(payload, { onConflict: "monitoring_session_id" })
    .select("id")
    .single();
  if (error || !data) return fail(error ?? "no row returned");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

// ── Weekly cadence (employee-private; no answer values) ───────────────────────────────

export interface WeeklyCadenceRow {
  id: string;
  userId: string;
  isoWeekStart: string;
  promptCount: number;
  skippedCount: number;
  lastPromptedAt: string | null;
  completedAt: string | null;
}

export async function getWeeklyCadence(
  userId: string,
  isoWeekStart: string,
  opts?: QClientOpts,
): Promise<WeeklyCadenceRow | null> {
  const { data, error } = await db(opts)
    .from("weekly_checkin_cadence")
    .select("id, user_id, iso_week_start, prompt_count, skipped_count, last_prompted_at, completed_at")
    .eq("user_id", userId)
    .eq("iso_week_start", isoWeekStart)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: r.id as string,
    userId: r.user_id as string,
    isoWeekStart: r.iso_week_start as string,
    promptCount: Number(r.prompt_count ?? 0),
    skippedCount: Number(r.skipped_count ?? 0),
    lastPromptedAt: (r.last_prompted_at as string | null) ?? null,
    completedAt: (r.completed_at as string | null) ?? null,
  };
}

export interface WeeklyCadenceUpsert {
  userId: string;
  isoWeekStart: string;
  promptCount?: number;
  skippedCount?: number;
  lastPromptedAt?: string | null;
}

/** Upsert the caller's private cadence row (shown-prompt / skip bookkeeping only). */
export async function upsertWeeklyCadence(
  input: WeeklyCadenceUpsert,
  opts?: QClientOpts,
): Promise<QResult> {
  const payload: Record<string, unknown> = {
    user_id: input.userId,
    iso_week_start: input.isoWeekStart,
  };
  if (input.promptCount != null) payload.prompt_count = input.promptCount;
  if (input.skippedCount != null) payload.skipped_count = input.skippedCount;
  if (input.lastPromptedAt !== undefined) payload.last_prompted_at = input.lastPromptedAt;
  const { error } = await db(opts)
    .from("weekly_checkin_cadence")
    .upsert(payload, { onConflict: "user_id,iso_week_start" });
  if (error) return fail(error);
  return { ok: true, data: null };
}

// ── Weekly aggregate RPCs (the identity-stripped boundary) ────────────────────────────

export interface WeeklySubmitInput {
  isoWeekStart: string;
  sentiment: WeeklySentiment;
  roadblock?: WeeklyRoadblock;
  support?: WeeklySupport;
}

/**
 * Submit one identity-stripped weekly contribution + complete private cadence, through
 * the caller-validating `submit_weekly_work_environment_checkin` DEFINER RPC. The web
 * client never touches the contributions table directly.
 */
export async function submitWeeklyCheckin(
  input: WeeklySubmitInput,
  opts?: QClientOpts,
): Promise<QResult> {
  const { error } = await db(opts).rpc("submit_weekly_work_environment_checkin", {
    p_iso_week_start: input.isoWeekStart,
    p_sentiment: input.sentiment,
    p_roadblock: input.roadblock ?? null,
    p_support: input.support ?? null,
  });
  if (error) return fail(error);
  return { ok: true, data: null };
}

export interface WeeklySummaryRow {
  isoWeekStart: string;
  sampleSize: number;
  sentiment: WeeklySentiment;
  roadblock: WeeklyRoadblock | null;
  support: WeeklySupport | null;
  responseCount: number;
}

/**
 * Aggregate-only manager read (forward contract for feature 017). The RPC is role-gated
 * (employees rejected) and returns grouped counts only — never an individual row or id.
 */
export async function getWeeklySummary(
  isoWeekStart: string,
  opts?: QClientOpts,
): Promise<QResult<WeeklySummaryRow[]>> {
  const { data, error } = await db(opts).rpc("get_weekly_work_environment_summary", {
    p_iso_week_start: isoWeekStart,
  });
  if (error) return fail(error);
  const rows = (data ?? []) as Record<string, unknown>[];
  return {
    ok: true,
    data: rows.map((r) => ({
      isoWeekStart: r.iso_week_start as string,
      sampleSize: Number(r.sample_size ?? 0),
      sentiment: r.sentiment as WeeklySentiment,
      roadblock: (r.roadblock as WeeklyRoadblock | null) ?? null,
      support: (r.support as WeeklySupport | null) ?? null,
      responseCount: Number(r.response_count ?? 0),
    })),
  };
}
