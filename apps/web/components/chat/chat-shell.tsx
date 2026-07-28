"use client";

import { History, Pencil, Plus, SendHorizontal, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  createChat,
  deleteChat,
  endChat,
  loadConversation,
  renameChat,
  retryChat,
  sendChatMessage,
} from "@/app/(authed)/app/chat/actions";
import { BandChip } from "@/components/chat/band-chip";
import { CrisisResourcePanel } from "@/components/chat/crisis-panel";
import { RenAvatar } from "@/components/chat/ren-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  ChatMessage,
  ConversationDetail,
  ConversationSummary,
  CrisisPanel,
} from "@/lib/api/chat-client";
import { BOT_NAME, CHAT_DISCLAIMER } from "@/lib/chat/constants";
import { relativeTime } from "@/lib/chat/relative-time";
import { cn } from "@/lib/utils";

type Variant = "page" | "panel";
type SendError = null | "trouble" | "rate_limited" | "end_retry" | "load_failed";

/** Panel host (the pill) state hook: the LIVE active conversation and whether it can be
 *  finalized. Lets the pill's header × end the exact conversation in view — including one
 *  lazily created after the panel opened — via the same endChat path, without the pill
 *  having to track the shell's internal state. */
export type PanelChatState = { conversationId: string | null; canEnd: boolean };

type Props = {
  variant?: Variant;
  initialConversations: ConversationSummary[];
  initialDetail: ConversationDetail | null;
  /** Panel variant only: report active-conversation state up to the host (the pill). */
  onPanelStateChange?: (state: PanelChatState) => void;
  /**
   * Feature 012 confirmatory Ren handoff: a soft opener seeded into the composer when the
   * user arrives via `?handoff=confirmatory_yes|confirmatory_maybe`. The user can edit
   * before sending; the handoff opens a plain chat and never surfaces recommendation cards.
   */
  handoffOpener?: string;
};

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      data-role={message.role}
      className={cn(
        "max-w-[74%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed",
        isUser
          ? "self-end rounded-br-sm bg-meadow text-on-accent dark:text-bg"
          : "self-start rounded-bl-sm border border-border bg-surface text-ink",
      )}
    >
      {message.content}
    </div>
  );
}

