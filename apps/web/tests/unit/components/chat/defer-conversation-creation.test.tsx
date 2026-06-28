import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/(authed)/app/chat/actions", () => ({
  createChat: vi.fn(),
  loadConversation: vi.fn(),
  loadConversations: vi.fn(),
  loadCurrentConversation: vi.fn(),
  sendChatMessage: vi.fn(),
  retryChat: vi.fn(),
  renameChat: vi.fn(),
  deleteChat: vi.fn(),
  endChat: vi.fn(),
}));

import { ChatShell } from "@/components/chat/chat-shell";
import * as actions from "@/app/(authed)/app/chat/actions";
import type { ConversationSummary } from "@/lib/api/chat-client";

function conv(id: string, title: string | null, extra: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id, title, state: "open", rollupBand: null, messageCount: 0,
    lastMessageAt: null, createdAt: "2026-06-28T00:00:00Z", updatedAt: "2026-06-28T00:00:00Z", ...extra,
  };
}
const userMsg = (content: string) => ({ id: `u-${content}`, role: "user" as const, content, createdAt: "t" });
const assistantMsg = (content: string) => ({ id: `a-${content}`, role: "assistant" as const, content, createdAt: "t" });

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe("New chat defers conversation creation until the first message (ghost-row bug)", () => {
  it("abandoning a New chat persists nothing — no DB write, no ghost row", async () => {
    // Even with a working create available, clicking New chat must not call it.
    (actions.createChat as Mock).mockResolvedValue({ ok: true, data: conv("ghost", null) });
    const existing = conv("c1", "Earlier");
    const user = userEvent.setup();
    render(
      <ChatShell
        variant="page"
        initialConversations={[existing]}
        initialDetail={{ conversation: existing, messages: [userMsg("older message")] }}
      />,
    );
    expect(screen.getByText("older message")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /new chat/i }));

    // Opened a blank composer and cleared the prior transcript…
    expect(screen.getByText(/Hi, I'm Ren/)).toBeInTheDocument();
    expect(screen.queryByText("older message")).not.toBeInTheDocument();
    // …but wrote nothing: no conversation created, and the list still holds exactly the
    // one pre-existing row (each row carries a "Delete conversation" control, so the
    // delete-button count is the row count).
    expect(actions.createChat).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: /delete conversation/i })).toHaveLength(1);
  });

  it("the first message of a blank New chat creates exactly one conversation, then sends to it", async () => {
    (actions.createChat as Mock).mockResolvedValue({ ok: true, data: conv("new1", null) });
    (actions.sendChatMessage as Mock).mockResolvedValue({
      ok: true,
      data: {
        outcome: "ok",
        userMessage: userMsg("first message"),
        assistantMessage: assistantMsg("hi there"),
        crisis: null,
        rollupBand: null,
        conversation: conv("new1", null, { messageCount: 1, lastMessageAt: "t" }),
        retryAfterSeconds: null,
      },
    });
    const user = userEvent.setup();
    render(<ChatShell variant="page" initialConversations={[]} initialDetail={null} />);

    // No conversation exists yet on a blank composer.
    expect(screen.queryAllByRole("button", { name: /delete conversation/i })).toHaveLength(0);
    expect(actions.createChat).not.toHaveBeenCalled();

    await user.type(screen.getByTestId("chat-composer-input"), "first message");
    await user.click(screen.getByTestId("chat-send"));

    await waitFor(() => expect(screen.getByText("hi there")).toBeInTheDocument());
    expect(actions.createChat).toHaveBeenCalledTimes(1);
    expect(actions.sendChatMessage).toHaveBeenCalledWith("new1", "first message");
  });
});
