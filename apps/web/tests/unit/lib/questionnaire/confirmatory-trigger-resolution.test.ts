import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WindowOutcome } from "@/lib/api/monitoring-client";
import {
  CONFIRMATORY_LITTLE_TENSE_SUSTAINED_MS,
  CONFIRMATORY_PROMPT_MIN_DWELL_MS,
  CONFIRMATORY_TENSE_SUSTAINED_MS,
} from "@/lib/questionnaire/constants";
import {
  useConfirmatoryTrigger,
  type TriggerConfig,
} from "@/lib/questionnaire/confirmatory-trigger";

/**
 * T016 — where each of the three confirmatory answers now GOES (014 / FR-010,
 * contracts/confirmatory-resolution.md).
 *
 * This file exists beside the 012 suite rather than inside it, deliberately. That suite pins
 * the trigger's timing and budget guarantees — the reducer describes from PR #130 and PR #135
 * that issues #127 and #134 were closed by — and those guarantees are unchanged by this
 * feature. What changed is one destination: "Yes, that's me" resolves to a recommendation in
 * place instead of handing off to Ren. Keeping the destination tests here means the routing
 * can be re-read, and re-argued, without anyone editing the file that holds the guarantees.
 *
 * The three answers, and what each one must and must NOT reach:
 *
 *   | answer                | destination              | must NOT be called       |
 *   |-----------------------|--------------------------|--------------------------|
 *   | Yes, that's me        | resolveToRecommendation  | openRen                  |
 *   | Maybe — talk about it | openRen(confirmatory_maybe) | resolveToRecommendation |
 *   | No, I'm okay          | (nothing — suppression)  | both                     |
 */

const CONFIG: TriggerConfig = {
  sustainedMs: CONFIRMATORY_TENSE_SUSTAINED_MS,
  mildSustainedMs: CONFIRMATORY_LITTLE_TENSE_SUSTAINED_MS,
  dwellMs: CONFIRMATORY_PROMPT_MIN_DWELL_MS,
};

const tense = (capturedAt: string): WindowOutcome => ({ outcome: "reading", band: "tense", capturedAt });
const little = (capturedAt: string): WindowOutcome => ({
  outcome: "reading",
  band: "a_little_tense",
  capturedAt,
});

