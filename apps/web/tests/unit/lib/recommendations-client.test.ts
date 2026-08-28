import { describe, expect, it, vi } from "vitest";

import {
  RECOMMENDATION_PICKS_TABLE,
  REFLECTIVE_COPY_ENDPOINT,
  REFLECTIVE_COPY_REQUEST_TIMEOUT_MS,
  UNIQUE_VIOLATION,
  attachConfirmation,
  clearSwappedAway,
  fetchReflectiveCopy,
  recordIgnoredOutcomePrompt,
  recordOpened,
  recordOutcome,
  stampSwappedAway,
  surfacePick,
  swapPick,
  type PickInsertRow,
  type RecommendationWriter,
  type SurfacePickInput,
  type WriteResult,
} from "@/lib/api/recommendations-client";
import { RECOMMENDATION_LIBRARY } from "@/lib/recommendations/library";
import type { ReflectiveFacts } from "@/lib/recommendations/reflective-copy-validation";

/**
 * T010 — the owner-RLS pick-write client (`contracts/recommendation-storage-rls.md`
 * §Write paths + §Swap write ordering; spec FR-015/FR-016/FR-017/FR-030).
 *
 * The `monitoring-client.test.ts` posture, one layer lower: rather than stubbing `fetch`,
 * these inject a `RecommendationWriter` that RECORDS every call in order and can be told to
 * fail. That is what makes the two load-bearing properties observable rather than argued:
 *
 *   • **Retry policy** — outcome retries EXACTLY once (two attempts, never three); swap
 *     never retries.
 *   • **Swap ordering** (Ruling B, forced by `rp_one_active_per_user_day`) — the
 *     `swapped_away_at` stamp is observed to PRECEDE the replacement INSERT, and no path
 *     reverses a stamp.
 *
 * And the silence rule (FR-030): no exported function throws, including on a `23505`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// The recording writer
// ─────────────────────────────────────────────────────────────────────────────

type Call =
  | { op: "insert"; row: PickInsertRow }
  | { op: "update"; pickId: string; patch: Readonly<Record<string, string | null>> };

interface RecordingWriter extends RecommendationWriter {
  calls: Call[];
}

function recordingWriter(options: {
  insert?: WriteResult | ((attempt: number) => WriteResult);
  update?: WriteResult | ((attempt: number) => WriteResult);
} = {}): RecordingWriter {
  const calls: Call[] = [];
  let insertAttempts = 0;
  let updateAttempts = 0;
  const resolve = (
    spec: WriteResult | ((attempt: number) => WriteResult) | undefined,
    attempt: number,
  ): WriteResult => (typeof spec === "function" ? spec(attempt) : (spec ?? { ok: true }));

  return {
    calls,
    async insertPick(row) {
      insertAttempts += 1;
      calls.push({ op: "insert", row });
      return resolve(options.insert, insertAttempts);
    },
    async updatePick(pickId, patch) {
      updateAttempts += 1;
      calls.push({ op: "update", pickId, patch });
      return resolve(options.update, updateAttempts);
    },
  };
}

const BOX_BREATHING = RECOMMENDATION_LIBRARY.find((item) => item.id === "box-breathing")!;

const SURFACE: SurfacePickInput = {
  userId: "user-1",
  localDay: "2026-08-16",
  episodeId: "episode-1",
  itemId: BOX_BREATHING.id,
  source: "reading",
};

// ─────────────────────────────────────────────────────────────────────────────
// INSERT — and the category-derivation invariant
// ─────────────────────────────────────────────────────────────────────────────

describe("surfacePick — INSERT of a surfaced pick", () => {
  it("writes the full identity/provenance row exactly once", async () => {
    const writer = recordingWriter();
    const result = await surfacePick(SURFACE, { writer });

    expect(result.ok).toBe(true);
    expect(writer.calls).toHaveLength(1);
    expect(writer.calls[0]).toEqual({
      op: "insert",
      row: {
        user_id: "user-1",
        local_day: "2026-08-16",
        episode_id: "episode-1",
        item_id: "box-breathing",
        category: BOX_BREATHING.category,
        source: "reading",
      },
    });
  });

  it("DERIVES `category` from the library for every item — it is never a parameter", async () => {
    // A row whose category disagrees with the library would be undetectable at write time
    // (the CHECK only validates the value is one of five) and would poison 015's
    // category-level reads. There is no override to pass, so this sweeps the whole library.
    for (const item of RECOMMENDATION_LIBRARY) {
      const writer = recordingWriter();
      await surfacePick({ ...SURFACE, itemId: item.id }, { writer });
      const call = writer.calls[0];
      expect(call?.op).toBe("insert");
      expect(call?.op === "insert" ? call.row.category : null).toBe(item.category);
      expect(call?.op === "insert" ? call.row.item_id : null).toBe(item.id);
    }
  });

  it("refuses to write an item_id the library does not know, rather than guessing", async () => {
    const writer = recordingWriter();
    const result = await surfacePick({ ...SURFACE, itemId: "not-a-real-item" }, { writer });
    expect(result).toEqual({ ok: false, reason: "unknown_item" });
    expect(writer.calls).toHaveLength(0);
  });

  it("does NOT retry a failed insert", async () => {
    const writer = recordingWriter({ insert: { ok: false } });
    const result = await surfacePick(SURFACE, { writer });
    expect(result).toEqual({ ok: false, reason: "write_failed" });
    expect(writer.calls).toHaveLength(1);
  });

  it("swallows a 23505 from rp_one_active_per_user_day — a race, not an error (FR-030)", async () => {
    const writer = recordingWriter({ insert: { ok: false, code: UNIQUE_VIOLATION } });
    const result = await surfacePick(SURFACE, { writer });
    expect(result).toEqual({ ok: false, reason: "conflict" });
    expect(writer.calls).toHaveLength(1);
  });

  it("never throws, even when the writer itself throws", async () => {
    const throwing: RecommendationWriter = {
      insertPick: async () => {
        throw new Error("network down");
      },
      updatePick: async () => ({ ok: true }),
    };
    await expect(surfacePick(SURFACE, { writer: throwing })).resolves.toEqual({
      ok: false,
      reason: "write_failed",
    });
  });

  it("names one table and only one", () => {
    expect(RECOMMENDATION_PICKS_TABLE).toBe("recommendation_picks");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle stamps
// ─────────────────────────────────────────────────────────────────────────────

describe("attachConfirmation — prominence only (Ruling C)", () => {
  it("updates confirmed_at on the existing row and inserts nothing", async () => {
    const writer = recordingWriter();
    const result = await attachConfirmation("pick-1", "2026-08-16T10:12:00.000Z", { writer });

    expect(result.ok).toBe(true);
    expect(writer.calls).toEqual([
      { op: "update", pickId: "pick-1", patch: { confirmed_at: "2026-08-16T10:12:00.000Z" } },
    ]);
    expect(writer.calls.some((call) => call.op === "insert")).toBe(false);
  });

  it("degrades silently on failure", async () => {
    const writer = recordingWriter({ update: { ok: false } });
    await expect(attachConfirmation("pick-1", "t", { writer })).resolves.toEqual({ ok: false });
    expect(writer.calls).toHaveLength(1);
  });
});

describe("recordOpened — the engagement record, set ONCE (FR-015)", () => {
  it("writes opened_at the first time", async () => {
    const writer = recordingWriter();
    const result = await recordOpened({ id: "pick-1", openedAtMs: null }, "t0", { writer });

    expect(result).toEqual({ ok: true, wrote: true });
    expect(writer.calls).toEqual([{ op: "update", pickId: "pick-1", patch: { opened_at: "t0" } }]);
  });

  it("the client guards the re-set — re-expanding the same pick writes nothing", async () => {
    const writer = recordingWriter();
    const result = await recordOpened({ id: "pick-1", openedAtMs: 1_000 }, "t1", { writer });

    expect(result).toEqual({ ok: true, wrote: false });
    expect(writer.calls).toHaveLength(0);
  });
});

describe("recordIgnoredOutcomePrompt — FR-016, records NOTHING", () => {
  it("performs no write at all", () => {
    expect(recordIgnoredOutcomePrompt()).toEqual({ wrote: false });
  });

  it("takes no writer, so there is no path by which it could write", () => {
    expect(recordIgnoredOutcomePrompt.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Retry policy — the whole of it
// ─────────────────────────────────────────────────────────────────────────────

describe("recordOutcome — retry EXACTLY once, then degrade silently (FR-030)", () => {
  it("writes once when the first attempt succeeds", async () => {
    const writer = recordingWriter();
    const result = await recordOutcome("pick-1", "helped", "t0", { writer });

    expect(result).toEqual({ ok: true, attempts: 1 });
    expect(writer.calls).toEqual([
      { op: "update", pickId: "pick-1", patch: { outcome: "helped", outcome_at: "t0" } },
    ]);
  });

  it("retries once and succeeds — two attempts, identical patches", async () => {
    const writer = recordingWriter({ update: (attempt) => ({ ok: attempt > 1 }) });
    const result = await recordOutcome("pick-1", "didnt_help", "t0", { writer });

    expect(result).toEqual({ ok: true, attempts: 2 });
    expect(writer.calls).toHaveLength(2);
    expect(writer.calls[0]).toEqual(writer.calls[1]);
  });

  it("stops at two attempts — never a third, never a loop", async () => {
    const writer = recordingWriter({ update: { ok: false } });
    const result = await recordOutcome("pick-1", "helped", "t0", { writer });

    expect(result).toEqual({ ok: false, attempts: 2 });
    expect(writer.calls).toHaveLength(2);
  });

  it("never throws, even when both attempts throw", async () => {
    let attempts = 0;
    const throwing: RecommendationWriter = {
      insertPick: async () => ({ ok: true }),
      updatePick: async () => {
        attempts += 1;
        throw new Error("gone");
      },
    };
    await expect(recordOutcome("pick-1", "helped", "t0", { writer: throwing })).resolves.toEqual({
      ok: false,
      attempts: 2,
    });
    expect(attempts).toBe(2);
  });
});

describe("stampSwappedAway — ZERO retries (FR-030)", () => {
  it("writes swapped_away_at once on success", async () => {
    const writer = recordingWriter();
    const result = await stampSwappedAway("pick-1", "t0", { writer });

    expect(result).toEqual({ ok: true, attempts: 1 });
    expect(writer.calls).toEqual([
      { op: "update", pickId: "pick-1", patch: { swapped_away_at: "t0" } },
    ]);
  });

  it("does not retry on failure — one attempt, then silence", async () => {
    const writer = recordingWriter({ update: { ok: false } });
    const result = await stampSwappedAway("pick-1", "t0", { writer });

    expect(result).toEqual({ ok: false, attempts: 1 });
    expect(writer.calls).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Swap ordering — Ruling B
// ─────────────────────────────────────────────────────────────────────────────

describe("swapPick — the stamp precedes the INSERT, and is never reversed (Ruling B)", () => {
  const swapInput = {
    outgoingPickId: "pick-1",
    atIso: "2026-08-16T10:20:00.000Z",
    replacement: { ...SURFACE, itemId: "feet-on-the-floor" },
  };

  it("stamps FIRST, then inserts — insert-first is impossible under the partial unique index", async () => {
    const writer = recordingWriter();
    const result = await swapPick(swapInput, { writer });

    expect(result).toEqual({ stamped: true, replacementSurfaced: true, reselected: false });
    expect(writer.calls.map((call) => call.op)).toEqual(["update", "insert"]);
    expect(writer.calls[0]).toEqual({
      op: "update",
      pickId: "pick-1",
      patch: { swapped_away_at: "2026-08-16T10:20:00.000Z" },
    });
    expect(writer.calls[1]?.op === "insert" ? writer.calls[1].row.item_id : null).toBe(
      "feet-on-the-floor",
    );
  });

  it("does not attempt the replacement when the stamp itself failed", async () => {
    const writer = recordingWriter({ update: { ok: false } });
    const result = await swapPick(swapInput, { writer });

    expect(result).toEqual({ stamped: false, replacementSurfaced: false, reselected: false });
    expect(writer.calls.map((call) => call.op)).toEqual(["update"]);
  });

  it("a failed replacement INSERT triggers EXACTLY ONE engine re-run and no further write", async () => {
    const writer = recordingWriter({ insert: { ok: false } });
    const reselect = vi.fn();
    const result = await swapPick(swapInput, { writer, onReplacementInsertFailed: reselect });

    expect(result).toEqual({ stamped: true, replacementSurfaced: false, reselected: true });
    expect(reselect).toHaveBeenCalledTimes(1);
    // Two writes total: the stamp and the one failed insert. No retry loop (contract §3).
    expect(writer.calls.map((call) => call.op)).toEqual(["update", "insert"]);
  });

  it("NEVER reverses the stamp — no write clears swapped_away_at on any path", async () => {
    for (const options of [
      {},
      { insert: { ok: false } },
      { insert: { ok: false, code: UNIQUE_VIOLATION } },
    ]) {
      const writer = recordingWriter(options);
      await swapPick(swapInput, { writer, onReplacementInsertFailed: () => {} });
      const stampPatches = writer.calls.filter(
        (call) => call.op === "update" && "swapped_away_at" in call.patch,
      );
      expect(stampPatches).toHaveLength(1);
      for (const call of writer.calls) {
        if (call.op === "update") expect(call.patch.swapped_away_at).not.toBeNull();
      }
    }
  });

  it("swallows a 23505 on the replacement exactly like any other failed insert", async () => {
    const writer = recordingWriter({ insert: { ok: false, code: UNIQUE_VIOLATION } });
    const reselect = vi.fn();
    const result = await swapPick(swapInput, { writer, onReplacementInsertFailed: reselect });

    expect(result.stamped).toBe(true);
    expect(result.replacementSurfaced).toBe(false);
    expect(reselect).toHaveBeenCalledTimes(1);
  });

  it("survives a re-run callback that throws — still no error on this surface", async () => {
    const writer = recordingWriter({ insert: { ok: false } });
    const result = await swapPick(swapInput, {
      writer,
      onReplacementInsertFailed: () => {
        throw new Error("engine blew up");
      },
    });
    expect(result).toEqual({ stamped: true, replacementSurfaced: false, reselected: true });
  });

  it("derives the replacement's category from the library too", async () => {
    const writer = recordingWriter();
    await swapPick(swapInput, { writer });
    const insert = writer.calls.find((call) => call.op === "insert");
    const item = RECOMMENDATION_LIBRARY.find((candidate) => candidate.id === "feet-on-the-floor")!;
    expect(insert?.op === "insert" ? insert.row.category : null).toBe(item.category);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// clearSwappedAway — the scoped point-4 exception (Ruling 2026-08-28)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The reversal lives OUTSIDE `swapPick`: the host calls it only on the both-inserts-failed
 * path, where no replacement row ever landed. `swapPick` still never reverses (proven above);
 * this function is the one place a stamp is cleared, and it does so with a single owner-RLS
 * UPDATE that sets `swapped_away_at` back to NULL.
 */
