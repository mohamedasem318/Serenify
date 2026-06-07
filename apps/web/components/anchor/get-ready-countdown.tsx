"use client";

import { useEffect, useState } from "react";

import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * The gentle get-ready beat (feature 005, FR-012/013/014): a simple 3 → 2 → 1,
 * **numbers only — no draining ring**. Per the global "no words on the video" rule,
 * this renders ONLY the numeral as a focal graphic over the blurred preview; the
 * calm "settle in" line and the quiet "Cancel" live in the controls region BELOW
 * the preview (owned by the orchestrator). Under reduced motion the number just
 * ticks with no zoom/fade (FR-048) — gated by the shared hook, not the CSS clamp.
 *
 * The numeral is white with a soft shadow: it sits over a live (blurred) camera
 * frame, so a fixed mode token can't guarantee contrast — white-on-media is the
 * legible, conventional choice for an over-video graphic (not a palette surface).
 */
export function GetReadyCountdown({
  from = 3,
  onComplete,
}: {
  from?: number;
  onComplete: () => void;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [count, setCount] = useState(from);

  useEffect(() => {
    if (count <= 0) return;
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [count]);

  useEffect(() => {
    if (count <= 0) onComplete();
  }, [count, onComplete]);

  return (
    <div
      role="timer"
      aria-live="assertive"
      aria-label={`Starting in ${Math.max(count, 0)}`}
      className="grid h-32 w-32 place-items-center"
    >
      {count > 0 ? (
        <span
          key={count}
          className={`font-display text-8xl leading-none tabular-nums text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] ${
            reducedMotion ? "" : "animate-in fade-in zoom-in-75 duration-300"
          }`}
        >
          {count}
        </span>
      ) : null}
    </div>
  );
}
