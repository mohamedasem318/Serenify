import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WindowOutcome } from "@/lib/api/monitoring-client";
import {
  CONFIRMATORY_LITTLE_TENSE_SUSTAINED_MS,
  CONFIRMATORY_PROMPT_MIN_DWELL_MS,
  CONFIRMATORY_TENSE_SUSTAINED_MS,
} from "@/lib/questionnaire/constants";
import {
  initialTriggerState,
  isLittleTenseReading,
  isTenseReading,
  markResolvedConsumingBudget,
  markResolvedRearm,
  reduceDwellElapsed,
  reduceOutcome,
  useConfirmatoryTrigger,
  type TriggerConfig,
} from "@/lib/questionnaire/confirmatory-trigger";

/**
 * T028 — the confirmatory trigger state machine. The timing decisions (sustained-tense
 * floor, dwell floor before signal-drop expiry, one-prompt-per-session, single resolution)
 * are tested as PURE reducers over an injected `now`, so they need no real clock. The hook
 * wiring (createPrompt/resolvePrompt/openRen + next-session false-alarm suppression) is
 * tested with fake timers. A static scan proves the module keeps NO cross-worker/global
 * state (Principle: single-worker, browser-local).
 */

const CONFIG: TriggerConfig = {
  sustainedMs: CONFIRMATORY_TENSE_SUSTAINED_MS,
  mildSustainedMs: CONFIRMATORY_LITTLE_TENSE_SUSTAINED_MS,
  dwellMs: CONFIRMATORY_PROMPT_MIN_DWELL_MS,
};

const tense = (capturedAt: string): WindowOutcome => ({ outcome: "reading", band: "tense", capturedAt });
const calm = (capturedAt: string): WindowOutcome => ({ outcome: "reading", band: "at_ease", capturedAt });
const little = (capturedAt: string): WindowOutcome => ({
  outcome: "reading",
  band: "a_little_tense",
  capturedAt,
});
const warming = (capturedAt: string): WindowOutcome => ({ outcome: "warming_up", capturedAt });
const skipped: WindowOutcome = { outcome: "skipped", cause: "our-side" };
const superseded: WindowOutcome = { outcome: "superseded" };

describe("isTenseReading", () => {
  it("is true ONLY for a reading with band=tense", () => {
    expect(isTenseReading(tense("t"))).toBe(true);
    expect(isTenseReading(little("t"))).toBe(false);
    expect(isTenseReading(calm("t"))).toBe(false);
    expect(isTenseReading(warming("t"))).toBe(false);
    expect(isTenseReading(skipped)).toBe(false);
    expect(isTenseReading(superseded)).toBe(false);
  });
});

describe("sustained-tense → show", () => {
  it("shows only after CONFIRMATORY_TENSE_SUSTAINED_MS of consecutive tense", () => {
    let s = initialTriggerState();
    let r = reduceOutcome(s, tense("c0"), 0, true, CONFIG); // run starts
    expect(r.effect).toEqual({ kind: "none" });
    s = r.state;
    r = reduceOutcome(s, tense("c10"), 10_000, true, CONFIG); // 10s < 20s
    expect(r.effect).toEqual({ kind: "none" });
    s = r.state;
    r = reduceOutcome(s, tense("c20"), 20_000, true, CONFIG); // 20s >= 20s → show
    expect(r.effect).toEqual({ kind: "show", triggeredWindowCapturedAt: "c20" });
  });

  it("does NOT show before the threshold and resets on a lower band", () => {
    let s = initialTriggerState();
    s = reduceOutcome(s, tense("c0"), 0, true, CONFIG).state;
    // band eases → run resets
    s = reduceOutcome(s, little("c8"), 8_000, true, CONFIG).state;
    // new tense run starts at 12s; at 19s only 7s elapsed → no show
    s = reduceOutcome(s, tense("c12"), 12_000, true, CONFIG).state;
    const r = reduceOutcome(s, tense("c19"), 19_000, true, CONFIG);
    expect(r.effect).toEqual({ kind: "none" });
  });

  it("inactive monitoring never starts the timer", () => {
    let s = initialTriggerState();
    const r = reduceOutcome(s, tense("c0"), 0, false, CONFIG);
    expect(r.effect).toEqual({ kind: "none" });
    s = r.state;
    // even a long-later tense while inactive must not show (no run was started)
    expect(reduceOutcome(s, tense("c30"), 30_000, false, CONFIG).effect).toEqual({ kind: "none" });
  });

  it("warming / skipped / superseded do not participate in the tense clock", () => {
    let s = initialTriggerState();
    s = reduceOutcome(s, warming("c0"), 0, true, CONFIG).state;
    s = reduceOutcome(s, skipped, 1_000, true, CONFIG).state;
    s = reduceOutcome(s, superseded, 2_000, true, CONFIG).state;
    // first real tense only NOW starts the run; 20s later it shows
    s = reduceOutcome(s, tense("c3"), 3_000, true, CONFIG).state;
    expect(reduceOutcome(s, tense("c23"), 23_000, true, CONFIG).effect).toEqual({
      kind: "show",
      triggeredWindowCapturedAt: "c23",
    });
  });
});

