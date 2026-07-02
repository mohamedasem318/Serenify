import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/app/(authed)/app/chat/actions", () => ({
  createChat: vi.fn(),
  loadConversation: vi.fn(),
  sendChatMessage: vi.fn(),
  retryChat: vi.fn(),
  renameChat: vi.fn(),
  deleteChat: vi.fn(),
  endChat: vi.fn(),
}));

import { ChatShell } from "@/components/chat/chat-shell";
import {
  CONFIRMATORY_HANDOFF_SHOWS_RECOMMENDATIONS,
  confirmatoryHandoffOpener,
  isConfirmatoryHandoff,
} from "@/lib/chat/confirmatory-handoff";

/**
 * T031 — the Ren handoff seams. A confirmatory `confirmed` answer opens Ren via
 * `?handoff=confirmatory_yes`; `opened_chat` (the "Maybe" answer) via
 * `?handoff=confirmatory_maybe`. Both open a plain chat with a soft opener prefilled and
 * NEVER surface recommendation cards (FR: Ren handoff has no recommendations).
 */

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe("confirmatory handoff seam parsing", () => {
  it("accepts exactly the two confirmatory seams", () => {
    expect(isConfirmatoryHandoff("confirmatory_yes")).toBe(true);
    expect(isConfirmatoryHandoff("confirmatory_maybe")).toBe(true);
    expect(isConfirmatoryHandoff("recommendations")).toBe(false);
    expect(isConfirmatoryHandoff(undefined)).toBe(false);
    expect(isConfirmatoryHandoff("")).toBe(false);
  });

  it("provides a non-empty soft opener for each seam", () => {
    expect(confirmatoryHandoffOpener("confirmatory_yes").trim().length).toBeGreaterThan(0);
    expect(confirmatoryHandoffOpener("confirmatory_maybe").trim().length).toBeGreaterThan(0);
    // The two openers differ — "yes" confirmed tension vs "maybe" unsure.
    expect(confirmatoryHandoffOpener("confirmatory_yes")).not.toBe(
      confirmatoryHandoffOpener("confirmatory_maybe"),
    );
  });

  it("documents that the handoff never carries recommendation cards", () => {
    expect(CONFIRMATORY_HANDOFF_SHOWS_RECOMMENDATIONS).toBe(false);
  });
});

describe("ChatShell handoff opener", () => {
  it("prefills the composer with the confirmed opener and shows no recommendation cards", () => {
    render(
      <ChatShell
        initialConversations={[]}
        initialDetail={null}
        handoffOpener={confirmatoryHandoffOpener("confirmatory_yes")}
      />,
    );
    const composer = screen.getByTestId("chat-composer-input") as HTMLTextAreaElement;
    expect(composer.value).toBe(confirmatoryHandoffOpener("confirmatory_yes"));
    // No recommendation surface is ever mounted on the handoff path.
    expect(screen.queryByTestId("recommendation-cards")).toBeNull();
    expect(screen.queryByText(/recommend/i)).toBeNull();
  });

  it("prefills the composer with the maybe opener", () => {
    render(
      <ChatShell
        initialConversations={[]}
        initialDetail={null}
        handoffOpener={confirmatoryHandoffOpener("confirmatory_maybe")}
      />,
    );
    const composer = screen.getByTestId("chat-composer-input") as HTMLTextAreaElement;
    expect(composer.value).toBe(confirmatoryHandoffOpener("confirmatory_maybe"));
  });

  it("renders an empty composer with no opener (normal entry unchanged)", () => {
    render(<ChatShell initialConversations={[]} initialDetail={null} />);
    const composer = screen.getByTestId("chat-composer-input") as HTMLTextAreaElement;
    expect(composer.value).toBe("");
  });
});
