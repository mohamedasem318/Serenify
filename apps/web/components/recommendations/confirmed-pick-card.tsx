"use client";

import { useRef, useState } from "react";

import { Notification } from "@/components/notification";
import { QuestionnaireResultIcon } from "@/components/questionnaire/questionnaire-result-icon";
import { PickItem } from "@/components/recommendations/pick-item";
import {
  BTN_BASE,
  BTN_QUIET_ON_AMBER,
  ItemActions,
  OutcomePrompt,
} from "@/components/recommendations/recommendation-card-states";
import type { PickOutcome } from "@/lib/recommendations/engine";
import {
  ACTION_PAUSE_SESSION,
  ACTION_RESUME_SESSION,
  CARD_DESC_CONFIRMED,
  CARD_TITLE,
} from "@/lib/recommendations/card-strings";
import { OUTCOME_ACKNOWLEDGEMENT, type LibraryItem } from "@/lib/recommendations/library";
import { cn } from "@/lib/utils";

/**
 * Feature 014 / US2 — the in-session confirmed pick (T017).
 *
 * This is what "Yes, that's me" resolves to from 2026-08-15 onward: instead of handing the
 * person off to Ren mid-session, the monitor answers with the pick itself, in place
 * (contracts/confirmatory-resolution.md §3, FR-010/FR-011). No navigation, no second
 * surface to find, no ceremony.
 *
 * ── Same pick, same words — by construction ─────────────────────────────────────────
 * Everything readable here comes from the same two sources home state 4 reads: the
 * `LibraryItem` (rendered verbatim through the SHARED `PickItem`) and `card-strings.ts`
 * (`CARD_TITLE` + `CARD_DESC_CONFIRMED`, which are literally the words
 * `RecommendationCardShell` paints on the home card). The two surfaces cannot drift,
 * because neither of them owns any copy (plan Risk 4).
 *
 * ── It owns no data ─────────────────────────────────────────────────────────────────
 * Pure props. No reads, no writes, no client, no clock, no engine — the host
 * (`monitoring-session.tsx`, T018) resolves the pick and supplies `onOpen` / `onOutcome`.
 * That is what lets this card be tested by driving props, and it is why the card cannot
 * write anything the host did not authorise.
 *
 * ── Hallmark (component scope; plan §UI design contract) ────────────────────────────
 * Macrostructure/nav/footer/enrichment are page-scope and skipped by rule; this is a
 * component in a system-managed project. It introduces NO new geometry: the surface is the
 * shipped `Notification` (desktop `w-80` corner card / mobile bottom sheet, stacked over the
 * chat pill via `--chat-pill-offset`), which is the exact slot the confirmatory prompt just
 * vacated (R-6). Unlike that prompt it is `dismissible` — the question has already been
 * answered, so nothing here is answer-only — and it stays `nonModal`, so the monitoring UI
 * behind it never goes inert.
 *
 * Control states: the shared tier classes carry default / hover / focus-visible / active /
 * disabled, and "loading" is a disabled control while a write is in flight. **Error and
 * success are deliberately absent** — a failed write degrades silently to what is already on
 * screen (FR-030) and success is not a button state on this surface. Documented
 * deviation-by-design, not an omission.
 *
 * Motion is entirely the `Notification`'s own enter/exit, which already collapses under
 * `prefers-reduced-motion`. This card adds none of its own.
 *
 * ── Dismissing writes NOTHING ───────────────────────────────────────────────────────
 * Not a swap, not an outcome, not a false alarm — no write of any kind. The person closing a
 * corner card is not telling us anything about the suggestion, and the home card still shows
 * the same pick in state 4 afterwards.
 *
 * ── Pausing is not an answer ────────────────────────────────────────────────────────
 * The one session control is a second entry point to feature 008's SHIPPED pause/resume
 * handlers (plan §"Pause from the in-session card"). Several library items send the person
 * away from the desk, and without this the in-session choice is ignore-it or end-the-session.
 * It is not per-item — every card exposes it — and it never touches the confirmatory
 * machinery: no finalize, no budget, no outcome, no dismiss. The SAME control becomes
 * Resume while the session is paused, so there is never a second competing pause affordance.
 */

export interface ConfirmedPickCardProps {
  /** Controlled visibility. The host shows this once the confirm has resolved to a pick. */
  open: boolean;
  /** The reviewed library entry behind the confirmed pick. Rendered verbatim (FR-004). */
  item: LibraryItem;
  /**
   * `opened_at` as the pick row already holds it. Non-null means the engagement record was
   * written before this card mounted (e.g. the person opened the item on the home card
   * first), so the open-write below is already spent and must not fire again.
   */
  openedAtMs?: number | null;
  /** The person closed the card. Writes NOTHING — neither a swap nor an outcome. */
  onDismiss: () => void;
  /** Record `opened_at`. Called AT MOST ONCE (FR-015); opening IS the engagement record. */
  onOpen: () => void | Promise<void>;
  /** Record the outcome. Called at most once; ignoring the question writes nothing (FR-016). */
  onOutcome: (outcome: PickOutcome) => void | Promise<void>;
  /** True while the monitoring session is paused — the one control becomes Resume. */
  paused: boolean;
  /** Feature 008's shipped `handlePause`, wired by the host (T018/T036). */
  onPause: () => void;
  /** Feature 008's shipped `handleResume`, wired by the host (T018/T036). */
  onResume: () => void;
}

