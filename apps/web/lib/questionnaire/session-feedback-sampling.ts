import type { SessionFeedbackSamplingPolicy } from "@/lib/questionnaire/types";

/**
 * Feature 012 / US2 — the session-end feedback sampling seam.
 *
 * v1 offers the product-feedback card after EVERY monitoring session. This module is the
 * single documented seam where a later release can reduce frequency (e.g. every Nth session
 * or a probability) WITHOUT touching the card or the coordinator — they only ask this
 * function whether to offer feedback for a given ended session.
 */

export const SESSION_END_FEEDBACK_SAMPLING_POLICY: SessionFeedbackSamplingPolicy = "every_session";

export interface SessionEndSamplingContext {
  /** 1-based count of ended monitoring sessions for this user (reserved for later sampling). */
  sessionIndex?: number;
}

/**
 * Whether to offer the session-end feedback card for a just-ended session. v1 returns true
 * for every session (the `every_session` policy); the context is accepted now so a future
 * sampling policy can read it without changing call sites.
 */
export function shouldOfferSessionEndFeedback(context: SessionEndSamplingContext = {}): boolean {
  // v1 ignores the context (every session); reading it keeps the seam live for a later policy.
  void context.sessionIndex;
  return SESSION_END_FEEDBACK_SAMPLING_POLICY === "every_session";
}
