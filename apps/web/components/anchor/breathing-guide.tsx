"use client";

import { useEffect, useState } from "react";

import { motion } from "framer-motion";

import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * The breathing guide (feature 005, FR-015/016) — the focal graphic ON the softened
 * preview. The stepped "Breathe in" / "Breathe out" pacer now lives ON the orb,
 * centred over its luminous core, so attention stays in one place; the controls card
 * below keeps the timer, drift nudge, reassurance, and Stop. It is not a progress
 * indicator — the 60-second timer is the sole progress.
 *
 * Layers, back to front:
 *  - SEATING — a soft dark radial vignette that darkens the camera frame locally so
 *    the orb never depends on what the camera sees (bright face, dark room, busy
 *    background). Feathered to nothing at its rim — deliberately NOT a hard disc.
 *  - ORB_GLOW — a pale-meadow glow that breathes (scales 0.62↔1) behind the words.
 *  - ORB_CORE — a STATIC luminous core: opaque pale-meadow through the centre so the
 *    label always sits on a KNOWN backing (never on raw video), feathered at the rim
 *    so it reads as a soft core rather than a clinical disc. Because it does not
 *    scale, it fully backs the fixed-size label even at the breath's smallest point.
 *  - the label — fixed size, centred, never scales while the glow grows/shrinks.
 *
 * Text-vs-core contrast (ink/bg over the opaque core centre, a known backing):
 * ≈ 7.3:1 in light, ≈ 10.3:1 in dark. Over a real feed the seating + glow soften it;
 * legibility is judged by eye (a manual smoke check).
 */

const PHASE_LABEL = { in: "Breathe in", out: "Breathe out" } as const;

const SEATING =
  "radial-gradient(circle, rgba(16,20,18,0.72) 0%, rgba(16,20,18,0.36) 46%, rgba(16,20,18,0) 72%)";
const ORB_GLOW =
  "radial-gradient(circle, color-mix(in srgb, var(--color-meadow) 58%, white) 0%, color-mix(in srgb, var(--color-meadow) 80%, transparent) 52%, transparent 76%)";
const ORB_CORE =
  "radial-gradient(circle, " +
  "color-mix(in srgb, var(--color-meadow) 66%, white) 0%, " +
  "color-mix(in srgb, var(--color-meadow) 66%, white) 56%, " +
  "color-mix(in srgb, var(--color-meadow) 55%, transparent) 74%, " +
  "transparent 88%)";

export function BreathingOrb() {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [phase, setPhase] = useState<"in" | "out">("in");

  // The breath pacer (BOTH the animated and reduced-motion paths): swap the label on
  // the 4s-in / 6s-out cadence with an instant content swap (FR-048). On the animated
  // path the glow scales on the same cadence; under reduced motion the orb is static
  // and the label cadence alone carries the pace — a true motion-free equivalent.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (current: "in" | "out") => {
      // hold the inhale for 4s, the exhale for 6s, then swap (instant, no tween)
      timer = setTimeout(
        () => {
          if (cancelled) return;
          const next = current === "in" ? "out" : "in";
          setPhase(next);
          schedule(next);
        },
        current === "in" ? 4000 : 6000,
      );
    };
    // initial render already shows the inhale (useState "in"); just start the loop
    schedule("in");
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="relative grid size-44 place-items-center sm:size-52">
      {/* seating — local vignette so the orb never depends on the feed behind it */}
      <div aria-hidden className="absolute inset-0 rounded-full" style={{ background: SEATING }} />

      {/* the breath — a pale-meadow glow that scales behind the words (static under
          reduced motion, where the label cadence carries the pace instead) */}
      {reducedMotion ? (
        <div aria-hidden className="absolute size-44 rounded-full sm:size-52" style={{ background: ORB_GLOW }} />
      ) : (
        <motion.div
          aria-hidden
          className="absolute size-44 rounded-full sm:size-52"
          style={{ background: ORB_GLOW }}
          initial={{ scale: 0.62 }}
          animate={{ scale: [0.62, 1, 0.62] }}
          // 10s cycle: 0→40% = 4s inhale, 40→100% = 6s exhale (FR-016)
          transition={{ duration: 10, times: [0, 0.4, 1], repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* static luminous core — backs the words at any breath scale */}
      <div aria-hidden className="absolute size-40 rounded-full sm:size-44" style={{ background: ORB_CORE }} />

      {/* the pacer label — fixed size, centred over the core, NEVER scales so it
          stays legible while the breath glow grows and shrinks behind it. Dark text
          in both modes (the core is pale-meadow in both): text-ink / dark:text-bg. */}
      <p
        aria-live="polite"
        className="absolute text-center text-sm font-semibold tracking-wide text-ink dark:text-bg"
      >
        {PHASE_LABEL[phase]}
      </p>
    </div>
  );
}
