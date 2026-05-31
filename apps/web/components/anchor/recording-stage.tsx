"use client";

import { Button } from "@/components/ui/button";
import type { DriftState } from "@/lib/face-detect/framing";

import { BreathingPacer } from "./breathing-guide";
import { RecordingTimer } from "./recording-timer";

/**
 * The recording controls card (feature 005, FR-015–020) — a sibling BELOW the
 * preview in normal flow, never absolutely positioned over it (so it can't overlap
 * the preview or clip the corner brackets). Every WORD of the recording screen
 * lives here, never on the video: the breathing pacer line, the grace-gated drift
 * nudge (text, role=status, foggy), the 60-second timer (the SOLE progress
 * indicator, horizontally centred), a soft "we've got you" reassurance, and a calm
 * way to stop. The breathing orb + corner brackets stay on the preview, owned by
 * the orchestrator. At 360px the preview and this card both fit, card below.
 */

const DRIFT_NUDGE: Record<Exclude<DriftState, "centred">, string> = {
  "ease-back": "Ease back to centre",
  absent: "We can’t see you — ease back into view",
};

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

  return (
    <div className="space-y-3 rounded-card border border-border bg-surface p-4 shadow-soft sm:p-5">
      <RecordingTimer remaining={remaining} total={60} />
      <BreathingPacer />

      {/* calm drift nudge — the TEXT carries the meaning (a11y: color-not-only),
          foggy never amber/crimson, announced politely; the brackets on the preview
          echo it visually. Recording never auto-stops regardless of drift. */}
      {nudge ? (
        <p
          role="status"
          aria-live="polite"
          className="mx-auto flex w-fit items-center gap-2 rounded-control border border-foggy/40 bg-foggy/10 px-3 py-1.5 text-center text-sm text-ink"
        >
          {nudge}
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
