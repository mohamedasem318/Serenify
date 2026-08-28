import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ThingsThatMightHelpCard,
  type ThingsThatMightHelpDeps,
} from "@/components/home/things-that-might-help-card";
import type { Band } from "@/lib/api/monitoring-client";
import {
  clearSwappedAway as clientClearSwappedAway,
  recordOpened as clientRecordOpened,
  recordOutcome as clientRecordOutcome,
  surfacePick as clientSurfacePick,
  swapPick as clientSwapPick,
  type PickInsertRow,
  type RecommendationWriter,
} from "@/lib/api/recommendations-client";
import { OUTCOME_QUESTION } from "@/lib/recommendations/card-strings";
import { MAX_PICKS_PER_EPISODE } from "@/lib/recommendations/engine";
import {
  IDLE_CARD_UI,
  deriveCardModel,
  type BandReading,
  type PickRow,
} from "@/lib/recommendations/episode";
import {
  OUTCOME_ACKNOWLEDGEMENT,
  RECOMMENDATION_LIBRARY,
  SWAP_RETIRED_LINE,
  type LibraryItem,
} from "@/lib/recommendations/library";
import { neutralPreferenceSource } from "@/lib/recommendations/preference-source";
import type { TodayBandReading } from "@/lib/recommendations/recommendation-reads";

/**
 * Feature 014 / T028 + T029 — User Story 4 (swapping away) and signal distinctness at the
 * card level.
 *
 * ── Why this suite drives the REAL write client ──────────────────────────────────────
 * The T014 suite injects hand-written stand-ins for `surfacePick` / `recordOutcome` /
 * `swapPick`, which is right for state coverage: it keeps the states the subject and the
 * storage a detail. US4 and SC-007 are the opposite question — they are ABOUT the storage.
 * "The stamp precedes the INSERT", "exactly one re-run and then nothing", "a swap writes the
 * swap column and only the swap column" are all claims about writes that a stand-in would
 * simply restate rather than test. So the card here is wired to the actual T010 functions
 * over an injected `RecommendationWriter`, and every assertion below reads the real column
 * names off the real patches.
 *
 * The writer also ENFORCES the migration's three row CHECKs — `rp_outcome_iff_at`,
 * `rp_outcome_requires_opened`, `rp_outcome_xor_swap`. That is what turns SC-007 from "the
 * card seems to use two different columns" into "a write conflating the two signals would be
 * rejected, and the card never composes one". The non-vacuity of that emulation is asserted
 * directly, so a CHECK that silently stopped firing could not pass as a green suite.
 *
 * ── The two Vitest facts this file is written around (as in T014) ────────────────────
 * RTL's `waitFor` DEADLOCKS on Vitest fake timers, so nothing here waits: everything is
 * driven with `act` and asserted synchronously. happy-dom carries no stylesheet, so visual
 * claims are asserted on `className` or on a testid, never with `toBeVisible()`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — one fixed local day, one fixed clock
// ─────────────────────────────────────────────────────────────────────────────

const AT = (hour: number, minute: number) => new Date(2026, 7, 16, hour, minute).getTime();
const NOW = AT(14, 30);
const NOW_ISO = new Date(NOW).toISOString();
const LOCAL_DAY = "2026-08-16";
const DWELL_MS = 2_500;

const reading = (band: Band, hour: number, minute: number, sessionId = "s1"): TodayBandReading => ({
  band,
  atMs: AT(hour, minute),
  sessionId,
});

const UNEASY_DAY = [reading("at_ease", 9, 40, "s1"), reading("a_little_tense", 14, 5, "s2")];

/**
 * What the engine deterministically produces for `UNEASY_DAY` at 14:30, in order. Peak tenor
 * `a_little_tense` × afternoon ranks `sensory_reset` first (weight 80), so the three swaps
 * walk that category's declared order before the shared three-pick budget runs out. Spelled
 * out rather than computed — if the rule table or the declared order changes, US4's fixtures
 * should notice.
 */
const PICK_1 = "look-out-a-window";
const PICK_2 = "something-to-hold";
const PICK_3 = "turn-the-room-down";

