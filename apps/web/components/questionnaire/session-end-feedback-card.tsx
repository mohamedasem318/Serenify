"use client";

import { ArrowRight, Bot, Lightbulb, Meh, Moon, Pencil, Smile, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { saveSessionFeedback as defaultSave } from "@/lib/api/questionnaire-client";
import { QUESTIONNAIRE_RESULT_DWELL_MS } from "@/lib/questionnaire/constants";
import { actionTargetForReason, type SessionFeedbackReason } from "@/lib/questionnaire/types";
import { cn } from "@/lib/utils";

import { QuestionnaireResultIcon, type QuestionnaireResultKind } from "./questionnaire-result-icon";

/**
 * Feature 012 / US2 — the session-end product-feedback card.
 *
 * Optional and freely skippable. Good → smiley success; "Something was off" → a reason
 * picker with a tailored action; Skip → a muted wind. Every reason is persisted ONLY as
 * employee-private product feedback through the questionnaire client (`saveSessionFeedback`).
 * The card has NO Ren or manager path: `ren_too_robotic` and free text are stored here and
 * never routed anywhere; the only routes are within /app/account. Calm-first colour roles —
 * no crimson, no amber. SC-007: every path reaches its end state in ≤3 interactions.
 */

const OPTION =
  "flex w-full min-h-11 items-center gap-3 rounded-control border border-border bg-bg px-3.5 py-2.5 " +
  "text-left text-[15px] leading-snug text-ink transition-colors " +
  "hover:bg-[color-mix(in_srgb,var(--color-foggy)_8%,var(--color-surface))] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow focus-visible:ring-offset-2 focus-visible:ring-offset-surface " +
  "aria-[pressed=true]:border-meadow";

const SENTIMENT =
  "flex min-h-11 flex-1 flex-col items-center gap-2 rounded-card border border-border bg-bg px-4 py-4 " +
  "text-[14px] text-ink transition-colors " +
  "hover:bg-[color-mix(in_srgb,var(--color-foggy)_8%,var(--color-surface))] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const ROUTE_BTN =
  "inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-control border border-border bg-surface " +
  "px-3 py-2 text-[14px] text-ink transition-colors hover:bg-bg " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export interface SessionEndFeedbackCardProps {
  userId: string;
  monitoringSessionId: string;
  /** Called once the feedback is recorded (submitted or skipped) so the host can mark it done. */
  onResolved?: () => void;
  /** Injectable persistence (defaults to the RLS questionnaire client). */
  save?: typeof defaultSave;
  /** Injectable navigation for the account route actions (defaults to a full nav). */
  navigate?: (path: string) => void;
}

type Ending = "good" | "skip" | "ren_too_robotic" | "something_else" | null;

// The centered end-state every path resolves into (Good/Skip plus the two ack-only reasons —
// `suggestion_didnt_help`/`needed_quiet` resolve via `route()` instead, once the user clicks
// through their tailored action). `check` (not a bespoke robot glyph) keeps the two acks
// visually consistent with each other and with the weekly card's own `check` ending.
const ENDING_CONTENT: Record<Exclude<Ending, null>, { kind: QuestionnaireResultKind; message: string }> = {
  good: { kind: "smiley", message: "Glad that helped." },
  skip: { kind: "muted", message: "No problem — another time." },
  ren_too_robotic: { kind: "check", message: "Thanks — we'll keep refining how Ren talks." },
  something_else: { kind: "check", message: "Thanks for the feedback." },
};

export function SessionEndFeedbackCard({
  userId,
  monitoringSessionId,
  onResolved,
  save = defaultSave,
  navigate = (path) => {
    if (typeof window !== "undefined") window.location.assign(path);
  },
}: SessionEndFeedbackCardProps) {
  const [branchOpen, setBranchOpen] = useState(false);
  const [reason, setReason] = useState<SessionFeedbackReason | null>(null);
  const [freeText, setFreeText] = useState("");
  const [ending, setEnding] = useState<Ending>(null);
  // Track the in-flight save so a route action can await it before a full-page nav can abort it.
  const savePromiseRef = useRef<ReturnType<typeof defaultSave>>(
    Promise.resolve({ ok: true, data: { id: "" } }),
  );
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending resolve timer on unmount so it never fires against a dead card.
  useEffect(() => {
    return () => {
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
    };
  }, []);

  // Save without notifying the coordinator — used by the two route-bearing reasons, whose
  // action row (Update preferences / Notification settings) must stay on screen until the
  // user actually clicks it; the coordinator would otherwise swap this card out for the next
  // surface the instant a reason is chosen, before the button is ever reachable.
  function saveOnly(args: Parameters<typeof defaultSave>[0]) {
    const promise = save(args);
    savePromiseRef.current = promise;
    return promise;
  }

  // Good / Skip / ren_too_robotic / free-text: save, then defer the coordinator notification
  // (same dwell as the weekly card) so the ending screen/note is actually visible before the
  // parent swaps this card out for the next surface.
  function persist(args: Parameters<typeof defaultSave>[0]) {
    const promise = saveOnly(args);
    resolveTimerRef.current = setTimeout(() => {
      void promise.then((result) => {
        if (!result.ok) {
          console.error("[questionnaire] session-end feedback save failed:", result.error);
        }
      });
      onResolved?.();
    }, QUESTIONNAIRE_RESULT_DWELL_MS);
  }

  async function route(path: string) {
    const result = await savePromiseRef.current;
    if (!result.ok) {
      // Don't resolve/navigate on a failed save — that would silently discard the user's
      // choice while looking like it succeeded.
      console.error("[questionnaire] session-end feedback save failed, not navigating:", result.error);
      return;
    }
    onResolved?.();
    navigate(path);
  }

  function chooseGood() {
    persist({ userId, monitoringSessionId, status: "submitted", sentiment: "good" });
    setEnding("good");
  }

  function skip() {
    persist({ userId, monitoringSessionId, status: "skipped" });
    setEnding("skip");
  }

  function chooseReason(next: SessionFeedbackReason) {
    setReason(next);
    if (next === "something_else") return; // waits for non-empty free text
    const args = {
      userId,
      monitoringSessionId,
      status: "submitted" as const,
      sentiment: "off" as const,
      reason: next,
    };
    // `something_else` is already handled above; the only other ack-only reason is
    // `ren_too_robotic` (see `actionTargetForReason`) — the routed reasons fall through below.
    if (next === "ren_too_robotic" && actionTargetForReason(next) === "ack_only") {
      persist(args);
      setEnding(next);
      return;
    }
    // Routed reasons resolve only once the user clicks through (see `route`).
    saveOnly(args);
  }

  function submitFreeText() {
    if (freeText.trim().length === 0) return; // non-empty trimmed text required
    persist({
      userId,
      monitoringSessionId,
      status: "submitted",
      sentiment: "off",
      reason: "something_else",
      freeText,
    });
    setEnding("something_else");
  }

  if (ending) {
    const { kind, message } = ENDING_CONTENT[ending];
    return (
      <div className="rounded-card border border-border bg-surface p-5 shadow-soft" data-testid="session-end-feedback">
        <QuestionnaireResultIcon kind={kind} message={message} />
      </div>
    );
  }

  return (
    <div
      className="rounded-card border border-border bg-surface p-5 shadow-soft"
      data-testid="session-end-feedback"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[17px] font-semibold leading-tight text-ink">
          How did that check-in feel?
        </h2>
        <button
          type="button"
          onClick={skip}
          className="relative -my-3.5 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-control px-2.5 py-3.5 text-[13px] text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <X aria-hidden className="size-3.5" /> Skip
        </button>
      </div>

      {!branchOpen ? (
        <div className="mt-3 flex gap-3">
          <button type="button" onClick={chooseGood} className={SENTIMENT}>
            <Smile aria-hidden className="size-7 text-meadow" /> Good
          </button>
          <button type="button" onClick={() => setBranchOpen(true)} className={SENTIMENT}>
            <Meh aria-hidden className="size-7 text-muted" /> Something was off
          </button>
        </div>
      ) : (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2.5 text-[14px] text-muted">Got it. What felt off?</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              aria-pressed={reason === "suggestion_didnt_help"}
              onClick={() => chooseReason("suggestion_didnt_help")}
              className={OPTION}
            >
              <Lightbulb aria-hidden className="size-[19px] shrink-0 text-muted" /> The suggestion
              didn&apos;t help
            </button>
            <button
              type="button"
              aria-pressed={reason === "needed_quiet"}
              onClick={() => chooseReason("needed_quiet")}
              className={OPTION}
            >
              <Moon aria-hidden className="size-[19px] shrink-0 text-muted" /> I just needed quiet
              time
            </button>
            <button
              type="button"
              aria-pressed={reason === "ren_too_robotic"}
              onClick={() => chooseReason("ren_too_robotic")}
              className={OPTION}
            >
              <Bot aria-hidden className="size-[19px] shrink-0 text-muted" /> The chatbot felt too
              robotic
            </button>
            <button
              type="button"
              aria-pressed={reason === "something_else"}
              onClick={() => chooseReason("something_else")}
              className={OPTION}
            >
              <Pencil aria-hidden className="size-[19px] shrink-0 text-muted" /> Something else
            </button>
          </div>

          {reason && <div className="mt-3.5">{renderAction(reason)}</div>}
        </div>
      )}
    </div>
  );

  function renderAction(r: SessionFeedbackReason) {
    if (r === "suggestion_didnt_help") {
      return (
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-card bg-[color-mix(in_srgb,var(--color-meadow)_12%,var(--color-surface))] px-3.5 py-3">
          <span className="text-[14px] text-meadow-text">Your suggestions can be tuned to you.</span>
          <button type="button" onClick={() => void route("/app/account")} className={ROUTE_BTN}>
            Update preferences <ArrowRight aria-hidden className="size-[15px]" />
          </button>
        </div>
      );
    }
    if (r === "needed_quiet") {
      return (
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-card bg-[color-mix(in_srgb,var(--color-meadow)_12%,var(--color-surface))] px-3.5 py-3">
          <span className="text-[14px] text-meadow-text">Want fewer check-ins?</span>
          <button
            type="button"
            onClick={() => void route("/app/account#notifications")}
            className={ROUTE_BTN}
          >
            Notification settings <ArrowRight aria-hidden className="size-[15px]" />
          </button>
        </div>
      );
    }
    // something_else — free text, stored employee-private only. (`ren_too_robotic` never
    // reaches here: it resolves straight to the shared end-state above via `chooseReason`.)
    return (
      <div className="rounded-card bg-bg px-3.5 py-3">
        <textarea
          aria-label="Tell us what felt off"
          placeholder="Tell us what felt off"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          className="min-h-[62px] w-full resize-y rounded-control border border-border bg-surface p-2.5 text-[14px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-meadow"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[12px] text-muted">This goes to Serenify.</p>
          <button
            type="button"
            onClick={submitFreeText}
            disabled={freeText.trim().length === 0}
            className={cn(ROUTE_BTN, "disabled:opacity-40")}
          >
            Send
          </button>
        </div>
      </div>
    );
  }
}