describe("useConfirmatoryTrigger — answer routing (FR-010)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** The show path awaits resolveWindowReadingId then createPrompt; flush a few rounds. */
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
      resolveToRecommendation: vi.fn(),
      config: CONFIG,
      ...overrides,
    };
  }

  /** Drive a sustained-tense episode to a shown prompt, and hand back the live api + deps. */
  async function showPrompt(overrides: Partial<Parameters<typeof useConfirmatoryTrigger>[0]> = {}) {
    vi.setSystemTime(0);
    const deps = makeDeps(overrides);
    const { result, rerender } = renderHook((p) => useConfirmatoryTrigger(p), {
      initialProps: deps,
    });
    await act(async () => rerender({ ...deps, latestOutcome: tense("c0") }));
    await act(async () => {
      vi.setSystemTime(20_000);
      rerender({ ...deps, latestOutcome: tense("c20") });
      await flush();
    });
    expect(result.current.visible).toBe(true);
    return { deps, result, rerender };
  }

  /** #134's MILD trigger: 60 s of sustained `a_little_tense` shows a `kind: "mild"` prompt. */
  async function showMildPrompt(overrides: Partial<Parameters<typeof useConfirmatoryTrigger>[0]> = {}) {
    vi.setSystemTime(0);
    const deps = makeDeps(overrides);
    const { result, rerender } = renderHook((p) => useConfirmatoryTrigger(p), {
      initialProps: deps,
    });
    await act(async () => rerender({ ...deps, latestOutcome: little("m0") }));
    await act(async () => {
      vi.setSystemTime(60_000);
      rerender({ ...deps, latestOutcome: little("m60") });
      await flush();
    });
    expect(result.current.visible).toBe(true);
    return { deps, result, rerender };
  }

  // ── "Yes, that's me" ──────────────────────────────────────────────────────────────

  it("confirm persists the answer FIRST, then resolves to the recommendation", async () => {
    // Ordering is the point, not an accident of the implementation: the row is answered
    // before anything downstream reacts to the confirmation.
    //
    // The `resolvePrompt` fake DEFERS past a microtask before recording itself. That is what
    // makes this test bite: it pins COMPLETION order, not invocation order. Regress
    // `answerThenResolve` to `void finalize(...)` — dropping the `await` — and the
    // recommendation resolves while the answer is still in flight, flipping this sequence.
    const order: string[] = [];
    const { deps, result } = await showPrompt({
      resolvePrompt: vi.fn(async () => {
        await Promise.resolve();
        order.push("resolvePrompt");
      }),
      resolveToRecommendation: vi.fn(() => {
        order.push("resolveToRecommendation");
      }),
    });

    await act(async () => {
      result.current.onConfirm();
      await flush();
    });

    expect(deps.resolvePrompt).toHaveBeenCalledWith("prompt-1", {
      type: "answered",
      outcome: "confirmed",
    });
    expect(deps.resolveToRecommendation).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["resolvePrompt", "resolveToRecommendation"]);
  });

  it("confirm never opens Ren — the 012 handoff is superseded on this path", async () => {
    const { deps, result } = await showPrompt();

    await act(async () => {
      result.current.onConfirm();
      await flush();
    });

    expect(deps.openRen).not.toHaveBeenCalled();
  });

  it("confirm still hides the prompt and still spends the budget", async () => {
    const { deps, result, rerender } = await showPrompt();

    await act(async () => {
      result.current.onConfirm();
      await flush();
    });
    expect(result.current.visible).toBe(false);
    expect(deps.createPrompt).toHaveBeenCalledTimes(1);

    // A tense answer is senior and burns both budgets, so a later sustained-tense episode in
    // the SAME session must not create a second prompt. The episode has to be DRIVEN — two
    // fresh tense outcomes 20 s apart, exactly as the pinned suite drives its false-alarm
    // budget test — or `createPrompt` would stay at 1 for want of any input and this would
    // pass with the budget completely broken.
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

  /**
   * The ANSWER is single-resolution; the DESTINATION is idempotent instead of guarded.
   *
   * `finalize`'s guard (unchanged by 014) protects the row and the budget: a second press
   * returns early, so the answer is persisted exactly once and the budget is spent exactly
   * once. It does not gate what happens afterwards, so a second press does reach
   * `resolveToRecommendation` a second time — the same shape `answerThenOpen` has always had
   * with `openRen`.
   *
   * **On a TENSE prompt that is harmless**, and left as it is deliberately. `resolvedRef`
   * stays latched, so the second press writes no second answer; and a confirmation while a
   * pick is already active ATTACHES to it — UPDATE `confirmed_at`, prominence only, never a
   * second row (contracts/confirmatory-resolution.md, "Ruling C"). It is also close to
   * unreachable through the UI, because `finalize` hides the prompt synchronously on the
   * first press. The test below covers exactly this trace.
   *
   * **On a MILD prompt it is not harmless — and that is a pre-existing 012 lifecycle bug,
   * not something 014 introduced.** Since PR #135, answering a mild prompt deliberately
   * re-arms: `finalize` clears `promptIdRef` and resets `resolvedRef` to false so a later
   * sustained-TENSE episode can still prompt. A second press then finds `resolvedRef` false,
   * re-enters `finalize`, and latches `resolvedRef` true with no prompt row attached. The
   * session's later tense prompt is created but never shown — `handleShow` sees the stale
   * latch and resolves it `expired`/`session_end` instead. Reachable identically through the
   * old `openRen` path, so it predates this feature by a release.
   *
   * **Not fixed here, on purpose.** The fix belongs in `finalize`'s re-arm — the shared
   * single-resolution path that the #127/#130/#132/#134 guarantee suites pin — and T016 is a
   * dep swap that is forbidden from touching it. Tracked as its own BACKLOG entry + issue.
   */
  it("persists the answer exactly once when a TENSE confirm is pressed twice", async () => {
    const { deps, result } = await showPrompt();

    await act(async () => {
      result.current.onConfirm();
      result.current.onConfirm();
      await flush();
    });

    expect(deps.resolvePrompt).toHaveBeenCalledTimes(1);
    expect(deps.openRen).not.toHaveBeenCalled();
    // Documents the shape above rather than asserting a guard that does not exist.
    expect(deps.resolveToRecommendation).toHaveBeenCalled();
  });

  /**
   * FR-010 is about the ANSWER, not about which trigger produced the prompt. A mild prompt
   * (#134's sustained `a_little_tense`) answered "Yes, that's me" routes to the recommendation
   * exactly as an acute one does — there is no down-tier path back to Ren.
   */
  it("confirm routes a MILD prompt to the recommendation too, never to Ren", async () => {
    const { deps, result } = await showMildPrompt();
    expect(deps.createPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "mild" }),
    );

    await act(async () => {
      result.current.onConfirm();
      await flush();
    });

    expect(deps.resolvePrompt).toHaveBeenCalledWith("prompt-1", {
      type: "answered",
      outcome: "confirmed",
    });
    expect(deps.resolveToRecommendation).toHaveBeenCalledTimes(1);
    expect(deps.openRen).not.toHaveBeenCalled();
    expect(result.current.visible).toBe(false);
  });

  // ── "Maybe — talk about it" ───────────────────────────────────────────────────────

  it("maybe still opens Ren with the confirmatory_maybe seam, and resolves NO recommendation", async () => {
    const { deps, result } = await showPrompt();

    await act(async () => {
      result.current.onOpenChat();
      await flush();
    });

    expect(deps.resolvePrompt).toHaveBeenCalledWith("prompt-1", {
      type: "answered",
      outcome: "opened_chat",
    });
    expect(deps.openRen).toHaveBeenCalledWith("confirmatory_maybe");
    expect(deps.openRen).toHaveBeenCalledTimes(1);
    expect(deps.resolveToRecommendation).not.toHaveBeenCalled();
  });

  it("maybe never produces the confirmatory_yes handoff — the monitor stops emitting it", async () => {
    const { deps, result } = await showPrompt();

    await act(async () => {
      result.current.onOpenChat();
      await flush();
    });

    expect(deps.openRen).not.toHaveBeenCalledWith("confirmatory_yes");
  });

  // ── "No, I'm okay" ────────────────────────────────────────────────────────────────

  it("false alarm arms next-session suppression and reaches NEITHER destination", async () => {
    const { deps, result } = await showPrompt();

    await act(async () => {
      result.current.onFalseAlarm();
      await flush();
    });

    expect(deps.resolvePrompt).toHaveBeenCalledWith("prompt-1", {
      type: "answered",
      outcome: "false_alarm",
    });
    expect(deps.armFalseAlarmNextSessionSuppression).toHaveBeenCalledTimes(1);
    expect(deps.resolveToRecommendation).not.toHaveBeenCalled();
    expect(deps.openRen).not.toHaveBeenCalled();
    expect(result.current.visible).toBe(false);
  });

  it("a session inheriting the suppression shows nothing, so no destination is reached at all", async () => {
    vi.setSystemTime(0);
    const deps = makeDeps({ hasFalseAlarmNextSessionSuppression: vi.fn(() => true) });
    const { result, rerender } = renderHook((p) => useConfirmatoryTrigger(p), {
      initialProps: deps,
    });
    expect(deps.consumeFalseAlarmNextSessionSuppression).toHaveBeenCalledTimes(1);

    await act(async () => rerender({ ...deps, latestOutcome: tense("c0") }));
    await act(async () => {
      vi.setSystemTime(20_000);
      rerender({ ...deps, latestOutcome: tense("c20") });
      await flush();
    });

    expect(deps.createPrompt).not.toHaveBeenCalled();
    expect(result.current.visible).toBe(false);
    expect(deps.resolveToRecommendation).not.toHaveBeenCalled();
    expect(deps.openRen).not.toHaveBeenCalled();
  });

  // ── Auto-resolutions reach no destination either ──────────────────────────────────

  it("a session-end expiry resolves the row without confirming anything", async () => {
    const { deps, result } = await showPrompt();

    await act(async () => {
      void result.current.resolveForSessionEnd();
      await flush();
    });

    expect(deps.resolvePrompt).toHaveBeenCalledWith("prompt-1", {
      type: "expired",
      reason: "session_end",
    });
    expect(deps.resolveToRecommendation).not.toHaveBeenCalled();
    expect(deps.openRen).not.toHaveBeenCalled();
  });
});
