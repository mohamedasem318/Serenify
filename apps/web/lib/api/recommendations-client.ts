/**
 * Feature 014 — the typed owner-RLS write client for `recommendation_picks` (T010;
 * `contracts/recommendation-storage-rls.md` §Write paths, spec FR-015…FR-017, FR-030).
 *
 * Sibling of `monitoring-reads.ts` in posture: every write runs through the `@supabase/ssr`
 * BROWSER client as the signed-in user, so RLS scopes it to `auth.uid()`. There is no
 * service key, no admin key, no server route, and no privileged path of any kind to this
 * table — the standing invariant (contract §7). Widening that is a spec change, never a
 * judgement call here.
 *
 * ── The silence rule (FR-030) is the load-bearing property of this module ────────────
 * "Things that might help" HAS NO ERROR STATE. Nothing in this file throws to its caller
 * and nothing returns something a component could render as a failure — every function
 * returns a plain `{ ok }` result, and every path that could throw is wrapped. That
 * includes the `23505` unique violation from `rp_one_active_per_user_day`, the DB backstop
 * for one-active-pick-per-day: a collision means someone else's tab already surfaced a
 * pick, which is a race, not a fault, and it is swallowed exactly like any other failed
 * insert.
 *
 * ── Retry policy, stated once ────────────────────────────────────────────────────────
 *   • outcome  — retry EXACTLY once, then degrade silently. The outcome answer is the only
 *                signal feature 015 consumes, so losing it to one transient failure is data
 *                loss with a downstream cost (FR-030).
 *   • swap     — NO retry, ever. A failed swap degrades to the previous pick.
 *   • surface / confirm / open — no retry. A missed pick re-derives on the next render.
 *
 * ── Swap ordering is RULED and forced by the schema (Ruling B, 2026-08-15) ────────────
 * `rp_one_active_per_user_day` is a partial unique index over `(user_id, local_day) WHERE
 * outcome IS NULL AND swapped_away_at IS NULL`, and the stamp and the insert are two
 * separate PostgREST requests with no transaction between them. Insert-first is therefore
 * IMPOSSIBLE — the replacement would collide with the still-active outgoing row. `swapPick`
 * below stamps first and inserts second, and the stamp is NEVER reversed: a swap-away that
 * was recorded stays recorded, because the preference signal is real regardless of what
 * happened to the replacement (contract points 1 and 4).
 */

import { createClient } from "@/lib/supabase/client";
import type { PickOutcome } from "@/lib/recommendations/engine";
import type { LibraryItem, RecommendationCategory } from "@/lib/recommendations/library";
import { RECOMMENDATION_LIBRARY } from "@/lib/recommendations/library";
import type { PickSource } from "@/lib/recommendations/episode";

/** The one table this module touches. */
export const RECOMMENDATION_PICKS_TABLE = "recommendation_picks";

/** Postgres unique-violation SQLSTATE — the `rp_one_active_per_user_day` backstop. */
export const UNIQUE_VIOLATION = "23505";

// ─────────────────────────────────────────────────────────────────────────────
// The injectable seam
// ─────────────────────────────────────────────────────────────────────────────

/** A write outcome as the seam reports it. `code` carries the SQLSTATE when there is one. */
export interface WriteResult {
  ok: boolean;
  code?: string;
}

/**
 * The minimum surface the client needs from storage. Tests inject a failing/counting
 * implementation of exactly this — the same "inject the dependency, count the calls"
 * posture as `monitoring-client.test.ts`, without needing a Supabase double.
 */
export interface RecommendationWriter {
  insertPick(row: PickInsertRow): Promise<WriteResult>;
  updatePick(pickId: string, patch: Readonly<Record<string, string | null>>): Promise<WriteResult>;
}

export interface RecommendationClientDeps {
  writer?: RecommendationWriter;
  /** The library the `category` column is derived FROM. Injectable for tests only. */
  library?: readonly LibraryItem[];
}

/** The exact column set an INSERT writes (data-model §2 — identity + provenance). */
export interface PickInsertRow {
  user_id: string;
  local_day: string;
  episode_id: string;
  item_id: string;
  category: RecommendationCategory;
  source: PickSource;
}

// ─────────────────────────────────────────────────────────────────────────────
// The default writer — browser Supabase, owner RLS
// ─────────────────────────────────────────────────────────────────────────────

