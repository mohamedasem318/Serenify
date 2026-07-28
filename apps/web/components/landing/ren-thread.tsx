"use client";

import { useEffect, useState } from "react";

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
 *
 * ── THE TYPEWRITER, AND WHY IT CANNOT REFLOW (2026-07-28) ──────────────────────────────
 *
 * The person's messages type in character by character and Ren shows a typing indicator
 * before each reply — the messaging-app shape. The danger is obvious: a growing element
 * inside a box whose whole guarantee is that nothing moves.
 *
 * THE BUBBLE RESERVES ITS FINAL SIZE AND FILLS IN. Each animating bubble is a 1×1 CSS grid
 * holding TWO children in the SAME cell: an `invisible` copy of the complete message, which
 * is what the grid measures, and the partially-revealed text painted over it. The box is
 * therefore the finished box from the first character, and the revealed prefix wraps
 * exactly where the finished text wraps because both are laid out at the same width. No
 * width animates, no height animates, and the tallest state a bubble ever reaches is the
 * state it starts in — so the worst case for clipping is the FINISHED thread, which is the
 * case the layout spec already measures at every width.
 *
 * REN'S INDICATOR IS THE ONE THING THAT DOES CHANGE SIZE, and it only ever grows TOWARD
 * that same already-measured worst case: a compact three-dot bubble becomes the full reply
 * in the same slot. It is a slot, never a fifth list item, so the cap and the no-scroll
 * rule are untouched and the panel's maximum content is unchanged.
 *
 * REDUCED MOTION IS NOT A SLOWER VERSION, IT IS ABSENCE. Every message is simply present:
 * no typing, no indicator, and — load-bearing — no dependence on a timer having fired, so
 * a reduced-motion visitor stepping through with the chapter markers sees complete text at
 * every beat.
 *
 * THE ANSWER ARRIVES AS A PROP RATHER THAN BEING ASKED FOR AGAIN. `use-story-clock.ts` is
 * the ONE landing module allowed to query the OS motion preference, and T099 asserts
 * exactly that by scanning this directory's source — so a second `useMediaQuery` call here
 * would not merely duplicate the subscription, it would create a second answer that could
 * disagree with the clock's on the render where they resolve. The clock already computes
 * it and the card already holds it; this component is handed the result. (That guard is a
 * plain substring scan which reads comments too, which is why this paragraph describes the
 * query rather than spelling it.) framer-motion's `useReducedMotion` is forbidden
 * throughout — it snapshots at mount and would miss the mid-session toggle ST-5 tests.
 *
 * THE INDICATOR IS AN ANIMATION, NOT COPY, so it is `aria-hidden` and is never announced.
 * Each bubble carries its complete text in an `sr-only` span from the moment it mounts and
 * the animated layers are hidden from assistive technology entirely — so a screen reader
 * gets each message once, statically, and hears nothing as it types. A live region would
 * have re-announced a growing string on every frame, which is the failure mode this shape
 * exists to avoid.
 */

export interface ThreadMessage {
  readonly from: "ren" | "person";
  readonly messageKey: keyof typeof REN_MESSAGES;
}

/** Per-character cadence. The longest person line finishes in ~0.9s, well inside its beat. */
const CHAR_MS = 18;
/** How long Ren "thinks" before replying — the mock's own dwell on the same beats. */
const REN_THINKING_MS = 900;

