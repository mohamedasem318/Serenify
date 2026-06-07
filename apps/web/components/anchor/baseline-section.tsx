"use client";

import { Check, Minus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Account "Your calm baseline" section (feature 005 — T025; 📌 DECISION-22/23,
 * FR-036/037/041/055). It surfaces ONLY whether a baseline is set — never the
 * capture date, never another user's state (DECISION-23 / FR-041) — plus a quiet
 * way to set a new one.
 *
 * When a baseline already exists, "Set a new baseline" opens an honest heads-up
 * (FR-037): replacing it is calm and reversible-until-committed, so the surface is
 * MEADOW/neutral, never the destructive crimson. The forward action is a
 * FULL-DOCUMENT navigation — a plain anchor element, never a client-side Link or a
 * router-driven transition — so `/app/calibrate` loads with its own
 * `camera=(self)` Permissions-Policy
 * (FR-055 / 004 DECISION-16), the same invariant the home-banner CTA holds. When no
 * baseline is set yet there is nothing to replace, so the CTA navigates straight in
 * (still a full-document `<a href>`); the calibrate route reconciles the stray
 * `?mode=recalibrate` to first-time semantics (clarification #3 / T026).
 *
 * Voice (Principle V / FR-040): the copy talks about the baseline itself and never
 * implies live stress monitoring or check-ins are already running. No exclamation
 * marks; "noticed" not "detected".
 */

// Both CTAs lead here. The route reconciles mode against the real has_anchor, so a
// not-yet-calibrated user arriving with this param is treated as first-time (T026).
const RECALIBRATE_HREF = "/app/calibrate?mode=recalibrate";

export function BaselineSection({ hasAnchor }: { hasAnchor: boolean }) {
  const [headsUpOpen, setHeadsUpOpen] = useState(false);

  return (
    <section aria-labelledby="account-baseline-heading" className="space-y-6">
      <header className="space-y-1">
        <h2
          id="account-baseline-heading"
          className="font-display text-2xl leading-tight text-ink"
        >
          Your calm baseline
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          {hasAnchor
            ? "Serenify has a calm reference for you. You can set a new one whenever you like — it takes about a quiet minute."
            : "Your calm baseline isn’t set yet. Setting it takes about a quiet minute to yourself."}
        </p>
      </header>

      {/* Whether-set indicator — set vs not-set ONLY (no date; FR-041 / DECISION-23).
          Colour is never the sole signal: the label text carries the same meaning. */}
      <div className="flex flex-col gap-4 rounded-control border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full ${
              hasAnchor ? "bg-meadow/15 text-meadow" : "bg-ink/5 text-muted"
            }`}
          >
            {hasAnchor ? <Check className="size-4" /> : <Minus className="size-4" />}
          </span>
          <p className="text-sm font-medium text-ink">
            {hasAnchor ? "Baseline set" : "Not set yet"}
          </p>
        </div>

        {hasAnchor ? (
          <Button
            type="button"
            variant="meadow"
            className="h-11 w-full sm:w-auto"
            onClick={() => setHeadsUpOpen(true)}
          >
            Set a new baseline
          </Button>
        ) : (
          // Nothing to replace yet, so skip the heads-up and go straight in — still a
          // plain <a href> (full nav, not <Link>) so camera=(self) applies (FR-055).
          <Button asChild variant="meadow" className="h-11 w-full sm:w-auto">
            <a href={RECALIBRATE_HREF}>Set your baseline</a>
          </Button>
        )}
      </div>

      {/* Replace heads-up (FR-037) — reachable only when a baseline exists, so
          "Keep current" always has something current to keep. Reuses the shared
          themed Dialog (same surface/border tokens + focus-visible ring as the
          stop-confirm and backend-down modals). Calm/forward surface: MEADOW primary
          + neutral back-out, never foggy/amber/crimson. */}
      <Dialog open={headsUpOpen} onOpenChange={setHeadsUpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set a new baseline?</DialogTitle>
            <DialogDescription>
              This takes a fresh calm minute and replaces the baseline you have now.
              We only swap it in once the new one is set — until then, your current
              baseline stays exactly as it is.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            {/* Primary, forward action → MEADOW. FULL-DOCUMENT navigation (a plain
                anchor, never a client-side Link or router transition) so
                /app/calibrate?mode=recalibrate loads with camera=(self)
                (FR-055 / DECISION-16). */}
            <Button asChild variant="meadow" className="h-11 w-full">
              <a href={RECALIBRATE_HREF}>Set new baseline</a>
            </Button>
            {/* Quiet back-out → neutral outline. Leaves the existing baseline
                untouched and does not launch the flow (FR-037). */}
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              onClick={() => setHeadsUpOpen(false)}
            >
              Keep current
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
