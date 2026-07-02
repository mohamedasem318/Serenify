import { describe, expect, it } from "vitest";

import type { WeeklyCadenceRow } from "@/lib/api/questionnaire-client";
import {
  currentIsoWeekStart,
  promptShownPatch,
  shouldShowWeeklyCheckIn,
  skipPatch,
} from "@/lib/questionnaire/weekly-cadence";

/**
 * T046 — weekly cadence: ISO-week start, first-visit eligibility, completion suppression,
 * first-skip re-prompt, second-skip suppression, and abandoned-Q2 (cadence unchanged).
 */

function row(over: Partial<WeeklyCadenceRow> = {}): WeeklyCadenceRow {
  return {
    id: "c1",
    userId: "u1",
    isoWeekStart: "2026-06-29",
    promptCount: 0,
    skippedCount: 0,
    lastPromptedAt: null,
    completedAt: null,
    ...over,
  };
}

describe("currentIsoWeekStart", () => {
  it("returns the Monday of the local week (Tuesday → prior Monday)", () => {
    expect(currentIsoWeekStart(new Date(2026, 5, 30))).toBe("2026-06-29"); // Tue 30 → Mon 29
  });
  it("a Monday returns itself", () => {
    expect(currentIsoWeekStart(new Date(2026, 5, 29))).toBe("2026-06-29");
  });
  it("a Sunday returns the SAME week's Monday (not the next)", () => {
    expect(currentIsoWeekStart(new Date(2026, 6, 5))).toBe("2026-06-29"); // Sun Jul 5 → Mon Jun 29
  });
});

describe("shouldShowWeeklyCheckIn", () => {
  it("shows on the first authenticated visit (no cadence row yet)", () => {
    expect(shouldShowWeeklyCheckIn(null)).toBe(true);
  });
  it("does not show once completed", () => {
    expect(shouldShowWeeklyCheckIn(row({ completedAt: "2026-06-29T10:00:00Z" }))).toBe(false);
  });
  it("re-prompts after the first skip", () => {
    expect(shouldShowWeeklyCheckIn(row({ skippedCount: 1 }))).toBe(true);
  });
  it("suppresses after the second skip until next week", () => {
    expect(shouldShowWeeklyCheckIn(row({ skippedCount: 2 }))).toBe(false);
  });
  it("suppresses after it has been shown twice (prompt_count cap — calm-first)", () => {
    expect(shouldShowWeeklyCheckIn(row({ promptCount: 1 }))).toBe(true);
    expect(shouldShowWeeklyCheckIn(row({ promptCount: 2 }))).toBe(false);
  });
  it("an abandoned Q2 leaves the row unchanged → still due", () => {
    // Abandon writes nothing: prompt_count may be 1, but skipped_count/completed_at are unchanged.
    expect(shouldShowWeeklyCheckIn(row({ promptCount: 1, skippedCount: 0, completedAt: null }))).toBe(true);
  });
});

describe("cadence patches never carry answer values", () => {
  it("promptShownPatch increments prompt_count and stamps the time", () => {
    const patch = promptShownPatch(row({ promptCount: 0 }), "u1", "2026-06-29", "2026-06-29T09:00:00Z");
    expect(patch).toEqual({
      userId: "u1",
      isoWeekStart: "2026-06-29",
      promptCount: 1,
      lastPromptedAt: "2026-06-29T09:00:00Z",
    });
  });

  it("skipPatch increments skipped_count and caps at 2", () => {
    expect(skipPatch(null, "u1", "2026-06-29").skippedCount).toBe(1);
    expect(skipPatch(row({ skippedCount: 1 }), "u1", "2026-06-29").skippedCount).toBe(2);
    expect(skipPatch(row({ skippedCount: 2 }), "u1", "2026-06-29").skippedCount).toBe(2);
  });

  it("patches carry no sentiment/roadblock/support keys", () => {
    const skip = skipPatch(null, "u1", "2026-06-29");
    const prompt = promptShownPatch(null, "u1", "2026-06-29", "t");
    for (const k of ["sentiment", "roadblock", "support"]) {
      expect(k in skip).toBe(false);
      expect(k in prompt).toBe(false);
    }
  });
});
