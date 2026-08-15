"use client";

import type { ReactNode } from "react";

import { RenAvatar } from "@/components/chat/ren-avatar";
import { QuestionnaireResultIcon } from "@/components/questionnaire/questionnaire-result-icon";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { PickOutcome } from "@/lib/recommendations/engine";
import type { CardStateNumber } from "@/lib/recommendations/episode";
import {
  ACTION_CLOSE,
  ACTION_SHOW_ME,
  ACTION_SOMETHING_ELSE,
  ACTION_START_CHECKIN,
  ACTION_TALK_TO_REN,
  ACTION_TRY_SOMETHING_ELSE,
  CARD_TITLE,
  OUTCOME_ANSWER_DIDNT_HELP,
  OUTCOME_ANSWER_HELPED,
  OUTCOME_QUESTION,
} from "@/lib/recommendations/card-strings";
import {
  OUTCOME_ACKNOWLEDGEMENT,
  OUTCOME_DIDNT_HELP_SUBLINE,
  OUTCOME_NO_REPLACEMENT_SUBLINE,
  SWAP_RETIRED_LINE,
} from "@/lib/recommendations/library";
import { cn } from "@/lib/utils";

/**
 * Feature 014 — the presentational shells for the card's ten states (T012).
 *
 * Every piece here is a pure function of its props: no reads, no writes, no clock, no
 * engine. The stateful wiring lives one level up in
 * `components/home/things-that-might-help-card.tsx` (T013) and, from Phase 5, in
 * `ConfirmedPickCard`. Splitting it this way is what lets T014 reach all ten states by
 * driving props, and what will let the in-session card reuse the same shapes without
 * inheriting the home card's reads.
 *
 * ── Strings ─────────────────────────────────────────────────────────────────────────
 * Not one user-facing literal is typed in this file. Item copy comes from `library.ts`
 * through `PickItem` (verbatim, FR-004); the card's own fixed words come from
 * `library.ts` (the acknowledgement, the two state-8 sub-lines, the swap-retirement line)
 * and from `card-strings.ts` (the mock's descriptions and control labels). One place to
 * review, in both cases.
 *
 * ── The 8-state control discipline, and its two deliberate absences ─────────────────
 * Every control below ships default / hover / focus-visible / active / disabled / loading.
 * **Error and success are deliberately absent from controls.** Success is not a button
 * state here — it is the result ring in states 7/8. And error does not exist on this
 * surface at all: a failed swap or a failed outcome write degrades silently to the
 * previous pick (FR-030), so there is no error styling to write and none may be added.
 * That is a documented deviation-by-design, not an omission (plan §UI design contract).
 *
 * ── Motion ──────────────────────────────────────────────────────────────────────────
 * Only `qri-pop` / `qri-draw` / `qri-fadeup` (the shipped `QuestionnaireResultIcon`
 * vocabulary — `qri-fadeup` is what `globals.css` actually names the mock's `qri-fade`)
 * and the state-10 fade. All of it collapses under `prefers-reduced-motion`: the result
 * ring by reusing `QuestionnaireResultIcon`, which gates its own classes on the R-6
 * `useMediaQuery` hook; everything else by the same hook here. The swap has deliberately
 * NO ceremony — giving a declined pick a success animation would make declining feel like
 * an event worth avoiding.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Control classes — the mock's three tiers, expressed once
// ─────────────────────────────────────────────────────────────────────────────

const BTN_BASE =
  "inline-flex min-h-11 flex-none cursor-pointer items-center justify-center gap-1.5 rounded-control border border-transparent px-3 text-sm font-semibold leading-none whitespace-nowrap transition-[background-color,opacity] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-meadow active:opacity-85 disabled:cursor-not-allowed disabled:opacity-50";

/** Forward action, quiet — outlined meadow. The default everywhere except state 4. */
const BTN_OUTLINE = "border-meadow bg-surface text-ink hover:bg-[color-mix(in_srgb,var(--color-meadow)_10%,var(--color-surface))]";

/**
 * Forward action, filled. Principle V's required fill for a forward action — and on this
 * card it appears in STATE 4 ONLY. The check-in card above owns the page's filled primary,
 * and two identical primaries on one screen read as a bug.
 */
