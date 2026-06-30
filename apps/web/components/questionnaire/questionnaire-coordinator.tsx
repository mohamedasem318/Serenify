"use client";

import { useEffect, useRef, useState } from "react";

import {
  getWeeklyCadence as defaultGetWeeklyCadence,
  upsertWeeklyCadence as defaultUpsertCadence,
  type WeeklyCadenceRow,
} from "@/lib/api/questionnaire-client";
import { takeEndedSession as defaultTakeEndedSession } from "@/lib/questionnaire/session-end-handoff";
import { shouldOfferSessionEndFeedback } from "@/lib/questionnaire/session-feedback-sampling";
import {
  currentIsoWeekStart,
  promptShownPatch,
  shouldShowWeeklyCheckIn,
} from "@/lib/questionnaire/weekly-cadence";

import { SessionEndFeedbackCard } from "./session-end-feedback-card";
import { WeeklyCheckInCard } from "./weekly-check-in-card";

/**
 * Feature 012 / US4 — the questionnaire coordinator.
 *
 * Centralises questionnaire surface priority so two surfaces never co-occur. The confirmatory
 * prompt lives on the monitor page (resolved before the end-navigation), so on the dashboard
 * this coordinator only ever shows session-end feedback (for a just-ended session) or the
 * weekly check-in, with session-end taking priority. It mounts ALONGSIDE the Today card and
 * trend without changing their rendering (T062/T064).
 */

export interface QuestionnaireSurfaceInputs {
  /** A monitoring session is actively recording (true only on the monitor page). */
  monitoringActive: boolean;
  /** A confirmatory prompt is visible or resolving. */
  confirmatoryVisible: boolean;
  /** A just-ended session awaits product feedback. */
  sessionEndEligible: boolean;
  /** The weekly work-environment check-in is due. */
  weeklyEligible: boolean;
}

export type QuestionnaireSurface = "confirmatory" | "session_end" | "weekly" | "none";

/**
 * The single source of questionnaire rendering priority (pure, exhaustively testable):
 *   1. A visible confirmatory prompt always wins (it is sticky/answer-only).
 *   2. Session-end feedback is eligible only once monitoring has ended AND no confirmatory
 *      prompt is open — so the two never co-occur and the prompt resolves first.
 *   3. The weekly check-in shows on a dashboard visit, separate from active monitoring, and
 *      yields to session-end feedback.
 */
export function decideQuestionnaireSurface(i: QuestionnaireSurfaceInputs): QuestionnaireSurface {
  if (i.confirmatoryVisible) return "confirmatory";
  if (!i.monitoringActive && i.sessionEndEligible) return "session_end";
  if (!i.monitoringActive && i.weeklyEligible) return "weekly";
  return "none";
}

export interface QuestionnaireCoordinatorProps {
  userId: string;
  /** Injectable one-shot read of the just-ended session id (defaults to the sessionStorage store). */
  takeEndedSession?: () => string | null;
  /** Injectable cadence loader (defaults to the authenticated client). */
  loadCadence?: typeof defaultGetWeeklyCadence;
  /** Injectable cadence upsert for the prompt-shown record (defaults to the authenticated client). */
  recordCadence?: typeof defaultUpsertCadence;
  /** Injectable clock for the ISO-week bucket. */
  now?: Date;
}

export function QuestionnaireCoordinator({
  userId,
  takeEndedSession = defaultTakeEndedSession,
  loadCadence = defaultGetWeeklyCadence,
  recordCadence = defaultUpsertCadence,
  now,
}: QuestionnaireCoordinatorProps) {
  const [endedSessionId, setEndedSessionId] = useState<string | null>(null);
  const [cadence, setCadence] = useState<WeeklyCadenceRow | null>(null);
  const [weeklyDue, setWeeklyDue] = useState(false);
  const [sessionEndDone, setSessionEndDone] = useState(false);
  const [weeklyDone, setWeeklyDone] = useState(false);
  const promptRecordedRef = useRef(false);
  const isoWeekStart = currentIsoWeekStart(now ?? new Date());

  useEffect(() => {
    // One-shot on mount: consume the just-ended session id (a browser-store read), then load
    // weekly eligibility asynchronously. Both seed external state into React once — not a
    // render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the just-ended-session handoff on mount
    setEndedSessionId(takeEndedSession());
    let alive = true;
    void loadCadence(userId, isoWeekStart).then((row) => {
      if (!alive) return;
      setCadence(row);
      setWeeklyDue(shouldShowWeeklyCheckIn(row));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per user; seams are stable
  }, [userId]);

  const surface = decideQuestionnaireSurface({
    monitoringActive: false, // the dashboard is never an active monitoring surface
    confirmatoryVisible: false, // the confirmatory prompt is monitor-page only
    // Route through the sampling seam so a future policy (less than every session) takes effect
    // here without a coordinator change. v1 (`every_session`) returns true.
    sessionEndEligible: endedSessionId !== null && !sessionEndDone && shouldOfferSessionEndFeedback(),
    weeklyEligible: weeklyDue && !weeklyDone,
  });

  // Record the weekly prompt as shown ONCE when it first mounts (increments prompt_count,
  // stamps last_prompted_at — data-model.md). The prompt_count cap then keeps it from
  // re-appearing on every dashboard visit.
  useEffect(() => {
    if (surface !== "weekly" || promptRecordedRef.current) return;
    promptRecordedRef.current = true;
    void recordCadence(promptShownPatch(cadence, userId, isoWeekStart, (now ?? new Date()).toISOString()));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot when the weekly surface first shows; seams stable
  }, [surface]);

  if (surface === "none") return null;

  return (
    <div
      data-testid="questionnaire-coordinator"
      // Calm bottom surface: full-width sheet on mobile, bottom-right card on desktop, clearing
      // the chat pill via the shared --chat-pill-offset (same convention as Notification).
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:inset-x-auto sm:right-4 sm:bottom-[calc(1rem+var(--chat-pill-offset,0px)+1rem)] sm:px-0 sm:pb-0"
    >
      <div className="mx-auto w-full max-w-[400px]">
        {surface === "session_end" && endedSessionId && (
          <SessionEndFeedbackCard
            userId={userId}
            monitoringSessionId={endedSessionId}
            onResolved={() => setSessionEndDone(true)}
          />
        )}
        {surface === "weekly" && (
          <WeeklyCheckInCard
            userId={userId}
            isoWeekStart={isoWeekStart}
            cadence={cadence}
            onResolved={() => setWeeklyDone(true)}
          />
        )}
      </div>
    </div>
  );
}
