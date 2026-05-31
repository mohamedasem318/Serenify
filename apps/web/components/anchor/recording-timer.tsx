"use client";

import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * The 60-second recording timer (feature 005, FR-016) — the SOLE progress
 * indicator on the recording screen (the breathing guide is not progress). A
 * slim, ambient meadow bar that fills as the minute elapses, plus a tabular
 * mm:ss readout. Subtle by design so it does not compete with the breathing
 * guide. Under reduced motion the bar steps without the smooth tween (FR-048).
 */
export function RecordingTimer({ remaining, total = 60 }: { remaining: number; total?: number }) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const safeRemaining = Math.min(Math.max(remaining, 0), total);
  const elapsed = total - safeRemaining;
  const pct = total > 0 ? (elapsed / total) * 100 : 0;
  const mm = Math.floor(safeRemaining / 60);
  const ss = String(safeRemaining % 60).padStart(2, "0");

  return (
    <div
      role="timer"
      aria-label={`${safeRemaining} second${safeRemaining === 1 ? "" : "s"} remaining`}
      className="mx-auto flex w-full max-w-xs flex-col items-center gap-2"
    >
      <span className="text-sm tabular-nums text-muted">
        {mm}:{ss}
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full bg-meadow ${reducedMotion ? "" : "transition-[width] duration-1000 ease-linear"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
