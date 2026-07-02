import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WindowOutcome } from "@/lib/api/monitoring-client";
import {
  CONFIRMATORY_PROMPT_MIN_DWELL_MS,
  CONFIRMATORY_TENSE_SUSTAINED_MS,
} from "@/lib/questionnaire/constants";
import {
  initialTriggerState,
  isTenseReading,
  markResolved,
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
  it("never shows again once resolved", () => {
    let s = initialTriggerState();
    s = reduceOutcome(s, tense("c0"), 0, true, CONFIG).state;
    s = reduceOutcome(s, tense("c20"), 20_000, true, CONFIG).state; // shown
    s = markResolved(s); // answered
    // a fresh sustained tense run must NOT re-show within the same session
    s = reduceOutcome(s, tense("c40"), 40_000, true, CONFIG).state;
    expect(reduceOutcome(s, tense("c60"), 60_000, true, CONFIG).effect).toEqual({ kind: "none" });
  });

  it("a signal-drop after an answer is a no-op (race resolves once)", () => {
    let s = initialTriggerState();
    s = reduceOutcome(s, tense("c0"), 0, true, CONFIG).state;
    s = reduceOutcome(s, tense("c20"), 20_000, true, CONFIG).state;
    s = markResolved(s); // the user answered first
    const r = reduceOutcome(s, calm("c30"), 30_000, true, CONFIG); // late signal drop
    expect(r.effect).toEqual({ kind: "none" });
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