const itemOf = (id: string): LibraryItem => RECOMMENDATION_LIBRARY.find((i) => i.id === id)!;

/** The two-item library used for the retire-EARLY case: non-repeat bites before the budget. */
const TWO_ITEM_LIBRARY: readonly LibraryItem[] = [itemOf(PICK_1), itemOf(PICK_2)];

// ─────────────────────────────────────────────────────────────────────────────
// The harness — the real client over an in-memory, CHECK-enforcing table
// ─────────────────────────────────────────────────────────────────────────────

type Call =
  | { op: "insert"; row: PickInsertRow }
  | { op: "update"; pickId: string; patch: Readonly<Record<string, string | null>> };

/** Postgres check-violation SQLSTATE — what a real `rp_outcome_xor_swap` breach returns. */
const CHECK_VIOLATION = "23514";

interface Control {
  /**
   * Item id → how many further INSERT attempts must fail. `1` models the transient failure
   * contract point 2 exists for; `Infinity` models the permanent one point 3 stops at.
   */
  failInserts: Map<string, number>;
  /** Column names whose UPDATE fails, e.g. `swapped_away_at` for a failed stamp. */
  blockedUpdates: Set<string>;
}

interface Harness {
  deps: Partial<ThingsThatMightHelpDeps>;
  rows: PickRow[];
  calls: Call[];
  /** The CHECK-enforcing storage seam itself — exposed so its non-vacuity can be shown. */
  writer: RecommendationWriter;
  /** Writes the emulated row CHECKs rejected. MUST stay empty for every card-driven flow. */
  rejected: Call[];
  control: Control;
  ren: () => number;
  /** Whether the card armed contract point 2's callback at all, and how often it fired. */
  rerun: () => { armed: boolean; fired: number };
  /** Hold the next swap in flight so the transient state 10 can be observed. */
  deferSwap: () => () => void;
  /** The library this harness was built with — the deriveCardModel cross-checks need it. */
  library: readonly LibraryItem[];
  bands: TodayBandReading[];
}

