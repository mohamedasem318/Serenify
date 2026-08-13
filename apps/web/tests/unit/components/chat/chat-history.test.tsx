import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe("chat history sidebar (US4)", () => {
  it("shows an ended conversation's title and rollup band label", () => {
    const ended = conv("c1", "A heavy week at work", { state: "ended", rollupBand: "a_little_tense" });
    render(<ChatShell variant="page" initialConversations={[ended]} initialDetail={{ conversation: ended, messages: [] }} />);
    expect(screen.getByText("A heavy week at work")).toBeInTheDocument();
    expect(screen.getByText("uneasy")).toBeInTheDocument();
  });

  it("renames a conversation consistently", async () => {
    (actions.renameChat as Mock).mockResolvedValue({ ok: true, data: conv("c1", "Trouble sleeping") });
    const c = conv("c1", "Old title");
    const user = userEvent.setup();
    render(<ChatShell variant="page" initialConversations={[c]} initialDetail={{ conversation: c, messages: [] }} />);

    await user.click(screen.getByRole("button", { name: /rename conversation/i }));
    const input = screen.getByRole("textbox", { name: /rename conversation/i });
    await user.clear(input);
    await user.type(input, "Trouble sleeping{Enter}");

    await waitFor(() => expect(actions.renameChat).toHaveBeenCalledWith("c1", "Trouble sleeping"));
    await waitFor(() => expect(screen.getByText("Trouble sleeping")).toBeInTheDocument());
  });

  it("opens a mobile history drawer and closes it when a chat is selected (FR-016 responsive)", async () => {
    (actions.loadConversation as Mock).mockResolvedValue({
      ok: true,
      data: { conversation: conv("c2", "Second"), messages: [] },
    });
    const first = conv("c1", "First");
    const user = userEvent.setup();
    render(
      <ChatShell
        variant="page"
        initialConversations={[first, conv("c2", "Second")]}
        initialDetail={{ conversation: first, messages: [] }}
      />,
    );

    // No drawer until the history control is tapped (the desktop sidebar is hidden < md).
    expect(screen.queryByRole("dialog", { name: /conversation history/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /conversation history/i }));

    const drawer = screen.getByRole("dialog", { name: /conversation history/i });
    await user.click(within(drawer).getByText("Second"));

    await waitFor(() => expect(actions.loadConversation).toHaveBeenCalledWith("c2"));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /conversation history/i })).toBeNull(),
    );
  });

  it("confirms a destructive delete before removing the conversation", async () => {
    (actions.deleteChat as Mock).mockResolvedValue({ ok: true, data: undefined });
    const c = conv("c1", "To remove");
    const user = userEvent.setup();
    render(<ChatShell variant="page" initialConversations={[c]} initialDetail={{ conversation: c, messages: [] }} />);

    await user.click(screen.getByRole("button", { name: /delete conversation/i }));
    expect(await screen.findByText("Delete this chat?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(actions.deleteChat).toHaveBeenCalledWith("c1"));
  });
});
