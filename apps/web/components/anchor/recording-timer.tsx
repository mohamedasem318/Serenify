"use client";

import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * Recording progress for the calm capture minute (feature 005 FR-016; redesigned
 * for 007 FR-030/031/032). Two pieces, split so progress reads where each belongs:
 *
 *  - {@link CaptureProgressBar} — a slim meadow bar that fills as the minute
 *    elapses, rendered HUGGING the preview (directly below it) by the orchestrator.
 *    This is the visual capture progress (FR-030: a bar, never a ring around the
 *    orb). Decorative (aria-hidden) — the readout carries the accessible value.
 *    Under reduced motion the fill still ADVANCES each tick, just without the smooth
 *    tween (FR-032 — functional feedback, not ambient motion).
 *  - {@link RecordingTimer} — the precise mm:ss readout, shown in the controls card
 *    BELOW the preview (FR-031 — status text never sits on the raw video), exposed
 *    as an accessible `timer`.
 */

function elapsedPct(remaining: number, total: number): number {
  const safe = Math.min(Math.max(remaining, 0), total);
  return total > 0 ? ((total - safe) / total) * 100 : 0;
}

export function CaptureProgressBar({
  remaining,
  total = 60,
}: {
  remaining: number;
  total?: number;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const pct = elapsedPct(remaining, total);

  return (
    <div aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-meadow/15">
      <div
        className={`h-full rounded-full bg-meadow ${
          reducedMotion ? "" : "transition-[width] duration-1000 ease-linear"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function RecordingTimer({
  remaining,
  total = 60,
}: {
  remaining: number;
  total?: number;
}) {
  const safeRemaining = Math.min(Math.max(remaining, 0), total);
  const mm = Math.floor(safeRemaining / 60);
  const ss = String(safeRemaining % 60).padStart(2, "0");

  return (
    <p
      role="timer"
      aria-label={`${safeRemaining} second${safeRemaining === 1 ? "" : "s"} remaining`}
      className="text-center text-sm tabular-nums text-muted"
    >
      {mm}:{ss}
    </p>
  );
}
