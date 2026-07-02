"use client";

import {
  ArrowLeft,
  Bug,
  Calendar,
  HelpCircle,
  Hourglass,
  Laptop,
  Lock,
  Meh,
  MessagesSquare,
  Smile,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  submitWeeklyCheckin as defaultSubmit,
  upsertWeeklyCadence as defaultUpsertCadence,
  type WeeklyCadenceRow,
} from "@/lib/api/questionnaire-client";
import { QUESTIONNAIRE_RESULT_DWELL_MS } from "@/lib/questionnaire/constants";
import type { WeeklyRoadblock, WeeklySupport } from "@/lib/questionnaire/types";
import { skipPatch } from "@/lib/questionnaire/weekly-cadence";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

import { QuestionnaireResultIcon } from "./questionnaire-result-icon";

/**
 * Feature 012 / US3 — the weekly work-environment check-in.
 *
 * Good → smiley success (submits `sentiment='good'`); "Could be better" → a two-step stepper
 * (roadblock → support) → Done submits one IDENTITY-STRIPPED aggregate contribution through
 * the DEFINER RPC; Skip → muted wind, cadence-only (no contribution). Q1 auto-advances and
 * moves focus to Q2; the progress bar exposes `role="progressbar"` ARIA and step is announced
 * politely. Calm-first roles, no crimson. Privacy footer states only an anonymized team-level
 * summary reaches the manager.
 */

const SENTIMENT =
  "flex min-h-11 flex-1 flex-col items-center gap-2 rounded-card border border-border bg-bg px-4 py-4 " +
  "text-[14px] text-ink transition-colors hover:bg-[color-mix(in_srgb,var(--color-foggy)_8%,var(--color-surface))] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const OPTION =
  "flex w-full min-h-11 items-center gap-3 rounded-control border border-border bg-bg px-3.5 py-2.5 " +
  "text-left text-[15px] leading-snug text-ink transition-colors hover:bg-[color-mix(in_srgb,var(--color-foggy)_8%,var(--color-surface))] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow focus-visible:ring-offset-2 focus-visible:ring-offset-surface " +
  "aria-[pressed=true]:border-meadow";

const NAV_BTN =
  "inline-flex min-h-11 items-center gap-1.5 rounded-control px-4 py-2 text-[14px] transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const ROADBLOCKS: { value: WeeklyRoadblock; label: string; Icon: typeof HelpCircle }[] = [
  { value: "unclear_instructions_or_goals", label: "Unclear instructions or goals", Icon: HelpCircle },
  { value: "waiting_on_other_team_members", label: "Waiting on other team members", Icon: Hourglass },
  { value: "software_or_tools_crashing", label: "Software or tools crashing", Icon: Bug },
];

const SUPPORTS: { value: WeeklySupport; label: string; Icon: typeof Calendar }[] = [
  { value: "deadline_flexibility", label: "Deadline flexibility", Icon: Calendar },
  { value: "better_team_alignment_or_communication", label: "Better team alignment or communication", Icon: MessagesSquare },
  { value: "quieter_workspace", label: "A quieter workspace", Icon: VolumeX },
  { value: "better_technical_equipment", label: "Better technical equipment", Icon: Laptop },
];

export interface WeeklyCheckInCardProps {
  userId: string;
  isoWeekStart: string;
  /** Current cadence row (for the skip increment); null on the first visit of the week. */
  cadence?: WeeklyCadenceRow | null;
  /** Called once the check-in is recorded (submitted or skipped) so the host can mark it done. */
  onResolved?: () => void;
  /** Injectable submit RPC (defaults to the authenticated client). */
  submit?: typeof defaultSubmit;
  /** Injectable cadence upsert (defaults to the authenticated client). */
  recordCadence?: typeof defaultUpsertCadence;
}

type Phase = "choice" | "q1" | "q2";
type Ending = "good" | "skip" | "submit" | null;