describe("signal-drop expiry honours the dwell floor", () => {
  function shownState() {
    let s = initialTriggerState();
    s = reduceOutcome(s, tense("c0"), 0, true, CONFIG).state;
    s = reduceOutcome(s, tense("c20"), 20_000, true, CONFIG).state; // shown at 20_000
    return s;
  }

  it("expires when a lower band arrives at/after the dwell floor", () => {
    const s = shownState();
    const r = reduceOutcome(s, little("c25"), 20_000 + CONFIRMATORY_PROMPT_MIN_DWELL_MS, true, CONFIG);
    expect(r.effect).toEqual({ kind: "expire", reason: "signal_drop" });
  });

  it("does NOT expire when the band drops before the dwell floor", () => {
    const s = shownState();
    const r = reduceOutcome(s, calm("c22"), 22_000, true, CONFIG); // only 2s on screen
    expect(r.effect).toEqual({ kind: "none" });
    // ...but once the dwell timer elapses with the signal still dropped, it expires.
    expect(reduceDwellElapsed(r.state).effect).toEqual({ kind: "expire", reason: "signal_drop" });
  });

  it("a return to tense before the dwell timer cancels the pending expiry", () => {
    const s = shownState();
    const dropped = reduceOutcome(s, calm("c22"), 22_000, true, CONFIG).state;
    const backTense = reduceOutcome(dropped, tense("c23"), 23_000, true, CONFIG).state;
    expect(reduceDwellElapsed(backTense).effect).toEqual({ kind: "none" });
  });
});