const BTN_MEADOW = "bg-meadow text-on-accent hover:opacity-90 dark:text-bg";

/** Neutral secondary — no accent, because swapping is not a forward action. */
const BTN_QUIET =
  "border-border bg-transparent text-muted hover:bg-surface hover:text-ink";

/** On the state-4 amber wash the neutral seam floats; borrow the item's own warm line. */
const BTN_QUIET_ON_AMBER =
  "border-[color-mix(in_srgb,var(--amber-soft-line)_55%,transparent)] bg-transparent text-muted hover:bg-[color-mix(in_srgb,var(--color-surface)_70%,transparent)] hover:text-ink";

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// The card shell
// ─────────────────────────────────────────────────────────────────────────────

export interface RecommendationCardShellProps {
  /** Which of FR-001's ten states is on screen. Exposed for tests and e2e. */
  state: CardStateNumber;
  /** The card description for this state — from `card-strings.ts`, never composed here. */
  description: string;
  children: ReactNode;
}

/**
 * The card frame: title, per-state description, body. Sizes to its own content (no
 * `h-full`) exactly as the shipped placeholder did — it is not yoked to the recent-chats
 * card's capped height.
 */
export function RecommendationCardShell({
  state,
  description,
  children,
}: RecommendationCardShellProps) {
  return (
    <Card data-testid="things-that-might-help" data-card-state={state}>
      <CardHeader>
        <CardTitle className="font-display text-xl text-ink">{CARD_TITLE}</CardTitle>
        <CardDescription
          data-testid="card-description"
          className="text-sm leading-relaxed text-muted"
        >
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// States 1 / 2 / 9 — the resting shape
// ─────────────────────────────────────────────────────────────────────────────

/** Which tile a resting state wears. Neutral for "nothing yet", meadow for calm/at-rest. */
export type RestingTone = "neutral" | "meadow";
export type RestingGlyph = "clock" | "wave" | "check";

function RestingSvg({ glyph }: { glyph: RestingGlyph }) {
  return (
    <svg {...ICON_PROPS} strokeWidth={glyph === "check" ? 2.2 : 2} aria-hidden className="size-[21px]">
      {glyph === "clock" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      )}
      {glyph === "wave" && <path d="M2.5 14.5c3.2 0 3.6-5 6.3-5s3.1 5 6.3 5 3-2.6 6.4-2.6" />}
      {glyph === "check" && <path d="M20 6 9 17l-5-5" />}
    </svg>
  );
}

export interface RestingBlockProps {
  tone: RestingTone;
  glyph: RestingGlyph;
  /** The state's specific, true first line. */
  lead: string;
  /** The forward-looking second line. Omitted when the lead already carries it. */
  line?: string;
  /** State 1's check-in action, and nothing else — states 2 and 9 have NO action. */
  children?: ReactNode;
}

/**
 * The shape states 1, 2 and 9 share. That they share it is the design: calm,
 * nothing-yet, and done-for-now must read as the same kind of quiet, so none of them
 * reads as a failure or a hole (mock panels 1, 2, 9).
 */
export function RestingBlock({ tone, glyph, lead, line, children }: RestingBlockProps) {
  return (
    <>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          data-testid="resting-tile"
          data-tone={tone}
          className={cn(
            "grid size-10 flex-none place-items-center rounded-[11px]",
            tone === "meadow"
              ? "bg-[color-mix(in_srgb,var(--color-meadow)_13%,var(--color-surface))] text-meadow-text"
              : "bg-[color-mix(in_srgb,var(--color-muted)_10%,var(--color-surface))] text-muted",
          )}
        >
          <RestingSvg glyph={glyph} />
        </span>
        <div className="min-w-0 flex-1">
          <p data-testid="resting-lead" className="text-base leading-normal text-ink">
            {lead}
          </p>
          {line && (
            <p data-testid="resting-line" className="mt-1.5 text-sm leading-relaxed text-muted">
              {line}
            </p>
          )}
        </div>
      </div>
      {children}
    </>
  );
}

/** State 1's action. A FULL-document nav, never `<Link>` — `/app/monitor` is a camera route. */
export function StartCheckinAction() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <a
        data-testid="start-checkin"
        href="/app/monitor"
        className={cn(BTN_BASE, BTN_OUTLINE)}
      >
        <svg {...ICON_PROPS} strokeWidth={2} aria-hidden className="size-[15px] flex-none">
          <path d="m22 8-6 4 6 4V8Z" />
          <rect width="14" height="12" x="2" y="6" rx="2" />
        </svg>
        {ACTION_START_CHECKIN}
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// States 3 / 4 / 5 — the item's own actions
// ─────────────────────────────────────────────────────────────────────────────

export interface ItemActionsProps {
  /** Instructions currently visible (state 5) — the row collapses to Close alone. */
  expanded: boolean;
  /** State 4 fills the primary; every other state keeps it outlined. */
  prominent?: boolean;
  /** Swap is offered (states 3/4). False → the caller renders `SwapRetiredNote` instead. */
  swapAvailable: boolean;
  /** A swap is being applied (state 10) — the loading control state. */
  swapInFlight?: boolean;
  onToggleInstructions: () => void;
  onSwap: () => void;
}

/**
 * The item's action row. **Swap withdraws while the instructions are open** (state 5) —
 * mid-instruction is the wrong moment to offer an exit — and so does the Ren row, which
 * the caller drops for the same reason.
 */
export function ItemActions({
  expanded,
  prominent = false,
  swapAvailable,
  swapInFlight = false,
  onToggleInstructions,
  onSwap,
}: ItemActionsProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        data-testid={expanded ? "close-instructions" : "show-me"}
        onClick={onToggleInstructions}
        className={cn(
          BTN_BASE,
          "flex-auto",
          expanded ? (prominent ? BTN_QUIET_ON_AMBER : BTN_QUIET) : prominent ? BTN_MEADOW : BTN_OUTLINE,
        )}
      >
        <svg {...ICON_PROPS} strokeWidth={2.2} aria-hidden className="size-[15px] flex-none">
          <path d={expanded ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
        </svg>
        {expanded ? ACTION_CLOSE : ACTION_SHOW_ME}
      </button>
      {!expanded && swapAvailable && (
        <button
          type="button"
          data-testid="swap"
          onClick={onSwap}
          disabled={swapInFlight}
          className={cn(BTN_BASE, "flex-auto", prominent ? BTN_QUIET_ON_AMBER : BTN_QUIET)}
        >
          {ACTION_SOMETHING_ELSE}
        </button>
      )}
    </div>
  );
}

/**
 * What stands in place of the swap action once the episode's picks are spent, or the day's
 * non-repeat exclusions leave nothing eligible (FR-018). Honest about having nothing new
 * rather than quietly repeating an item, and it pushes the person toward nothing.
 */
export function SwapRetiredNote() {
  return (
    <p data-testid="swap-retired" className="mt-3 text-[13.5px] leading-relaxed text-muted">
      {SWAP_RETIRED_LINE}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The Ren row — a presence, not a text link
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Foggy is allowed here and only here on this card: Principle V permits it on a control
 * whose sole job is to open Ren. The mark is the locked `RenAvatar` at 30 px — never
 * re-drawn, never below 24 px.
 */
export function RenRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid="talk-to-ren"
      onClick={onClick}
      className="flex min-h-[52px] w-full cursor-pointer items-center gap-3 rounded-control border border-transparent bg-[color-mix(in_srgb,var(--color-foggy)_9%,var(--color-surface))] py-[7px] pr-[13px] pl-[9px] text-left text-[14.5px] font-semibold text-foggy transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-foggy)_15%,var(--color-surface))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foggy active:opacity-85"
    >
      <RenAvatar size={30} state="idle" />
      <span className="min-w-0 flex-1">{ACTION_TALK_TO_REN}</span>
      <svg {...ICON_PROPS} strokeWidth={2.2} aria-hidden className="size-4 flex-none opacity-80">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// State 6 — the outcome prompt
// ─────────────────────────────────────────────────────────────────────────────

export interface OutcomePromptProps {
  prominent?: boolean;
  onAnswer: (outcome: PickOutcome) => void;
}

/**
 * The item's FOOTER, not a new card-level decision — and it never renders over the open
 * instructions (FR-031). Ignoring it is a valid third answer that costs nothing, which is
 * why there is no dismiss control to press: not answering IS the third answer.
 */
export function OutcomePrompt({ prominent = false, onAnswer }: OutcomePromptProps) {
  return (
    <div
      data-testid="outcome-prompt"
      className={cn("mt-4 border-t pt-4", prominent ? "border-[var(--amber-soft-line)]" : "border-border")}
    >
      <p className="mb-2.5 text-[14.5px] font-semibold text-ink">{OUTCOME_QUESTION}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="outcome-helped"
          onClick={() => onAnswer("helped")}
          className={cn(BTN_BASE, "px-4", prominent ? BTN_MEADOW : BTN_OUTLINE)}
        >
          {OUTCOME_ANSWER_HELPED}
        </button>
        <button
          type="button"
          data-testid="outcome-didnt-help"
          onClick={() => onAnswer("didnt_help")}
          className={cn(BTN_BASE, "px-4", prominent ? BTN_QUIET_ON_AMBER : BTN_QUIET)}
        >
          {OUTCOME_ANSWER_DIDNT_HELP}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// States 7 / 8 — the recorded end-states
// ─────────────────────────────────────────────────────────────────────────────

export interface OutcomeRecordedProps {
  outcome: PickOutcome;
  /**
   * State 8 only: whether a replacement is available on the episode's SHARED three-pick
   * budget. `false` renders the no-replacement variant — same neutral treatment, same
   * acknowledgement word, no replacement action, one honest line.
   */
  replacementAvailable: boolean;
  onTakeReplacement: () => void;
}

/**
 * The recorded end-state, reusing `QuestionnaireResultIcon` EXACTLY (FR-029) rather than
 * inventing a second success language — meadow ring + drawn check for "helped", the muted
 * ring + static Wind glyph for "didn't". Its `qri-pop` / `qri-draw` / `qri-fadeup` classes
 * are omitted under `prefers-reduced-motion` by the component itself.
 *
 * **The acknowledgement word is identical on both paths** — one constant,
 * `OUTCOME_ACKNOWLEDGEMENT`, deliberately not two. A different word per branch would grade
 * the answer, and the person did not fail anything.
 *
 * D-6 (the dwell) is the CALLER's: this component paints, and the card holds it on screen
 * before settling to state 9. An end-state that resolves in the same commit as the surface
 * swap is never seen at all.
 */
export function OutcomeRecorded({
  outcome,
  replacementAvailable,
  onTakeReplacement,
}: OutcomeRecordedProps) {
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const helped = outcome === "helped";

  return (
    <div data-testid="outcome-recorded" data-outcome={outcome}>
      <QuestionnaireResultIcon
        kind={helped ? "check" : "muted"}
        message={OUTCOME_ACKNOWLEDGEMENT}
      />
      {!helped && (
        <p
          data-testid="outcome-subline"
          className={cn(
            "-mt-3 text-center text-[13.5px] text-muted",
            reduce ? "" : "qri-fadeup",
          )}
        >
          {replacementAvailable ? OUTCOME_DIDNT_HELP_SUBLINE : OUTCOME_NO_REPLACEMENT_SUBLINE}
        </p>
      )}
      {!helped && replacementAvailable && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            data-testid="take-replacement"
            onClick={onTakeReplacement}
            className={cn(BTN_BASE, BTN_QUIET)}
          >
            <svg {...ICON_PROPS} strokeWidth={2} aria-hidden className="size-[15px] flex-none">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            {ACTION_TRY_SOMETHING_ELSE}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// State 10 — the swap, with no ceremony at all
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The ONLY motion a swap gets: the replacing item fades in where the old one was. No icon,
 * no ring, no acknowledgement, no dwell. That absence is the design — swapping a pick is a
 * preference, not an outcome (FR-017).
 */
export function SwapFade({ children }: { children: ReactNode }) {
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (
    <div data-testid="swap-fade" data-motion={reduce ? "reduced" : "full"} className={reduce ? "" : "qri-fadeup"}>
      {children}
    </div>
  );
}
