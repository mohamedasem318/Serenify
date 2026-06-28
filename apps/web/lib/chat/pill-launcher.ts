/**
 * Cross-surface signal for the floating "Talk to Ren" pill.
 *
 * The pill lives in the authed layout (`components/chat-pill.tsx`) while the home
 * "Recent chats" card lives down in the page tree — they have no shared React state.
 * So the card's "+ New chat" asks the pill to expand from its nub and start a fresh
 * chat IN PLACE via a window event, instead of deep-linking to /app/chat. The pill
 * listens for this event and opens a blank composer.
 *
 * A named event + a typed helper keep the contract in one spot (no stringly-typed
 * `dispatchEvent` scattered across components).
 */

export const OPEN_CHAT_PILL_EVENT = "serenify:open-chat-pill";

/** Ask the mounted chat pill to open and start a fresh chat (blank composer). */
export function openChatPillFresh(): void {
  window.dispatchEvent(new Event(OPEN_CHAT_PILL_EVENT));
}