describe("one prompt per session + single resolution", () => {
  it("an explicit answer consumes the session budget — never shows again", () => {
    let s = initialTriggerState();
    s = reduceOutcome(s, tense("c0"), 0, true, CONFIG).state;
    s = reduceOutcome(s, tense("c20"), 20_000, true, CONFIG).state; // shown
    s = markResolvedConsumingBudget(s); // e.g. confirmed / false_alarm / opened_chat
    expect(s.budgetConsumed).toBe(true);
    // a fresh sustained tense run must NOT re-show within the same session
    s = reduceOutcome(s, tense("c40"), 40_000, true, CONFIG).state;
    expect(reduceOutcome(s, tense("c60"), 60_000, true, CONFIG).effect).toEqual({ kind: "none" });
  });

  it("a signal-drop after an explicit answer is a no-op (race resolves once)", () => {
    let s = initialTriggerState();
    s = reduceOutcome(s, tense("c0"), 0, true, CONFIG).state;
    s = reduceOutcome(s, tense("c20"), 20_000, true, CONFIG).state;
    s = markResolvedConsumingBudget(s); // the user answered first
    const r = reduceOutcome(s, calm("c30"), 30_000, true, CONFIG); // late signal drop
    expect(r.effect).toEqual({ kind: "none" });
  });

  it("a signal-drop expiry at/after the dwell floor does NOT consume the budget — a fresh sustained-tense run shows again this session", () => {
    let s = initialTriggerState();
    s = reduceOutcome(s, tense("c0"), 0, true, CONFIG).state;
    s = reduceOutcome(s, tense("c20"), 20_000, true, CONFIG).state; // shown at 20_000
    const expired = reduceOutcome(s, little("c25"), 20_000 + CONFIRMATORY_PROMPT_MIN_DWELL_MS, true, CONFIG);
    expect(expired.effect).toEqual({ kind: "expire", reason: "signal_drop" });
    expect(expired.state.budgetConsumed).toBe(false);
    // a brand-new sustained-tense run, well within the same session, must show again
    s = reduceOutcome(expired.state, tense("c60"), 60_000, true, CONFIG).state;
    expect(reduceOutcome(s, tense("c80"), 80_000, true, CONFIG).effect).toEqual({
      kind: "show",
      triggeredWindowCapturedAt: "c80",
    });
  });

  it("a signal-drop expiry via the dwell timer does NOT consume the budget — a fresh sustained-tense run shows again this session", () => {
    let s = initialTriggerState();
    s = reduceOutcome(s, tense("c0"), 0, true, CONFIG).state;
    s = reduceOutcome(s, tense("c20"), 20_000, true, CONFIG).state; // shown at 20_000
    s = reduceOutcome(s, calm("c22"), 22_000, true, CONFIG).state; // dropped before the dwell floor
    const expired = reduceDwellElapsed(s);
    expect(expired.effect).toEqual({ kind: "expire", reason: "signal_drop" });
    expect(expired.state.budgetConsumed).toBe(false);
    // the dwell timer having already fired for the old prompt must not block the next one
    expect(reduceDwellElapsed(expired.state).effect).toEqual({ kind: "none" });
    s = reduceOutcome(expired.state, tense("c60"), 60_000, true, CONFIG).state;
    expect(reduceOutcome(s, tense("c80"), 80_000, true, CONFIG).effect).toEqual({
      kind: "show",
      triggeredWindowCapturedAt: "c80",
    });
  });
});

describe("markResolvedRearm", () => {
  it("resets to a fresh, un-shown state without touching an already-consumed budget", () => {
    let s = initialTriggerState();
    s = reduceOutcome(s, tense("c0"), 0, true, CONFIG).state;
    s = reduceOutcome(s, tense("c20"), 20_000, true, CONFIG).state;
    s = markResolvedConsumingBudget(s);
    const rearmed = markResolvedRearm(s);
    // defensive: rearming preserves whatever budget state it was given (should not un-consume it)
    expect(rearmed.budgetConsumed).toBe(true);
    expect(rearmed.shown).toBe(false);
    expect(rearmed.tenseRunStartMs).toBeNull();
  });
});

// ── Second (milder) trigger: sustained a_little_tense (#134) ──────────────────────────

describe("isLittleTenseReading", () => {
  it("is true ONLY for a reading with band=a_little_tense", () => {
    expect(isLittleTenseReading(little("t"))).toBe(true);
    expect(isLittleTenseReading(tense("t"))).toBe(false);
    expect(isLittleTenseReading(calm("t"))).toBe(false);
    expect(isLittleTenseReading(warming("t"))).toBe(false);
    expect(isLittleTenseReading(skipped)).toBe(false);
    expect(isLittleTenseReading(superseded)).toBe(false);
  });
});

describe("sustained a_little_tense → mild show", () => {
  it("shows a MILD prompt only after CONFIRMATORY_LITTLE_TENSE_SUSTAINED_MS of consecutive a_little_tense", () => {
    let s = initialTriggerState();
    let r = reduceOutcome(s, little("m0"), 0, true, CONFIG); // mild run starts
    expect(r.effect).toEqual({ kind: "none" });
    s = r.state;
    r = reduceOutcome(s, little("m30"), 30_000, true, CONFIG); // 30s < 60s
    expect(r.effect).toEqual({ kind: "none" });
    s = r.state;
    r = reduceOutcome(s, little("m60"), 60_000, true, CONFIG); // 60s >= 60s → show
    expect(r.effect).toEqual({ kind: "show", triggeredWindowCapturedAt: "m60" });
    expect(r.state.shownKind).toBe("mild");
  });

  it("does NOT show a mild prompt before the mild threshold", () => {
    let s = initialTriggerState();
    s = reduceOutcome(s, little("m0"), 0, true, CONFIG).state;
    expect(reduceOutcome(s, little("m59"), 59_000, true, CONFIG).effect).toEqual({ kind: "none" });
  });

  it("inactive monitoring never starts the mild timer", () => {
    let s = initialTriggerState();
    s = reduceOutcome(s, little("m0"), 0, false, CONFIG).state;
    expect(reduceOutcome(s, little("m90"), 90_000, false, CONFIG).effect).toEqual({ kind: "none" });
  });
});

