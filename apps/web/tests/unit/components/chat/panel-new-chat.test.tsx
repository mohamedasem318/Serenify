import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
    id, title, state: "open", rollupBand: null, messageCount: 2,
    lastMessageAt: "t", createdAt: "2026-06-28T00:00:00Z", updatedAt: "2026-06-28T00:00:00Z", ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe("pill panel 'New chat' stays in the pill (no navigation)", () => {
  it("opens a blank composer in place; 'Open full history' is the ONLY action that navigates", async () => {
    const user = userEvent.setup();
    const c = conv("c1", "Earlier");
    render(
      <ChatShell
        variant="panel"
        initialConversations={[c]}
        initialDetail={{
          conversation: c,
          messages: [{ id: "m1", role: "user", content: "older message", createdAt: "t" }],
        }}
      />,
    );
    expect(screen.getByText("older message")).toBeInTheDocument();

    // The panel exposes exactly ONE navigating action — "Open full history" → /app/chat.
    expect(screen.getByRole("link", { name: /open full history/i })).toHaveAttribute(
      "href",
      "/app/chat",
    );

    // "New chat" is a plain button (not a link). Clicking it opens a blank composer in
    // place — it does NOT navigate and writes nothing (the row is created lazily on the
    // first send).
    const newChat = screen.getByRole("button", { name: /new chat/i });
    expect(newChat).not.toHaveAttribute("href");
    await user.click(newChat);

    expect(screen.getByText(/Hi, I'm Ren/)).toBeInTheDocument();
    expect(screen.queryByText("older message")).not.toBeInTheDocument();
    expect(actions.createChat).not.toHaveBeenCalled();
  });
});
