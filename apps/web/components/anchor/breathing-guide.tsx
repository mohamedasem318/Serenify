"use client";

import { useEffect, useState } from "react";

import { motion } from "framer-motion";

import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * The breathing guide (feature 005, FR-015/016) splits across the preview seam: the
 * ORB is the focal graphic ON the softened preview, the PACER line is the words in
 * the controls card BELOW it (the global "no words on the video" rule). It is not a
 * progress indicator — the 60-second timer is the sole progress.
 */

/**
 * The orb sits on its OWN seating, never on the bare feed: a soft dark radial
 * vignette darkens the camera frame locally so the orb's visibility no longer
 * depends on what the camera happens to see (a bright face, a dark room, a busy
 * background). The vignette is feathered to nothing at its rim — deliberately NOT a
 * hard opaque disc, which would read heavy and clinical. The orb itself is a
 * luminous pale-meadow glow (a soft "breath light", carrying the "with the light"
 * idea visually so the copy doesn't have to). Measured orb-vs-seating contrast is
 * ~4:1 over a worst-case bright feed and ~10:1 over a dark feed — comfortably past
 * the 3:1 WCAG non-text bar. Pale sage is an intentional calmer choice over a pure
 * white core (which would measure higher but read clinical).
 */
const SEATING =
  "radial-gradient(circle, rgba(16,20,18,0.72) 0%, rgba(16,20,18,0.36) 46%, rgba(16,20,18,0) 72%)";
const ORB_GLOW =
  "radial-gradient(circle, color-mix(in srgb, var(--color-meadow) 58%, white) 0%, color-mix(in srgb, var(--color-meadow) 80%, transparent) 50%, transparent 74%)";

export function BreathingOrb() {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  return (
    <div className="relative grid size-44 place-items-center sm:size-52">
      {/* seating — local vignette so the orb never depends on the feed behind it */}
      <div aria-hidden className="absolute inset-0 rounded-full" style={{ background: SEATING }} />
      {reducedMotion ? (
        <div aria-hidden className="size-28 rounded-full sm:size-32" style={{ background: ORB_GLOW }} />
      ) : (
        <motion.div
          aria-hidden
          className="size-28 rounded-full sm:size-32"
          style={{ background: ORB_GLOW }}
          initial={{ scale: 0.62 }}
          animate={{ scale: [0.62, 1, 0.62] }}
          // 10s cycle: 0→40% = 4s inhale, 40→100% = 6s exhale (FR-016)
          transition={{ duration: 10, times: [0, 0.4, 1], repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}

const PHASE_LABEL = { in: "Breathe in", out: "Breathe out" } as const;

/**
 * The pacer line — lives in the controls card below the preview. With motion it's a
 * single calm instruction. Under reduced motion (FR-048) it becomes a STEPPED cue
 * that swaps "Breathe in" (held 4s) / "Breathe out" (held 6s) on the breath
 * cadence, with an instant content swap (no transition) — a true motion-free pacer.
 */
export function BreathingPacer() {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    if (!reducedMotion) return;
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
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <p aria-live="polite" className="text-center text-base text-ink">
        {PHASE_LABEL[phase]}
      </p>
    );
  }
  return (
    <p className="text-center text-base text-ink">Breathe with the light — in for four, out for six.</p>
  );
}