describe("per-band reset matrix (pre-show)", () => {
  // A synthetic state with BOTH runs primed — feed one reading, inspect which run survives.
  // (The matrix is exactly: tense feeds acute + zeroes mild; a_little_tense feeds mild +
  // zeroes acute; anything else / inactive zeroes both.)
  const primeBoth = () => ({ ...initialTriggerState(), tenseRunStartMs: 1_000, littleRunStartMs: 2_000 });

  it("a tense reading feeds the acute run and zeroes the mild run", () => {
    const r = reduceOutcome(primeBoth(), tense("c"), 5_000, true, CONFIG);
    expect(r.state.tenseRunStartMs).toBe(1_000);
    expect(r.state.littleRunStartMs).toBeNull();
  });
  it("an a_little_tense reading feeds the mild run and zeroes the acute run", () => {
    const r = reduceOutcome(primeBoth(), little("c"), 5_000, true, CONFIG);
    expect(r.state.tenseRunStartMs).toBeNull();
    expect(r.state.littleRunStartMs).toBe(2_000);
  });
  it("an at_ease reading zeroes both runs", () => {
    const r = reduceOutcome(primeBoth(), calm("c"), 5_000, true, CONFIG);
    expect(r.state.tenseRunStartMs).toBeNull();
    expect(r.state.littleRunStartMs).toBeNull();
  });
  it("a warming_up reading zeroes both runs", () => {
    const r = reduceOutcome(primeBoth(), warming("c"), 5_000, true, CONFIG);
    expect(r.state.tenseRunStartMs).toBeNull();
    expect(r.state.littleRunStartMs).toBeNull();
  });
  it("a skipped reading zeroes both runs", () => {
    const r = reduceOutcome(primeBoth(), skipped, 5_000, true, CONFIG);
    expect(r.state.tenseRunStartMs).toBeNull();
    expect(r.state.littleRunStartMs).toBeNull();
  });
  it("a superseded reading zeroes both runs", () => {
    const r = reduceOutcome(primeBoth(), superseded, 5_000, true, CONFIG);
    expect(r.state.tenseRunStartMs).toBeNull();
    expect(r.state.littleRunStartMs).toBeNull();
  });
  it("inactive monitoring zeroes both runs even on a tense reading", () => {
    const r = reduceOutcome(primeBoth(), tense("c"), 5_000, false, CONFIG);
    expect(r.state.tenseRunStartMs).toBeNull();
    expect(r.state.littleRunStartMs).toBeNull();
  });
});

describe("climbing a_little_tense → tense hands off to the acute timer", () => {
  it("zeroes a nearly-complete mild run and starts a fresh acute run", () => {
    let s = initialTriggerState();
    s = reduceOutcome(s, little("m0"), 0, true, CONFIG).state; // mild run @0
    s = reduceOutcome(s, little("m50"), 50_000, true, CONFIG).state; // mild @50s (10s short of 60)
    s = reduceOutcome(s, tense("t55"), 55_000, true, CONFIG).state; // climb → mild zeroed, acute @55s
    expect(s.littleRunStartMs).toBeNull();
    expect(s.tenseRunStartMs).toBe(55_000);
    // the abandoned mild run must not fire, and the acute run needs its full 20s from 55s
    expect(reduceOutcome(s, tense("t75"), 75_000, true, CONFIG).effect).toEqual({
      kind: "show",
      triggeredWindowCapturedAt: "t75",
    });
  });
});

