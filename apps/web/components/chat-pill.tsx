"use client";

import { ChevronDown, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { endChat, loadCurrentConversation } from "@/app/(authed)/app/chat/actions";
import { ChatShell, type PanelChatState } from "@/components/chat/chat-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ConversationDetail } from "@/lib/api/chat-client";
import { BOT_NAME } from "@/lib/chat/constants";
import { OPEN_CHAT_PILL_EVENT } from "@/lib/chat/pill-launcher";

/**
 * Height of the rendered pill in px. Still exported so notification.tsx can read the
 * `--chat-pill-offset` stacking convention (the runtime contract is the CSS variable
 * on `<html>`, not this constant).
 */
export const CHAT_PILL_HEIGHT = 48;

/**
 * Persistent bottom-right "Talk to Ren" pill for employees (FR-012/013). Desktop
 * shows the label plus the ✦ mark; mobile is icon-only with
 * `aria-label="Talk to Ren"` and a ≥44px target. Clicking opens a fixed-size compact
 * panel (FR-014) — continue the current chat, start a new one, or open full history;
 * NO conversation switcher inside the panel. Feature 011 wires the previously no-op
 * placeholder — additive, as its earlier comment foresaw.
 *
 * Side effect: writes `--chat-pill-offset` onto `<html>` on mount for notification
 * stacking; removes it on unmount.
 */
export function ChatPill() {
  // The pill floats on every employee page EXCEPT /app/chat — there you're already inside
  // the full chat workspace, so a floating "talk now" shortcut is redundant and overlaps
  // the composer (FR-012/013). Suppress it on that route only.
  const pathname = usePathname();
  const suppressed = pathname === "/app/chat";

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  // The live active-conversation state reported up by the embedded shell — read at the
  // moment the × is pressed (a ref, so reporting it never re-renders the pill).
  const panelStateRef = useRef<PanelChatState>({ conversationId: null, canEnd: false });

  const handlePanelState = useCallback((state: PanelChatState) => {
    panelStateRef.current = state;
  }, []);

  // Open a FRESH chat in place when the home "Recent chats" card asks (its "+ New chat"),
  // rather than the card deep-linking to /app/chat. Expands from the nub onto a blank
  // composer; the row is created lazily on the first send.
  const openFresh = useCallback(() => {
    setDetail(null);
    setLoading(false);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (suppressed) return;
    window.addEventListener(OPEN_CHAT_PILL_EVENT, openFresh);
    return () => window.removeEventListener(OPEN_CHAT_PILL_EVENT, openFresh);
  }, [suppressed, openFresh]);

  useEffect(() => {
    // No pill on the chat route → no offset to reserve for notification stacking.
    if (suppressed) return;
    const html = document.documentElement;
    html.style.setProperty("--chat-pill-offset", `${CHAT_PILL_HEIGHT}px`);
    return () => {
      html.style.removeProperty("--chat-pill-offset");
    };
  }, [suppressed]);

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    const res = await loadCurrentConversation();
    setLoading(false);
    // The backend is the single source of truth for "current": its
    // get_current_conversation excludes finalized (ended) chats, so after an end this
    // resolves to null → a fresh composer, even across a navigation/remount. No
    // client-side "skip the reload" flag to carry. An unfinished chat still resumes.
    setDetail(res.ok ? res.data : null);
  }

  // MINIMIZE: collapse to the nub, conversation stays live (reopening resumes it).
  function handleMinimize() {
    setOpen(false);
  }

  // × END: an empty/already-ended chat has nothing to finalize, so it just collapses
  // (no confirm); a chat with messages asks for a calm confirm first.
  function handleEndRequest() {
    if (!panelStateRef.current.canEnd) {
      setOpen(false);
      return;
    }
    setConfirmingEnd(true);
  }

  // Confirmed end: finalize via the SAME endChat action the /app/chat page uses
  // (auto-title + rollup lock), then collapse. Reopening starts fresh because the
  // backend no longer reports the finalized chat as "current" (see handleOpen) — there
  // is no client flag to survive a remount.
  async function handleEndConfirmed() {
    const id = panelStateRef.current.conversationId;
    setConfirmingEnd(false);
    if (id) await endChat(id);
    setDetail(null);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // While the end-confirm is up, Escape cancels the confirm (handled by the dialog),
      // not the whole panel.
      if (e.key === "Escape" && !confirmingEnd) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, confirmingEnd]);

  // Hooks above run unconditionally (rules of hooks); the route guard returns after them.
  if (suppressed) return null;

  if (open) {
    return (
      <>
        <div
          role="dialog"
          aria-label={`Chat with ${BOT_NAME}`}
          data-testid="chat-pill-panel"
          className="fixed bottom-4 right-4 z-50 flex h-[min(480px,82vh)] w-[min(384px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-soft"
        >
          {/* Standard chat-widget header controls. Minimize (chevron) keeps the chat live
              and drops to the nub; × ends it. Both are 44px effective touch targets with
              small glyphs so they stay light in the compact header. */}
          <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Minimize"
              data-testid="pill-minimize"
              onClick={handleMinimize}
              className="grid h-11 w-11 place-items-center rounded-md text-muted hover:bg-bg hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foggy"
            >
              <ChevronDown aria-hidden className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              aria-label="End chat"
              data-testid="pill-end"
              onClick={handleEndRequest}
              className="grid h-11 w-11 place-items-center rounded-md text-muted hover:bg-bg hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foggy"
            >
              <X aria-hidden className="h-[18px] w-[18px]" />
            </button>
          </div>
          {loading ? (
            <p className="m-auto text-sm text-muted">Loading…</p>
          ) : (
            <ChatShell
              variant="panel"
              initialConversations={[]}
              initialDetail={detail}
              onPanelStateChange={handlePanelState}
            />
          )}
        </div>

        {/* Calm end confirmation (NOT crimson — ending saves to history, it isn't
            destructive). Radix gives focus-trap + Escape-to-cancel; the ink confirm is
            visibly distinct from the destructive delete dialog used elsewhere. */}
        <Dialog open={confirmingEnd} onOpenChange={(o) => !o && setConfirmingEnd(false)}>
          <DialogContent data-testid="end-confirm" className="max-w-sm">
            <DialogHeader>
              <DialogTitle>End this chat?</DialogTitle>
              <DialogDescription>
                It&apos;ll be saved to your history.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmingEnd(false)}>
                Not now
              </Button>
              <Button onClick={() => void handleEndConfirmed()}>End chat</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Talk to ${BOT_NAME}`}
      data-testid="chat-pill"
      onClick={() => void handleOpen()}
      // FOGGY AS REN'S ENTRY POINT (constitution Amendment 19). This control exists only
      // to open Ren, and after Amendment 18 a meadow pill opened a foggy panel — the same
      // incoherence the chat-surface exception exists to prevent, one level out. The
      // permission reaches THIS CONTROL, not the page it floats over: a dashboard hosting
      // this pill keeps meadow for its own actions.
      //
      // The mode-inversion below is UNCHANGED IN SHAPE — only the hue moved, and every
      // ratio improved:
      //  • LIGHT — filled foggy with near-white text (text-on-accent = 5.3:1, up from
      //    meadow's 4.7:1).
      //  • DARK — an OUTLINED chip, not a fill: surface background + foggy border + foggy
      //    icon/text (7.7:1, up from meadow's 6.8:1). A FILL in dark washes the near-white
      //    text out (~1.9:1 on meadow) regardless of hue; the outline reads clearly and
      //    tappably against the near-black page, so the inversion stays.
      className="fixed bottom-4 right-4 z-40 inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-foggy px-5 font-display text-sm font-semibold text-on-accent shadow-soft transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foggy focus-visible:ring-offset-2 cursor-pointer dark:border dark:border-foggy dark:bg-surface dark:text-foggy"
    >
      <Sparkles aria-hidden className="h-5 w-5 shrink-0" />
      <span className="sr-only md:not-sr-only">Talk to {BOT_NAME}</span>
    </button>
  );
}
