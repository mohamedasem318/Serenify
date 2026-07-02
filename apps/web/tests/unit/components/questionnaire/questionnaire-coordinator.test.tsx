import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

// Stub the authenticated client so card actions / cadence loads never hit the network.
vi.mock("@/lib/api/questionnaire-client", () => ({
  getWeeklyCadence: vi.fn(async () => null),
  saveSessionFeedback: vi.fn(async () => ({ ok: true, data: { id: "f" } })),
  submitWeeklyCheckin: vi.fn(async () => ({ ok: true, data: null })),
  upsertWeeklyCadence: vi.fn(async () => ({ ok: true, data: null })),
}));

import {
  QuestionnaireCoordinator,
  decideQuestionnaireSurface,
} from "@/components/questionnaire/questionnaire-coordinator";
import type { WeeklyCadenceRow } from "@/lib/api/questionnaire-client";
import { QUESTIONNAIRE_RESULT_DWELL_MS } from "@/lib/questionnaire/constants";

/**
 * T052 — coordinator: confirmatory and session-end never co-occur, the prompt resolves before
 * session-end, the weekly check-in stays separate from active monitoring, and the rendering
 * priority is centralized in one pure decision function.
 */

describe("decideQuestionnaireSurface (centralized priority)", () => {
  const base = {
    monitoringActive: false,
    confirmatoryVisible: false,
    sessionEndEligible: false,
    weeklyEligible: false,
  };

  it("a visible confirmatory prompt always wins — never co-occurs with session-end", () => {
    expect(
      decideQuestionnaireSurface({ ...base, confirmatoryVisible: true, sessionEndEligible: true }),
    ).toBe("confirmatory");
  });

  it("session-end waits until monitoring has ended (prompt resolves first)", () => {
    expect(
      decideQuestionnaireSurface({ ...base, monitoringActive: true, sessionEndEligible: true }),
    ).toBe("none");
    expect(decideQuestionnaireSurface({ ...base, sessionEndEligible: true })).toBe("session_end");
  });

  it("session-end takes priority over the weekly check-in", () => {
    expect(
      decideQuestionnaireSurface({ ...base, sessionEndEligible: true, weeklyEligible: true }),
    ).toBe("session_end");
  });

  it("the weekly check-in shows only when separate from active monitoring", () => {
    expect(decideQuestionnaireSurface({ ...base, weeklyEligible: true })).toBe("weekly");
    expect(
      decideQuestionnaireSurface({ ...base, monitoringActive: true, weeklyEligible: true }),
    ).toBe("none");
  });

  it("nothing eligible → none", () => {
    expect(decideQuestionnaireSurface(base)).toBe("none");
  });
});

