/**
 * Feature 014 — the card's owner-RLS BROWSER reads (T013).
 *
 * Sibling of `lib/api/monitoring-reads.ts` in posture and of
 * `lib/api/recommendations-client.ts` in scope: every SELECT here runs through the
 * `@supabase/ssr` browser client as the signed-in user, so RLS scopes it to `auth.uid()`.
 * There is no service key, no admin key, no server route, and no privileged path to
 * `recommendation_picks` — the standing invariant
 * (`contracts/recommendation-storage-rls.md` §7). The `.eq("user_id", …)` filters are
 * belt-and-braces beside the policies, exactly as `monitoring-reads.ts` writes them.
 *
 * ── The day boundary is a FILTER, never a reset routine (FR-019) ─────────────────────
 * Both reads are scoped to the person's own local day, and both use the today card's
 * boundaries: `local_day` equality for picks (the column stores exactly
 * `toLocalDayString`), and `localDayWindow` for readings. Nothing is stored that a day
 * rollover would have to clear — hand these functions tomorrow's clock and the budget, the
 * non-repeat exclusions, the episode and the outcome prompt are all gone at once.
 *
 * ── Why readings are NOT read through `getTodayTrend` ────────────────────────────────
 * That reader applies the feature-008 RETROSPECTIVE filter, which deliberately excludes the
 * fresh-live session (a reading in the last five minutes) so a past recap never narrates a
 * session still in progress. This card has the opposite duty: it must update quietly on an
 * Uneasy or Tense reading as it happens (FR-013), and the reading that warrants a pick is
 * usually the live one. So this module reads today's rows unfiltered — same table, same
 * owner columns, different question.
 *
 * Neither reader ever selects `stress_probability` or `label` (FR-015); the column
 * whitelist is imported from `monitoring-reads.ts` rather than restated.
 */

import type { Band } from "@/lib/api/monitoring-client";
import { RECAP_SESSION_COLUMNS, TODAY_TREND_COLUMNS, localDayWindow } from "@/lib/api/monitoring-reads";
import { RECOMMENDATION_PICKS_TABLE } from "@/lib/api/recommendations-client";
import type { PickOutcome } from "@/lib/recommendations/engine";
import type { PickRow, PickSource } from "@/lib/recommendations/episode";
import { toLocalDayString } from "@/lib/recommendations/episode";
import type { RecommendationCategory } from "@/lib/recommendations/library";
import { createClient } from "@/lib/supabase/client";

/** Owner columns of a pick row. Identity + provenance + the five lifecycle stamps. */
export const PICK_COLUMNS =
  "id, local_day, episode_id, item_id, category, source, suggested_at, confirmed_at, opened_at, outcome, outcome_at, swapped_away_at" as const;

export interface RecommendationReaderOpts {
  /** Injectable Supabase client (defaults to the browser RLS client). */
  client?: ReturnType<typeof createClient>;
  /** Injectable clock (defaults to `new Date()`), so day semantics stay testable. */
  now?: Date;
}

/**
 * One of today's readings as the card needs it. `sessionId` rides along so the card can
 * count CHECK-INS (sessions) rather than windows for the state-2 reflective facts — a
 * person had three check-ins, not eighty-one windows.
 */
export interface TodayBandReading {
  band: Band;
  atMs: number;
  sessionId: string;
}

const msOf = (iso: string): number => new Date(iso).getTime();

/** Parse a nullable timestamptz to epoch ms, keeping `null` as `null`. */
function msOrNull(value: unknown): number | null {
  return typeof value === "string" ? msOf(value) : null;
}

function mapPickRow(row: Record<string, unknown>): PickRow {
  return {
    id: row.id as string,
    localDay: row.local_day as string,
    episodeId: row.episode_id as string,
    itemId: row.item_id as string,
    category: row.category as RecommendationCategory,
    source: row.source as PickSource,
    suggestedAtMs: msOf(row.suggested_at as string),
    confirmedAtMs: msOrNull(row.confirmed_at),
    openedAtMs: msOrNull(row.opened_at),
    outcome: (row.outcome as PickOutcome | null) ?? null,
    outcomeAtMs: msOrNull(row.outcome_at),
    swappedAwayAtMs: msOrNull(row.swapped_away_at),
  };
}

/**
 * Today's pick rows for the signed-in person, oldest first.
 *
 * A failed read returns `[]` rather than throwing: this surface has no error state
 * (FR-030), and an empty day is a state the card already renders honestly.
 */
export async function getTodayPicks(
  userId: string,
  opts: RecommendationReaderOpts = {},
): Promise<PickRow[]> {
  const supabase = opts.client ?? createClient();
  const localDay = toLocalDayString(opts.now ?? new Date());
  try {
    const { data, error } = await supabase
      .from(RECOMMENDATION_PICKS_TABLE)
      .select(PICK_COLUMNS)
      .eq("user_id", userId)
      .eq("local_day", localDay)
      .order("suggested_at", { ascending: true });
    if (error || !data) return [];
    return (data as unknown as Record<string, unknown>[]).map(mapPickRow);
  } catch {
    return [];
  }
}

/**
 * Today's CONFIDENT band readings for the signed-in person, oldest first — every session of
 * the local day, the live one included (see the module header for why).
 *
 * Skipped and warming windows carry `band = null` and are dropped here: they are not
 * readings, and the engine's warrant rule must never see them as one.
 */
export async function getTodayBandReadings(
  userId: string,
  opts: RecommendationReaderOpts = {},
): Promise<TodayBandReading[]> {
  const supabase = opts.client ?? createClient();
  const { start, end } = localDayWindow(opts.now ?? new Date());
  try {
    const { data: sessData, error: sessErr } = await supabase
      .from("monitoring_sessions")
      .select(RECAP_SESSION_COLUMNS)
      .eq("user_id", userId)
      .gte("started_at", start.toISOString())
      .lt("started_at", end.toISOString())
      .order("started_at", { ascending: true });
    if (sessErr || !sessData) return [];
    const ids = (sessData as unknown as { id: string }[]).map((s) => s.id);
    if (ids.length === 0) return [];

    const { data: rowData, error: rowErr } = await supabase
      .from("window_readings")
      .select(TODAY_TREND_COLUMNS)
      .in("session_id", ids)
      .order("captured_at", { ascending: true });
    if (rowErr || !rowData) return [];

    return (rowData as unknown as Record<string, unknown>[])
      .filter((row) => row.band != null)
      .map((row) => ({
        band: row.band as Band,
        atMs: msOf(row.captured_at as string),
        sessionId: row.session_id as string,
      }));
  } catch {
    return [];
  }
}