describe("clearSwappedAway — reverses the stamp on the both-inserts-failed path only", () => {
  it("writes swapped_away_at = null, once, and reports ok", async () => {
    const writer = recordingWriter();
    const result = await clearSwappedAway("pick-1", { writer });

    expect(result).toEqual({ ok: true });
    expect(writer.calls).toEqual([
      { op: "update", pickId: "pick-1", patch: { swapped_away_at: null } },
    ]);
  });

  it("does not retry on failure — one attempt, then silence (FR-030)", async () => {
    const writer = recordingWriter({ update: { ok: false } });
    const result = await clearSwappedAway("pick-1", { writer });

    expect(result).toEqual({ ok: false });
    expect(writer.calls).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T029 — signal distinctness (SC-007, FR-017), at the client layer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * "Didn't help" is an OUTCOME; swapping away is a PREFERENCE. Feature 015 will read both,
 * and it can only read them apart if this layer keeps them apart — different columns, on
 * different rows, never in one patch. The schema says the same thing with
 * `rp_outcome_xor_swap`; this block proves the client never asks the schema to refuse.
 *
 * The distinctness is asserted three ways, because any one of them alone is weak:
 *
 *   1. **By column** — each function's patch key set is pinned exactly.
 *   2. **Structurally** — a sweep over every exported write path asserts no patch anywhere
 *      carries an outcome key and the swap key together.
 *   3. **Against the CHECK** — a writer that enforces `rp_outcome_xor_swap` on the row a
 *      patch would produce runs the full lifecycle and is never tripped, and the same writer
 *      is then shown rejecting a hypothetical conflated write, so its silence means
 *      something.
 */

/** Postgres check-violation SQLSTATE — what a real `rp_outcome_xor_swap` breach returns. */
const CHECK_VIOLATION = "23514";

/** The two columns that carry the outcome signal, and the one that carries the swap. */
const OUTCOME_COLUMNS = ["outcome", "outcome_at"];
const SWAP_COLUMN = "swapped_away_at";

interface StoredRow {
  outcome: string | null;
  outcome_at: string | null;
  opened_at: string | null;
  swapped_away_at: string | null;
}

/**
 * A writer that keeps one row's state and applies the migration's row CHECKs to the row a
 * patch WOULD produce, exactly as Postgres does. `rp_outcome_xor_swap` is the one under
 * test; the other two ride along, because a harness enforcing only the constraint being
 * tested proves less than one enforcing the table.
 */
function checkEnforcingWriter(initial: Partial<StoredRow> = {}) {
  const row: StoredRow = {
    outcome: null,
    outcome_at: null,
    opened_at: null,
    swapped_away_at: null,
    ...initial,
  };
  const calls: Call[] = [];
  const rejected: Call[] = [];

  const writer: RecommendationWriter = {
    async insertPick(inserted) {
      calls.push({ op: "insert", row: inserted });
      return { ok: true };
    },
    async updatePick(pickId, patch) {
      const call: Call = { op: "update", pickId, patch };
      calls.push(call);
      const next: StoredRow = { ...row, ...patch } as StoredRow;
      const violates =
        (next.outcome === null) !== (next.outcome_at === null) || // rp_outcome_iff_at
        (next.outcome !== null && next.opened_at === null) || // rp_outcome_requires_opened
        (next.outcome !== null && next.swapped_away_at !== null); // rp_outcome_xor_swap
      if (violates) {
        rejected.push(call);
        return { ok: false, code: CHECK_VIOLATION };
      }
      Object.assign(row, next);
      return { ok: true };
    },
  };

  return { writer, row, calls, rejected };
}

describe("SC-007 — swaps and outcomes are stored as DISTINCT signals", () => {
  it("recordOutcome touches the outcome columns and only those", async () => {
    for (const outcome of ["helped", "didnt_help"] as const) {
      const writer = recordingWriter();
      await recordOutcome("pick-1", outcome, "t0", { writer });
      const call = writer.calls[0];
      expect(call?.op).toBe("update");
      expect(Object.keys(call?.op === "update" ? call.patch : {})).toEqual(OUTCOME_COLUMNS);
    }
  });

  it("stampSwappedAway touches the swap column and only that", async () => {
    const writer = recordingWriter();
    await stampSwappedAway("pick-1", "t0", { writer });
    const call = writer.calls[0];
    expect(Object.keys(call?.op === "update" ? call.patch : {})).toEqual([SWAP_COLUMN]);
  });

  it("no exported write path composes a patch carrying both signals — 100% of writes", async () => {
    // Every write this module can make, driven once each, then swept. There is no parameter
    // by which a caller could ask for a conflated patch, which is the property: the
    // impossibility is structural, not a rule someone remembers to follow.
    const writer = recordingWriter();
    const deps = { writer };
    await surfacePick(SURFACE, deps);
    await attachConfirmation("pick-1", "t", deps);
    await recordOpened({ id: "pick-1", openedAtMs: null }, "t", deps);
    await recordOutcome("pick-1", "helped", "t", deps);
    await recordOutcome("pick-1", "didnt_help", "t", deps);
    await stampSwappedAway("pick-1", "t", deps);
    await swapPick(
      { outgoingPickId: "pick-1", atIso: "t", replacement: { ...SURFACE, itemId: "feet-on-the-floor" } },
      deps,
    );
    recordIgnoredOutcomePrompt();

    // Not vacuous: both signals really were written during the sweep.
    const patches = writer.calls.flatMap((call) => (call.op === "update" ? [call.patch] : []));
    expect(patches.some((patch) => "outcome" in patch)).toBe(true);
    expect(patches.some((patch) => SWAP_COLUMN in patch)).toBe(true);

    for (const patch of patches) {
      const keys = Object.keys(patch);
      const outcomeSide = keys.some((key) => OUTCOME_COLUMNS.includes(key));
      const swapSide = keys.includes(SWAP_COLUMN);
      expect(outcomeSide && swapSide).toBe(false);
    }
  });

  it("runs the full lifecycle against an enforcing rp_outcome_xor_swap without tripping it", async () => {
    const { writer, row, rejected } = checkEnforcingWriter();
    await surfacePick(SURFACE, { writer });
    await recordOpened({ id: "pick-1", openedAtMs: null }, "t-open", { writer });
    await recordOutcome("pick-1", "didnt_help", "t-answer", { writer });

    expect(rejected).toEqual([]);
    expect(row).toEqual({
      opened_at: "t-open",
      outcome: "didnt_help",
      outcome_at: "t-answer",
      swapped_away_at: null,
    });
  });

  it("swaps a row away against the same CHECK without tripping it either", async () => {
    const { writer, row, rejected } = checkEnforcingWriter();
    await swapPick(
      { outgoingPickId: "pick-1", atIso: "t-swap", replacement: { ...SURFACE, itemId: "feet-on-the-floor" } },
      { writer },
    );

    expect(rejected).toEqual([]);
    expect(row).toEqual({
      opened_at: null,
      outcome: null,
      outcome_at: null,
      swapped_away_at: "t-swap",
    });
  });

  it("a hypothetical write of BOTH signals to one row is rejected — in both directions", async () => {
    // The non-vacuity of the two tests above. Neither direction is reachable through the
    // client — there is no function that writes both, and no parameter that would make one —
    // so the conflated write is composed here, directly against the storage seam.
    const answered = checkEnforcingWriter({ opened_at: "t-open" });
    await recordOutcome("pick-1", "helped", "t-answer", { writer: answered.writer });
    expect(answered.row.outcome).toBe("helped");

    const ontoAnswered = await answered.writer.updatePick("pick-1", { swapped_away_at: "t-swap" });
    expect(ontoAnswered).toEqual({ ok: false, code: CHECK_VIOLATION });
    expect(answered.rejected).toHaveLength(1);
    expect(answered.row.swapped_away_at).toBeNull(); // the refusal changed nothing

    const swapped = checkEnforcingWriter({ opened_at: "t-open" });
    await stampSwappedAway("pick-1", "t-swap", { writer: swapped.writer });
    const ontoSwapped = await swapped.writer.updatePick("pick-1", {
      outcome: "didnt_help",
      outcome_at: "t-answer",
    });
    expect(ontoSwapped).toEqual({ ok: false, code: CHECK_VIOLATION });
    expect(swapped.row.outcome).toBeNull();
  });

  it("an ignored outcome prompt stores nothing — there is no writer it could reach", async () => {
    const { writer, row, calls } = checkEnforcingWriter();
    await surfacePick(SURFACE, { writer });
    const before = calls.length;

    expect(recordIgnoredOutcomePrompt()).toEqual({ wrote: false });

    expect(calls).toHaveLength(before);
    expect(row.outcome).toBeNull();
    expect(row.outcome_at).toBeNull();
    expect(row.swapped_away_at).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-030 as a property of the whole module
// ─────────────────────────────────────────────────────────────────────────────

describe("FR-030 — no exported write path throws or surfaces an error", () => {
  const hostile: RecommendationWriter = {
    insertPick: async () => {
      throw new Error("boom");
    },
    updatePick: async () => {
      throw new Error("boom");
    },
  };

  it("every write call resolves rather than rejecting, against a hostile writer", async () => {
    const deps = { writer: hostile };
    await expect(surfacePick(SURFACE, deps)).resolves.toBeDefined();
    await expect(attachConfirmation("p", "t", deps)).resolves.toBeDefined();
    await expect(recordOpened({ id: "p", openedAtMs: null }, "t", deps)).resolves.toBeDefined();
    await expect(recordOutcome("p", "helped", "t", deps)).resolves.toBeDefined();
    await expect(stampSwappedAway("p", "t", deps)).resolves.toBeDefined();
    await expect(
      swapPick({ outgoingPickId: "p", atIso: "t", replacement: SURFACE }, deps),
    ).resolves.toBeDefined();
  });

  it("no result carries a message, stack, or anything renderable as an error", async () => {
    const results = [
      await surfacePick(SURFACE, { writer: hostile }),
      await recordOutcome("p", "helped", "t", { writer: hostile }),
      await stampSwappedAway("p", "t", { writer: hostile }),
    ];
    for (const result of results) {
      const keys = Object.keys(result);
      expect(keys).not.toContain("error");
      expect(keys).not.toContain("message");
      expect(JSON.stringify(result)).not.toMatch(/boom/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T025 — the reflective-copy fetch half
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The one call in this module that is not a write. Its properties are the same in spirit:
 * every outcome is a value, nothing throws, and nothing it returns is renderable as an
 * error. On top of that it owns the WIRE CONTRACT — snake_case keys against an endpoint
 * that rejects unknown fields — so the mapping is asserted key by key rather than trusted.
 */
const FACTS: ReflectiveFacts = {
  state: 2,
  checkinCount: 3,
  times: ["9:40", "11:15"],
  bandLabels: ["Calm"],
  fallbackText: "Calm at all 3 check-ins today, at 9:40 and 11:15.",
};

const AT_REST_FACTS: ReflectiveFacts = {
  state: 9,
  checkinCount: 1,
  times: ["9:40"],
  bandLabels: ["Uneasy"],
  triedItemTitle: "Box breathing",
  triedAtLabel: "2:20",
  fallbackText: "You tried Box breathing at 2:20.",
};

const token = async () => "test-token";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("fetchReflectiveCopy — the wire contract", () => {
  it("POSTs snake_case facts to the service endpoint with the bearer token", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return jsonResponse({ text: "A quiet day so far." });
    }) as unknown as typeof fetch;

    const result = await fetchReflectiveCopy(FACTS, { fetchImpl, getAccessToken: token });

    expect(result).toEqual({ ok: true, text: "A quiet day so far." });
    expect(seen!.url).toBe(REFLECTIVE_COPY_ENDPOINT);
    expect(seen!.init.method).toBe("POST");
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    expect(JSON.parse(seen!.init.body as string)).toEqual({
      state: 2,
      checkin_count: 3,
      times: ["9:40", "11:15"],
      band_labels: ["Calm"],
      fallback_text: FACTS.fallbackText,
    });
  });

  it("sends the state-9 optionals, and omits them entirely when absent", async () => {
    const bodies: string[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      bodies.push(init.body as string);
      return jsonResponse({ text: "ok" });
    }) as unknown as typeof fetch;

    await fetchReflectiveCopy(AT_REST_FACTS, { fetchImpl, getAccessToken: token });
    await fetchReflectiveCopy(FACTS, { fetchImpl, getAccessToken: token });

    expect(JSON.parse(bodies[0]!)).toMatchObject({
      state: 9,
      tried_item_title: "Box breathing",
      tried_at_label: "2:20",
    });
    // Absent, not null: the endpoint forbids unknown fields, and an omitted optional is
    // the same thing to it as an explicit null.
    expect(Object.keys(JSON.parse(bodies[1]!))).not.toContain("tried_item_title");
    expect(Object.keys(JSON.parse(bodies[1]!))).not.toContain("tried_at_label");
  });

  it("sends nothing beyond the facts bundle", async () => {
    let body: Record<string, unknown> = {};
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return jsonResponse({ text: "ok" });
    }) as unknown as typeof fetch;

    await fetchReflectiveCopy(AT_REST_FACTS, { fetchImpl, getAccessToken: token });

    expect(new Set(Object.keys(body))).toEqual(
      new Set([
        "state",
        "checkin_count",
        "times",
        "band_labels",
        "fallback_text",
        "tried_item_title",
        "tried_at_label",
      ]),
    );
  });
});

describe("fetchReflectiveCopy — every failure is a value", () => {
  it("reports a missing session without calling the service at all", async () => {
    const fetchImpl = vi.fn();
    const result = await fetchReflectiveCopy(FACTS, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      getAccessToken: async () => null,
    });

    expect(result).toEqual({ ok: false, reason: "unauthenticated" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([401, 403, 422, 500, 502])("maps %s to `unavailable`", async (status) => {
    const fetchImpl = (async () => jsonResponse({ error: "x" }, status)) as unknown as typeof fetch;
    expect(await fetchReflectiveCopy(FACTS, { fetchImpl, getAccessToken: token })).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("maps a thrown fetch to `network`", async () => {
    const fetchImpl = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await fetchReflectiveCopy(FACTS, { fetchImpl, getAccessToken: token })).toEqual({
      ok: false,
      reason: "network",
    });
  });

  it.each([
    ["a missing key", {}],
    ["a non-string text", { text: 42 }],
    ["a null text", { text: null }],
    ["a blank text", { text: "   " }],
    ["a null body", null],
  ])("maps %s to `malformed`", async (_label, body) => {
    const fetchImpl = (async () => jsonResponse(body)) as unknown as typeof fetch;
    expect(await fetchReflectiveCopy(FACTS, { fetchImpl, getAccessToken: token })).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("maps a 200 whose body is not JSON to `malformed`, not `network`", async () => {
    // A broken CONTRACT, not a broken connection — reporting it as `network` would point
    // a future debugger at the wrong half of the system.
    const fetchImpl = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON at position 0");
        },
      }) as unknown as Response) as unknown as typeof fetch;

    expect(await fetchReflectiveCopy(FACTS, { fetchImpl, getAccessToken: token })).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("aborts and reports `timeout` once the request outlives its budget", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = ((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })) as unknown as typeof fetch;

      const pending = fetchReflectiveCopy(FACTS, { fetchImpl, getAccessToken: token, timeoutMs: 50 });
      await vi.advanceTimersByTimeAsync(51);

      expect(await pending).toEqual({ ok: false, reason: "timeout" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps its request timeout inside the card's background budget", () => {
    // The socket must not outlive the budget that is supposed to bound it — otherwise the
    // budget, not the timeout, is what cancels the request.
    expect(REFLECTIVE_COPY_REQUEST_TIMEOUT_MS).toBeLessThan(3_500);
  });

  it("never throws, and no result carries anything renderable as an error", async () => {
    const hostileFetch = (async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    const result = await fetchReflectiveCopy(FACTS, {
      fetchImpl: hostileFetch,
      getAccessToken: token,
    });

    expect(Object.keys(result)).not.toContain("message");
    expect(JSON.stringify(result)).not.toMatch(/boom/);
  });
});