describe("QuestionnaireCoordinator (dashboard)", () => {
  it("Skip's own end-state message paints before the coordinator swaps to weekly after the dwell", async () => {
    // `shouldAdvanceTime` lets real wall-clock time keep flowing alongside the fake clock, so
    // Testing Library's own setTimeout-based polling (findBy/waitFor) still works normally;
    // `vi.advanceTimersByTimeAsync` below still lets us jump the dwell forward deterministically
    // instead of waiting out the real 2.5s.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      render(
        <QuestionnaireCoordinator
          userId="u1"
          takeEndedSession={() => "sess-9"}
          loadCadence={async () => null /* weekly due */}
        />,
      );

      // Session-end first — weekly is held back.
      expect(await screen.findByTestId("session-end-feedback")).toBeInTheDocument();
      expect(screen.queryByTestId("weekly-check-in")).toBeNull();

      // Resolve session-end (Skip) — its own end-state message must actually paint before
      // the coordinator swaps surfaces (the defect the result dwell fixes).
      await user.click(screen.getByRole("button", { name: /Skip/ }));
      expect(screen.getByText("No problem — another time.")).toBeInTheDocument();
      expect(screen.queryByTestId("weekly-check-in")).toBeNull();

      // Only once the dwell elapses does the coordinator swap to weekly.
      await vi.advanceTimersByTimeAsync(QUESTIONNAIRE_RESULT_DWELL_MS);
      expect(await screen.findByTestId("weekly-check-in")).toBeInTheDocument();
      expect(screen.queryByTestId("session-end-feedback")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("Good's own success message paints before the coordinator swaps to weekly after the dwell", async () => {
    // `shouldAdvanceTime` lets real wall-clock time keep flowing alongside the fake clock, so
    // Testing Library's own setTimeout-based polling (findBy/waitFor) still works normally;
    // `vi.advanceTimersByTimeAsync` below still lets us jump the dwell forward deterministically
    // instead of waiting out the real 2.5s.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      render(
        <QuestionnaireCoordinator
          userId="u1"
          takeEndedSession={() => "sess-9"}
          loadCadence={async () => null /* weekly due */}
        />,
      );

      expect(await screen.findByTestId("session-end-feedback")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /^Good/ }));
      expect(screen.getByText("Glad that helped.")).toBeInTheDocument();
      expect(screen.queryByTestId("weekly-check-in")).toBeNull();

      await vi.advanceTimersByTimeAsync(QUESTIONNAIRE_RESULT_DWELL_MS);
      expect(await screen.findByTestId("weekly-check-in")).toBeInTheDocument();
      expect(screen.queryByTestId("session-end-feedback")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ren_too_robotic's own end-state message paints before the coordinator swaps to weekly after the dwell", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      render(
        <QuestionnaireCoordinator
          userId="u1"
          takeEndedSession={() => "sess-9"}
          loadCadence={async () => null /* weekly due */}
        />,
      );

      expect(await screen.findByTestId("session-end-feedback")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Something was off/ }));
      await user.click(screen.getByRole("button", { name: /too.robotic/i }));
      expect(screen.getByText("Thanks — we'll keep refining how Ren talks.")).toBeInTheDocument();
      expect(screen.queryByTestId("weekly-check-in")).toBeNull();

      await vi.advanceTimersByTimeAsync(QUESTIONNAIRE_RESULT_DWELL_MS);
      expect(await screen.findByTestId("weekly-check-in")).toBeInTheDocument();
      expect(screen.queryByTestId("session-end-feedback")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("something_else's own end-state message paints before the coordinator swaps to weekly after the dwell", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
      render(
        <QuestionnaireCoordinator
          userId="u1"
          takeEndedSession={() => "sess-9"}
          loadCadence={async () => null /* weekly due */}
        />,
      );

      expect(await screen.findByTestId("session-end-feedback")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Something was off/ }));
      await user.click(screen.getByRole("button", { name: /Something else/i }));
      await user.type(screen.getByLabelText("Tell us what felt off"), "the timing felt random");
      await user.click(screen.getByRole("button", { name: /Send/i }));
      expect(screen.getByText("Thanks for the feedback.")).toBeInTheDocument();
      expect(screen.queryByTestId("weekly-check-in")).toBeNull();

      await vi.advanceTimersByTimeAsync(QUESTIONNAIRE_RESULT_DWELL_MS);
      expect(await screen.findByTestId("weekly-check-in")).toBeInTheDocument();
      expect(screen.queryByTestId("session-end-feedback")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the weekly check-in when no session just ended and the week is due", async () => {
    render(
      <QuestionnaireCoordinator userId="u1" takeEndedSession={() => null} loadCadence={async () => null} />,
    );
    expect(await screen.findByTestId("weekly-check-in")).toBeInTheDocument();
    expect(screen.queryByTestId("session-end-feedback")).toBeNull();
  });

  it("renders nothing when the week is already completed and no session just ended", async () => {
    const completed: WeeklyCadenceRow = {
      id: "c",
      userId: "u1",
      isoWeekStart: "2026-06-29",
      promptCount: 1,
      skippedCount: 0,
      lastPromptedAt: null,
      completedAt: "2026-06-29T10:00:00Z",
    };
    render(
      <QuestionnaireCoordinator
        userId="u1"
        takeEndedSession={() => null}
        loadCadence={async () => completed}
      />,
    );
    // Give the effect a tick to resolve, then assert nothing mounted.
    await waitFor(() => {
      expect(screen.queryByTestId("questionnaire-coordinator")).toBeNull();
    });
  });
});
