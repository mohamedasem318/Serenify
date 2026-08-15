import { describe, expect, it, vi } from "vitest";

import {
  RECOMMENDATION_PICKS_TABLE,
  UNIQUE_VIOLATION,
  attachConfirmation,
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
