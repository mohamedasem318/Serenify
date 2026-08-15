import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `Notification` (and the shells inside it) read useMediaQuery; pin it false — desktop,
// full motion — for a stable DOM, exactly as the 012 confirmatory-prompt suite does.
vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

import { ConfirmedPickCard } from "@/components/recommendations/confirmed-pick-card";
import {
  ACTION_CLOSE,
  ACTION_PAUSE_SESSION,
  ACTION_RESUME_SESSION,
  ACTION_SHOW_ME,
  ACTION_SOMETHING_ELSE,
  CARD_DESC_CONFIRMED,
  CARD_TITLE,
  DURATION_OPENED_LABEL,
  OUTCOME_ANSWER_DIDNT_HELP,
  OUTCOME_ANSWER_HELPED,
  OUTCOME_QUESTION,
} from "@/lib/recommendations/card-strings";
import { OUTCOME_ACKNOWLEDGEMENT, type LibraryItem } from "@/lib/recommendations/library";

/**
 * T017 — the in-session `ConfirmedPickCard`.
 *
 * What is pinned here is the WRITE DISCIPLINE, because that is the part a future refactor
 * can silently break: the open-write fires exactly once on first expand and never again;
 * the outcome question is asked only after the instructions close, only once, and ignoring
 * it writes nothing; dismissing writes nothing at all; and the pause control — the second
 * entry point to feature 008's shipped handlers — writes nothing of any kind, ever.
 *
 * No fake timers are needed: this card owns no dwell and no timer. The D-6 acknowledgement
 * dwell belongs to the HOME card, which settles from an end-state to state 9; this surface
 * has no state to settle to (it is dismissible, and the home card carries the pick on).
 */

const ITEM: LibraryItem = {
  id: "test-item",
  category: "breathing_grounding",
  title: "Test item title",
  whyLine: "Test why line.",
  durationLabel: "2 min",
  steps: ["Step one.", "Step two."],
  footNote: "Test foot note.",
};

function renderCard(overrides: Partial<Parameters<typeof ConfirmedPickCard>[0]> = {}) {
  const handlers = {
    onDismiss: vi.fn(),
    onOpen: vi.fn(async () => {}),
    onOutcome: vi.fn(async () => {}),
    onPause: vi.fn(),
    onResume: vi.fn(),
  };
  const view = render(
    <ConfirmedPickCard open item={ITEM} paused={false} {...handlers} {...overrides} />,
  );
  return { ...handlers, ...view };
}

/** Every write seam the card is given. "Wrote nothing" means every one of these is untouched. */
function expectNoWrites(h: {
  onOpen: ReturnType<typeof vi.fn>;
  onOutcome: ReturnType<typeof vi.fn>;
}) {
  expect(h.onOpen).not.toHaveBeenCalled();
  expect(h.onOutcome).not.toHaveBeenCalled();
}

describe("ConfirmedPickCard — surface", () => {
  it("renders home state 4's own words, and the item verbatim", async () => {
    renderCard();
    expect(await screen.findByText(CARD_TITLE)).toBeInTheDocument();
    expect(screen.getByText(CARD_DESC_CONFIRMED)).toBeInTheDocument();
    expect(screen.getByTestId("pick-item-title")).toHaveTextContent(ITEM.title);
    expect(screen.getByTestId("pick-item-why")).toHaveTextContent(ITEM.whyLine);
    expect(screen.getByTestId("pick-item-duration")).toHaveTextContent(ITEM.durationLabel);
  });

  it("is the confirmed pick — permanently prominent (state 4), never a sixth treatment", async () => {
    renderCard();
    expect(await screen.findByTestId("pick-item")).toHaveAttribute("data-prominent", "true");
    expect(screen.getByTestId("pick-item-rail")).toBeInTheDocument();
  });

  it("is dismissible and non-modal — no scrim, and the monitoring UI stays interactive", async () => {
    renderCard();
    await screen.findByText(CARD_TITLE);
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
    expect(screen.queryByTestId("notification-overlay")).toBeNull();
  });

  it("offers no swap — the swap lives on the home card", async () => {
    renderCard();
    await screen.findByText(CARD_TITLE);
    expect(screen.queryByTestId("swap")).toBeNull();
    expect(screen.queryByText(ACTION_SOMETHING_ELSE)).toBeNull();
  });
});

