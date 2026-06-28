"use client";

import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  deleteChat,
  loadConversations,
  renameChat,
} from "@/app/(authed)/app/chat/actions";
import { BandChip } from "@/components/chat/band-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ConversationSummary } from "@/lib/api/chat-client";
import { BOT_NAME } from "@/lib/chat/constants";
import { relativeTime } from "@/lib/chat/relative-time";

const COLLAPSE_KEY = "serenify.recentChats.collapsed";

/**
 * Home "Recent chats" card (FR-015/015a). Reads the shared chat store, renders the
 * rollup band + a CLIENT-side relative timestamp (BACKLOG #53), per-row rename/delete,
 * a browser-local collapse toggle, and a "+ New chat" action. Bands shown here come
 * ONLY from chat conversation data — never a video-derived reading (FR-045/070).
 */
export function RecentChatsCard() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ConversationSummary | null>(null);

  useEffect(() => {
    // setState happens inside the async callback (not synchronously in the effect),
    // and the rows are client-loaded, so timestamps never render server-side.
    void loadConversations().then((res) => {
      // Keep a generous "recent" window (full browsing lives on /app/chat). The card no
      // longer truncates to ~6 — its height is capped and the list scrolls internally
      // (below), so this slice only bounds the DOM, it isn't the visible limiter.
      if (res.ok) setConversations(res.data.slice(0, 20));
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    });
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  // Open a blank composer (?new=1) rather than persisting an empty conversation up front;
  // the row is created by the first message in the chat shell. Avoids the ghost "New chat"
  // row that an abandoned create used to leave in this very card.
  function handleNewChat() {
    router.push("/app/chat?new=1");
  }

  async function submitRename(id: string) {
    const title = renameDraft.trim();
    setRenamingId(null);
    if (!title) return;
    const res = await renameChat(id, title);
    if (res.ok) {
      setConversations((list) => list.map((c) => (c.id === id ? res.data : c)));
    }
  }

  async function confirmDelete() {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    const res = await deleteChat(target.id);
    if (res.ok) setConversations((list) => list.filter((c) => c.id !== target.id));
  }

  return (
    // No `h-full`: the card sizes to its own content and is height-capped via the list
    // below, so it stays an independent fixed-size block — it is NOT yoked to the
    // "Things that might help" card's height (that card grows on its own in later
    // features). `overflow-hidden` keeps the scrolling list clipped to the rounded card.
    <Card className="overflow-hidden" data-testid="recent-chats-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:py-4">
        <h3 className="shrink-0 font-display text-xl text-ink">Recent chats</h3>
        {/* The "with Ren" caption is the first thing to drop at 360px so the title and
            actions never collide; it returns at sm where the row has room. */}
        <span className="hidden truncate text-[13px] text-muted sm:inline">with {BOT_NAME}</span>
        {/* Compact chip (matches the mock) so it stays proportionate to the header at every
            width; on mobile a transparent ::before slop keeps the tap target ≥44px without
            inflating the visible button. */}
        <button
          onClick={handleNewChat}
          className="relative ml-auto flex shrink-0 items-center gap-1.5 rounded-lg border border-meadow px-2.5 py-1 text-[12.5px] font-semibold text-meadow-text hover:bg-bg max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-2.5 max-sm:before:content-['']"
        >
          <Plus aria-hidden className="h-3.5 w-3.5" /> New chat
        </button>
        <button
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Show recent chats" : "Hide recent chats"}
          className="relative grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-bg max-sm:before:absolute max-sm:before:-inset-1.5 max-sm:before:content-['']"
        >
          {collapsed ? <ChevronRight aria-hidden className="h-4 w-4" /> : <ChevronDown aria-hidden className="h-4 w-4" />}
        </button>
      </div>

      {collapsed ? (
        <p className="px-4 py-4 text-[13px] text-muted">
          Hidden — your chats with {BOT_NAME} are still here.
        </p>
      ) : conversations.length === 0 ? (
        <p className="px-4 py-5 text-sm leading-relaxed text-muted">
          You haven&apos;t started a chat yet. When you do, threads stay here so you can
          pick them back up.
        </p>
      ) : (
        // Only the LIST scrolls — the header above stays fixed. max-h comfortably fits
        // ~6 rows; beyond that the list scrolls inside the card instead of growing it.
        <ul className="max-h-[26rem] overflow-y-auto p-2" data-testid="recent-chats-list">
          {conversations.map((c) => (
            <li
              key={c.id}
              className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-bg"
              onClick={() => router.push(`/app/chat?c=${c.id}`)}
            >
              <div className="min-w-0 flex-1">
                {renamingId === c.id ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void submitRename(c.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => void submitRename(c.id)}
                    className="w-full rounded-md border border-border bg-surface px-1.5 py-0.5 text-[15px] text-ink outline-none"
                    aria-label="Rename conversation"
                  />
                ) : (
                  <div className="truncate text-[15px] font-medium text-ink">
                    {c.title ?? "New chat"}
                  </div>
                )}
                <div className="mt-0.5 flex items-center gap-2">
                  {c.rollupBand && <BandChip band={c.rollupBand} />}
                  {c.lastMessageAt && (
                    <span suppressHydrationWarning className="text-[12.5px] text-muted">
                      · {relativeTime(c.lastMessageAt)}
                    </span>
                  )}
                </div>
              </div>
              {/* Touch has no hover, so the actions stay visible on mobile (≥44px taps);
                  on desktop they fade in on row hover or keyboard focus to keep it tidy. */}
              <div className="flex shrink-0 items-center gap-0.5 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                <button
                  aria-label="Rename conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(c.id);
                    setRenameDraft(c.title ?? "");
                  }}
                  className="grid h-11 w-11 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink md:h-7 md:w-7"
                >
                  <Pencil aria-hidden className="h-3.5 w-3.5" />
                </button>
                <button
                  aria-label="Delete conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(c);
                  }}
                  className="grid h-11 w-11 place-items-center rounded-md text-muted hover:bg-surface hover:text-crimson md:h-7 md:w-7"
                >
                  <Trash2 aria-hidden className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this chat?</DialogTitle>
            <DialogDescription>
              This permanently removes the conversation and all of its messages. This
              can&apos;t be undone.
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
    </Card>
  );
}
