"use client";

import { useEffect, useState } from "react";

import { motion } from "framer-motion";

import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * The breathing guide (feature 005 FR-015/016; redesigned for 007 FR-028/032/033)
 * — the focal graphic ON the softened preview. A clean **layered meadow bloom**:
 * concentric translucent meadow discs (radial-gradient / stepped-opacity, no
 * glassmorphism) that gently fill and empty with the ~8s breathe cycle, with the
 * stepped "Breathe in" / "Breathe out" pacer centred on it. It is not a progress
 * indicator — the capture progress bar (below the preview) is the sole progress.
 *
 * Source of truth: `serenify-007-orb-mock.html`. The 007 redesign **removes the
 * earlier frosted-glass effect** (glassmorphism, FR-019) and the separate pale
 * text-backing: the bloom is just the discs, and the label sits on it as white +
 * a soft drop-shadow — the established on-video text treatment (FR-022); it is the
 * ONLY text permitted on the raw video (all status copy lives in the card below,
 * FR-031).
 *
 * The bloom is the only animated layer: its scale eases up on the inhale and down
 * through the exhale (the lung filling and emptying). Under reduced motion
 * (detected via the repo `useMediaQuery`, NOT framer's useReducedMotion) the bloom
 * is static and the label is a single static "Breathe gently" (FR-032). Component
 * interface is frozen (no props) — consumed by the recording stage unchanged.
 */

const PHASE_LABEL = { in: "Breathe in", out: "Breathe out" } as const;
const STATIC_LABEL = "Breathe gently";

// Concentric meadow discs, outer→inner: a feathered outer halo, then progressively
// smaller / denser translucent pools. All derive from --color-meadow via color-mix,
// so both modes track the token swap (no hardcoded hue). Sizes are % of the orb box
// so the bloom scales with the responsive container.
const DISCS = [
  {
    size: "size-full",
    bg: "radial-gradient(circle, color-mix(in srgb, var(--color-meadow) 18%, transparent) 0%, transparent 70%)",
  },
  { size: "size-[79%]", bg: "color-mix(in srgb, var(--color-meadow) 12%, transparent)" },
  { size: "size-[59%]", bg: "color-mix(in srgb, var(--color-meadow) 20%, transparent)" },
  { size: "size-[40%]", bg: "color-mix(in srgb, var(--color-meadow) 34%, transparent)" },
] as const;

export function BreathingOrb() {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [phase, setPhase] = useState<"in" | "out">("in");

  // Swap the label on the breath cadence (4s inhale / 4s exhale = the 8s cycle),
  // an instant content swap. Held static under reduced motion (FR-032) — the
  // effect simply doesn't schedule, so the label stays on STATIC_LABEL.
  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => {
      setPhase((p) => (p === "in" ? "out" : "in"));
    }, 4000);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const label = reducedMotion ? STATIC_LABEL : PHASE_LABEL[phase];

  // The four concentric discs — purely decorative, hidden from assistive tech.
  const discs = DISCS.map((d, i) => (
    <span
      key={i}
      aria-hidden
      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${d.size}`}
      style={{ background: d.bg }}
    />
  ));

  return (
    <div className="relative grid size-36 place-items-center sm:size-44">
      {/* the breath — concentric meadow discs that scale up on the inhale and down
          through the exhale; the only animated layer. Held static under reduced
          motion. Decorative (aria-hidden); the label below carries the meaning. */}
      {reducedMotion ? (
        <div
          aria-hidden
          data-testid="breath-bloom-static"
          className="absolute inset-0"
        >
          {discs}
        </div>
      ) : (
        <motion.div
          aria-hidden
          data-testid="breath-bloom-animated"
          className="absolute inset-0"
          animate={{ scale: [0.84, 1.12, 0.84] }}
          // 8s cycle: 0→50% = 4s inhale (fuller), 50→100% = 4s exhale (softer).
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          {discs}
        </motion.div>
      )}

      {/* the pacer label — fixed size, centred, never scales. White + soft
          drop-shadow is the established on-video text treatment (FR-022); the only
          text on the raw video. aria-live announces the cadence to screen readers. */}
      <p
        aria-live="polite"
        className="relative z-10 text-center text-sm font-medium tracking-wide text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]"
      >
        {label}
      </p>
    </div>
  );
}
