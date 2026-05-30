"use client";

import { motion } from "framer-motion";

import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * The breathing guide (feature 005, FR-015/016). The FOCAL point of the recording
 * screen — a slow 4-in / 6-out rhythm so the user follows the breath rather than
 * scrutinising their own face. It is **not** a progress indicator (no progressbar
 * role; the 60-second timer is the sole progress). Under reduced motion (FR-048)
 * the circle is static and a textual cue conveys the same rhythm — a true
 * motion-free equivalent, gated by the shared hook (not the CSS clamp).
 */
export function BreathingGuide() {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative grid size-44 place-items-center sm:size-52">
        <div aria-hidden className="absolute inset-0 rounded-full bg-meadow/10" />
        {reducedMotion ? (
          <div aria-hidden className="size-28 rounded-full bg-meadow/25 ring-1 ring-meadow/40" />
        ) : (
          <motion.div
            aria-hidden
            className="size-28 rounded-full bg-meadow/25 ring-1 ring-meadow/40"
            initial={{ scale: 0.62 }}
            animate={{ scale: [0.62, 1, 0.62] }}
            // 10s cycle: 0→40% = 4s inhale, 40→100% = 6s exhale (FR-016)
            transition={{ duration: 10, times: [0, 0.4, 1], repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
      <p className="text-center text-base text-ink">
        {reducedMotion ? "Breathe in for four, out for six." : "Breathe with the light — in for four, out for six."}
      </p>
    </div>
  );
}
