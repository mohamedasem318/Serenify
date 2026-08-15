import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ThingsThatMightHelpCard,
  type ThingsThatMightHelpDeps,
} from "@/components/home/things-that-might-help-card";
import { ConfirmedPickCard } from "@/components/recommendations/confirmed-pick-card";
import type { Band } from "@/lib/api/monitoring-client";
import type { PickInsertRow, SurfacePickResult } from "@/lib/api/recommendations-client";
import {
  CARD_DESC_CONFIRMED,
  CARD_DESC_NOTHING_TO_SUGGEST,
  CARD_DESC_NO_READING,
  CARD_DESC_PICKED,
  CARD_TITLE,
  DURATION_OPENED_LABEL,
  OUTCOME_QUESTION,
} from "@/lib/recommendations/card-strings";
import type { PickOutcome } from "@/lib/recommendations/engine";
import type { PickRow } from "@/lib/recommendations/episode";
import {
  NO_READING_YET_LEAD,
  OUTCOME_ACKNOWLEDGEMENT,
  OUTCOME_DIDNT_HELP_SUBLINE,
  OUTCOME_NO_REPLACEMENT_SUBLINE,
  RECOMMENDATION_LIBRARY,
  SWAP_RETIRED_LINE,
  type LibraryItem,
} from "@/lib/recommendations/library";
import type { TodayBandReading } from "@/lib/recommendations/recommendation-reads";

/**
 * Feature 014 / T014 — the state-coverage + signal suite for the home card.
 *
 * WHAT THIS FILE IS FOR, in order of how much it would hurt to lose:
 *
 *   1. **All ten states are reachable and there is no eleventh** (SC-002). Every assertion
 *      goes through `expectState`, which refuses any `data-card-state` outside 1–10 — so an
 *      accidental error surface or a "loading" state fails the suite rather than slipping in
 *      as an extra branch.
 *   2. **US1 acceptance scenarios 1–6**, named as the spec names them.
 *   3. **The three signals stay distinct** (SC-007, card level): "helped" and "didn't help"
 *      are stored as different outcome values, a swap is stored as a swap and never as an
 *      outcome, and an ignored prompt stores NOTHING at all.
 *   4. **A failed write renders no error** (FR-030) and degrades to what was on screen.
 *
 * ── Two Vitest/Windows facts this file is written around ─────────────────────────────
 * RTL's `waitFor` DEADLOCKS on Vitest fake timers here — its poll runs on real time while
 * the component sits on the fake clock — so nothing below waits: everything is driven with
 * `act` + `advanceTimersByTimeAsync` and asserted synchronously. And happy-dom carries no
 * stylesheet, so visual claims are asserted on `className`, never with `toBeVisible()`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — one fixed local day, one fixed clock
// ─────────────────────────────────────────────────────────────────────────────

const AT = (hour: number, minute: number) => new Date(2026, 7, 16, hour, minute).getTime();
const NOW = AT(14, 30);
const LOCAL_DAY = "2026-08-16";
const DWELL_MS = 2_500;

const reading = (band: Band, hour: number, minute: number, sessionId = "s1"): TodayBandReading => ({
  band,
  atMs: AT(hour, minute),
  sessionId,
});

const CALM_DAY = [reading("at_ease", 9, 40, "s1"), reading("at_ease", 11, 15, "s2")];
const UNEASY_DAY = [reading("at_ease", 9, 40, "s1"), reading("a_little_tense", 14, 5, "s2")];

/**
 * What the engine deterministically produces for `UNEASY_DAY` at 14:30: peak tenor
 * `a_little_tense` × afternoon ranks `sensory_reset` first (weight 80), and that category's
 * first declared item is this one. Hard-coded on purpose — if the rule table or the declared
 * order changes, this suite should notice.
 */
const FIRST_PICK_ID = "look-out-a-window";

