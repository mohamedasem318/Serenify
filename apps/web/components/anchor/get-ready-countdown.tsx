"use client";

import { useEffect, useState } from "react";

import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * The gentle get-ready beat (feature 005, FR-012/013/014): a simple 3 → 2 → 1,
 * **numbers only — no draining ring**. The preview blur→softened transition is
 * owned by the recording-stage preview layer (keyed on recorder state); this
 * component is the count + a quiet "Cancel". Under reduced motion the number just
 * ticks with no zoom/fade (FR-048) — gated by the shared hook, not the CSS clamp.
 */
export function GetReadyCountdown({
  from = 3,
  onComplete,
  onCancel,
}: {
  from?: number;
  onComplete: () => void;
  onCancel: () => void;
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
    <div className="flex flex-col items-center gap-10 text-center">
      <p className="text-base text-muted">Beginning now — settle in.</p>
      <div
        role="timer"
        aria-live="assertive"
        aria-label={`Starting in ${Math.max(count, 0)}`}
        className="grid h-32 w-32 place-items-center"
      >
        {count > 0 ? (
          <span
            key={count}
            className={`font-display text-8xl leading-none tabular-nums text-ink ${
              reducedMotion ? "" : "animate-in fade-in zoom-in-75 duration-300"
            }`}
          >
            {count}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex min-h-11 items-center rounded-control px-4 text-sm text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meadow"
      >
        Cancel
      </button>
    </div>
  );
}
