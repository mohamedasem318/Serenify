"use client";

import { motion } from "framer-motion";

import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

import type { BloomTone } from "./use-monitoring-session";

/**
 * The ambient breathing **bloom** (feature 008, US1 — T028; the signature surface, FR-021).
 * A soft layered glow that gently breathes and drifts between three band colours — it is
 * NOT a gauge and carries NO number (FR-015); the stateline text below carries the meaning,
 * so the bloom is decorative (`aria-hidden`).
 *
 * Reuses the calibration orb's technique (`breathing-guide.tsx`): Framer Motion scale,
 * the repo `useMediaQuery` for reduced-motion (NOT framer's), and Graphite tokens via
 * `color-mix` — no hardcoded hue. The band drives a single `--bloom` colour the layers
 * read, and a slow `background` transition makes a band change DRIFT rather than snap
 * (matching the mock's bloom). Under reduced motion the breathing is suppressed (the
 * bloom is static); the colour still updates.
 *
 * Colour roles (mock bloom): at-ease = meadow; tense = amber; a-little-tense = the mid
 * gold BETWEEN them (the mock's `--bloom-little`), derived here from the real meadow +
 * amber tokens via `color-mix` rather than the mock's raw hex; warming-up = meadow.
 */

const TONE_COLOR: Record<BloomTone, string> = {
  ease: "var(--color-meadow)",
  warming: "var(--color-meadow)",
  // The mock's `--bloom-little` mid-gold expressed through the real tokens (not raw hex).
  little: "color-mix(in srgb, var(--color-amber) 55%, var(--color-meadow))",
  tense: "var(--color-amber)",
};

const CORE_BG =
  "radial-gradient(circle at 50% 46%, color-mix(in srgb, var(--bloom) 92%, white 8%) 0%, " +
  "var(--bloom) 34%, color-mix(in srgb, var(--bloom) 30%, transparent) 70%, transparent 76%)";
const HALO_BG =
  "radial-gradient(circle, color-mix(in srgb, var(--bloom) 40%, transparent) 0%, transparent 62%)";

export function Bloom({ tone, className }: { tone: BloomTone; className?: string }) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // Sizing: the monitoring-stage bloom by default (≈220px → 288px), overridable.
  const box = cn("relative grid size-56 place-items-center sm:size-72", className);
  const style = { ["--bloom" as string]: TONE_COLOR[tone] };

  const halo = (
    <span
      className="absolute -inset-[28%] rounded-full blur-2xl"
      style={{ background: HALO_BG, transition: "background 1.3s ease" }}
    />
  );
  const core = (
    <span
      className="absolute inset-0 rounded-full"
      style={{ background: CORE_BG, transition: "background 1.3s ease" }}
    />
  );

  return (
    <div
      aria-hidden
      data-testid="bloom"
      data-tone={tone}
      data-motion={reducedMotion ? "static" : "animated"}
      className={box}
      style={style}
    >
      {reducedMotion ? (
        <>
          {halo}
          {core}
        </>
      ) : (
        <>
          <motion.span
            className="absolute -inset-[28%] rounded-full blur-2xl"
            style={{ background: HALO_BG, transition: "background 1.3s ease" }}
            animate={{ scale: [0.9, 1.06, 0.9], opacity: [0.72, 1, 0.72] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: CORE_BG, transition: "background 1.3s ease" }}
            animate={{ scale: [0.94, 1.03, 0.94] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}
    </div>
  );
}
