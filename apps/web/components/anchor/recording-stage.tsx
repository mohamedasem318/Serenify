"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { DriftState } from "@/lib/face-detect/framing";

import { RecordingTimer } from "./recording-timer";

/**
 * The recording controls card (feature 005, FR-015–020) — a sibling BELOW the
 * preview in normal flow, never absolutely positioned over it (so it can't overlap
 * the preview or clip the corner brackets). It carries the precise mm:ss readout,
 * the grace-gated drift nudge (text, role=status, foggy), a soft "we've got you"
 * reassurance, and a calm way to stop. The capture progress BAR hugs the preview
 * (orchestrator-owned, FR-030); the breathing orb carries the breathe pacer on the
 * preview. All status WORDS live here, off the raw video (FR-031). At 360px the
 * preview and this card both fit, card below.
 */

const DRIFT_NUDGE: Record<Exclude<DriftState, "centred">, string> = {
  "ease-back": "Ease back to centre",
  absent: "We can’t see you — ease back into view",
};

// Hold the displayed nudge for at least this long before letting it change. The
// upstream drift signal is per-frame noisy at the detection boundary (it derives
// "ease-back" vs "absent" from the instantaneous face-present bit), so without a
// dwell the visible message flips between the two off-centre lines every detection
// frame (~285ms). This is a PRESENTATION-layer smoothing of the displayed message
// only (FR-031's calm-nudge intent) — the tracking signal itself is untouched.
const NUDGE_DWELL_MS = 500;

/**
 * Show `value`, but never let the displayed value change faster than `dwellMs`. The
 * first value shows immediately; subsequent changes are throttled and always
 * converge to the latest value (a brief flip back to the current value within the
 * window cancels a pending change). Presentation-only — no tracking logic here.
 */
function useDwelledValue<T>(value: T, dwellMs: number): T {
  const [shown, setShown] = useState(value);
  const latest = useRef(value);
  const lastChangeAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latest.current = value;
    if (value === shown) return;
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    const elapsed = now - lastChangeAt.current;
    const commit = () => {
      lastChangeAt.current = typeof performance !== "undefined" ? performance.now() : 0;
      setShown(latest.current);
    };
    if (elapsed >= dwellMs) {
      commit();
    } else if (!timer.current) {
      timer.current = setTimeout(() => {
        timer.current = null;
        commit();
      }, dwellMs - elapsed);
    }
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [value, shown, dwellMs]);

  return shown;
}

export function RecordingStage({
  remaining,
  drift = "centred",
  onStop,
}: {
  remaining: number;
  drift?: DriftState;
  onStop: () => void;
}) {
  const nudge = drift !== "centred" ? DRIFT_NUDGE[drift] : null;
  const shownNudge = useDwelledValue(nudge, NUDGE_DWELL_MS);

  return (
    <div className="space-y-3 rounded-card border border-border bg-surface p-4 shadow-soft sm:p-5">
      <RecordingTimer remaining={remaining} total={60} />

      {/* calm drift nudge — the TEXT carries the meaning (a11y: color-not-only),
          foggy never amber/crimson, announced politely; the brackets on the preview
          echo it visually. The displayed message is dwelled so a noisy off-centre
          signal can't flash it. Recording never auto-stops regardless of drift. */}
      {shownNudge ? (
        <p
          role="status"
          aria-live="polite"
          className="mx-auto flex w-fit items-center gap-2 rounded-control border border-foggy/40 bg-foggy/10 px-3 py-1.5 text-center text-sm text-ink"
        >
          {shownNudge}
        </p>
      ) : null}

      <p className="text-center text-sm text-muted">We’ve got you — just keep breathing.</p>

      {/* calm stop (NOT destructive — no crimson); opens the honest confirmation */}
      <Button variant="ghost" onClick={onStop} className="h-11 w-full text-muted">
        Stop
      </Button>
    </div>
  );
}