export function ChatShell({
  variant = "page",
  initialConversations,
  initialDetail,
  onPanelStateChange,
  handoffOpener,
}: Props) {
  const isPanel = variant === "panel";
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(
    initialDetail?.conversation.id ?? null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>(initialDetail?.messages ?? []);
  // A confirmatory handoff seeds the composer with a soft opener; otherwise it starts empty.
  const [input, setInput] = useState(handoffOpener ?? "");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<SendError>(null);
  const [crisis, setCrisis] = useState<CrisisPanel | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ConversationSummary | null>(null);
  // Mobile-only history overlay (the sidebar is hidden < md). Page variant only.
  const [drawerOpen, setDrawerOpen] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, crisis]);

  // Confirmatory Ren handoff: land with the composer focused, opener ready to edit/send.
  useEffect(() => {
    if (handoffOpener) composerRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on a handoff arrival
  }, []);

  // When the history drawer opens, focus its close control and let Escape dismiss it
  // (escape-routes + focus management for the overlay).
  useEffect(() => {
    if (!drawerOpen) return;
    drawerCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Panel host (pill) reporting: an empty or already-ended conversation has nothing to
  // finalize, so canEnd is false and the pill's × collapses without an end call. A
  // freshly lazy-created conversation has no row in `conversations` yet → default "open".
  useEffect(() => {
    if (!isPanel) return;
    onPanelStateChange?.({
      conversationId: activeId,
      canEnd: !!activeId && messages.length > 0 && (active?.state ?? "open") === "open",
    });
  }, [isPanel, activeId, messages.length, active?.state, onPanelStateChange]);

  function upsertConversation(summary: ConversationSummary) {
    setConversations((list) => {
      const without = list.filter((c) => c.id !== summary.id);
      return [summary, ...without].sort((a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
      );
    });
  }

  // "New chat" opens a blank composer WITHOUT a DB write — the conversation row is created
  // lazily by ensureActiveConversation() on the first message. An abandoned New chat
  // therefore leaves no ghost row in the sidebar, the recent-chats card, or the DB.
  function handleNewChat() {
    setError(null);
    setActiveId(null);
    setMessages([]);
    setCrisis(null);
    setDrawerOpen(false);
    composerRef.current?.focus();
  }

  async function handleSelect(id: string) {
    setDrawerOpen(false);
    if (id === activeId) return;
    setActiveId(id);
    setCrisis(null);
    setError(null);
    setIsLoading(true);
    const res = await loadConversation(id);
    setIsLoading(false);
    if (res.ok) setMessages(res.data.messages);
    else setError("load_failed");
  }

  async function ensureActiveConversation(): Promise<string | null> {
    if (activeId) return activeId;
    const res = await createChat();
    if (!res.ok) return null;
    setConversations((c) => [res.data, ...c]);
    setActiveId(res.data.id);
    return res.data.id;
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;
    // Lock before the lazy-create round-trip so a fast double-submit on a fresh New chat
    // can't create two conversations — the send-lock now also guards the creation point.
    setIsSending(true);

    const convId = await ensureActiveConversation();
    if (!convId) {
      setIsSending(false);
      setError("trouble");
      return;
    }

    setInput("");
    setError(null);
    const tempId = `temp-${Date.now()}`;
    const tempUser: ChatMessage = {
      id: tempId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, tempUser]);
    const res = await sendChatMessage(convId, text);
    setIsSending(false);

    if (!res.ok) {
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setInput(text);
      setError("trouble");
      return;
    }
    const data = res.data;
    if (data.outcome === "rate_limited") {
      // Nothing was persisted — drop the optimistic message, restore the draft.
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setInput(text);
      setError("rate_limited");
      return;
    }
    if (data.outcome === "assistant_failed") {
      // The user message persisted; keep it and offer a retry without retyping.
      setMessages((m) =>
        m.map((x) => (x.id === tempId && data.userMessage ? data.userMessage : x)),
      );
      setError("trouble");
      return;
    }
    setMessages((m) => [
      ...m.filter((x) => x.id !== tempId),
      ...(data.userMessage ? [data.userMessage] : []),
      ...(data.assistantMessage ? [data.assistantMessage] : []),
    ]);
    setCrisis(data.crisis ?? null);
    if (data.conversation) upsertConversation(data.conversation);
  }

  async function handleRetry() {
    if (!activeId || isSending) return;
    setError(null);
    setIsSending(true);
    const res = await retryChat(activeId);
    setIsSending(false);
    if (!res.ok || res.data.outcome !== "ok") {
      setError("trouble");
      return;
    }
    if (res.data.assistantMessage) {
      setMessages((m) => [...m, res.data.assistantMessage!]);
    }
    setCrisis(res.data.crisis ?? null);
  }

  async function handleEnd() {
    if (!activeId || isSending || !messages.length) return;
    setIsSending(true);
    const res = await endChat(activeId);
    setIsSending(false);
    if (res.ok && res.data.outcome === "ended" && res.data.conversation) {
      upsertConversation(res.data.conversation);
    } else {
      setError("end_retry");
    }
  }

  async function submitRename(id: string) {
    const title = renameDraft.trim();
    setRenamingId(null);
    if (!title) return;
    const res = await renameChat(id, title);
    if (res.ok) upsertConversation(res.data);
  }

  async function confirmDelete() {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    const res = await deleteChat(target.id);
    if (!res.ok) return;
    setConversations((list) => list.filter((c) => c.id !== target.id));
    if (activeId === target.id) {
      setActiveId(null);
      setMessages([]);
      setCrisis(null);
    }
  }

  // ── render pieces ────────────────────────────────────────────────────────

  // The disclaimer is persistent on both surfaces (FR-018), but in the fixed-size pill
  // panel it must stay quiet so it doesn't crowd the small footer — tighter size/leading.
  const disclaimer = (
    <p
      className={cn(
        "text-center text-muted",
        isPanel ? "mt-1.5 text-[11px] leading-snug" : "mt-2 text-[11.5px]",
      )}
      data-testid="chat-disclaimer"
    >
      {CHAT_DISCLAIMER}
    </p>
  );

  // The full-page hero (large avatar + paragraph + "Say hello") is right for /app/chat,
  // but inside the 340×440 pill panel it overflows into a scroll. The panel gets a
  // compact greeting that fits — the composer sitting right below IS the call to action,
  // so no separate button is needed.
  const emptyGreeting = isPanel ? (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 py-6 text-center">
      <RenAvatar size={38} />
      <p className="font-display text-[15px] text-ink">Hi, I&apos;m {BOT_NAME}</p>
      <p className="max-w-[220px] text-[13px] leading-relaxed text-muted">
        A calm place to think out loud. Start whenever you like.
      </p>
    </div>
  ) : (
    // Top-biased (not vertically centered) so the hero sits in the upper-middle of the
    // workspace instead of floating dead-center in a tall column with the composer
    // stranded far below — keeps the empty state balanced at the bounded page height.
    <div className="flex flex-col items-center gap-2 px-6 pb-8 pt-16 text-center sm:pt-20">
      <RenAvatar size={54} />
      <h3 className="font-display text-lg text-ink">Hi, I&apos;m {BOT_NAME}</h3>
      <p className="max-w-[300px] text-sm leading-relaxed text-muted">
        A calm place to think out loud whenever work feels like a lot. No pressure —
        start whenever you like.
      </p>
      <Button variant="meadow" className="mt-2" onClick={() => composerRef.current?.focus()}>
        Say hello
      </Button>
    </div>
  );

  const composer = (
    <div className="border-t border-border bg-surface p-3">
      <form
        className="flex items-end gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
      >
        <textarea
          ref={composerRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          rows={1}
          disabled={isSending}
          aria-label={`Message ${BOT_NAME}`}
          placeholder={`Tell ${BOT_NAME} what's on your mind…`}
          data-testid="chat-composer-input"
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-bg px-3.5 py-2.5 text-[15px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-meadow disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          aria-label="Send message"
          data-testid="chat-send"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-meadow text-on-accent transition-opacity disabled:opacity-50 dark:text-bg"
        >
          <SendHorizontal aria-hidden className="h-5 w-5" />
        </button>
      </form>

      {error === "rate_limited" && (
        <p role="status" className="mt-2 text-center text-[12.5px] text-muted">
          You&apos;re sending quickly — take a breath and try again in a moment.
        </p>
      )}
      {error === "trouble" && (
        <p role="status" className="mt-2 flex items-center justify-center gap-2 text-[12.5px] text-muted">
          {BOT_NAME} had trouble replying.
          <button onClick={() => void handleRetry()} className="font-semibold text-meadow-text underline">
            Try again
          </button>
        </p>
      )}
      {error === "end_retry" && (
        <p role="status" className="mt-2 flex items-center justify-center gap-2 text-[12.5px] text-muted">
          Couldn&apos;t wrap up just now.
          <button onClick={() => void handleEnd()} className="font-semibold text-meadow-text underline">
            Try again
          </button>
        </p>
      )}
      {disclaimer}
    </div>
  );

  const log = (
    <div ref={logRef} className="flex flex-1 flex-col gap-3.5 overflow-auto px-4 py-5">
      {isLoading ? (
        <p className="m-auto text-sm text-muted">Loading…</p>
      ) : messages.length === 0 ? (
        emptyGreeting
      ) : (
        messages.map((m) => <MessageBubble key={m.id} message={m} />)
      )}
      {crisis && <CrisisResourcePanel panel={crisis} />}
    </div>
  );

  const conversationHeader = (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
      {variant === "page" && (
        // Mobile-only door to the conversation list: the sidebar is hidden < md, so this
        // opens the same list as a slide-in drawer. 44px target; hidden on desktop (md+),
        // where the sidebar is always visible.
        <button
          type="button"
          aria-label="Conversation history"
          onClick={() => setDrawerOpen(true)}
          className="-ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted hover:bg-bg md:hidden"
        >
          <History aria-hidden className="h-5 w-5" />
        </button>
      )}
      <RenAvatar />
      <div className="min-w-0">
        <div className="font-display text-base font-semibold text-ink">{BOT_NAME}</div>
        <div className="text-xs text-muted">here to listen</div>
      </div>
      {variant === "page" && active && messages.length > 0 && active.state === "open" && (
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-muted"
          onClick={() => void handleEnd()}
          disabled={isSending}
        >
          End chat
        </Button>
      )}
    </div>
  );

  const main = (
    <div className="flex min-h-0 flex-1 flex-col bg-bg">
      {conversationHeader}
      {log}
      {composer}
    </div>
  );

  if (variant === "panel") {
    return (
      <div className="flex h-full flex-col">
        {main}
        <div className="flex items-center justify-between border-t border-border bg-surface px-3 py-2">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 text-[12.5px] text-muted"
          >
            <Plus aria-hidden className="h-4 w-4" /> New chat
          </button>
          <Link href="/app/chat" className="text-[12.5px] font-semibold text-meadow-text">
            Open full history →
          </Link>
        </div>
      </div>
    );
  }

  // The conversation list (New chat + the Earlier history) renders in two responsive
  // shells from this single source: the desktop sidebar (md+) and the mobile drawer
  // (< md). Defining it once keeps them from drifting (FR-016 responsive history).
  const conversationList = (
    <>
      <Button variant="outline" className="m-3.5 justify-center gap-2" onClick={handleNewChat}>
        <Plus aria-hidden className="h-4 w-4" /> New chat
      </Button>
      <div className="px-4 pb-2 text-[11px] uppercase tracking-wider text-muted">Earlier</div>
      <div className="flex-1 overflow-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted">No chats yet.</p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2.5",
                c.id === activeId ? "bg-bg" : "hover:bg-bg",
              )}
              onClick={() => void handleSelect(c.id)}
            >
              <div className="min-w-0 flex-1">
                {renamingId === c.id ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void submitRename(c.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => void submitRename(c.id)}
                    className="w-full rounded-md border border-border bg-surface px-1.5 py-0.5 text-sm text-ink outline-none"
                    aria-label="Rename conversation"
                  />
                ) : (
                  <div className="line-clamp-2 text-sm font-medium leading-snug text-ink">
                    {c.title ?? "New chat"}
                  </div>
                )}
                {/* Band + relative time stay on ONE line in the (wider) desktop sidebar:
                    nowrap (inherited) keeps the dot welded to its label and the timestamp
                    beside it. md:-scoped so the < md drawer keeps wrapping on narrow phones. */}
                <div className="mt-0.5 flex items-center gap-2 md:flex-nowrap md:whitespace-nowrap">
                  {c.rollupBand && <BandChip band={c.rollupBand} />}
                  {c.lastMessageAt && (
                    <span suppressHydrationWarning className="text-[12.5px] text-muted">
                      {relativeTime(c.lastMessageAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                <button
                  aria-label="Rename conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(c.id);
                    setRenameDraft(c.title ?? "");
                  }}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink"
                >
                  <Pencil aria-hidden className="h-3.5 w-3.5" />
                </button>
                <button
                  aria-label="Delete conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(c);
                  }}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-crimson"
                >
                  <Trash2 aria-hidden className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  // page variant — two-pane on desktop (sidebar + conversation); on mobile the sidebar
  // collapses and history opens as a drawer (below). The shell flex-1/min-h-0's into the
  // bounded height the chat page hands down; the inner log keeps its own scroll.
  return (
    <>
      <div
        className="grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-border shadow-soft md:grid-cols-[336px_1fr]"
        data-testid="chat-shell"
      >
        <aside className="hidden flex-col border-r border-border bg-surface md:flex">
          {conversationList}
        </aside>
        {main}
      </div>

      {/* Mobile history drawer (< md): same conversation list, reached from the header's
          history button. Mounted only while open so the desktop list never duplicates in
          the DOM; slides in (reduced-motion safe) with a dismiss scrim + Escape + focus. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Conversation history"
            className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col border-r border-border bg-surface shadow-soft motion-safe:animate-in motion-safe:slide-in-from-left motion-safe:duration-200"
          >
            <div className="flex items-center justify-between border-b border-border px-3.5 py-3">
              <span className="text-[11px] uppercase tracking-wider text-muted">Your chats</span>
              <button
                ref={drawerCloseRef}
                type="button"
                aria-label="Close history"
                onClick={() => setDrawerOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-bg"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>
            {conversationList}
          </div>
        </div>
      )}

      <Dialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this chat?</DialogTitle>
            <DialogDescription>
              This permanently removes the conversation and all of its messages. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
