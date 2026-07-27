"use client";

import { REN_MESSAGES, REN_THREAD_LABEL } from "@/lib/landing/copy";
import { THREAD_CAP, trimThread } from "@/lib/landing/story-script";
import { cn } from "@/lib/utils";

/**
 * Ren's conversation thread inside the `ren` panel (feature 013, US1 — T095; FR-011).
 *
 * CAPPED AT 4 VISIBLE BUBBLES WITH NO SCROLL. The oldest leaves when the cap is reached,
 * driven by `trimThread` — the same pure helper T092 exhausts against the real script, so
 * the cap is proved on the sequence that ships rather than on a fixture.
 *
 * THE CARD DOES NOT RESIZE WHEN THE THREAD TRIMS, and that holds BY CONSTRUCTION rather
 * than by care: this thread lives inside an absolutely positioned panel inside a
 * fixed-height swap area, so it is out of flow and cannot push the card's box no matter
 * how many bubbles it holds (FR-008). T106 asserts it anyway.
 *
 * THE DIALOGUE IS SCRIPTED STATIC COPY, NOT A MODEL CALL. There is no LLM on this page
 * and no network request behind it (Principle IV) — every line is a constant in
 * `lib/landing/copy.ts`.
 */

export interface ThreadMessage {
  readonly from: "ren" | "person";
  readonly messageKey: keyof typeof REN_MESSAGES;
}

export function RenThread({ messages }: { messages: readonly ThreadMessage[] }) {
  const visible = trimThread(messages, THREAD_CAP);

  return (
    <ul
      data-testid="ren-thread"
      className="flex list-none flex-col gap-1.5 overflow-hidden"
      aria-label={REN_THREAD_LABEL}
    >
      {visible.map((message, position) => (
        <li
          // Position-keyed on purpose: the same message can reappear after a clear, and
          // the list is a rolling window rather than an identity-bearing collection.
          key={`${message.messageKey}-${position}`}
          data-from={message.from}
          className={cn(
            "max-w-[93%] rounded-lg px-2.5 py-1 text-xs leading-snug",
            message.from === "ren"
              ? "self-start bg-foggy/12 text-ink"
              : "self-end bg-bg text-ink border border-border",
          )}
        >
          {REN_MESSAGES[message.messageKey]}
        </li>
      ))}
    </ul>
  );
}