function supabaseWriter(): RecommendationWriter {
  return {
    async insertPick(row) {
      try {
        const { error } = await createClient().from(RECOMMENDATION_PICKS_TABLE).insert(row);
        return error ? { ok: false, code: error.code } : { ok: true };
      } catch {
        return { ok: false };
      }
    },
    async updatePick(pickId, patch) {
      try {
        const { error } = await createClient()
          .from(RECOMMENDATION_PICKS_TABLE)
          .update(patch)
          .eq("id", pickId);
        return error ? { ok: false, code: error.code } : { ok: true };
      } catch {
        return { ok: false };
      }
    },
  };
}

/** Resolve the writer without constructing a Supabase client when one was injected. */
function writerOf(deps: RecommendationClientDeps): RecommendationWriter {
  return deps.writer ?? supabaseWriter();
}

/** Never let a writer implementation's throw escape — FR-030 has no exceptions. */
async function attempt(run: () => Promise<WriteResult>): Promise<WriteResult> {
  try {
    return await run();
  } catch {
    return { ok: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Surfacing a pick
// ─────────────────────────────────────────────────────────────────────────────

export interface SurfacePickInput {
  userId: string;
  /** `YYYY-MM-DD` from today-card day semantics (`episode.ts` — `toLocalDayString`). */
  localDay: string;
  /** Client-generated at episode start, shared by the episode's picks (FR-018). */
  episodeId: string;
  /** A library slug. The row's `category` is DERIVED from it — see below. */
  itemId: string;
  source: PickSource;
}

export type SurfacePickResult =
  | { ok: true; row: PickInsertRow }
  | { ok: false; reason: "unknown_item" | "conflict" | "write_failed" };

/**
 * INSERT one surfaced pick (initial pick, swap replacement, or state-8 replacement).
 *
 * **`category` is derived from the library, never accepted as a parameter.** A row whose
 * `category` disagrees with the library entry for its `item_id` would be undetectable at
 * write time — the column CHECK only validates the value is one of the five — and would
 * silently poison feature 015's category-level reads, which are the entire reason the
 * column is denormalised (data-model §2). There is no caller-supplied override and no
 * "trust me" path: an `item_id` that is not in the library is not written at all.
 *
 * A `23505` from `rp_one_active_per_user_day` is swallowed as `conflict`. Something else
 * already holds today's active-pick slot; the card re-derives on the next render and the
 * person sees a pick either way. Nothing renders as an error (FR-030).
 */
export async function surfacePick(
  input: SurfacePickInput,
  deps: RecommendationClientDeps = {},
): Promise<SurfacePickResult> {
  const library = deps.library ?? RECOMMENDATION_LIBRARY;
  const entry = library.find((item) => item.id === input.itemId);
  if (!entry) return { ok: false, reason: "unknown_item" };

  const row: PickInsertRow = {
    user_id: input.userId,
    local_day: input.localDay,
    episode_id: input.episodeId,
    item_id: entry.id,
    category: entry.category, // derived — the library is the authority (see above)
    source: input.source,
  };

  const result = await attempt(() => writerOf(deps).insertPick(row));
  if (result.ok) return { ok: true, row };
  return { ok: false, reason: result.code === UNIQUE_VIOLATION ? "conflict" : "write_failed" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle stamps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A confirmed detection attaches to the ACTIVE pick — UPDATE `confirmed_at`, prominence
 * 3 → 4, same pick, same budget, never a second row (Ruling C; FR-018).
 */
export async function attachConfirmation(
  pickId: string,
  atIso: string,
  deps: RecommendationClientDeps = {},
): Promise<{ ok: boolean }> {
  const result = await attempt(() => writerOf(deps).updatePick(pickId, { confirmed_at: atIso }));
  return { ok: result.ok };
}

/**
 * Opening the item IS the engagement record (FR-015), and it is set ONCE. The client guards
 * the re-set: re-expanding the same pick writes nothing, so `opened_at` keeps meaning "when
 * they first tried this", not "when they last looked at it". `wrote` distinguishes "guard
 * suppressed it" from "written", which is what the test asserts on.
 */
export async function recordOpened(
  pick: { id: string; openedAtMs: number | null },
  atIso: string,
  deps: RecommendationClientDeps = {},
): Promise<{ ok: boolean; wrote: boolean }> {
  if (pick.openedAtMs !== null) return { ok: true, wrote: false };
  const result = await attempt(() => writerOf(deps).updatePick(pick.id, { opened_at: atIso }));
  return { ok: result.ok, wrote: true };
}

/**
 * Record the outcome answer — UPDATE `outcome` + `outcome_at`, **retried exactly once**,
 * then silent degrade (FR-030). Two attempts total, never three: the retry exists because
 * the answer is the only signal 015 consumes, not because a loop is acceptable.
 */
export async function recordOutcome(
  pickId: string,
  outcome: PickOutcome,
  atIso: string,
  deps: RecommendationClientDeps = {},
): Promise<{ ok: boolean; attempts: number }> {
  const patch = { outcome, outcome_at: atIso };
  const writer = writerOf(deps);

  const first = await attempt(() => writer.updatePick(pickId, patch));
  if (first.ok) return { ok: true, attempts: 1 };

  const second = await attempt(() => writer.updatePick(pickId, patch));
  return { ok: second.ok, attempts: 2 };
}

/**
 * Stamp `swapped_away_at` — the preference signal, distinct from an outcome (FR-017).
 * **No retry**, and the stamp is never reversed (contract points 1 and 4).
 */
export async function stampSwappedAway(
  pickId: string,
  atIso: string,
  deps: RecommendationClientDeps = {},
): Promise<{ ok: boolean; attempts: number }> {
  const result = await attempt(() =>
    writerOf(deps).updatePick(pickId, { swapped_away_at: atIso }),
  );
  return { ok: result.ok, attempts: 1 };
}

/**
 * FR-016 — ignoring the outcome prompt records NOTHING and costs nothing. This function
 * writes nothing by construction (it has no writer at all); it exists so the invariant is
 * an asserted behaviour rather than an absence nobody tested.
 */
export function recordIgnoredOutcomePrompt(): { wrote: false } {
  return { wrote: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// The swap — two steps, one order
// ─────────────────────────────────────────────────────────────────────────────

export interface SwapPickInput {
  /** The pick being replaced. Its stamp is written FIRST and never reversed. */
  outgoingPickId: string;
  atIso: string;
  /** The replacement, already chosen by the engine. `category` is derived, as always. */
  replacement: SurfacePickInput;
}

export interface SwapPickResult {
  /** Whether the outgoing pick's `swapped_away_at` landed. */
  stamped: boolean;
  /** Whether the replacement row landed. */
  replacementSurfaced: boolean;
  /**
   * True when the replacement INSERT failed and the caller's once-only engine re-run was
   * invoked (contract point 2). The client itself performs NO further write after this:
   * point 3's "no retry loop" lives here, and any subsequent insert is the caller's own
   * `surfacePick` call, driven by what the re-run returned.
   */
  reselected: boolean;
}

/**
 * Apply a swap in the only order the schema permits: stamp `swapped_away_at` on the
 * outgoing pick, then INSERT the replacement.
 *
 * On a failed stamp the replacement is NOT attempted — inserting it would collide with the
 * still-active outgoing row (`rp_one_active_per_user_day`), and the collision would be the
 * predictable consequence of a step we already know did not happen. The card keeps the
 * previous pick and nothing renders (FR-030).
 *
 * On a failed replacement INSERT, `onReplacementInsertFailed` is invoked **exactly once** —
 * that is the caller-driven engine re-run, which now sees the declined pick and produces a
 * different one. It is visually indistinguishable from a successful swap, because a swap
 * has no ceremony: nothing on screen announces which path ran (FR-001 state 10).
 *
 * A budget slot is NOT consumed by a failed swap (Amendment 2026-08-16). That is structural
 * rather than enforced here: consumption is derived by the reducer as the count of surfaced
 * rows in the episode, and a stamp with no successor row adds no row to count.
 */
export async function swapPick(
  input: SwapPickInput,
  deps: RecommendationClientDeps & {
    /** The caller's once-only engine re-run. Invoked at most once, never in a loop. */
    onReplacementInsertFailed?: () => void;
  } = {},
): Promise<SwapPickResult> {
  const stamp = await stampSwappedAway(input.outgoingPickId, input.atIso, deps);
  if (!stamp.ok) return { stamped: false, replacementSurfaced: false, reselected: false };

  const insert = await surfacePick(input.replacement, deps);
  if (insert.ok) return { stamped: true, replacementSurfaced: true, reselected: false };

  try {
    deps.onReplacementInsertFailed?.();
  } catch {
    // The caller's re-run threw. Still not an error on this surface (FR-030) — the previous
    // pick simply stays. Swallowed here so the swallow is deliberate rather than incidental.
  }
  return { stamped: true, replacementSurfaced: false, reselected: true };
}
