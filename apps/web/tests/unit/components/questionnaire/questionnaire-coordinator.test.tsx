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
  it("shows session-end feedback (not weekly) for a just-ended session, then weekly after it resolves", async () => {
    const user = userEvent.setup();
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

    // Resolve session-end (Skip) → the weekly check-in becomes eligible.
    await user.click(screen.getByRole("button", { name: /Skip/ }));
    expect(await screen.findByTestId("weekly-check-in")).toBeInTheDocument();
    expect(screen.queryByTestId("session-end-feedback")).toBeNull();
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
