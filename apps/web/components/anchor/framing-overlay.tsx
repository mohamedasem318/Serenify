"use client";

import { Check } from "lucide-react";

import { useMediaQuery } from "@/hooks/use-media-query";
import type { DriftState } from "@/lib/face-detect/framing";

/**
 * The fixed, centred portrait target (feature 005, FR-005/006/017). A steady guide
 * the user settles INTO — NOT a box that tracks or hugs the face. The area outside
 * the target is gently dimmed (a soft spotlight) so the brackets stay legible over
 * any background and the eye is drawn to centre; the face area stays sharp. Reused
 * by the green room and the recording stage.
 *
 * Calm discipline (Principle V): brackets are quiet/receding when centred and shift
 * to FOGGY (never amber/crimson) for a drift nudge — and the nudge always carries
 * TEXT, never colour alone (a11y: color-not-only). Reduced motion (FR-048) removes
 * the transition/pulse, conveying the same state instantly.
 */

const NUDGE: Record<Exclude<DriftState, "centred">, string> = {
  "ease-back": "Ease back to centre",
  absent: "We can’t see you — ease back into view",
};

const BRACKET_BASE =
  "pointer-events-none absolute h-7 w-7 transition-colors duration-300 motion-reduce:transition-none";

export function FramingOverlay({
  drift = "centred",
  showNudge = true,
  gateReady = false,
}: {
  drift?: DriftState;
  /** the green room may keep the brackets quiet before recording starts */
  showNudge?: boolean;
  /**
   * Green-room affirmative (FR-008): face present + centred + lit. The fixed target
   * turns MEADOW with a gentle glow + a quiet check, so the user gets positive
   * feedback before "I'm ready". Visual only — the control panel announces it.
   */
  gateReady?: boolean;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const nudging = showNudge && drift !== "centred";
  const message = nudging ? NUDGE[drift as Exclude<DriftState, "centred">] : null;
  const affirming = gateReady && !nudging;

  // quiet/receding when centred; foggy when nudging; meadow when the gate clears.
  const bracketColor = nudging ? "border-foggy" : affirming ? "border-meadow" : "border-white/70";
  const pulse = nudging && !reducedMotion ? "animate-pulse" : "";

  // The big spread box-shadow dims everything OUTSIDE the target (sharp face); a
  // soft meadow halo is layered on once the user is set — calm, not loud.
  const spotlight = "0 0 0 100vmax rgba(20, 24, 22, 0.46)";
  const boxShadow = affirming ? `${spotlight}, 0 0 26px 1px var(--color-meadow)` : spotlight;

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div
        className="relative aspect-[3/4] h-[78%] max-h-full rounded-[28px] transition-shadow duration-500 motion-reduce:transition-none"
        style={{ boxShadow }}
      >
        {/* four corner brackets */}
        <span className={`${BRACKET_BASE} ${bracketColor} ${pulse} left-0 top-0 rounded-tl-[28px] border-l-2 border-t-2`} />
        <span className={`${BRACKET_BASE} ${bracketColor} ${pulse} right-0 top-0 rounded-tr-[28px] border-r-2 border-t-2`} />
        <span className={`${BRACKET_BASE} ${bracketColor} ${pulse} bottom-0 left-0 rounded-bl-[28px] border-b-2 border-l-2`} />
        <span className={`${BRACKET_BASE} ${bracketColor} ${pulse} bottom-0 right-0 rounded-br-[28px] border-b-2 border-r-2`} />

        {/* affirmative — a quiet meadow check INSIDE the target the moment the gate
            clears. Visual only (the control-card status line carries the words, so
            it can't clip); kept inside the target box so it never overflows the
            preview. */}
        {affirming ? (
          <span
            aria-hidden
            className="absolute left-1/2 top-2.5 grid size-7 -translate-x-1/2 place-items-center rounded-full bg-meadow text-bg shadow-soft"
          >
            <Check className="size-4" strokeWidth={2.5} />
          </span>
        ) : null}

        {/* calm drift nudge — text + foggy, announced politely to screen readers */}
        {message ? (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-x-0 -bottom-12 mx-auto flex w-fit items-center gap-2 rounded-control border border-foggy/40 bg-foggy/15 px-3 py-1.5 text-sm text-ink backdrop-blur-0 motion-safe:transition-opacity"
          >
            {message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
