"use client";

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
}: {
  drift?: DriftState;
  /** the green room may keep the brackets quiet before recording starts */
  showNudge?: boolean;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const nudging = showNudge && drift !== "centred";
  const message = nudging ? NUDGE[drift as Exclude<DriftState, "centred">] : null;

  // quiet/receding when centred; foggy when nudging.
  const bracketColor = nudging ? "border-foggy" : "border-white/70";
  const pulse = nudging && !reducedMotion ? "animate-pulse" : "";

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div
        className="relative aspect-[3/4] h-[78%] max-h-full rounded-[28px]"
        // The big spread box-shadow dims everything OUTSIDE the target while the
        // target itself stays clear (sharp face). A calm ink tint, not harsh black.
        style={{ boxShadow: "0 0 0 100vmax rgba(20, 24, 22, 0.46)" }}
      >
        {/* four corner brackets */}
        <span className={`${BRACKET_BASE} ${bracketColor} ${pulse} left-0 top-0 rounded-tl-[28px] border-l-2 border-t-2`} />
        <span className={`${BRACKET_BASE} ${bracketColor} ${pulse} right-0 top-0 rounded-tr-[28px] border-r-2 border-t-2`} />
        <span className={`${BRACKET_BASE} ${bracketColor} ${pulse} bottom-0 left-0 rounded-bl-[28px] border-b-2 border-l-2`} />
        <span className={`${BRACKET_BASE} ${bracketColor} ${pulse} bottom-0 right-0 rounded-br-[28px] border-b-2 border-r-2`} />

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
