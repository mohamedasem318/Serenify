"use client";

import { cn } from "@/lib/utils";

/**
 * The state-driven camera pill (feature 008 — T031 US1 + T040 US2). A small status
 * affordance in the stage corner that doubles as the peek/pin control for the self-view
 * (the viewfinder).
 *
 * Four states (verbatim from the approved mock's pill map):
 *   recording   — meadow dot, gently pulsing (camera live, scoring)
 *   out-of-frame— FOGGY dot, no pulse (auto-paused; the self-view is force-revealed)
 *   paused      — muted dot (manual break, camera off)
 *   off         — muted dot (permission / blocked / ended — no camera)
 *
 * Colour discipline (Principle V): out-of-frame is FOGGY (attention), never amber — the
 * camera state is not a stress signal. The pulse is a CSS animation, so the global
 * `prefers-reduced-motion` rule suppresses it.
 */

export type CameraPillStatus = "recording" | "out-of-frame" | "paused" | "off";

const DOT_CLASS: Record<CameraPillStatus, string> = {
  recording: "animate-pulse bg-meadow",
  "out-of-frame": "bg-foggy",
  paused: "bg-muted",
  off: "bg-muted",
};

const LABEL: Record<CameraPillStatus, string> = {
  recording: "Recording",
  "out-of-frame": "Out of frame",
  paused: "Paused",
  off: "Camera off",
};

export function CameraPill({
  status,
  pinned,
  onTogglePin,
}: {
  status: CameraPillStatus;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  // The self-view can be peeked/pinned only while the camera is live (recording). During
  // out-of-frame the viewfinder is force-revealed already, so the pill is informational.
  const peekable = status === "recording";
  return (
    <button
      type="button"
      onClick={onTogglePin}
      aria-pressed={peekable ? pinned : undefined}
      aria-label={
        peekable
          ? `Camera recording. ${pinned ? "Hide" : "Show"} the self-view preview.`
          : `${LABEL[status]}.`
      }
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-bg/80 px-3.5 py-2",
        "text-sm text-ink shadow-soft backdrop-blur transition-colors",
        "hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foggy",
      )}
    >
      <span aria-hidden className={cn("size-2.5 rounded-full", DOT_CLASS[status])} />
      <span className="font-medium">{LABEL[status]}</span>
      {peekable && (
        <span className="text-xs text-muted">{pinned ? "· pinned" : "· hover to peek"}</span>
      )}
    </button>
  );
}
