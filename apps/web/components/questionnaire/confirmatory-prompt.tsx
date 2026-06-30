"use client";

import { Activity, MessageCircle, Wind } from "lucide-react";

import { Notification } from "@/components/notification";

/**
 * Feature 012 / US1 — the mid-session confirmatory prompt.
 *
 * Rendered through the `Notification` surface with `dismissible={false}` + `nonModal` so it
 * is sticky and answer-only (no close UI, no Escape/outside dismissal) yet never traps focus
 * or makes the monitoring UI inert. Calm-first color roles (Principle V): amber on the
 * stress-confirm affordance, meadow on the "I'm okay" calm answer, foggy on "talk about it";
 * no crimson on this affective surface. Copy is signed off (contracts/confirmatory-trigger-ui).
 */

export interface ConfirmatoryPromptProps {
  open: boolean;
  onConfirm: () => void;
  onFalseAlarm: () => void;
  onOpenChat: () => void;
}

const OPTION =
  "flex w-full min-h-11 items-center gap-3 rounded-control border border-border bg-bg px-3.5 py-2.5 " +
  "text-left text-[15px] leading-snug text-ink transition-colors " +
  "hover:bg-[color-mix(in_srgb,var(--color-foggy)_8%,var(--color-surface))] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export function ConfirmatoryPrompt({
  open,
  onConfirm,
  onFalseAlarm,
  onOpenChat,
}: ConfirmatoryPromptProps) {
  return (
    <Notification
      open={open}
      // Answer-only: dismissible=false swallows every user-driven close, so this is a no-op.
      onOpenChange={() => {}}
      dismissible={false}
      nonModal
      title={
        <span className="flex items-center gap-2">
          <Activity aria-hidden className="size-[19px] shrink-0 text-amber" />
          Checking in
        </span>
      }
      body="Your signals have looked tense for a little while. Is that how you're feeling?"
    >
      <div className="flex flex-col gap-2" role="group" aria-label="How are you feeling?">
        <button type="button" onClick={onConfirm} className={OPTION}>
          <Activity aria-hidden className="size-[19px] shrink-0 text-amber" />
          Yes, that&apos;s me
        </button>
        <button type="button" onClick={onFalseAlarm} className={OPTION}>
          <Wind aria-hidden className="size-[19px] shrink-0 text-meadow" />
          No, I&apos;m okay
        </button>
        <button type="button" onClick={onOpenChat} className={OPTION}>
          <MessageCircle aria-hidden className="size-[19px] shrink-0 text-foggy" />
          Maybe — talk about it
        </button>
      </div>
    </Notification>
  );
}
