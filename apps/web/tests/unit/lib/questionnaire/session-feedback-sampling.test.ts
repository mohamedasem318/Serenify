import { describe, expect, it } from "vitest";

import {
  SESSION_END_FEEDBACK_SAMPLING_POLICY,
  shouldOfferSessionEndFeedback,
} from "@/lib/questionnaire/session-feedback-sampling";

/**
 * T038 — the v1 session-end feedback sampling seam. The policy is `every_session`, and the
 * decision function returns true for every ended session. The future seam (a context arg) is
 * accepted now so a later sampling policy needs no call-site changes.
 */

describe("session-end feedback sampling seam", () => {
  it("v1 policy is every_session", () => {
    expect(SESSION_END_FEEDBACK_SAMPLING_POLICY).toBe("every_session");
  });

  it("offers feedback after every session, regardless of context", () => {
    expect(shouldOfferSessionEndFeedback()).toBe(true);
    expect(shouldOfferSessionEndFeedback({})).toBe(true);
    expect(shouldOfferSessionEndFeedback({ sessionIndex: 1 })).toBe(true);
    expect(shouldOfferSessionEndFeedback({ sessionIndex: 99 })).toBe(true);
  });
});
