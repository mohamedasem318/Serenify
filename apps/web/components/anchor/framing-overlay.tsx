"use client";

import { Check } from "lucide-react";

import { useMediaQuery } from "@/hooks/use-media-query";
import type { DriftState } from "@/lib/face-detect/framing";

/**
 * The fixed, centred portrait target (feature 005, FR-005/006/017). A steady guide
 * the user settles INTO — NOT a box that tracks or hugs the face. The area outside
 * the target is gently dimmed (a soft spotlight) so the brackets stay legible over
 * any background and the eye is drawn to centre. Reused by the green room and the
 * recording stage; GRAPHICS ONLY — no words on the video.
 *
 * Two-colour signal, kept obvious (no third alarm colour — red/amber are wrong for a
 * calming screen; foggy reads as a gentle "needs attention"):
 *  - Recording (showNudge): centred → STEADY meadow brackets (good); off-centre →
 *    BLINKING foggy brackets (ease back). No checkmark here — the check is exclusive
 *    to the green-room affirmative.
 *  - Green room / get-ready (showNudge=false): quiet white brackets, turning to the
 *    meadow affirmative (brackets + glow + check) the moment the soft gate clears.
 *
 * The brackets are thin lines over arbitrary video, so each carries a soft dark edge
 * halo (`drop-shadow`) — a legibility treatment, not surface elevation — so the
 * coloured stroke survives on both a bright and a dark feed. Reduced motion (FR-048)
 * drops the blink, conveying the off-centre state by hue alone (the card text below
 * still carries the words, so meaning is never colour-only).
 */

const BRACKET_BASE =
  "pointer-events-none absolute h-7 w-7 transition-colors duration-300 motion-reduce:transition-none drop-shadow-[0_0_2px_rgba(0,0,0,0.7)]";

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
   * turns MEADOW with a gentle glow + a quiet check. Visual only — the control panel
   * announces it. Ignored in recording (drift-feedback) mode.
   */
  gateReady?: boolean;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // Recording uses the brackets to signal framing; the green room / get-ready keep
  // them quiet (showNudge=false) and lean on the gate affirmative instead.
  const driftFeedback = showNudge;
  const off = driftFeedback && drift !== "centred";
  const centredGood = driftFeedback && drift === "centred";
  const affirming = !driftFeedback && gateReady;

  // foggy = come back; meadow = good (centred while recording, or gate cleared in the
  // green room); white = quiet/neutral before any signal.
  const bracketColor = off
    ? "border-foggy"
    : centredGood || affirming
      ? "border-meadow"
      : "border-white/70";
  const blink = off && !reducedMotion ? "animate-pulse" : "";

  // The green-room affirmative layers a meadow halo (outer + inset, so it survives
  // the preview's overflow-hidden). Recording-centred keeps just the steady meadow
  // brackets — no halo competing with the breathing orb.
  const spotlight = "0 0 0 100vmax rgba(20, 24, 22, 0.46)";
  const boxShadow = affirming
    ? `${spotlight}, 0 0 26px 1px var(--color-meadow), inset 0 0 22px 0 var(--color-meadow)`
    : spotlight;

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div
        className="relative aspect-[3/4] h-[78%] max-h-full rounded-[28px] transition-shadow duration-500 motion-reduce:transition-none"
        style={{ boxShadow }}
      >
        {/* four corner brackets — hue carries the state, the dark edge halo keeps the
            stroke visible on any feed */}
        <span className={`${BRACKET_BASE} ${bracketColor} ${blink} left-0 top-0 rounded-tl-[28px] border-l-2 border-t-2`} />
        <span className={`${BRACKET_BASE} ${bracketColor} ${blink} right-0 top-0 rounded-tr-[28px] border-r-2 border-t-2`} />
        <span className={`${BRACKET_BASE} ${bracketColor} ${blink} bottom-0 left-0 rounded-bl-[28px] border-b-2 border-l-2`} />
        <span className={`${BRACKET_BASE} ${bracketColor} ${blink} bottom-0 right-0 rounded-br-[28px] border-b-2 border-r-2`} />

        {/* affirmative check — green room ONLY (never on the recording screen) */}
        {affirming ? (
          <span
            aria-hidden
            className="absolute left-1/2 top-2.5 grid size-7 -translate-x-1/2 place-items-center rounded-full bg-meadow text-bg shadow-soft"
          >
            <Check className="size-4" strokeWidth={2.5} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
