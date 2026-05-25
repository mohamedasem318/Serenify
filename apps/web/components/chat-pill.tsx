"use client";

import { MessageCircle } from "lucide-react";
import { useEffect } from "react";

/**
 * Height of the rendered pill in pixels. Exported so notification.tsx
 * (Step 8 / T051) can reference the canonical value when documenting
 * the `--chat-pill-offset` stacking convention (plan.md Decision H /
 * 📌 DECISION-11). The runtime contract is the CSS variable on
 * `<html>` — consumers MUST read `var(--chat-pill-offset, 0px)`, not
 * import this constant — but having the source-of-truth named here
 * keeps the math auditable.
 */
export const CHAT_PILL_HEIGHT = 48;

/**
 * Persistent chat pill anchored bottom-right on employee /app surfaces.
 *
 * Visual:
 *   - Single rounded-full button at fixed bottom-4 right-4.
 *   - Desktop (≥768px): icon + "Chat" label inside the same capsule.
 *   - Mobile (≤768px): label is hidden (sr-only) and the capsule
 *     collapses to a 48×48 circle — well above the 44px touch-target
 *     floor (FR-025).
 *   - bg-surface + border-border + text-meadow on the icon, matching
 *     the contracts/components.md description (Step 7).
 *
 * Click behaviour: a TRUE no-op (FR-024 / medium-fix-11). No popover,
 * no navigation, no network call, no analytics. Feature 008 wires the
 * real chatbot by attaching an onClick handler — additive, not a
 * substitution.
 *
 * Side effect (Decision H, 📌 DECISION-11): on mount, writes
 * `--chat-pill-offset: 48px` onto `<html>`. On unmount, removes the
 * property. notification.tsx (T051) reads this via
 * `bottom: calc(1rem + var(--chat-pill-offset, 0px) + 1rem)`, so on
 * manager pages where the pill is gated off (FR-035) the math
 * collapses to `bottom: 2rem` automatically via the 0px fallback.
 */
export function ChatPill() {
  useEffect(() => {
    const html = document.documentElement;
    html.style.setProperty("--chat-pill-offset", `${CHAT_PILL_HEIGHT}px`);
    return () => {
      html.style.removeProperty("--chat-pill-offset");
    };
  }, []);

  return (
    <button
      type="button"
      aria-label="Chat"
      data-testid="chat-pill"
      className="fixed bottom-4 right-4 z-40 inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 text-sm text-ink shadow-soft transition-colors hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow focus-visible:ring-offset-2 cursor-pointer"
    >
      <MessageCircle aria-hidden className="h-5 w-5 shrink-0 text-meadow" />
      <span className="sr-only md:not-sr-only">Chat</span>
    </button>
  );
}