/**
 * The ONE session control. Pause and Resume are the same affordance in two moods, never two
 * controls — and it stays QUIET (never the filled meadow) because this card's one filled
 * primary is the item's own "Show me". A second filled control would read as the card
 * pushing the person out of their session.
 *
 * It does not withdraw while the instructions are open. That is deliberate and the opposite
 * of the swap's rule: mid-instruction is exactly when someone reads "stand up and walk to a
 * window" and needs a way to do it without ending the session.
 */
function SessionPauseControl({
  paused,
  onPause,
  onResume,
}: Pick<ConfirmedPickCardProps, "paused" | "onPause" | "onResume">) {
  return (
    <button
      type="button"
      data-testid="session-pause"
      data-paused={paused ? "true" : "false"}
      onClick={paused ? onResume : onPause}
      className={cn(BTN_BASE, BTN_QUIET_ON_AMBER, "mt-3 w-full")}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="size-[15px] flex-none"
      >
        {paused ? (
          <path d="M7 4.5v15l12-7.5-12-7.5Z" />
        ) : (
          <>
            <path d="M9 5v14" />
            <path d="M15 5v14" />
          </>
        )}
      </svg>
      {paused ? ACTION_RESUME_SESSION : ACTION_PAUSE_SESSION}
    </button>
  );
}

export function ConfirmedPickCard({
  open,
  item,
  openedAtMs = null,
  onDismiss,
  onOpen,
  onOutcome,
  paused,
  onPause,
  onResume,
}: ConfirmedPickCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [closedAfterOpening, setClosedAfterOpening] = useState(false);
  const [answeredOutcome, setAnsweredOutcome] = useState<PickOutcome | null>(null);
  /** Opened during THIS mount — render state, so the duration pill can read it. */
  const [openedHere, setOpenedHere] = useState(false);

  /**
   * The open-write is SET-ONCE, and the ref is the guard because it settles synchronously:
   * a queued state update would not be visible to a second call in the same tick. Read ONLY
   * from the handler below, never during render (`react-hooks/refs`) — the pill reads
   * `openedHere` instead. `openedAtMs` covers a pick this person had already opened
   * elsewhere. Neither is a retry gate: a failed write is not re-attempted, because the
   * record is "they opened it", and they did.
   */
  const openWriteSpentRef = useRef(false);

  async function toggleInstructions() {
    if (expanded) {
      // Closing is what unlocks the outcome question — it is never asked over open steps.
      setExpanded(false);
      setClosedAfterOpening(true);
      return;
    }
    setExpanded(true);
    setOpenedHere(true);
    if (openWriteSpentRef.current || openedAtMs != null) return;
    openWriteSpentRef.current = true;
    await onOpen();
  }

  async function answerOutcome(outcome: PickOutcome) {
    if (answeredOutcome !== null) return;
    // Marked answered BEFORE the write is awaited, so a failed write degrades to the
    // acknowledgement rather than re-asking a question the person already answered (FR-030).
    setAnsweredOutcome(outcome);
    await onOutcome(outcome);
  }

  // Asked once, only after the item was opened AND its instructions closed (FR-016/FR-031).
  // There is deliberately no dismiss control on it: ignoring it IS the third answer, it
  // writes nothing, and it costs nothing.
  const askingOutcome = !expanded && closedAfterOpening && answeredOutcome === null;

  return (
    <Notification
      open={open}
      onOpenChange={(next) => {
        // Dismiss is the ONLY thing this can mean — and it writes nothing.
        if (!next) onDismiss();
      }}
      nonModal
      title={CARD_TITLE}
      body={CARD_DESC_CONFIRMED}
    >
      <div data-testid="confirmed-pick-card">
        <PickItem
          item={item}
          // The confirmed pick is state 4 by definition — the mock's five small moves, here
          // as on the home card, never a sixth.
          prominent
          expanded={expanded}
          // The pill reads "opened" once the item has been used, but not WHILE the steps are
          // on screen, where the duration is still the useful fact (mock panels 5/6).
          opened={(openedAtMs != null || openedHere) && !expanded}
        >
          {answeredOutcome !== null ? (
            // Same ring the home end-states use (states 7/8) — one visual language for
            // "recorded". The in-session card keeps its narrower scope: the ring and the
            // word, but NO replacement affordance (the swap lives on the home card).
            <div
              data-testid="outcome-acknowledgement"
              data-outcome={answeredOutcome}
              className="mt-4 border-t border-[var(--amber-soft-line)]"
            >
              <QuestionnaireResultIcon
                kind={answeredOutcome === "helped" ? "check" : "muted"}
                message={OUTCOME_ACKNOWLEDGEMENT}
              />
            </div>
          ) : askingOutcome ? (
            <OutcomePrompt prominent onAnswer={(outcome) => void answerOutcome(outcome)} />
          ) : (
            <ItemActions
              expanded={expanded}
              prominent
              // The swap lives on the home card (state 4), not here: this surface exists to
              // answer a confirmation with one small thing, and offering a replacement in the
              // same breath undercuts that. The person is not trapped — the home card still
              // shows the same pick, with its swap.
              swapAvailable={false}
              onToggleInstructions={() => void toggleInstructions()}
              onSwap={() => {}}
            />
          )}
        </PickItem>
        <SessionPauseControl paused={paused} onPause={onPause} onResume={onResume} />
      </div>
    </Notification>
  );
}
