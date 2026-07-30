/**
 * Video-side shim for `@/app/(authed)/app/chat/actions`, aliased in `remotion.config.ts`.
 *
 * `components/chat/chat-shell.tsx:15` imports the chat route's **server actions**. A server
 * action module pulls `next/dist/server/…` into the bundle and fails on `@opentelemetry/api`,
 * the same way the chat pill did — and it would be pointless even if it bundled, since a video
 * frame cannot await a round-trip and stay frame-deterministic.
 *
 * Beat 10 drives the shell entirely through `initialDetail` / `initialConversations`, which are
 * props: the messages visible at frame N are computed from N. Nothing here is ever called, so
 * each export throws rather than resolving quietly — a silent no-op would let a beat "work"
 * while secretly depending on an action, and the failure would surface as a frozen frame with
 * no explanation.
 */

const unavailable = (name: string) => (): never => {
  throw new Error(
    `video/: chat server action \`${name}\` is not available in the video bundle. Beat 10 drives ` +
      `<ChatShell/> through its \`initialDetail\` prop, computed from the current frame.`,
  );
};

export const sendMessage = unavailable("sendMessage");
export const startConversation = unavailable("startConversation");
export const endChat = unavailable("endChat");
export const loadCurrentConversation = unavailable("loadCurrentConversation");
export const loadConversation = unavailable("loadConversation");
export const listConversations = unavailable("listConversations");
export const renameConversation = unavailable("renameConversation");
export const deleteConversation = unavailable("deleteConversation");
export const retryMessage = unavailable("retryMessage");