function harness(options: {
  bands?: TodayBandReading[];
  picks?: PickRow[];
  library?: readonly LibraryItem[];
} = {}): Harness {
  const rows: PickRow[] = [...(options.picks ?? [])];
  const bands = options.bands ?? [...UNEASY_DAY];
  const library = options.library ?? RECOMMENDATION_LIBRARY;
  const calls: Call[] = [];
  const rejected: Call[] = [];
  const control: Control = { failInserts: new Map(), blockedUpdates: new Set() };
  let pickSeq = 0;
  let episodeSeq = 0;
  let renClicks = 0;
  let rerunArmed = false;
  let rerunFired = 0;
  let gate: Promise<void> | null = null;
  let openGate: (() => void) | null = null;

  const parse = (value: string | null | undefined): number | null =>
    value === null || value === undefined ? null : new Date(value).getTime();

  /**
   * The three row CHECKs of `20260815090000_recommendation_picks.sql`, applied to the row a
   * patch WOULD produce. `rp_outcome_xor_swap` is the one SC-007 turns on; the other two ride
   * along because a harness that enforces only the constraint under test proves less than one
   * that enforces the table.
   */
  const violates = (row: PickRow): boolean =>
    (row.outcome === null) !== (row.outcomeAtMs === null) || // rp_outcome_iff_at
    (row.outcome !== null && row.openedAtMs === null) || // rp_outcome_requires_opened
    (row.outcome !== null && row.swappedAwayAtMs !== null); // rp_outcome_xor_swap

  const writer: RecommendationWriter = {
    async insertPick(row) {
      calls.push({ op: "insert", row });
      const failuresLeft = control.failInserts.get(row.item_id) ?? 0;
      if (failuresLeft > 0) {
        control.failInserts.set(row.item_id, failuresLeft - 1);
        return { ok: false };
      }
      pickSeq += 1;
      rows.push({
        id: `pick-${pickSeq}`,
        localDay: row.local_day,
        episodeId: row.episode_id,
        itemId: row.item_id,
        category: row.category,
        source: row.source,
        suggestedAtMs: NOW,
        confirmedAtMs: null,
        openedAtMs: null,
        outcome: null,
        outcomeAtMs: null,
        swappedAwayAtMs: null,
      });
      return { ok: true };
    },
    async updatePick(pickId, patch) {
      const call: Call = { op: "update", pickId, patch };
      calls.push(call);
      if (Object.keys(patch).some((column) => control.blockedUpdates.has(column))) {
        return { ok: false };
      }
      const row = rows.find((r) => r.id === pickId);
      if (!row) return { ok: false };
      const next: PickRow = {
        ...row,
        confirmedAtMs: "confirmed_at" in patch ? parse(patch.confirmed_at) : row.confirmedAtMs,
        openedAtMs: "opened_at" in patch ? parse(patch.opened_at) : row.openedAtMs,
        outcome: "outcome" in patch ? (patch.outcome as PickRow["outcome"]) : row.outcome,
        outcomeAtMs: "outcome_at" in patch ? parse(patch.outcome_at) : row.outcomeAtMs,
        swappedAwayAtMs:
          "swapped_away_at" in patch ? parse(patch.swapped_away_at) : row.swappedAwayAtMs,
      };
      if (violates(next)) {
        rejected.push(call);
        return { ok: false, code: CHECK_VIOLATION };
      }
      Object.assign(row, next);
      return { ok: true };
    },
  };

  const deps: Partial<ThingsThatMightHelpDeps> = {
    library,
    dwellMs: DWELL_MS,
    // Generation is OFF here for the same reason it is off in T014: US4 has nothing to do
    // with states 2/9, and the default seam would reach for a session token.
    generateReflectiveCopy: async () => ({ ok: false, reason: "unavailable" }),
    now: () => NOW,
    newId: () => `episode-${(episodeSeq += 1)}`,
    openRen: () => {
      renClicks += 1;
    },
    loadPicks: async () => rows.map((r) => ({ ...r })),
    loadBands: async () => bands.map((b) => ({ ...b })),
    // The real T010 functions, over the writer above. Nothing between the card and the
    // column names — which is the whole point of this file.
    surfacePick: (input) => clientSurfacePick(input, { writer, library }),
    recordOpened: (pick, atIso) => clientRecordOpened(pick, atIso, { writer }),
    recordOutcome: (pickId, outcome, atIso) => clientRecordOutcome(pickId, outcome, atIso, { writer }),
    // The both-inserts-failed reversal, over the same writer as every other write.
    clearSwappedAway: (pickId) => clientClearSwappedAway(pickId, { writer }),
    swapPick: async (input, swapDeps) => {
      if (gate) await gate;
      // The one re-run of contract point 2 is counted THROUGH the seam it is delivered on,
      // so "exactly one" is a claim about the callback rather than a claim about how many
      // inserts happened to land. Without this, a card that had never armed the callback and
      // was quietly relying on the auto-surface effect would look identical.
      const armed = swapDeps?.onReplacementInsertFailed;
      if (armed) rerunArmed = true;
      return clientSwapPick(input, {
        ...swapDeps,
        onReplacementInsertFailed: armed
          ? () => {
              rerunFired += 1;
              armed();
            }
          : undefined,
        writer,
        library,
      });
    },
  };

  return {
    deps,
    rows,
    calls,
    writer,
    rejected,
    control,
    library,
    bands,
    ren: () => renClicks,
    rerun: () => ({ armed: rerunArmed, fired: rerunFired }),
    deferSwap: () => {
      gate = new Promise<void>((resolve) => {
        openGate = resolve;
      });
      return () => {
        const release = openGate;
        gate = null;
        openGate = null;
        release?.();
      };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Driving and assertions
// ─────────────────────────────────────────────────────────────────────────────

async function settle(rounds = 20) {
  for (let i = 0; i < rounds; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function click(testId: string) {
  await act(async () => {
    screen.getByTestId(testId).click();
  });
  await settle();
}

async function mount(h: Harness, userId = "user-1") {
  const view = render(<ThingsThatMightHelpCard userId={userId} deps={h.deps} />);
  await settle();
  return view;
}

const TEN_STATES = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);

function cardState(): string {
  const actual = screen.getByTestId("things-that-might-help").getAttribute("data-card-state");
  expect(TEN_STATES.has(actual ?? "")).toBe(true);
  return actual!;
}

function expectState(state: number) {
  expect(cardState()).toBe(String(state));
}

/** FR-030: this surface has no error state, in any branch, ever. */
function expectNoErrorSurface() {
  const text = screen.getByTestId("things-that-might-help").textContent ?? "";
  expect(text).not.toMatch(/error|failed|something went wrong|couldn't|try again|sorry/i);
  expect(text).not.toContain("!");
  expect(screen.queryByRole("alert")).toBeNull();
}

const shownItem = () => screen.getByTestId("pick-item").getAttribute("data-item-id");

const inserts = (h: Harness) =>
  h.calls.flatMap((call) => (call.op === "insert" ? [call.row.item_id] : []));

const updates = (h: Harness) =>
  h.calls.flatMap((call) => (call.op === "update" ? [call] : []));

/** SC-007's structural half: no single patch may ever carry both signals. */
function expectSignalsNeverConflated(h: Harness) {
  for (const call of updates(h)) {
    const keys = Object.keys(call.patch);
    const outcomeSide = keys.some((k) => k === "outcome" || k === "outcome_at");
    const swapSide = keys.includes("swapped_away_at");
    expect(outcomeSide && swapSide).toBe(false);
  }
  // …and the emulated CHECK never had to catch one.
  expect(h.rejected).toEqual([]);
}

/** Contract point 4: the stamp is never reversed, on any path. */
function expectStampNeverReversed(h: Harness) {
  for (const call of updates(h)) {
    if ("swapped_away_at" in call.patch) expect(call.patch.swapped_away_at).not.toBeNull();
  }
}

/** The reducer's own budget derivation, run over the rows the card actually produced. */
function budgetRemainingFor(h: Harness): number {
  return deriveCardModel({
    localDay: LOCAL_DAY,
    nowMs: NOW,
    picks: h.rows,
    bands: h.bands.map((b): BandReading => ({ band: b.band, atMs: b.atMs })),
    ui: IDLE_CARD_UI,
    library: h.library,
    preferences: neutralPreferenceSource,
    newEpisodeId: "episode-probe",
  }).budgetRemaining;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// US4 acceptance scenarios 1–3
// ─────────────────────────────────────────────────────────────────────────────

describe("ThingsThatMightHelpCard — US4 acceptance scenarios", () => {
  it("1 — a different item appears with no acknowledgement and no ceremony, and the swap is its own signal", async () => {
    const h = harness();
    await mount(h);
    expectState(3);
    expect(shownItem()).toBe(PICK_1);

    await click("swap");

    // A different item, and nothing announcing that anything happened.
    expectState(3);
    expect(shownItem()).toBe(PICK_2);
    expect(screen.queryByTestId("outcome-recorded")).toBeNull();
    expect(screen.queryByTestId("questionnaire-result-message")).toBeNull();
    expect(screen.getByTestId("things-that-might-help").textContent ?? "").not.toContain(
      OUTCOME_ACKNOWLEDGEMENT,
    );
    expectNoErrorSurface();

    // The signal: `swapped_away_at` on the outgoing row, and NOTHING in the outcome columns.
    expect(updates(h)).toEqual([
      { op: "update", pickId: "pick-1", patch: { swapped_away_at: NOW_ISO } },
    ]);
    expect(h.rows[0]!.swappedAwayAtMs).toBe(NOW);
    expect(h.rows[0]!.outcome).toBeNull();
    expect(h.rows[0]!.outcomeAtMs).toBeNull();
    expectSignalsNeverConflated(h);
    // The re-run is armed on every swap and fires on none that succeed.
    expect(h.rerun()).toEqual({ armed: true, fired: 0 });
  });

  it("1b — the stamp PRECEDES the replacement INSERT (Ruling B, forced by the partial unique index)", async () => {
    const h = harness();
    await mount(h);
    await click("swap");

    // Initial surface, then stamp, then replacement — insert-first would collide with the
    // still-active outgoing row under `rp_one_active_per_user_day`.
    expect(
      h.calls.map((call) =>
        call.op === "insert" ? `insert:${call.row.item_id}` : `update:${Object.keys(call.patch).join(",")}`,
      ),
    ).toEqual([`insert:${PICK_1}`, "update:swapped_away_at", `insert:${PICK_2}`]);
    expectStampNeverReversed(h);
  });

  it("1c — state 10 is the mock's fade and nothing else while the swap is in flight", async () => {
    const h = harness();
    await mount(h);
    const release = h.deferSwap();

    await act(async () => {
      screen.getByTestId("swap").click();
    });
    await settle(2);

    expectState(10);
    expect(screen.getByTestId("swap-fade")).toBeInTheDocument();
    // No acknowledgement, no result ring, no dwell — the absence IS the design.
    expect(screen.queryByTestId("outcome-recorded")).toBeNull();
    expect(screen.queryByTestId("questionnaire-result-icon")).toBeNull();
    expectNoErrorSurface();

    release();
    await settle();
    expectState(3);
    expect(shownItem()).toBe(PICK_2);
  });

  it("2 — once the episode's three picks are spent the swap RETIRES with the honest line", async () => {
    const h = harness();
    await mount(h);
    expect(shownItem()).toBe(PICK_1);

    await click("swap");
    expect(shownItem()).toBe(PICK_2);
    await click("swap");
    expect(shownItem()).toBe(PICK_3);

    // Three surfaced rows: the shared budget is spent (FR-018).
    expect(inserts(h)).toEqual([PICK_1, PICK_2, PICK_3]);
    expect(h.rows).toHaveLength(MAX_PICKS_PER_EPISODE);
    expect(new Set(h.rows.map((r) => r.episodeId)).size).toBe(1);
    expect(budgetRemainingFor(h)).toBe(0);

    // Retired, not repeating: the action is gone and the honest line stands in its place.
    expect(screen.queryByTestId("swap")).toBeNull();
    expect(screen.getByTestId("swap-retired")).toHaveTextContent(SWAP_RETIRED_LINE);
    expectNoErrorSurface();

    // Every item offered was a different one, and no outcome was ever recorded on the way.
    expect(new Set(h.rows.map((r) => r.itemId)).size).toBe(3);
    expect(h.rows.every((r) => r.outcome === null)).toBe(true);
    expectSignalsNeverConflated(h);
  });

  it("2b — retires EARLY when the day's non-repeat rule bites before the budget does", async () => {
    // Two eligible items, so after one swap the non-repeat rule has retired both while the
    // shared budget still has a slot left. FR-018: the non-repeat rule wins.
    const h = harness({ library: TWO_ITEM_LIBRARY });
    await mount(h);
    expect(shownItem()).toBe(PICK_1);

    await click("swap");
    expect(shownItem()).toBe(PICK_2);

    // The budget is NOT what retired it — one slot of three is still unspent.
    expect(h.rows).toHaveLength(2);
    expect(budgetRemainingFor(h)).toBe(MAX_PICKS_PER_EPISODE - 2);
    expect(budgetRemainingFor(h)).toBeGreaterThan(0);

    expect(screen.queryByTestId("swap")).toBeNull();
    expect(screen.getByTestId("swap-retired")).toHaveTextContent(SWAP_RETIRED_LINE);
    expectNoErrorSurface();
  });

  it("3 — the swap and Ren actions are WITHDRAWN while the instructions are open (state 5)", async () => {
    const h = harness();
    await mount(h);
    expect(screen.getByTestId("swap")).toBeInTheDocument();
    expect(screen.getByTestId("talk-to-ren")).toBeInTheDocument();

    await click("show-me");
    expectState(5);
    expect(screen.queryByTestId("swap")).toBeNull();
    expect(screen.queryByTestId("talk-to-ren")).toBeNull();
    // The retirement line is not a substitute for a withdrawn action — mid-instruction the
    // card says nothing about swapping at all.
    expect(screen.queryByTestId("swap-retired")).toBeNull();

    // …and they come back when the steps close, unchanged.
    await click("close-instructions");
    expectState(6);
    expect(screen.getByTestId("outcome-prompt")).toHaveTextContent(OUTCOME_QUESTION);
    expect(h.ren()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The failure paths — contract points 2, 3 and 4
// ─────────────────────────────────────────────────────────────────────────────

describe("ThingsThatMightHelpCard — a failed swap degrades in silence (FR-030)", () => {
  it("a failed replacement INSERT triggers EXACTLY ONE engine re-run, which then lands", async () => {
    const h = harness();
    await mount(h);
    // Exactly ONE insert of the replacement fails — the transient failure contract point 2
    // is written for. The card's one permitted re-run is what makes the second attempt.
    h.control.failInserts.set(PICK_2, 1);

    await click("swap");

    // The re-run fired exactly once, on the seam the contract names — and it is the card
    // that arms it, not the auto-surface effect picking up an orphan.
    expect(h.rerun()).toEqual({ armed: true, fired: 1 });
    // Stamp, failed insert, ONE re-run's insert. Nothing else, ever.
    expect(inserts(h)).toEqual([PICK_1, PICK_2, PICK_2]);
    expectState(3);
    expect(shownItem()).toBe(PICK_2);
    expectNoErrorSurface();
    expectStampNeverReversed(h);
    expectSignalsNeverConflated(h);

    // Settling further must not produce a third attempt — `attemptedRef` closed the door.
    await settle(30);
    expect(inserts(h)).toEqual([PICK_1, PICK_2, PICK_2]);
  });

  it("a twice-failed replacement REVERSES the stamp and restores the original pick (Ruling 2026-08-28)", async () => {
    const h = harness();
    await mount(h);
    // Every replacement INSERT of PICK_2 fails — insert 1 inside `swapPick`, insert 2 from the
    // one engine re-run. That is the both-inserts-failed path: no replacement row ever lands.
    h.control.failInserts.set(PICK_2, Number.POSITIVE_INFINITY);

    await click("swap");

    // Attempt 1 inside `swapPick`, attempt 2 from the one engine re-run. Then it stops —
    // no retry loop (contract point 3), however long the card is left alone.
    expect(h.rerun()).toEqual({ armed: true, fired: 1 });
    expect(inserts(h)).toEqual([PICK_1, PICK_2, PICK_2]);
    await settle(40);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    // Still only the two failed replacement attempts — the reversal is an UPDATE, not a third
    // insert, and no retry loop restarts.
    expect(inserts(h)).toEqual([PICK_1, PICK_2, PICK_2]);
    expect(h.rerun().fired).toBe(1);

    // The SCOPED exception to point 4: the swap did not happen, so the stamp is reversed. The
    // stamp landed FIRST (ordering unchanged), then a second update cleared it back to NULL.
    expect(updates(h)).toEqual([
      { op: "update", pickId: "pick-1", patch: { swapped_away_at: NOW_ISO } },
      { op: "update", pickId: "pick-1", patch: { swapped_away_at: null } },
    ]);

    // The original pick is active again — on screen and in the row — and nothing was
    // conflated or rendered as an error.
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0]!.itemId).toBe(PICK_1);
    expect(h.rows[0]!.swappedAwayAtMs).toBeNull();
    expectState(3);
    expect(shownItem()).toBe(PICK_1);
    expectNoErrorSurface();
    expect(TEN_STATES.has(cardState())).toBe(true);
    expectSignalsNeverConflated(h);

    // No budget was mis-charged: the one active row is the person's single pick, so the
    // episode is exactly where it started (FR-018) — the failed swap cost nothing.
    expect(budgetRemainingFor(h)).toBe(MAX_PICKS_PER_EPISODE - 1);
  });

  it("a twice-failed STAMP leaves the previous pick on screen, untouched and unannounced", async () => {
    // The stamp is the step that can leave the previous pick in place: with it unwritten the
    // outgoing row is still today's active pick, and the replacement is never attempted at
    // all (inserting it would collide with the row that is still active).
    const h = harness();
    await mount(h);
    h.control.blockedUpdates.add("swapped_away_at");

    await click("swap");
    expectState(3);
    expect(shownItem()).toBe(PICK_1);
    expectNoErrorSurface();

    await click("swap");
    expectState(3);
    expect(shownItem()).toBe(PICK_1);
    expectNoErrorSurface();

    // Two clicks, two stamp attempts, ZERO retries and zero replacement inserts.
    expect(updates(h)).toHaveLength(2);
    expect(updates(h).every((call) => "swapped_away_at" in call.patch)).toBe(true);
    expect(inserts(h)).toEqual([PICK_1]);
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0]!.swappedAwayAtMs).toBeNull();
  });

  it("Amendment 2026-08-16 — a failed swap consumes NO budget slot", async () => {
    const h = harness();
    const first = await mount(h);
    const before = budgetRemainingFor(h);

    h.control.failInserts.set(PICK_2, Number.POSITIVE_INFINITY);
    await click("swap");

    // Budget counts replacement rows that LANDED, never stamps — so with no successor row and
    // the stamp reversed (Ruling 2026-08-28) the episode is exactly where it was. A person
    // must not lose one of the episode's three suggestions because a write failed on our side.
    expect(h.rows.filter((r) => r.episodeId === h.rows[0]!.episodeId)).toHaveLength(1);
    expect(budgetRemainingFor(h)).toBe(before);
    expect(budgetRemainingFor(h)).toBe(MAX_PICKS_PER_EPISODE - 1);

    // …and the ORIGINAL item is restored — the swap did not happen, so the person keeps the
    // pick they had rather than being stranded with neither.
    expect(shownItem()).toBe(PICK_1);
    expect(h.rows[0]!.swappedAwayAtMs).toBeNull();

    // The proof that the slot really is still there: with the failure cleared, the episode
    // goes on to surface its full three picks. Had the failed swap charged a slot, the third
    // could never have landed.
    h.control.failInserts.clear();
    // A fresh mount is the honest way to re-open the door: `attemptedRef` is per-mount, and
    // the person coming back to the page is exactly the situation being modelled. The original
    // pick is still active, so it is what greets them.
    first.unmount();
    const view = render(<ThingsThatMightHelpCard userId="user-1" deps={h.deps} />);
    await settle();
    expect(shownItem()).toBe(PICK_1);
    await click("swap");
    expect(shownItem()).toBe(PICK_2);
    await click("swap");
    expect(shownItem()).toBe(PICK_3);

    expect(h.rows.map((r) => r.itemId)).toEqual([PICK_1, PICK_2, PICK_3]);
    expect(new Set(h.rows.map((r) => r.episodeId)).size).toBe(1);
    expect(budgetRemainingFor(h)).toBe(0);
    expect(screen.getByTestId("swap-retired")).toHaveTextContent(SWAP_RETIRED_LINE);
    expectNoErrorSurface();
    view.unmount();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T029 — signal distinctness at the card level (SC-007)
// ─────────────────────────────────────────────────────────────────────────────

describe("ThingsThatMightHelpCard — swaps and outcomes are distinct signals (SC-007)", () => {
  it("a swap writes `swapped_away_at` and nothing else", async () => {
    const h = harness();
    await mount(h);
    await click("swap");

    const patches = updates(h).map((call) => call.patch);
    expect(patches).toEqual([{ swapped_away_at: NOW_ISO }]);
    // Column-level, not just call-level: the outcome columns are untouched on every row.
    expect(h.rows.every((r) => r.outcome === null && r.outcomeAtMs === null)).toBe(true);
    expectSignalsNeverConflated(h);
  });

  it("'didn't help' writes `outcome` + `outcome_at` and nothing else", async () => {
    const h = harness();
    await mount(h);
    await click("show-me");
    await click("close-instructions");
    await click("outcome-didnt-help");

    const patches = updates(h).map((call) => call.patch);
    // `opened_at` is the engagement record (FR-015); the answer is the second and last write.
    expect(patches).toEqual([
      { opened_at: NOW_ISO },
      { outcome: "didnt_help", outcome_at: NOW_ISO },
    ]);
    const answered = h.rows.find((r) => r.id === "pick-1")!;
    expect(answered.outcome).toBe("didnt_help");
    expect(answered.swappedAwayAtMs).toBeNull();
    expectSignalsNeverConflated(h);
  });

  it("'it helped' is a THIRD distinct value in the same column, never a swap", async () => {
    const h = harness();
    await mount(h);
    await click("show-me");
    await click("close-instructions");
    await click("outcome-helped");

    expect(updates(h).map((call) => call.patch)).toEqual([
      { opened_at: NOW_ISO },
      { outcome: "helped", outcome_at: NOW_ISO },
    ]);
    expect(h.rows[0]!.swappedAwayAtMs).toBeNull();
    expectSignalsNeverConflated(h);
  });

  it("an IGNORED outcome prompt stores nothing at all (FR-016)", async () => {
    const h = harness();
    await mount(h);
    await click("show-me");
    await click("close-instructions");
    expectState(6);

    const before = h.calls.length;
    // Ignoring is the ABSENCE of a click — there is deliberately no dismiss control. Neither
    // time passing nor a re-render may turn it into a record.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    await settle(30);

    expect(h.calls).toHaveLength(before);
    expect(h.rows[0]!.outcome).toBeNull();
    expect(h.rows[0]!.outcomeAtMs).toBeNull();
    expect(h.rows[0]!.swappedAwayAtMs).toBeNull();
  });

  it("both signals recorded across one day stay in their own columns, on their own rows", async () => {
    // The full US4 walk: swap the first pick away, then answer the second. Two signals, two
    // rows, two columns, zero conflation — and the day's non-repeat rule holds throughout.
    const h = harness();
    await mount(h);
    await click("swap");
    await click("show-me");
    await click("close-instructions");
    await click("outcome-didnt-help");

    const swapped = h.rows.find((r) => r.itemId === PICK_1)!;
    const answered = h.rows.find((r) => r.itemId === PICK_2)!;
    expect(swapped.swappedAwayAtMs).toBe(NOW);
    expect(swapped.outcome).toBeNull();
    expect(answered.outcome).toBe("didnt_help");
    expect(answered.swappedAwayAtMs).toBeNull();
    expectSignalsNeverConflated(h);
    expectStampNeverReversed(h);
  });

  it("the emulated `rp_outcome_xor_swap` is REAL — a conflated write is rejected", async () => {
    // Non-vacuity. Every assertion above rests on `h.rejected` staying empty, which is only
    // evidence if the CHECK can actually fire. So the hypothetical write is made HERE,
    // directly against the storage seam — the card is deliberately given no part in it,
    // because "the card never composes such a write" is precisely the property under test.
    const h = harness();
    await mount(h);
    await click("show-me");
    await click("close-instructions");
    await click("outcome-helped");
    expect(h.rejected).toEqual([]);

    const answered = h.rows.find((r) => r.outcome !== null)!;
    expect(answered.outcome).toBe("helped");

    // Stamping an already-answered row would put both signals on one row. The table refuses.
    const conflated = await h.writer.updatePick(answered.id, { swapped_away_at: NOW_ISO });
    expect(conflated).toEqual({ ok: false, code: CHECK_VIOLATION });
    expect(h.rejected).toHaveLength(1);

    // …and the refusal left the row exactly as it was.
    expect(answered.outcome).toBe("helped");
    expect(answered.swappedAwayAtMs).toBeNull();

    // The mirror image: recording an outcome on a swapped-away row is refused too, so the
    // exclusion holds in both directions rather than only the one the card happens to take.
    const swapped = h.rows.find((r) => r.id !== answered.id) ?? null;
    const target =
      swapped ??
      (await (async () => {
        await h.writer.insertPick({
          user_id: "user-1",
          local_day: LOCAL_DAY,
          episode_id: h.rows[0]!.episodeId,
          item_id: PICK_2,
          category: itemOf(PICK_2).category,
          source: "reading",
        });
        return h.rows.at(-1)!;
      })());
    await h.writer.updatePick(target.id, { opened_at: NOW_ISO });
    await h.writer.updatePick(target.id, { swapped_away_at: NOW_ISO });
    const reverse = await h.writer.updatePick(target.id, {
      outcome: "didnt_help",
      outcome_at: NOW_ISO,
    });
    expect(reverse).toEqual({ ok: false, code: CHECK_VIOLATION });
    expect(target.outcome).toBeNull();
  });
});
