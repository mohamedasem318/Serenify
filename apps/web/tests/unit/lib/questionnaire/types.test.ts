import { describe, expect, it } from "vitest";

import {
  CONFIRMATORY_AGGREGATE_TREATMENTS,
  CONFIRMATORY_EXPIRY_REASONS,
  CONFIRMATORY_LIFECYCLES,
  CONFIRMATORY_OUTCOMES,
  SESSION_FEEDBACK_ACTION_TARGETS,
  SESSION_FEEDBACK_REASONS,
  SESSION_FEEDBACK_SENTIMENTS,
  SESSION_FEEDBACK_STATUSES,
  WEEKLY_ROADBLOCKS,
  WEEKLY_SENTIMENTS,
  WEEKLY_SUPPORTS,
  aggregateTreatmentFor,
  actionTargetForReason,
  isConfirmatoryExpiryReason,
  isConfirmatoryOutcome,
  isSessionFeedbackReason,
  isSessionFeedbackSentiment,
  isWeeklyRoadblock,
  isWeeklySentiment,
  isWeeklySupport,
} from "@/lib/questionnaire/types";

/**
 * T025 — the shared questionnaire enums/guards are the single client-side mirror of the
 * data-model.md enumerations and the migration CHECK constraints. A drift here is a
 * Principle VII failure: the UI would persist a value the DB rejects (or vice-versa).
 * These assertions pin every enum value 1:1 to `specs/012-questionnaire-feedback/data-model.md`.
 */

describe("confirmatory enumerations match data-model.md", () => {
  it("outcome = confirmed | false_alarm | opened_chat", () => {
    expect([...CONFIRMATORY_OUTCOMES].sort()).toEqual(
      ["confirmed", "false_alarm", "opened_chat"].sort(),
    );
  });

  it("lifecycle = visible | answered | expired", () => {
    expect([...CONFIRMATORY_LIFECYCLES].sort()).toEqual(
      ["answered", "expired", "visible"].sort(),
    );
  });

  it("expiry_reason = signal_drop | session_end", () => {
    expect([...CONFIRMATORY_EXPIRY_REASONS].sort()).toEqual(["session_end", "signal_drop"].sort());
  });

  it("aggregate_treatment = none | exclude_or_down_weight", () => {
    expect([...CONFIRMATORY_AGGREGATE_TREATMENTS].sort()).toEqual(
      ["exclude_or_down_weight", "none"].sort(),
    );
  });

  it("guards reject foreign values", () => {
    expect(isConfirmatoryOutcome("confirmed")).toBe(true);
    expect(isConfirmatoryOutcome("dismissed")).toBe(false);
    expect(isConfirmatoryExpiryReason("signal_drop")).toBe(true);
    expect(isConfirmatoryExpiryReason("timeout")).toBe(false);
  });

  it("aggregateTreatmentFor marks ONLY false_alarm for down-weighting", () => {
    expect(aggregateTreatmentFor("false_alarm")).toBe("exclude_or_down_weight");
    expect(aggregateTreatmentFor("confirmed")).toBe("none");
    expect(aggregateTreatmentFor("opened_chat")).toBe("none");
  });
});

describe("session-feedback enumerations match data-model.md", () => {
  it("status = submitted | skipped", () => {
    expect([...SESSION_FEEDBACK_STATUSES].sort()).toEqual(["skipped", "submitted"].sort());
  });

  it("sentiment = good | off", () => {
    expect([...SESSION_FEEDBACK_SENTIMENTS].sort()).toEqual(["good", "off"].sort());
  });

  it("reason = suggestion_didnt_help | needed_quiet | ren_too_robotic | something_else", () => {
    expect([...SESSION_FEEDBACK_REASONS].sort()).toEqual(
      ["needed_quiet", "ren_too_robotic", "something_else", "suggestion_didnt_help"].sort(),
    );
  });

  it("action_target = preferences | notifications | ack_only", () => {
    expect([...SESSION_FEEDBACK_ACTION_TARGETS].sort()).toEqual(
      ["ack_only", "notifications", "preferences"].sort(),
    );
  });

  it("guards reject foreign values", () => {
    expect(isSessionFeedbackReason("ren_too_robotic")).toBe(true);
    expect(isSessionFeedbackReason("too_chatty")).toBe(false);
    expect(isSessionFeedbackSentiment("off")).toBe(true);
    expect(isSessionFeedbackSentiment("bad")).toBe(false);
  });

  it("actionTargetForReason routes each reason to its derived action", () => {
    expect(actionTargetForReason("suggestion_didnt_help")).toBe("preferences");
    expect(actionTargetForReason("needed_quiet")).toBe("notifications");
    // ren_too_robotic and free text are employee-private — acknowledge only, never routed.
    expect(actionTargetForReason("ren_too_robotic")).toBe("ack_only");
    expect(actionTargetForReason("something_else")).toBe("ack_only");
  });
});

describe("weekly enumerations match data-model.md", () => {
  it("sentiment = good | could_be_better", () => {
    expect([...WEEKLY_SENTIMENTS].sort()).toEqual(["could_be_better", "good"].sort());
  });

  it("roadblock = three options", () => {
    expect([...WEEKLY_ROADBLOCKS].sort()).toEqual(
      [
        "software_or_tools_crashing",
        "unclear_instructions_or_goals",
        "waiting_on_other_team_members",
      ].sort(),
    );
  });

  it("support = four options", () => {
    expect([...WEEKLY_SUPPORTS].sort()).toEqual(
      [
        "better_team_alignment_or_communication",
        "better_technical_equipment",
        "deadline_flexibility",
        "quieter_workspace",
      ].sort(),
    );
  });

  it("guards reject foreign values", () => {
    expect(isWeeklySentiment("could_be_better")).toBe(true);
    expect(isWeeklySentiment("great")).toBe(false);
    expect(isWeeklyRoadblock("software_or_tools_crashing")).toBe(true);
    expect(isWeeklyRoadblock("too_many_meetings")).toBe(false);
    expect(isWeeklySupport("quieter_workspace")).toBe(true);
    expect(isWeeklySupport("more_coffee")).toBe(false);
  });
});