function pickRow(over: Partial<PickRow> = {}): PickRow {
  const itemId = over.itemId ?? FIRST_PICK_ID;
  const entry = RECOMMENDATION_LIBRARY.find((i) => i.id === itemId)!;
  return {
    id: "pick-seed",
    localDay: LOCAL_DAY,
    episodeId: "episode-seed",
    itemId,
    category: entry.category,
    source: "reading",
    suggestedAtMs: AT(14, 6),
    confirmedAtMs: null,
    openedAtMs: null,
    outcome: null,
    outcomeAtMs: null,
    swappedAwayAtMs: null,
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The harness — an in-memory stand-in for the owner-RLS table
// ─────────────────────────────────────────────────────────────────────────────

interface Failures {
  surface?: boolean;
  outcome?: boolean;
  swapStamp?: boolean;
}

interface Harness {
  deps: Partial<ThingsThatMightHelpDeps>;
  rows: PickRow[];
  calls: {
    surfaced: string[];
    opened: string[];
    outcomes: Array<{ pickId: string; outcome: PickOutcome }>;
    swapStamps: string[];
    ren: number;
    /** Every write of any kind, in order — the "ignoring records nothing" assertion. */
    writes: string[];
  };
  /** Hold the next swap in flight so the transient state 10 can be observed. Returns the release. */
  deferSwap: () => () => void;
}

function harness(options: {
  picks?: PickRow[];
  bands?: TodayBandReading[];
  library?: readonly LibraryItem[];
  fail?: Failures;
}): Harness {
  const rows: PickRow[] = [...(options.picks ?? [])];
  const bands = options.bands ?? [];
  const library = options.library ?? RECOMMENDATION_LIBRARY;
  const fail = options.fail ?? {};
  const calls: Harness["calls"] = {
    surfaced: [],
    opened: [],
    outcomes: [],
    swapStamps: [],
    ren: 0,
    writes: [],
  };
  let episodeSeq = 0;
  let pickSeq = 0;
  let gate: Promise<void> | null = null;
  let openGate: (() => void) | null = null;

  const insert = (input: {
    userId: string;
    localDay: string;
    episodeId: string;
    itemId: string;
    source: "reading" | "confirmed";
  }): SurfacePickResult => {
    calls.surfaced.push(input.itemId);
    calls.writes.push(`surface:${input.itemId}`);
    const entry = library.find((i) => i.id === input.itemId);
    if (!entry) return { ok: false, reason: "unknown_item" };
    if (fail.surface) return { ok: false, reason: "write_failed" };
    pickSeq += 1;
    rows.push({
      id: `pick-${pickSeq}`,
      localDay: input.localDay,
      episodeId: input.episodeId,
      itemId: input.itemId,
      category: entry.category,
      source: input.source,
      suggestedAtMs: NOW,
      confirmedAtMs: null,
      openedAtMs: null,
      outcome: null,
      outcomeAtMs: null,
      swappedAwayAtMs: null,
    });
    const row: PickInsertRow = {
      user_id: input.userId,
      local_day: input.localDay,
      episode_id: input.episodeId,
      item_id: entry.id,
      category: entry.category,
      source: input.source,
    };
    return { ok: true, row };
  };

  const deps: Partial<ThingsThatMightHelpDeps> = {
    library,
    dwellMs: DWELL_MS,
    now: () => NOW,
    newId: () => `episode-${(episodeSeq += 1)}`,
    openRen: () => {
      calls.ren += 1;
    },
    loadPicks: async () => rows.map((r) => ({ ...r })),
    loadBands: async () => bands.map((b) => ({ ...b })),
    surfacePick: async (input) => insert(input),
    recordOpened: async (pick) => {
      // Mirrors the real client's set-once guard: re-expanding writes nothing.
      if (pick.openedAtMs !== null) return { ok: true, wrote: false };
      calls.opened.push(pick.id);
      calls.writes.push(`opened:${pick.id}`);
      const row = rows.find((r) => r.id === pick.id);
      if (row) row.openedAtMs = NOW;
      return { ok: true, wrote: true };
    },
    recordOutcome: async (pickId, outcome) => {
      calls.outcomes.push({ pickId, outcome });
      calls.writes.push(`outcome:${pickId}:${outcome}`);
      if (fail.outcome) return { ok: false, attempts: 2 };
      const row = rows.find((r) => r.id === pickId);
      if (row) {
        row.outcome = outcome;
        row.outcomeAtMs = NOW;
      }
      return { ok: true, attempts: 1 };
    },
    swapPick: async (input) => {
      if (gate) await gate;
      calls.swapStamps.push(input.outgoingPickId);
      calls.writes.push(`swap:${input.outgoingPickId}`);
      if (fail.swapStamp) return { stamped: false, replacementSurfaced: false, reselected: false };
      const outgoing = rows.find((r) => r.id === input.outgoingPickId);
      if (outgoing) outgoing.swappedAwayAtMs = NOW;
      const inserted = insert(input.replacement);
      return { stamped: true, replacementSurfaced: inserted.ok, reselected: !inserted.ok };
    },
  };

  return {
    deps,
    rows,
    calls,
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
// Driving
// ─────────────────────────────────────────────────────────────────────────────

/** Flush the load → derive → surface → reload chain without ever calling `waitFor`. */
async function settle(rounds = 12) {
  for (let i = 0; i < rounds; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function click(testId: string) {
  await act(async () => {
    screen.getByTestId(testId).click();
  });
  await settle();
}

const TEN_STATES = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);

/** Assert the card is in `state` — and, always, that it is in ONE OF THE TEN (SC-002). */
function expectState(state: number) {
  const actual = screen.getByTestId("things-that-might-help").getAttribute("data-card-state");
  expect(TEN_STATES.has(actual ?? "")).toBe(true);
  expect(actual).toBe(String(state));
}

/** FR-030: this surface has no error state, in any branch, ever. */
function expectNoErrorSurface() {
  const text = screen.getByTestId("things-that-might-help").textContent ?? "";
  expect(text).not.toMatch(/error|failed|something went wrong|couldn't|try again|sorry/i);
  expect(text).not.toContain("!");
  expect(screen.queryByRole("alert")).toBeNull();
}

async function mount(h: Harness, userId = "user-1") {
  const view = render(<ThingsThatMightHelpCard userId={userId} deps={h.deps} />);
  await settle();
  return view;
}

/** open → close → answer, the US1 loop, in one line. */
async function runLoop(outcome: PickOutcome) {
  await click("show-me");
  await click("close-instructions");
  await click(outcome === "helped" ? "outcome-helped" : "outcome-didnt-help");
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// The ten states
// ─────────────────────────────────────────────────────────────────────────────

describe("ThingsThatMightHelpCard — all ten states are reachable (SC-002)", () => {
  it("state 1 — no reading yet today: names the cause and offers a check-in", async () => {
    await mount(harness({ bands: [], picks: [] }));
    expectState(1);
    expect(screen.getByTestId("card-description")).toHaveTextContent(CARD_DESC_NO_READING);
    expect(screen.getByTestId("resting-lead")).toHaveTextContent(NO_READING_YET_LEAD);
    expect(screen.getByTestId("start-checkin")).toHaveAttribute("href", "/app/monitor");
    expectNoErrorSurface();
  });

  it("state 2 — calm: a specific, true line from the person's own readings, and no action", async () => {
    await mount(harness({ bands: CALM_DAY }));
    expectState(2);
    expect(screen.getByTestId("card-description")).toHaveTextContent(CARD_DESC_NOTHING_TO_SUGGEST);
    // Real count, real preformatted times — nothing invented (contracts/reflective-copy.md).
    const lead = screen.getByTestId("resting-lead").textContent ?? "";
    expect(lead).toContain("2 check-ins");
    expect(lead).toContain("9:40");
    expect(lead).toContain("11:15");
    expect(screen.queryByTestId("pick-item")).toBeNull();
    expect(screen.queryByTestId("start-checkin")).toBeNull();
    expectNoErrorSurface();
  });

  it("state 3 — uneasy, unconfirmed: exactly one pick, quietly, band not restated", async () => {
    const h = harness({ bands: UNEASY_DAY });
    await mount(h);
    expectState(3);
    expect(screen.getByTestId("card-description")).toHaveTextContent(CARD_DESC_PICKED);
    expect(screen.getAllByTestId("pick-item")).toHaveLength(1);
    expect(screen.getByTestId("pick-item")).toHaveAttribute("data-prominent", "false");
    expect(h.calls.surfaced).toEqual([FIRST_PICK_ID]);
    expectNoErrorSurface();
  });

  it("state 4 — a confirmed detection renders the SAME pick prominently", async () => {
    const confirmed = pickRow({ id: "pick-c", confirmedAtMs: AT(14, 10) });
    const h = harness({ bands: UNEASY_DAY, picks: [confirmed] });
    await mount(h);
    expectState(4);
    expect(screen.getByTestId("card-description")).toHaveTextContent(CARD_DESC_CONFIRMED);
    expect(screen.getByTestId("pick-item")).toHaveAttribute("data-item-id", confirmed.itemId);
    expect(screen.getByTestId("pick-item")).toHaveAttribute("data-prominent", "true");
    // Prominence never surfaces a second row — same pick, same budget (FR-018).
    expect(h.calls.surfaced).toEqual([]);
  });

  it("state 5 — expanded: instructions visible, swap and Ren withdrawn", async () => {
    await mount(harness({ bands: UNEASY_DAY }));
    await click("show-me");
    expectState(5);
    expect(screen.getByTestId("pick-item-steps")).toBeInTheDocument();
    expect(screen.queryByTestId("swap")).toBeNull();
    expect(screen.queryByTestId("talk-to-ren")).toBeNull();
  });

  it("state 6 — the outcome prompt, only after open AND close, never over the steps", async () => {
    await mount(harness({ bands: UNEASY_DAY }));
    await click("show-me");
    // FR-031: while the steps are open the question must not be on screen.
    expect(screen.queryByTestId("outcome-prompt")).toBeNull();
    await click("close-instructions");
    expectState(6);
    expect(screen.getByTestId("outcome-prompt")).toHaveTextContent(OUTCOME_QUESTION);
  });

  it("state 7 — recorded, helped: acknowledged without grading", async () => {
    await mount(harness({ bands: UNEASY_DAY }));
    await runLoop("helped");
    expectState(7);
    expect(screen.getByTestId("outcome-recorded")).toHaveAttribute("data-outcome", "helped");
    expect(screen.getByTestId("questionnaire-result-message")).toHaveTextContent(
      OUTCOME_ACKNOWLEDGEMENT,
    );
    expect(screen.queryByTestId("take-replacement")).toBeNull();
  });

  it("state 8 — recorded, didn't help: the SAME word, plus the only immediate replacement", async () => {
    await mount(harness({ bands: UNEASY_DAY }));
    await runLoop("didnt_help");
    expectState(8);
    expect(screen.getByTestId("questionnaire-result-message")).toHaveTextContent(
      OUTCOME_ACKNOWLEDGEMENT,
    );
    expect(screen.getByTestId("outcome-subline")).toHaveTextContent(OUTCOME_DIDNT_HELP_SUBLINE);
    expect(screen.getByTestId("take-replacement")).toBeInTheDocument();
  });

  it("state 8 — the NO-REPLACEMENT variant: same treatment, same word, one honest line", async () => {
    // A one-item library: opening the only item retires every eligible pick for the day, so
    // the shared budget has nothing left to spend (FR-018).
    const only = RECOMMENDATION_LIBRARY.find((i) => i.id === FIRST_PICK_ID)!;
    await mount(harness({ bands: UNEASY_DAY, library: [only] }));
    await runLoop("didnt_help");
    expectState(8);
    expect(screen.getByTestId("questionnaire-result-message")).toHaveTextContent(
      OUTCOME_ACKNOWLEDGEMENT,
    );
    expect(screen.getByTestId("outcome-subline")).toHaveTextContent(OUTCOME_NO_REPLACEMENT_SUBLINE);
    expect(screen.queryByTestId("take-replacement")).toBeNull();
    // …then it settles to state 9 rather than sitting there (FR-001 state 8).
    await advance(DWELL_MS + 10);
    await settle();
    expectState(9);
  });

  it("state 9 — at rest: no second pick pushed, and no claim that the day is over", async () => {
    const h = harness({ bands: UNEASY_DAY });
    await mount(h);
    await runLoop("helped");
    await advance(DWELL_MS + 10);
    await settle();
    expectState(9);
    expect(screen.queryByTestId("pick-item")).toBeNull();
    expect(h.calls.surfaced).toHaveLength(1);
    const text = screen.getByTestId("things-that-might-help").textContent ?? "";
    expect(text).not.toMatch(/done for (the day|today)|that is it for today|no more today/i);
    expect(screen.getByTestId("card-description")).toHaveTextContent(CARD_DESC_NOTHING_TO_SUGGEST);
    // It names what was tried — that is what keeps state 9 distinct from state 2.
    expect(screen.getByTestId("resting-lead")).toHaveTextContent("Look out a window");
  });

  it("state 10 — swapped away: the replacement appears with no acknowledgement at all", async () => {
    const h = harness({ bands: UNEASY_DAY });
    await mount(h);
    const release = h.deferSwap();

    await act(async () => {
      screen.getByTestId("swap").click();
    });
    await settle(2);
    expectState(10);
    // No ceremony: no result ring, no acknowledgement word, no dwell.
    expect(screen.queryByTestId("outcome-recorded")).toBeNull();
    expect(screen.getByTestId("things-that-might-help").textContent ?? "").not.toContain(
      OUTCOME_ACKNOWLEDGEMENT,
    );
    expect(screen.getByTestId("swap-fade")).toBeInTheDocument();

    release();
    await settle();
    expectState(3);
    expect(screen.getByTestId("pick-item").getAttribute("data-item-id")).not.toBe(FIRST_PICK_ID);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// US1 acceptance scenarios
// ─────────────────────────────────────────────────────────────────────────────

describe("ThingsThatMightHelpCard — US1 acceptance scenarios 1–6", () => {
  it("1 — one item, quietly, and the band is not restated", async () => {
    await mount(harness({ bands: UNEASY_DAY }));
    expectState(3);
    expect(screen.getAllByTestId("pick-item")).toHaveLength(1);
    const text = screen.getByTestId("things-that-might-help").textContent ?? "";
    for (const band of ["Calm", "Uneasy", "Tense"]) expect(text).not.toContain(band);
  });

  it("2 — opening shows the library text VERBATIM and stores the engagement record once", async () => {
    const h = harness({ bands: UNEASY_DAY });
    await mount(h);
    const item = RECOMMENDATION_LIBRARY.find((i) => i.id === FIRST_PICK_ID)!;
    await click("show-me");
    const steps = screen.getByTestId("pick-item-steps").textContent ?? "";
    for (const step of item.steps) expect(steps).toContain(step);
    expect(h.calls.opened).toEqual(["pick-1"]);
  });

  it("2b — opened_at is set ONCE: re-expanding an already-opened pick writes nothing (FR-015)", async () => {
    // A pick already opened earlier today, with the prompt not yet eligible (the person
    // reloaded rather than closing the steps), so the item's actions are back on screen.
    const h = harness({
      bands: UNEASY_DAY,
      picks: [pickRow({ id: "p1", openedAtMs: AT(14, 10) })],
    });
    await mount(h);
    expectState(3);
    await click("show-me");
    expectState(5);
    expect(h.calls.opened).toEqual([]);
  });

  it("3 — closing raises the prompt once; IGNORING it records nothing and costs nothing", async () => {
    const h = harness({ bands: UNEASY_DAY });
    await mount(h);
    await click("show-me");
    await click("close-instructions");
    expectState(6);

    const writesBefore = [...h.calls.writes];
    // Ignoring is the third answer, and it is the ABSENCE of a click — there is deliberately
    // no dismiss control. Time passing must not turn it into a record.
    await advance(60_000);
    await settle();
    expect(h.calls.writes).toEqual(writesBefore);
    expect(h.calls.outcomes).toEqual([]);
    // …and it costs nothing: the pick is still the day's active one.
    expect(h.rows.filter((r) => r.outcome === null && r.swappedAwayAtMs === null)).toHaveLength(1);
  });

  it("4 — 'it helped' is recorded and acknowledged without grading", async () => {
    const h = harness({ bands: UNEASY_DAY });
    await mount(h);
    await runLoop("helped");
    expect(h.calls.outcomes).toEqual([{ pickId: "pick-1", outcome: "helped" }]);
    expect(h.rows[0]!.outcome).toBe("helped");
    expectState(7);
  });

  it("5 — 'it didn't help' is recorded, acknowledged IDENTICALLY, and offers a replacement", async () => {
    const h = harness({ bands: UNEASY_DAY });
    await mount(h);
    await runLoop("didnt_help");
    expect(h.calls.outcomes).toEqual([{ pickId: "pick-1", outcome: "didnt_help" }]);

    // The acknowledgement is ONE constant used by both paths — a different word per branch
    // would grade the answer. States 7 and 8 above assert against the same constant.
    expect(screen.getByTestId("questionnaire-result-message")).toHaveTextContent(
      OUTCOME_ACKNOWLEDGEMENT,
    );

    await click("take-replacement");
    expectState(3);
    // The replacement drew on the SAME episode's budget and is a different item (no repeat).
    expect(h.calls.surfaced).toHaveLength(2);
    expect(h.calls.surfaced[1]).not.toBe(FIRST_PICK_ID);
    expect(new Set(h.rows.map((r) => r.episodeId)).size).toBe(1);
  });

  it("6 — at rest afterwards, and it RE-ARMS when the day shifts again", async () => {
    const bands = [...UNEASY_DAY];
    const h = harness({ bands });
    const view = await mount(h);
    await runLoop("helped");
    await advance(DWELL_MS + 10);
    await settle();
    expectState(9);
    expect(h.calls.surfaced).toHaveLength(1);

    // A qualifying reading AFTER the recorded outcome is a NEW stress event: new episode,
    // fresh budget, a new pick (FR-018 / FR-001 state 9's re-arm).
    view.unmount();
    bands.push(reading("tense", 14, 45, "s3"));
    render(<ThingsThatMightHelpCard userId="user-1" deps={h.deps} />);
    await settle();
    expectState(3);
    expect(h.calls.surfaced).toHaveLength(2);
    expect(new Set(h.rows.map((r) => r.episodeId)).size).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Signal distinctness (SC-007, card level)
// ─────────────────────────────────────────────────────────────────────────────

describe("ThingsThatMightHelpCard — the three signals stay distinct (SC-007)", () => {
  it("stores 'helped' in the outcome column and nothing in the swap column", async () => {
    const h = harness({ bands: UNEASY_DAY });
    await mount(h);
    await runLoop("helped");
    expect(h.rows[0]!.outcome).toBe("helped");
    expect(h.rows[0]!.swappedAwayAtMs).toBeNull();
    expect(h.calls.swapStamps).toEqual([]);
  });

  it("stores 'didn't help' as an OUTCOME — a different value, never a swap", async () => {
    const h = harness({ bands: UNEASY_DAY });
    await mount(h);
    await runLoop("didnt_help");
    expect(h.rows[0]!.outcome).toBe("didnt_help");
    expect(h.rows[0]!.swappedAwayAtMs).toBeNull();
    expect(h.calls.swapStamps).toEqual([]);
  });

  it("stores a swap as a SWAP and never as an outcome (FR-017)", async () => {
    const h = harness({ bands: UNEASY_DAY });
    await mount(h);
    await click("swap");
    expect(h.calls.swapStamps).toEqual(["pick-1"]);
    expect(h.calls.outcomes).toEqual([]);
    const swapped = h.rows.find((r) => r.id === "pick-1")!;
    expect(swapped.swappedAwayAtMs).not.toBeNull();
    expect(swapped.outcome).toBeNull();
  });

  it("retires the swap action honestly rather than repeating an item", async () => {
    const only = RECOMMENDATION_LIBRARY.find((i) => i.id === FIRST_PICK_ID)!;
    await mount(harness({ bands: UNEASY_DAY, library: [only] }));
    expectState(3);
    expect(screen.queryByTestId("swap")).toBeNull();
    expect(screen.getByTestId("swap-retired")).toHaveTextContent(SWAP_RETIRED_LINE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FR-030 — no error state, in any branch
// ─────────────────────────────────────────────────────────────────────────────

describe("ThingsThatMightHelpCard — failed writes render no error (FR-030)", () => {
  it("attempts a failed pick INSERT exactly once and never loops", async () => {
    const h = harness({ bands: UNEASY_DAY, fail: { surface: true } });
    await mount(h);
    await settle(20);
    expect(h.calls.surfaced).toEqual([FIRST_PICK_ID]);
    expectState(3);
    expectNoErrorSurface();
  });

  it("degrades a failed outcome write to the previous state and never re-asks", async () => {
    const h = harness({ bands: UNEASY_DAY, fail: { outcome: true } });
    await mount(h);
    await runLoop("helped");
    expectState(7);
    expectNoErrorSurface();

    await advance(DWELL_MS + 10);
    await settle();
    // The write never landed, so the pick is still active. The card degrades to the pick —
    // and the question it already asked is NOT asked a second time (FR-016 / FR-030).
    expectState(3);
    expect(screen.queryByTestId("outcome-prompt")).toBeNull();
    expectNoErrorSurface();
  });

  it("keeps the previous pick on screen when the swap stamp fails", async () => {
    const h = harness({ bands: UNEASY_DAY, fail: { swapStamp: true } });
    await mount(h);
    await click("swap");
    expectState(3);
    expect(screen.getByTestId("pick-item")).toHaveAttribute("data-item-id", FIRST_PICK_ID);
    expectNoErrorSurface();
  });

  it("leaves the card resting when a read throws, never broken", async () => {
    const h = harness({ bands: UNEASY_DAY });
    h.deps.loadPicks = async () => {
      throw new Error("network");
    };
    await mount(h);
    expectState(1);
    expectNoErrorSurface();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Quiet by construction (FR-013) and the day boundary (FR-019)
// ─────────────────────────────────────────────────────────────────────────────

describe("ThingsThatMightHelpCard — quiet by construction", () => {
  it("renders no dialog, no alert and no live region on an Uneasy day (FR-013)", async () => {
    await mount(harness({ bands: UNEASY_DAY }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the duration pill until the item is opened, then the opened label", async () => {
    const item = RECOMMENDATION_LIBRARY.find((i) => i.id === FIRST_PICK_ID)!;
    await mount(harness({ bands: UNEASY_DAY }));
    expect(screen.getByTestId("pick-item-duration")).toHaveTextContent(item.durationLabel);
    await click("show-me");
    await click("close-instructions");
    expect(screen.getByTestId("pick-item-duration")).toHaveTextContent(DURATION_OPENED_LABEL);
  });

  it("ignores yesterday's rows entirely — the day reset IS the query filter (FR-019)", async () => {
    const yesterday = pickRow({ id: "old", localDay: "2026-08-15", openedAtMs: AT(9, 0) });
    const h = harness({ bands: UNEASY_DAY, picks: [yesterday] });
    await mount(h);
    // Today gets its own pick, and yesterday's opened item is NOT excluded from today.
    expectState(3);
    expect(h.calls.surfaced).toEqual([FIRST_PICK_ID]);
  });

  it("opens Ren in place rather than navigating away", async () => {
    const h = harness({ bands: UNEASY_DAY });
    await mount(h);
    await click("talk-to-ren");
    expect(h.calls.ren).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T019 / US2 — state 4 is the mock's five small moves, and the monitor's own words
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The four user-visible strings the pick contributes, wherever it is rendered. Read through
 * the SHARED `PickItem` testids, so the same helper works against the home card and against
 * the monitor's `ConfirmedPickCard` without knowing which one is mounted.
 */
function pickStrings() {
  return {
    title: screen.getByTestId("pick-item-title").textContent,
    why: screen.getByTestId("pick-item-why").textContent,
    duration: screen.getByTestId("pick-item-duration").textContent,
    steps: Array.from(screen.getByTestId("pick-item-steps").querySelectorAll("li")).map(
      (li) => li.textContent,
    ),
    footNote: screen.queryByTestId("pick-item-footnote")?.textContent ?? null,
  };
}

/** Every className on and under the card — the only place jsdom lets us see a visual claim. */
function classNamesUnder(testId: string): string {
  const root = screen.getByTestId(testId);
  return [root, ...Array.from(root.querySelectorAll("*"))]
    .map((el) => el.getAttribute("class") ?? "")
    .join(" ");
}

const CONFIRMED_ROW = () => pickRow({ id: "pick-c", confirmedAtMs: AT(14, 10) });

async function mountState4() {
  const h = harness({ bands: UNEASY_DAY, picks: [CONFIRMED_ROW()] });
  const view = await mount(h);
  expectState(4);
  return { h, view };
}

async function mountState3() {
  const h = harness({ bands: UNEASY_DAY });
  const view = await mount(h);
  expectState(3);
  return { h, view };
}

describe("ThingsThatMightHelpCard — state 4 is the mock's FIVE small moves, and no sixth", () => {
  /**
   * Prominence is the one place this card is allowed to raise its voice, and the mock is
   * explicit that it does so through five small moves rather than one loud one. Each move is
   * pinned separately below so a future "let's make it stand out more" edit fails a named
   * test instead of quietly landing. happy-dom carries no stylesheet, so every claim is
   * asserted on `className` — never with `toBeVisible()`.
   */

  it("move 1 — the amber rail, and ONLY when confirmed", async () => {
    const { view } = await mountState4();
    const rail = screen.getByTestId("pick-item-rail");
    expect(rail.className).toContain("w-[3px]");
    expect(rail.className).toContain("bg-[var(--amber-soft-line)]");
    view.unmount();

    await mountState3();
    expect(screen.queryByTestId("pick-item-rail")).toBeNull();
  });

  it("move 2 — the tint wash, the warm line and the 17px inset the rail sits in", async () => {
    const { view } = await mountState4();
    const item = screen.getByTestId("pick-item");
    // The mock's own values: 42% amber tint over surface, amber-soft-line border, pl 17px.
    expect(item.className).toContain("bg-[color-mix(in_srgb,var(--amber-tint)_42%,var(--color-surface))]");
    expect(item.className).toContain("border-[var(--amber-soft-line)]");
    expect(item.className).toContain("pl-[17px]");
    view.unmount();

    await mountState3();
    const quiet = screen.getByTestId("pick-item");
    expect(quiet.className).toContain("border-border");
    expect(quiet.className).toContain("bg-bg");
    expect(quiet.className).not.toContain("amber");
  });

  it("move 3 — the warm tile", async () => {
    const { view } = await mountState4();
    const tile = screen.getByTestId("pick-item-tile");
    expect(tile.className).toContain("bg-[color-mix(in_srgb,var(--amber-tint)_70%,var(--color-surface))]");
    expect(tile.className).toContain("text-amber-text");
    view.unmount();

    await mountState3();
    expect(screen.getByTestId("pick-item-tile").className).toContain("text-muted");
    expect(screen.getByTestId("pick-item-tile").className).not.toContain("amber");
  });

  it("move 4 — the title steps 17 → 19 px, and the why-line firms to ink", async () => {
    const { view } = await mountState4();
    expect(screen.getByTestId("pick-item-title").className).toContain("text-[19px]");
    expect(screen.getByTestId("pick-item-why").className).toContain("text-[14.5px]");
    expect(screen.getByTestId("pick-item-why").className).toContain("text-ink");
    view.unmount();

    await mountState3();
    expect(screen.getByTestId("pick-item-title").className).toContain("text-[17px]");
    expect(screen.getByTestId("pick-item-why").className).toContain("text-muted");
  });

  it("move 5 — the primary fills to meadow in state 4, and is outlined in state 3", async () => {
    const { view } = await mountState4();
    expect(screen.getByTestId("show-me").className).toContain("bg-meadow");
    view.unmount();

    await mountState3();
    const outlined = screen.getByTestId("show-me");
    expect(outlined.className).toContain("border-meadow");
    expect(outlined.className).not.toContain("bg-meadow");
  });

  it("the filled CTA is state 4's alone — no other state on this card ever fills one", async () => {
    // The check-in card above owns the page's filled primary; two identical primaries on one
    // screen read as a bug. States 5/6/7/8/9/10 are walked here, not argued about.
    const { view } = await mountState3();
    expect(screen.getByTestId("show-me").className).not.toContain("bg-meadow");
    await click("show-me"); // state 5
    expectState(5);
    expect(screen.getByTestId("close-instructions").className).not.toContain("bg-meadow");
    await click("close-instructions"); // state 6
    expectState(6);
    expect(screen.getByTestId("outcome-helped").className).not.toContain("bg-meadow");
    await click("outcome-helped"); // state 7
    expectState(7);
    expect(classNamesUnder("things-that-might-help")).not.toContain("bg-meadow");
    await advance(DWELL_MS + 10); // state 9
    expectState(9);
    expect(classNamesUnder("things-that-might-help")).not.toContain("bg-meadow");
    view.unmount();
  });

  it("there is no SIXTH move — state 4 renders the same shape as state 3, only dressed", async () => {
    const shapeOf = () =>
      Array.from(
        screen.getByTestId("things-that-might-help").querySelectorAll("[data-testid]"),
      )
        .map((el) => el.getAttribute("data-testid"))
        // The rail IS move 1; every other element must match, one for one.
        .filter((id) => id !== "pick-item-rail");

    const { view } = await mountState4();
    const prominent = shapeOf();
    // Not vacuous: there is a real item on screen to compare.
    expect(prominent).toContain("pick-item-title");
    view.unmount();

    await mountState3();
    expect(prominent).toEqual(shapeOf());
  });

  it("raises its voice with no crimson and no exclamation mark", async () => {
    const { view } = await mountState4();
    const classes = classNamesUnder("things-that-might-help");
    // Not vacuous: prominence really is on screen, and it is amber, not crimson.
    expect(classes).toContain("amber");
    expect(classes).not.toContain("crimson");
    expect(classes).not.toContain("destructive");
    expectNoErrorSurface();
    view.unmount();
  });
});

describe("ThingsThatMightHelpCard — same pick, same words as the monitor (US2 scenario 2)", () => {
  /**
   * The acceptance scenario, asserted rather than asserted-about: the home card and the
   * in-session `ConfirmedPickCard` are given the SAME pick row and the SAME library entry,
   * and every word the person reads about the pick comes back identical. It holds by
   * construction — both surfaces render the shared `PickItem` from the same `LibraryItem`,
   * and both take their card-level words from `card-strings.ts` — and this test is what
   * keeps that construction from being quietly dismantled later.
   *
   * The two surfaces are mounted one at a time, because they share `PickItem`'s testids.
   */
  it("renders identical pick strings on both surfaces, expanded", async () => {
    const item = RECOMMENDATION_LIBRARY.find((i) => i.id === FIRST_PICK_ID)!;

    const { view: home } = await mountState4();
    expect(screen.getByTestId("card-description")).toHaveTextContent(CARD_DESC_CONFIRMED);
    await click("show-me");
    const fromHome = pickStrings();
    home.unmount();

    const monitor = render(
      <ConfirmedPickCard
        open
        item={item}
        paused={false}
        onDismiss={() => {}}
        onOpen={() => {}}
        onOutcome={() => {}}
        onPause={() => {}}
        onResume={() => {}}
      />,
    );
    await act(async () => {
      screen.getByTestId("show-me").click();
    });
    const fromMonitor = pickStrings();

    expect(fromMonitor).toEqual(fromHome);
    // And they are the library's own words, not a coincidence of two empty strings.
    expect(fromHome.title).toBe(item.title);
    expect(fromHome.why).toBe(item.whyLine);
    expect(fromHome.duration).toBe(item.durationLabel);
    expect(fromHome.steps).toHaveLength(item.steps.length);
    monitor.unmount();
  });

  it("carries the same card-level words on both surfaces", async () => {
    const item = RECOMMENDATION_LIBRARY.find((i) => i.id === FIRST_PICK_ID)!;

    const { view: home } = await mountState4();
    expect(screen.getByTestId("things-that-might-help")).toHaveTextContent(CARD_TITLE);
    expect(screen.getByTestId("card-description")).toHaveTextContent(CARD_DESC_CONFIRMED);
    home.unmount();

    const monitor = render(
      <ConfirmedPickCard
        open
        item={item}
        paused={false}
        onDismiss={() => {}}
        onOpen={() => {}}
        onOutcome={() => {}}
        onPause={() => {}}
        onResume={() => {}}
      />,
    );
    expect(document.body).toHaveTextContent(CARD_TITLE);
    expect(document.body).toHaveTextContent(CARD_DESC_CONFIRMED);
    monitor.unmount();
  });

  it("both surfaces render the pick prominently — state 4 is state 4 wherever it appears", async () => {
    const item = RECOMMENDATION_LIBRARY.find((i) => i.id === FIRST_PICK_ID)!;

    const { view: home } = await mountState4();
    expect(screen.getByTestId("pick-item")).toHaveAttribute("data-prominent", "true");
    home.unmount();

    const monitor = render(
      <ConfirmedPickCard
        open
        item={item}
        paused={false}
        onDismiss={() => {}}
        onOpen={() => {}}
        onOutcome={() => {}}
        onPause={() => {}}
        onResume={() => {}}
      />,
    );
    expect(screen.getByTestId("pick-item")).toHaveAttribute("data-prominent", "true");
    monitor.unmount();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The negative claim (SC-002)
// ─────────────────────────────────────────────────────────────────────────────

describe("ThingsThatMightHelpCard — there is no eleventh state", () => {
  it("renders a state in 1–10 for every input shape, including contradictory ones", async () => {
    const scenarios: Array<{ bands: TodayBandReading[]; picks?: PickRow[] }> = [
      { bands: [] },
      { bands: CALM_DAY },
      { bands: UNEASY_DAY },
      { bands: UNEASY_DAY, picks: [pickRow({ id: "p", confirmedAtMs: AT(14, 10) })] },
      {
        bands: UNEASY_DAY,
        picks: [pickRow({ id: "p", openedAtMs: AT(14, 10), outcome: "helped", outcomeAtMs: AT(14, 12) })],
      },
      { bands: UNEASY_DAY, picks: [pickRow({ id: "p", swappedAwayAtMs: AT(14, 10) })] },
      { bands: [reading("tense", 14, 5, "s1")] },
      // Calm readings with a pick row already on the day — a shape no happy path produces.
      { bands: CALM_DAY, picks: [pickRow({ id: "p" })] },
    ];
    for (const scenario of scenarios) {
      const h = harness(scenario);
      const view = render(<ThingsThatMightHelpCard userId="u" deps={h.deps} />);
      await settle();
      const actual = screen
        .getByTestId("things-that-might-help")
        .getAttribute("data-card-state");
      expect(TEN_STATES.has(actual ?? "")).toBe(true);
      view.unmount();
    }
  });
});
