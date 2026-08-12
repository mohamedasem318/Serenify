import type { WeeklyCadenceRow, WeeklyCadenceUpsert } from "@/lib/api/questionnaire-client";

/**
 * Feature 012 / US3 — weekly work-environment survey cadence (pure).
 *
 * Decides whether the weekly work-environment card is due, based on the caller's private
 * `weekly_checkin_cadence` row for the current ISO week. That table name, and the
 * `shouldShowWeeklyCheckIn` export below, are IDENTIFIERS and are quoted as they are:
 * #198 renamed the concept in copy only and deliberately left every identifier alone.
 * Rules (data-model.md):
 *   • First authenticated visit of a new ISO week → show (no row yet, or an un-skipped,
 *     un-completed row).
 *   • First skip → at most ONE later same-week re-prompt.
 *   • Second skip → suppress until the next ISO week.
 *   • Completion → no further prompts that week.
 *   • An abandoned Q2 writes nothing, so eligibility is unchanged (the card stays due).
 *
 * Pure — no Supabase, no React. The card/coordinator read the row, ask these helpers, and
 * persist the returned cadence patches through the authenticated client.
 */

const MAX_SKIPS = 2;
const MAX_PROMPTS = 2;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * The Monday (ISO-week start) for `now`, in the user's LOCAL week, as `YYYY-MM-DD`. This is
 * the bucket the submit RPC validates (`extract(isodow) = 1`), so the card and the DB agree.
 */
export function currentIsoWeekStart(now: Date): string {
  const day = now.getDay(); // 0=Sun … 6=Sat
  const deltaToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + deltaToMonday);
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
}

/**
 * Whether the weekly card is due for the current ISO week. Due when there is no cadence row
 * yet, OR the row is neither completed, skipped twice, nor already shown twice (the
 * `prompt_count` cap keeps the card from re-appearing on every dashboard visit — calm-first).
 */
export function shouldShowWeeklyCheckIn(cadence: WeeklyCadenceRow | null): boolean {
  if (!cadence) return true;
  if (cadence.completedAt) return false;
  return cadence.skippedCount < MAX_SKIPS && cadence.promptCount < MAX_PROMPTS;
}

/** Cadence patch recording that the card was shown (increments prompt_count, stamps the time). */
export function promptShownPatch(
  cadence: WeeklyCadenceRow | null,
  userId: string,
  isoWeekStart: string,
  nowIso: string,
): WeeklyCadenceUpsert {
  return {
    userId,
    isoWeekStart,
    promptCount: Math.min((cadence?.promptCount ?? 0) + 1, MAX_SKIPS),
    lastPromptedAt: nowIso,
  };
}

/** Cadence patch recording a skip (increments skipped_count; never writes an answer value). */
export function skipPatch(
  cadence: WeeklyCadenceRow | null,
  userId: string,
  isoWeekStart: string,
): WeeklyCadenceUpsert {
  return {
    userId,
    isoWeekStart,
    skippedCount: Math.min((cadence?.skippedCount ?? 0) + 1, MAX_SKIPS),
  };
}
