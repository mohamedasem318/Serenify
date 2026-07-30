import React from "react";
import { useCurrentFrame } from "remotion";

import { ChatShell } from "@/components/chat/chat-shell";
import { Header } from "@/components/header/header";
import type { ChatMessage, ConversationDetail } from "@/lib/api/chat-client";

import { PROTAGONIST } from "../greybox/copy";
import { sec } from "./motion";
import { AppShell } from "./shell";

/**
 * ══ REN'S CHAT, AS THE REAL SHELL ═══════════════════════════════════════════════════
 *
 * The bubbles, the composer, the send button, Ren's avatar and header, the disclaimer and every
 * radius, colour and measure are `<ChatShell/>`'s. Nothing about the conversation surface is
 * drawn any more.
 *
 * ── TWO THINGS THE REAL COMPONENT SETTLED THAT THE SHEET HAD WRONG ──────────────────
 *
 * 1. **There is no per-bubble avatar, and there should not be one.** The sheet asks for Ren's
 *    avatar "anchored to each Ren bubble", reasoning that the squared `rounded-bl-sm` corner is
 *    where it would sit. The real surface does not do that — `<RenAvatar/>` lives in the
 *    CONVERSATION HEADER (`chat-shell.tsx:385`) beside the name and "here to listen", and the
 *    bubbles carry no avatar at all.
 *
 *    That is better for the beat, not worse. The header is on screen for the entire exchange by
 *    construction, so L8's enlarged avatar is never lost after turn 1 — which is the actual
 *    requirement the sheet was trying to meet. And ownership stops depending on a visual pairing
 *    the audience has to infer: the header says "Ren" in words, and the bubbles keep the app's
 *    own left/right, bordered/filled conventions. The one thing this beat cannot afford is
 *    ambiguity about which side is Ren, and named-in-the-header beats
 *    inferred-from-a-circle.
 *
 * 2. **The composer is real, so the restructure below is possible at all.** `handoffOpener`
 *    (`chat-shell.tsx:96`) seeds the composer's value — it exists for feature 012's confirmatory
 *    handoff, where Ren is opened with a soft opener already in the box for the user to edit.
 *    The video drives it per frame to type into the real composer rather than into a drawn one.
 *
 * ── WHY IT REMOUNTS ─────────────────────────────────────────────────────────────────
 *
 * `handoffOpener` is read into `useState` once, so a changing prop does not move the composer.
 * The wrapper therefore keys the shell on the typed length, remounting it as each character
 * lands. That is cheap here — the shell holds no animation state worth preserving and every
 * message it shows comes from `initialDetail`, which is itself computed from the frame — and it
 * is the only way to type into the real component without modifying `apps/web`.
 */

const conversation = {
  id: "video",
  title: "Checking in",
  state: "open" as const,
  rollupBand: null,
  messageCount: 0,
  lastMessageAt: null,
  createdAt: "2026-07-30T11:30:00.000Z",
  updatedAt: "2026-07-30T11:30:00.000Z",
};

export const msg = (id: string, role: ChatMessage["role"], content: string): ChatMessage => ({
  id,
  role,
  content,
  createdAt: "2026-07-30T11:30:00.000Z",
});

export const ChatPage: React.FC<{
  clock: string;
  messages: ChatMessage[];
  /** What is currently in the composer. Drives the real textarea via `handoffOpener`. */
  draft?: string;
  /** L9 — the typing indicator the app does not have. The video depicts a later feature. */
  thinking?: boolean;
  /** World-coordinate layer — the drawn cursor. */
  overlay?: React.ReactNode;
}> = ({ clock, messages, draft = "", thinking = false, overlay }) => {
  const detail: ConversationDetail = {
    conversation: { ...conversation, messageCount: messages.length },
    messages,
  };

  return (
    <AppShell
      clock={clock}
      url="serenify.tech/app/chat"
      overlay={overlay}
      header={
        <Header fullName={PROTAGONIST.fullName} email={PROTAGONIST.email} role="employee" />
      }
    >
      <div className="mx-auto h-[460px] w-full max-w-2xl overflow-hidden rounded-2xl border border-border">
        <ChatShell
          key={`draft-${draft.length}-msgs-${messages.length}`}
          variant="panel"
          initialConversations={[detail.conversation]}
          initialDetail={detail}
          handoffOpener={draft || undefined}
        />
      </div>

      {/*
       * ── L9 · THE TYPING INDICATOR ──
       *
       * The app has no typing indicator, and the sheet is explicit that this is a DECIDED
       * liberty rather than a fidelity defect: without it, Ren's `thinking` state is dead air
       * rather than a legible state. It is authored here, over the real shell, and it is
       * deliberately the only thing in this beat that is not the product's.
       */}
      {thinking && <TypingIndicator />}
    </AppShell>
  );
};

/**
 * Three dots on the app's own bubble geometry — `self-start`, bordered, `rounded-bl-sm`.
 *
 * ── AND THE DOTS MOVE, WHICH IS THE ENTIRE POINT OF THE LIBERTY ─────────────────────
 *
 * They used to carry a **static** stagger — `opacity: 0.35 + 0.45 · (1 − i/2)`, one fixed value
 * each — which is a photograph of a typing indicator. Held for 34 frames beside a completely
 * still frame, a typing indicator that does not animate is not a weaker version of the device: it
 * is three dots of different greys, and it reads as decoration rather than as a state.
 *
 * L9's whole justification is that Ren's `thinking` state is otherwise **dead air** — the liberty
 * exists to make a state legible AS a state, and only motion does that. So the stagger becomes a
 * travelling wave: the same three opacities, on a 0.9s loop, each dot a third of a cycle behind
 * the last. That is the universal form of this indicator, and the frame is what drives it, so it
 * is deterministic across a Studio scrub and a CLI render like everything else in `motion.tsx`.
 *
 * It stays the one authored thing in this beat. Everything else on screen is `<ChatShell/>`.
 */
const DOT_CYCLE = sec(0.9);

const TypingIndicator: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{ position: "absolute", left: 320, top: 300, zIndex: 5 }}
      className="flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-sm border border-border bg-surface px-3.5 py-3"
    >
      {[0, 1, 2].map((i) => {
        // Each dot is a third of a cycle behind the one before it. The triangle wave is the same
        // 0→1→0 shape the bloom's breath uses, so the two pieces of looping motion in the film
        // share an idiom.
        const phase = (((frame - (i * DOT_CYCLE) / 3) % DOT_CYCLE) + DOT_CYCLE) / DOT_CYCLE % 1;
        const tri = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
        return (
          <span
            key={i}
            className="block size-1.5 rounded-full bg-muted"
            style={{
              // The same range the static stagger spanned — 0.35 to 0.8 — now travelled rather
              // than assigned, so the indicator's resting weight is unchanged.
              opacity: 0.35 + 0.45 * tri,
              scale: 0.88 + 0.12 * tri,
            }}
          />
        );
      })}
    </div>
  );
};
