"use client";

import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
import { openChatPillFresh } from "@/lib/chat/pill-launcher";
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
  // `null` means the query has NOT resolved yet (#201). `[]` is reserved for a resolved,
  // genuinely-empty answer — the two must never share a value, because the definitive
  // "you haven't started a chat yet" copy is only true once the server has said so.
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  // A resolved failure is its own terminal state (#201): the fetch crosses the Azure API
  // before Supabase, so a transient miss must not masquerade as "no chats".
  const [loadFailed, setLoadFailed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ConversationSummary | null>(null);

  // Every setState lives inside the async callback (never synchronously in the
  // effect — react-hooks/set-state-in-effect), and the rows are client-loaded, so
  // timestamps never render server-side.
  const fetchConversations = useCallback(() => {
    void loadConversations().then((res) => {
      // Keep a generous "recent" window (full browsing lives on /app/chat). The card no
      // longer truncates to ~6 — its height is capped and the list scrolls internally
      // (below), so this slice only bounds the DOM, it isn't the visible limiter.
      if (res.ok) setConversations(res.data.slice(0, 20));
      else setLoadFailed(true);
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    });
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Retry is an event handler, so it MAY reset state synchronously: back to the
  // unresolved shape (skeleton), then the same fetch as mount.
  function retryLoad() {
    setLoadFailed(false);
    setConversations(null);
    fetchConversations();
  }

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  // "+ New chat" opens the floating pill in place (fresh, blank composer) instead of
  // deep-linking to /app/chat — staying on the home dashboard. The row is still created
  // lazily by the first message in the pill's shell, so an abandoned New chat leaves no
  // ghost row. (Opening an EXISTING row from the list below still navigates to /app/chat.)
  function handleNewChat() {
    openChatPillFresh();
  }

  async function submitRename(id: string) {
    const title = renameDraft.trim();
    setRenamingId(null);
    if (!title) return;
    const res = await renameChat(id, title);
    if (res.ok) {
      setConversations((list) => list?.map((c) => (c.id === id ? res.data : c)) ?? list);
    }
  }

  async function confirmDelete() {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    const res = await deleteChat(target.id);
    if (res.ok) setConversations((list) => list?.filter((c) => c.id !== target.id) ?? list);
  }

  return (
    // No `h-full`: the card sizes to its own content and is height-capped via the list
    // below, so it stays an independent fixed-size block — it is NOT yoked to the
    // "Things that might help" card's height (that card grows on its own in later
    // features). `overflow-hidden` keeps the scrolling list clipped to the rounded card.
    <Card className="overflow-hidden" data-testid="recent-chats-card">
      {/* px-6 matches the shared CardHeader's p-6, so this card's header text starts on
          the same x as the sibling cards' (#178) — the bespoke px-4 sat 8px inside them,
          which the 4px-tolerance alignment check in employee-dashboard-shell.spec.ts
          measures. The row still fits at 360px: everything but the (sm+-only) caption is
          shrink-0 and sums well under the narrowed width. */}
      <div className="flex items-center gap-2 border-b border-border px-6 py-3 sm:py-4">
        {/* Below sm the title is the shrinkable item (truncating gracefully) so the two
            controls survive even a 320px viewport under the wider px-6 inset; at sm+ it
            is shrink-0 again and the caption is what gives way, as before. */}
        <h3 className="min-w-0 shrink truncate font-display text-xl text-ink sm:shrink-0">
          Recent chats
        </h3>
        {/* The "with Ren" caption is the first thing to drop at 360px so the title and
            actions never collide; it returns at sm where the row has room. */}
        <span className="hidden truncate text-[13px] text-muted sm:inline">with {BOT_NAME}</span>
        {/* Compact chip (matches the mock) so it stays proportionate to the header at every
            width; on mobile a transparent ::before slop keeps the tap target ≥44px without
            inflating the visible button. */}
        {/* FOGGY, DELIBERATELY: this control exists only to open Ren (the floating pill,
            via openChatPillFresh), so it wears Ren's colour — foggy marks Ren-entry
            affordances and nothing else (Amendments 18/19; same reasoning as chat-pill.tsx).
            It also unhooks the button from meadow, which DOES encode the at-ease band in
            the BandChip rows directly below. Foggy text passes small-text AA on its own:
            5.1:1 on surface / 4.8:1 on the bg hover wash (light), 7.7:1 (dark). */}
        <button
          onClick={handleNewChat}
          className="relative ml-auto flex shrink-0 items-center gap-1.5 rounded-lg border border-foggy px-2.5 py-1 text-[12.5px] font-semibold text-foggy hover:bg-bg active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foggy max-sm:before:absolute max-sm:before:inset-x-0 max-sm:before:-inset-y-2.5 max-sm:before:content-['']"
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
        <p className="px-6 py-4 text-[13px] text-muted">
          Hidden — your chats with {BOT_NAME} are still here.
        </p>
      ) : loadFailed ? (
        // Resolved-error (#201): its own copy, its own retry — never the definitive
        // empty-state text, which would misreport an API miss as "no chats".
        <p className="px-6 py-5 text-sm leading-relaxed text-muted" data-testid="recent-chats-error">
          Your chats didn&apos;t load just now. They&apos;re still saved.{" "}
          <button
            type="button"
            data-testid="recent-chats-retry"
            onClick={retryLoad}
            className="font-semibold text-meadow-text underline underline-offset-4 hover:no-underline active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Try again
          </button>
        </p>
      ) : conversations === null ? (
        // Unresolved (#201): a skeleton in the list's own shape, not the empty-state
        // copy. `animate-pulse` is infinite, which the global reduced-motion rule pins
        // to one iteration — it simply sits static there.
        <div className="p-2" role="status" data-testid="recent-chats-loading">
          <span className="sr-only">Loading your chats</span>
          <div aria-hidden className="animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-2 px-4 py-3">
                <div className="h-3.5 w-2/5 rounded bg-border" />
                <div className="h-3 w-1/4 rounded bg-border/70" />
              </div>
            ))}
          </div>
        </div>
      ) : conversations.length === 0 ? (
        <p className="px-6 py-5 text-sm leading-relaxed text-muted">
          You haven&apos;t started a chat yet. When you do, threads stay here so you can
          pick them back up.
        </p>
      ) : (
        // Only the LIST scrolls — the header above stays fixed. max-h shows at most ~5
        // rows (a sliver of the 6th peeks as a scroll affordance); beyond that the list
        // scrolls inside the card instead of growing it.
        <ul className="max-h-[22rem] overflow-y-auto p-2" data-testid="recent-chats-list">
          {conversations.map((c) => (
            <li
              key={c.id}
              className="group flex cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 hover:bg-bg"
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
                    className="w-full rounded-md border border-control bg-surface px-1.5 py-0.5 text-[15px] text-ink outline-none focus-visible:border-meadow focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-meadow"
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
