import { LifeBuoy } from "lucide-react";

import type { CrisisPanel } from "@/lib/api/chat-client";

/**
 * Live crisis resource panel (FR-043; mock "Reach someone who can help"). Calm "foggy
 * attention" treatment — a foggy left accent on a surface card, NEVER crimson/red.
 * Resources and the universal line come only from the verified app table; rendering
 * this panel persists nothing and notifies no one (FR-035/041/042).
 */
export function CrisisResourcePanel({ panel }: { panel: CrisisPanel }) {
  return (
    <div
      role="note"
      aria-label="Crisis support resources"
      data-testid="crisis-panel"
      className="self-stretch rounded-2xl border border-border border-l-[3px] border-l-foggy bg-surface p-4 shadow-soft"
    >
      <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <LifeBuoy aria-hidden className="h-[18px] w-[18px] shrink-0 text-foggy" />
        Reach someone who can help
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Free, confidential, and available now. {panel.universalLine}
      </p>

      {panel.resources.map((r) => (
        <div
          key={r.country}
          className="mt-2 flex items-center gap-3 rounded-xl bg-bg px-3 py-2"
        >
          <span className="text-sm font-semibold text-ink">{r.name}</span>
          <span className="ml-auto font-display text-sm font-semibold text-meadow-text">
            {r.number}
          </span>
        </div>
      ))}

      {panel.emergencyNumber && (
        <p className="mt-2 text-sm text-muted">
          Emergency services:{" "}
          <span className="font-semibold text-ink">{panel.emergencyNumber}</span>
        </p>
      )}
    </div>
  );
}