export function WeeklyCheckInCard({
  userId,
  isoWeekStart,
  cadence = null,
  onResolved,
  submit = defaultSubmit,
  recordCadence = defaultUpsertCadence,
}: WeeklyCheckInCardProps) {
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [phase, setPhase] = useState<Phase>("choice");
  const [ending, setEnding] = useState<Ending>(null);
  const [roadblock, setRoadblock] = useState<WeeklyRoadblock | null>(null);
  const [support, setSupport] = useState<WeeklySupport | null>(null);
  const q2HeadingRef = useRef<HTMLParagraphElement>(null);
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Q1 auto-advance → move focus to the Q2 heading (accessible stepper movement).
  useEffect(() => {
    if (phase === "q2") q2HeadingRef.current?.focus();
  }, [phase]);

  // Clear any pending resolve timer on unmount so it never fires against a dead card.
  useEffect(() => {
    return () => {
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
    };
  }, []);

  function resolve(next: Exclude<Ending, null>) {
    setEnding(next);
    // Defer the coordinator notification so the ending screen (smiley/check/muted + message)
    // is actually visible before the parent swaps this card out for the next surface.
    resolveTimerRef.current = setTimeout(() => onResolved?.(), QUESTIONNAIRE_RESULT_DWELL_MS);
  }

  function chooseGood() {
    void submit({ isoWeekStart, sentiment: "good" });
    resolve("good");
  }

  function skip() {
    void recordCadence(skipPatch(cadence, userId, isoWeekStart));
    resolve("skip");
  }

  function done() {
    if (!roadblock || !support) return;
    void submit({ isoWeekStart, sentiment: "could_be_better", roadblock, support });
    resolve("submit");
  }

  if (ending) {
    const message =
      ending === "good"
        ? "Glad the week's been good."
        : ending === "skip"
          ? "All good — we'll ask again next week."
          : "Heard — thanks for speaking up.";
    return (
      <Shell>
        <QuestionnaireResultIcon
          kind={ending === "good" ? "smiley" : ending === "skip" ? "muted" : "check"}
          message={message}
        />
        <PrivacyFooter />
      </Shell>
    );
  }

  const step = phase === "q1" ? 1 : 2;
  const barWidth = phase === "q1" ? "0%" : support ? "100%" : "50%";

  return (
    <Shell>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[17px] font-semibold leading-tight text-ink">
          How has the work environment felt lately?
        </h2>
        <button
          type="button"
          onClick={skip}
          className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-[13px] text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow"
        >
          <X aria-hidden className="size-3.5" /> Skip
        </button>
      </div>

      {phase === "choice" ? (
        <div className="mt-3 flex gap-3">
          <button type="button" onClick={chooseGood} className={SENTIMENT}>
            <Smile aria-hidden className="size-7 text-meadow" /> Good
          </button>
          <button type="button" onClick={() => setPhase("q1")} className={SENTIMENT}>
            <Meh aria-hidden className="size-7 text-muted" /> Could be better
          </button>
        </div>
      ) : (
        <div className="mt-4 border-t border-border pt-4">
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={2}
            aria-valuenow={step}
            aria-valuetext={`Step ${step} of 2`}
            className="mb-4 h-1 overflow-hidden rounded-full bg-border"
          >
            <span
              data-testid="weekly-progress-fill"
              className={cn("block h-full rounded-full bg-meadow", reduce ? "" : "qprogress-fill")}
              style={{ width: barWidth }}
            />
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            Step {step} of 2
          </p>

          {phase === "q1" ? (
            <div>
              <p className="mb-3 text-[15px] font-semibold text-ink">What was your biggest roadblock?</p>
              <div className="flex flex-col gap-2">
                {ROADBLOCKS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={roadblock === value}
                    onClick={() => {
                      setRoadblock(value);
                      setPhase("q2");
                    }}
                    className={OPTION}
                  >
                    <Icon aria-hidden className="size-[19px] shrink-0 text-muted" /> {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p
                ref={q2HeadingRef}
                tabIndex={-1}
                className="mb-3 text-[15px] font-semibold text-ink outline-none"
              >
                What support would have made this week better?
              </p>
              <div className="flex flex-col gap-2">
                {SUPPORTS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={support === value}
                    onClick={() => setSupport(value)}
                    className={OPTION}
                  >
                    <Icon aria-hidden className="size-[19px] shrink-0 text-muted" /> {label}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPhase("q1")}
                  className={cn(NAV_BTN, "border border-border bg-transparent text-muted hover:bg-bg")}
                >
                  <ArrowLeft aria-hidden className="size-[15px]" /> Back
                </button>
                <button
                  type="button"
                  onClick={done}
                  disabled={!support}
                  className={cn(
                    NAV_BTN,
                    "border border-meadow bg-meadow text-on-accent dark:text-bg disabled:opacity-40",
                  )}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <PrivacyFooter />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-soft" data-testid="weekly-check-in">
      {children}
    </div>
  );
}

function PrivacyFooter() {
  return (
    <div className="mt-4 flex items-center gap-2 border-t border-border pt-3.5">
      <Lock aria-hidden className="size-[15px] shrink-0 text-muted" />
      <span className="text-[12px] leading-snug text-muted">
        Only an anonymized team-level summary reaches your manager — never your individual answer.
        (Demo build — full anonymization is a later privacy item.)
      </span>
    </div>
  );
}