describe("arbitration — tense is senior", () => {
  it("shows the TENSE prompt when both runs qualify in a single reduce", () => {
    // A state the matrix never produces (each band zeroes the other run); built directly to
    // prove the acute condition is evaluated BEFORE the mild one — a reorder must not flip this.
    const primed = { ...initialTriggerState(), tenseRunStartMs: 0, littleRunStartMs: 0 };
    const r = reduceOutcome(primed, tense("cX"), 100_000, true, CONFIG);
    expect(r.effect).toEqual({ kind: "show", triggeredWindowCapturedAt: "cX" });
    expect(r.state.shownKind).toBe("tense");
    expect(r.state.mildBudgetConsumed).toBe(false); // showing tense never spends the mild budget
  });
});

describe("tense-senior budget (two flags)", () => {
  function showMild(): ReturnType<typeof reduceOutcome>["state"] {
    let s = initialTriggerState();
    s = reduceOutcome(s, little("m0"), 0, true, CONFIG).state;
    s = reduceOutcome(s, little("m60"), 60_000, true, CONFIG).state;
    return s; // shownKind === "mild"
  }

  it("a mild answer consumes ONLY the mild budget — a later sustained-tense still shows", () => {
    let s = showMild();
    expect(s.shownKind).toBe("mild");
    s = markResolvedConsumingBudget(s);
    expect(s.mildBudgetConsumed).toBe(true);
    expect(s.budgetConsumed).toBe(false); // the acute budget stays open
    // a fresh 20s sustained-tense run later in the session must still show a tense prompt
    s = reduceOutcome(s, tense("t100"), 100_000, true, CONFIG).state;
    const r = reduceOutcome(s, tense("t120"), 120_000, true, CONFIG);
    expect(r.effect).toEqual({ kind: "show", triggeredWindowCapturedAt: "t120" });
    expect(r.state.shownKind).toBe("tense");
  });

  it("a tense answer consumes BOTH budgets — a later sustained-mild is blocked", () => {
    let s = initialTriggerState();
    s = reduceOutcome(s, tense("t0"), 0, true, CONFIG).state;
    s = reduceOutcome(s, tense("t20"), 20_000, true, CONFIG).state; // shown tense
    expect(s.shownKind).toBe("tense");
    s = markResolvedConsumingBudget(s);
    expect(s.budgetConsumed).toBe(true);
    expect(s.mildBudgetConsumed).toBe(true);
    // a fresh 60s sustained-mild run must NOT show (no down-tier nag after an acute answer)
    s = reduceOutcome(s, little("m100"), 100_000, true, CONFIG).state;
    expect(reduceOutcome(s, little("m160"), 160_000, true, CONFIG).effect).toEqual({ kind: "none" });
  });

  it("a mild answer blocks a later mild (≤1 mild per session)", () => {
    let s = showMild();
    s = markResolvedConsumingBudget(s);
    s = reduceOutcome(s, little("m100"), 100_000, true, CONFIG).state;
    expect(reduceOutcome(s, little("m160"), 160_000, true, CONFIG).effect).toEqual({ kind: "none" });
  });
});

// ── Hook wiring (fake timers) ────────────────────────────────────────────────────────

