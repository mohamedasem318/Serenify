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
import type { ConversationDetail, ConversationSummary } from "@/lib/api/chat-client";

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

describe("ChatShell page", () => {
  it("shows the Ren greeting empty state when there are no messages", () => {
    render(<ChatShell variant="page" initialConversations={[]} initialDetail={null} />);
    expect(screen.getByText(/Hi, I'm Ren/)).toBeInTheDocument();
    expect(screen.getByTestId("chat-disclaimer")).toBeInTheDocument();
  });

  it("renders persisted history (resume continuity)", () => {
    const detail: ConversationDetail = {
      conversation: conv("c1", "A heavy week"),
      messages: [
        { id: "m1", role: "user", content: "rough day", createdAt: "t1" },
        { id: "m2", role: "assistant", content: "I'm listening.", createdAt: "t2" },
      ],
    };
    render(<ChatShell variant="page" initialConversations={[detail.conversation]} initialDetail={detail} />);
    expect(screen.getByText("rough day")).toBeInTheDocument();
    expect(screen.getByText("I'm listening.")).toBeInTheDocument();
  });

  it("switches conversation from the sidebar via the load action", async () => {
    (actions.loadConversation as Mock).mockResolvedValue({
      ok: true,
      data: { conversation: conv("c2", "Second"), messages: [{ id: "x", role: "assistant", content: "switched in", createdAt: "t" }] },
    });
    const detail: ConversationDetail = { conversation: conv("c1", "First"), messages: [] };
    const user = userEvent.setup();
    render(
      <ChatShell variant="page" initialConversations={[conv("c1", "First"), conv("c2", "Second")]} initialDetail={detail} />,
    );
    await user.click(screen.getByText("Second"));
    expect(actions.loadConversation).toHaveBeenCalledWith("c2");
    await waitFor(() => expect(screen.getByText("switched in")).toBeInTheDocument());
  });

  it("renders the live crisis panel when a send returns one", async () => {
    (actions.sendChatMessage as Mock).mockResolvedValue({
      ok: true,
      data: {
        outcome: "ok",
        userMessage: { id: "u", role: "user", content: "help", createdAt: "t" },
        assistantMessage: { id: "a", role: "assistant", content: "I'm really glad you told me.", createdAt: "t" },
        crisis: {
          resources: [{ country: "EG", name: "Hotline", number: "16328", url: null, lastChecked: "2026-06-28" }],
          universalLine: "If you're in immediate danger, contact your local emergency services right away.",
          emergencyNumber: "123",
        },
        rollupBand: null,
        conversation: conv("c1", null),
        retryAfterSeconds: null,
      },
    });
    const detail: ConversationDetail = { conversation: conv("c1", null), messages: [] };
    const user = userEvent.setup();
    render(<ChatShell variant="page" initialConversations={[conv("c1", null)]} initialDetail={detail} />);
    await user.type(screen.getByTestId("chat-composer-input"), "help");
    await user.click(screen.getByTestId("chat-send"));
    await waitFor(() => expect(screen.getByTestId("crisis-panel")).toBeInTheDocument());
    expect(screen.getByText("16328")).toBeInTheDocument();
  });
});
