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
import type { ConversationDetail } from "@/lib/api/chat-client";

const openConv = {
  id: "conv1",
  title: null,
  state: "open" as const,
  rollupBand: null,
  messageCount: 0,
  lastMessageAt: null,
  createdAt: "2026-06-28T00:00:00Z",
  updatedAt: "2026-06-28T00:00:00Z",
};

const detail: ConversationDetail = { conversation: openConv, messages: [] };

function renderShell() {
  return render(<ChatShell variant="page" initialConversations={[openConv]} initialDetail={detail} />);
}

function userMsg(content: string) {
  return { id: `u-${content}`, role: "user" as const, content, createdAt: "t" };
}
function assistantMsg(content: string) {
  return { id: `a-${content}`, role: "assistant" as const, content, createdAt: "t" };
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe("chat composer", () => {
  it("sends a message and shows exactly one user bubble (no duplicate)", async () => {
    (actions.sendChatMessage as Mock).mockResolvedValue({
      ok: true,
      data: {
        outcome: "ok",
        userMessage: userMsg("I'm swamped"),
        assistantMessage: assistantMsg("That sounds heavy."),
        crisis: null,
        rollupBand: null,
        conversation: openConv,
        retryAfterSeconds: null,
      },
    });
    const user = userEvent.setup();
    renderShell();
    await user.type(screen.getByTestId("chat-composer-input"), "I'm swamped");
    await user.click(screen.getByTestId("chat-send"));

    await waitFor(() => expect(screen.getByText("That sounds heavy.")).toBeInTheDocument());
    expect(screen.getAllByText("I'm swamped")).toHaveLength(1);
  });

  it("locks the composer while a send is in flight (FR-032a)", async () => {
    let resolve!: (v: unknown) => void;
    (actions.sendChatMessage as Mock).mockReturnValue(new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    renderShell();
    const input = screen.getByTestId("chat-composer-input");
    await user.type(input, "hello");
    await user.click(screen.getByTestId("chat-send"));

    expect(input).toBeDisabled();
    resolve({ ok: true, data: { outcome: "ok", userMessage: userMsg("hello"), assistantMessage: assistantMsg("hi"), crisis: null, rollupBand: null, conversation: openConv, retryAfterSeconds: null } });
    await waitFor(() => expect(input).not.toBeDisabled());
  });

  it("restores the typed text and shows a calm slow-down on rate limit (FR-059)", async () => {
    (actions.sendChatMessage as Mock).mockResolvedValue({
      ok: true,
      data: { outcome: "rate_limited", userMessage: null, assistantMessage: null, crisis: null, rollupBand: null, conversation: null, retryAfterSeconds: 10 },
    });
    const user = userEvent.setup();
    renderShell();
    const input = screen.getByTestId("chat-composer-input") as HTMLTextAreaElement;
    await user.type(input, "again and again");
    await user.click(screen.getByTestId("chat-send"));

    await waitFor(() => expect(screen.getByText(/take a breath/i)).toBeInTheDocument());
    expect(input.value).toBe("again and again"); // not lost
    expect(screen.queryByText(/again and again/, { selector: "div" })).not.toBeInTheDocument();
  });

  it("keeps the user message and offers retry when Ren fails (FR-052/054)", async () => {
    (actions.sendChatMessage as Mock).mockResolvedValue({
      ok: true,
      data: { outcome: "assistant_failed", userMessage: userMsg("I need help"), assistantMessage: null, crisis: null, rollupBand: null, conversation: openConv, retryAfterSeconds: null },
    });
    (actions.retryChat as Mock).mockResolvedValue({
      ok: true,
      data: { outcome: "ok", userMessage: null, assistantMessage: assistantMsg("I'm here."), crisis: null, rollupBand: null, conversation: null, retryAfterSeconds: null },
    });
    const user = userEvent.setup();
    renderShell();
    await user.type(screen.getByTestId("chat-composer-input"), "I need help");
    await user.click(screen.getByTestId("chat-send"));

    await waitFor(() => expect(screen.getByText(/had trouble replying/i)).toBeInTheDocument());
    expect(screen.getByText("I need help")).toBeInTheDocument(); // not lost

    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("I'm here.")).toBeInTheDocument());
  });
});
