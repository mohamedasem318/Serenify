"use client";

import { AnchorRecorder } from "@/components/anchor/anchor-recorder";
import { calibrateExit, type RecorderMode } from "@/lib/anchor/calibrate-mode";

/**
 * Client wrapper for the calibrate route: a Server Component cannot pass the
 * onComplete/onSkip callbacks across the RSC boundary, so the navigation lives
 * here. Both paths use a FULL document navigation (window.location.replace, NOT
 * router.replace) for two reasons: (1) the proxy re-runs so the destination
 * re-renders with the freshly captured anchor — a soft nav would serve a stale
 * Router Cache entry (the /app page cached with its calibration banner); and (2)
 * the relaxed `camera=(self)` Permissions-Policy never lingers on a non-capture
 * document. See DECISIONS 2026-05-27, DECISION-16/22.
 *
 * The exit destination follows `mode` (FR-053): a first-time capture returns to
 * `/app` (with the not-yet-calibrated banner); a recalibration returns to
 * `/app/account` with the existing baseline intact. `mode` also nudges the
 * recorder's copy from "set" to "update".
 */
export function CalibrateRecorder({ mode = "first-time" }: { mode?: RecorderMode }) {
  const dest = calibrateExit(mode);
  return (
    <AnchorRecorder
      context="calibrate"
      mode={mode}
      onComplete={() => window.location.replace(dest)}
      onSkip={() => window.location.replace(dest)}
    />
  );
}
