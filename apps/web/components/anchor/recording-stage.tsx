"use client";

import { Button } from "@/components/ui/button";
import type { DriftState } from "@/lib/face-detect/framing";

import { BreathingGuide } from "./breathing-guide";
import { FramingOverlay } from "./framing-overlay";
import { RecordingTimer } from "./recording-timer";

/**
 * The 60-second recording surface (feature 005, FR-015–020). An overlay over the
 * orchestrator's persistent, softened <video>: the breathing guide is the focal
 * point (the softness reads as deliberate because the guide sits on top), the
 * corner brackets persist as an ambient framing layer with the grace-gated drift
 * nudge, the 60-second timer is the SOLE progress indicator, a soft "we've got
 * you" reassurance is present, and there is a clear, calm way to stop.
 */
export function RecordingStage({
  remaining,
  drift = "centred",
  onStop,
}: {
  remaining: number;
  drift?: DriftState;
  onStop: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col">
      <FramingOverlay drift={drift} />

      {/* focal breathing guide, centred over the softened preview */}
      <div className="grid flex-1 place-items-center">
        <BreathingGuide />
      </div>

      <div className="space-y-3 rounded-t-card border-t border-border bg-surface/95 p-4 backdrop-blur-sm sm:p-5">
        <RecordingTimer remaining={remaining} total={60} />
        <p className="text-center text-sm text-muted">We’ve got you — just keep breathing.</p>
        {/* calm stop (NOT destructive — no crimson); opens the honest confirmation */}
        <Button variant="ghost" onClick={onStop} className="h-11 w-full text-muted">
          Stop
        </Button>
      </div>
    </div>
  );
}
