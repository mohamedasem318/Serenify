"use client";

import { Camera, CameraOff } from "lucide-react";

import { CauseChip } from "@/components/anchor/cause-chip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Bloom } from "./bloom";
import { liveDisplay, type MonitorState, type StatelineTone } from "./use-monitoring-session";

/**
 * The monitoring stage surfaces — US1 SUBSET (feature 008, T030): permission /
 * warming-up / active (live band) / blocked / the skipped-read note. Paused,
 * out-of-frame, and calibrate-first are US2/US3 (T036+/T044) and are NOT built here.
 *
 * Colour discipline (Principle V, traced to the approved mock):
 *  - permission = MEADOW — an affirmative "let's start" invitation (meadow icon + the
 *    meadow "Allow camera access" CTA), NOT an error;
 *  - blocked = FOGGY icon (attention), neutral "Try again";
 *  - the skipped-read note = FOGGY (a couldn't-read, never amber);
 *  - amber appears ONLY on the stress bands (a-little-tense / tense statelines).
 * NO number/gauge anywhere — the bloom is ambient and the band is the only signal (FR-015).
 *
 * The FR-024 reassurance line is the permission panel's "Your manager never sees your
 * video." — its copy + placement trace to the mock (it lives on the permission surface;
 * the mock shows no separate reassurance line on the active surface).
 */

const STATELINE_CLASS: Record<StatelineTone, string> = {
  meadow: "text-meadow-text", // at-ease — calm/affirmative
  amber: "text-amber", // a-little-tense / tense — the stress bands
  muted: "text-muted", // warming-up — neutral, not amber
};

function PermissionPanel({ onAllow }: { onAllow: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 text-center">
      <span className="mb-2 grid size-16 place-items-center rounded-2xl bg-meadow/15 text-meadow">
        <Camera className="size-7" strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="font-display text-2xl text-ink">Serenify needs your camera</h2>
      <p className="text-pretty text-base leading-relaxed text-muted">
        Reads facial cues to gauge stress while you work. Your manager never sees your video.
      </p>
      <div className="mt-5">
        <Button onClick={onAllow} variant="meadow" className="h-12 px-6 text-base">
          Allow camera access
        </Button>
      </div>
    </div>
  );
}

function BlockedPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 text-center">
      <span className="mb-2 grid size-16 place-items-center rounded-2xl bg-foggy/15 text-foggy">
        <CameraOff className="size-7" strokeWidth={1.75} aria-hidden />
      </span>
      <h2 className="font-display text-2xl text-ink">Camera access is blocked</h2>
      <p className="text-pretty text-base leading-relaxed text-muted">
        Serenify can&apos;t start a check-in without it. Re-enable camera access for this site in
        your browser settings, then try again.
      </p>
      <div className="mt-5">
        <Button onClick={onRetry} variant="outline" className="h-12 px-6 text-base">
          Try again
        </Button>
      </div>
    </div>
  );
}

/** A skipped read: the bloom holds the last band; a calm FOGGY note names a likely
 *  cause + gentle fix via the shared CauseChip. Never amber (it's attention, not stress). */
function SkipNote({ cause }: { cause: React.ComponentProps<typeof CauseChip>["cause"] }) {
  return (
    <div className="mt-5 w-full max-w-md space-y-2 text-left" role="status" aria-live="polite">
      <p className="text-sm font-semibold text-ink">Couldn&apos;t get a clear read</p>
      <CauseChip cause={cause} />
    </div>
  );
}

function LiveStage({ state }: { state: MonitorState }) {
  const d = liveDisplay(state);
  return (
    <div className="flex flex-col items-center text-center">
      <Bloom tone={d.tone} />
      {/* The state line — the bloom carries the feel, this carries the meaning. A live
          region so band changes are announced; NO number is ever rendered (FR-015). */}
      <p
        aria-live="polite"
        className={cn("mt-6 font-display text-3xl tracking-tight", STATELINE_CLASS[d.statelineTone])}
      >
        {d.head}
      </p>
      <p className="mt-1.5 max-w-[42ch] text-base text-muted">{d.sub}</p>
      {state.skipCause && <SkipNote cause={state.skipCause} />}
    </div>
  );
}

export function OpSurfaces({
  state,
  onAllow,
  onRetryBlocked,
}: {
  state: MonitorState;
  onAllow: () => void;
  onRetryBlocked: () => void;
}) {
  switch (state.op) {
    case "permission":
      return <PermissionPanel onAllow={onAllow} />;
    case "blocked":
      return <BlockedPanel onRetry={onRetryBlocked} />;
    case "calibrate-first":
      // US3 / T044 owns the calibrate-first panel + "Start calibration" routing. US1's
      // test uses a calibrated account, so this branch is a seam only — not rendered here.
      return null;
    default:
      // warming-up | active — the live bloom stage.
      return <LiveStage state={state} />;
  }
}
