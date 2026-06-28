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
vi.mock("@/lib/chat/pill-launcher", () => ({ openChatPillFresh: vi.fn() }));

import { RecentChatsCard } from "@/components/home/recent-chats-card";
import * as actions from "@/app/(authed)/app/chat/actions";
import * as launcher from "@/lib/chat/pill-launcher";

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

  it("opens the chat pill in a fresh state instead of deep-linking to /app/chat", async () => {
    (actions.createChat as Mock).mockResolvedValue({ ok: true, data: { ...rows[0], id: "new1", title: null } });
    const user = userEvent.setup();
    render(<RecentChatsCard />);
    await screen.findByText("A heavy week at work");

    await user.click(screen.getByRole("button", { name: /new chat/i }));
    // "+ New chat" no longer navigates — it asks the floating pill to open fresh IN PLACE
    // (stay on the home dashboard). No empty conversation is written; the row is created
    // later by the first message in the pill's shell.
    expect(launcher.openChatPillFresh).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(actions.createChat).not.toHaveBeenCalled();
  });

  it("opens a conversation from its row", async () => {
    const user = userEvent.setup();
    render(<RecentChatsCard />);
    await user.click(await screen.findByText("A heavy week at work"));
    expect(push).toHaveBeenCalledWith("/app/chat?c=c1");
  });

  it("caps the visible list at ~5 rows and scrolls the rest inside the card", async () => {
    // Seven conversations — more than the ~5 the card shows before scrolling, so the
    // list must become a bounded, internally-scrolling region rather than growing the
    // card unbounded.
    const many = Array.from({ length: 7 }, (_, i) => ({
      ...rows[0],
      id: `c${i}`,
      title: `Conversation ${i}`,
    }));
    (actions.loadConversations as Mock).mockResolvedValue({ ok: true, data: many });
    render(<RecentChatsCard />);
    await screen.findByText("Conversation 0");

    // All seven render — the card never truncates the data; height + scroll is the limiter.
    expect(screen.getByText("Conversation 6")).toBeInTheDocument();

    // The LIST is the bounded scroll region (the header stays fixed above it); its max-h
    // is sized to ~5 rows so the 6th onward scroll inside the card.
    const list = screen.getByTestId("recent-chats-list");
    expect(list.className).toMatch(/overflow-y-auto/);
    expect(list.className).toContain("max-h-[22rem]");
  });
});
