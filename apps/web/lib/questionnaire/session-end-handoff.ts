/**
 * Feature 012 / US2+US4 — the just-ended monitoring session handoff.
 *
 * The monitor page full-navigates to the dashboard when a session ends, so the dashboard
 * coordinator learns which session just ended through a one-shot `sessionStorage` token
 * (browser-local, per-tab — NOT cross-worker/server state). The monitor records the id on
 * end; the coordinator TAKES it (read + clear) on its first dashboard mount, so session-end
 * feedback is offered exactly once per ended session. The DB `UNIQUE(monitoring_session_id)`
 * on `questionnaire_session_feedback` is the backstop.
 */

const KEY = "serenify.questionnaire.last_ended_session";

export function recordEndedSession(monitoringSessionId: string): void {
  try {
    sessionStorage.setItem(KEY, monitoringSessionId);
  } catch {
    // sessionStorage unavailable — session-end feedback is best-effort.
  }
}

/** Read and clear the just-ended session id (one-shot). */
export function takeEndedSession(): string | null {
  try {
    const id = sessionStorage.getItem(KEY);
    if (id) sessionStorage.removeItem(KEY);
    return id;
  } catch {
    return null;
  }
}
