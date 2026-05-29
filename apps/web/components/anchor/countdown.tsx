"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** Track `prefers-reduced-motion` reactively (Principle VI, FR-009). */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(QUERY).matches,
    () => false, // SSR snapshot: assume motion is allowed
  );
}

const SIZE = 96;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Visible 60→0 countdown (FR-008/009). An animated meadow ring sweeps down by
 * default; under `prefers-reduced-motion` it collapses to a plain numeric tick
 * with no ring/sweep. Tabular figures keep the number from reflowing each tick.
 */
export function Countdown({ remaining, total }: { remaining: number; total: number }) {
  const reducedMotion = usePrefersReducedMotion();
  const fraction = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const label = `${remaining} second${remaining === 1 ? "" : "s"} remaining`;

  if (reducedMotion) {
    return (
      <div
        role="timer"
        aria-label={label}
        className="flex h-24 w-24 items-center justify-center rounded-full border border-border bg-surface"
      >
        <span className="font-display text-3xl tabular-nums text-ink">{remaining}</span>
      </div>
    );
  }

  return (
    <div role="timer" aria-label={label} className="relative h-24 w-24">
      <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden="true">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-border"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          className="text-meadow transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-3xl tabular-nums text-ink">
        {remaining}
      </span>
    </div>
  );
}