describe("ConfirmedPickCard — the open-write (FR-015)", () => {
  it("fires exactly once, on the FIRST expand", async () => {
    const user = userEvent.setup();
    const h = renderCard();
    await screen.findByText(CARD_TITLE);
    expect(h.onOpen).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: ACTION_SHOW_ME }));
    expect(h.onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("pick-item-steps")).toBeInTheDocument();
  });

  it("stays at one write once the instructions are closed — the footer is the question's now", async () => {
    const user = userEvent.setup();
    const h = renderCard();
    await screen.findByText(CARD_TITLE);

    await user.click(screen.getByRole("button", { name: ACTION_SHOW_ME }));
    await user.click(screen.getByRole("button", { name: ACTION_CLOSE }));

    // Closing hands the item's footer to the outcome question, exactly as home state 5 → 6
    // does — so there is no second expand to make, and no second write to make either.
    expect(h.onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: ACTION_SHOW_ME })).toBeNull();
    expect(screen.getByTestId("outcome-prompt")).toBeInTheDocument();
  });

  it("swaps the duration pill to `opened` once used — but not while the steps are on screen", async () => {
    const user = userEvent.setup();
    renderCard();
    await screen.findByText(CARD_TITLE);
    expect(screen.getByTestId("pick-item-duration")).toHaveTextContent(ITEM.durationLabel);

    await user.click(screen.getByRole("button", { name: ACTION_SHOW_ME }));
    // Mid-instruction the duration is still the useful fact (mock panels 5/6).
    expect(screen.getByTestId("pick-item-duration")).toHaveTextContent(ITEM.durationLabel);

    await user.click(screen.getByRole("button", { name: ACTION_CLOSE }));
    expect(screen.getByTestId("pick-item-duration")).toHaveTextContent(DURATION_OPENED_LABEL);
  });

  it("does not re-write when the same card re-renders", async () => {
    const user = userEvent.setup();
    const h = renderCard();
    await screen.findByText(CARD_TITLE);

    await user.click(screen.getByRole("button", { name: ACTION_SHOW_ME }));
    await user.click(screen.getByTestId("session-pause"));

    expect(h.onOpen).toHaveBeenCalledTimes(1);
  });

  it("does not fire at all when the pick was already opened before this card mounted", async () => {
    const user = userEvent.setup();
    const h = renderCard({ openedAtMs: 1_700_000_000_000 });
    await screen.findByText(CARD_TITLE);

    await user.click(screen.getByRole("button", { name: ACTION_SHOW_ME }));

    expect(h.onOpen).not.toHaveBeenCalled();
    expect(screen.getByTestId("pick-item-steps")).toBeInTheDocument();
  });

  it("writes nothing when the card is merely looked at", async () => {
    const h = renderCard();
    await screen.findByText(CARD_TITLE);
    expectNoWrites(h);
  });
});

