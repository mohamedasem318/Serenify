import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

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
import { CHAT_DISCLAIMER } from "@/lib/chat/constants";

afterEach(cleanup);

describe("persistent AI companion disclaimer (FR-018)", () => {
  it("is the exact approved copy", () => {
    expect(CHAT_DISCLAIMER).toBe("Ren is an AI companion, not a substitute for professional care.");
  });

  it("shows on the full page surface, including the empty state", () => {
    render(<ChatShell variant="page" initialConversations={[]} initialDetail={null} />);
    expect(screen.getByTestId("chat-disclaimer")).toHaveTextContent(CHAT_DISCLAIMER);
  });

  it("shows on the compact pill panel surface", () => {
    render(<ChatShell variant="panel" initialConversations={[]} initialDetail={null} />);
    expect(screen.getByTestId("chat-disclaimer")).toHaveTextContent(CHAT_DISCLAIMER);
  });
});
