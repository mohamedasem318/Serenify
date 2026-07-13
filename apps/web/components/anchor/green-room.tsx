"use client";

import type { ReactNode } from "react";

import { Check, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { GateVerdict } from "@/lib/face-detect/framing";
import type { GuideState } from "@/lib/face-detect/use-framing-guide";

/**
 * The green room control panel (feature 005, FR-005–011): get situated before
 * anything records. Sits in a calm card BELOW the live preview — never over it, so
 * it can't hide the framing brackets. The orchestrator owns the preview + the
 * bracket overlay (incl. the meadow "you're set" affirmative); this panel carries
 * the privacy line, the device picker, the gate helper, and the actions.
 *
 * Three guide states, and the user is NEVER locked out (this lives in the US1
 * slice, per analyze finding C1):
 *  - loading → a brief "getting ready" line, "I'm ready" disabled;
 *  - active → the soft gate drives the helper line + enables "I'm ready";
 *  - unavailable → "no live guide — you can still record", the gate is bypassed
 *    (the hook passes `ready`), so "I'm ready" is available (FR-011).
 */

const GATE_HELP: Record<GateVerdict, string> = {
  ready: "You’re all set — start when you’re ready.",
  "no-face": "We can’t see your face yet — come into view.",
  "off-centre": "Ease into the centre of the frame.",
  "too-dark": "A little more light on your face would help.",
};

export function GreenRoom({
  guide,
  gate,
  ready,
  checking = false,
  serviceUnavailable = false,
  devicePicker,
  onReady,
  onNotNow,
}: {
  guide: GuideState;
  gate: GateVerdict;
  ready: boolean;
  /** The explicit readiness request is waiting for a scaled-to-zero API to wake. */
  checking?: boolean;
  /**
   * The `/healthz` gate found the backend down (FR-056). "I'm ready" stays disabled
   * and the status line must NOT affirm ("You're all set"); the blocking modal —
   * rendered by the orchestrator over this card — carries the real message.
   */
  serviceUnavailable?: boolean;
  devicePicker?: ReactNode;
  onReady: () => void;
  onNotNow: () => void;
}) {
  const loading = guide === "loading";
  // Affirmative only when the live detector CONFIRMS the framing — i.e. off the
  // debounced `ready` (held for SET_DEBOUNCE_MS), the SAME signal that enables
  // "I'm ready" and lights the meadow brackets, never the raw per-frame verdict
  // (`gate === "ready"`), which turns ready a render before the debounce confirms
  // it (the line must not lead the button + brackets). Still never for the
  // unavailable bypass (we don't claim "set" for a frame we can't see) nor while the
  // backend is down (nothing is "set" if we can't record).
  const affirmed = !checking && !serviceUnavailable && guide === "active" && ready;
  const helper = checking
    ? "Waking Serenify... This can take about a minute after some time away."
    : serviceUnavailable
      ? "Serenify is unavailable right now."
    : loading
      ? "Getting your live guide ready…"
      : guide === "unavailable"
        ? "No live guide — you can still record."
        : affirmed
          ? GATE_HELP.ready
          : gate === "ready"
            ? // A momentarily-good frame that hasn't yet held for the set-debounce:
              // a calm "almost", NOT a premature "all set". Nudges below still come
              // straight off the raw verdict, so they surface at once.
              "Almost there — hold steady."
            : GATE_HELP[gate];

  return (
    <div className="space-y-3 rounded-card border border-border bg-surface p-4 shadow-soft sm:p-5">
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <Lock className="size-3.5" strokeWidth={1.75} aria-hidden />
        Only you see this.
      </p>

      {devicePicker}

      {/* The status line — the single home for the framing words, so the affirmative
          ("you're all set") lives here and can never clip off the preview. */}
      <p
        aria-live="polite"
        className={`flex min-h-5 items-center justify-center gap-1.5 text-center text-sm ${
          affirmed ? "font-medium text-ink" : "text-muted"
        }`}
      >
        {affirmed ? <Check className="size-4 shrink-0 text-meadow" strokeWidth={2.5} aria-hidden /> : null}
        {loading ? (
          <span aria-hidden className="size-1.5 shrink-0 animate-pulse rounded-full bg-foggy motion-reduce:animate-none" />
        ) : null}
        {helper}
      </p>

      <div className="flex flex-col gap-2">
        <Button
          onClick={onReady}
          disabled={!ready || checking || serviceUnavailable}
          variant="meadow"
          className="h-12 w-full text-base"
        >
          I’m ready
        </Button>
        <Button variant="ghost" onClick={onNotNow} className="h-11 w-full text-muted">
          Not now
        </Button>
      </div>
    </div>
  );
}
