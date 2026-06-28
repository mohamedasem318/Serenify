import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OPEN_CHAT_PILL_EVENT } from "@/lib/chat/pill-launcher";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => "/app") }));
vi.mock("next/navigation", () => ({ usePathname }));
// The stub stands in for the embedded ChatShell and reports its panel state up to the
// pill the same way the real shell does — driven off the conversation the pill hands it.
vi.mock("@/components/chat/chat-shell", () => ({
  ChatShell: ({
    onPanelStateChange,
    initialDetail,
  }: {
    onPanelStateChange?: (s: { conversationId: string | null; canEnd: boolean }) => void;
    initialDetail: {
      conversation?: { id?: string; state?: string };
      messages?: unknown[];
    } | null;
  }) => {
    // Updating the pill's ref during render is safe (no setState) and mirrors the real
    // shell's effect, so the header × knows whether there's a conversation worth ending.
    onPanelStateChange?.({
      conversationId: initialDetail?.conversation?.id ?? null,
      canEnd:
        (initialDetail?.messages?.length ?? 0) > 0 &&
        (initialDetail?.conversation?.state ?? "open") === "open",
    });
    return <div data-testid="chat-shell-stub" />;
  },
}));
vi.mock("@/app/(authed)/app/chat/actions", () => ({
  loadCurrentConversation: vi.fn().mockResolvedValue({ ok: true, data: null }),
  endChat: vi.fn().mockResolvedValue({
    ok: true,
    data: { outcome: "ended", conversation: { id: "c1", state: "ended" } },
  }),
}));

const withMessages = {
  ok: true,
  data: { conversation: { id: "c1", state: "open" }, messages: [{ id: "m1" }] },
};

import { ChatPill, CHAT_PILL_HEIGHT } from "@/components/chat-pill";
import * as actions from "@/app/(authed)/app/chat/actions";

beforeEach(() => {
  vi.clearAllMocks();
  usePathname.mockReturnValue("/app");
  (actions.loadCurrentConversation as Mock).mockResolvedValue({ ok: true, data: null });
  (actions.endChat as Mock).mockResolvedValue({
    ok: true,
    data: { outcome: "ended", conversation: { id: "c1", state: "ended" } },
  });
});
afterEach(cleanup);

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("chat-pill"));
  await screen.findByTestId("chat-pill-panel");
}

describe("ChatPill — Talk to Ren (FR-012/013)", () => {
  it("exports a ≥44px height constant for the touch-target floor", () => {
    expect(CHAT_PILL_HEIGHT).toBeGreaterThanOrEqual(44);
  });

  it("renders a button with the accessible name 'Talk to Ren'", () => {
    render(<ChatPill />);
    expect(screen.getByRole("button", { name: "Talk to Ren" })).toBeInTheDocument();
    expect(screen.getByTestId("chat-pill")).toHaveAttribute("type", "button");
  });

  it("anchors bottom-right with the documented fixed-position classes", () => {
    render(<ChatPill />);
    const pill = screen.getByTestId("chat-pill");
    expect(pill.className).toMatch(/\bfixed\b/);
    expect(pill.className).toMatch(/\bbottom-4\b/);
    expect(pill.className).toMatch(/\bright-4\b/);
  });

  it("carries the aria-label so mobile stays icon-only but labelled", () => {
    render(<ChatPill />);
    expect(screen.getByRole("button", { name: "Talk to Ren" })).toHaveAttribute(
      "aria-label",
      "Talk to Ren",
    );
  });

  it("sets and removes --chat-pill-offset on <html> across mount/unmount", () => {
    const { unmount } = render(<ChatPill />);
    expect(document.documentElement.style.getPropertyValue("--chat-pill-offset")).toBe(
      `${CHAT_PILL_HEIGHT}px`,
    );
    unmount();
    expect(document.documentElement.style.getPropertyValue("--chat-pill-offset")).toBe("");
  });

  it("is suppressed on /app/chat — redundant inside the full chat workspace (FR-012/013)", () => {
    usePathname.mockReturnValue("/app/chat");
    const { container } = render(<ChatPill />);
    expect(screen.queryByTestId("chat-pill")).toBeNull();
    expect(container).toBeEmptyDOMElement();
    expect(document.documentElement.style.getPropertyValue("--chat-pill-offset")).toBe("");
  });

  it("opens a compact panel and loads the current conversation on click", async () => {
    const user = userEvent.setup();
    render(<ChatPill />);
    await user.click(screen.getByTestId("chat-pill"));
    expect(await screen.findByTestId("chat-pill-panel")).toBeInTheDocument();
    expect(actions.loadCurrentConversation).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("chat-shell-stub")).toBeInTheDocument());
  });
});

