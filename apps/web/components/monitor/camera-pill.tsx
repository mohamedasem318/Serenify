"use client";

import { cn } from "@/lib/utils";

/**
 * The state-driven camera pill (feature 008, US1 — T031). A small status affordance in
 * the stage corner that doubles as the peek/pin control for the self-view (T031 viewfinder).
 *
 * US1 states only: **recording** (meadow rec dot, gently pulsing) and **camera off**
 * (muted dot). Out-of-frame and paused pill states are US2 (T040) and are not built here.
 * The pulse is a CSS animation, so the global `prefers-reduced-motion` rule suppresses it.
 */

export function CameraPill({
  recording,
  pinned,
  onTogglePin,
}: {
  recording: boolean;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTogglePin}
      aria-pressed={pinned}
      aria-label={
        recording
          ? `Camera recording. ${pinned ? "Hide" : "Show"} the self-view preview.`
          : "Camera off."
      }
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-bg/80 px-3.5 py-2",
        "text-sm text-ink shadow-soft backdrop-blur transition-colors",
        "hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foggy",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2.5 rounded-full",
          recording ? "animate-pulse bg-meadow" : "bg-muted",
        )}
      />
      <span className="font-medium">{recording ? "Recording" : "Camera off"}</span>
      {recording && (
        <span className="text-xs text-muted">{pinned ? "· pinned" : "· hover to peek"}</span>
      )}
    </button>
  );
}
