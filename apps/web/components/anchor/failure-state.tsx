"use client";

import { CloudOff, MoveDiagonal, RefreshCw, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The post-recording failure state (feature 005, FR-027–030) — a calm sibling of
 * success, for when the minute recorded but processing couldn't set the baseline.
 * FOGGY (never red, never amber), honest, no self-blame. A small cause chip names
 * the actual reason and adapts to it; "our side" owns our own failures and gives
 * no "do better" tip. After several attempts, a gentle escape appears.
 */

export type FailureCause = "low-light" | "out-of-frame" | "our-side";

const CAUSE: Record<FailureCause, { Icon: LucideIcon; line: string }> = {
  "low-light": { Icon: Sun, line: "Facing a little more light usually helps." },
  "out-of-frame": { Icon: MoveDiagonal, line: "Staying roughly centred and still helps." },
  "our-side": { Icon: CloudOff, line: "This one was on our side — give it a moment and try again." },
};

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
  const { Icon, line } = CAUSE[cause];

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

      {/* adaptive cause chip — icon + one line, foggy */}
      <p className="flex items-center gap-2 rounded-control border border-foggy/40 bg-foggy/10 px-3 py-2 text-sm text-ink">
        <Icon className="size-4 shrink-0 text-foggy" strokeWidth={1.75} aria-hidden />
        {line}
      </p>

      {escapeVisible ? (
        <div className="w-full max-w-xs space-y-2">
          <p className="text-sm text-muted">
            Let’s pause this for now — you can set your baseline later from your account.
          </p>
          <Button onClick={onRetry} variant="meadow" className="h-12 w-full text-base">
            Try once more
          </Button>
          <Button variant="ghost" onClick={onPause} className="h-11 w-full text-muted">
            Maybe later
          </Button>
        </div>
      ) : (
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button onClick={onRetry} variant="meadow" className="h-12 w-full text-base">
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
