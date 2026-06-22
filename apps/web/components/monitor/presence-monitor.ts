/**
 * Presence timing controller (feature 008, US2 — T038). The two absence timers behind the
 * out-of-frame lifecycle, factored OUT of the orchestrator so the 90 s / 5 min logic is a
 * tiny, deterministic unit (fake-timer-testable in isolation — `vi.useFakeTimers()` drives
 * the real `setTimeout`s; FR-005, SC-006).
 *
 * It is deliberately dumb about op-state: it only tracks **continuous** face absence and
 * fires three edges. The orchestrator decides what each edge means (it only auto-pauses
 * from a live op, only auto-resumes from out-of-frame, etc.):
 *
 *   faceLost ──(no return)── 90 s ─▶ onOutOfFrame   (FR-005: auto-pause)
 *            └─(no return)── 5 min ─▶ onAutoEnd      (FR-005: hard auto-end)
 *   faceSeen (after any absence) ───▶ onReturn       (FR-007/SC-006: auto-resume)
 *
 * "Continuous" is faithful to the spec: any face reappearance resets the clock (the
 * detector's own SCORE_MIN already filters weak detections, so a single stray frame
 * restarting the 90 s count is the intended reading, not a bug). The orchestrator feeds
 * `faceSeen()` / `faceLost()` from the SAME feature-005 framing signal it already uses to
 * gate uploads (FR-003) — no second detection mechanism.
 */

/** FR-005: auto-pause after 90 continuous seconds with no face. */
export const OUT_OF_FRAME_AFTER_MS = 90_000;
/** FR-005: hard auto-end after 5 minutes of continuous absence. */
export const AUTO_END_AFTER_MS = 300_000;

export interface PresenceCallbacks {
  /** 90 s of continuous no-face reached. */
  onOutOfFrame: () => void;
  /** Face returned after an absence (fires on the absent→present edge only). */
  onReturn: () => void;
  /** 5 min of continuous absence reached. */
  onAutoEnd: () => void;
}

export interface PresenceMonitorOptions {
  /** Override the thresholds (tests/tuning); default to the FR-005 values. */
  outOfFrameAfterMs?: number;
  autoEndAfterMs?: number;
}

export interface PresenceMonitorHandle {
  /** Feed a face-present signal. No-op unless we were counting an absence (resumes). */
  faceSeen(): void;
  /** Feed a no-face signal. Starts the absence clock on the present→absent edge only. */
  faceLost(): void;
  /** Cancel all timers and reset (manual pause / end / unmount). */
  stop(): void;
}

export function createPresenceMonitor(
  cb: PresenceCallbacks,
  opts: PresenceMonitorOptions = {},
): PresenceMonitorHandle {
  const outOfFrameAfterMs = opts.outOfFrameAfterMs ?? OUT_OF_FRAME_AFTER_MS;
  const autoEndAfterMs = opts.autoEndAfterMs ?? AUTO_END_AFTER_MS;

  let absent = false;
  let oofTimer: ReturnType<typeof setTimeout> | null = null;
  let endTimer: ReturnType<typeof setTimeout> | null = null;

  function clearTimers() {
    if (oofTimer !== null) {
      clearTimeout(oofTimer);
      oofTimer = null;
    }
    if (endTimer !== null) {
      clearTimeout(endTimer);
      endTimer = null;
    }
  }

  return {
    faceLost() {
      if (absent) return; // already counting — keep the continuous clock running
      absent = true;
      // Both clocks start at face-loss: out-of-frame at 90 s, auto-end at 5 min of
      // CONTINUOUS absence (SC-006), so auto-end is 3.5 min past the out-of-frame pause.
      oofTimer = setTimeout(() => {
        oofTimer = null;
        cb.onOutOfFrame();
      }, outOfFrameAfterMs);
      endTimer = setTimeout(() => {
        endTimer = null;
        cb.onAutoEnd();
      }, autoEndAfterMs);
    },
    faceSeen() {
      if (!absent) return; // already present — nothing to resume
      absent = false;
      clearTimers();
      cb.onReturn();
    },
    stop() {
      absent = false;
      clearTimers();
    },
  };
}
