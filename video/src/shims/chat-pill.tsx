/**
 * Video-side shim for `@/components/chat-pill`, aliased in `remotion.config.ts`.
 *
 * `components/notification.tsx` — which the confirmatory prompt and the weekly card both
 * render through — imports exactly ONE thing from the chat pill: the `CHAT_PILL_HEIGHT`
 * constant it uses to keep a toast clear of the pill. The pill itself imports
 * `@/app/(authed)/app/chat/actions`, a **server-action** module, and that drags
 * `next/dist/server/lib/trace` into the bundle, which fails on `@opentelemetry/api`.
 *
 * So the shim re-exports the constant and nothing else. It is the cheapest possible
 * boundary: one number, no behaviour, and `apps/web` is untouched (the video is downstream
 * of the product — see the beat sheet's component-pass constraints).
 *
 * KEEP THIS IN SYNC BY VALUE, NOT BY IMPORT. Importing the real module is what the shim
 * exists to avoid, so there is no way to derive the number here. It is 48 in
 * `apps/web/components/chat-pill.tsx:27`.
 */
export const CHAT_PILL_HEIGHT = 48;

/** Never rendered in the video — the pill is not in any beat. Present so the module shape matches. */
export const ChatPill: React.FC = () => null;
