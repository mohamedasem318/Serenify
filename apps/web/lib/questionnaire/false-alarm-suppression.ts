/**
 * Feature 012 / US1 — next-session false-alarm suppression store.
 *
 * After a `false_alarm` answer, the confirmatory prompt is suppressed for exactly the NEXT
 * monitoring session, then re-enabled. Because ending a session full-navigates the monitor
 * page back to the dashboard (the page unmounts between sessions), the one-shot flag is kept
 * in `sessionStorage` — browser-local and per-tab, NOT cross-worker or server state. The
 * trigger state machine stays storage-free; only this host-side store touches `sessionStorage`.
 */

const KEY = "serenify.confirmatory.suppress_next_session";

export function armFalseAlarmSuppression(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // sessionStorage unavailable (SSR / privacy mode) — suppression is best-effort.
  }
}

export function hasFalseAlarmSuppression(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function consumeFalseAlarmSuppression(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // no-op
  }
}