describe("ChatPill header — minimize vs end (standard chat-widget pattern)", () => {
  it("exposes two distinct controls, both ≥44px touch targets", async () => {
    const user = userEvent.setup();
    render(<ChatPill />);
    await openPanel(user);

    const minimize = screen.getByTestId("pill-minimize");
    const end = screen.getByTestId("pill-end");
    expect(minimize).toHaveAttribute("aria-label", "Minimize");
    expect(end).toHaveAttribute("aria-label", "End chat");
    for (const btn of [minimize, end]) {
      expect(btn.className).toMatch(/\bh-11\b/);
      expect(btn.className).toMatch(/\bw-11\b/);
    }
  });

  it("minimize collapses to the nub without ending the conversation", async () => {
    (actions.loadCurrentConversation as Mock).mockResolvedValue(withMessages);
    const user = userEvent.setup();
    render(<ChatPill />);
    await openPanel(user);

    await user.click(screen.getByTestId("pill-minimize"));

    expect(screen.queryByTestId("chat-pill-panel")).toBeNull();
    expect(screen.getByTestId("chat-pill")).toBeInTheDocument();
    expect(actions.endChat).not.toHaveBeenCalled();
  });

  it("× on a chat with messages opens a CALM (non-crimson) confirm, then ends via the existing end action and collapses", async () => {
    (actions.loadCurrentConversation as Mock).mockResolvedValue(withMessages);
    const user = userEvent.setup();
    render(<ChatPill />);
    await openPanel(user);

    await user.click(screen.getByTestId("pill-end"));

    const confirm = await screen.findByTestId("end-confirm");
    expect(within(confirm).getByText(/saved to your history/i)).toBeInTheDocument();
    const confirmBtn = within(confirm).getByRole("button", { name: /end chat/i });
    // Ending saves to history — it is NOT destructive, so the confirm must not be crimson.
    expect(confirmBtn.className).not.toMatch(/destructive|crimson/i);

    await user.click(confirmBtn);

    await waitFor(() => expect(actions.endChat).toHaveBeenCalledWith("c1"));
    await waitFor(() => expect(screen.queryByTestId("chat-pill-panel")).toBeNull());
    expect(screen.getByTestId("chat-pill")).toBeInTheDocument();
  });

  it("× on an EMPTY chat collapses with no confirm and no end call", async () => {
    (actions.loadCurrentConversation as Mock).mockResolvedValue({ ok: true, data: null });
    const user = userEvent.setup();
    render(<ChatPill />);
    await openPanel(user);

    await user.click(screen.getByTestId("pill-end"));

    expect(screen.queryByTestId("end-confirm")).toBeNull();
    expect(actions.endChat).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId("chat-pill-panel")).toBeNull());
    expect(screen.getByTestId("chat-pill")).toBeInTheDocument();
  });

  it("reopening after an end starts FRESH — it re-consults the backend (single source of truth)", async () => {
    (actions.loadCurrentConversation as Mock).mockResolvedValue(withMessages);
    const user = userEvent.setup();
    render(<ChatPill />);
    await openPanel(user);
    await user.click(screen.getByTestId("pill-end"));
    const confirm = await screen.findByTestId("end-confirm");
    await user.click(within(confirm).getByRole("button", { name: /end chat/i }));
    await waitFor(() => expect(actions.endChat).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId("chat-pill-panel")).toBeNull());

    // The backend's get_current_conversation now EXCLUDES the finalized chat → null on
    // reopen, so the pill lands on a fresh composer. No client-side "skip reload" flag.
    (actions.loadCurrentConversation as Mock).mockClear();
    (actions.loadCurrentConversation as Mock).mockResolvedValue({ ok: true, data: null });
    await openPanel(user);
    expect(actions.loadCurrentConversation).toHaveBeenCalled();

    // Fresh: nothing to finalize, so × collapses with no confirm and no SECOND end call.
    await user.click(screen.getByTestId("pill-end"));
    expect(screen.queryByTestId("end-confirm")).toBeNull();
    expect(actions.endChat).toHaveBeenCalledTimes(1);
  });

  it("starts fresh across a remount (navigate away and back) — freshness is the backend's job", async () => {
    // After an end + navigation the component unmounts and remounts; any client-only flag
    // would be lost. The backend reports no current chat (ended excluded) → fresh start.
    (actions.loadCurrentConversation as Mock).mockResolvedValue({ ok: true, data: null });
    const user = userEvent.setup();
    const { unmount } = render(<ChatPill />);
    unmount();
    render(<ChatPill />);

    await openPanel(user);
    expect(actions.loadCurrentConversation).toHaveBeenCalled();
    await user.click(screen.getByTestId("pill-end"));
    expect(screen.queryByTestId("end-confirm")).toBeNull();
    expect(actions.endChat).not.toHaveBeenCalled();
  });

  it("opens fresh in place when the home card asks (open-chat-pill event) — no current chat loaded", async () => {
    // The card's "+ New chat" fires this event instead of deep-linking to /app/chat.
    (actions.loadCurrentConversation as Mock).mockResolvedValue(withMessages);
    render(<ChatPill />);
    expect(screen.queryByTestId("chat-pill-panel")).toBeNull();

    act(() => {
      window.dispatchEvent(new Event(OPEN_CHAT_PILL_EVENT));
    });

    expect(await screen.findByTestId("chat-pill-panel")).toBeInTheDocument();
    // Fresh start: it does NOT resume the current conversation.
    expect(actions.loadCurrentConversation).not.toHaveBeenCalled();
  });
});
