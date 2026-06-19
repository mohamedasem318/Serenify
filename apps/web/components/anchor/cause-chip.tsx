"use client";

import { CloudOff, MoveDiagonal, ScanFace, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The shared cause chip + vocabulary (feature 005/006; extracted in feature 008 T029).
 * One small FOGGY line — an icon + a gentle, non-blaming reason/fix — reused by the
 * calibration failure state (`failure-state.tsx`) AND the monitoring skipped-read note
 * (`op-surfaces.tsx`), so both speak the same cause language (Principle III reuse).
 *
 * FOGGY, never red/amber: a couldn't-read is an attention state, not a stress signal.
 * "our-side" owns our own failure and gives no "do better" tip.
 */

export type FailureCause = "low-light" | "out-of-frame" | "our-side" | "insufficient-face";

export const CAUSE: Record<FailureCause, { Icon: LucideIcon; line: string }> = {
  "low-light": { Icon: Sun, line: "Facing a little more light usually helps." },
  "out-of-frame": { Icon: MoveDiagonal, line: "Staying roughly centred and still helps." },
  "our-side": { Icon: CloudOff, line: "This one was on our side." },
  // feature 006 — the server-authoritative face-absence cause (DECISION-31).
  "insufficient-face": {
    Icon: ScanFace,
    line: "We couldn’t see your face for enough of that recording.",
  },
};

export function CauseChip({ cause, className }: { cause: FailureCause; className?: string }) {
  const { Icon, line } = CAUSE[cause];
  return (
    <p
      className={cn(
        "flex items-center gap-2 rounded-control border border-foggy/40 bg-foggy/10 px-3 py-2 text-sm text-ink",
        className,
      )}
    >
      <Icon className="size-4 shrink-0 text-foggy" strokeWidth={1.75} aria-hidden />
      {line}
    </p>
  );
}