describe("useConfirmatoryTrigger hook", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // The show path awaits resolveWindowReadingId then createPrompt (two microtasks); flush a
  // few rounds so promptIdRef + visible settle before assertions.
  const flush = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };

  function makeDeps(overrides: Partial<Parameters<typeof useConfirmatoryTrigger>[0]> = {}) {
    return {
      sessionId: "sess-1",
      active: true,
      latestOutcome: null as WindowOutcome | null,
      createPrompt: vi.fn(async () => "prompt-1"),
      resolvePrompt: vi.fn(async () => {}),
      resolveWindowReadingId: vi.fn(async () => "wr-1"),
      hasFalseAlarmNextSessionSuppression: vi.fn(() => false),
      consumeFalseAlarmNextSessionSuppression: vi.fn(),
      armFalseAlarmNextSessionSuppression: vi.fn(),
      openRen: vi.fn(),
      config: CONFIG,
      ...overrides,
    };
  }

  it("creates the prompt row and becomes visible after sustained tense", async () => {
    vi.setSystemTime(0);
    const deps = makeDeps();
    const { result, rerender } = renderHook((p) => useConfirmatoryTrigger(p), { initialProps: deps });

    await act(async () => {
      rerender({ ...deps, latestOutcome: tense("c0") });
    });
    await act(async () => {
      vi.setSystemTime(20_000);
      rerender({ ...deps, latestOutcome: tense("c20") });
      await flush();
    });

    expect(deps.createPrompt).toHaveBeenCalledWith({
      triggeredWindowCapturedAt: "c20",
      triggerWindowReadingId: "wr-1",
      kind: "tense",
    });
    expect(result.current.visible).toBe(true);
  });

  it("confirm resolves answered=confirmed and opens Ren without recommendations", async () => {
    vi.setSystemTime(0);
    const deps = makeDeps();
    const { result, rerender } = renderHook((p) => useConfirmatoryTrigger(p), { initialProps: deps });
    await act(async () => rerender({ ...deps, latestOutcome: tense("c0") }));
    await act(async () => {
      vi.setSystemTime(20_000);
      rerender({ ...deps, latestOutcome: tense("c20") });
      await flush();
    });
    await act(async () => {
      result.current.onConfirm();
      await flush();
    });
    expect(deps.resolvePrompt).toHaveBeenCalledWith("prompt-1", {
      type: "answered",
      outcome: "confirmed",
    });
    expect(deps.openRen).toHaveBeenCalledWith("confirmatory_yes");
    expect(result.current.visible).toBe(false);
  });

  it("false alarm arms next-session suppression and does NOT open Ren", async () => {
    vi.setSystemTime(0);
    const deps = makeDeps();
    const { result, rerender } = renderHook((p) => useConfirmatoryTrigger(p), { initialProps: deps });
    await act(async () => rerender({ ...deps, latestOutcome: tense("c0") }));
    await act(async () => {
      vi.setSystemTime(20_000);
      rerender({ ...deps, latestOutcome: tense("c20") });
      await flush();
    });
    await act(async () => {
      result.current.onFalseAlarm();
      await flush();
    });
    expect(deps.resolvePrompt).toHaveBeenCalledWith("prompt-1", {
      type: "answered",
      outcome: "false_alarm",
    });
    expect(deps.armFalseAlarmNextSessionSuppression).toHaveBeenCalledTimes(1);
    expect(deps.openRen).not.toHaveBeenCalled();
  });

  it("a signal-drop auto-expiry does NOT consume the budget — a later sustained-tense run creates a second prompt this session", async () => {
    vi.setSystemTime(0);
    let promptCount = 0;
    const deps = makeDeps({ createPrompt: vi.fn(async () => `prompt-${++promptCount}`) });
    const { result, rerender } = renderHook((p) => useConfirmatoryTrigger(p), { initialProps: deps });
    await act(async () => rerender({ ...deps, latestOutcome: tense("c0") }));
    await act(async () => {
      vi.setSystemTime(20_000);
      rerender({ ...deps, latestOutcome: tense("c20") });
      await flush();
    });
    expect(deps.createPrompt).toHaveBeenCalledTimes(1);
    expect(result.current.visible).toBe(true);

    // band leaves tense and stays away past the dwell floor — an auto-expiry, not a user answer
    await act(async () => {
      vi.setSystemTime(20_000 + CONFIRMATORY_PROMPT_MIN_DWELL_MS);
      rerender({ ...deps, latestOutcome: little("c25") });
      await flush();
    });
    expect(deps.resolvePrompt).toHaveBeenCalledWith("prompt-1", {
      type: "expired",
      reason: "signal_drop",
    });
    expect(result.current.visible).toBe(false);

    // a fresh 20s sustained-tense run, later in the same session, must be able to prompt again
    await act(async () => {
      vi.setSystemTime(60_000);
      rerender({ ...deps, latestOutcome: tense("c60") });
      await flush();
    });
    await act(async () => {
      vi.setSystemTime(80_000);
      rerender({ ...deps, latestOutcome: tense("c80") });
      await flush();
    });
    expect(deps.createPrompt).toHaveBeenCalledTimes(2);
    expect(result.current.visible).toBe(true);
  });

  it("false alarm consumes the budget — a later sustained-tense run does NOT create a second prompt this session", async () => {
    vi.setSystemTime(0);
    const deps = makeDeps();
    const { result, rerender } = renderHook((p) => useConfirmatoryTrigger(p), { initialProps: deps });
    await act(async () => rerender({ ...deps, latestOutcome: tense("c0") }));
    await act(async () => {
      vi.setSystemTime(20_000);
      rerender({ ...deps, latestOutcome: tense("c20") });
      await flush();
    });
    await act(async () => {
      result.current.onFalseAlarm();
      await flush();
    });
    expect(deps.createPrompt).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.setSystemTime(60_000);
      rerender({ ...deps, latestOutcome: tense("c60") });
      await flush();
    });
    await act(async () => {
      vi.setSystemTime(80_000);
      rerender({ ...deps, latestOutcome: tense("c80") });
      await flush();
    });
    expect(deps.createPrompt).toHaveBeenCalledTimes(1);
    expect(result.current.visible).toBe(false);
  });

  it("a session carrying next-session suppression consumes it and never shows", async () => {
    vi.setSystemTime(0);
    const deps = makeDeps({ hasFalseAlarmNextSessionSuppression: vi.fn(() => true) });
    const { result, rerender } = renderHook((p) => useConfirmatoryTrigger(p), { initialProps: deps });
    expect(deps.consumeFalseAlarmNextSessionSuppression).toHaveBeenCalledTimes(1);
    await act(async () => rerender({ ...deps, latestOutcome: tense("c0") }));
    await act(async () => {
      vi.setSystemTime(20_000);
      rerender({ ...deps, latestOutcome: tense("c20") });
      await flush();
    });
    expect(deps.createPrompt).not.toHaveBeenCalled();
    expect(result.current.visible).toBe(false);
  });

  it("a mild prompt persists kind='mild', and answering it re-arms so a later sustained-tense shows a tense prompt", async () => {
    vi.setSystemTime(0);
    let n = 0;
    const deps = makeDeps({ createPrompt: vi.fn(async () => `prompt-${++n}`) });
    const { result, rerender } = renderHook((p) => useConfirmatoryTrigger(p), { initialProps: deps });

    // sustain a_little_tense for 60s → a MILD prompt
    await act(async () => rerender({ ...deps, latestOutcome: little("m0") }));
    await act(async () => {
      vi.setSystemTime(60_000);
      rerender({ ...deps, latestOutcome: little("m60") });
      await flush();
    });
    expect(deps.createPrompt).toHaveBeenCalledWith({
      triggeredWindowCapturedAt: "m60",
      triggerWindowReadingId: "wr-1",
      kind: "mild",
    });
    expect(result.current.visible).toBe(true);

    // answering the mild prompt consumes ONLY the mild budget and re-arms for a later tense
    await act(async () => {
      result.current.onConfirm();
      await flush();
    });
    expect(deps.resolvePrompt).toHaveBeenCalledWith("prompt-1", {
      type: "answered",
      outcome: "confirmed",
    });

    // a fresh 20s sustained-tense run, later in the SAME session, still creates a second prompt
    await act(async () => {
      vi.setSystemTime(100_000);
      rerender({ ...deps, latestOutcome: tense("t100") });
      await flush();
    });
    await act(async () => {
      vi.setSystemTime(120_000);
      rerender({ ...deps, latestOutcome: tense("t120") });
      await flush();
    });
    expect(deps.createPrompt).toHaveBeenCalledWith({
      triggeredWindowCapturedAt: "t120",
      triggerWindowReadingId: "wr-1",
      kind: "tense",
    });
    expect(deps.createPrompt).toHaveBeenCalledTimes(2);
    expect(result.current.visible).toBe(true);
  });
});

describe("no cross-worker / global state (static)", () => {
  const src = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../lib/questionnaire/confirmatory-trigger.ts"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("keeps no localStorage / sessionStorage / module-global trigger state", () => {
    expect(src).not.toContain("localStorage");
    expect(src).not.toContain("sessionStorage");
    expect(src).not.toContain("globalThis");
  });
});