/** The three-dot indicator. Decorative: `aria-hidden`, never rendered under reduced motion. */
function TypingDots() {
  return (
    <span aria-hidden className="flex items-center gap-1 py-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1 animate-pulse rounded-full bg-muted"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

export function RenThread({
  messages,
  reducedMotion,
}: {
  messages: readonly ThreadMessage[];
  /** From the story clock, the one landing module that reads the query (T099). */
  reducedMotion: boolean;
}) {
  const visible = trimThread(messages, THREAD_CAP);

  const last = visible[visible.length - 1];
  const lastKey = last?.messageKey;
  const lastFrom = last?.from;

  /** Identity of the newest message. Slot is included so a repeat after a clear restarts. */
  const signature = lastKey ? `${lastKey}:${visible.length}` : "";

  /**
   * The animation, as one value. Phase and progress travel together so they cannot be set
   * in two steps and render a frame that is both "thinking" and half-typed.
   */
  const [anim, setAnim] = useState<{
    readonly key: string;
    readonly phase: "thinking" | "typing" | "done";
    readonly shown: number;
  }>({ key: "", phase: "done", shown: 0 });

  /*
   * DERIVED DURING RENDER, NOT IN AN EFFECT. React's sanctioned "adjust state when a prop
   * changes" pattern: it re-renders before committing, so the browser never paints the
   * stale frame. Doing this in an effect would paint the previous message's finished state
   * for one frame and would set state synchronously on every beat — a cascading render the
   * repo's lint rule rejects, and rightly. Every write below this point happens inside a
   * timeout instead, which is what makes the effect's only job scheduling.
   *
   * The reduced-motion clause is what handles a MID-SESSION toggle: flipping it on while a
   * line is typing lands here on the next render and finishes the message immediately,
   * rather than leaving the visitor watching the animation they just asked to stop.
   */
  const wantsAnimation = Boolean(lastKey) && !reducedMotion;
  if (anim.key !== signature || (!wantsAnimation && anim.phase !== "done")) {
    setAnim({
      key: signature,
      phase: !wantsAnimation ? "done" : lastFrom === "ren" ? "thinking" : "typing",
      shown: 0,
    });
  }

  useEffect(() => {
    if (anim.key !== signature || anim.phase === "done" || !lastKey) return;

    if (anim.phase === "thinking") {
      const timer = setTimeout(() => {
        setAnim((current) =>
          current.key === signature && current.phase === "thinking"
            ? { ...current, phase: "done" }
            : current,
        );
      }, REN_THINKING_MS);
      return () => clearTimeout(timer);
    }

    // One character, one timeout. A chain rather than an interval, so the cleanup cancels
    // exactly one pending tick and a beat change cannot leave a second chain running
    // alongside the new one.
    const total = REN_MESSAGES[lastKey].length;
    const timer = setTimeout(() => {
      setAnim((current) => {
        if (current.key !== signature || current.phase !== "typing") return current;
        const next = current.shown + 1;
        return next >= total
          ? { ...current, phase: "done", shown: total }
          : { ...current, shown: next };
      });
    }, CHAR_MS);
    return () => clearTimeout(timer);
  }, [anim, signature, lastKey]);

  const thinking = anim.key === signature && anim.phase === "thinking";
  const revealed = anim.key === signature && anim.phase === "typing" ? anim.shown : null;

  return (
    <ul
      data-testid="ren-thread"
      className="flex list-none flex-col gap-1.5 overflow-hidden"
      aria-label={REN_THREAD_LABEL}
    >
      {visible.map((message, position) => {
        // Position-keyed on purpose: the same message can reappear after a clear, and
        // the list is a rolling window rather than an identity-bearing collection.
        const key = `${message.messageKey}-${position}`;
        const full = REN_MESSAGES[message.messageKey];
        const isNewest = position === visible.length - 1;
        const isThinking = isNewest && thinking;
        const shown = isNewest && revealed !== null ? full.slice(0, revealed) : full;

        return (
          <li
            key={key}
            data-from={message.from}
            data-typing={isThinking ? "true" : undefined}
            className={cn(
              "max-w-[93%] rounded-lg px-2.5 py-1 text-xs leading-snug",
              message.from === "ren"
                ? "self-start bg-foggy/12 text-ink"
                : "self-end bg-bg text-ink border border-border",
            )}
          >
            {/* What assistive technology reads: the whole message, once, never re-announced. */}
            <span className="sr-only">{full}</span>

            {isThinking ? (
              <TypingDots />
            ) : (
              /*
               * The reserve-and-fill stack. Both children occupy the SAME grid cell, so
               * the cell is sized by the complete message while only the revealed prefix
               * is painted. `aria-hidden` because the `sr-only` span above already carries
               * the text — this layer is purely the animation.
               */
              <span aria-hidden className="grid">
                <span className="invisible col-start-1 row-start-1">{full}</span>
                <span className="col-start-1 row-start-1">{shown}</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
