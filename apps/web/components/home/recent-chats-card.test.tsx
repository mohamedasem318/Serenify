import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/app/(authed)/app/chat/actions", () => ({
  loadConversations: vi.fn(),
  createChat: vi.fn(),
  renameChat: vi.fn(),
  deleteChat: vi.fn(),
}));

import { RecentChatsCard } from "@/components/home/recent-chats-card";
import * as actions from "@/app/(authed)/app/chat/actions";

const rows = [
  {
    id: "c1", title: "A heavy week at work", state: "ended" as const, rollupBand: "tense" as const,
    messageCount: 6, lastMessageAt: "2026-06-27T10:00:00Z", createdAt: "2026-06-27T09:00:00Z", updatedAt: "2026-06-27T10:00:00Z",
  },
];

// Calm-voice rubric (Principle V): no exclamation marks, no alarmist/clinical words.
// "tense" is the approved band label, not on the blocklist.
const ALARMIST_BLOCKLIST = ["stress", "stressed", "warning", "alert", "alarm", "abnormal", "elevated", "concerning", "danger"];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  (actions.loadConversations as Mock).mockResolvedValue({ ok: true, data: rows });
});
afterEach(cleanup);

describe("RecentChatsCard (FR-015/015a)", () => {
  it("renders the 'Recent chats' heading", async () => {
    render(<RecentChatsCard />);
    expect(screen.getByText(/Recent chats/i)).toBeInTheDocument();
    await screen.findByText("A heavy week at work");
  });

  it("renders a conversation row with its title and rollup band", async () => {
    render(<RecentChatsCard />);
    expect(await screen.findByText("A heavy week at work")).toBeInTheDocument();
    expect(screen.getByText("tense")).toBeInTheDocument();
  });

  it("keeps the calm voice — no exclamation marks or alarmist words", async () => {
    render(<RecentChatsCard />);
    await screen.findByText("A heavy week at work");
    const text = (document.body.textContent ?? "").toLowerCase();
    expect(text).not.toMatch(/!/);
    for (const word of ALARMIST_BLOCKLIST) {
      expect(text, `blocklist hit: "${word}"`).not.toMatch(new RegExp(`\\b${word}\\b`, "i"));
    }
  });

  it("collapses and remembers the state browser-local", async () => {
    const user = userEvent.setup();
    render(<RecentChatsCard />);
    await screen.findByText("A heavy week at work");

    await user.click(screen.getByRole("button", { name: /hide recent chats/i }));
    expect(screen.getByText(/your chats with Ren are still here/i)).toBeInTheDocument();
    expect(localStorage.getItem("serenify.recentChats.collapsed")).toBe("1");
  });

  it("opens a blank New chat without persisting a row (creation defers to first send)", async () => {
    (actions.createChat as Mock).mockResolvedValue({ ok: true, data: { ...rows[0], id: "new1", title: null } });
    const user = userEvent.setup();
    render(<RecentChatsCard />);
    await screen.findByText("A heavy week at work");

    await user.click(screen.getByRole("button", { name: /new chat/i }));
    // No empty conversation is written; we just land on a fresh composer (?new=1), and
    // the row is created later by the first message (in the chat shell).
    expect(actions.createChat).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/app/chat?new=1");
  });

  it("opens a conversation from its row", async () => {
    const user = userEvent.setup();
    render(<RecentChatsCard />);
    await user.click(await screen.findByText("A heavy week at work"));
    expect(push).toHaveBeenCalledWith("/app/chat?c=c1");
  });

  it("caps height and scrolls the list once chats accumulate past ~6 rows", async () => {
    // Eight conversations — more than the ~6 the card shows before scrolling, so the
    // list must become a bounded, internally-scrolling region rather than growing the
    // card unbounded.
    const many = Array.from({ length: 8 }, (_, i) => ({
      ...rows[0],
      id: `c${i}`,
      title: `Conversation ${i}`,
    }));
    (actions.loadConversations as Mock).mockResolvedValue({ ok: true, data: many });
    render(<RecentChatsCard />);
    await screen.findByText("Conversation 0");

    // All eight render — the card no longer truncates to 6; height + scroll is the limiter.
    expect(screen.getByText("Conversation 7")).toBeInTheDocument();

    // The LIST is the bounded scroll region (the header stays fixed above it).
    const list = screen.getByTestId("recent-chats-list");
    expect(list.className).toMatch(/overflow-y-auto/);
    expect(list.className).toMatch(/max-h-/);
  });
});