describe("ConfirmedPickCard — the outcome question (FR-016 / FR-031)", () => {
  async function openThenClose(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: ACTION_SHOW_ME }));
    await user.click(screen.getByRole("button", { name: ACTION_CLOSE }));
  }

  it("is not asked before the item is opened", async () => {
    renderCard();
    await screen.findByText(CARD_TITLE);
    expect(screen.queryByTestId("outcome-prompt")).toBeNull();
    expect(screen.queryByText(OUTCOME_QUESTION)).toBeNull();
  });

  it("is NEVER asked over the open instructions", async () => {
    const user = userEvent.setup();
    renderCard();
    await screen.findByText(CARD_TITLE);

    await user.click(screen.getByRole("button", { name: ACTION_SHOW_ME }));

    expect(screen.getByTestId("pick-item-steps")).toBeInTheDocument();
    expect(screen.queryByTestId("outcome-prompt")).toBeNull();
  });

  it("is asked once the instructions are closed", async () => {
    const user = userEvent.setup();
    renderCard();
    await screen.findByText(CARD_TITLE);

    await openThenClose(user);

    expect(screen.getByTestId("outcome-prompt")).toBeInTheDocument();
    expect(screen.getByText(OUTCOME_QUESTION)).toBeInTheDocument();
  });

  it("records `helped` exactly once and then stops asking", async () => {
    const user = userEvent.setup();
    const h = renderCard();
    await screen.findByText(CARD_TITLE);
    await openThenClose(user);

    await user.click(screen.getByRole("button", { name: OUTCOME_ANSWER_HELPED }));

    expect(h.onOutcome).toHaveBeenCalledTimes(1);
    expect(h.onOutcome).toHaveBeenCalledWith("helped");
    expect(screen.queryByTestId("outcome-prompt")).toBeNull();
    expect(screen.getByTestId("outcome-acknowledgement")).toHaveTextContent(
      OUTCOME_ACKNOWLEDGEMENT,
    );
  });

  it("records `didnt_help` exactly once — and it is not a swap", async () => {
    const user = userEvent.setup();
    const h = renderCard();
    await screen.findByText(CARD_TITLE);
    await openThenClose(user);

    await user.click(screen.getByRole("button", { name: OUTCOME_ANSWER_DIDNT_HELP }));

    expect(h.onOutcome).toHaveBeenCalledTimes(1);
    expect(h.onOutcome).toHaveBeenCalledWith("didnt_help");
    expect(screen.queryByTestId("swap")).toBeNull();
  });

  it("ignoring the question writes NOTHING — dismissing instead is a valid third answer", async () => {
    const user = userEvent.setup();
    const h = renderCard();
    await screen.findByText(CARD_TITLE);
    await openThenClose(user);
    expect(screen.getByTestId("outcome-prompt")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(h.onOutcome).not.toHaveBeenCalled();
    expect(h.onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("ConfirmedPickCard — dismissing writes nothing", () => {
  it("is neither a swap nor an outcome — only `onDismiss` fires", async () => {
    const user = userEvent.setup();
    const h = renderCard();
    await screen.findByText(CARD_TITLE);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(h.onDismiss).toHaveBeenCalledTimes(1);
    expectNoWrites(h);
  });
});

describe("ConfirmedPickCard — the one session control (T036 contract)", () => {
  it("is a PAUSE action while the session is live, and calls only `onPause`", async () => {
    const user = userEvent.setup();
    const h = renderCard({ paused: false });
    await screen.findByText(CARD_TITLE);

    const control = screen.getByTestId("session-pause");
    expect(control).toHaveTextContent(ACTION_PAUSE_SESSION);
    expect(control).toHaveAttribute("data-paused", "false");

    await user.click(control);

    expect(h.onPause).toHaveBeenCalledTimes(1);
    expect(h.onResume).not.toHaveBeenCalled();
  });

  it("is a RESUME action while the session is paused, and calls only `onResume`", async () => {
    const user = userEvent.setup();
    const h = renderCard({ paused: true });
    await screen.findByText(CARD_TITLE);

    const control = screen.getByTestId("session-pause");
    expect(control).toHaveTextContent(ACTION_RESUME_SESSION);
    expect(control).toHaveAttribute("data-paused", "true");

    await user.click(control);

    expect(h.onResume).toHaveBeenCalledTimes(1);
    expect(h.onPause).not.toHaveBeenCalled();
  });

  it("is ONE control, never two competing pause affordances", async () => {
    const { rerender } = renderCard({ paused: false });
    await screen.findByText(CARD_TITLE);
    expect(screen.getAllByTestId("session-pause")).toHaveLength(1);

    rerender(
      <ConfirmedPickCard
        open
        item={ITEM}
        paused
        onDismiss={vi.fn()}
        onOpen={vi.fn()}
        onOutcome={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId("session-pause")).toHaveLength(1);
    expect(screen.getByTestId("session-pause")).toHaveTextContent(ACTION_RESUME_SESSION);
  });

  it("pausing is NOT an answer — no outcome, no open-write, no dismiss", async () => {
    const user = userEvent.setup();
    const h = renderCard({ paused: false });
    await screen.findByText(CARD_TITLE);

    await user.click(screen.getByTestId("session-pause"));

    expectNoWrites(h);
    expect(h.onDismiss).not.toHaveBeenCalled();
  });

  it("stays available while the instructions are open — that is when leaving the desk is asked for", async () => {
    const user = userEvent.setup();
    const h = renderCard();
    await screen.findByText(CARD_TITLE);

    await user.click(screen.getByRole("button", { name: ACTION_SHOW_ME }));
    expect(screen.getByTestId("pick-item-steps")).toBeInTheDocument();

    await user.click(screen.getByTestId("session-pause"));

    expect(h.onPause).toHaveBeenCalledTimes(1);
    expect(h.onOutcome).not.toHaveBeenCalled();
  });
});

describe("ConfirmedPickCard — the closed card", () => {
  it("renders nothing when `open` is false", () => {
    renderCard({ open: false });
    expect(screen.queryByTestId("confirmed-pick-card")).toBeNull();
    expect(screen.queryByText(CARD_TITLE)).toBeNull();
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
