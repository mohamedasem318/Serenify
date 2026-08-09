"use client";

import {
  dismissAnchorPrompt,
  useAnchorPromptDismissed,
} from "@/components/anchor/use-anchor-prompt-dismissal";
import { Button } from "@/components/ui/button";

/**
 * Calibration prompt on /app for an employee with no stored anchor (FR-021).
 * Dismissal is session-only (FR-023) — it reappears next session until the
 * anchor is captured (FR-024). Foggy — a "needs your attention, not stress"
 * state (FR-043) — never amber or red; calm voice (Principle V). The render
 * site (/app) already gates this to employees, so this component is unconditional.
 *
 * The dismissal store — including the SSR anti-flash snapshot (📌 ST-11 fix
 * 2026-05-28), the sign-out reset, and the cross-tab mirror — now lives in
 * `use-anchor-prompt-dismissal.ts`, shared verbatim with the recalibration prompt.
 * It was EXTRACTED from this file unchanged; nothing about this banner's behaviour
 * moved with it.
 */
export function CalibrationBanner() {
  const dismissed = useAnchorPromptDismissed();

  if (dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Calibration"
      className="rounded-control border border-foggy/50 bg-foggy/10 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-ink">
          Stress detection isn&apos;t active yet — it needs about a minute of calibration to
          know what your calm looks like.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {/* Plain <a> (NOT next/link) — a full document navigation is REQUIRED
              so /app/calibrate loads with its own `camera=(self)` Permissions-
              Policy. Next App Router's client-side <Link> navigation never
              reloads the document, so the active PP stays /app's `camera=()`
              and getUserMedia is rejected with "Permissions policy violation".
              Same idiom as the Router Cache hard-nav fix (DECISIONS 2026-05-27).
              See docs/CHANGELOG.md 2026-05-28. */}
          {/* FOGGY-filled CTA — the same `variant="foggy"` shipped on the
              failure-state and camera-access screens (FR-043). This surface is
              "attention, not affirmative-forward", so it is foggy, NOT meadow. The
              shared Button's Phase-1 foggy variant carries the AA-fixed foreground
              (on-accent in light, bg-token in dark), legible on the foggy fill in
              both modes. */}
          <Button asChild variant="foggy" className="h-11">
            <a href="/app/calibrate">Set baseline</a>
          </Button>
          <Button variant="ghost" className="h-11" onClick={dismissAnchorPrompt}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
