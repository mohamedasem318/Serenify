"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CauseChip, type FailureCause } from "./cause-chip";

/**
 * The post-recording failure state (feature 005, FR-027–030) — a calm sibling of
 * success, for when the minute recorded but processing couldn't set the baseline.
 * FOGGY (never red, never amber), honest, no self-blame. A small cause chip (the
 * shared `CauseChip`, T029) names the actual reason and adapts to it; "our side" owns
 * our own failures and gives no "do better" tip. After several attempts, a gentle
 * escape appears.
 *
 * Colour rule: this is a FOGGY screen, so the primary "Try again" / "Try once
 * more" is a FOGGY-filled CTA (not meadow); the "Not now" / "Maybe later" exit
 * stays a quiet text link.
 */

// Re-exported so existing importers keep `@/components/anchor/failure-state`'s FailureCause.
export type { FailureCause } from "./cause-chip";

export function FailureState({
  cause,
  escapeVisible,
  onRetry,
  onNotNow,
  onPause,
}: {
  cause: FailureCause;
  escapeVisible: boolean;
  onRetry: () => void;
  onNotNow: () => void;
  onPause: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-2 py-6 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-foggy/15 text-foggy">
        <RefreshCw className="size-7" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="space-y-2">
        <h2 className="font-display text-2xl text-ink">We couldn’t set your baseline that time</h2>
        <p className="text-pretty text-base leading-relaxed text-muted">
          No worries — it happens. Let’s take another calm minute.
        </p>
      </div>

      {/* adaptive cause chip — the shared CauseChip (icon + one foggy line) */}
      <CauseChip cause={cause} />

      {escapeVisible ? (
        <div className="w-full max-w-xs space-y-2">
          <p className="text-sm text-muted">
            Let’s pause this for now — you can set your baseline later from your account.
          </p>
          <Button onClick={onRetry} variant="foggy" className="h-12 w-full text-base">
            Try once more
          </Button>
          <Button variant="ghost" onClick={onPause} className="h-11 w-full text-muted">
            Maybe later
          </Button>
        </div>
      ) : (
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button onClick={onRetry} variant="foggy" className="h-12 w-full text-base">
            Try again
          </Button>
          <Button variant="ghost" onClick={onNotNow} className="h-11 w-full text-muted">
            Not now
          </Button>
        </div>
      )}
    </div>
  );
}
