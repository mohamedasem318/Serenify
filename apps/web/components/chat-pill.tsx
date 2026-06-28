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
  // Set after an end so the NEXT open lands on a fresh composer instead of reloading the
  // just-finalized chat (the API still treats an ended chat as the "current" one).
  const freshNextRef = useRef(false);

  const handlePanelState = useCallback((state: PanelChatState) => {
    panelStateRef.current = state;
  }, []);

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
    if (freshNextRef.current) {
      // Reopening right after an end: start fresh (a new conversation is created lazily
      // on the first message) rather than reloading the finalized chat.
      freshNextRef.current = false;
      setDetail(null);
      return;
    }
    setLoading(true);
    const res = await loadCurrentConversation();
    setLoading(false);
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
  // (auto-title + rollup lock), then collapse. Reopening starts fresh.
  async function handleEndConfirmed() {
    const id = panelStateRef.current.conversationId;
    setConfirmingEnd(false);
    if (id) await endChat(id);
    freshNextRef.current = true;
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
              className="grid h-11 w-11 place-items-center rounded-md text-muted hover:bg-bg hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow"
            >
              <ChevronDown aria-hidden className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              aria-label="End chat"
              data-testid="pill-end"
              onClick={handleEndRequest}
              className="grid h-11 w-11 place-items-center rounded-md text-muted hover:bg-bg hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow"
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
      // Mode-inverted so the pill stays legible on both surfaces:
      //  • LIGHT — filled meadow with near-white text (text-on-accent = 4.7:1 AA; plain
      //    text-bg fell to 4.2:1 on the darker light-mode meadow and failed AA).
      //  • DARK — an OUTLINED chip, not a fill: surface background + meadow border + meadow
      //    icon/text (6.8:1 AA). A meadow fill in dark washes the near-white text out
      //    (~1.9:1); the outline reads clearly and tappably against the near-black page.
      className="fixed bottom-4 right-4 z-40 inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-full bg-meadow px-5 font-display text-sm font-semibold text-on-accent shadow-soft transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow focus-visible:ring-offset-2 cursor-pointer dark:border dark:border-meadow dark:bg-surface dark:text-meadow"
    >
      <Sparkles aria-hidden className="h-5 w-5 shrink-0" />
      <span className="sr-only md:not-sr-only">Talk to {BOT_NAME}</span>
    </button>
  );
}
