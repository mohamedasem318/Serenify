"use client";

import { AnchorRecorder } from "@/components/anchor/anchor-recorder";

/**
 * Client wrapper for the calibrate route: a Server Component cannot pass the
 * onComplete/onSkip callbacks across the RSC boundary, so the navigation lives
 * here. Both paths return to /app via a full document navigation (not
 * router.replace) so the proxy re-runs and /app re-renders with the freshly
 * captured anchor — a soft nav would serve a stale Router Cache entry (the
 * /app page cached with its calibration banner). See DECISIONS 2026-05-27.
 */
export function CalibrateRecorder() {
  return (
    <AnchorRecorder
      context="calibrate"
      onComplete={() => window.location.replace("/app")}
      onSkip={() => window.location.replace("/app")}
    />
  );
}
